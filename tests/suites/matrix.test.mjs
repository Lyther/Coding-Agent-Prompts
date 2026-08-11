#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { readCommands } from "../../scripts/agent-surface/commands.mjs";
import { readSkills } from "../../scripts/agent-surface/skills.mjs";
import { targetOutputs, targetProducers, targets } from "../../scripts/agent-surface/targets.mjs";
import { hasLocalOpsServerCommand, root } from "../lib/helpers.mjs";

const publishableCommandPaths = new Set(
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "commands/*.md"], {
    cwd: root,
    encoding: "utf8",
  }).split(/\r?\n/).filter(Boolean),
);
const publishableCommands = (await readCommands()).filter((command) => publishableCommandPaths.has(command.relativePath));
const publishableSkillPaths = new Set(
  execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "skills/*/SKILL.md"], {
    cwd: root,
    encoding: "utf8",
  }).split(/\r?\n/).filter(Boolean),
);
const publishableSkills = (await readSkills()).filter((skill) => publishableSkillPaths.has(skill.relativePath));
assert.equal(publishableCommands.length, 5, "manual command count must match publishable Git inputs");
assert.equal(publishableSkills.length, 60, "canonical skill count must match publishable Git inputs");
const allCommands = await readCommands();
const catalog = { commands: publishableCommands, skills: publishableSkills };
const localCatalog = { commands: allCommands, skills: publishableSkills };
const canonicalOpsFlow = publishableSkills.find((skill) => skill.name === "ops-flow").text;
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
  "kimi-code": "Kimi Code",
  antigravity: "Antigravity",
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
  if (adapter.renderSkill) {
    assert.ok(
      targetProducers(adapter).some((producer) => producer.id === "external-skills"),
      `${target}: native skill root also receives configured external skill packs`,
    );
  }
  const outputs = await targetOutputs(adapter, catalog, {
    target,
    scope: "user",
    mode: "build",
    agentName: "agent",
    categoryFilter: null,
    optionalServices: null,
  });
  assert.equal(targetMatrixRows.get(targetMatrixLabels[target]), outputs.length, `${target}: committed target matrix count`);
  const safeOutput = outputs.find((output) =>
    output.source === "skills/ops-flow/SKILL.md" && output.relativeOutput.endsWith("SKILL.md"));
  assert.ok(safeOutput, `${target}: canonical ops-flow skill emitted`);
  assert.equal(safeOutput.content, canonicalOpsFlow, `${target}: canonical skill remains unchanged`);
  assert.equal(
    outputs.some((output) => output.source === "commands/ops-nuke.md"),
    true,
    `${target}: manual commands are distributed`,
  );
  if (hasLocalOpsServerCommand) {
    const localOutputs = await targetOutputs(adapter, localCatalog, {
      target,
      scope: "user",
      mode: "build",
      agentName: "agent",
      categoryFilter: null,
      optionalServices: null,
    });
    assert.equal(
      localOutputs.some((output) => output.source === "commands/ops-server.md"),
      true,
      `${target}: private local ops-server command is distributed`,
    );
  }
  for (const optionalPack of ["external/andrej-karpathy-skills/", "external/sanyuan-skills/"]) {
    assert.equal(
      outputs.some((output) => output.source.startsWith(optionalPack)),
      true,
      `${target}: optional pack ${optionalPack} is distributed`,
    );
  }
}
console.log("matrix: ok");
