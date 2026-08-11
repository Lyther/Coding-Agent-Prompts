---
name: ops-clean
description: "Remove accumulated repository debt across design, code, tests, dependencies, scripts, docs, assets, structure, and generated residue."
---

## OBJECTIVE

Reduce accumulated project complexity and maintenance cost while preserving the accepted product contract.

`dev-chore` catches bounded quality drift during active development. `ops-clean` handles repository-wide debt that has already accumulated: duplicate implementation, wrong abstractions, hand-rolled wheels, misleading tests, dead scripts, temporary files, stale dependencies, structural clutter, and documentation or generated residue.

## INPUT

```text
ops-clean [target]
  [--domain design|code|tests|dependencies|scripts|docs|assets|structure|generated|all]
  [--mode inspect|plan|apply]
  [--depth quick|standard|deep]
```

Defaults: `--domain all --mode apply --depth standard` when the user requests cleanup; otherwise inspect only.

## CONTRACT GATE

Before deleting or consolidating:

- state the current maturity and user-visible contract;
- identify the real build, test, package, and runtime entry points;
- preserve unrelated dirty work;
- establish the cheapest relevant baseline;
- distinguish tracked source, generated output, ignored local state, and external/vendor content.

If a cleanup would intentionally change supported behavior, public contracts, persistent data, or architecture, route that item through `dev-fix`, `dev-refactor`, or an architecture workflow. Do not hide a redesign inside hygiene work.

## QUALITY DOMAINS

### Design

- A known-wrong premise that later code keeps patching around.
- Abstractions, layers, services, adapters, factories, compatibility paths, flags, or configuration axes with no current requirement.
- Multiple owners or sources of truth for the same state or decision.
- Production or enterprise machinery imposed on prototype, MVP, or core scope without evidence.

### Code

- Duplicate implementations, parallel utilities, copied logic, dead branches, unreachable paths, and obsolete compatibility code.
- Wrapper layers that add names but no policy, transformation, isolation, or reuse.
- Hand-built parsing, scheduling, storage, protocol, security, or domain logic when the existing stack or a proven library already solves the requirement.
- Comments, defensive branches, and error paths that describe impossible states or conceal unclear ownership.

### Tests

- Tests that cannot catch the defect they claim to cover.
- Tautological assertions, implementation-copy oracles, mock-only boundary proof, unjustified substitutes, skipped/xfail residue, flaky tests, duplicate cases, and snapshots no one can review.
- Test-only helpers or fixtures that outlive all consumers.
- Broad test frameworks whose maintenance cost exceeds the behavior they protect.

Do not delete a failing test merely because its product behavior is inconvenient. Resolve whether the contract or implementation is wrong.

### Dependencies

- Unused, duplicated, abandoned, unpinned, vulnerable, or unjustifiably heavy packages.
- A local wheel that should be replaced by an existing dependency.
- A dependency that should be replaced by a small local implementation.

Before adding or replacing a dependency, compare maintenance, license, advisories, install scripts or native code, transitive footprint, compatibility, API fit, and lockfile impact. Popularity alone is not proof, and dependency replacement must reduce total complexity.

### Scripts and Tooling

- One-off investigation scripts, temporary migrations, debug launchers, stale generators, duplicate CI helpers, and commands no real workflow calls.
- Tooling that reproduces an ecosystem command without project-specific value.
- Formatter, linter, or build configurations that overlap or fight the repository's actual gate.

### Docs and Assets

- Stale, contradictory, duplicated, generated, placeholder, or assistant-residue documentation.
- Unreferenced images, media, samples, reports, archives, and copied vendor material.
- Names and locations that obscure ownership or the canonical source.

### Structure and Generated State

- Empty directories, abandoned modules, old migrations, temp files, caches, coverage output, packaged archives, editor debris, and generated files committed without a repository contract.
- Build outputs or host distributions that should be regenerated rather than hand-edited.
- Local agent state accidentally tracked as project source.

## METHOD

1. **Inventory cheaply.** Use manifests, dependency graphs, references, imports, build scripts, test discovery, package contents, and version-control history before reading every file.
2. **Find ownership.** For each candidate, identify its producer, consumers, replacement, and user-visible effect.
3. **Choose an action.**

```text
keep | simplify | consolidate | replace | move | delete | defer
```

4. **Order by leverage.** Remove wrong foundations and duplicate ownership before polishing leaves.
5. **Apply in reviewable batches.** One coherent concern per batch; re-run the cheapest rejecting check after each.
6. **Regenerate owned outputs through the canonical producer.**
7. **Run the relevant repository gates and one real primary workflow when behavior-adjacent code changed.**

Deletion evidence may be imports/references, runtime discovery, package manifests, generated ownership, history, and focused probes. Absence from one text search is not sufficient when reflection, plugins, generated registration, or external consumers are possible.

## STOP CONDITIONS

Stop and use `ops-ask` when:

- two artifacts appear to own the same contract but the canonical owner is unclear;
- removal changes a public or persistent contract;
- a proposed replacement introduces a material dependency or architecture decision;
- dirty work overlaps the cleanup target and cannot be preserved;
- the current design is so compromised that bounded cleanup is more expensive than a respawn assessment.

Use `ops-nuke` only for the last case after the user explicitly selects a full respawn.

## OUTPUT

```markdown
## Contract
- Maturity:
- Preserved behavior:
- Domains:
- Baseline:

## Actions
| Item | Evidence | Action | Effect | Check |
| --- | --- | --- | --- | --- |

## Deferred
- Item:
- Missing evidence or required decision:

## Result
- Removed or consolidated:
- Complexity reduced:
- Checks:
- Real workflow:
```

`ops-clean` does not commit, distribute, publish, deploy, or replace the default branch unless the user separately requests that workflow.
