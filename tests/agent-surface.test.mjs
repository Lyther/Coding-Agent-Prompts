#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts", "agent-surface.mjs");
const stripAiAttributionHook = path.join(root, "hooks", "strip-ai-attribution.sh");
const opsServerCommandPath = path.join(root, "commands", "ops-server.md");
const hasLocalOpsServerCommand = existsSync(opsServerCommandPath);
const expectedCommandCount = hasLocalOpsServerCommand ? 67 : 66;

function run(args, options = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function status(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function files(dir) {
  const out = [];
  let entries;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      entries = readdirSync(dir, { withFileTypes: true });
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  if (!entries) return out;
  for (const name of entries) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...files(full));
    if (name.isFile()) out.push(full);
  }
  return out;
}

const guardedRepoFiles = [
  path.join(root, "registry", "targets.json"),
  path.join(root, "registry", "optional-services.json"),
  path.join(root, "registry", "legacy-owned.json"),
  path.join(root, "subagents", "boss.md"),
];
const guardedSnapshots = new Map();
for (const file of guardedRepoFiles) {
  try {
    guardedSnapshots.set(file, readFileSync(file, "utf8"));
  } catch {
    guardedSnapshots.set(file, null);
  }
}
function restoreGuardedFiles() {
  for (const [file, content] of guardedSnapshots) {
    if (content !== null) {
      try {
        writeFileSync(file, content);
      } catch {
        // best-effort restore; ignore failures during teardown
      }
    }
  }
}
// Restore only on interruption (Ctrl-C / kill / hangup): the finally blocks
// already cover normal completion and thrown exceptions, and a normal-exit
// handler would re-write a stale snapshot that can clobber concurrent writes
// to these shared registry/subagent files during the post-finally test runtime.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    restoreGuardedFiles();
    process.exit(130);
  });
}

function assertTomlParses(dir) {
  const script = `
import pathlib
import sys
import tomllib
bad = []
for p in pathlib.Path(sys.argv[1]).rglob("*.toml"):
    try:
        tomllib.loads(p.read_text())
    except Exception as exc:
        bad.append(f"{p}: {exc}")
if bad:
    raise SystemExit("\\n".join(bad))
`;
  execFileSync("python3", ["-c", script, dir], {
    cwd: root,
    encoding: "utf8",
  });
}

function assertCodexAgentTomlParses() {
  assertTomlParses(path.join(root, "dist", "codex", ".codex", "agents"));
}

function assertStripAiAttributionHook() {
  const tmpDir = mkdtempSync("/tmp/agent-surface-strip-ai-");
  try {
    const messagePath = path.join(tmpDir, "COMMIT_EDITMSG");
    const original = [
      "feat(cursor): keep technical scope",
      "",
      "Real body mentioning Cursor as a first-class target.",
      "",
      "Co-authored-by: Human Cursor <human.cursor@example.com>",
      "Co-authored-by: Cursor <cursoragent@cursor.com>",
      "🤖 Generated with [Claude Code](https://claude.ai/code)",
      "Generated-by: Cursor Agent",
      "",
    ].join("\n");
    writeFileSync(messagePath, original);

    const strip = spawnSync(stripAiAttributionHook, [messagePath], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(strip.status, 0, strip.stderr);
    assert.match(strip.stderr, /removed AI attribution/);
    const cleaned = readFileSync(messagePath, "utf8");
    assert.match(cleaned, /^feat\(cursor\): keep technical scope/);
    assert.match(cleaned, /Real body mentioning Cursor as a first-class target/);
    assert.match(cleaned, /Co-authored-by: Human Cursor <human.cursor@example.com>/);
    assert.doesNotMatch(cleaned, /cursoragent@cursor\.com/);
    assert.doesNotMatch(cleaned, /Generated with/);
    assert.doesNotMatch(cleaned, /Generated-by/);

    const unrelatedPath = path.join(tmpDir, "UNRELATED_EDITMSG");
    const unrelated = [
      "docs: preserve unrelated vendor notes",
      "",
      "Generated with Codex during a benchmark note.",
      "Generated-by: Gemini CLI",
      "Co-authored-by: OpenAI User <human.openai@example.com>",
      "",
    ].join("\n");
    writeFileSync(unrelatedPath, unrelated);
    const unrelatedCheck = spawnSync(stripAiAttributionHook, ["--check", unrelatedPath], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(unrelatedCheck.status, 0, unrelatedCheck.stderr);
    assert.equal(readFileSync(unrelatedPath, "utf8"), unrelated);

    writeFileSync(messagePath, original);
    const check = spawnSync(stripAiAttributionHook, ["--check", messagePath], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(check.status, 1);
    assert.match(check.stderr, /AI attribution or vendor advertising found/);
    assert.equal(readFileSync(messagePath, "utf8"), original);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Self-clean so prior build artifacts cannot make tests observe stale state.
rmSync(path.join(root, "dist"), { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });

assertStripAiAttributionHook();
assert.equal(run(["check"]).trim(), "check: ok");
assert.match(run(["check", "commands"]), /commands check: ok/);

const targetCapabilities = JSON.parse(readFileSync(path.join(root, "registry", "target-capabilities.json"), "utf8"));
const clineCapabilities = targetCapabilities.targets.cline;
assert.ok(clineCapabilities.generated_render_tokens.includes("subagents"));
assert.equal(clineCapabilities.surfaces.subagents.generation, "generated");
assert.match(clineCapabilities.surfaces.subagents.notes, /subagents\/\*\.md source primitive compiles to Cline Configured Agents/);
assert.equal(clineCapabilities.surfaces["runtime-subagents"].generation, "not-applicable");
assert.match(clineCapabilities.surfaces["runtime-subagents"].notes, /separate from Configured Agents/);

// renders validation: registry must not claim a surface token that no producer emits
const targetsRegistryPath = path.join(root, "registry", "targets.json");
const targetsRegistryOriginal = readFileSync(targetsRegistryPath, "utf8");
try {
  const mutatedTargets = JSON.parse(targetsRegistryOriginal);
  mutatedTargets.in_scope.codex.renders.push("bogus-token");
  writeFileSync(targetsRegistryPath, `${JSON.stringify(mutatedTargets, null, 2)}\n`);
  const bogusRenders = status(["check"]);
  assert.equal(bogusRenders.status, 1);
  assert.match(bogusRenders.stderr, /renders token not emitted by producer: bogus-token/);
} finally {
  writeFileSync(targetsRegistryPath, targetsRegistryOriginal);
}
assert.equal(run(["check"]).trim(), "check: ok");

const optionalServicesPath = path.join(root, "registry", "optional-services.json");
const optionalServicesOriginal = readFileSync(optionalServicesPath, "utf8");
try {
  const mutatedServices = JSON.parse(optionalServicesOriginal);
  mutatedServices.services["ctf-skills"].optional = true;
  writeFileSync(optionalServicesPath, `${JSON.stringify(mutatedServices, null, 2)}\n`);
  const inconsistentService = status(["check"]);
  assert.equal(inconsistentService.status, 1);
  assert.match(`${inconsistentService.stdout}${inconsistentService.stderr}`, /registry\/optional-services\.json/);
  assert.match(`${inconsistentService.stdout}${inconsistentService.stderr}`, /optional/);
} finally {
  writeFileSync(optionalServicesPath, optionalServicesOriginal);
}
assert.equal(run(["check"]).trim(), "check: ok");

// F001: a required external pack without a committed submodule gitlink must fail check,
// not warn-and-continue (fail-open supply-chain pin verification).
try {
  const mutatedServices = JSON.parse(optionalServicesOriginal);
  mutatedServices.services["ctf-skills"].path = "external/unregistered-required-pin";
  writeFileSync(optionalServicesPath, `${JSON.stringify(mutatedServices, null, 2)}\n`);
  const unpinnedRequired = status(["check"]);
  assert.equal(unpinnedRequired.status, 1);
  assert.match(
    `${unpinnedRequired.stdout}${unpinnedRequired.stderr}`,
    /required external service ctf-skills \(external\/unregistered-required-pin\) is not a registered submodule/,
  );
} finally {
  writeFileSync(optionalServicesPath, optionalServicesOriginal);
}
assert.equal(run(["check"]).trim(), "check: ok");

// First-party MCP entries (synapse) are exempt from the external-submodule pins; dropping
// the first_party flag must re-impose source_url/path/commit so external pins stay enforced.
try {
  const mutatedServices = JSON.parse(optionalServicesOriginal);
  delete mutatedServices.services.synapse.first_party;
  writeFileSync(optionalServicesPath, `${JSON.stringify(mutatedServices, null, 2)}\n`);
  const demotedFirstParty = status(["check"]);
  assert.equal(demotedFirstParty.status, 1);
  assert.match(`${demotedFirstParty.stdout}${demotedFirstParty.stderr}`, /registry\/optional-services\.json/);
} finally {
  writeFileSync(optionalServicesPath, optionalServicesOriginal);
}
assert.equal(run(["check"]).trim(), "check: ok");

// served_by invariant: a served pack must stay a pinned source-pack with NO skill_roots
// (so it never leaks into a host startup catalog), and must name a real first-party MCP.
try {
  const mutated = JSON.parse(optionalServicesOriginal);
  mutated.services["anthropic-cybersecurity-skills"].skill_roots = ["external/anthropic-cybersecurity-skills/skills/*"];
  writeFileSync(optionalServicesPath, `${JSON.stringify(mutated, null, 2)}\n`);
  const r = status(["check"]);
  assert.equal(r.status, 1, "served pack regaining skill_roots must fail check");
  assert.match(`${r.stdout}${r.stderr}`, /served pack anthropic-cybersecurity-skills must not declare skill_roots/);
} finally {
  writeFileSync(optionalServicesPath, optionalServicesOriginal);
}
try {
  const mutated = JSON.parse(optionalServicesOriginal);
  mutated.services["anthropic-cybersecurity-skills"].served_by = ["codex-redteam-mode"]; // a skill-pack, not an mcp service
  writeFileSync(optionalServicesPath, `${JSON.stringify(mutated, null, 2)}\n`);
  const r = status(["check"]);
  assert.equal(r.status, 1, "served_by must reference a first-party mcp service");
  assert.match(`${r.stdout}${r.stderr}`, /server "codex-redteam-mode" must be a first-party mcp service/);
} finally {
  writeFileSync(optionalServicesPath, optionalServicesOriginal);
}
assert.equal(run(["check"]).trim(), "check: ok");

const inventory = run(["inventory"]);
assert.match(inventory, /^rules: 12$/m);
assert.match(inventory, new RegExp(`^commands: ${expectedCommandCount}$`, "m"));
assert.match(inventory, /^subagents: 6$/m);
assert.match(inventory, /^external: 6$/m);
assert.match(inventory, /^schemas: 15$/m);

const registry = JSON.parse(run(["commands", "--json"]));
assert.equal(registry.count, expectedCommandCount);
const readinessCommand = registry.commands.find((command) => command.name === "verify-readiness");
assert.ok(readinessCommand);
assert.equal(readinessCommand.phase, "verify");
const opsFlowCommand = registry.commands.find((command) => command.name === "ops-flow");
assert.ok(opsFlowCommand);
assert.equal(opsFlowCommand.phase, "decide");
assert.equal(opsFlowCommand.metadata_source, "frontmatter");
assert.deepEqual(opsFlowCommand.lazy_body, {
  type: "file",
  path: "commands/ops-flow.md",
  frontmatter_stripped: true,
});
assert.equal(Object.hasOwn(opsFlowCommand, "body"), false);
assert.equal(opsFlowCommand.targets["claude-code"], path.join(".claude", "commands", "ops", "flow.md"));
assert.equal(opsFlowCommand.targets.codex, path.join(".agents", "skills", "ops-flow", "SKILL.md"));
assert.equal(opsFlowCommand.targets.deepagents, path.join(".deepagents", "agent", "skills", "ops-flow", "SKILL.md"));
assert.equal(opsFlowCommand.targets.cline, path.join(".cline", "workflows", "ops-flow.md"));
assert.equal(opsFlowCommand.targets.kilo, path.join(".config", "kilo", "commands", "ops-flow.md"));
assert.equal(opsFlowCommand.targets["antigravity-cli"], path.join("config", "plugins", "agent-surface", "skills", "ops-flow.md"));
assert.equal(Object.hasOwn(opsFlowCommand.targets, "gemini-cli"), false);
assert.equal(opsFlowCommand.targets.cursor, path.join(".cursor", "commands", "ops-flow.md"));
assert.equal(opsFlowCommand.targets.droid, path.join(".factory", "commands", "ops-flow.md"));
assert.equal(opsFlowCommand.targets.opencode, path.join(".config", "opencode", "commands", "ops-flow.md"));
assert.equal(opsFlowCommand.targets.openhands, path.join(".agents", "skills", "ops-flow", "SKILL.md"));
assert.equal(opsFlowCommand.targets.goose, path.join("recipes", "ops-flow.yaml"));
assert.equal(opsFlowCommand.targets["grok-build"], path.join(".grok", "skills", "ops-flow", "SKILL.md"));
assert.equal(opsFlowCommand.targets.pi, path.join(".pi", "agent", "skills", "ops-flow", "SKILL.md"));
assert.equal(opsFlowCommand.targets.pool, path.join(".config", "poolside", "skills", "ops-flow", "SKILL.md"));
assert.equal(opsFlowCommand.targets.windsurf, path.join(".codeium", "windsurf", "global_workflows", "ops-flow.md"));
assert.equal(opsFlowCommand.targets.zed, path.join(".agents", "skills", "ops-flow", "SKILL.md"));

const bootConceptCommand = registry.commands.find((command) => command.name === "boot-concept");
assert.ok(bootConceptCommand);
assert.equal(bootConceptCommand.phase, "bootstrap");
assert.deepEqual(bootConceptCommand.aliases, ["concept-zero"]);
assert.equal(bootConceptCommand.metadata_source, "frontmatter");
assert.equal(bootConceptCommand.targets["claude-code"], path.join(".claude", "commands", "boot", "concept.md"));
assert.equal(bootConceptCommand.targets.codex, path.join(".agents", "skills", "boot-concept", "SKILL.md"));
assert.equal(bootConceptCommand.targets.deepagents, path.join(".deepagents", "agent", "skills", "boot-concept", "SKILL.md"));
assert.equal(bootConceptCommand.targets.cline, path.join(".cline", "workflows", "boot-concept.md"));
assert.equal(bootConceptCommand.targets.kilo, path.join(".config", "kilo", "commands", "boot-concept.md"));
assert.equal(bootConceptCommand.targets["antigravity-cli"], path.join("config", "plugins", "agent-surface", "skills", "boot-concept.md"));
assert.equal(Object.hasOwn(bootConceptCommand.targets, "gemini-cli"), false);
assert.equal(bootConceptCommand.targets.cursor, path.join(".cursor", "commands", "boot-concept.md"));
assert.equal(bootConceptCommand.targets.droid, path.join(".factory", "commands", "boot-concept.md"));
assert.equal(bootConceptCommand.targets.opencode, path.join(".config", "opencode", "commands", "boot-concept.md"));
assert.equal(bootConceptCommand.targets.openhands, path.join(".agents", "skills", "boot-concept", "SKILL.md"));
assert.equal(bootConceptCommand.targets.goose, path.join("recipes", "boot-concept.yaml"));
assert.equal(bootConceptCommand.targets["grok-build"], path.join(".grok", "skills", "boot-concept", "SKILL.md"));
assert.equal(bootConceptCommand.targets.pi, path.join(".pi", "agent", "skills", "boot-concept", "SKILL.md"));
assert.equal(bootConceptCommand.targets.pool, path.join(".config", "poolside", "skills", "boot-concept", "SKILL.md"));
assert.equal(bootConceptCommand.targets.windsurf, path.join(".codeium", "windsurf", "global_workflows", "boot-concept.md"));
assert.equal(bootConceptCommand.targets.zed, path.join(".agents", "skills", "boot-concept", "SKILL.md"));

const opsServerCommand = registry.commands.find((command) => command.name === "ops-server");
if (hasLocalOpsServerCommand) {
  assert.ok(opsServerCommand);
  assert.equal(opsServerCommand.phase, "improve");
  assert.deepEqual(opsServerCommand.lazy_body, {
    type: "file",
    path: "commands/ops-server.md",
    frontmatter_stripped: true,
  });
  assert.equal(opsServerCommand.targets["claude-code"], path.join(".claude", "commands", "ops", "server.md"));
  assert.equal(opsServerCommand.targets.codex, path.join(".agents", "skills", "ops-server", "SKILL.md"));
  assert.equal(opsServerCommand.targets.cursor, path.join(".cursor", "commands", "ops-server.md"));
  assert.equal(opsServerCommand.targets.openhands, path.join(".agents", "skills", "ops-server", "SKILL.md"));
} else {
  assert.equal(opsServerCommand, undefined);
}

const shipCommands = JSON.parse(run(["commands", "--phase", "ship", "--json"]));
assert.equal(shipCommands.commands.every((command) => command.phase === "ship"), true);

const escapeVictim = "/tmp/agent-surface-build-escape-victim";
rmSync(escapeVictim, { recursive: true, force: true });
mkdirSync(escapeVictim, { recursive: true });
writeFileSync(path.join(escapeVictim, "keep.txt"), "keep\n");
const unsafeBuild = status(["build", "--target", "../../agent-surface-build-escape-victim"]);
assert.notEqual(unsafeBuild.status, 0);
assert.match(`${unsafeBuild.stdout}${unsafeBuild.stderr}`, /unsafe build target/);
assert.equal(existsSync(path.join(escapeVictim, "keep.txt")), true);
rmSync(escapeVictim, { recursive: true, force: true });

const genericRules = run(["check", "rules", "--scenario", "generic-chat"]);
assert.match(genericRules, /^generic-chat:$/m);
assert.match(genericRules, /rules\/00-precedence-and-safety\.mdc/);
assert.doesNotMatch(genericRules, /^errors:$/m);
// 04-cybersecurity is scoped (alwaysApply:false): it must NOT attach to a generic session.
assert.doesNotMatch(genericRules, /rules\/04-cybersecurity\.mdc/);

for (const scenario of ["python-source", "python-tooling", "rust-source", "go-ci", "typescript-eslint", "shell-script", "security-exploit", "ordinary-patch"]) {
  const output = run(["check", "rules", "--scenario", scenario]);
  assert.match(output, new RegExp(`^${scenario}:$`, "m"));
  assert.doesNotMatch(output, /^errors:$/m);
  // 04-cybersecurity attaches only where a security-related path matches its globs.
  if (scenario === "security-exploit") {
    assert.match(output, /rules\/04-cybersecurity\.mdc/);
  } else {
    assert.doesNotMatch(output, /rules\/04-cybersecurity\.mdc/);
  }
}

run(["build", "--target", "all"]);
const generated = files(path.join(root, "dist"));
assert.equal(generated.some((file) => file.includes(`${path.sep}agent-surface-cybersecurity${path.sep}`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}conducting-cloud-penetration-testing${path.sep}`)), false);
const anthropicCybersecuritySkillRoot = path.join(root, "external", "anthropic-cybersecurity-skills", "skills");
if (existsSync(anthropicCybersecuritySkillRoot)) {
  const anthropicCybersecuritySkillNames = readdirSync(anthropicCybersecuritySkillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(path.join(anthropicCybersecuritySkillRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name);
  assert.notEqual(anthropicCybersecuritySkillNames.length, 0);
  for (const skillName of anthropicCybersecuritySkillNames) {
    assert.equal(generated.some((file) => file.includes(`${path.sep}${skillName}${path.sep}SKILL.md`) || file.endsWith(`${path.sep}${skillName}.md`)), false);
  }
}
assertCodexAgentTomlParses();
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "commands", "ops", "flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "commands", "ops", "swarm.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "commands", "workflow", "orchestrator.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "commands", "boot", "facade.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "commands", "boot", "concept.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "agents", "boss.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "verify-readiness", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "ops-swarm", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "workflow-orchestrator", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "boot-concept", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".agents", "skills", "ops-flow", "agents", "openai.yaml"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".codex", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".codex", "references", "rules", "10-python.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".codex", "references", "rules", "04-cybersecurity.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "codex", ".codex", "agents", "boss.toml"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "deepagents", ".deepagents", "agent", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "deepagents", ".deepagents", "agent", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "deepagents", ".deepagents", "agent", "agents", "worker", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "deepagents", ".deepagents", "agent", "agents", "boss", "AGENTS.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "goose", "recipes", "ops-flow.yaml"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "grok-build", ".grok", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "grok-build", ".grok", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "grok-build", ".grok", "skills", "red-team-command-doctrine", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "pi", ".pi", "agent", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "pi", ".pi", "agent", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "pi", ".pi", "agent", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "pool", ".config", "poolside", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "pool", ".config", "poolside", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "pool", ".config", "poolside", ".poolside"))), true);
assert.equal(generated.some((file) => file.includes(`${path.sep}dist${path.sep}gemini-cli${path.sep}`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}.gemini${path.sep}extensions${path.sep}agent-surface${path.sep}`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}.agent-surface${path.sep}claude-plugin${path.sep}`)), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".cline", "rules", "agent-surface.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".cline", "workflows", "verify-readiness.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".cline", "agents", "boss.yaml"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".cline", "skills", "karpathy-guidelines", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".cline", "data", "settings", "cline_mcp_settings.json"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".cline", "mcp.json"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "commands", "ops-flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "agents", "boss.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "AGENTS.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "kilo.jsonc"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "rules", "00-precedence-and-safety.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "rules", "04-cybersecurity.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "references", "rules", "14-shell.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".config", "kilo", "references", "rules", "04-cybersecurity.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity", "global_workflows", "ops-flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity-cli", "config", "plugins", "agent-surface", "plugin.json"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity-cli", "config", "plugins", "agent-surface", "skills", "ops-flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity-cli", "config", "plugins", "agent-surface", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity-cli", "config", "plugins", "agent-surface", "agents", "boss.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity-cli", "config", "plugins", "agent-surface", "rules", "00-precedence-and-safety.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "antigravity-cli", "config", "plugins", "agent-surface", "references", "rules", "10-python.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cursor", ".cursor", "rules", "00-precedence-and-safety.mdc"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cursor", ".cursor", "rules", "10-python.mdc"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cursor", ".cursor", "agents", "boss.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "commands", "ops-flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "references", "rules", "10-python.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "droids", "boss.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "mcp.json"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "skills", "karpathy-guidelines", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "droid", ".factory", "skills", "ctf-web", "server-side-exec.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "copilot", "instructions", "agent-surface-copilot.instructions.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "vscode", "instructions", "agent-surface.instructions.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "vscodium", "instructions", "agent-surface.instructions.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "opencode", ".config", "opencode", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "opencode", ".config", "opencode", "commands", "ops-flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "opencode", ".config", "opencode", "agents", "boss.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "openhands", ".agents", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "openhands", ".openhands", "skills", "agent-surface-rules.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "openhands", ".openhands", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "openhands", ".agents", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "openhands", ".openhands", "mcp.json"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "trae", ".trae", "user_rules.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "windsurf", ".codeium", "windsurf", "global_workflows", "ops-flow.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "windsurf", ".codeium", "windsurf", "memories", "global_rules.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "windsurf", ".codeium", "windsurf", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "zed", ".agents", "skills", "ops-flow", "SKILL.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "zed", ".agents", "skills", "conducting-cloud-penetration-testing", "SKILL.md"))), false);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "zed", ".config", "zed", "AGENTS.md"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cursor", ".cursorignore"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "kilo", ".kilocodeignore"))), true);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "cline", ".clineignore"))), true);
const cursorIgnore = readFileSync(path.join(root, "dist", "cursor", ".cursorignore"), "utf8");
assert.match(cursorIgnore, /agent-surface canonical AI-tool ignore baseline/);
const codexInstructions = readFileSync(path.join(root, "dist", "codex", ".codex", "AGENTS.md"), "utf8");
assert.match(codexInstructions, /## 00-precedence-and-safety\.mdc/);
assert.match(codexInstructions, /A test substitute is any non-real replacement/);
assert.match(codexInstructions, /SUBSTITUTE_JUSTIFICATION/);
assert.match(codexInstructions, /A suite called `e2e_test`/);
assert.match(codexInstructions, /Missing real prerequisites make the integration, E2E, or acceptance layer `BLOCKED`/);
// 04-cybersecurity is scoped now: it lives in references/rules/, not the always-on AGENTS.md (like 10-python).
assert.doesNotMatch(codexInstructions, /## 04-cybersecurity\.mdc/);
assert.doesNotMatch(codexInstructions, /## 10-python\.mdc/);
const codexVerifyTest = readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "verify-test", "SKILL.md"), "utf8");
assert.match(codexVerifyTest, /No substitute-backed proof on any path/);
assert.match(codexVerifyTest, /Substitute-backed results excluded from evidence/);
const claudeDevFeature = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "dev", "feature.md"), "utf8");
assert.doesNotMatch(claudeDevFeature, /Test doubles are allowed in tests when appropriate/);
assert.match(claudeDevFeature, /SUBSTITUTE_JUSTIFICATION/);
assert.match(claudeDevFeature, /`dev-chore`: trigger-based direction, reuse, single-ownership/);
const claudeDevFix = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "dev", "fix.md"), "utf8");
assert.match(claudeDevFix, /`dev-chore`: trigger-based direction, reuse, single-ownership/);
const claudeDevRefactor = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "dev", "refactor.md"), "utf8");
assert.match(claudeDevRefactor, /`dev-chore`: trigger-based direction, reuse, single-ownership/);
const claudeDevChore = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "dev", "chore.md"), "utf8");
assert.match(claudeDevChore, /Do not make a wrong design cleaner/);
assert.match(claudeDevChore, /Existing solution before new construction/);
assert.match(claudeDevChore, /Security and feature trade-off/);
assert.match(claudeDevChore, /Embedded checkpoint mode/);
const codexDevChore = readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "dev-chore", "SKILL.md"), "utf8");
assert.match(codexDevChore, /Do not make a wrong design cleaner/);
assert.match(codexDevChore, /User and operator outcome/);
const claudeVerifyTest = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "verify", "test.md"), "utf8");
assert.match(claudeVerifyTest, /No substitute-backed proof on any path/);
assert.match(claudeVerifyTest, /Substitute-backed results excluded from evidence/);
const claudeVerifyReadiness = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "verify", "readiness.md"), "utf8");
assert.match(claudeVerifyReadiness, /A suite called `e2e_test`/);
const claudeSelfCritique = readFileSync(path.join(root, "dist", "claude-code", ".claude", "commands", "qa", "self-critique.md"), "utf8");
assert.match(claudeSelfCritique, /SUBSTITUTE_JUSTIFICATION' \{\{target\}\}/);
assert.doesNotMatch(claudeSelfCritique, /SUBSTITUTE_JUSTIFICATION' tests\//);
const codexPythonReference = readFileSync(path.join(root, "dist", "codex", ".codex", "references", "rules", "10-python.md"), "utf8");
assert.match(codexPythonReference, /Scoped agent-surface reference/);
assert.match(codexPythonReference, /^# Python$/m);
const kiloPreviewConfig = JSON.parse(readFileSync(path.join(root, "dist", "kilo", ".config", "kilo", "kilo.jsonc"), "utf8"));
assert.deepEqual(kiloPreviewConfig.instructions, [
  "./rules/00-precedence-and-safety.md",
  "./rules/01-response-style.md",
  "./rules/02-agent-workflow.md",
  "./rules/03-project-defaults.md",
  "./rules/05-tooling.md",
  "./rules/06-test-policy.md",
]);
assert.equal(Object.hasOwn(kiloPreviewConfig, "skills"), false);
assert.equal(Object.hasOwn(kiloPreviewConfig, "permission"), false);
const ignoresCheck = run(["check", "ignores"]);
assert.match(ignoresCheck, /ignores check: ok/);
assert.match(ignoresCheck, /emitters 3 \(cline, cursor, kilo\)/);
assert.equal(generated.some((file) => file.endsWith(path.join("dist", "claude-code", ".claude", "agents", "worker.md"))), true);
assert.equal(generated.some((file) => file.includes(`${path.sep}.codex${path.sep}agents${path.sep}`)), true);
assert.equal(generated.some((file) => file.includes(`${path.sep}.config${path.sep}kilo${path.sep}agents${path.sep}`)), true);

// subagent access -> per-target capability metadata: read-only must not carry write/shell tools.
const antigravityBossAgent = readFileSync(path.join(root, "dist", "antigravity-cli", "config", "plugins", "agent-surface", "agents", "boss.md"), "utf8");
assert.match(antigravityBossAgent, /^tools:$/m);
assert.equal(/^ {2}- run_shell_command$/m.test(antigravityBossAgent), false);
const antigravityWorkerAgent = readFileSync(path.join(root, "dist", "antigravity-cli", "config", "plugins", "agent-surface", "agents", "worker.md"), "utf8");
assert.match(antigravityWorkerAgent, /^ {2}- run_shell_command$/m);
const claudeBossAgent = readFileSync(path.join(root, "dist", "claude-code", ".claude", "agents", "boss.md"), "utf8");
assert.match(claudeBossAgent, /^tools: Read, Glob, Grep$/m);
assert.equal(claudeBossAgent.includes("LSP"), false);
assert.equal(claudeBossAgent.includes("disallowedTools"), false);
const claudeWorkerAgent = readFileSync(path.join(root, "dist", "claude-code", ".claude", "agents", "worker.md"), "utf8");
assert.match(claudeWorkerAgent, /^tools: Read, Glob, Grep, Edit, Write, Bash$/m);
const codexBossAgent = readFileSync(path.join(root, "dist", "codex", ".codex", "agents", "boss.toml"), "utf8");
assert.match(codexBossAgent, /^sandbox_mode = "read-only"$/m);
const codexWorkerAgent = readFileSync(path.join(root, "dist", "codex", ".codex", "agents", "worker.toml"), "utf8");
assert.match(codexWorkerAgent, /^sandbox_mode = "workspace-write"$/m);
const deepagentsSkill = readFileSync(path.join(root, "dist", "deepagents", ".deepagents", "agent", "skills", "ops-flow", "SKILL.md"), "utf8");
assert.match(deepagentsSkill, /Deep Agents discovers this skill/);
const deepagentsWorkerAgent = readFileSync(path.join(root, "dist", "deepagents", ".deepagents", "agent", "agents", "worker", "AGENTS.md"), "utf8");
assert.match(deepagentsWorkerAgent, /^name: worker$/m);
const kiloBossAgent = readFileSync(path.join(root, "dist", "kilo", ".config", "kilo", "agents", "boss.md"), "utf8");
assert.match(kiloBossAgent, /bash: deny/);
assert.doesNotMatch(kiloBossAgent, /skill: deny/);
const kiloWorkerAgent = readFileSync(path.join(root, "dist", "kilo", ".config", "kilo", "agents", "worker.md"), "utf8");
assert.match(kiloWorkerAgent, /bash: ask/);
assert.doesNotMatch(kiloWorkerAgent, /skill: deny/);
const opencodeBossAgent = readFileSync(path.join(root, "dist", "opencode", ".config", "opencode", "agents", "boss.md"), "utf8");
assert.match(opencodeBossAgent, /edit: deny/);
assert.match(opencodeBossAgent, /bash: deny/);
const opencodeWorkerAgent = readFileSync(path.join(root, "dist", "opencode", ".config", "opencode", "agents", "worker.md"), "utf8");
assert.match(opencodeWorkerAgent, /edit: ask/);
assert.match(opencodeWorkerAgent, /bash: ask/);
const droidBossAgent = readFileSync(path.join(root, "dist", "droid", ".factory", "droids", "boss.md"), "utf8");
assert.match(droidBossAgent, /^tools:$/m);
assert.match(droidBossAgent, /^ {2}- Read$/m);
assert.equal(/^ {2}- Execute$/m.test(droidBossAgent), false);
assert.equal(/^ {2}- Create$/m.test(droidBossAgent), false);
assert.equal(/^ {2}- Edit$/m.test(droidBossAgent), false);
const droidWorkerAgent = readFileSync(path.join(root, "dist", "droid", ".factory", "droids", "worker.md"), "utf8");
assert.match(droidWorkerAgent, /^ {2}- Execute$/m);
const clineBossAgent = readFileSync(path.join(root, "dist", "cline", ".cline", "agents", "boss.yaml"), "utf8");
assert.match(clineBossAgent, /^name: boss$/m);
assert.match(clineBossAgent, /^ {2}- read_file$/m);
assert.match(clineBossAgent, /^ {2}- search_files$/m);
assert.match(clineBossAgent, /^ {2}- use_skill$/m);
assert.doesNotMatch(clineBossAgent, /^ {2}- execute_command$/m);
assert.doesNotMatch(clineBossAgent, /^ {2}- write_to_file$/m);
const clineWorkerAgent = readFileSync(path.join(root, "dist", "cline", ".cline", "agents", "worker.yaml"), "utf8");
assert.match(clineWorkerAgent, /^ {2}- execute_command$/m);
assert.match(clineWorkerAgent, /^ {2}- write_to_file$/m);
const droidMcp = JSON.parse(readFileSync(path.join(root, "dist", "droid", ".factory", "mcp.json"), "utf8"));
assert.equal(Object.hasOwn(droidMcp.mcpServers, "agentmemory"), false);
// First-party synapse MCP is auto-wired by default; external MCPs remain opt-in.
assert.equal(droidMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
assert.equal(droidMcp.mcpServers.synapse.type, "stdio");
assert.deepEqual(droidMcp.mcpServers.synapse.args, []);
const claudeMcp = JSON.parse(readFileSync(path.join(root, "dist", "claude-code", ".claude.json"), "utf8"));
assert.equal(claudeMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
const codexMcp = readFileSync(path.join(root, "dist", "codex", ".codex", "config.toml"), "utf8");
assert.match(codexMcp, /\[mcp_servers\.synapse\]/);
assert.match(codexMcp, /command = "~\/\.local\/bin\/synapse-bridge"/);
const deepagentsMcp = JSON.parse(readFileSync(path.join(root, "dist", "deepagents", ".deepagents", ".mcp.json"), "utf8"));
assert.equal(deepagentsMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
const clineMcp = JSON.parse(readFileSync(path.join(root, "dist", "cline", ".cline", "data", "settings", "cline_mcp_settings.json"), "utf8"));
assert.equal(clineMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
const cursorMcp = JSON.parse(readFileSync(path.join(root, "dist", "cursor", ".cursor", "mcp.json"), "utf8"));
assert.equal(cursorMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
const kiloMcp = JSON.parse(readFileSync(path.join(root, "dist", "kilo", ".config", "kilo", "kilo.jsonc"), "utf8"));
assert.deepEqual(kiloMcp.mcp.synapse.command, ["~/.local/bin/synapse-bridge"]);
const opencodeMcp = JSON.parse(readFileSync(path.join(root, "dist", "opencode", ".config", "opencode", "opencode.json"), "utf8"));
assert.deepEqual(opencodeMcp.mcp.synapse.command, ["~/.local/bin/synapse-bridge"]);
const openhandsMcp = JSON.parse(readFileSync(path.join(root, "dist", "openhands", ".openhands", "mcp.json"), "utf8"));
assert.equal(openhandsMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
const vscodeMcp = JSON.parse(readFileSync(path.join(root, "dist", "vscode", "mcp.json"), "utf8"));
assert.equal(vscodeMcp.servers.synapse.command, "~/.local/bin/synapse-bridge");
const zedMcp = JSON.parse(readFileSync(path.join(root, "dist", "zed", ".config", "zed", "settings.json"), "utf8"));
assert.equal(zedMcp.context_servers.synapse.command, "~/.local/bin/synapse-bridge");
// First-party grimoire MCP is auto-wired by default across every host config family (P3 distribution).
assert.equal(droidMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
assert.equal(droidMcp.mcpServers.grimoire.type, "stdio");
assert.deepEqual(droidMcp.mcpServers.grimoire.args, []);
assert.equal(claudeMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
assert.match(codexMcp, /\[mcp_servers\.grimoire\]/);
assert.match(codexMcp, /command = "~\/\.local\/bin\/grimoire-server"/);
assert.equal(deepagentsMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
assert.equal(clineMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
assert.equal(cursorMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
assert.deepEqual(kiloMcp.mcp.grimoire.command, ["~/.local/bin/grimoire-server"]);
assert.deepEqual(opencodeMcp.mcp.grimoire.command, ["~/.local/bin/grimoire-server"]);
assert.equal(openhandsMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
assert.equal(vscodeMcp.servers.grimoire.command, "~/.local/bin/grimoire-server");
assert.equal(zedMcp.context_servers.grimoire.command, "~/.local/bin/grimoire-server");
// Newly-generated JSON MCP hosts (VSCodium / Grok Build / Antigravity CLI).
const vscodiumMcp = JSON.parse(readFileSync(path.join(root, "dist", "vscodium", "mcp.json"), "utf8"));
assert.equal(vscodiumMcp.servers.grimoire.command, "~/.local/bin/grimoire-server");
const grokMcp = JSON.parse(readFileSync(path.join(root, "dist", "grok-build", ".grok", "settings.json"), "utf8"));
assert.equal(grokMcp.mcpServers.grimoire.command, "~/.local/bin/grimoire-server");
const antigravityCliMcp = JSON.parse(readFileSync(path.join(root, "dist", "antigravity-cli", "config", "plugins", "agent-surface", "mcp_config.json"), "utf8"));
assert.equal(antigravityCliMcp.mcpServers.synapse.command, "~/.local/bin/synapse-bridge");
// Generated YAML MCP hosts (Goose extensions; Poolside mcp_servers) — non-destructive block merge.
const gooseMcp = readFileSync(path.join(root, "dist", "goose", ".config", "goose", "config.yaml"), "utf8");
assert.match(gooseMcp, /^extensions:/m);
assert.match(gooseMcp, /^ {2}grimoire:/m);
assert.match(gooseMcp, /cmd: ~\/\.local\/bin\/grimoire-server/);
assert.match(gooseMcp, /type: stdio/);
const poolMcp = readFileSync(path.join(root, "dist", "pool", ".config", "poolside", "settings.yaml"), "utf8");
assert.match(poolMcp, /^mcp_servers:/m);
assert.match(poolMcp, /^ {2}synapse:/m);
assert.match(poolMcp, /command: ~\/\.local\/bin\/grimoire-server/);
// F001: `--category mcps` selects the first-party MCPs (grimoire, synapse); no external MCP is auto-added.
const mcpsDefaultPlan = run(["install", "--target", "vscodium", "--dest", "/tmp/agent-surface-f001", "--category", "mcps", "--dry-run"]);
assert.match(mcpsDefaultPlan, /MCP \+= grimoire, synapse/);
const sourceKinds = JSON.parse(readFileSync(path.join(root, "registry", "source-kinds.json"), "utf8"));
assert.equal(Object.hasOwn(sourceKinds.source_kinds, "mcps"), false);
assert.equal(Object.hasOwn(sourceKinds.source_kinds, "subagents"), true);
assert.equal(Object.hasOwn(sourceKinds.source_kinds, "external"), true);
const targetsRegistry = JSON.parse(readFileSync(path.join(root, "registry", "targets.json"), "utf8"));
const generatedCheck = run(["check", "generated"]);
for (const target of Object.keys(targetsRegistry.in_scope)) {
  assert.match(generatedCheck, new RegExp(`^${target}: generated outputs \\d+ ok$`, "m"));
}
assert.match(generatedCheck, /generated check: ok/);
const copilotGeneratedCheck = run(["check", "generated", "--target", "copilot"]);
assert.match(copilotGeneratedCheck, /^copilot: generated outputs \d+ ok$/m);

const subagentsCheck = run(["check", "subagents"]);
assert.match(subagentsCheck, /subagents check: ok/);
const subagentSourcePath = path.join(root, "subagents", "boss.md");
const subagentSourceOriginal = readFileSync(subagentSourcePath, "utf8");
try {
  writeFileSync(subagentSourcePath, subagentSourceOriginal.replace(/description:.*\n/, ""));
  const invalidSubagent = status(["check", "subagents"]);
  assert.equal(invalidSubagent.status, 1);
  assert.match(`${invalidSubagent.stdout}${invalidSubagent.stderr}`, /missing required field description/);
} finally {
  writeFileSync(subagentSourcePath, subagentSourceOriginal);
}

// Cursor cannot express read-write without shell; that tier must be refused, not silently granted shell.
try {
  writeFileSync(subagentSourcePath, subagentSourceOriginal.replace("access: read-only", "access: read-write"));
  const cursorRefusal = status(["build", "--target", "cursor"]);
  assert.notEqual(cursorRefusal.status, 0);
  assert.match(`${cursorRefusal.stdout}${cursorRefusal.stderr}`, /not representable/);
  const codexRefusal = status(["build", "--target", "codex"]);
  assert.notEqual(codexRefusal.status, 0);
  assert.match(`${codexRefusal.stdout}${codexRefusal.stderr}`, /not representable/);
} finally {
  writeFileSync(subagentSourcePath, subagentSourceOriginal);
}
run(["build", "--target", "all"]);

const clinePlan = run(["install", "--target", "cline", "--dest", "/tmp/agent-surface-cline", "--dry-run"]);
assert.match(clinePlan, /^target: cline$/m);
assert.match(clinePlan, /^root source: explicit --dest$/m);
assert.match(clinePlan, /\.clinerules\/workflows\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(clinePlan, /\.clinerules\/workflows\/workflow-orchestrator\.md <- commands\/workflow-orchestrator\.md/);
assert.match(clinePlan, /\.clinerules\/agent-surface\.md <- rules\/\*\.mdc/);
assert.match(clinePlan, /\.clinerules\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.match(clinePlan, /\.cline\/agents\/boss\.yaml <- subagents\/boss\.md/);
assert.match(clinePlan, /\.cline\/skills\/karpathy-guidelines\/SKILL\.md/);
assert.doesNotMatch(clinePlan, /cline_mcp_settings\.json MCP/);
assert.match(clinePlan, /\.agent-surface\/cline-manifest\.json/);

const clineUserMcpPlan = run([
  "install", "--target", "cline", "--scope", "user", "--dest", "/tmp/agent-surface-cline-user-mcp",
  "--category", "mcps", "--dry-run",
]);
assert.match(clineUserMcpPlan, /\.cline\/data\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);
assert.doesNotMatch(clineUserMcpPlan, /\.cline\/mcp\.json/);

const kiloPlan = run(["install", "--target", "kilo", "--dest", "/tmp/agent-surface-kilo", "--dry-run"]);
assert.match(kiloPlan, /^target: kilo$/m);
assert.match(kiloPlan, /\.kilo\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.doesNotMatch(kiloPlan, /^  AGENTS\.md <- rules\/\*\.mdc$/m);
assert.match(kiloPlan, /\.kilo\/rules\/00-precedence-and-safety\.md <- rules\/00-precedence-and-safety\.mdc/);
assert.match(kiloPlan, /\.kilo\/references\/rules\/14-shell\.md <- rules\/14-shell\.mdc/);
assert.match(kiloPlan, /\.kilo\/agents\/boss\.md <- subagents\/boss\.md/);
assert.match(kiloPlan, /kilo\.jsonc instructions \+= \.kilo\/rules\/00-precedence-and-safety\.md, .*\.kilo\/rules\/06-test-policy\.md/);
assert.doesNotMatch(kiloPlan, /kilo\.jsonc instructions \+= .*14-shell/);
assert.match(kiloPlan, /\.agent-surface\/kilo-manifest\.json/);

const geminiPlan = status(["install", "--target", "gemini-cli", "--dest", "/tmp/agent-surface-gemini", "--dry-run"]);
assert.notEqual(geminiPlan.status, 0);
assert.match(`${geminiPlan.stdout}${geminiPlan.stderr}`, /unsupported install target: gemini-cli/);

const antigravityCliPlan = run(["install", "--target", "antigravity-cli", "--dest", "/tmp/agent-surface-antigravity-cli", "--dry-run"]);
assert.match(antigravityCliPlan, /^target: antigravity-cli$/m);
assert.match(antigravityCliPlan, /config\/plugins\/agent-surface\/plugin\.json <- package\.json/);
assert.match(antigravityCliPlan, /config\/plugins\/agent-surface\/skills\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(antigravityCliPlan, /config\/plugins\/agent-surface\/agents\/boss\.md <- subagents\/boss\.md/);
assert.match(antigravityCliPlan, /config\/plugins\/agent-surface\/rules\/00-precedence-and-safety\.md <- rules\/00-precedence-and-safety\.mdc/);
assert.match(antigravityCliPlan, /config\/plugins\/agent-surface\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);

const claudePlan = run(["install", "--target", "claude-code", "--dest", "/tmp/agent-surface-claude", "--dry-run"]);
assert.match(claudePlan, /^target: claude-code$/m);
assert.match(claudePlan, /\.claude\/commands\/workflow\/boss\.md <- commands\/workflow-boss\.md/);
assert.match(claudePlan, /\.claude\/agents\/boss\.md <- subagents\/boss\.md/);
assert.doesNotMatch(claudePlan, /\.agent-surface\/claude-plugin/);

const cursorPlan = run(["install", "--target", "cursor", "--dest", "/tmp/agent-surface-cursor", "--dry-run"]);
assert.match(cursorPlan, /^target: cursor$/m);
assert.match(cursorPlan, /\.cursor\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(cursorPlan, /\.cursor\/agents\/boss\.md <- subagents\/boss\.md/);

const droidPlan = run(["install", "--target", "droid", "--dest", "/tmp/agent-surface-droid", "--dry-run"]);
assert.match(droidPlan, /^target: droid$/m);
assert.match(droidPlan, /\.factory\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(droidPlan, /AGENTS\.md <- rules\/\*\.mdc/);
assert.match(droidPlan, /\.factory\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.match(droidPlan, /\.factory\/droids\/boss\.md <- subagents\/boss\.md/);
assert.match(droidPlan, /\.factory\/mcp\.json MCP \+= grimoire, synapse/);
// External assets are part of the default distribute: a full install emits in-scope packs.
assert.match(droidPlan, /\.factory\/skills\/karpathy-guidelines\/SKILL\.md <- external\/andrej-karpathy-skills\/skills\/karpathy-guidelines\/SKILL\.md/);

const droidExternalPlan = run(["install", "--target", "droid", "--category", "external", "--dest", "/tmp/agent-surface-droid-external", "--dry-run"]);
assert.match(droidExternalPlan, /^target: droid$/m);
assert.match(droidExternalPlan, /^categories: external$/m);
assert.match(droidExternalPlan, /\.factory\/skills\/karpathy-guidelines\/SKILL\.md <- external\/andrej-karpathy-skills\/skills\/karpathy-guidelines\/SKILL\.md/);
assert.match(droidExternalPlan, /\.factory\/skills\/red-team-command-doctrine\/SKILL\.md <- external\/codex-redteam-mode\/agents\/skills\/red-team-command-doctrine\/SKILL\.md/);

const droidUserPlan = run(["install", "--target", "droid", "--scope", "user", "--dry-run"], {
  env: { ...process.env, HOME: "/tmp/agent-surface-droid-home" },
});
assert.match(droidUserPlan, /^target: droid$/m);
assert.match(droidUserPlan, /\.factory\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(droidUserPlan, /\.factory\/AGENTS\.md <- rules\/\*\.mdc/);
assert.match(droidUserPlan, /\.factory\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.match(droidUserPlan, /\.factory\/droids\/boss\.md <- subagents\/boss\.md/);
assert.match(droidUserPlan, /\.factory\/mcp\.json MCP \+= grimoire, synapse/);
assert.match(droidUserPlan, /\.factory\/skills\/pua\/SKILL\.md/);

const codexPlan = run(["install", "--target", "codex", "--dest", "/tmp/agent-surface-codex", "--dry-run"]);
assert.match(codexPlan, /^target: codex$/m);
assert.match(codexPlan, /\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(codexPlan, /\.codex\/agents\/boss\.toml <- subagents\/boss\.md/);
assert.match(codexPlan, /\.codex\/AGENTS\.md <- rules\/\*\.mdc/);
assert.match(codexPlan, /\.codex\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);

const deepagentsPlan = run(["install", "--target", "deepagents", "--dest", "/tmp/agent-surface-deepagents", "--dry-run"]);
assert.match(deepagentsPlan, /^target: deepagents$/m);
assert.match(deepagentsPlan, /\.deepagents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(deepagentsPlan, /\.deepagents\/AGENTS\.md <- rules\/\*\.mdc/);
assert.match(deepagentsPlan, /\.deepagents\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.match(deepagentsPlan, /\.deepagents\/agents\/worker\/AGENTS\.md <- subagents\/worker\.md/);
assert.match(deepagentsPlan, /\.deepagents\/\.mcp\.json MCP \+= grimoire, synapse/);

const goosePlan = run(["install", "--target", "goose", "--dest", "/tmp/agent-surface-goose", "--dry-run"]);
assert.match(goosePlan, /^target: goose$/m);
assert.match(goosePlan, /recipes\/workflow-boss\.yaml <- commands\/workflow-boss\.md/);
// F001: a user-scope Goose install wires only the user-global MCP config — it must NEVER
// write project recipes into $HOME. Recipes remain project-scoped (--dest / project scope).
const gooseUserPlan = run(["install", "--target", "goose", "--scope", "user", "--allow-scope-root", "--dry-run"]);
assert.doesNotMatch(gooseUserPlan, /recipes\//, "goose user-scope install must not write recipes into $HOME");
assert.match(gooseUserPlan, /\.config\/goose\/config\.yaml MCP/, "goose user-scope install wires the MCP config");
// F005: `--target all --category mcps` must succeed (exit 0), wiring every generated MCP host
// and reporting the non-MCP targets (pi/antigravity/copilot) as non-applicable, not blockers.
const mcpsAllHome = mkdtempSync("/tmp/agent-surface-mcps-all-");
try {
  const mcpsAllPlan = run(["install", "--target", "all", "--scope", "user", "--allow-scope-root", "--category", "mcps", "--dry-run"], {
    env: { ...process.env, HOME: mcpsAllHome },
  });
  assert.equal((mcpsAllPlan.match(/not applicable: no installable outputs for categories: mcps/g) ?? []).length, 3,
    "exactly pi/antigravity/copilot are non-applicable under --target all --category mcps");
  for (const t of ["pi", "antigravity", "copilot"]) assert.match(mcpsAllPlan, new RegExp(`^target: ${t}$`, "m"));
  assert.match(mcpsAllPlan, /MCP \+= grimoire, synapse/, "generated MCP hosts are still wired");
} finally {
  rmSync(mcpsAllHome, { recursive: true, force: true });
}
// F006: a multi-target MCP install where NO selected target is applicable must FAIL, not
// succeed as a no-op (pi+copilot have no MCP surface; pi,copilot,goose would pass via goose).
const piCopilotStatus = status(["install", "--target", "pi,copilot", "--scope", "user", "--allow-scope-root", "--category", "mcps", "--dry-run"]);
assert.equal(piCopilotStatus.status, 1, "pi,copilot --category mcps must fail (no installable outputs anywhere)");
assert.match(`${piCopilotStatus.stdout}${piCopilotStatus.stderr}`, /no selected targets have installable outputs/);

const grokBuildPlan = run(["install", "--target", "grok-build", "--dest", "/tmp/agent-surface-grok-build", "--dry-run"]);
assert.match(grokBuildPlan, /^target: grok-build$/m);
assert.match(grokBuildPlan, /\.grok\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(grokBuildPlan, /AGENTS\.md <- rules\/\*\.mdc/);
assert.match(grokBuildPlan, /\.grok\/skills\/red-team-command-doctrine\/SKILL\.md/);

// Strict-sync (the de-scope / upstream-changed edge case): a full distribute prunes a
// managed external skill that is no longer generated (pack de-scoped or removed upstream),
// while regenerating the in-scope external packs. Seed a prior manifest with a ghost skill.
const syncDest = "/tmp/agent-surface-strict-sync";
rmSync(syncDest, { recursive: true, force: true });
const ghostRel = path.join(".factory", "skills", "ghost-descoped-skill", "SKILL.md");
const ghostPath = path.join(syncDest, ghostRel);
const ghostContent = "---\nname: ghost-descoped-skill\ndescription: removed upstream\n---\nbody\n";
mkdirSync(path.dirname(ghostPath), { recursive: true });
writeFileSync(ghostPath, ghostContent);
mkdirSync(path.join(syncDest, ".agent-surface"), { recursive: true });
writeFileSync(
  path.join(syncDest, ".agent-surface", "droid-manifest.json"),
  `${JSON.stringify({
    target: "droid",
    managed: [{ target: "droid", output: ghostRel, version: "test" }],
  }, null, 2)}\n`,
);
const syncPlan = run(["install", "--target", "droid", "--dest", syncDest, "--dry-run"]);
assert.match(syncPlan, /planned stale managed removals:/);
assert.match(syncPlan, /\.factory\/skills\/ghost-descoped-skill\/SKILL\.md/); // de-scoped pruned
assert.match(syncPlan, /\.factory\/skills\/karpathy-guidelines\/SKILL\.md/); // in-scope regenerated, not pruned
rmSync(syncDest, { recursive: true, force: true });

const piPlan = run(["install", "--target", "pi", "--dest", "/tmp/agent-surface-pi", "--dry-run"]);
assert.match(piPlan, /^target: pi$/m);
assert.match(piPlan, /\.pi\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(piPlan, /AGENTS\.md <- rules\/\*\.mdc/);

const poolPlan = run(["install", "--target", "pool", "--dest", "/tmp/agent-surface-pool", "--dry-run"]);
assert.match(poolPlan, /^target: pool$/m);
assert.match(poolPlan, /\.poolside\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(poolPlan, /AGENTS\.md <- rules\/\*\.mdc/);

const vscodiumPlan = run(["install", "--target", "vscodium", "--dest", "/tmp/agent-surface-vscodium", "--dry-run"]);
assert.match(vscodiumPlan, /^target: vscodium$/m);
assert.match(vscodiumPlan, /instructions\/agent-surface\.instructions\.md <- rules\/\*\.mdc/);
assert.match(vscodiumPlan, /prompts\/agent-surface\.prompt\.md <- commands\/ops-flow\.md/);

const windsurfPlan = run(["install", "--target", "windsurf", "--dest", "/tmp/agent-surface-windsurf", "--dry-run"]);
assert.match(windsurfPlan, /^target: windsurf$/m);
assert.match(windsurfPlan, /\.windsurf\/workflows\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(windsurfPlan, /\.devin\/rules\/agent-surface\.md <- rules\/\*\.mdc/);

const zedPlan = run(["install", "--target", "zed", "--dest", "/tmp/agent-surface-zed", "--dry-run"]);
assert.match(zedPlan, /^target: zed$/m);
assert.match(zedPlan, /\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(zedPlan, /AGENTS\.md <- rules\/\*\.mdc/);

const deepagentsMcpPlan = run([
  "install",
  "--runtime",
  "deepagents",
  "--category",
  "mcps",
  "--dest",
  "/tmp/agent-surface-deepagents-mcp",
  "--dry-run",
]);
assert.match(deepagentsMcpPlan, /^target: deepagents$/m);
assert.match(deepagentsMcpPlan, /^categories: mcps$/m);
assert.match(deepagentsMcpPlan, /\.deepagents\/\.mcp\.json MCP \+= grimoire, synapse/);
assert.doesNotMatch(deepagentsMcpPlan, /workflow-boss\/SKILL\.md/);

const multiRuntimeRulesPlan = run([
  "install",
  "--runtime",
  "codex,kilo",
  "--category",
  "rules",
  "--dest",
  "/tmp/agent-surface-multi-rules",
  "--dry-run",
]);
assert.match(multiRuntimeRulesPlan, /^target: codex$/m);
assert.match(multiRuntimeRulesPlan, /^target: kilo$/m);
assert.match(multiRuntimeRulesPlan, /^categories: rules$/m);
assert.match(multiRuntimeRulesPlan, /\.codex\/AGENTS\.md <- rules\/\*\.mdc/);
assert.match(multiRuntimeRulesPlan, /\.codex\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.doesNotMatch(multiRuntimeRulesPlan, /^  AGENTS\.md <- rules\/\*\.mdc$/m);
assert.match(multiRuntimeRulesPlan, /kilo\.jsonc instructions \+= \.kilo\/rules\/00-precedence-and-safety\.md/);
assert.doesNotMatch(multiRuntimeRulesPlan, /\.agents\/skills\/workflow-boss\/SKILL\.md/);
assert.doesNotMatch(multiRuntimeRulesPlan, /\.kilo\/agents\/boss\.md/);

const sharedSkillPlan = run([
  "install",
  "--runtime",
  "codex,zed",
  "--category",
  "skills",
  "--dest",
  "/tmp/agent-surface-shared-skills",
  "--dry-run",
]);
assert.match(sharedSkillPlan, /^target: codex$/m);
assert.match(sharedSkillPlan, /^target: zed$/m);
assert.match(sharedSkillPlan, /\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.doesNotMatch(sharedSkillPlan, /also planned by/);

const conflictingMultiRuntimePlan = status([
  "install",
  "--runtime",
  "droid,opencode",
  "--category",
  "rules",
  "--dest",
  "/tmp/agent-surface-conflicting-rules",
  "--dry-run",
]);
assert.notEqual(conflictingMultiRuntimePlan.status, 0);
assert.match(`${conflictingMultiRuntimePlan.stdout}${conflictingMultiRuntimePlan.stderr}`, /output AGENTS\.md also planned by/);

const opencodePlan = run(["install", "--target", "opencode", "--dest", "/tmp/agent-surface-opencode", "--dry-run"]);
assert.match(opencodePlan, /^target: opencode$/m);
assert.match(opencodePlan, /\.opencode\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(opencodePlan, /\.opencode\/agents\/boss\.md <- subagents\/boss\.md/);
assert.match(opencodePlan, /AGENTS\.md <- rules\/\*\.mdc/);

const openhandsPlan = run(["install", "--target", "openhands", "--dest", "/tmp/agent-surface-openhands", "--dry-run"]);
assert.match(openhandsPlan, /^target: openhands$/m);
assert.match(openhandsPlan, /\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(openhandsPlan, /^  AGENTS\.md <- rules\/\*\.mdc$/m);
assert.match(openhandsPlan, /\.openhands\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.match(openhandsPlan, /\.agents\/skills\/karpathy-guidelines\/SKILL\.md <- external\/andrej-karpathy-skills\/skills\/karpathy-guidelines\/SKILL\.md/);
assert.doesNotMatch(openhandsPlan, /\.openhands\/mcp\.json MCP/, "OpenHands MCP is user-scope only");

const staleDest = "/tmp/agent-surface-stale";
rmSync(staleDest, { recursive: true, force: true });
mkdirSync(path.join(staleDest, ".agent-surface"), { recursive: true });
writeFileSync(
  path.join(staleDest, ".agent-surface", "cline-manifest.json"),
  JSON.stringify({
    target: "cline",
    scope: "project",
    managed: [
      {
        target: "cline",
        output: ".clinerules/workflows/removed.md",
      },
    ],
  }),
);
const stalePlan = run(["install", "--target", "cline", "--dest", staleDest, "--dry-run"]);
assert.match(stalePlan, /planned stale managed removals:\n  \.clinerules\/workflows\/removed\.md/);
rmSync(staleDest, { recursive: true, force: true });

const liveDest = "/tmp/agent-surface-live";
rmSync(liveDest, { recursive: true, force: true });
const liveInstall = run(["install", "--target", "cline", "--dest", liveDest]);
assert.match(liveInstall, /^installed:$/m);
assert.match(readFileSync(path.join(liveDest, ".clinerules", "workflows", "workflow-boss.md"), "utf8"), /^## OBJECTIVE/);
assert.match(readFileSync(path.join(liveDest, ".clinerules", "workflows", "verify-readiness.md"), "utf8"), /^## OBJECTIVE/);
assert.match(readFileSync(path.join(liveDest, ".cline", "agents", "boss.yaml"), "utf8"), /^---\nname: boss\n/);
assert.match(readFileSync(path.join(liveDest, ".cline", "skills", "karpathy-guidelines", "SKILL.md"), "utf8"), /^---\n/);
assert.match(readFileSync(path.join(liveDest, ".clineignore"), "utf8"), /agent-surface canonical AI-tool ignore baseline/);
const liveManifest = JSON.parse(readFileSync(path.join(liveDest, ".agent-surface", "cline-manifest.json"), "utf8"));
assert.equal(liveManifest.target, "cline");
const clineWrote = liveInstall.match(/^  wrote: (\d+)$/m);
assert.ok(clineWrote);
assert.equal(Number(clineWrote[1]), liveManifest.managed.length);
assert.equal(Object.hasOwn(liveManifest.managed[0], "managed_by"), false);
assert.equal(Object.hasOwn(liveManifest.managed[0], "sha256"), false);
rmSync(liveDest, { recursive: true, force: true });

// Install now overwrites existing files by default.
const unmanagedDest = "/tmp/agent-surface-unmanaged";
rmSync(unmanagedDest, { recursive: true, force: true });
mkdirSync(path.join(unmanagedDest, ".clinerules", "workflows"), { recursive: true });
writeFileSync(path.join(unmanagedDest, ".clinerules", "workflows", "workflow-boss.md"), "local workflow\n");
const overwriteInstall = run(["install", "--target", "cline", "--dest", unmanagedDest]);
assert.match(overwriteInstall, /^installed:$/m);
assert.match(readFileSync(path.join(unmanagedDest, ".clinerules", "workflows", "workflow-boss.md"), "utf8"), /^## OBJECTIVE/);
rmSync(unmanagedDest, { recursive: true, force: true });

const liveStaleDest = "/tmp/agent-surface-live-stale";
rmSync(liveStaleDest, { recursive: true, force: true });
run(["install", "--target", "cline", "--dest", liveStaleDest]);
const liveStaleFile = path.join(liveStaleDest, ".clinerules", "workflows", "removed.md");
writeFileSync(liveStaleFile, "user edited stale workflow\n");
const liveStaleManifestPath = path.join(liveStaleDest, ".agent-surface", "cline-manifest.json");
const liveStaleManifest = JSON.parse(readFileSync(liveStaleManifestPath, "utf8"));
liveStaleManifest.managed.push({
  target: "cline",
  scope: "project",
  source: "commands/removed.md",
  output: ".clinerules/workflows/removed.md",
  version: "0.1.0",
});
writeFileSync(liveStaleManifestPath, `${JSON.stringify(liveStaleManifest, null, 2)}\n`);
const liveStaleInstall = run(["install", "--target", "cline", "--dest", liveStaleDest]);
assert.match(liveStaleInstall, /removed stale: 1/);
assert.equal(existsSync(liveStaleFile), false);
assert.equal(existsSync(path.join(liveStaleDest, ".agent-surface", "backups")), false);
rmSync(liveStaleDest, { recursive: true, force: true });

const missingStaleDest = "/tmp/agent-surface-missing-stale";
rmSync(missingStaleDest, { recursive: true, force: true });
run(["install", "--target", "cline", "--dest", missingStaleDest]);
const missingStaleManifestPath = path.join(missingStaleDest, ".agent-surface", "cline-manifest.json");
const missingStaleManifest = JSON.parse(readFileSync(missingStaleManifestPath, "utf8"));
missingStaleManifest.managed.push({
  target: "cline",
  scope: "project",
  source: "commands/removed.md",
  output: ".clinerules/workflows/already-gone.md",
  version: "0.1.0",
});
writeFileSync(missingStaleManifestPath, `${JSON.stringify(missingStaleManifest, null, 2)}\n`);
const missingStaleInstall = run(["install", "--target", "cline", "--dest", missingStaleDest]);
assert.match(missingStaleInstall, /^installed:$/m);
assert.match(missingStaleInstall, /removed stale: 0/);
rmSync(missingStaleDest, { recursive: true, force: true });

const scopeRootDest = "/tmp/agent-surface-scope-root";
rmSync(scopeRootDest, { recursive: true, force: true });
mkdirSync(scopeRootDest, { recursive: true });
const scopeRootInstall = run(["install", "--target", "cline", "--scope", "project", "--allow-scope-root"], { cwd: scopeRootDest });
assert.match(scopeRootInstall, /^root source: scope-derived root$/m);
assert.match(scopeRootInstall, /^installed:$/m);
assert.equal(existsSync(path.join(scopeRootDest, ".clinerules", "workflows", "workflow-boss.md")), true);
rmSync(scopeRootDest, { recursive: true, force: true });

const evidenceDest = "/tmp/agent-surface-evidence";
rmSync(evidenceDest, { recursive: true, force: true });
const evidenceRun = run([
  "run",
  "--task",
  "T1",
  "--class",
  "read_only",
  "--timeout",
  "5000",
  "--out",
  evidenceDest,
  "--",
  process.execPath,
  "-e",
  "process.stdout.write('ok\\n' + 'API' + '_KEY=abc123'); process.stderr.write('Authorization: ' + 'Bearer secret-token');",
]);
assert.match(evidenceRun, /exit_code: 0/);
const evidenceFiles = files(evidenceDest);
const evidenceJson = evidenceFiles.find((file) => file.endsWith(".evidence.json"));
assert.ok(evidenceJson);
const evidence = JSON.parse(readFileSync(evidenceJson, "utf8"));
assert.equal(evidence.task_id, "T1");
assert.equal(evidence.class, "read_only");
assert.equal(evidence.exit_code, 0);
const redactedApiKeyPattern = new RegExp("^ok\\n" + "API" + "_KEY=\\[REDACTED\\]$");
const redactedAuthPattern = new RegExp("^Authorization: " + "Bearer \\[REDACTED\\]$");
assert.match(readFileSync(path.join(evidenceDest, path.basename(evidence.stdout_ref)), "utf8"), redactedApiKeyPattern);
assert.match(readFileSync(path.join(evidenceDest, path.basename(evidence.stderr_ref)), "utf8"), redactedAuthPattern);
assert.match(evidence.stdout_hash, /^sha256:/);
assert.match(evidence.stdout_raw_hash, /^sha256:/);
assert.equal(evidence.stdout_raw_stored, false);
assert.match(evidence.stderr_raw_hash, /^sha256:/);
assert.equal(evidence.stderr_raw_stored, false);
assert.equal(evidence.redaction.applied, true);
rmSync(evidenceDest, { recursive: true, force: true });

const argSecretDest = "/tmp/agent-surface-arg-secret";
rmSync(argSecretDest, { recursive: true, force: true });
const argSecretRun = run([
  "run",
  "--task",
  "T1",
  "--class",
  "read_only",
  "--timeout",
  "5000",
  "--out",
  argSecretDest,
  "--",
  process.execPath,
  "-e",
  "process.exit(0)",
  "Authorization: Bearer secret-token",
]);
assert.match(argSecretRun, /exit_code: 0/);
const argSecretEvidenceJson = files(argSecretDest).find((file) => file.endsWith(".evidence.json"));
const argSecretEvidence = JSON.parse(readFileSync(argSecretEvidenceJson, "utf8"));
assert.equal(JSON.stringify(argSecretEvidence.cmd).includes("secret-token"), false);
assert.match(argSecretEvidence.cmd_hash_raw, /^sha256:/);
rmSync(argSecretDest, { recursive: true, force: true });

const unsafeClassDest = "/tmp/agent-surface-unsafe-class";
rmSync(unsafeClassDest, { recursive: true, force: true });
const unsafeClass = status([
  "run",
  "--task",
  "T1",
  "--class",
  "deployment",
  "--timeout",
  "5000",
  "--out",
  unsafeClassDest,
  "--",
  process.execPath,
  "-e",
  "process.exit(0)",
]);
assert.notEqual(unsafeClass.status, 0);
assert.match(`${unsafeClass.stdout}${unsafeClass.stderr}`, /requires explicit approval/);
rmSync(unsafeClassDest, { recursive: true, force: true });

const workflowDest = "/tmp/agent-surface-workflow";
rmSync(workflowDest, { recursive: true, force: true });
const workflowRunDir = path.join(workflowDest, ".agent-surface", "workflows", "run-fixture-001");
mkdirSync(workflowRunDir, { recursive: true });
const workflowRun = JSON.parse(readFileSync(path.join(root, "tests", "fixtures", "workflow", "run.json"), "utf8"));
workflowRun.active_task_ids = ["T2"];
workflowRun.workflow_next_command = "workflow-reviewer";
writeFileSync(path.join(workflowRunDir, "run.json"), `${JSON.stringify(workflowRun, null, 2)}\n`);
writeFileSync(path.join(workflowRunDir, "events.ndjson"), "");
writeFileSync(
  path.join(workflowRunDir, "reviewer.json"),
  readFileSync(path.join(root, "tests", "fixtures", "workflow", "reviewer-refactor.json"), "utf8"),
);
const workflowApply = status(
  [
    "workflow",
    "apply",
    "--role",
    "workflow-reviewer",
    "--run",
    "run-fixture-001",
    "--artifact",
    path.join(".agent-surface", "workflows", "run-fixture-001", "reviewer.json"),
  ],
  { cwd: workflowDest },
);
assert.equal(workflowApply.status, 0, `${workflowApply.stdout}${workflowApply.stderr}`);
const appliedRun = JSON.parse(readFileSync(path.join(workflowRunDir, "run.json"), "utf8"));
assert.deepEqual(appliedRun.active_task_ids, []);
assert.deepEqual(appliedRun.rework_task_ids, ["T2"]);
assert.equal(appliedRun.workflow_next_command, "dev-refactor");
const workflowDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: workflowDest });
assert.equal(workflowDoctor.status, 0, `${workflowDoctor.stdout}${workflowDoctor.stderr}`);
const invalidBoss = JSON.parse(readFileSync(path.join(root, "tests", "fixtures", "workflow", "boss-chore.json"), "utf8"));
invalidBoss.tasks[0].suggested_runtime = "not-a-runtime";
writeFileSync(path.join(workflowRunDir, "boss.json"), `${JSON.stringify(invalidBoss, null, 2)}\n`);
const invalidRuntimeDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: workflowDest });
assert.notEqual(invalidRuntimeDoctor.status, 0);
assert.match(`${invalidRuntimeDoctor.stdout}${invalidRuntimeDoctor.stderr}`, /suggested_runtime is not in the workflow runtime taxonomy/);
invalidBoss.tasks[0].suggested_runtime = "kilo-cli";
invalidBoss.tasks[0].parallel_group = "G1";
writeFileSync(path.join(workflowRunDir, "boss.json"), `${JSON.stringify(invalidBoss, null, 2)}\n`);
const invalidBossDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: workflowDest });
assert.notEqual(invalidBossDoctor.status, 0);
assert.match(`${invalidBossDoctor.stdout}${invalidBossDoctor.stderr}`, /serial_required tasks must not set parallel_group/);
invalidBoss.tasks[0].isolation = "same_worktree_read_only";
invalidBoss.tasks[0].suggested_runtime = "kilo-cli";
invalidBoss.tasks[0].subagent_suitable = true;
writeFileSync(path.join(workflowRunDir, "boss.json"), `${JSON.stringify(invalidBoss, null, 2)}\n`);
const mixedFanoutDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: workflowDest });
assert.notEqual(mixedFanoutDoctor.status, 0);
assert.match(
  `${mixedFanoutDoctor.stdout}${mixedFanoutDoctor.stderr}`,
  /parallel_group and subagent_suitable=true are mutually exclusive/,
);
rmSync(path.join(workflowRunDir, "boss.json"), { force: true });
const invalidBlockedWorker = JSON.parse(readFileSync(path.join(root, "tests", "fixtures", "workflow", "worker-blocked-legacy.json"), "utf8"));
delete invalidBlockedWorker.tasks_processed[0].blocker;
writeFileSync(path.join(workflowRunDir, "worker.json"), `${JSON.stringify(invalidBlockedWorker, null, 2)}\n`);
const invalidBlockedDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: workflowDest });
assert.notEqual(invalidBlockedDoctor.status, 0);
assert.match(`${invalidBlockedDoctor.stdout}${invalidBlockedDoctor.stderr}`, /worker\.json/);
rmSync(workflowDest, { recursive: true, force: true });

const patchDest = "/tmp/agent-surface-patch";
rmSync(patchDest, { recursive: true, force: true });
mkdirSync(path.join(patchDest, "src"), { recursive: true });
execFileSync("git", ["init"], { cwd: patchDest, encoding: "utf8" });
writeFileSync(path.join(patchDest, "src", "example.txt"), "before\n");
execFileSync("git", ["add", "src/example.txt"], { cwd: patchDest, encoding: "utf8" });
const unsafePatch = status(
  ["workflow", "patch", "begin", "--run", "run-fixture-001", "--round", "1", "--task", "T1", "--file", "../escape.txt"],
  { cwd: patchDest },
);
assert.notEqual(unsafePatch.status, 0);
assert.match(`${unsafePatch.stdout}${unsafePatch.stderr}`, /unsafe --file/);
const patchBegin = status(
  ["workflow", "patch", "begin", "--run", "run-fixture-001", "--round", "1", "--task", "T1", "--file", "src/example.txt"],
  { cwd: patchDest },
);
assert.equal(patchBegin.status, 0, `${patchBegin.stdout}${patchBegin.stderr}`);
writeFileSync(path.join(patchDest, "src", "example.txt"), "after\n");
const patchEnd = status(["workflow", "patch", "end", "--run", "run-fixture-001", "--round", "1", "--task", "T1"], {
  cwd: patchDest,
});
assert.equal(patchEnd.status, 0, `${patchEnd.stdout}${patchEnd.stderr}`);
const patchVerify = status(["workflow", "patch", "verify", "--run", "run-fixture-001", "--round", "1", "--task", "T1"], {
  cwd: patchDest,
});
assert.equal(patchVerify.status, 0, `${patchVerify.stdout}${patchVerify.stderr}`);
const patchManifest = JSON.parse(
  readFileSync(path.join(patchDest, ".agent-surface", "workflows", "run-fixture-001", "rounds", "round-001", "patches", "T1.patch.json"), "utf8"),
);
assert.equal(patchManifest.status, "verified");
assert.equal(patchManifest.applies_cleanly, true);
assert.deepEqual(patchManifest.changed_files, ["src/example.txt"]);
assert.match(patchManifest.patch_hash, /^sha256:[a-f0-9]{64}$/);
const patchRunDir = path.join(patchDest, ".agent-surface", "workflows", "run-fixture-001");
writeFileSync(path.join(patchRunDir, "run.json"), readFileSync(path.join(root, "tests", "fixtures", "workflow", "run.json"), "utf8"));
writeFileSync(path.join(patchRunDir, "events.ndjson"), "");
const patchDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: patchDest });
assert.equal(patchDoctor.status, 0, `${patchDoctor.stdout}${patchDoctor.stderr}`);
const patchManifestPath = path.join(patchRunDir, "rounds", "round-001", "patches", "T1.patch.json");
writeFileSync(patchManifestPath, `${JSON.stringify({ ...patchManifest, patch_hash: `sha256:${"0".repeat(64)}` }, null, 2)}\n`);
const badPatchHashDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: patchDest });
assert.notEqual(badPatchHashDoctor.status, 0);
assert.match(`${badPatchHashDoctor.stdout}${badPatchHashDoctor.stderr}`, /patch_hash does not match/);
writeFileSync(patchManifestPath, `${JSON.stringify({ ...patchManifest, applies_cleanly: false }, null, 2)}\n`);
const badPatchDoctor = status(["workflow", "doctor", "--run", "run-fixture-001"], { cwd: patchDest });
assert.notEqual(badPatchDoctor.status, 0);
assert.match(`${badPatchDoctor.stdout}${badPatchDoctor.stderr}`, /applies_cleanly/);
rmSync(patchDest, { recursive: true, force: true });

const unsafeInstall = status(["install", "--target", "cline"]);
assert.notEqual(unsafeInstall.status, 0);
assert.match(unsafeInstall.stderr, /live install requires explicit --dest or --allow-scope-root/);

const invalidScope = status(["install", "--target", "cline", "--scope", "workspace", "--dry-run"]);
assert.notEqual(invalidScope.status, 0);
assert.match(invalidScope.stderr, /unsupported install scope/);

const userScopeHome = "/tmp/agent-surface-user-scope-home";
rmSync(userScopeHome, { recursive: true, force: true });
mkdirSync(userScopeHome, { recursive: true });
const userScopeEnv = { ...process.env, HOME: userScopeHome };
const clineUserScope = status(["install", "--target", "cline", "--scope", "user", "--dry-run"], { env: userScopeEnv });
assert.equal(clineUserScope.status, 0, `${clineUserScope.stdout}${clineUserScope.stderr}`);
assert.match(clineUserScope.stdout, /\.cline\/workflows\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(clineUserScope.stdout, /\.cline\/agents\/boss\.yaml <- subagents\/boss\.md/);
assert.match(clineUserScope.stdout, /\.cline\/skills\/karpathy-guidelines\/SKILL\.md/);
assert.match(clineUserScope.stdout, /\.cline\/data\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);

const kiloUserScope = status(["install", "--target", "kilo", "--scope", "user", "--dry-run"], { env: userScopeEnv });
assert.equal(kiloUserScope.status, 0, `${kiloUserScope.stdout}${kiloUserScope.stderr}`);
assert.match(kiloUserScope.stdout, /\.config\/kilo\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.doesNotMatch(kiloUserScope.stdout, /\.config\/kilo\/AGENTS\.md <- rules\/\*\.mdc/);
assert.match(kiloUserScope.stdout, /\.config\/kilo\/rules\/00-precedence-and-safety\.md <- rules\/00-precedence-and-safety\.mdc/);
assert.match(kiloUserScope.stdout, /\.config\/kilo\/references\/rules\/14-shell\.md <- rules\/14-shell\.mdc/);
assert.match(kiloUserScope.stdout, /\.config\/kilo\/agents\/boss\.md <- subagents\/boss\.md/);
assert.match(kiloUserScope.stdout, /\.config\/kilo\/kilo\.jsonc instructions \+= \.\/rules\/00-precedence-and-safety\.md, .*\.\/rules\/06-test-policy\.md/);
assert.doesNotMatch(kiloUserScope.stdout, /\.kilo\/skills/);
assert.doesNotMatch(kiloUserScope.stdout, /skills\.paths/);
assert.doesNotMatch(kiloUserScope.stdout, /permission\.skill/);
assert.doesNotMatch(kiloUserScope.stdout, /kilo\.jsonc instructions \+= .*14-shell/);
assert.match(kiloUserScope.stdout, /\.kilocodeignore \(project-scope only\)/);
assert.doesNotMatch(kiloUserScope.stdout, /\.kilocodeignore <- ignores/);

const claudeUserScope = status(["install", "--target", "claude-code", "--scope", "user", "--dry-run"], { env: userScopeEnv });
assert.equal(claudeUserScope.status, 0, `${claudeUserScope.stdout}${claudeUserScope.stderr}`);
assert.doesNotMatch(claudeUserScope.stdout, /\.mcp\.json/);
assert.match(claudeUserScope.stdout, /\.claude\/agents\/boss\.md <- subagents\/boss\.md/);

const openhandsUserScope = status(["install", "--target", "openhands", "--scope", "user", "--dry-run"], { env: userScopeEnv });
assert.equal(openhandsUserScope.status, 0, `${openhandsUserScope.stdout}${openhandsUserScope.stderr}`);
assert.match(openhandsUserScope.stdout, /\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(openhandsUserScope.stdout, /\.openhands\/skills\/agent-surface-rules\.md <- rules\/\*\.mdc/);
assert.match(openhandsUserScope.stdout, /\.openhands\/references\/rules\/10-python\.md <- rules\/10-python\.mdc/);
assert.match(openhandsUserScope.stdout, /\.openhands\/mcp\.json MCP \+= grimoire, synapse/);
rmSync(userScopeHome, { recursive: true, force: true });

const kiloIgnoreDest = "/tmp/agent-surface-kilo-ignore-proj";
rmSync(kiloIgnoreDest, { recursive: true, force: true });
mkdirSync(kiloIgnoreDest, { recursive: true });
const kiloProjectScope = status(["install", "--target", "kilo", "--dest", kiloIgnoreDest, "--scope", "project", "--dry-run"]);
assert.equal(kiloProjectScope.status, 0, `${kiloProjectScope.stdout}${kiloProjectScope.stderr}`);
assert.match(kiloProjectScope.stdout, /\.kilocodeignore <- ignores\/default\.ignore/);
rmSync(kiloIgnoreDest, { recursive: true, force: true });

const invalidKiloDest = "/tmp/agent-surface-kilo-invalid";
rmSync(invalidKiloDest, { recursive: true, force: true });
mkdirSync(invalidKiloDest, { recursive: true });
writeFileSync(path.join(invalidKiloDest, "kilo.jsonc"), "{\"instructions\":\"bad\"}\n");
const invalidKiloInstall = status(["install", "--target", "kilo", "--dest", invalidKiloDest]);
assert.notEqual(invalidKiloInstall.status, 0);
assert.match(`${invalidKiloInstall.stdout}${invalidKiloInstall.stderr}`, /kilo\.jsonc: instructions must be an array/);
assert.equal(existsSync(path.join(invalidKiloDest, ".kilo")), false);
assert.equal(existsSync(path.join(invalidKiloDest, "AGENTS.md")), false);
assert.equal(existsSync(path.join(invalidKiloDest, ".agent-surface", "kilo-manifest.json")), false);
rmSync(invalidKiloDest, { recursive: true, force: true });

const existingKiloDest = "/tmp/agent-surface-kilo-existing";
rmSync(existingKiloDest, { recursive: true, force: true });
mkdirSync(existingKiloDest, { recursive: true });
writeFileSync(
  path.join(existingKiloDest, "kilo.jsonc"),
  [
    "{",
    "  // keep this comment",
    "  \"instructions\": [",
    "    \"./existing-rule.md\",",
    "    \".kilo/rules/agent-surface.md\",",
    "    \".kilo/rules/00-core.md\",",
    "    \".kilo/rules/10-python.md\",",
    "    \".kilo/rules/10-lang-python.md\",",
    "    \".kilo/rules/14-shell.md\",",
    "    \".kilo/rules/14-lang-shell.md\",",
    "  ],",
    "  \"marker\": \",]\"",
    "}",
    "",
  ].join("\n"),
);
run(["install", "--target", "kilo", "--dest", existingKiloDest]);
const mergedKiloConfig = readFileSync(path.join(existingKiloDest, "kilo.jsonc"), "utf8");
assert.equal(existsSync(path.join(existingKiloDest, ".kilo", "skills")), false);
assert.match(mergedKiloConfig, /\/\/ keep this comment/);
assert.match(mergedKiloConfig, /"marker": ",\]"/);
assert.match(mergedKiloConfig, /"\.\/existing-rule\.md"/);
assert.doesNotMatch(mergedKiloConfig, /"skills"/);
assert.doesNotMatch(mergedKiloConfig, /"permission"/);
assert.doesNotMatch(mergedKiloConfig, /"\.kilo\/rules\/agent-surface\.md"/);
assert.doesNotMatch(mergedKiloConfig, /"\.kilo\/rules\/00-core\.md"/);
assert.doesNotMatch(mergedKiloConfig, /"\.kilo\/rules\/10-python\.md"/);
assert.doesNotMatch(mergedKiloConfig, /"\.kilo\/rules\/10-lang-python\.md"/);
assert.match(mergedKiloConfig, /"\.kilo\/rules\/00-precedence-and-safety\.md"/);
assert.match(mergedKiloConfig, /"\.kilo\/rules\/06-test-policy\.md"/);
assert.doesNotMatch(mergedKiloConfig, /"\.kilo\/rules\/14-shell\.md"/);
assert.doesNotMatch(mergedKiloConfig, /"\.kilo\/rules\/14-lang-shell\.md"/);
rmSync(existingKiloDest, { recursive: true, force: true });

const inlineKiloDest = "/tmp/agent-surface-kilo-inline";
rmSync(inlineKiloDest, { recursive: true, force: true });
mkdirSync(inlineKiloDest, { recursive: true });
writeFileSync(path.join(inlineKiloDest, "kilo.jsonc"), "{\"instructions\":[\"./existing-rule.md\"]}\n");
run(["install", "--target", "kilo", "--dest", inlineKiloDest]);
const inlineKiloConfig = JSON.parse(readFileSync(path.join(inlineKiloDest, "kilo.jsonc"), "utf8"));
assert.deepEqual(inlineKiloConfig.instructions, [
  "./existing-rule.md",
  ".kilo/rules/00-precedence-and-safety.md",
  ".kilo/rules/01-response-style.md",
  ".kilo/rules/02-agent-workflow.md",
  ".kilo/rules/03-project-defaults.md",
  ".kilo/rules/05-tooling.md",
  ".kilo/rules/06-test-policy.md",
]);
assert.equal(Object.hasOwn(inlineKiloConfig, "skills"), false);
assert.equal(Object.hasOwn(inlineKiloConfig, "permission"), false);
assert.deepEqual(inlineKiloConfig.mcp.synapse.command, [path.join(os.homedir(), ".local", "bin", "synapse-bridge")]);
rmSync(inlineKiloDest, { recursive: true, force: true });

// Regression: MCP commands must be ABSOLUTE at install time. Hosts posix_spawn the stdio
// command directly (no shell), so a literal "~" is never expanded → ENOENT on launch.
// dist/build keeps "~" (portable, reproducible); install resolves it against $HOME.
const mcpAbsBin = (name) => path.join(os.homedir(), ".local", "bin", name);
const mcpAbsDest = "/tmp/agent-surface-mcp-abs";
rmSync(mcpAbsDest, { recursive: true, force: true });
run(["install", "--target", "droid", "--scope", "user", "--category", "mcps", "--dest", mcpAbsDest]);
const droidMcpAbs = JSON.parse(readFileSync(path.join(mcpAbsDest, ".factory", "mcp.json"), "utf8"));
assert.equal(droidMcpAbs.mcpServers.grimoire.command, mcpAbsBin("grimoire-server"));
assert.equal(droidMcpAbs.mcpServers.synapse.command, mcpAbsBin("synapse-bridge"));
assert.doesNotMatch(droidMcpAbs.mcpServers.grimoire.command, /^~/, "install MCP command must not contain a literal ~");
rmSync(mcpAbsDest, { recursive: true, force: true });

const existingCursorMcpDest = "/tmp/agent-surface-cursor-existing-mcp";
rmSync(existingCursorMcpDest, { recursive: true, force: true });
mkdirSync(path.join(existingCursorMcpDest, ".cursor"), { recursive: true });
writeFileSync(
  path.join(existingCursorMcpDest, ".cursor", "mcp.json"),
  `${JSON.stringify({ mcpServers: { existing: { command: "local-existing", args: ["--ok"] } } }, null, 2)}\n`,
);
run(["install", "--target", "cursor", "--dest", existingCursorMcpDest, "--category", "mcps", "--service", "synapse"]);
const mergedCursorMcp = JSON.parse(readFileSync(path.join(existingCursorMcpDest, ".cursor", "mcp.json"), "utf8"));
assert.equal(mergedCursorMcp.mcpServers.existing.command, "local-existing");
assert.equal(mergedCursorMcp.mcpServers.synapse.command, path.join(os.homedir(), ".local", "bin", "synapse-bridge"));
assert.equal(Object.hasOwn(mergedCursorMcp.mcpServers, "agentmemory"), false);
rmSync(existingCursorMcpDest, { recursive: true, force: true });

const ownedCursorMcpDest = "/tmp/agent-surface-cursor-owned-mcp";
rmSync(ownedCursorMcpDest, { recursive: true, force: true });
mkdirSync(path.join(ownedCursorMcpDest, ".cursor"), { recursive: true });
mkdirSync(path.join(ownedCursorMcpDest, ".agent-surface"), { recursive: true });
writeFileSync(
  path.join(ownedCursorMcpDest, ".cursor", "mcp.json"),
  `${JSON.stringify({
    mcpServers: {
      existing: { command: "local-existing", args: ["--ok"] },
      synapse: { command: "user-edited-owned-entry", args: ["--wrong"] },
      "old-owned": { command: "old-generated-entry", args: [] },
    },
  }, null, 2)}\n`,
);
writeFileSync(
  path.join(ownedCursorMcpDest, ".agent-surface", "cursor-manifest.json"),
  `${JSON.stringify({
    target: "cursor",
    scope: "project",
    managed: [],
    config_entries: [{ path: ".cursor/mcp.json", format: "mcpServers", ids: ["old-owned", "synapse"] }],
  }, null, 2)}\n`,
);
const ownedCursorPlan = run(["install", "--target", "cursor", "--dest", ownedCursorMcpDest, "--category", "mcps", "--dry-run"]);
assert.match(ownedCursorPlan, /\.cursor\/mcp\.json MCP \+= grimoire, synapse/);
assert.match(ownedCursorPlan, /\.cursor\/mcp\.json MCP -= old-owned/);
run(["install", "--target", "cursor", "--dest", ownedCursorMcpDest, "--category", "mcps"]);
const ownedCursorMcp = JSON.parse(readFileSync(path.join(ownedCursorMcpDest, ".cursor", "mcp.json"), "utf8"));
assert.equal(ownedCursorMcp.mcpServers.existing.command, "local-existing");
assert.equal(ownedCursorMcp.mcpServers.synapse.command, path.join(os.homedir(), ".local", "bin", "synapse-bridge"));
assert.equal(ownedCursorMcp.mcpServers.grimoire.command, path.join(os.homedir(), ".local", "bin", "grimoire-server"));
assert.equal(Object.hasOwn(ownedCursorMcp.mcpServers, "old-owned"), false);
const ownedCursorManifest = JSON.parse(readFileSync(path.join(ownedCursorMcpDest, ".agent-surface", "cursor-manifest.json"), "utf8"));
assert.deepEqual(ownedCursorManifest.config_entries, [
  { path: ".cursor/mcp.json", format: "mcpServers", ids: ["grimoire", "synapse"] },
]);
rmSync(ownedCursorMcpDest, { recursive: true, force: true });

const obsoleteCursorMcpDest = "/tmp/agent-surface-cursor-obsolete-mcp-routes";
rmSync(obsoleteCursorMcpDest, { recursive: true, force: true });
mkdirSync(path.join(obsoleteCursorMcpDest, ".cursor"), { recursive: true });
mkdirSync(path.join(obsoleteCursorMcpDest, ".agent-surface"), { recursive: true });
writeFileSync(
  path.join(obsoleteCursorMcpDest, ".cursor", "mcp.json"),
  `${JSON.stringify({
    servers: {
      existing: { command: "local-existing-format", args: ["--keep"] },
      "old-format-owned": { command: "old-generated-entry", args: [] },
    },
  }, null, 2)}\n`,
);
writeFileSync(
  path.join(obsoleteCursorMcpDest, ".cursor", "retired-mcp.json"),
  `${JSON.stringify({
    mcpServers: {
      existing: { command: "local-existing-route", args: ["--keep"] },
      "old-route-owned": { command: "old-generated-entry", args: [] },
    },
  }, null, 2)}\n`,
);
writeFileSync(
  path.join(obsoleteCursorMcpDest, ".agent-surface", "cursor-manifest.json"),
  `${JSON.stringify({
    target: "cursor",
    scope: "project",
    managed: [],
    config_entries: [
      { path: ".cursor/mcp.json", format: "vscode-servers", ids: ["old-format-owned"] },
      { path: ".cursor/missing-mcp.json", format: "mcpServers", ids: ["missing-owned"] },
      { path: ".cursor/retired-mcp.json", format: "mcpServers", ids: ["old-route-owned"] },
    ],
  }, null, 2)}\n`,
);
const obsoleteCursorPlan = run(["install", "--target", "cursor", "--dest", obsoleteCursorMcpDest, "--dry-run"]);
assert.match(obsoleteCursorPlan, /\.cursor\/mcp\.json MCP -= old-format-owned/);
assert.match(obsoleteCursorPlan, /\.cursor\/missing-mcp\.json MCP -= missing-owned/);
assert.match(obsoleteCursorPlan, /\.cursor\/retired-mcp\.json MCP -= old-route-owned/);
run(["install", "--target", "cursor", "--dest", obsoleteCursorMcpDest]);
const obsoleteCurrentCursorMcp = JSON.parse(readFileSync(path.join(obsoleteCursorMcpDest, ".cursor", "mcp.json"), "utf8"));
assert.equal(obsoleteCurrentCursorMcp.servers.existing.command, "local-existing-format");
assert.equal(Object.hasOwn(obsoleteCurrentCursorMcp.servers, "old-format-owned"), false);
assert.equal(obsoleteCurrentCursorMcp.mcpServers.synapse.command, path.join(os.homedir(), ".local", "bin", "synapse-bridge"));
assert.equal(obsoleteCurrentCursorMcp.mcpServers.grimoire.command, path.join(os.homedir(), ".local", "bin", "grimoire-server"));
const obsoleteRetiredCursorMcp = JSON.parse(readFileSync(path.join(obsoleteCursorMcpDest, ".cursor", "retired-mcp.json"), "utf8"));
assert.equal(obsoleteRetiredCursorMcp.mcpServers.existing.command, "local-existing-route");
assert.equal(Object.hasOwn(obsoleteRetiredCursorMcp.mcpServers, "old-route-owned"), false);
const obsoleteCursorManifest = JSON.parse(readFileSync(path.join(obsoleteCursorMcpDest, ".agent-surface", "cursor-manifest.json"), "utf8"));
assert.deepEqual(obsoleteCursorManifest.config_entries, [
  { path: ".cursor/mcp.json", format: "mcpServers", ids: ["grimoire", "synapse"] },
]);
rmSync(obsoleteCursorMcpDest, { recursive: true, force: true });

/*
SUBSTITUTE_JUSTIFICATION
- substitute: seeded obsolete .cline/mcp.json and cline-manifest.json inputs for user- and project-scope migration cases
- replaces: a historical Cline profile containing both agent-surface-owned entries and an unrelated user-owned MCP server
- necessity: the current installer cannot create the retired route, and modifying an actual user profile to recreate stale ownership would risk destructive config changes
- real-option: a disposable install from the current tree was considered, but it cannot produce the historical route; a live profile is unsafe and nondeterministic migration input
- proof-limit: this diagnoses production migration logic on a real disposable filesystem but does not prove Cline task execution or either MCP server's health
- real-proof: BLOCKED: requires an actual pre-migration profile; unblock by snapshotting one and authorizing migration of the isolated copy
*/
for (const scope of ["user", "project"]) {
  const obsoleteClineMcpDest = `/tmp/agent-surface-cline-obsolete-mcp-route-${scope}`;
  rmSync(obsoleteClineMcpDest, { recursive: true, force: true });
  mkdirSync(path.join(obsoleteClineMcpDest, ".cline"), { recursive: true });
  mkdirSync(path.join(obsoleteClineMcpDest, ".agent-surface"), { recursive: true });
  writeFileSync(
    path.join(obsoleteClineMcpDest, ".cline", "mcp.json"),
    `${JSON.stringify({
      mcpServers: {
        existing: { command: "local-existing", args: ["--keep"] },
        grimoire: { command: "old-grimoire", args: [] },
        synapse: { command: "old-synapse", args: [] },
      },
    }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(obsoleteClineMcpDest, ".agent-surface", "cline-manifest.json"),
    `${JSON.stringify({
      target: "cline",
      scope,
      managed: [],
      config_entries: [{ path: ".cline/mcp.json", format: "mcpServers", ids: ["grimoire", "synapse"] }],
    }, null, 2)}\n`,
  );
  const installArgs = ["install", "--target", "cline", "--scope", scope, "--dest", obsoleteClineMcpDest];
  const obsoleteClinePlan = run([...installArgs, "--dry-run"]);
  assert.match(obsoleteClinePlan, /\.cline\/mcp\.json MCP -= grimoire, synapse/);
  if (scope === "user") {
    assert.match(obsoleteClinePlan, /\.cline\/data\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);
  } else {
    assert.doesNotMatch(obsoleteClinePlan, /cline_mcp_settings\.json MCP \+=/);
  }
  run(installArgs);
  const obsoleteClineMcp = JSON.parse(readFileSync(path.join(obsoleteClineMcpDest, ".cline", "mcp.json"), "utf8"));
  assert.equal(obsoleteClineMcp.mcpServers.existing.command, "local-existing");
  assert.equal(Object.hasOwn(obsoleteClineMcp.mcpServers, "grimoire"), false);
  assert.equal(Object.hasOwn(obsoleteClineMcp.mcpServers, "synapse"), false);
  const migratedClineManifest = JSON.parse(readFileSync(path.join(obsoleteClineMcpDest, ".agent-surface", "cline-manifest.json"), "utf8"));
  if (scope === "user") {
    const currentClineMcp = JSON.parse(readFileSync(path.join(obsoleteClineMcpDest, ".cline", "data", "settings", "cline_mcp_settings.json"), "utf8"));
    assert.equal(currentClineMcp.mcpServers.grimoire.command, path.join(os.homedir(), ".local", "bin", "grimoire-server"));
    assert.equal(currentClineMcp.mcpServers.synapse.command, path.join(os.homedir(), ".local", "bin", "synapse-bridge"));
    assert.deepEqual(migratedClineManifest.config_entries, [
      { path: ".cline/data/settings/cline_mcp_settings.json", format: "mcpServers", ids: ["grimoire", "synapse"] },
    ]);
  } else {
    assert.equal(existsSync(path.join(obsoleteClineMcpDest, ".cline", "data", "settings", "cline_mcp_settings.json")), false);
    assert.deepEqual(migratedClineManifest.config_entries, []);
  }
  rmSync(obsoleteClineMcpDest, { recursive: true, force: true });
}

const legacyOwnedConfigPath = path.join(root, "registry", "legacy-owned.json");
const legacyOwnedConfigOriginal = readFileSync(legacyOwnedConfigPath, "utf8");
const legacyOwnedCursorMcpDest = "/tmp/agent-surface-cursor-legacy-owned-mcp-route";
try {
  const legacyOwnedConfig = JSON.parse(legacyOwnedConfigOriginal);
  legacyOwnedConfig.config_entries.push({
    target: "cursor",
    path: ".cursor/legacy-owned-mcp.json",
    format: "mcpServers",
    ids: ["legacy-owned"],
  });
  writeFileSync(legacyOwnedConfigPath, `${JSON.stringify(legacyOwnedConfig, null, 2)}\n`);
  rmSync(legacyOwnedCursorMcpDest, { recursive: true, force: true });
  mkdirSync(path.join(legacyOwnedCursorMcpDest, ".cursor"), { recursive: true });
  writeFileSync(
    path.join(legacyOwnedCursorMcpDest, ".cursor", "legacy-owned-mcp.json"),
    `${JSON.stringify({
      mcpServers: {
        existing: { command: "local-existing", args: ["--keep"] },
        "legacy-owned": { command: "old-generated-entry", args: [] },
      },
    }, null, 2)}\n`,
  );
  const legacyOwnedCursorPlan = run(["install", "--target", "cursor", "--dest", legacyOwnedCursorMcpDest, "--dry-run"]);
  assert.match(legacyOwnedCursorPlan, /\.cursor\/legacy-owned-mcp\.json MCP -= legacy-owned/);
  run(["install", "--target", "cursor", "--dest", legacyOwnedCursorMcpDest]);
  const legacyOwnedCursorMcp = JSON.parse(readFileSync(path.join(legacyOwnedCursorMcpDest, ".cursor", "legacy-owned-mcp.json"), "utf8"));
  assert.equal(legacyOwnedCursorMcp.mcpServers.existing.command, "local-existing");
  assert.equal(Object.hasOwn(legacyOwnedCursorMcp.mcpServers, "legacy-owned"), false);
  const legacyOwnedCursorManifest = JSON.parse(readFileSync(path.join(legacyOwnedCursorMcpDest, ".agent-surface", "cursor-manifest.json"), "utf8"));
  assert.equal(legacyOwnedCursorManifest.config_entries.some((entry) => entry.path === ".cursor/legacy-owned-mcp.json"), false);
} finally {
  writeFileSync(legacyOwnedConfigPath, legacyOwnedConfigOriginal);
  rmSync(legacyOwnedCursorMcpDest, { recursive: true, force: true });
}

const existingOpenHandsMcpDest = "/tmp/agent-surface-openhands-existing-mcp";
rmSync(existingOpenHandsMcpDest, { recursive: true, force: true });
mkdirSync(path.join(existingOpenHandsMcpDest, ".openhands"), { recursive: true });
writeFileSync(
  path.join(existingOpenHandsMcpDest, ".openhands", "mcp.json"),
  `${JSON.stringify({ mcpServers: { existing: { command: "local-existing", args: ["--ok"] } } }, null, 2)}\n`,
);
run(["install", "--target", "openhands", "--scope", "user", "--dest", existingOpenHandsMcpDest, "--category", "mcps", "--service", "synapse"]);
const mergedOpenHandsMcp = JSON.parse(readFileSync(path.join(existingOpenHandsMcpDest, ".openhands", "mcp.json"), "utf8"));
assert.equal(mergedOpenHandsMcp.mcpServers.existing.command, "local-existing");
assert.equal(mergedOpenHandsMcp.mcpServers.synapse.command, path.join(os.homedir(), ".local", "bin", "synapse-bridge"));
assert.equal(Object.hasOwn(mergedOpenHandsMcp.mcpServers, "agentmemory"), false);
rmSync(existingOpenHandsMcpDest, { recursive: true, force: true });

const existingCodexMcpDest = "/tmp/agent-surface-codex-existing-mcp";
rmSync(existingCodexMcpDest, { recursive: true, force: true });
mkdirSync(path.join(existingCodexMcpDest, ".codex"), { recursive: true });
writeFileSync(
  path.join(existingCodexMcpDest, ".codex", "config.toml"),
  [
    "[profile.default]",
    'model = "keep-me"',
    "",
    "[mcp_servers.existing]",
    'command = "local-existing"',
    "args = []",
    "",
  ].join("\n"),
);
run(["install", "--target", "codex", "--dest", existingCodexMcpDest, "--category", "mcps", "--service", "synapse"]);
const mergedCodexMcp = readFileSync(path.join(existingCodexMcpDest, ".codex", "config.toml"), "utf8");
assert.match(mergedCodexMcp, /\[profile\.default\]/);
assert.match(mergedCodexMcp, /\[mcp_servers\.existing\]/);
assert.match(mergedCodexMcp, /\[mcp_servers\.synapse\]/);
assert.doesNotMatch(mergedCodexMcp, /\[mcp_servers\.agentmemory\]/);
rmSync(existingCodexMcpDest, { recursive: true, force: true });

// P3.1/P3.2 acceptance: non-destructive MCP merge into every manual/secret-bearing
// host. Each fixture carries a pre-existing user server; the merge must keep it,
// add the first-party synapse entry, never add external/secret-bearing MCPs, and a
// second merge must be a no-op (idempotent). Cursor + Codex are covered explicitly
// above; this loop closes the remaining eight (claude-code, cline, kilo,
// opencode, trae, vscode, windsurf, zed).
/*
SUBSTITUTE_JUSTIFICATION
- substitute: mergeFixtures pre-existing config objects for claude-code, cline, kilo, opencode, trae, vscode, windsurf, and zed
- replaces: user-owned sibling settings needed to exercise non-destructive and idempotent MCP merges for each config format
- necessity: the exact preservation assertion requires controlled unknown sibling entries and repeated writes; modifying real host profiles could corrupt user configuration
- real-option: disposable current installs were considered, but they cannot create unknown user-owned entries; live profiles are unsafe and vary by machine
- proof-limit: only the seeded input state is synthetic; the production installer, parsers, merge code, and filesystem writes are real, but host discovery and MCP service health are not proved
- real-proof: BLOCKED: requires owner-approved snapshots and host-level discovery runs for every listed host
*/
const mergeFixtures = [
  { target: "claude-code", rel: ".mcp.json", root: "mcpServers", pre: { mcpServers: { existing: { command: "local-existing", args: ["--keep"] } } } },
  { target: "cline", scope: "user", rel: ".cline/data/settings/cline_mcp_settings.json", root: "mcpServers", pre: { mcpServers: { existing: { command: "local-existing", args: ["--keep"] } } } },
  {
    target: "kilo", rel: "kilo.jsonc", root: "mcp", pre: { $schema: "keep", mcp: { existing: { type: "local", command: ["local-existing"], enabled: true } } },
    keep: (parsed) => assert.equal(parsed.$schema, "keep", "kilo $schema preserved")
  },
  {
    target: "opencode", rel: ".opencode/opencode.json", root: "mcp", pre: { $schema: "keep", mcp: { existing: { type: "local", command: ["local-existing"], enabled: true } } },
    keep: (parsed) => assert.equal(parsed.$schema, "keep", "opencode $schema preserved")
  },
  { target: "trae", rel: ".trae/mcp.json", root: "mcpServers", pre: { mcpServers: { existing: { command: "local-existing", args: ["--keep"] } } } },
  { target: "vscode", rel: "mcp.json", root: "servers", pre: { servers: { existing: { type: "stdio", command: "local-existing", args: ["--keep"] } } } },
  { target: "windsurf", rel: ".windsurf/mcp_config.json", root: "mcpServers", pre: { mcpServers: { existing: { command: "local-existing", args: ["--keep"] } } } },
  {
    target: "zed", rel: ".zed/settings.json", root: "context_servers", pre: { context_servers: { existing: { command: "local-existing", args: ["--keep"] } }, theme: "mono" },
    keep: (parsed) => assert.equal(parsed.theme, "mono", "zed non-mcp settings preserved")
  },
];
for (const fx of mergeFixtures) {
  const dest = mkdtempSync(`/tmp/agent-surface-${fx.target}-merge-`);
  try {
    mkdirSync(path.join(dest, path.dirname(fx.rel)), { recursive: true });
    writeFileSync(path.join(dest, fx.rel), `${JSON.stringify(fx.pre, null, 2)}\n`);
    const installArgs = ["install", "--target", fx.target, "--dest", dest, "--category", "mcps", "--service", "synapse"];
    if (fx.scope) installArgs.push("--scope", fx.scope);
    const firstPlan = run([...installArgs, "--dry-run"]);
    assert.match(firstPlan, new RegExp(`${fx.rel.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")} MCP \\+= synapse`), `${fx.target}: dry-run announces synapse merge`);
    run(installArgs);
    const merged = JSON.parse(readFileSync(path.join(dest, fx.rel), "utf8"));
    assert.ok(merged[fx.root]?.existing, `${fx.target}: pre-existing user server preserved`);
    const syn = merged[fx.root].synapse;
    const synCmd = Array.isArray(syn.command) ? syn.command[0] : syn.command;
    assert.equal(synCmd, path.join(os.homedir(), ".local", "bin", "synapse-bridge"), `${fx.target}: synapse merged (absolute at install)`);
    assert.equal(Object.hasOwn(merged[fx.root], "agentmemory"), false, `${fx.target}: external/secret-bearing MCP not auto-added`);
    if (fx.keep) fx.keep(merged);
    const beforeRe = readFileSync(path.join(dest, fx.rel), "utf8");
    run(installArgs);
    const afterRe = readFileSync(path.join(dest, fx.rel), "utf8");
    assert.equal(afterRe, beforeRe, `${fx.target}: re-merge is idempotent (no-op diff)`);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

// YAML MCP merge (Goose extensions) is non-destructive + idempotent: preserves the user's
// provider/model, sibling extensions, and comments; adds grimoire+synapse; re-merge is a no-op.
{
  const dest = mkdtempSync("/tmp/agent-surface-goose-yaml-");
  try {
    mkdirSync(path.join(dest, ".config", "goose"), { recursive: true });
    const seed = "# my goose config\nGOOSE_PROVIDER: openrouter\nextensions:\n  developer:\n    name: developer\n    type: builtin\n    enabled: true\n";
    writeFileSync(path.join(dest, ".config", "goose", "config.yaml"), seed);
    run(["install", "--target", "goose", "--scope", "user", "--category", "mcps", "--dest", dest]);
    const merged = readFileSync(path.join(dest, ".config", "goose", "config.yaml"), "utf8");
    assert.match(merged, /# my goose config/, "comment preserved");
    assert.match(merged, /GOOSE_PROVIDER: openrouter/, "provider preserved");
    assert.match(merged, /^ {2}developer:/m, "sibling extension preserved");
    assert.match(merged, /^ {2}grimoire:/m, "grimoire added");
    assert.match(merged, /^ {2}synapse:/m, "synapse added");
    run(["install", "--target", "goose", "--scope", "user", "--category", "mcps", "--dest", dest]);
    assert.equal(readFileSync(path.join(dest, ".config", "goose", "config.yaml"), "utf8"), merged, "goose YAML re-merge is idempotent");
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

for (const target of [
  "cursor",
  "copilot",
  "vscode",
  "vscodium",
  "opencode",
  "trae",
  "kilo",
  "droid",
  "deepagents",
  "goose",
  "grok-build",
  "openhands",
  "pi",
  "pool",
  "windsurf",
  "zed",
]) {
  const targetDest = `/tmp/agent-surface-${target}-live`;
  rmSync(targetDest, { recursive: true, force: true });
  const install = run(["install", "--target", target, "--dest", targetDest]);
  assert.match(install, /^installed:$/m);
  const manifest = JSON.parse(readFileSync(path.join(targetDest, ".agent-surface", `${target}-manifest.json`), "utf8"));
  assert.equal(manifest.target, target);
  assert.equal(manifest.managed.length > 0, true);
  if (target === "kilo") {
    const kiloConfig = JSON.parse(readFileSync(path.join(targetDest, "kilo.jsonc"), "utf8"));
    assert.deepEqual(kiloConfig.instructions, [
      ".kilo/rules/00-precedence-and-safety.md",
      ".kilo/rules/01-response-style.md",
      ".kilo/rules/02-agent-workflow.md",
      ".kilo/rules/03-project-defaults.md",
      ".kilo/rules/05-tooling.md",
      ".kilo/rules/06-test-policy.md",
    ]);
  }
  rmSync(targetDest, { recursive: true, force: true });
}

assert.match(readFileSync(path.join(root, ".gitignore"), "utf8"), /^commands\/ops-server\.md$/m);
if (hasLocalOpsServerCommand) {
  execFileSync("git", ["check-ignore", "commands/ops-server.md"], { cwd: root, encoding: "utf8" });
}

rmSync(path.join(root, "dist"), { recursive: true, force: true });

console.log("test: ok");
