# Changelog

Notable changes to agent-surface and its first-party MCP services. Format: [Keep a Changelog](https://keepachangelog.com/); the repo is pre-1.0 and unreleased changes land on `main`.

## [Unreleased]

### Added

- **Agent capability packs** - adds optional Chrome DevTools and IDA Pro MCP wiring plus the Archify interactive diagram renderer.
- **Asset categories and cybersecurity expansion** - separates general, optional external, development, cybersecurity, private, and modding installs without adding a profile layer; development workflows, rules, subagents, and tools are no longer emitted by the general baseline, while `hack-skills` remains available through Grimoire and Fenjing/OpenOSINT/pentest-ai remain opt-in MCPs.
- **`dev-core` staged development skill** - turns an independently specified RED core slice into one runnable architectural spine, then pauses before lower-effort feature expansion.
- **Grimoire MCP (v0.1 package; v1.0 tool contract)** - read-only, just-in-time retrieval over the `anthropic-cybersecurity-skills`, `rev-skills`, and `hack-skills` packs from a self-contained `node:sqlite` FTS5 index. Four tools (`grimoire_search`/`list`/`get`/`file_get`) expose source/license attribution and fail closed on stale provenance.
- **First-party MCP auto-wiring across all 22 MCP-capable hosts** - Synapse + Grimoire are generated and non-destructively merged into each host's native config across JSON, TOML, and YAML families. Full matrix: `docs/reference/targets.md`.
- **2026 runtime portfolio refresh** - adds DSH, Qoder, Qwen Code, and Kiro; upgrades Copilot CLI, Grok Build, Antigravity CLI, and Trae; retires VSCodium; records Amp, Auggie, Crush, and Warp as planned.
- **`doctor` MCP health** — checks linked binaries, the synapse sidecar, and grimoire **index freshness** (installed manifest pin vs the repo registry pin).
- **CI** — a Node-22 `mcp` job runs the grimoire (incl. real-pack eval) and synapse package suites + audits on every PR.

### Changed

- **Curated external portfolio** - keeps strong large skill catalogs in Grimoire, retains evaluated references as source-only submodules, and removes thirteen duplicate or unnecessary checkouts. Karpathy guidance is no longer mirrored because canonical workflow/project rules own the behavior; Sanyuan development distribution now keeps only skill authoring and review.
- **Runtime/model routing refresh** - replaces the June model table with current Codex, Claude, DeepSeek, Grok, Cursor, Kimi, and Ollama Cloud recommendations; refreshes headless command shapes and prefers driver-native subagent or agent-manager tools before subprocess orchestration.
- **`ops-clean` simplification gate** - requires a concrete reduction in owners, layers, dependencies, configuration axes, or failure modes instead of counting rearrangement or raw line changes as simplification.
- **`ops-docs` skill** rewritten to the Diátaxis + minimalism model: aggressive, repo-fit, and concise by default.
- **README** rewritten lean (203 → ~100 lines); the full target matrix moved to `docs/reference/targets.md`.
- **Full-access policy ownership** - Kilo and OpenCode full installs replace the complete permission object with wildcard allow while preserving unrelated top-level settings; category-only MCP installs do not alter host-wide permission or sharing controls.

### Fixed

- **MCP opt-in** — `--category mcps` without `--service` now selects first-party services only; external MCPs such as `pentest-ai` require an explicit `--service`.
- **Install correctness** — `grimoire-index` wrapper resolves the real entrypoint (derived from `package.json#bin`); a missing required pack fails the install (exit 1) non-destructively instead of silently succeeding.
- **Grimoire provenance and lifecycle** - requires explicit attribution, marks Git-less input `uncommitted`, fingerprints complete skill source, cleans failed publication temporaries, and reopens atomic index replacements.
- **Reinstall safety** - cleans exact declared Gemini/VSCodium and adapter-migration routes while preserving outputs still shared with active targets; maintained JSONC, TOML, and YAML libraries preserve unrelated config; Claude Code and Copilot can share the standard project `.mcp.json` route.
- **Synapse cross-project reads** - binds the cursor to the selected project and returns non-mutable cross-project ids, preventing row-id collisions from reaching local `memory_get` or `memory_forget`.

## Components

- Synapse MCP: `v0.4.0` (shared multi-agent memory + file-lock coordination) — `mcps/synapse/`.
- Grimoire MCP: `v0.1.0` (just-in-time skill retrieval) — `mcps/grimoire/`.
