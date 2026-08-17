#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { root } from "../lib/helpers.mjs";

const lockfiles = [
  "package-lock.json",
  "mcps/synapse/package-lock.json",
  "mcps/grimoire/package-lock.json",
];

// Independent security thresholds from the reviewed advisories, not from current output:
// GHSA-7p8r-x3mc-p8w7 patches fast-uri's host-confusion flaw in 3.1.5.
// GHSA-mwp4-54f8-5fhr patches ip-address's leading-zero SSRF bypass in 10.3.1.
const advisoryFloors = new Map([
  ["fast-uri", { version: "3.1.5", advisory: "GHSA-7p8r-x3mc-p8w7" }],
  ["ip-address", { version: "10.3.1", advisory: "GHSA-mwp4-54f8-5fhr" }],
]);

function versionTuple(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  assert.ok(match, `expected an exact three-part dependency version, got ${JSON.stringify(version)}`);
  return match.slice(1).map(Number);
}

function versionAtLeast(version, floor) {
  const current = versionTuple(version);
  const minimum = versionTuple(floor);
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index];
  }
  return true;
}

const seenIn = new Map([...advisoryFloors].map(([name]) => [name, new Set()]));
const violations = [];

for (const relativePath of lockfiles) {
  const lock = JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
  assert.ok(lock.packages && typeof lock.packages === "object", `${relativePath}: no packages map`);

  for (const [packagePath, metadata] of Object.entries(lock.packages)) {
    for (const [name, floor] of advisoryFloors) {
      if (packagePath !== `node_modules/${name}` && !packagePath.endsWith(`/node_modules/${name}`)) {
        continue;
      }
      assert.equal(typeof metadata.version, "string", `${relativePath}:${packagePath}: no version`);
      seenIn.get(name).add(relativePath);
      if (!versionAtLeast(metadata.version, floor.version)) {
        violations.push(
          `${relativePath}: ${name} ${metadata.version} < ${floor.version} (${floor.advisory})`,
        );
      }
    }
  }
}

assert.deepEqual(
  [...seenIn.get("fast-uri")],
  lockfiles,
  "fast-uri must be inspected in every lock",
);
assert.deepEqual(
  [...seenIn.get("ip-address")],
  lockfiles.slice(1),
  "ip-address must be inspected in both MCP locks",
);
assert.deepEqual(
  violations,
  [],
  `dependency advisory floors violated:\n${violations.map((item) => `- ${item}`).join("\n")}`,
);

function assertTlsInstallSafe(source, label) {
  const commands = source
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .flatMap((line) => line.split(";"))
    .map((command) => command.trim())
    .filter(Boolean);
  const clearTlsOverrideAt = commands.findIndex((command) => /^unset\s+NODE_TLS_REJECT_UNAUTHORIZED$/.test(command));
  const dependencyInstallAt = commands.findIndex((command) => /^(?:then|else)\s+npm\s+(?:ci|install)\b|^npm\s+(?:ci|install)\b/.test(command));
  assert.ok(dependencyInstallAt >= 0, `${label}: must contain an npm dependency install command`);
  assert.ok(clearTlsOverrideAt >= 0, `${label}: must clear NODE_TLS_REJECT_UNAUTHORIZED`);
  assert.ok(clearTlsOverrideAt < dependencyInstallAt, `${label}: must clear NODE_TLS_REJECT_UNAUTHORIZED before npm resolves dependencies`);
  assert.equal(
    commands.some((command) => /(?:^|\s)(?:export\s+)?NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*0(?=\s|$)/.test(command)),
    false,
    `${label}: must not disable npm TLS verification`,
  );
}

for (const relativePath of ["mcps/synapse/install.sh", "mcps/grimoire/install.sh"]) {
  assertTlsInstallSafe(readFileSync(path.join(root, relativePath), "utf8"), relativePath);
}

// SUBSTITUTE_JUSTIFICATION
// - substitute: inline unsafe shell snippets
// - replaces: destructive mutation of the repository installer scripts
// - necessity: the static gate must prove it rejects missing, commented, late, and disabling commands
// - real-option: the real scripts provide the positive case but cannot provide invalid cases without being corrupted
// - proof-limit: proves static command recognition, not npm network behavior
// - real-proof: both real install scripts are checked above and exercised by their live installer runs
assert.throws(() => assertTlsInstallSafe("unset NODE_TLS_REJECT_UNAUTHORIZED\n# npm ci\n", "comment-only"));
assert.throws(() => assertTlsInstallSafe("npm ci\nunset NODE_TLS_REJECT_UNAUTHORIZED\n", "late-clear"));
assert.throws(() => assertTlsInstallSafe("unset NODE_TLS_REJECT_UNAUTHORIZED\nNODE_TLS_REJECT_UNAUTHORIZED=0\nnpm ci\n", "disabled"));

console.log("dependency-security: ok");
