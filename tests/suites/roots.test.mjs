#!/usr/bin/env node
import assert from "node:assert/strict";
import { ideUserDataRoot, vsCodeUserRoot } from "../../scripts/agent-surface/roots.mjs";

assert.equal(
  ideUserDataRoot("Code", { platform: "win32", appData: "D:\\Profiles\\agent\\AppData\\Roaming" }),
  "D:\\Profiles\\agent\\AppData\\Roaming\\Code",
);
assert.equal(
  ideUserDataRoot("Code", { platform: "win32", appData: "D:\\Relocated", relocateExternalRoutes: true }),
  "AppData\\Roaming\\Code",
);
assert.equal(
  vsCodeUserRoot("Code", { platform: "win32", appData: "D:\\Relocated" }),
  "AppData\\Roaming\\Code\\User",
);
console.log("roots: ok");
