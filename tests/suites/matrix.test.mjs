#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readCommands } from "../../scripts/agent-surface/commands.mjs";
import { targetOutputs, targets } from "../../scripts/agent-surface/targets.mjs";
import { root } from "../lib/helpers.mjs";

const publishableCommandPaths = new Set(
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "commands/*.md"], {
    cwd: root,
    encoding: "utf8",
  }).split(/\r?\n/).filter(Boolean),
);
const publishableCommands = (await readCommands()).filter((command) => publishableCommandPaths.has(command.relativePath));
assert.equal(publishableCommands.length, 67, "committed target matrix command count must match publishable Git inputs");
const targetMatrixRows = new Map(
  readFileSync(path.join(root, "docs", "reference", "targets.md"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^\| ([^|]+) \| (\d+) \|/))
    .filter(Boolean)
    .map((match) => [match[1].trim(), Number(match[2])]),
);
const targetMatrixLabels = {
  "claude-code": "Claude Code",
  codex: "Codex",
  deepagents: "Deep Agents Code",
  goose: "Goose",
  "grok-build": "Grok Build",
  pi: "Pi",
  pool: "Poolside",
  cline: "Cline",
  kilo: "Kilo",
  antigravity: "Antigravity (legacy workflows)",
  "antigravity-cli": "Antigravity CLI",
  cursor: "Cursor",
  droid: "Droid",
  copilot: "GitHub Copilot",
  vscode: "VS Code",
  vscodium: "VSCodium",
  opencode: "OpenCode",
  openhands: "OpenHands",
  trae: "Trae",
  windsurf: "Windsurf",
  zed: "Zed",
};
for (const [target, adapter] of Object.entries(targets)) {
  const outputs = await targetOutputs(adapter, publishableCommands, {
    target,
    scope: "user",
    mode: "build",
    agentName: "agent",
    categoryFilter: null,
    optionalServices: null,
  });
  assert.equal(targetMatrixRows.get(targetMatrixLabels[target]), outputs.length, `${target}: committed target matrix count`);
}
console.log("matrix: ok");
