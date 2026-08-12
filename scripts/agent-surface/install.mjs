// Output materialization: `build` renders the full target set into dist/, and
// `install` plans + applies a target's outputs (with strict-sync stale removal
// and MCP/Kilo config merges) into a host root. Both drive the shared producer
// engine in targets.mjs; neither owns rendering or validation.
import { randomUUID } from "node:crypto";
import { lstat, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { exportableCatalog, localCommandOverlays, outputSourceKindError, requireKnownSourceKind } from "./check.mjs";
import { readFileIfExists, readJsonIfExists, removeTree } from "./io.mjs";
import { mergeKiloInstructionJsonc, parseJsoncResult, setJsoncRootProperty } from "./jsonc.mjs";
import { YAML_MCP_FORMATS, mergeCodexMcpToml, mergeJsonMcpConfig, mergeYamlMcpConfig, optionalServiceMcpServers, renderMcpConfig } from "./merge.mjs";
import { packageVersion, readSourceKinds, relative, root } from "./registry.mjs";
import { readRules } from "./rules.mjs";
import { adapterMcpConfigs, kiloRuleInstructionPaths, mcpConfigScopeAllows, outputAppliesToCategory, outputAppliesToScope, outputRootFor, selectedMcpServiceEntries, targetOutputs, targets } from "./targets.mjs";
import { argValue, argValues, fail, isPathInside, isSafeRelativePath, isSafeTargetName, splitArgValues, uniqueStrings } from "./util.mjs";

export async function build(args) {
  const target = argValue(args, "--target") ?? "all";
  const dryRun = args.includes("--dry-run");

  if (target !== "all") {
    if (!isSafeTargetName(target)) fail(`unsafe build target: ${target}`);
    if (!Object.hasOwn(targets, target)) fail(`unsupported build target: ${target}`);
  }

  const selected = target === "all" ? Object.keys(targets) : [target];
  const catalog = await exportableCatalog();

  if (!dryRun) {
    await removeTree(path.join(root, "dist", target === "all" ? "" : target));
  }

  for (const item of selected) {
    const adapter = targets[item];
    const sourceKindsConfig = await readSourceKinds();
    const outputs = await targetOutputs(adapter, catalog, { target: item, scope: "user", mode: "build" });
    const sourceKindErrors = [];
    for (const output of outputs) {
      requireKnownSourceKind(output, sourceKindsConfig, sourceKindErrors);
    }
    if (sourceKindErrors.length > 0) fail(sourceKindErrors.join("; "));

    for (const output of outputs) {
      const targetPath = path.join(root, "dist", item, output.relativeOutput);
      if (dryRun) {
        console.log(`[dry-run] ${adapter.label}: ${output.source} -> ${relative(targetPath)}`);
        continue;
      }

      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, output.content);
    }

    console.log(`${item}: ${outputs.length} outputs rendered${dryRun ? " (dry-run)" : ""}`);
  }
}

export async function install(args) {
  const selectedTargets = selectedInstallTargets(args);
  const scope = argValue(args, "--scope") ?? "project";
  const dryRun = args.includes("--dry-run");
  const allowScopeRoot = args.includes("--allow-scope-root");
  const dest = argValue(args, "--dest");
  const categoryFilter = installCategoryFilter(args);
  const optionalServices = optionalServiceFilter(args);
  const agentName = argValue(args, "--agent") ?? "agent";

  if (!["project", "user"].includes(scope)) fail(`unsupported install scope: ${scope}`);
  if (!isSafeTargetName(agentName)) fail(`unsafe --agent: ${agentName}`);
  if (optionalServices && !categoryFilter?.has("mcps")) {
    fail("--service currently applies only to --category mcps");
  }
  if (!dryRun && !dest && !allowScopeRoot) {
    fail("live install requires explicit --dest or --allow-scope-root after reviewing --dry-run");
  }

  const plans = [];
  for (const target of selectedTargets) {
    const adapter = targets[target];
    if (!adapter) fail(`unsupported install target: ${target}`);
    const installRoot = dest ? path.resolve(dest) : adapter.installRoot(scope);
    if (installRoot === path.parse(installRoot).root) fail("install root cannot be filesystem root");
    plans.push(await installPlan(target, adapter, installRoot, scope, dest ? "explicit --dest" : "scope-derived root", {
      agentName,
      categoryFilter,
      optionalServices,
    }));
  }
  addCrossPlanInstallConflicts(plans);

  const blocked = plans.flatMap((plan) => plan.blocked.map((item) => `${plan.target}: ${item}`));
  // A category-filtered install must do real work across the selection: if no selected target
  // has any writes or config merges, the whole run is a no-op and fails (individual
  // non-applicable targets are informational, but "nothing installable anywhere" is an error).
  const runBlocker = categoryFilter && plans.every((plan) => plan.writes.length === 0 && plan.configMerges.length === 0)
    ? `no selected targets have installable outputs for categories: ${[...categoryFilter].sort().join(", ")}`
    : null;
  for (const plan of plans) {
    printInstallPlan(plan);
  }
  if (runBlocker) console.log(`install blocked: ${runBlocker}`);
  if (blocked.length > 0 || runBlocker) {
    process.exitCode = 1;
    return;
  }

  if (!dryRun) {
    for (const plan of plans) {
      await applyInstallPlan(plan);
    }
    // The compiler only wires MCP *config* (the stdio entry points at ~/.local/bin/<bin>);
    // it never builds/links the server binaries (that stays in each MCP's install.sh, which
    // runs npm + build and, for synapse, a launchd service). Close the loop with an explicit
    // next step so a freshly wired host config never silently points at a missing binary.
    const wiredServers = uniqueStrings(
      plans.flatMap((plan) => plan.configMerges.flatMap((merge) => merge.addMcpServers ?? [])),
    );
    if (wiredServers.length > 0) {
      console.log(`MCP servers wired into host configs: ${wiredServers.join(", ")}`);
      console.log("  These run as stdio binaries from ~/.local/bin. If not linked yet, build + link them:");
      console.log("    npm run install:mcps   # first-party: synapse, grimoire");
    }
  }
}

function addCrossPlanInstallConflicts(plans) {
  const planned = new Map();
  for (const plan of plans) {
    const outputs = [
      ...plan.writes.map((item) => ({ output: item.output, relativeOutput: item.relativeOutput, content: item.content })),
      ...plan.configMerges.map((item) => ({ output: item.output, relativeOutput: item.relativeOutput, content: null })),
    ];
    for (const item of outputs) {
      const previous = planned.get(item.output);
      if (!previous) {
        planned.set(item.output, { target: plan.target, plan, relativeOutput: item.relativeOutput, content: item.content });
        continue;
      }
      if (item.content !== null && previous.content !== null && item.content === previous.content) continue;
      plan.blocked.push(`output ${item.relativeOutput} also planned by ${previous.target}`);
      previous.plan.blocked.push(`output ${previous.relativeOutput} also planned by ${plan.target}`);
    }
  }
}

function selectedInstallTargets(args) {
  const values = splitArgValues([...argValues(args, "--target"), ...argValues(args, "--runtime")]);
  if (values.length === 0) fail("missing required --target or --runtime");
  if (values.includes("all")) return Object.keys(targets);
  const selected = uniqueStrings(values);
  for (const target of selected) {
    if (!isSafeTargetName(target)) fail(`unsafe install target: ${target}`);
    if (!Object.hasOwn(targets, target)) fail(`unsupported install target: ${target}`);
  }
  return selected;
}

function installCategoryFilter(args) {
  const values = splitArgValues([...argValues(args, "--category"), ...argValues(args, "--categories")]);
  if (values.length === 0 || values.includes("all")) return null;
  const known = new Set([
    "commands",
    "commands-as-workflows",
    "skills",
    "rules",
    "instructions",
    "prompts",
    "subagents",
    "ignores",
    "plugins",
    "external",
    "mcps",
    "recipes",
  ]);
  const selected = new Set(values);
  for (const value of selected) {
    if (!known.has(value)) fail(`unsupported install category: ${value}`);
  }
  return selected;
}

function optionalServiceFilter(args) {
  const values = splitArgValues(argValues(args, "--service"));
  return values.length > 0 ? new Set(values) : null;
}

async function installPlan(target, adapter, installRoot, scope, rootSource, options = {}) {
  const categoryFilter = options.categoryFilter ?? null;
  const optionalServices = options.optionalServices ?? null;
  const catalog = await exportableCatalog();
  const sourceKindsConfig = await readSourceKinds();
  const version = await packageVersion();
  const generatedAt = new Date().toISOString();
  const manifestPath = path.join(installRoot, ".agent-surface", `${target}-manifest.json`);
  const blocked = [];
  const manifestRouteError = await installPathError(installRoot, manifestPath, "manifest path");
  if (manifestRouteError) blocked.push(manifestRouteError);
  const previousManifest = manifestRouteError ? null : await readJsonIfExists(manifestPath);
  const legacyOwnership = await readLegacyOwnership(target);
  const outputs = (await targetOutputs(adapter, catalog, {
    target,
    scope,
    mode: "install",
    agentName: options.agentName ?? "agent",
    categoryFilter,
    optionalServices,
  })).filter((output) => outputAppliesToCategory(output, categoryFilter));
  const writes = [];
  const managed = [];
  const nonApplicable = [];

  for (const item of outputs) {
    const sourceKindError = outputSourceKindError(item, sourceKindsConfig);
    if (sourceKindError) {
      blocked.push(sourceKindError);
      continue;
    }
    if (!outputAppliesToScope(item, scope, sourceKindsConfig)) {
      nonApplicable.push(item.relativeOutput);
      continue;
    }
    const output = path.join(installRoot, item.relativeOutput);
    const relativeOutput = path.relative(installRoot, output);
    if (!isSafeRelativePath(relativeOutput)) {
      blocked.push(`unsafe output path: ${relativeOutput}`);
      continue;
    }

    writes.push({ source: item.source, output, relativeOutput, content: item.content });
    managed.push({
      target,
      source: item.source,
      output: relativeOutput,
      version,
    });
  }

  for (const item of writes) {
    const routeError = await installPathError(installRoot, item.output, `managed output ${item.relativeOutput}`);
    if (routeError) {
      blocked.push(routeError);
      item.action = "blocked";
      continue;
    }
    const current = await readFileIfExists(item.output);
    if (current === null) {
      item.action = "write";
      continue;
    }

    if (current.toString("utf8") === item.content) {
      item.action = "skip";
      continue;
    }

    item.action = "write";
  }

  const partialInstall = categoryFilter !== null || optionalServices !== null;
  const liveOutputs = new Set(managed.map((item) => item.output));
  const previousFileEntries = manifestFileEntries(previousManifest, target);
  const liveCommandSources = new Set(catalog.commands.map((command) => command.relativePath));
  // Public packages intentionally omit private local command overlays. Their
  // absence is not a de-scoping signal: retain prior ownership and files until
  // a checkout that actually carries the overlay updates them.
  const retainedLocalOverlayEntries = previousFileEntries.filter(
    (item) => localCommandOverlays.has(item.source) && !liveCommandSources.has(item.source),
  );
  const retainedLocalOverlayOutputs = new Set(retainedLocalOverlayEntries.map((item) => item.output));
  const staleManaged = !partialInstall
    ? [...previousFileEntries, ...legacyOwnership.files]
      .filter((item) => !liveOutputs.has(item.output) && !retainedLocalOverlayOutputs.has(item.output))
      .sort((left, right) => left.output.localeCompare(right.output))
    : [];
  const staleRemovalActions = [];
  const configMerges = [];
  const previousConfigEntries = manifestConfigEntries(previousManifest);
  const ownedConfigEntries = [...previousConfigEntries, ...legacyOwnership.config_entries];
  const pruneConfigEntries = (!categoryFilter || categoryFilter.has("mcps")) && optionalServices === null;
  const liveConfigRoutes = new Set();
  const configRouteContext = {
    target,
    scope,
    mode: "install",
    agentName: options.agentName ?? "agent",
    relocateExternalRoutes: rootSource === "explicit --dest",
    categoryFilter,
    optionalServices,
  };
  // Scope-retired routes still need cleanup. Use every adapter-declared route to
  // establish the target-owned namespace, even when that route is not emitted at
  // the current scope; manifest data alone never establishes a writable namespace.
  const trustedConfigRoutes = adapterMcpConfigs(adapter).map((mcpConfig) => ({
    relativeOutput: outputRootFor(mcpConfig.relativeOutput, configRouteContext),
  }));
  if (target === "kilo" && (!categoryFilter || categoryFilter.has("rules") || categoryFilter.has("mcps"))) {
    const merge = await kiloConfigMerge(installRoot, scope, {
      includeInstructions: !categoryFilter || categoryFilter.has("rules"),
      includeMcp: !categoryFilter || categoryFilter.has("mcps"),
      includeRootProperties: !categoryFilter,
      categoryFilter,
      optionalServices,
    });
    liveConfigRoutes.add(configEntryKey(merge.relativeOutput, merge.format));
    trustedConfigRoutes.push(merge);
    const prepared = await prepareKiloConfigMerge(merge, ownedConfigEntries, pruneConfigEntries);
    if (!isEmptyConfigNoop(prepared)) configMerges.push(prepared);
  } else if (!categoryFilter || categoryFilter.has("mcps")) {
    for (const mcpConfig of adapterMcpConfigs(adapter).filter((item) => mcpConfigScopeAllows(item, scope))) {
      const merge = await mcpConfigMerge(mcpConfig, installRoot, scope, {
        ...configRouteContext,
      });
      liveConfigRoutes.add(configEntryKey(merge.relativeOutput, merge.format));
      trustedConfigRoutes.push(merge);
      const prepared = await prepareMcpConfigMerge(merge, ownedConfigEntries, pruneConfigEntries);
      if (!isEmptyConfigNoop(prepared)) configMerges.push(prepared);
    }
  }

  const pruneObsoleteConfigRoutes = !partialInstall;
  if (pruneObsoleteConfigRoutes) {
    await addObsoleteConfigRouteMerges(
      configMerges,
      ownedConfigEntries,
      liveConfigRoutes,
      trustedConfigRoutes,
      legacyOwnership.config_entries,
      installRoot,
    );
  }

  for (const item of configMerges) {
    if (item.action === "blocked") blocked.push(item.error);
  }

  for (const item of staleManaged) {
    if (!isSafeRelativePath(item.output)) {
      blocked.push(`unsafe stale managed path: ${item.output}`);
      continue;
    }

    const output = path.join(installRoot, item.output);
    const routeError = await installPathError(installRoot, output, `stale managed output ${item.output}`);
    if (routeError) {
      blocked.push(routeError);
      continue;
    }
    const current = await readFileIfExists(output);
    if (current === null) {
      staleRemovalActions.push({ output, relativeOutput: item.output, action: "missing" });
      continue;
    }

    staleRemovalActions.push({ output, relativeOutput: item.output, action: "remove" });
  }

  // Per-target: record non-applicability as informational. Whether the *run* fails is decided
  // at the call site (a run with no installable outputs anywhere is the error, not one target).
  let notApplicableCategories = null;
  if (categoryFilter && writes.length === 0 && configMerges.length === 0 && nonApplicable.length === 0) {
    notApplicableCategories = `no installable outputs for categories: ${[...categoryFilter].sort().join(", ")}`;
  }

  const retainedManaged = partialInstall
    ? previousFileEntries
      .filter((item) => !liveOutputs.has(item.output))
    : retainedLocalOverlayEntries;
  const manifestManaged = [...retainedManaged, ...managed].sort((left, right) => left.output.localeCompare(right.output));
  const nextConfigEntries = mergedManifestConfigEntries(
    previousConfigEntries,
    configMerges,
    pruneConfigEntries,
    pruneObsoleteConfigRoutes ? liveConfigRoutes : null,
  );
  const manifest = {
    target,
    scope,
    generated_at: generatedAt,
    managed: manifestManaged,
    config_entries: nextConfigEntries,
  };

  return {
    target,
    scope,
    rootSource,
    installRoot,
    manifestPath,
    generatedAt,
    categories: categoryFilter ? [...categoryFilter].sort() : null,
    services: optionalServices ? [...optionalServices].sort() : null,
    writes,
    staleRemovalActions,
    configMerges,
    blocked,
    notApplicableCategories,
    nonApplicable: nonApplicable.sort((left, right) => left.localeCompare(right)),
    manifest,
  };
}

async function readLegacyOwnership(target) {
  const legacy = await readJsonIfExists(path.join(root, "registry", "legacy-owned.json")) ?? {};
  return {
    files: Array.isArray(legacy.files)
      ? legacy.files
        .filter((item) => typeof item?.output === "string")
        .filter((item) => item.target === undefined || item.target === target)
        .map((item) => ({
          target,
          source: typeof item.source === "string" ? item.source : "",
          output: item.output,
          version: typeof item.version === "string" ? item.version : undefined,
        }))
      : [],
    config_entries: Array.isArray(legacy.config_entries)
      ? legacy.config_entries
        .filter((item) => item.target === undefined || item.target === target)
        .filter((item) => typeof item?.path === "string" && typeof item?.format === "string" && Array.isArray(item?.ids))
        .map((item) => ({
          path: item.path,
          format: item.format,
          ids: uniqueStrings(item.ids.filter((id) => typeof id === "string")),
        }))
        .filter((item) => item.ids.length > 0)
      : [],
  };
}

function manifestFileEntries(manifest, target) {
  if (!Array.isArray(manifest?.managed)) return [];
  return manifest.managed
    .filter((item) => typeof item?.output === "string")
    .filter((item) => item.target === undefined || item.target === target)
    .map((item) => ({
      target,
      source: typeof item.source === "string" ? item.source : "",
      output: item.output,
      version: typeof item.version === "string" ? item.version : undefined,
    }));
}

function manifestConfigEntries(manifest) {
  if (!Array.isArray(manifest?.config_entries)) return [];
  return manifest.config_entries
    .filter((item) => typeof item?.path === "string" && typeof item?.format === "string" && Array.isArray(item?.ids))
    .map((item) => ({
      path: item.path,
      format: item.format,
      ids: uniqueStrings(item.ids.filter((id) => typeof id === "string")),
    }))
    .filter((item) => item.ids.length > 0);
}

function previousConfigIds(entries, relativeOutput, format) {
  return uniqueStrings(
    entries
      .filter((entry) => entry.path === relativeOutput && entry.format === format)
      .flatMap((entry) => entry.ids),
  );
}

function groupedConfigEntries(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    const key = configEntryKey(entry.path, entry.format);
    const current = grouped.get(key);
    if (current) {
      current.ids = uniqueStrings([...current.ids, ...entry.ids]);
    } else {
      grouped.set(key, { ...entry, ids: [...entry.ids] });
    }
  }
  return [...grouped.values()].sort((left, right) => configEntryKey(left.path, left.format).localeCompare(configEntryKey(right.path, right.format)));
}

async function addObsoleteConfigRouteMerges(
  configMerges,
  ownedConfigEntries,
  liveConfigRoutes,
  trustedConfigRoutes,
  legacyConfigEntries,
  installRoot,
) {
  const mergeIndexesByPath = new Map(configMerges.map((merge, index) => [merge.relativeOutput, index]));
  const obsoleteRoutes = groupedConfigEntries(ownedConfigEntries)
    .filter((entry) => !liveConfigRoutes.has(configEntryKey(entry.path, entry.format)));
  const trustedLegacyRoutes = new Set(legacyConfigEntries.map((entry) => configEntryKey(entry.path, entry.format)));

  for (const entry of obsoleteRoutes) {
    if (!trustedLegacyRoutes.has(configEntryKey(entry.path, entry.format))
      && !trustedConfigRoutes.some((route) => configRouteSharesNamespace(entry.path, route.relativeOutput))) {
      configMerges.push({
        kind: "mcp",
        action: "blocked",
        relativeOutput: entry.path,
        error: `untrusted obsolete MCP config route in manifest: ${entry.path}; register an exact legacy-owned route before cleanup`,
      });
      continue;
    }
    const existingIndex = mergeIndexesByPath.get(entry.path);
    if (existingIndex !== undefined) {
      configMerges[existingIndex] = mergeObsoleteConfigRoute(configMerges[existingIndex], entry);
      continue;
    }

    const safetyRoot = configRouteSafetyRoot(entry.path, path.isAbsolute(entry.path), installRoot);
    const prepared = await prepareMcpConfigMerge({
      kind: "mcp",
      output: path.isAbsolute(entry.path) ? path.normalize(entry.path) : path.join(installRoot, entry.path),
      relativeOutput: entry.path,
      format: entry.format,
      entries: [],
      allowAbsoluteOutput: path.isAbsolute(entry.path),
      safetyRoot,
    }, [entry], true);
    if (isEmptyConfigNoop(prepared)) continue;
    mergeIndexesByPath.set(entry.path, configMerges.length);
    configMerges.push(prepared);
  }
}

function mergeObsoleteConfigRoute(merge, entry) {
  if (merge.action === "blocked") return merge;
  let content;
  try {
    content = mergeMcpConfigContent(merge.content, entry.format, [], entry.ids);
  } catch (error) {
    return { ...merge, action: "blocked", error: `${entry.path}: ${error.message}` };
  }

  const changed = content !== merge.content;
  return {
    ...merge,
    action: changed && merge.action === "skip" ? "merge" : merge.action,
    removeMcpServers: changed
      ? uniqueStrings([...(merge.removeMcpServers ?? []), ...entry.ids])
      : (merge.removeMcpServers ?? []),
    removeIds: uniqueStrings([...(merge.removeIds ?? []), ...entry.ids]),
    content,
  };
}

function mergedManifestConfigEntries(previousEntries, configMerges, pruneConfigEntries, liveConfigRoutes = null) {
  const next = new Map(previousEntries.map((entry) => [configEntryKey(entry.path, entry.format), { ...entry }]));
  if (liveConfigRoutes) {
    for (const key of next.keys()) {
      if (!liveConfigRoutes.has(key)) next.delete(key);
    }
  }
  for (const merge of configMerges) {
    const entry = manifestConfigEntryFromMerge(merge);
    if (!entry) continue;
    const key = configEntryKey(entry.path, entry.format);
    const previousIds = next.get(key)?.ids ?? [];
    const ids = pruneConfigEntries ? entry.ids : uniqueStrings([...previousIds, ...entry.ids]);
    if (ids.length === 0) {
      next.delete(key);
    } else {
      next.set(key, { path: entry.path, format: entry.format, ids });
    }
  }
  return [...next.values()].sort((left, right) => configEntryKey(left.path, left.format).localeCompare(configEntryKey(right.path, right.format)));
}

function manifestConfigEntryFromMerge(merge) {
  if (!["mcp", "kilo"].includes(merge.kind) || typeof merge.format !== "string") return null;
  const entries = merge.kind === "kilo" ? merge.mcpEntries : merge.entries;
  return {
    path: merge.relativeOutput,
    format: merge.format,
    ids: uniqueStrings((entries ?? []).map(([id]) => id)),
  };
}

function configEntryKey(relativeOutput, format) {
  return `${relativeOutput}\0${format}`;
}

function isEmptyConfigNoop(merge) {
  if (!merge || merge.action === "blocked") return false;
  if (merge.kind === "mcp") {
    return merge.entries.length === 0
      && (merge.removeIds ?? []).length === 0
      && Object.keys(merge.rootProperties ?? {}).length === 0;
  }
  if (merge.kind === "kilo") {
    return merge.instructions.length === 0
      && merge.legacyInstructions.length === 0
      && merge.mcpEntries.length === 0
      && (merge.removeIds ?? []).length === 0;
  }
  return false;
}

// Every generated output must declare a source kind and that kind must be
// defined in the registry. Missing/unknown source kinds are checked in generated
// validation and install planning; this helper exists for call sites that do not
// already validate the output through those paths.
function printInstallPlan(plan) {
  console.log(`target: ${plan.target}`);
  console.log(`scope: ${plan.scope}`);
  if (plan.categories) console.log(`categories: ${plan.categories.join(", ")}`);
  if (plan.services) console.log(`services: ${plan.services.join(", ")}`);
  console.log(`root source: ${plan.rootSource}`);
  console.log(`root: ${plan.installRoot}`);
  console.log("planned writes:");
  for (const item of plan.writes) {
    console.log(`  ${path.relative(plan.installRoot, item.output)} <- ${item.source}`);
  }
  const removes = plan.staleRemovalActions.filter((item) => item.action === "remove" || item.action === "missing").map((item) => item.relativeOutput);
  console.log("planned stale managed removals:");
  if (removes.length === 0) {
    console.log("  none");
  } else {
    for (const item of removes) console.log(`  ${item}`);
  }
  console.log("planned manifest:");
  console.log(`  ${path.relative(plan.installRoot, plan.manifestPath)}`);
  console.log("planned config merges:");
  if (plan.configMerges.length === 0) {
    console.log("  none");
  } else {
    for (const item of plan.configMerges) {
      if (item.kind === "mcp") {
        const addServers = item.addMcpServers ?? [];
        const removeServers = item.removeMcpServers ?? [];
        if (addServers.length > 0) console.log(`  ${item.relativeOutput} MCP += ${addServers.join(", ")}`);
        if (removeServers.length > 0) console.log(`  ${item.relativeOutput} MCP -= ${removeServers.join(", ")}`);
        for (const [property, value] of Object.entries(item.rootProperties ?? {})) {
          console.log(`  ${item.relativeOutput} ${property} := ${JSON.stringify(value)}`);
        }
        if (addServers.length === 0 && removeServers.length === 0 && Object.keys(item.rootProperties ?? {}).length === 0) {
          console.log(`  ${item.relativeOutput} MCP unchanged`);
        }
        continue;
      }
      const addInstructions = item.addInstructions ?? item.instructions;
      const removeInstructions = item.removeInstructions ?? [];
      const addMcpServers = item.addMcpServers ?? [];
      if (addInstructions.length > 0) {
        console.log(`  ${item.relativeOutput} instructions += ${addInstructions.join(", ")}`);
      }
      if (removeInstructions.length > 0) {
        console.log(`  ${item.relativeOutput} instructions -= ${removeInstructions.join(", ")}`);
      }
      if (addMcpServers.length > 0) {
        console.log(`  ${item.relativeOutput} MCP += ${addMcpServers.join(", ")}`);
      }
      for (const [property, value] of Object.entries(item.rootProperties ?? {})) {
        console.log(`  ${item.relativeOutput} ${property} := ${JSON.stringify(value)}`);
      }
      if (addInstructions.length === 0
        && removeInstructions.length === 0
        && addMcpServers.length === 0
        && Object.keys(item.rootProperties ?? {}).length === 0) {
        console.log(`  ${item.relativeOutput} config unchanged`);
      }
    }
  }
  if (plan.nonApplicable && plan.nonApplicable.length > 0) {
    console.log("non-applicable at this scope:");
    for (const item of plan.nonApplicable) console.log(`  ${item} (project-scope only)`);
  }
  if (plan.notApplicableCategories) {
    console.log(`not applicable: ${plan.notApplicableCategories}`);
  }
  console.log("blocked:");
  if (plan.blocked.length === 0) {
    console.log("  none");
  } else {
    for (const item of plan.blocked) console.log(`  ${item}`);
  }
}

async function applyInstallPlan(plan) {
  let written = 0;
  let skipped = 0;
  let removed = 0;
  let configMerges = 0;

  await mkdir(plan.installRoot, { recursive: true });

  for (const item of plan.writes) {
    if (item.action === "skip") {
      skipped += 1;
      continue;
    }

    const routeError = await installPathError(plan.installRoot, item.output, `managed output ${item.relativeOutput}`);
    if (routeError) fail(routeError);
    await mkdir(path.dirname(item.output), { recursive: true });
    const postMkdirRouteError = await installPathError(plan.installRoot, item.output, `managed output ${item.relativeOutput}`);
    if (postMkdirRouteError) fail(postMkdirRouteError);
    await writeFile(item.output, item.content);
    written += 1;
  }

  for (const item of plan.staleRemovalActions) {
    if (item.action !== "remove") continue;
    const routeError = await installPathError(plan.installRoot, item.output, `stale managed output ${item.relativeOutput}`);
    if (routeError) fail(routeError);
    await rm(item.output, { force: true });
    removed += 1;
  }

  for (const item of plan.configMerges) {
    const result = await applyConfigMerge(item);
    configMerges += result.changed ? 1 : 0;
  }

  const manifestRouteError = await installPathError(plan.installRoot, plan.manifestPath, "manifest path");
  if (manifestRouteError) fail(manifestRouteError);
  await mkdir(path.dirname(plan.manifestPath), { recursive: true });
  const postMkdirManifestRouteError = await installPathError(plan.installRoot, plan.manifestPath, "manifest path");
  if (postMkdirManifestRouteError) fail(postMkdirManifestRouteError);
  const manifestTmp = `${plan.manifestPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(manifestTmp, `${JSON.stringify(plan.manifest, null, 2)}\n`, { flag: "wx" });
    await rename(manifestTmp, plan.manifestPath);
  } finally {
    await rm(manifestTmp, { force: true });
  }

  console.log("installed:");
  console.log(`  wrote: ${written}`);
  console.log(`  skipped unchanged: ${skipped}`);
  console.log(`  removed stale: ${removed}`);
  console.log(`  config merges: ${configMerges}`);
}

async function mcpConfigMerge(mcpConfig, installRoot, scope, context) {
  const entries = mcpConfig.includeServices === false
    ? []
    : await selectedMcpServiceEntries(mcpConfig.defaultEnabled, context);
  const relativeOutput = outputRootFor(mcpConfig.relativeOutput, { ...context, scope });
  const absoluteOutput = path.isAbsolute(relativeOutput);
  const safetyRoot = configRouteSafetyRoot(relativeOutput, mcpConfig.allowAbsoluteOutput === true, installRoot);
  return {
    kind: "mcp",
    output: absoluteOutput ? path.normalize(relativeOutput) : path.join(installRoot, relativeOutput),
    relativeOutput,
    format: mcpConfig.format,
    entries,
    rootProperties: context.categoryFilter ? {} : (mcpConfig.rootProperties ?? {}),
    allowAbsoluteOutput: mcpConfig.allowAbsoluteOutput === true,
    safetyRoot,
  };
}

async function prepareMcpConfigMerge(merge, previousConfigEntries, pruneConfigEntries) {
  if (!merge.safetyRoot) {
    return { ...merge, action: "blocked", error: `unsafe MCP config path: ${merge.relativeOutput}` };
  }
  const routeError = await installPathError(merge.safetyRoot, merge.output, `MCP config ${merge.relativeOutput}`);
  if (routeError) return { ...merge, action: "blocked", error: routeError };

  const currentIds = merge.entries.map(([id]) => id).sort();
  const previousIds = previousConfigIds(previousConfigEntries, merge.relativeOutput, merge.format);
  const removeIds = pruneConfigEntries ? previousIds.filter((id) => !currentIds.includes(id)) : [];
  const existing = await readFileIfExists(merge.output);
  const addMcpServers = currentIds;
  const removeMcpServers = removeIds;
  if (existing === null) {
    if (merge.entries.length === 0 && Object.keys(merge.rootProperties ?? {}).length === 0) {
      return { ...merge, action: "skip", addMcpServers: [], removeMcpServers, removeIds, content: "" };
    }
    return {
      ...merge,
      action: "write",
      addMcpServers,
      removeMcpServers,
      removeIds,
      content: renderMcpConfig(merge.format, merge.entries, merge.rootProperties),
    };
  }

  const text = existing.toString("utf8");
  let content;
  try {
    content = mergeMcpConfigContent(text, merge.format, merge.entries, removeIds, merge.rootProperties);
  } catch (error) {
    return { ...merge, action: "blocked", error: `${merge.relativeOutput}: ${error.message}` };
  }
  if (content === text) return { ...merge, action: "skip", addMcpServers: [], removeMcpServers: [], removeIds, content };
  return { ...merge, action: "merge", addMcpServers, removeMcpServers, removeIds, content };
}

function configRouteSafetyRoot(configPath, allowAbsoluteOutput, installRoot) {
  if (!path.isAbsolute(configPath)) return isSafeRelativePath(configPath) ? installRoot : null;
  if (!allowAbsoluteOutput) return null;
  const trustedRoots = uniqueStrings([
    os.homedir(),
    process.env.APPDATA,
  ].filter((value) => typeof value === "string" && value.length > 0).map((value) => path.resolve(value)));
  const normalized = path.resolve(configPath);
  return trustedRoots.find((trustedRoot) => isPathInside(trustedRoot, normalized)) ?? null;
}

function configRouteSharesNamespace(candidate, trustedRoute) {
  const normalizedCandidate = path.normalize(candidate);
  const normalizedTrusted = path.normalize(trustedRoute);
  if (path.isAbsolute(normalizedCandidate) !== path.isAbsolute(normalizedTrusted)) return false;
  const trustedNamespace = configRouteNamespace(normalizedTrusted);
  if (trustedNamespace === null) return normalizedCandidate === normalizedTrusted;
  return isPathInside(trustedNamespace, normalizedCandidate);
}

function configRouteNamespace(configPath) {
  const parsed = path.parse(configPath);
  const relativePath = path.relative(parsed.root, configPath);
  const parts = relativePath.split(path.sep).filter(Boolean);
  if (parts.length <= 1) return null;
  if (parts[0] === ".config" && parts[1]) return path.join(parsed.root, parts[0], parts[1]);
  if (parts[0] === "Library" && parts[1] === "Application Support" && parts[2]) {
    return path.join(parsed.root, parts[0], parts[1], parts[2]);
  }
  if (parts[0] === "AppData" && parts[1] === "Roaming" && parts[2]) {
    return path.join(parsed.root, parts[0], parts[1], parts[2]);
  }
  if (parts[0].startsWith(".")) return path.join(parsed.root, parts[0]);
  return path.dirname(configPath);
}

async function installPathError(safetyRoot, candidate, label) {
  const normalizedRoot = path.resolve(safetyRoot);
  const normalizedCandidate = path.resolve(candidate);
  if (!isPathInside(normalizedRoot, normalizedCandidate)) {
    return `${label} escapes its install root: ${candidate}`;
  }

  const relativePath = path.relative(normalizedRoot, normalizedCandidate);
  const components = relativePath === "" ? [] : relativePath.split(path.sep);
  const paths = [normalizedRoot];
  let current = normalizedRoot;
  for (const component of components) {
    current = path.join(current, component);
    paths.push(current);
  }

  for (const [index, item] of paths.entries()) {
    let info;
    try {
      info = await lstat(item);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      return `${label} cannot be inspected safely: ${error.message}`;
    }
    if (info.isSymbolicLink()) {
      return `${label} traverses symbolic link: ${item}`;
    }
    if (index < paths.length - 1 && !info.isDirectory()) {
      return `${label} has a non-directory ancestor: ${item}`;
    }
  }
  return null;
}

function mergeMcpConfigContent(text, format, entries, removeIds, rootProperties = {}) {
  if (format === "codex-toml") return mergeCodexMcpToml(text, entries, removeIds, rootProperties);
  if (YAML_MCP_FORMATS.has(format)) return mergeYamlMcpConfig(text, format, entries, removeIds);
  return mergeJsonMcpConfig(text, format, entries, removeIds, rootProperties);
}

async function kiloConfigMerge(installRoot, scope, options = {}) {
  const relativeOutput = scope === "user" ? path.join(".config", "kilo", "kilo.jsonc") : "kilo.jsonc";
  const includeInstructions = options.includeInstructions !== false;
  const includeMcp = options.includeMcp === true;
  const includeRootProperties = options.includeRootProperties === true;
  const instructions = includeInstructions ? await kiloRuleInstructionPaths(scope) : [];
  const legacyRuleRoot = scope === "user" ? "./rules" : ".kilo/rules";
  const legacyScopedRuleInstructions = (await readRules())
    .filter((rule) => rule.alwaysApply === false)
    .map((rule) => `${legacyRuleRoot}/${path.basename(rule.file, ".mdc")}.md`);
  const legacyLanguageRuleInstructions = [
    "10-lang-python",
    "11-lang-rust",
    "12-lang-go",
    "13-lang-typescript",
    "14-lang-shell",
  ].map((name) => `${legacyRuleRoot}/${name}.md`);
  const legacyInstructions = [
    `${legacyRuleRoot}/agent-surface.md`,
    `${legacyRuleRoot}/00-core.md`,
    ...legacyScopedRuleInstructions,
    ...legacyLanguageRuleInstructions,
  ];
  return {
    kind: "kilo",
    output: path.join(installRoot, relativeOutput),
    relativeOutput,
    format: "local-command-map",
    instructions,
    legacyInstructions: includeInstructions ? legacyInstructions : [],
    rootProperties: includeRootProperties
      ? { permission: { "*": "allow" }, share: "disabled" }
      : {},
    mcpEntries: includeMcp
      ? await selectedMcpServiceEntries(true, {
        mode: "install",
        categoryFilter: options.categoryFilter ?? null,
        optionalServices: options.optionalServices ?? null,
      })
      : [],
    safetyRoot: installRoot,
  };
}

async function applyConfigMerge(merge) {
  if (merge.action === "skip") return { changed: false };
  if (merge.action === "blocked") fail(merge.error);
  const routeError = await installPathError(merge.safetyRoot, merge.output, `config ${merge.relativeOutput}`);
  if (routeError) fail(routeError);
  await mkdir(path.dirname(merge.output), { recursive: true });
  const postMkdirRouteError = await installPathError(merge.safetyRoot, merge.output, `config ${merge.relativeOutput}`);
  if (postMkdirRouteError) fail(postMkdirRouteError);
  await writeFile(merge.output, merge.content);
  return { changed: true };
}

async function prepareKiloConfigMerge(merge, previousConfigEntries, pruneConfigEntries) {
  if (!isSafeRelativePath(merge.relativeOutput)) {
    return { ...merge, action: "blocked", error: `unsafe Kilo config path: ${merge.relativeOutput}` };
  }
  const routeError = await installPathError(merge.safetyRoot, merge.output, `Kilo config ${merge.relativeOutput}`);
  if (routeError) return { ...merge, action: "blocked", error: routeError };

  const currentMcpIds = merge.mcpEntries.map(([id]) => id).sort();
  const previousMcpIds = previousConfigIds(previousConfigEntries, merge.relativeOutput, merge.format);
  const removeMcpIds = pruneConfigEntries ? previousMcpIds.filter((id) => !currentMcpIds.includes(id)) : [];
  const existing = await readFileIfExists(merge.output);
  if (existing === null) {
    const content = {
      $schema: "https://app.kilo.ai/config.json",
      ...merge.rootProperties,
    };
    if (merge.instructions.length > 0) content.instructions = merge.instructions;
    if (merge.mcpEntries.length > 0) content.mcp = optionalServiceMcpServers(merge.mcpEntries, "local-command-map");
    return {
      ...merge,
      action: "write",
      addInstructions: merge.instructions,
      removeInstructions: [],
      addMcpServers: currentMcpIds,
      removeMcpServers: removeMcpIds,
      removeIds: removeMcpIds,
      content: `${JSON.stringify(content, null, 2)}\n`,
    };
  }

  const text = existing.toString("utf8");
  const parsed = parseJsoncResult(text);
  if (!parsed.ok) {
    return { ...merge, action: "blocked", error: `${merge.relativeOutput}: invalid JSONC: ${parsed.error.message}` };
  }
  if (parsed.value === null || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
    return { ...merge, action: "blocked", error: `${merge.relativeOutput}: config must be an object` };
  }

  let content = text;
  let missing = [];
  let remove = [];
  if (merge.instructions.length > 0) {
    const instructions = parsed.value.instructions ?? [];
    if (!Array.isArray(instructions)) {
      return { ...merge, action: "blocked", error: `${merge.relativeOutput}: instructions must be an array` };
    }
    if (!instructions.every((item) => typeof item === "string")) {
      return { ...merge, action: "blocked", error: `${merge.relativeOutput}: instructions must contain only strings` };
    }
    missing = merge.instructions.filter((item) => !instructions.includes(item));
    remove = merge.legacyInstructions.filter((item) => instructions.includes(item));
    if (missing.length > 0 || remove.length > 0) {
      content = mergeKiloInstructionJsonc(content, missing, remove);
    }
  }

  const addMcpServers = merge.mcpEntries
    .map(([id]) => id)
    .filter((id) => parsed.value.mcp?.[id] === undefined);
  if (merge.mcpEntries.length > 0 || removeMcpIds.length > 0) {
    try {
      content = mergeJsonMcpConfig(content, merge.format, merge.mcpEntries, removeMcpIds);
    } catch (error) {
      return { ...merge, action: "blocked", error: `${merge.relativeOutput}: ${error.message}` };
    }
  }
  for (const [property, value] of Object.entries(merge.rootProperties)) {
    content = setJsoncRootProperty(content, property, value);
  }

  if (content === text) {
    return { ...merge, action: "skip", addInstructions: [], removeInstructions: [], addMcpServers: [], removeMcpServers: [], removeIds: removeMcpIds };
  }

  return { ...merge, action: "merge", addInstructions: missing, removeInstructions: remove, addMcpServers, removeMcpServers: removeMcpIds, removeIds: removeMcpIds, content };
}
