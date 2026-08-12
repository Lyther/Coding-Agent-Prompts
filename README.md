# agent-surface

Write your coding-agent setup **once**, render it into **every** agent host.

Reusable workflows, rules, subagents, external skill packs, ignore files, and first-party MCP services live once in this repo's source tree. `agent-surface` compiles them into the native formats of twenty-two host targets — Claude Code, Codex, Cursor, Droid, Kilo, Kimi Code, Zed, OpenCode, OpenHands, and more — so you maintain one source instead of twenty-two bespoke configs.

It is a **source compiler**, not an app: there is no `src/`. Typed source primitives in → host-native surfaces out, validated by `check` and tracked by per-target manifests.

## Quick start

```bash
npm ci
npm run check                      # validate source, registry, generated output
npm test                           # integration tests
npm run build -- --target all      # render every target into dist/
```

Preview an install before touching disk, then apply it:

```bash
node scripts/agent-surface.mjs install --target claude-code --scope user --dry-run
node scripts/agent-surface.mjs install --target claude-code --scope user --allow-scope-root
npm run install:mcps               # build + link the Synapse/Grimoire binaries the wired MCP configs point at
```

The `install` step wires each host's MCP *config* to point at `~/.local/bin/synapse-bridge` and `~/.local/bin/grimoire-server`; `npm run install:mcps` builds and links those binaries (and deploys the Synapse sidecar service). Run it once — the two steps together are what makes MCP actually connect.

## What it does

- **Compiles source primitives** — `skills/`, manual-only `commands/`, `rules/`, `subagents/`, external packs, and `ignores/` become per-target outputs via explicit producers.
- **Speaks each host natively** — each target gets the surfaces it understands: commands, workflows, skills, instructions, plugins, rules, subagents, MCP config, or ignore files.
- **Wires first-party MCP** — Synapse (shared memory) and Grimoire (just-in-time skill retrieval) auto-merge, secretlessly and non-destructively, into all 19 MCP-capable hosts (JSON, TOML, and YAML config families).
- **Installs deterministically** — dry-run previews, project-scope gating, manifest tracking, generated-file strict-sync, and non-destructive config merges that preserve unknown sibling entries.

## Supported targets

Twenty-two targets, ranked 1–5 by how much of the source model maps to native surfaces. Every supported agent runtime receives the canonical skill catalog, all configured external skill packs, and every high-impact manual command. Commands use a native explicit surface where one exists and an explicit-invocation compatibility skill otherwise.

**Full matrix — per-target surfaces, file counts, and MCP wiring: [docs/reference/targets.md](docs/reference/targets.md).**

Out of scope: Gemini CLI (EoL — use Antigravity CLI), Roo Code (EoL), Xcode.

## Project layout

```text
skills/      Vanilla Agent Skills, model-invocable by default
commands/    High-impact workflows that require explicit user invocation
rules/       Always-on or scoped behavior policy
subagents/   Normalized subagent definitions
mcps/        First-party MCP services (synapse, grimoire)
ignores/     Project ignore templates
registry/    Target, capability, optional-service, and source-kind policy
schemas/     JSON schemas for registry and workflow artifacts
scripts/     CLI compiler and helpers
adapters/    Per-target install docs (one README each)
external/    Optional git-submodule skill/service packs
```

Local IDE overlays (`.cursor/`, `.claude/`, `.kilo/`, …) stay gitignored on maintainer machines; `build`/`install` render committed source into them.

## Commands

```bash
node scripts/agent-surface.mjs inventory          # source counts
node scripts/agent-surface.mjs check              # full validation (skills, manual commands, rules, generated, registry)
node scripts/agent-surface.mjs doctor             # repo health summary
node scripts/agent-surface.mjs skills --json      # auto-invocable skill catalog (add --phase <phase> to filter)
node scripts/agent-surface.mjs commands --json    # explicit-only command catalog
node scripts/agent-surface.mjs build --target <t> --dry-run
node scripts/agent-surface.mjs install --target <t> --scope user --dry-run
```

`install` accepts repeated/comma-separated `--target` (or `--runtime`) IDs and `--category` outputs (`commands`, `rules`, `subagents`, `skills`, `recipes`, `mcps`, `external`, `instructions`, `prompts`, `plugins`, `ignores`). `--service <id>` narrows `--category mcps` to one service.

## Install behavior

- Sync-oriented: existing managed files are overwritten; manifests let stale outputs be pruned on the next install.
- Project-only artifacts (`ignores/`) are skipped on user-scope installs — pass `--dest <project>` to write them.
- A live write to the real scope root needs `--allow-scope-root` (or an explicit `--dest`) after a dry-run.
- First-party secretless MCPs (Synapse, Grimoire) are generated by default for MCP-capable targets and **merged** into existing host config; external/secret-bearing MCPs stay opt-in via `--category mcps --service <id>`.
- External skill packs (the in-scope optional packs) are included in a full install and pruned by strict-sync when they leave scope; `--category external` narrows an install to external packs only. The 754-skill `anthropic-cybersecurity-skills` pack is deliberately **not** emitted (it is a `source-pack` with no `skill_roots`) and is served just-in-time by Grimoire instead.
- Install manifests in `.agent-surface/<target>-manifest.json` track generated files and owned config entries. Full installs overwrite current generated assets, remove previously owned stale assets, and preserve unknown sibling config entries.

## First-party MCP services

Built from `mcps/`, installed once, then auto-wired (non-destructive merge) into all 19 MCP-capable hosts across JSON/TOML/YAML config families — see [docs/reference/targets.md](docs/reference/targets.md):

- **Synapse** — shared multi-agent memory + file-lock coordination.
- **Grimoire** — read-only, just-in-time retrieval over large Agent-Skill packs (serves the 754-skill `anthropic-cybersecurity-skills` pack so the model searches for a skill instead of loading a 750-entry catalog).

`npm run install:mcps` builds both binaries and links them into `~/.local/bin` (Synapse also deploys its sidecar service); the agent-surface `install` step merges each server into every host's MCP config. Both steps are required — one wires the config, the other provides the binary it points at. (`npm run install:synapse` / `install:grimoire` install just one.) Details: [mcps/synapse/README.md](mcps/synapse/README.md), [mcps/grimoire/README.md](mcps/grimoire/README.md).

## Workflow kernel (optional)

`ops-flow` chooses the lightest safe profile: direct, standard single-owner development, writer-plus-reviewer, formal orchestration, or release proof. Only orchestrated/release profiles use the durable ledger under `.agent-surface/workflows/<run_id>/`; `workflow-runtime` qualifies external/native runtimes, `workflow-doctor` rejects schema, task-state, and liveness drift, and `verify-readiness` gates production-ready claims on real evidence.

`workflow-runtime` treats generated artifacts, skill discovery, provider authentication, permission mode, tool execution, world-state materialization, output shape, and MCP calls as separate gates. This user distribution launches writable workers with each host's full-access equivalent while preserving read-only tool profiles for reviewer and analysis roles. Kilo and OpenCode config explicitly disables automatic session sharing. Kimi Code uses terminal Auto mode and the extension's highest persistent mode, YOLO. Codex receives canonical and manual workflows through its standard `.agents/skills` root: canonical skills allow implicit invocation, while the five committed high-impact workflows and any ignored local command overlays set `allow_implicit_invocation: false` and remain available through explicit `$<name>` invocation.

## More

- Per-target install detail: `adapters/<target>/README.md`.
- Source-kind and capability policy: `registry/source-kinds.json`, `registry/target-capabilities.json`.

## License

MIT
