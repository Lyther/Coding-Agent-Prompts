// The `run` command: execute a verify command and capture tamper-evident evidence
// (redacted stdout/stderr, hashes, git tree, timing) for a workflow round. Secret
// redaction and command-class recording live here.
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { gitValue } from "./proc.mjs";
import { fail, requiredArgValue, safeFilename, safeTimestamp, sha256 } from "./util.mjs";

export async function runEvidence(args) {
  const separator = args.indexOf("--");
  if (separator === -1 || separator === args.length - 1) {
    fail("run requires -- before the command to execute");
  }

  const options = args.slice(0, separator);
  const command = args[separator + 1];
  const commandArgs = args.slice(separator + 2);
  const taskId = requiredArgValue(options, "--task");
  const klass = requiredArgValue(options, "--class");
  const timeoutMs = Number(requiredArgValue(options, "--timeout"));
  const outDir = path.resolve(requiredArgValue(options, "--out"));
  const allowedClasses = new Set(["read_only", "build_test", "network", "filesystem_destructive", "deployment", "database_mutation"]);

  if (!allowedClasses.has(klass)) fail(`unsupported command class: ${klass}`);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) fail("--timeout must be a positive integer");

  await mkdir(outDir, { recursive: true });

  const startedAt = new Date();
  const startedStamp = safeTimestamp(startedAt.toISOString());
  const basename = `${startedStamp}-${safeFilename(taskId)}`;
  const started = Date.now();
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;
  const stdoutRaw = result.stdout ?? "";
  const stderrRaw = result.stderr ?? (result.error ? `${result.error.message}\n` : "");
  const stdoutRedacted = redactEvidenceText(stdoutRaw);
  const stderrRedacted = redactEvidenceText(stderrRaw);
  const cmdRaw = [command, ...commandArgs];
  const cmdRedacted = redactEvidenceCmd(cmdRaw);
  const stdout = stdoutRedacted.text;
  const stderr = stderrRedacted.text;
  const stdoutPath = path.join(outDir, `${basename}.stdout.log`);
  const stderrPath = path.join(outDir, `${basename}.stderr.log`);
  const evidencePath = path.join(outDir, `${basename}.evidence.json`);
  const exitCode = typeof result.status === "number" ? result.status : result.error?.code === "ETIMEDOUT" ? 124 : 1;
  const evidence = {
    task_id: taskId,
    class: klass,
    cmd: cmdRedacted.cmd,
    cmd_hash_raw: `sha256:${sha256(JSON.stringify(cmdRaw))}`,
    cwd: process.cwd(),
    execution_consent: {
      mode: "full-access",
      source: "rules/00-precedence-and-safety.mdc",
    },
    timeout_ms: timeoutMs,
    exit_code: exitCode,
    signal: result.signal ?? null,
    timed_out: result.error?.code === "ETIMEDOUT",
    started_at: startedAt.toISOString(),
    duration_ms: durationMs,
    tree_hash: gitValue(["rev-parse", "HEAD^{tree}"]),
    stdout_ref: path.relative(process.cwd(), stdoutPath),
    stdout_hash: `sha256:${sha256(stdout)}`,
    stdout_raw_hash: `sha256:${sha256(stdoutRaw)}`,
    stdout_raw_stored: false,
    stderr_ref: path.relative(process.cwd(), stderrPath),
    stderr_hash: `sha256:${sha256(stderr)}`,
    stderr_raw_hash: `sha256:${sha256(stderrRaw)}`,
    stderr_raw_stored: false,
    redaction: {
      applied: stdoutRedacted.applied || stderrRedacted.applied || cmdRedacted.applied,
      patterns: [...new Set([...stdoutRedacted.patterns, ...stderrRedacted.patterns, ...cmdRedacted.patterns])],
    },
  };

  await writeFile(stdoutPath, stdout);
  await writeFile(stderrPath, stderr);
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(`evidence: ${evidence.stdout_ref}`);
  console.log(`metadata: ${path.relative(process.cwd(), evidencePath)}`);
  console.log(`exit_code: ${exitCode}`);
  process.exitCode = exitCode;
}

const SECRET_NAME_SEGMENTS = new Set(["secret", "token", "password", "passwd", "pwd", "apikey"]);
// Single-dash options are only the bare secret names. Opaque values like
// `-sentinel-secret-value` must not be classified as options.
const SHORT_SECRET_OPTION_NAME = /^(?:api[_-]?key|secret|token|password|passwd|pwd)$/i;

/** True for --token, --access-token, --client-secret, --aws-secret-access-key, etc. */
function isSecretOptionName(name) {
  const parts = String(name).toLowerCase().split(/[-_]+/).filter(Boolean);
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (SECRET_NAME_SEGMENTS.has(part)) return true;
    if (part === "api" && parts[i + 1] === "key") return true;
  }
  return false;
}

function parseSecretOption(part) {
  const eq = /^(--?)([^=]+)=(.*)$/.exec(part);
  if (eq) {
    const allowed = eq[1] === "--" ? isSecretOptionName(eq[2]) : SHORT_SECRET_OPTION_NAME.test(eq[2]);
    if (allowed) return { kind: "eq", prefix: eq[1], name: eq[2] };
  }
  const flag = /^(--?)(.+)$/.exec(part);
  if (flag && !part.includes("=")) {
    const allowed = flag[1] === "--" ? isSecretOptionName(flag[2]) : SHORT_SECRET_OPTION_NAME.test(flag[2]);
    if (allowed) return { kind: "flag", prefix: flag[1], name: flag[2] };
  }
  return null;
}

function redactEvidenceText(value) {
  const patterns = [];
  let text = value;
  const replacements = [
    {
      name: "authorization-header",
      pattern: /(Authorization:\s*(?:Bearer|Basic)\s+)[^\s\r\n]+/gi,
      replacement: "$1[REDACTED]",
    },
    {
      name: "cookie-header",
      pattern: /(Cookie:\s*)[^\r\n]+/gi,
      replacement: "$1[REDACTED]",
    },
    {
      name: "secret-assignment",
      pattern: /\b(api[_-]?key|secret|token|password|passwd|pwd)\b(\s*[:=]\s*)(["']?)[^\s'"]+\3/gi,
      replacement: "$1$2$3[REDACTED]$3",
    },
    {
      name: "private-key-block",
      pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
      replacement: "[REDACTED PRIVATE KEY]",
    },
    {
      name: "url-credential",
      pattern: /:\/\/[^\/\s:@]+:[^\/\s:@]+@/g,
      replacement: "://[REDACTED]@",
    },
  ];

  for (const replacement of replacements) {
    const next = text.replace(replacement.pattern, replacement.replacement);
    if (next !== text) {
      patterns.push(replacement.name);
      text = next;
    }
  }

  return { text, applied: patterns.length > 0, patterns };
}

/** Redact secret option values in argv (`--token x`, `--token=-x`, `--access-token x`). */
function redactEvidenceCmd(cmdRaw) {
  const patterns = [];
  const cmd = [];
  for (let i = 0; i < cmdRaw.length; i += 1) {
    const part = cmdRaw[i];
    const opt = parseSecretOption(part);

    if (opt?.kind === "eq") {
      cmd.push(`${opt.prefix}${opt.name}=[REDACTED]`);
      patterns.push("secret-flag");
      continue;
    }

    if (opt?.kind === "flag") {
      cmd.push(part);
      const next = i + 1 < cmdRaw.length ? cmdRaw[i + 1] : null;
      // Values are opaque and may look like options. Only another recognized secret
      // option is structural enough to process separately.
      if (next !== null && parseSecretOption(next) === null) {
        cmd.push("[REDACTED]");
        patterns.push("secret-flag");
        i += 1;
      }
      continue;
    }

    const textPart = redactEvidenceText(part);
    patterns.push(...textPart.patterns);
    cmd.push(textPart.text);
  }
  return { cmd, applied: patterns.length > 0, patterns };
}
