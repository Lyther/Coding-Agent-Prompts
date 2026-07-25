#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { root } from "../lib/helpers.mjs";

const workflowRuntime = readFileSync(path.join(root, "commands", "workflow-runtime.md"), "utf8");
const precedenceRule = readFileSync(path.join(root, "rules", "00-precedence-and-safety.mdc"), "utf8");
const opsNukeCommand = readFileSync(path.join(root, "commands", "ops-nuke.md"), "utf8");
const alwaysOnRuleText = readdirSync(path.join(root, "rules"))
  .filter((name) => name.endsWith(".mdc"))
  .map((name) => readFileSync(path.join(root, "rules", name), "utf8"))
  .filter((text) => /^alwaysApply:\s*true$/m.test(text))
  .join("\n");

// Full-execution consent is owned by always-on rules. Do not concatenate every
// command body into one ban-list — lint-kernel legitimately documents a gated
// send-email step as "awaiting explicit user authorization".
assert.match(precedenceRule, /^## Full-Execution Consent$/m);
assert.match(precedenceRule, /operator policy for this distribution is `full access` \/ `never ask`/);
assert.match(precedenceRule, /Do not request manual approval solely because an operation/);
assert.doesNotMatch(precedenceRule, /^## Approval Classes$/m);
assert.doesNotMatch(precedenceRule, /Explicit approval is required for:/);
assert.doesNotMatch(alwaysOnRuleText, /without explicit (?:user )?approval/i);
assert.doesNotMatch(alwaysOnRuleText, /explicit approval is required/i);
assert.doesNotMatch(alwaysOnRuleText, /pending user approval|awaiting explicit user authorization|green light/i);

// ops-nuke: dry-run + explicit deletion approval before destructive work.
assert.match(opsNukeCommand, /Dry-Run First|dry-run/i);
assert.match(opsNukeCommand, /Approval Gate|user approves the deletion manifest/i);

assert.match(workflowRuntime, /^## PHASE GATE - EVALUATE FIRST$/m);
assert.match(workflowRuntime, /Do not call any tool, including shell, file-read, MCP, search, or `echo`/);
assert.match(workflowRuntime, /--phase inspect\|discovery\|materialization\|mcp\|full/);
assert.match(workflowRuntime, /BLOCKED: external_driver_required/);
assert.match(workflowRuntime, /\| Cline \| workflow Markdown \| `\/<name>` \|/);
assert.doesNotMatch(workflowRuntime, /Invoke a generated workflow as `\/<name>\.md`/);
assert.match(workflowRuntime, /require `share` to be exactly `disabled`/);

console.log("policy: ok");
