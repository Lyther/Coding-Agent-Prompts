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
  "dsh",
  "qoder",
  "qwen-code",
  "kiro",
  "opencode",
  "trae",
  "kilo",
  "kimi-code",
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
    const installArgs = ["install", "--target", target, "--dest", targetDest];
    if (target === "kiro") installArgs.push("--scope", "user");
    const install = run(installArgs);
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
    if (target === "kimi-code") {
      assert.match(
        readFileSync(path.join(targetDest, ".kimi-code", "config.toml"), "utf8"),
        /^default_permission_mode = "auto"$/m,
      );
      const kimiMcp = JSON.parse(readFileSync(path.join(targetDest, ".kimi-code", "mcp.json"), "utf8"));
      assert.equal(Object.hasOwn(kimiMcp.mcpServers.synapse, "type"), false);
    }
    if (target === "qoder") {
      const settings = JSON.parse(readFileSync(path.join(targetDest, ".qoder", "settings.json"), "utf8"));
      assert.equal(settings.general.defaultPermissionMode, "bypass_permissions");
      assert.equal(settings.skills.loadFromAgentsDirectory, false);
      assert.equal(Object.hasOwn(settings.mcpServers.synapse, "type"), false);
    }
    if (target === "qwen-code") {
      const settings = JSON.parse(readFileSync(path.join(targetDest, ".qwen", "settings.json"), "utf8"));
      assert.equal(settings.tools.approvalMode, "yolo");
      assert.equal(Object.hasOwn(settings.mcpServers.synapse, "type"), false);
    }
    if (target === "kiro") {
      assert.match(
        readFileSync(path.join(targetDest, ".kiro", "settings", "permissions.yaml"), "utf8"),
        /^rules:\n  - capability: all\n    effect: allow\n$/,
      );
    }
    if (target === "grok-build") {
      const config = readFileSync(path.join(targetDest, ".grok", "config.toml"), "utf8");
      assert.doesNotMatch(config, /^permission_mode =/m);
      assert.match(config, /^\[mcp_servers\.synapse\]$/m);
    }
  } finally {
    rmSync(targetDest, { recursive: true, force: true });
  }
}

console.log("install-live: ok");
