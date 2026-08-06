# Target matrix (reference)

Every host `agent-surface` renders into, and how much of the source model each represents. Compatibility is 1–5: how much of the source model maps to native or close-native surfaces. Build-file counts are from the default user-scope `npm run build -- --target all` on 60 canonical skills and five manual commands. Ignored local commands are never exported. Project-only or install-only surfaces are noted. First-party MCP services (Synapse, Grimoire) auto-wire (non-destructive merge) into all 19 MCP-capable hosts - JSON, TOML, and YAML config families alike.

| Target | Build files | Auto-invocable skills | Manual-only workflows | Rules / instructions | Agents / subagents | External / MCP / ignores | Compat |
|---|---:|---|---|---|---|---|---:|
| Claude Code | 282 | 60 `.claude/skills/*/SKILL.md` | 5 explicit-only skills | None | 6 `.claude/agents/*.md` | External skills; Synapse + Grimoire in `.claude.json` | 5 |
| Codex | 354 | 60 `.agents/skills/*/SKILL.md` with implicit sidecars | 5 explicit-only `.codex/skills/*/SKILL.md` with non-implicit sidecars | `.codex/AGENTS.md` + 6 scoped refs | 6 `.codex/agents/*.toml` | External skills; Synapse + Grimoire in `.codex/config.toml` | 5 |
| Deep Agents Code | 279 | 60 `.deepagents/agent/skills/*/SKILL.md` | Omitted | `.deepagents/agent/AGENTS.md` + 6 scoped refs | Worker only | External skills; Synapse + Grimoire in `.deepagents/.mcp.json` | 4 |
| Cursor | 295 | 60 `.cursor/skills/*/SKILL.md` | 5 `.cursor/commands/*.md` | 12 native `.cursor/rules/*.mdc` | 6 `.cursor/agents/*.md` | External skills; Synapse + Grimoire; `.cursorignore` | 5 |
| Droid | 289 | 60 `.factory/skills/*/SKILL.md` | 5 `.factory/commands/*.md` | `.factory/AGENTS.md` + 6 scoped refs | 6 `.factory/droids/*.md` | External skills; Synapse + Grimoire | 5 |
| Cline | 290 | 60 `.cline/skills/*/SKILL.md` | 5 `~/Documents/Cline/Workflows/*.md` | Cline rules + 6 scoped refs | 6 `.cline/agents/*.yaml` | External skills; Synapse + Grimoire; `.clineignore` | 5 |
| Kilo | 295 | 60 `~/.kilo/skills/*/SKILL.md` | 5 `.config/kilo/commands/*.md` | 6 always-on rules + 6 scoped refs | 6 `.config/kilo/agents/*.md` | External skills; Synapse + Grimoire; `.kilocodeignore` | 5 |
| Kimi Code | 290 | 60 `$KIMI_CODE_HOME/skills/*/SKILL.md` | 5 explicit-only flow skills | `AGENTS.md` + 6 scoped refs | 6 custom agents | External skills; Synapse + Grimoire; auto permissions | 5 |
| Antigravity CLI | 291 | 60 plugin `skills/*/SKILL.md` | Omitted | 6 always-on rules + 6 scoped refs | 6 plugin agents | External plugin skills; Synapse + Grimoire | 5 |
| Antigravity | 275 | 60 `~/.gemini/config/skills/*/SKILL.md` | 5 legacy workflows | None | None | External skills | 4 |
| GitHub Copilot | 277 | 60 `~/.copilot/skills/*/SKILL.md` | Omitted | VS Code instructions + 6 scoped refs | None | External skills | 4 |
| VS Code | 283 | 60 shared `~/.agents/skills/*/SKILL.md` | 5 prompt files | VS Code instructions + 6 scoped refs | None | External skills; Synapse + Grimoire in the VS Code user profile | 4 |
| VSCodium | 283 | 60 shared `~/.agents/skills/*/SKILL.md` | 5 prompt files | VSCodium instructions + 6 scoped refs | None | External skills; Synapse + Grimoire in the VSCodium user profile | 4 |
| OpenCode | 289 | 60 `.config/opencode/skills/*/SKILL.md` | 5 `.config/opencode/commands/*.md` | `AGENTS.md` + 6 scoped refs | 6 agents | External skills; Synapse + Grimoire; full access; sharing disabled | 5 |
| OpenHands | 278 | 60 `.agents/skills/*/SKILL.md` | Omitted | User rules or project `AGENTS.md`; 6 scoped refs | None | External skills; Synapse + Grimoire | 4 |
| Trae | 278 | 60 `.trae/skills/*/SKILL.md` | Omitted | `.trae/user_rules.md` + 6 scoped refs | None | External skills; Synapse + Grimoire | 4 |
| Goose | 276 | 60 `.agents/skills/*/SKILL.md` | 5 `recipes/*.yaml` | None | None | External skills; Synapse + Grimoire in user config | 4 |
| Grok Build | 271 | 60 `.grok/skills/*/SKILL.md` | Omitted | Project `AGENTS.md` only | None | External skills; Synapse + Grimoire | 4 |
| Pi | 277 | 60 `.pi/agent/skills/*/SKILL.md` | Omitted | `.pi/agent/AGENTS.md` + 6 scoped refs | None | External skills | 4 |
| Poolside | 278 | 60 `.config/poolside/skills/*/SKILL.md` | Omitted | `.poolside` instructions + 6 scoped refs | None | External skills; Synapse + Grimoire | 4 |
| Windsurf | 283 | 60 `.codeium/windsurf/skills/*/SKILL.md` | 5 global workflows | Global rules + 6 scoped refs | None | External skills; Synapse + Grimoire | 5 |
| Zed | 278 | 60 `.agents/skills/*/SKILL.md` | Omitted | `.config/zed/AGENTS.md` + 6 scoped refs | None | External skills; Synapse + Grimoire | 4 |

Bundled instruction targets inline only `alwaysApply: true` rules. Cybersecurity (`04`) and language rules (`10`–`14`) ship as separate reference files under each target's config tree for explicit or project-aware selection. Cursor keeps all 12 as native `.mdc`; Kilo config-merges the 6 always-on rules and keeps the 6 scoped policies as references.

Generated-file presence proves only distribution. `workflow-runtime` separately grades host discovery, native invocation, authentication, full-autonomy execution, exact materialized world state, output contract, and MCP tool calls. A target may therefore be generated while its installed CLI is `BLOCKED`, `PARTIAL`, or `UNREACHABLE` on a particular machine.

## Cline Notes

Cline CLI and the IDE extension share `~/Documents/Cline/Workflows` and `~/Documents/Cline/Rules`, but they do not share one MCP settings file. The CLI reads `~/.cline/data/settings/cline_mcp_settings.json`; VS Code, Cursor, and Windsurf each read the Cline extension's `settings/cline_mcp_settings.json` under that IDE's `globalStorage`. agent-surface merges first-party MCP entries into all four routes and prunes the retired `.cline/mcp.json` route when it owns those entries. On Windows, scope-derived installs honor `%APPDATA%`; explicit `--dest` installs relocate the conventional `AppData/Roaming` subtree under the destination. Project workflows and bundled rules retain the supported `.clinerules` roots, while project agents and skills use `.cline/`.

The Cline `subagents` render token consumes the repository's existing `subagents/*.md` source primitive and emits Cline Configured Agents as `.cline/agents/*.yaml`. It does not refer to Cline's separate built-in `spawn_agent` delegation feature.

Live Cline CLI `3.0.46` probes on 2026-07-25 used its OpenRouter provider with auto-approval. The CLI called `synapse__lock_list` and `grimoire__grimoire_search` through its configured MCP route and returned the required exact result. Running Cursor extension hosts reloaded their updated global-storage config and logged both servers, but no extension-originated MCP tool call was run; extension task-level MCP behavior therefore remains unproven.

Current headless Cline resolves a generated workflow by stem, such as `/workflow-runtime`; `/workflow-runtime.md` falls through as ordinary prompt text. A loaded runtime-audit workflow also cannot safely launch `cline` from inside its own active Cline daemon: the nested process collides with inherited hub state and can produce a false `UNREACHABLE` verdict. `workflow-runtime` now requires bounded inputs, honors inspect-only requests, and blocks same-family self-probes pending an external driver.

Cline's built-in `spawn_agent` delegation is runtime behavior and needs no generated file, so it is neither a missing mapping nor the meaning of the `subagents` render token. Hooks, plugins, scheduling/cron specs, connectors, provider settings, and persistent agent-team state are real Cline configuration or state surfaces but are not generated; agent-surface has no matching source primitive for those surfaces, and several are executable, credential-bearing, or runtime-owned.

## Kimi Code Notes

Kimi Code's TUI, web runtime, and official VS Code-compatible extension share `config.toml`, `mcp.json`, login state, skills, custom agents, and sessions when they resolve the same `KIMI_CODE_HOME` (default `~/.kimi-code`). The extension has no separate home-path setting. Remote extension hosts use the remote machine's home, and the same session must not be opened concurrently because the session store has no cross-process lock.

The target uses Kimi-specific roots rather than generic `.agents` roots so user and project installs remain isolated from other hosts. Canonical `skills/*/SKILL.md` files are emitted unchanged and remain model-invocable. The five high-impact commands become explicit-only `type: flow` skills with `disableModelInvocation: true`. Subagent sources become native custom-agent Markdown with access-specific tool allowlists.

Permission configuration is deliberately split. Full installs merge `default_permission_mode = "auto"` into Kimi's TOML config for unattended terminal/web execution. The official extension exposes only the persistent `kimi.yoloMode` toggle, so user installs set that to `true` in VS Code and Cursor settings while preserving sibling settings. YOLO approves regular tool calls but is not mislabeled as Auto; category-only MCP installs leave both host-wide permission controls untouched.

Live Kimi CLI `0.29.1` probes on 2026-07-27 started the generated project target in the TUI, connected both first-party MCP servers, activated `/skill:ops-flow`, returned its IRON LAW, and called `mcp__synapse__lock_list` through the generated project `mcp.json`. Cursor extension `0.6.4` was inventoried and its shared-home contract was verified from installed code and official documentation, but no extension-originated task or MCP call was run.

## OpenHands Notes

OpenHands support was added from live probes of the installed CLI/SDK. `openhands mcp add` writes `~/.openhands/mcp.json` with an `mcpServers` map, and the CLI accepts the same JSON shape that agent-surface already renders. The SDK loader found project AgentSkills in `.agents/skills`, root `AGENTS.md` as the project instruction file, and user skills in `~/.agents/skills` before `~/.openhands/skills`. Because of that lookup order, user-scope command/external skills intentionally use the shared `.agents/skills` root; OpenHands-specific user rules live in `~/.openhands/skills/agent-surface-rules.md`.

Not generated in the first adapter: plugins (`.plugin/` / `.claude-plugin/`), hooks (`.openhands/hooks.json`), setup scripts, ACP agent wiring, and model/runtime settings. Those are real OpenHands surfaces, but they remain project-owned until a concrete use case and live proof justify adding them.

Out of scope: Gemini CLI (EoL — use Antigravity CLI), Roo Code (EoL), Xcode.
