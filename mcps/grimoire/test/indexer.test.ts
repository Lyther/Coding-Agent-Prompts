import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildIndex, parseFrontmatter } from "../src/indexer.js";
import { Store } from "../src/store.js";
import { setupIndex } from "./helpers.js";

test("parseFrontmatter reads inline + folded multi-line scalars", () => {
  const p = parseFrontmatter("---\nname: foo-bar\ndescription: line one\n  continues here\n  and here\ntags:\n- a\n- b\n---\nBODY TEXT\n");
  assert.ok(p);
  assert.equal(p!.fields["name"], "foo-bar");
  assert.equal(p!.fields["description"], "line one continues here and here");
  assert.equal(p!.body, "BODY TEXT\n");
  assert.equal(parseFrontmatter("# no frontmatter\n"), null);
});

test("buildIndex validates + skips malformed, stores valid skills and files", () => {
  const { res, dir, cleanup } = setupIndex();
  try {
    assert.equal(res.skills, 3, "3 valid skills indexed");
    assert.equal(res.files, 2, "iocs.md + run.py stored; mfa has none");
    assert.ok(res.skipped.some((s) => s.dir === "no-frontmatter-bad" && /frontmatter/.test(s.reason)), "malformed skill skipped, not crashed");

    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.packs[0].serviceId, "fixture");
    assert.match(manifest.packs[0].sourceHash, /^[0-9a-f]{64}$/);
    assert.ok(existsSync(join(dir, "index.sqlite")));
  } finally { cleanup(); }
});

test("supporting-file content is stored RAW (angle brackets / XML survive)", () => {
  const { store, cleanup } = setupIndex();
  try {
    const f = store.fileGet("fixture:detecting-cobalt-strike-beacons", "references/iocs.md");
    assert.equal(f.status, "ok");
    if (f.status === "ok") {
      assert.match(f.file.content, /<ioc type="ip">203\.0\.113\.5<\/ioc>/, "raw XML preserved verbatim");
      assert.match(f.file.content, /id=<beacon-id>/, "angle brackets not stripped");
    }
  } finally { cleanup(); }
});

test("a requested pack with no skills/ dir FAILS the build and never touches an existing index", () => {
  const { dir, store, cleanup } = setupIndex(); // good index already built in dir
  try {
    const before = store.search("cobalt", 1);
    assert.equal(before.status, "ok");
    // Re-index the SAME dir pointing at an absent pack: must throw, not silently empty-build.
    assert.throws(
      () => buildIndex({ packs: [{ serviceId: "ghost", path: join(dir, "no-such-pack"), commit: "c" }], outDir: dir }),
      /no skills\/ directory/,
    );
    // Non-destructive: the prior index + manifest survive and still serve; no temp leaked.
    const after = new Store({ dir });
    try { assert.equal(after.search("cobalt", 1).status, "ok", "existing index untouched after failed rebuild"); }
    finally { after.close(); }
    assert.ok(!readdirSync(dir).some((f) => f.includes(".tmp.")), "half-written temp db cleaned up");
  } finally { cleanup(); }
});

test("sourceHash is stable across identical rebuilds (drift detection)", () => {
  const a = setupIndex();
  const b = setupIndex();
  try {
    assert.equal(a.res.manifest.packs[0]!.sourceHash, b.res.manifest.packs[0]!.sourceHash);
  } finally { a.cleanup(); b.cleanup(); }
});

test("a dirty Git pack is not attributed to its clean HEAD commit", () => {
  const dir = join(tmpdir(), `grimoire-dirty-${process.pid}-${Date.now()}`);
  const pack = join(dir, "pack");
  const out = join(dir, "out");
  const skillDir = join(pack, "skills", "useful-skill");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: useful-skill\ndescription: Useful test skill.\n---\nUse the clean procedure.\n");
  execFileSync("git", ["init", "-q", pack]);
  execFileSync("git", ["-C", pack, "add", "."]);
  execFileSync("git", ["-C", pack, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"]);
  const cleanHead = execFileSync("git", ["-C", pack, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: useful-skill\ndescription: Useful changed skill.\n---\nUse the changed procedure.\n");

  try {
    const result = buildIndex({ packs: [{ serviceId: "fixture", path: pack }], outDir: out });
    assert.notEqual(result.manifest.packs[0]!.commit, cleanHead);
    assert.equal(result.manifest.packs[0]!.commit, `${cleanHead}-dirty`);
    const store = new Store({ dir: out });
    try {
      assert.deepEqual(store.indexStatus(), { status: "ok" });
      const indexed = store.get("fixture:useful-skill");
      assert.equal(indexed.status, "ok");
      if (indexed.status === "ok") {
        assert.equal(indexed.skill.provenance.sourceCommit, `${cleanHead}-dirty`);
      }
    } finally {
      store.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ignored files included in the index mark Git provenance dirty", () => {
  const dir = join(tmpdir(), `grimoire-ignored-${process.pid}-${Date.now()}`);
  const pack = join(dir, "pack");
  const out = join(dir, "out");
  const skillDir = join(pack, "skills", "useful-skill");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(pack, ".gitignore"), "skills/*/references/ignored.md\n");
  writeFileSync(join(skillDir, "SKILL.md"), "---\nname: useful-skill\ndescription: Useful test skill.\n---\nUse references/ignored.md.\n");
  execFileSync("git", ["init", "-q", pack]);
  execFileSync("git", ["-C", pack, "add", "."]);
  execFileSync("git", ["-C", pack, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "initial"]);
  const cleanHead = execFileSync("git", ["-C", pack, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  mkdirSync(join(skillDir, "references"));
  writeFileSync(join(skillDir, "references", "ignored.md"), "Local ignored procedure.\n");

  try {
    const result = buildIndex({ packs: [{ serviceId: "fixture", path: pack }], outDir: out });
    assert.equal(result.files, 1, "ignored supporting file was part of the indexed bytes");
    assert.equal(result.manifest.packs[0]!.commit, `${cleanHead}-dirty`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// SUBSTITUTE_JUSTIFICATION
// - substitute: onSourceRead callback controlling only when the real source file is restored
// - replaces: nondeterministic child-process scheduling around the post-read interleaving
// - necessity: the exact read-then-restore order cannot be made deterministic with wall-clock delays
// - real-option: a real child process with a fixed delay was used and failed nondeterministically under load
// - proof-limit: proves snapshot re-verification for this interleaving, not detection of every transient filesystem write
// - real-proof: the adjacent real-Git dirty and ignored-file cases exercise normal buildIndex provenance behavior
test("source restored after an indexed read is still marked dirty", () => {
  const dir = join(tmpdir(), `grimoire-race-${process.pid}-${Date.now()}`);
  const pack = join(dir, "pack");
  const out = join(dir, "out");
  const skillDir = join(pack, "skills", "useful-skill");
  const skillPath = join(skillDir, "SKILL.md");
  const clean = "---\nname: useful-skill\ndescription: Clean skill.\n---\nUse the clean procedure.\n";
  const mutated = "---\nname: useful-skill\ndescription: Mutated skill.\n---\nUse the transient procedure.\n";
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(skillPath, mutated);

  try {
    let restored = false;
    const result = buildIndex({
      packs: [{ serviceId: "fixture", path: pack, commit: "fixturecommit" }],
      outDir: out,
      onSourceRead: (file: string) => {
        if (file === skillPath) {
          writeFileSync(skillPath, clean);
          restored = true;
        }
      },
    });
    assert.equal(restored, true, "the source was restored immediately after its indexed read");
    assert.equal(readFileSync(skillPath, "utf8"), clean, "source was restored before the build completed");
    assert.equal(result.manifest.packs[0]!.commit, "fixturecommit-dirty");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
