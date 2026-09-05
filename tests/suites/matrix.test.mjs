#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const allCommands = await readCommands();
const catalog = { commands: publishableCommands, skills: publishableSkills };
const localCatalog = { commands: allCommands, skills: publishableSkills };
const canonicalOpsFlow = publishableSkills.find((skill) => skill.name === "ops-flow").text;
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
  const safeOutput = outputs.find((output) =>
    output.source === "skills/ops-flow/SKILL.md" && output.relativeOutput.endsWith("SKILL.md"));
  assert.ok(safeOutput, `${target}: canonical ops-flow skill emitted`);
  assert.equal(safeOutput.content, canonicalOpsFlow, `${target}: canonical skill remains unchanged`);
  assert.equal(
    outputs.some((output) => output.source === "commands/ops-nuke.md"),
    target !== "dsh",
    `${target}: manual command distribution matches the native surface`,
  );
  if (hasLocalOpsServerCommand && target !== "dsh") {
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
  for (const optionalPack of ["external/archify/", "external/sanyuan-skills/"]) {
    assert.equal(
      outputs.some((output) => output.source.startsWith(optionalPack)),
      true,
      `${target}: optional pack ${optionalPack} is distributed`,
    );
  }
}
console.log("matrix: ok");
