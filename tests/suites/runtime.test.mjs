#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { files, run, status } from "../lib/helpers.mjs";

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

// Command-array redaction is a separate path from stdout/stderr text redaction.
const SENTINEL = "sentinel-sensitive-value-9f3c";
const argvRedactionCases = [
  {
    name: "space-separated token",
    args: ["--token", SENTINEL],
    expectTail: ["--token", "[REDACTED]"],
  },
  {
    name: "equals-form token",
    args: [`--token=${SENTINEL}`],
    expectTail: ["--token=[REDACTED]"],
  },
  {
    name: "leading-dash token value",
    args: ["--token", `-${SENTINEL}`],
    expectTail: ["--token", "[REDACTED]"],
  },
  {
    name: "compound access-token",
    args: ["--access-token", SENTINEL],
    expectTail: ["--access-token", "[REDACTED]"],
  },
  {
    name: "compound client-secret",
    args: ["--client-secret", SENTINEL],
    expectTail: ["--client-secret", "[REDACTED]"],
  },
  {
    name: "compound db-password",
    args: ["--db-password", SENTINEL],
    expectTail: ["--db-password", "[REDACTED]"],
  },
  {
    name: "adjacent secret options keep second value redacted",
    args: ["--token", "--password", SENTINEL],
    expectTail: ["--token", "--password", "[REDACTED]"],
  },
  {
    name: "mid-name secret segment aws-secret-access-key",
    args: ["--aws-secret-access-key", SENTINEL],
    expectTail: ["--aws-secret-access-key", "[REDACTED]"],
  },
  {
    name: "equals-form compound access-token",
    args: [`--access-token=${SENTINEL}`],
    expectTail: ["--access-token=[REDACTED]"],
  },
  {
    name: "double-dash token value",
    args: ["--token", `--${SENTINEL}`],
    expectTail: ["--token", "[REDACTED]"],
  },
];

for (const testCase of argvRedactionCases) {
  const dest = `/tmp/agent-surface-arg-secret-${testCase.name.replace(/\W+/g, "-")}`;
  rmSync(dest, { recursive: true, force: true });
  try {
    const output = run([
      "run",
      "--task",
      "T1",
      "--class",
      "read_only",
      "--timeout",
      "5000",
      "--out",
      dest,
      "--",
      process.execPath,
      "-e",
      "process.exit(0)",
      "--",
      ...testCase.args,
    ]);
    assert.match(output, /exit_code: 0/, testCase.name);
    const evidenceJson = files(dest).find((file) => file.endsWith(".evidence.json"));
    const evidence = JSON.parse(readFileSync(evidenceJson, "utf8"));
    if (!testCase.allowSentinel) {
      assert.equal(
        JSON.stringify(evidence.cmd).includes(SENTINEL),
        false,
        `${testCase.name}: sentinel leaked in cmd`,
      );
      assert.equal(evidence.redaction.patterns.includes("secret-flag"), true, testCase.name);
    }
    assert.deepEqual(
      evidence.cmd.slice(-testCase.expectTail.length),
      testCase.expectTail,
      testCase.name,
    );
    assert.match(evidence.cmd_hash_raw, /^sha256:/, testCase.name);
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
}

const fullConsentClassDest = "/tmp/agent-surface-full-consent-class";
rmSync(fullConsentClassDest, { recursive: true, force: true });
const fullConsentClass = status([
  "run",
  "--task",
  "T1",
  "--class",
  "deployment",
  "--timeout",
  "5000",
  "--out",
  fullConsentClassDest,
  "--",
  process.execPath,
  "-e",
  "process.exit(0)",
]);
assert.equal(fullConsentClass.status, 0, `${fullConsentClass.stdout}${fullConsentClass.stderr}`);
const fullConsentEvidenceJson = files(fullConsentClassDest).find((file) => file.endsWith(".evidence.json"));
const fullConsentEvidence = JSON.parse(readFileSync(fullConsentEvidenceJson, "utf8"));
assert.equal(fullConsentEvidence.class, "deployment");
assert.deepEqual(fullConsentEvidence.execution_consent, {
  mode: "full-access",
  source: "rules/00-precedence-and-safety.mdc",
});
assert.equal(Object.hasOwn(fullConsentEvidence, "approval"), false);
rmSync(fullConsentClassDest, { recursive: true, force: true });

console.log("runtime: ok");
