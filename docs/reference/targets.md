# Target matrix (reference)

Every host `agent-surface` renders into, and how much of the source model each represents. Compatibility is 1–5: how much of the source model maps to native or close-native surfaces. Build-file counts are from the default user-scope `npm run build -- --target all` on the committed command set; ignored local commands add target-specific outputs. Project-only or install-only surfaces are noted. First-party MCP services (Synapse, Grimoire) auto-wire (non-destructive merge) into all 19 MCP-capable hosts — JSON, TOML, and YAML config families alike.

| Target | Build files | Commands / workflows | Rules / instructions | Agents / subagents | Skills / external packs | Config / MCP / ignores | Compat |
|---|---:|---|---|---|---|---|---:|
| Claude Code | 282 | 65 workflow skills in `.claude/skills/*` with per-workflow invocation policy | None | 6 `.claude/agents/*.md` | External `.claude/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.claude.json` | 4 |
| Codex | 354 | 65 command skills in `.agents/skills/*` with per-workflow invocation policy | `.codex/AGENTS.md` + 6 scoped refs | 6 `.codex/agents/*.toml` | External `.agents/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.codex/config.toml` | 5 |
| Deep Agents Code | 284 | 65 command skills in `.deepagents/agent/skills/*` | `.deepagents/agent/AGENTS.md` + 6 scoped refs | Worker only at `.deepagents/agent/agents/worker/AGENTS.md` | External `.deepagents/agent/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.deepagents/.mcp.json` | 4 |
| Cursor | 85 | 65 native `.cursor/commands/*.md` | 12 native scoped `.cursor/rules/*.mdc` | 6 `.cursor/agents/*.md` | None | Synapse + Grimoire MCP in `.cursor/mcp.json`; `.cursorignore` | 5 |
| Droid | 289 | 65 native `.factory/commands/*.md` | `.factory/AGENTS.md` + 6 scoped refs | 6 `.factory/droids/*.md` | External `.factory/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.factory/mcp.json` | 5 |
| Cline | 290 | 65 workflows in `~/Documents/Cline/Workflows/*.md` | `~/Documents/Cline/Rules/agent-surface.md` + 6 scoped refs | 6 `.cline/agents/*.yaml` | External `.cline/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in CLI settings and VS Code/Cursor/Windsurf extension global storage; `.clineignore` | 5 |
| Kilo | 85 | 65 workflows in `.config/kilo/commands/*.md` | 6 always-on `.config/kilo/rules/*.md` + 6 scoped refs | 6 `.config/kilo/agents/*.md` | None | Synapse + Grimoire MCP, full access, and auto-share disabled in `kilo.jsonc`; `.kilocodeignore` | 5 |
| Kimi Code | 290 | 65 prompt skills in `$KIMI_CODE_HOME/skills/*` with per-workflow invocation policy | `$KIMI_CODE_HOME/AGENTS.md` + 6 scoped refs | 6 `$KIMI_CODE_HOME/agents/*.md` custom agents | External `$KIMI_CODE_HOME/skills/*` (Anthropic excluded) | Synapse + Grimoire in `mcp.json`; terminal Auto in `config.toml`; VS Code/Cursor extension YOLO on install | 5 |
| Antigravity CLI | 296 | 65 plugin skills in `config/plugins/agent-surface/skills/*.md` | 6 always-on rules + 6 scoped refs | 6 `config/plugins/agent-surface/agents/*.md` | External plugin skills (Anthropic excluded) | `plugin.json`; Synapse + Grimoire MCP in `config/plugins/agent-surface/mcp_config.json` | 5 |
| Antigravity (legacy workflows) | 65 | 65 `global_workflows/*.md` | None | None | None | None | 2 |
| GitHub Copilot | 7 | None | `instructions/agent-surface-copilot.instructions.md` + 6 scoped refs | None | None | None | 2 |
| VS Code | 9 | None | `instructions/agent-surface.instructions.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `mcp.json`; `prompts/agent-surface.prompt.md` | 2 |
| VSCodium | 9 | None | `instructions/agent-surface.instructions.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `mcp.json`; `prompts/agent-surface.prompt.md` | 2 |
| OpenCode | 79 | 65 native `.config/opencode/commands/*.md` | `.config/opencode/AGENTS.md` + 6 scoped refs | 6 `.config/opencode/agents/*.md` | None | Synapse + Grimoire MCP, full access, and auto-share disabled in `.config/opencode/opencode.json` | 5 |
| OpenHands | 283 | 65 AgentSkills in `.agents/skills/*` | User legacy `.openhands/skills/agent-surface-rules.md`; project `AGENTS.md`; 6 scoped refs | None | External `.agents/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.openhands/mcp.json` (user-scope) | 4 |
| Trae | 8 | None | `.trae/user_rules.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `.trae/mcp.json` | 2 |
| Goose | 66 | 65 recipes in `recipes/*.yaml` | None | None | None | Synapse + Grimoire MCP in `~/.config/goose/config.yaml` (`extensions`, user-scope) | 3 |
| Grok Build | 276 | 65 command skills in `.grok/skills/*` | Project install emits `AGENTS.md`; default user build emits none | None | External `.grok/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.grok/settings.json` | 4 |
| Pi | 282 | 65 command skills in `.pi/agent/skills/*` | `.pi/agent/AGENTS.md` + 6 scoped refs | None | External `.pi/agent/skills/*` (Anthropic excluded) | None | 4 |
| Poolside | 283 | 65 command skills in `.config/poolside/skills/*` | `.config/poolside/.poolside` + 6 scoped refs | None | External `.config/poolside/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `settings.yaml` (`mcp_servers`) | 4 |
| Windsurf | 283 | 65 workflows in `.codeium/windsurf/global_workflows/*.md` | `.codeium/windsurf/memories/global_rules.md` + 6 scoped refs | None | External `.codeium/windsurf/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.codeium/windsurf/mcp_config.json` | 4 |
| Zed | 283 | 65 command skills in `.agents/skills/*` | `.config/zed/AGENTS.md` + 6 scoped refs | None | External `.agents/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.config/zed/settings.json` | 4 |

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

The target uses Kimi-specific roots rather than generic `.agents` roots so user and project installs remain isolated from other hosts. Command sources become directory-form `type: prompt` skills invoked explicitly as `/skill:<name>`. A small `model_invocation` allowlist renders `disableModelInvocation: false`; other workflows remain explicit-only. Subagent sources become native custom-agent Markdown with access-specific tool allowlists.

Permission configuration is deliberately split. Full installs merge `default_permission_mode = "auto"` into Kimi's TOML config for unattended terminal/web execution. The official extension exposes only the persistent `kimi.yoloMode` toggle, so user installs set that to `true` in VS Code and Cursor settings while preserving sibling settings. YOLO approves regular tool calls but is not mislabeled as Auto; category-only MCP installs leave both host-wide permission controls untouched.

Live Kimi CLI `0.29.1` probes on 2026-07-27 started the generated project target in the TUI, connected both first-party MCP servers, activated `/skill:ops-flow`, returned its IRON LAW, and called `mcp__synapse__lock_list` through the generated project `mcp.json`. Cursor extension `0.6.4` was inventoried and its shared-home contract was verified from installed code and official documentation, but no extension-originated task or MCP call was run.

## OpenHands Notes

OpenHands support was added from live probes of the installed CLI/SDK. `openhands mcp add` writes `~/.openhands/mcp.json` with an `mcpServers` map, and the CLI accepts the same JSON shape that agent-surface already renders. The SDK loader found project AgentSkills in `.agents/skills`, root `AGENTS.md` as the project instruction file, and user skills in `~/.agents/skills` before `~/.openhands/skills`. Because of that lookup order, user-scope command/external skills intentionally use the shared `.agents/skills` root; OpenHands-specific user rules live in `~/.openhands/skills/agent-surface-rules.md`.

Not generated in the first adapter: plugins (`.plugin/` / `.claude-plugin/`), hooks (`.openhands/hooks.json`), setup scripts, ACP agent wiring, and model/runtime settings. Those are real OpenHands surfaces, but they remain project-owned until a concrete use case and live proof justify adding them.

Out of scope: Gemini CLI (EoL — use Antigravity CLI), Roo Code (EoL), Xcode.
