// Repo root + cached loaders for the JSON registries (the source of truth). Sole reader of
// the raw registry files; other modules import these instead of re-reading disk.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Two levels up from scripts/agent-surface/ = the repo root.
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Repo-root-relative path for display.
export function relative(file) {
  return path.relative(root, file);
}

let sourceKindsCache;
export async function readSourceKinds() {
  if (sourceKindsCache !== undefined) return sourceKindsCache;
  sourceKindsCache = JSON.parse(await readFile(path.join(root, "registry", "source-kinds.json"), "utf8"));
  return sourceKindsCache;
}

let optionalServicesCache;
export async function readOptionalServices() {
  if (optionalServicesCache !== undefined) return optionalServicesCache;
  optionalServicesCache = JSON.parse(await readFile(path.join(root, "registry", "optional-services.json"), "utf8"));
  return optionalServicesCache;
}

export const assetCategoryFiles = {
  cybersecurity: "cybersecurity-assets.json",
  private: "private-secret.json",
  modding: "modding.json",
};
export const assetCategoryNames = new Set(Object.keys(assetCategoryFiles));

let assetCategoriesCache;
export async function readAssetCategories() {
  if (assetCategoriesCache !== undefined) return assetCategoriesCache;
  const entries = await Promise.all(Object.entries(assetCategoryFiles).map(async ([name, file]) => {
    const value = JSON.parse(await readFile(path.join(root, "registry", file), "utf8"));
    if (value.category !== name) throw new Error(`asset category ${file} declares ${value.category ?? "no category"}`);
    return [name, value];
  }));
  assetCategoriesCache = Object.fromEntries(entries);
  return assetCategoriesCache;
}

export async function packageVersion() {
  const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  return metadata.version;
}
