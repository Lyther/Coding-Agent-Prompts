#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { kimiCodeCursorSettingsPath, kimiCodeVsCodeSettingsPath } from "../../scripts/agent-surface/roots.mjs";
import {
  clineUserMcpRoutes,
  hasLocalOpsServerCommand,
  root,
  run, status,
} from "../lib/helpers.mjs";

function dryRun(target, extra = []) {
  return run(["install", "--target", target, "--dest", `/tmp/agent-surface-${target}`, ...extra, "--dry-run"]);
}

function planHas(plan, patterns, label) {
  for (const pattern of patterns) {
    assert.match(plan, pattern, `${label}: ${pattern}`);
  }
}

function planLacks(plan, patterns, label) {
  for (const pattern of patterns) {
    assert.doesNotMatch(plan, pattern, `${label}: !${pattern}`);
  }
}

// Representative dry-run contracts (not a per-path laundry list for every host).
const clinePlan = dryRun("cline");
planHas(clinePlan, [
  /^target: cline$/m,
  /\.clinerules\/workflows\/workflow-boss\.md <- commands\/workflow-boss\.md/,
  /\.clinerules\/agent-surface\.md <- rules\/\*\.mdc/,
  /\.cline\/agents\/boss\.yaml <- subagents\/boss\.md/,
  /\.agent-surface\/cline-manifest\.json/,
], "cline");
planLacks(clinePlan, [/cline_mcp_settings\.json MCP/], "cline");

const clineUserMcpPlan = run([
  "install", "--target", "cline", "--scope", "user", "--dest", "/tmp/agent-surface-cline-user-mcp",
  "--category", "mcps", "--dry-run",
]);
planHas(clineUserMcpPlan, [
  /\.cline\/data\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/,
  /Code\/User\/globalStorage\/saoudrizwan\.claude-dev\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/,
], "cline user mcps");
planLacks(clineUserMcpPlan, [/\.cline\/mcp\.json/], "cline user mcps");

const kiloPlan = dryRun("kilo");
planHas(kiloPlan, [
  /\.kilo\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/,
  /\.kilo\/rules\/00-precedence-and-safety\.md <- rules\/00-precedence-and-safety\.mdc/,
  /\.kilo\/agents\/boss\.md <- subagents\/boss\.md/,
  /kilo\.jsonc instructions \+= \.kilo\/rules\/00-precedence-and-safety\.md/,
], "kilo");
planLacks(kiloPlan, [/^  AGENTS\.md <- rules\/\*\.mdc$/m, /kilo\.jsonc instructions \+= .*14-shell/], "kilo");

const kimiCodePlan = dryRun("kimi-code");
planHas(kimiCodePlan, [
  /\.kimi-code\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/,
  /\.kimi-code\/agents\/boss\.md <- subagents\/boss\.md/,
  /\.kimi-code\/config\.toml default_permission_mode := "auto"/,
  /\.kimi-code\/mcp\.json MCP \+= grimoire, synapse/,
], "kimi-code");

const geminiPlan = status(["install", "--target", "gemini-cli", "--dest", "/tmp/agent-surface-gemini", "--dry-run"]);
assert.notEqual(geminiPlan.status, 0);
assert.match(`${geminiPlan.stdout}${geminiPlan.stderr}`, /unsupported install target: gemini-cli/);

for (const [target, patterns] of [
  ["claude-code", [/\.claude\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/, /\.claude\/agents\/boss\.md <- subagents\/boss\.md/]],
  ["cursor", [/\.cursor\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/, /\.cursor\/agents\/boss\.md <- subagents\/boss\.md/]],
  ["droid", [/\.factory\/commands\/workflow-boss\.md <- commands\/workflow-boss\.md/, /\.factory\/mcp\.json MCP \+= grimoire, synapse/, /karpathy-guidelines\/SKILL\.md/]],
  ["codex", [/\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/]],
  ["openhands", [/\.agents\/skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/]],
  ["antigravity-cli", [/config\/plugins\/agent-surface\/skills\/workflow-boss\.md <- commands\/workflow-boss\.md/]],
]) {
  planHas(dryRun(target), patterns, target);
}

// OpenHands MCP is user-scope only on project dry-run.
planLacks(dryRun("openhands"), [/\.openhands\/mcp\.json MCP/], "openhands project");

// Goose user-scope: MCP only, no project recipes into $HOME.
const gooseUserPlan = run(["install", "--target", "goose", "--scope", "user", "--allow-scope-root", "--dry-run"]);
assert.match(gooseUserPlan, /\.config\/goose\/config\.yaml MCP/);
assert.doesNotMatch(gooseUserPlan, /recipes\//);

// --category mcps across all targets must succeed; non-MCP hosts report non-applicable.
{
  const mcpsAllPlan = run(["install", "--target", "all", "--scope", "user", "--allow-scope-root", "--category", "mcps", "--dry-run"], {
    env: { ...process.env, HOME: "/tmp/agent-surface-mcps-all-home" },
  });
  assert.match(mcpsAllPlan, /MCP \+= grimoire, synapse/);
}
const piCopilotStatus = status(["install", "--target", "pi,copilot", "--scope", "user", "--allow-scope-root", "--category", "mcps", "--dry-run"]);
assert.notEqual(piCopilotStatus.status, 0);

// Strict-sync: prune managed external skill that is no longer generated.
const syncDest = "/tmp/agent-surface-strict-sync";
rmSync(syncDest, { recursive: true, force: true });
const ghostRel = path.join(".factory", "skills", "ghost-descoped-skill", "SKILL.md");
const ghostPath = path.join(syncDest, ghostRel);
mkdirSync(path.dirname(ghostPath), { recursive: true });
writeFileSync(ghostPath, "---\nname: ghost-descoped-skill\ndescription: removed upstream\n---\nbody\n");
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
assert.match(syncPlan, /\.factory\/skills\/ghost-descoped-skill\/SKILL\.md/);
assert.match(syncPlan, /\.factory\/skills\/karpathy-guidelines\/SKILL\.md/);
rmSync(syncDest, { recursive: true, force: true });

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

const kimiCodeDest = "/tmp/agent-surface-kimi-code-live";
rmSync(kimiCodeDest, { recursive: true, force: true });
const kimiCodeVsCodeSettings = path.join(
  kimiCodeDest,
  kimiCodeVsCodeSettingsPath({ scope: "user", relocateExternalRoutes: true }),
);
const kimiCodeCursorSettings = path.join(
  kimiCodeDest,
  kimiCodeCursorSettingsPath({ scope: "user", relocateExternalRoutes: true }),
);
mkdirSync(path.dirname(kimiCodeVsCodeSettings), { recursive: true });
mkdirSync(path.dirname(kimiCodeCursorSettings), { recursive: true });
writeFileSync(
  path.join(kimiCodeDest, "config.toml"),
  'default_permission_mode = "manual"\ntelemetry = false\n\n[providers.local]\nmodel = "keep-me"\n',
);
writeFileSync(
  path.join(kimiCodeDest, "mcp.json"),
  `${JSON.stringify({ mcpServers: { existing: { command: "keep-existing", args: ["--ok"] } } }, null, 2)}\n`,
);
writeFileSync(kimiCodeVsCodeSettings, `${JSON.stringify({ "workbench.colorTheme": "Keep Me" }, null, 2)}\n`);
writeFileSync(kimiCodeCursorSettings, `${JSON.stringify({ "editor.fontSize": 15 }, null, 2)}\n`);
run(["install", "--target", "kimi-code", "--scope", "user", "--dest", kimiCodeDest]);
const kimiCodeConfig = readFileSync(path.join(kimiCodeDest, "config.toml"), "utf8");
assert.match(kimiCodeConfig, /^default_permission_mode = "auto"$/m);
assert.match(kimiCodeConfig, /^telemetry = false$/m);
assert.match(kimiCodeConfig, /^\[providers\.local\]$/m);
assert.match(kimiCodeConfig, /^model = "keep-me"$/m);
const kimiCodeMcp = JSON.parse(readFileSync(path.join(kimiCodeDest, "mcp.json"), "utf8"));
assert.equal(kimiCodeMcp.mcpServers.existing.command, "keep-existing");
assert.equal(kimiCodeMcp.mcpServers.synapse.command, path.join(os.homedir(), ".local", "bin", "synapse-bridge"));
assert.equal(Object.hasOwn(kimiCodeMcp.mcpServers.synapse, "type"), false);
assert.deepEqual(JSON.parse(readFileSync(kimiCodeVsCodeSettings, "utf8")), {
  "workbench.colorTheme": "Keep Me",
  "kimi.yoloMode": true,
});
assert.deepEqual(JSON.parse(readFileSync(kimiCodeCursorSettings, "utf8")), {
  "editor.fontSize": 15,
  "kimi.yoloMode": true,
});
assert.match(
  readFileSync(path.join(kimiCodeDest, "skills", "workflow-boss", "SKILL.md"), "utf8"),
  /^disableModelInvocation: true$/m,
);
const kimiCodeMcpOnlyPlan = run([
  "install", "--target", "kimi-code", "--scope", "user", "--dest", kimiCodeDest, "--category", "mcps", "--dry-run",
]);
assert.doesNotMatch(kimiCodeMcpOnlyPlan, /default_permission_mode :=/);
assert.doesNotMatch(kimiCodeMcpOnlyPlan, /kimi\.yoloMode :=/);
rmSync(kimiCodeDest, { recursive: true, force: true });

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
assert.match(clineUserScope.stdout, /Documents\/Cline\/Workflows\/workflow-boss\.md <- commands\/workflow-boss\.md/);
assert.match(clineUserScope.stdout, /Documents\/Cline\/Rules\/agent-surface\.md <- rules\/\*\.mdc/);
assert.match(clineUserScope.stdout, /\.cline\/agents\/boss\.yaml <- subagents\/boss\.md/);
assert.match(clineUserScope.stdout, /\.cline\/skills\/karpathy-guidelines\/SKILL\.md/);
assert.match(clineUserScope.stdout, /\.cline\/data\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);
assert.match(clineUserScope.stdout, /Code\/User\/globalStorage\/saoudrizwan\.claude-dev\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);
assert.match(clineUserScope.stdout, /Cursor\/User\/globalStorage\/saoudrizwan\.claude-dev\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);
assert.match(clineUserScope.stdout, /Windsurf\/User\/globalStorage\/saoudrizwan\.claude-dev\/settings\/cline_mcp_settings\.json MCP \+= grimoire, synapse/);

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
assert.match(kiloUserScope.stdout, /kilo\.jsonc permission := \{"\*":"allow"\}/);
assert.match(kiloUserScope.stdout, /kilo\.jsonc share := "disabled"/);
assert.match(kiloUserScope.stdout, /\.kilocodeignore \(project-scope only\)/);
assert.doesNotMatch(kiloUserScope.stdout, /\.kilocodeignore <- ignores/);

const kimiCodeHome = path.join(userScopeHome, "custom-kimi-home");
const kimiCodeUserScope = status(["install", "--target", "kimi-code", "--scope", "user", "--dry-run"], {
  env: { ...userScopeEnv, KIMI_CODE_HOME: kimiCodeHome },
});
assert.equal(kimiCodeUserScope.status, 0, `${kimiCodeUserScope.stdout}${kimiCodeUserScope.stderr}`);
assert.match(kimiCodeUserScope.stdout, new RegExp(`^root: ${kimiCodeHome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
assert.match(kimiCodeUserScope.stdout, /skills\/workflow-boss\/SKILL\.md <- commands\/workflow-boss\.md/);
assert.match(kimiCodeUserScope.stdout, /^  config\.toml default_permission_mode := "auto"$/m);
assert.match(kimiCodeUserScope.stdout, /^  mcp\.json MCP \+= grimoire, synapse$/m);
assert.match(kimiCodeUserScope.stdout, /Code\/User\/settings\.json kimi\.yoloMode := true/);
assert.match(kimiCodeUserScope.stdout, /Cursor\/User\/settings\.json kimi\.yoloMode := true/);

const claudeUserScope = status(["install", "--target", "claude-code", "--scope", "user", "--dry-run"], { env: userScopeEnv });
assert.equal(claudeUserScope.status, 0, `${claudeUserScope.stdout}${claudeUserScope.stderr}`);
assert.doesNotMatch(claudeUserScope.stdout, /\.mcp\.json/);
assert.match(claudeUserScope.stdout, /\.claude\/skills\/ops-ask\/SKILL\.md <- commands\/ops-ask\.md/);
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
assert.match(mergedKiloConfig, /"permission": \{\s*"\*": "allow"\s*\}/);
assert.match(mergedKiloConfig, /"share": "disabled"/);
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
assert.deepEqual(inlineKiloConfig.permission, { "*": "allow" });
assert.equal(inlineKiloConfig.share, "disabled");
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
    assert.deepEqual(
      migratedClineManifest.config_entries,
      clineUserMcpRoutes.map((route) => ({ path: route, format: "mcpServers", ids: ["grimoire", "synapse"] })),
    );
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

/*
SUBSTITUTE_JUSTIFICATION
- substitute: disposable install roots with a symlinked target namespace, predictable manifest temp route, and tampered ownership manifest
- replaces: malformed or locally modified user host profiles at the config filesystem boundary
- necessity: deterministic path redirection and manifest-route tampering cannot be introduced into a real profile without risking unrelated user configuration
- real-option: a live user-scope install was considered, but intentionally redirecting or falsifying its config ownership is destructive and cannot safely serve these assertions
- proof-limit: these cases prove installer rejection and non-mutation only; they do not prove host loading or MCP task execution
- real-proof: BLOCKED: requires an isolated OS account with disposable real host profiles and independently observed host startup
*/
{
  const dest = mkdtempSync("/tmp/agent-surface-config-symlink-");
  const outside = mkdtempSync("/tmp/agent-surface-config-outside-");
  try {
    symlinkSync(outside, path.join(dest, ".cursor"), "dir");
    const redirectedInstall = status(["install", "--target", "cursor", "--dest", dest, "--dry-run"]);
    assert.notEqual(redirectedInstall.status, 0);
    assert.match(
      `${redirectedInstall.stdout}${redirectedInstall.stderr}`,
      /MCP config .* traverses symbolic link/,
    );
    assert.equal(existsSync(path.join(outside, "mcp.json")), false);
  } finally {
    rmSync(dest, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}

{
  const dest = mkdtempSync("/tmp/agent-surface-manifest-temp-");
  const outside = mkdtempSync("/tmp/agent-surface-manifest-temp-outside-");
  try {
    mkdirSync(path.join(dest, ".agent-surface"), { recursive: true });
    const outsidePath = path.join(outside, "unrelated.txt");
    writeFileSync(outsidePath, "preserve\n");
    symlinkSync(outsidePath, path.join(dest, ".agent-surface", "cursor-manifest.json.tmp"));
    run(["install", "--target", "cursor", "--dest", dest]);
    assert.equal(readFileSync(outsidePath, "utf8"), "preserve\n");
    assert.equal(
      JSON.parse(readFileSync(path.join(dest, ".agent-surface", "cursor-manifest.json"), "utf8")).target,
      "cursor",
    );
  } finally {
    rmSync(dest, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}

{
  const dest = mkdtempSync("/tmp/agent-surface-config-manifest-");
  try {
    mkdirSync(path.join(dest, ".agent-surface"), { recursive: true });
    mkdirSync(path.join(dest, ".ssh"), { recursive: true });
    const unrelatedPath = path.join(dest, ".ssh", "config");
    const unrelatedContent = `${JSON.stringify({ mcpServers: { synapse: { command: "keep" } } }, null, 2)}\n`;
    writeFileSync(unrelatedPath, unrelatedContent);
    writeFileSync(
      path.join(dest, ".agent-surface", "cursor-manifest.json"),
      `${JSON.stringify({
        target: "cursor",
        scope: "project",
        managed: [],
        config_entries: [{ path: ".ssh/config", format: "mcpServers", ids: ["synapse"] }],
      }, null, 2)}\n`,
    );
    const tamperedManifestInstall = status(["install", "--target", "cursor", "--dest", dest, "--dry-run"]);
    assert.notEqual(tamperedManifestInstall.status, 0);
    assert.match(
      `${tamperedManifestInstall.stdout}${tamperedManifestInstall.stderr}`,
      /untrusted obsolete MCP config route in manifest: \.ssh\/config/,
    );
    assert.equal(readFileSync(unrelatedPath, "utf8"), unrelatedContent);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
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
    'approval_policy = "on-request"',
    'sandbox_mode = "workspace-write"',
    "",
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
assert.match(mergedCodexMcp, /^approval_policy = "on-request"$/m);
assert.match(mergedCodexMcp, /^sandbox_mode = "workspace-write"$/m);
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
    target: "kilo", rel: "kilo.jsonc", root: "mcp", pre: { $schema: "keep", permission: "ask", share: "auto", mcp: { existing: { type: "local", command: ["local-existing"], enabled: true } } },
    keep: (parsed) => {
      assert.equal(parsed.$schema, "keep", "kilo $schema preserved");
      assert.equal(parsed.permission, "ask", "kilo MCP-only install preserves host permission");
      assert.equal(parsed.share, "auto", "kilo MCP-only install preserves host sharing");
    }
  },
  {
    target: "opencode", rel: ".opencode/opencode.json", root: "mcp", pre: { $schema: "keep", permission: "ask", share: "auto", mcp: { existing: { type: "local", command: ["local-existing"], enabled: true } } },
    keep: (parsed) => {
      assert.equal(parsed.$schema, "keep", "opencode $schema preserved");
      assert.equal(parsed.permission, "ask", "opencode MCP-only install preserves host permission");
      assert.equal(parsed.share, "auto", "opencode MCP-only install preserves host sharing");
    }
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
    if (["kilo", "opencode"].includes(fx.target)) {
      assert.doesNotMatch(firstPlan, /permission :=|share :=/, `${fx.target}: MCP-only dry-run must not mutate execution policy`);
    }
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

{
  const dest = mkdtempSync("/tmp/agent-surface-codex-full-");
  try {
    run(["install", "--target", "codex", "--dest", dest]);
    const config = readFileSync(path.join(dest, ".codex", "config.toml"), "utf8");
    assert.match(config, /^approval_policy = "never"$/m);
    assert.match(config, /^sandbox_mode = "danger-full-access"$/m);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

assert.match(readFileSync(path.join(root, ".gitignore"), "utf8"), /^commands\/ops-server\.md$/m);
if (hasLocalOpsServerCommand) {
  execFileSync("git", ["check-ignore", "commands/ops-server.md"], { cwd: root, encoding: "utf8" });
}
assert.match(readFileSync(path.join(root, ".npmignore"), "utf8"), /^external\/\*$/m);

console.log("install: ok");
