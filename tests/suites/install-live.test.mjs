#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { run } from "../lib/helpers.mjs";

// Table-driven live install smoke: each installable target must write a manifest
// with managed entries. Distinct from build/check generated (render path only).
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
  try {
    const install = run(["install", "--target", target, "--dest", targetDest]);
    assert.match(install, /^installed:$/m, `${target}: install summary`);
    const manifest = JSON.parse(readFileSync(path.join(targetDest, ".agent-surface", `${target}-manifest.json`), "utf8"));
    assert.equal(manifest.target, target);
    assert.equal(manifest.managed.length > 0, true, `${target}: managed entries`);
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
      assert.deepEqual(kiloConfig.permission, { "*": "allow" });
      assert.equal(kiloConfig.share, "disabled");
    }
    if (target === "opencode") {
      const openCodeConfig = JSON.parse(readFileSync(path.join(targetDest, ".opencode", "opencode.json"), "utf8"));
      assert.deepEqual(openCodeConfig.permission, { "*": "allow" });
      assert.equal(openCodeConfig.share, "disabled");
    }
  } finally {
    rmSync(targetDest, { recursive: true, force: true });
  }
}

console.log("install-live: ok");
