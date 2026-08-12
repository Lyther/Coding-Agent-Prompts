#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { vsCodeUserRoot } from "../../scripts/agent-surface/roots.mjs";
import {
  assertCodexAgentTomlParses,
  files,
  hasLocalOpsServerCommand,
  root, run, status,
} from "../lib/helpers.mjs";

run(["build", "--target", "all"]);
const generated = files(path.join(root, "dist"));

// Served anthropic packs must not leak into host skill catalogs.
assert.equal(generated.some((file) => file.includes(`${path.sep}agent-surface-cybersecurity${path.sep}`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}conducting-cloud-penetration-testing${path.sep}`)), false);
const anthropicCybersecuritySkillRoot = path.join(root, "external", "anthropic-cybersecurity-skills", "skills");
if (existsSync(anthropicCybersecuritySkillRoot)) {
  const skillNames = readdirSync(anthropicCybersecuritySkillRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(path.join(anthropicCybersecuritySkillRoot, entry.name, "SKILL.md")))
    .map((entry) => entry.name);
  assert.notEqual(skillNames.length, 0);
  for (const skillName of skillNames) {
    assert.equal(
      generated.some((file) => file.includes(`${path.sep}${skillName}${path.sep}SKILL.md`) || file.endsWith(`${path.sep}${skillName}.md`)),
      false,
      `served skill leaked into dist: ${skillName}`,
    );
  }
}

assert.match(run(["check", "generated"]), /generated check: ok/);
assertCodexAgentTomlParses();

const mustExist = [
  ["claude-code", path.join(".claude", "skills", "workflow-runtime", "SKILL.md")],
  ["claude-code", path.join(".claude", "skills", "dev-spec", "SKILL.md")],
  ["claude-code", path.join(".claude", "skills", "arch-contract", "SKILL.md")],
  ["codex", path.join(".agents", "skills", "workflow-runtime", "SKILL.md")],
  ["codex", path.join(".agents", "skills", "arch-contract", "SKILL.md")],
  ["codex", path.join(".codex", "AGENTS.md")],
  ["cline", path.join(".cline", "skills", "verify-readiness", "SKILL.md")],
  ["cline", path.join("Documents", "Cline", "Rules", "agent-surface.md")],
  ["cline", path.join(".cline", "agents", "boss.yaml")],
  ["kilo", path.join(".config", "kilo", "kilo.jsonc")],
  ["kilo", path.join(".kilo", "skills", "verify-readiness", "SKILL.md")],
  ["kimi-code", path.join("skills", "workflow-runtime", "SKILL.md")],
  ["kimi-code", "AGENTS.md"],
  ["kimi-code", path.join("agents", "boss.md")],
  ["kimi-code", "config.toml"],
  ["kimi-code", "mcp.json"],
  ["openhands", path.join(".openhands", "mcp.json")],
  ["goose", path.join(".config", "goose", "config.yaml")],
];
for (const [target, rel] of mustExist) {
  assert.equal(
    generated.some((file) => file.endsWith(path.join("dist", target, rel))),
    true,
    `missing build output: ${target}/${rel}`,
  );
}
assert.equal(generated.some((file) => file.includes(`${path.sep}gemini-cli${path.sep}`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}qa-sec${path.sep}`) || file.endsWith(`${path.sep}qa-sec.md`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}verify-spec${path.sep}`) || file.endsWith(`${path.sep}verify-spec.md`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}arch-api${path.sep}`) || file.endsWith(`${path.sep}arch-api.md`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}arch-model${path.sep}`) || file.endsWith(`${path.sep}arch-model.md`)), false);
assert.equal(generated.some((file) => file.includes(`${path.sep}.claude${path.sep}commands${path.sep}`)), false);
for (const target of [
  "antigravity",
  "antigravity-cli",
  "claude-code",
  "cline",
  "codex",
  "copilot",
  "cursor",
  "deepagents",
  "droid",
  "goose",
  "grok-build",
  "kilo",
  "kimi-code",
  "opencode",
  "openhands",
  "pi",
  "pool",
  "trae",
  "vscode",
  "vscodium",
  "windsurf",
  "zed",
]) {
  const targetFiles = generated.filter((file) => file.includes(`${path.sep}dist${path.sep}${target}${path.sep}`));
  if (hasLocalOpsServerCommand) {
    assert.equal(
      targetFiles.some((file) => file.includes(`${path.sep}ops-server${path.sep}`) || file.endsWith(`${path.sep}ops-server.md`)),
      true,
      `${target}: local ops-server command missing`,
    );
  }
  assert.equal(
    targetFiles.some((file) => file.includes(`${path.sep}karpathy-guidelines${path.sep}SKILL.md`)),
    true,
    `${target}: optional andrej-karpathy-skills pack missing`,
  );
  assert.equal(
    targetFiles.some((file) => file.includes(`${path.sep}book-study${path.sep}SKILL.md`)),
    true,
    `${target}: optional sanyuan-skills pack missing`,
  );
}

const claudeOpsAsk = readFileSync(path.join(root, "dist", "claude-code", ".claude", "skills", "ops-ask", "SKILL.md"), "utf8");
const claudeOpsNuke = readFileSync(path.join(root, "dist", "claude-code", ".claude", "skills", "ops-nuke", "SKILL.md"), "utf8");
assert.doesNotMatch(claudeOpsAsk, /^disable-model-invocation:/m);
assert.match(claudeOpsNuke, /^disable-model-invocation: true$/m);
const codexOpsAskPolicy = readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "ops-ask", "agents", "openai.yaml"), "utf8");
assert.match(codexOpsAskPolicy, /^  allow_implicit_invocation: true$/m);
assert.match(readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "ops-nuke", "SKILL.md"), "utf8"), /^---\nname: ops-nuke\n/);
assert.match(readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "ops-nuke", "SKILL.md"), "utf8"), /^disable-model-invocation: true$/m);
assert.match(readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "ops-nuke", "agents", "openai.yaml"), "utf8"), /^  allow_implicit_invocation: false$/m);
assert.equal(existsSync(path.join(root, "dist", "codex", ".codex", "skills", "ops-nuke", "SKILL.md")), false);
const canonicalOpsAsk = readFileSync(path.join(root, "skills", "ops-ask", "SKILL.md"), "utf8");
assert.equal(claudeOpsAsk, canonicalOpsAsk);
assert.equal(readFileSync(path.join(root, "dist", "kimi-code", "skills", "ops-ask", "SKILL.md"), "utf8"), canonicalOpsAsk);
assert.match(
  readFileSync(path.join(root, "dist", "deepagents", ".deepagents", "agent", "skills", "ops-nuke", "SKILL.md"), "utf8"),
  /^disable-model-invocation: true$/m,
);

// Substitute-policy contract lands in always-on Codex instructions + verify-test skill.
const codexInstructions = readFileSync(path.join(root, "dist", "codex", ".codex", "AGENTS.md"), "utf8");
assert.match(codexInstructions, /SUBSTITUTE_JUSTIFICATION/);
assert.match(codexInstructions, /A test substitute is any non-real replacement/);
assert.doesNotMatch(codexInstructions, /## 04-cybersecurity\.mdc/);
assert.doesNotMatch(codexInstructions, /## 10-python\.mdc/);
const codexVerifyTest = readFileSync(path.join(root, "dist", "codex", ".agents", "skills", "verify-test", "SKILL.md"), "utf8");
assert.match(codexVerifyTest, /No substitute-backed proof on any path/);

const kiloPreviewConfig = JSON.parse(readFileSync(path.join(root, "dist", "kilo", ".config", "kilo", "kilo.jsonc"), "utf8"));
assert.deepEqual(kiloPreviewConfig.permission, { "*": "allow" });
assert.equal(kiloPreviewConfig.share, "disabled");
assert.equal(Object.hasOwn(kiloPreviewConfig, "skills"), false);

const ignoresCheck = run(["check", "ignores"]);
assert.match(ignoresCheck, /ignores check: ok/);
assert.match(ignoresCheck, /emitters 3 \(cline, cursor, kilo\)/);

// Read-only boss must not carry write/shell; worker must.
const bossWorker = [
  {
    boss: path.join(root, "dist", "claude-code", ".claude", "agents", "boss.md"),
    worker: path.join(root, "dist", "claude-code", ".claude", "agents", "worker.md"),
    bossOk: (t) => /^tools: Read, Glob, Grep$/m.test(t) && /^permissionMode: plan$/m.test(t),
    workerOk: (t) => /^tools: Read, Glob, Grep, Edit, Write, Bash$/m.test(t),
  },
  {
    boss: path.join(root, "dist", "codex", ".codex", "agents", "boss.toml"),
    worker: path.join(root, "dist", "codex", ".codex", "agents", "worker.toml"),
    bossOk: (t) => /^sandbox_mode = "read-only"$/m.test(t),
    workerOk: (t) => /^sandbox_mode = "danger-full-access"$/m.test(t),
  },
  {
    boss: path.join(root, "dist", "cline", ".cline", "agents", "boss.yaml"),
    worker: path.join(root, "dist", "cline", ".cline", "agents", "worker.yaml"),
    bossOk: (t) => /^ {2}- read_file$/m.test(t) && !/^ {2}- execute_command$/m.test(t),
    workerOk: (t) => /^ {2}- execute_command$/m.test(t) && /^ {2}- write_to_file$/m.test(t),
  },
  {
    boss: path.join(root, "dist", "kilo", ".config", "kilo", "agents", "boss.md"),
    worker: path.join(root, "dist", "kilo", ".config", "kilo", "agents", "worker.md"),
    bossOk: (t) => /^ {2}"\*": deny$/m.test(t) && /^ {2}"read": allow$/m.test(t),
    workerOk: (t) => /^ {2}"\*": allow$/m.test(t),
  },
  {
    boss: path.join(root, "dist", "kimi-code", "agents", "boss.md"),
    worker: path.join(root, "dist", "kimi-code", "agents", "worker.md"),
    bossOk: (t) => /^ {2}- "Read"$/m.test(t) && !/^ {2}- "Bash"$/m.test(t),
    workerOk: (t) => /^ {2}- "\*"$/m.test(t),
  },
];
for (const row of bossWorker) {
  assert.equal(row.bossOk(readFileSync(row.boss, "utf8")), true, `boss contract: ${row.boss}`);
  assert.equal(row.workerOk(readFileSync(row.worker, "utf8")), true, `worker contract: ${row.worker}`);
}

// First-party MCP auto-wire across host config families (sample of each shape).
const mcpAbs = {
  synapse: "~/.local/bin/synapse-bridge",
  grimoire: "~/.local/bin/grimoire-server",
};
const jsonMcpHosts = [
  [path.join(root, "dist", "droid", ".factory", "mcp.json"), "mcpServers"],
  [path.join(root, "dist", "claude-code", ".claude.json"), "mcpServers"],
  [path.join(root, "dist", "cline", ".cline", "data", "settings", "cline_mcp_settings.json"), "mcpServers"],
  [path.join(root, "dist", "kimi-code", "mcp.json"), "mcpServers"],
  [path.join(root, "dist", "cursor", ".cursor", "mcp.json"), "mcpServers"],
  [path.join(root, "dist", "openhands", ".openhands", "mcp.json"), "mcpServers"],
  [path.join(root, "dist", "vscode", vsCodeUserRoot("Code", { scope: "user" }), "mcp.json"), "servers"],
  [path.join(root, "dist", "zed", ".config", "zed", "settings.json"), "context_servers"],
];
for (const [file, rootKey] of jsonMcpHosts) {
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const servers = parsed[rootKey];
  assert.equal(servers.synapse.command, mcpAbs.synapse, file);
  assert.equal(servers.grimoire.command, mcpAbs.grimoire, file);
  assert.equal(Object.hasOwn(servers, "agentmemory"), false, file);
}
const kimiMcp = JSON.parse(readFileSync(path.join(root, "dist", "kimi-code", "mcp.json"), "utf8"));
assert.equal(Object.hasOwn(kimiMcp.mcpServers.synapse, "type"), false);
assert.doesNotMatch(
  readFileSync(path.join(root, "dist", "kimi-code", "skills", "ops-flow", "SKILL.md"), "utf8"),
  /^disableModelInvocation:/m,
);
assert.match(readFileSync(path.join(root, "dist", "kimi-code", "skills", "ops-nuke", "SKILL.md"), "utf8"), /^type: flow$/m);
assert.match(readFileSync(path.join(root, "dist", "kimi-code", "skills", "ops-nuke", "SKILL.md"), "utf8"), /^disableModelInvocation: true$/m);
assert.match(
  readFileSync(path.join(root, "dist", "kimi-code", "config.toml"), "utf8"),
  /^default_permission_mode = "auto"$/m,
);
assert.match(
  readFileSync(path.join(root, "dist", "kimi-code", "config.toml"), "utf8"),
  /^merge_all_available_skills = true$/m,
);
const kiloMcp = JSON.parse(readFileSync(path.join(root, "dist", "kilo", ".config", "kilo", "kilo.jsonc"), "utf8"));
assert.deepEqual(kiloMcp.mcp.synapse.command, [mcpAbs.synapse]);
assert.deepEqual(kiloMcp.mcp.grimoire.command, [mcpAbs.grimoire]);
const codexMcp = readFileSync(path.join(root, "dist", "codex", ".codex", "config.toml"), "utf8");
assert.match(codexMcp, /^approval_policy = "never"$/m);
assert.match(codexMcp, /^sandbox_mode = "danger-full-access"$/m);
assert.match(codexMcp, /\[mcp_servers\.synapse\]/);
assert.match(codexMcp, /\[mcp_servers\.grimoire\]/);
const gooseMcp = readFileSync(path.join(root, "dist", "goose", ".config", "goose", "config.yaml"), "utf8");
assert.match(gooseMcp, /^ {2}grimoire:/m);
assert.match(gooseMcp, /cmd: ~\/\.local\/bin\/grimoire-server/);

const mcpsDefaultPlan = run(["install", "--target", "vscodium", "--dest", "/tmp/agent-surface-f001", "--category", "mcps", "--dry-run"]);
assert.match(mcpsDefaultPlan, /MCP \+= grimoire, synapse/);

const targetsRegistry = JSON.parse(readFileSync(path.join(root, "registry", "targets.json"), "utf8"));
const generatedCheck = run(["check", "generated"]);
for (const target of Object.keys(targetsRegistry.in_scope)) {
  assert.match(generatedCheck, new RegExp(`^${target}: generated outputs \\d+ ok$`, "m"));
}
assert.match(run(["check", "subagents"]), /subagents check: ok/);

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

// Cursor cannot express read-write without shell; refuse, do not silently grant shell.
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

console.log("build: ok");
