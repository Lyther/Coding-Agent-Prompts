// Canonical Agent Skills: load direct skills/<name>/SKILL.md entries and parse
// their standard frontmatter. Validation lives in the check layer.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { directDirectories } from "./fs-tree.mjs";
import { parseSimpleFrontmatter } from "./commands.mjs";
import { relative, root } from "./registry.mjs";

export async function readSkills() {
  const skillRoot = path.join(root, "skills");
  const skills = [];

  for (const directory of await directDirectories(skillRoot)) {
    const file = path.join(directory, "SKILL.md");
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    skills.push(parseSkill(file, text));
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

export function parseSkill(file, text) {
  const name = path.basename(path.dirname(file));
  const metadata = {};
  const frontmatterErrors = [];
  let body = text;
  let hasFrontmatter = false;

  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---\n", 4);
    if (end === -1) {
      frontmatterErrors.push("frontmatter not closed");
    } else {
      hasFrontmatter = true;
      Object.assign(metadata, parseSimpleFrontmatter(text.slice(4, end), frontmatterErrors));
      body = text.slice(end + 5).replace(/^\s+/, "");
    }
  }

  return {
    file,
    relativePath: relative(file),
    name,
    text,
    body,
    metadata,
    hasFrontmatter,
    frontmatterErrors,
    sourceKind: "skills",
  };
}
