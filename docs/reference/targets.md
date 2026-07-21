# Target matrix (reference)

Every host `agent-surface` renders into, and how much of the source model each represents. Compatibility is 1–5: how much of the source model maps to native or close-native surfaces. Build-file counts are from the default user-scope `npm run build -- --target all` on the committed command set; ignored local commands add target-specific outputs. Project-only or install-only surfaces are noted. First-party MCP services (Synapse, Grimoire) auto-wire (non-destructive merge) into all 18 MCP-capable hosts — JSON, TOML, and YAML config families alike.

| Target | Build files | Commands / workflows | Rules / instructions | Agents / subagents | Skills / external packs | Config / MCP / ignores | Compat |
|---|---:|---|---|---|---|---|---:|
| Claude Code | 311 | 66 native `.claude/commands/<group>/<name>.md` | None | 6 `.claude/agents/*.md` | External `.claude/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.claude.json` | 4 |
| Codex | 384 | 66 command skills in `.agents/skills/*` | `.codex/AGENTS.md` + 6 scoped refs | 6 `.codex/agents/*.toml` | External `.agents/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.codex/config.toml` | 5 |
| Deep Agents Code | 313 | 66 command skills in `.deepagents/agent/skills/*` | `.deepagents/agent/AGENTS.md` + 6 scoped refs | Worker only at `.deepagents/agent/agents/worker/AGENTS.md` | External `.deepagents/agent/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.deepagents/.mcp.json` | 4 |
| Cursor | 86 | 66 native `.cursor/commands/*.md` | 12 native scoped `.cursor/rules/*.mdc` | 6 `.cursor/agents/*.md` | None | Synapse + Grimoire MCP in `.cursor/mcp.json`; `.cursorignore` | 5 |
| Droid | 318 | 66 native `.factory/commands/*.md` | `.factory/AGENTS.md` + 6 scoped refs | 6 `.factory/droids/*.md` | External `.factory/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.factory/mcp.json` | 5 |
| Cline | 75 | 66 workflows in `.cline/data/workflows/*.md` | `.cline/rules/agent-surface.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `.cline/mcp.json`; `.clineignore` | 4 |
| Kilo | 86 | 66 workflows in `.config/kilo/commands/*.md` | 6 always-on `.config/kilo/rules/*.md` + 6 scoped refs | 6 `.config/kilo/agents/*.md` | None | Synapse + Grimoire MCP + instructions in `kilo.jsonc`; `.kilocodeignore` | 5 |
| Antigravity CLI | 325 | 66 plugin skills in `config/plugins/agent-surface/skills/*.md` | 6 always-on rules + 6 scoped refs | 6 `config/plugins/agent-surface/agents/*.md` | External plugin skills (Anthropic excluded) | `plugin.json`; Synapse + Grimoire MCP in `config/plugins/agent-surface/mcp_config.json` | 5 |
| Antigravity (legacy workflows) | 66 | 66 `global_workflows/*.md` | None | None | None | None | 2 |
| GitHub Copilot | 7 | None | `instructions/agent-surface-copilot.instructions.md` + 6 scoped refs | None | None | None | 2 |
| VS Code | 9 | None | `instructions/agent-surface.instructions.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `mcp.json`; `prompts/agent-surface.prompt.md` | 2 |
| VSCodium | 9 | None | `instructions/agent-surface.instructions.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `mcp.json`; `prompts/agent-surface.prompt.md` | 2 |
| OpenCode | 80 | 66 native `.config/opencode/commands/*.md` | `.config/opencode/AGENTS.md` + 6 scoped refs | 6 `.config/opencode/agents/*.md` | None | Synapse + Grimoire MCP in `.config/opencode/opencode.json` | 5 |
| OpenHands | 312 | 66 AgentSkills in `.agents/skills/*` | User legacy `.openhands/skills/agent-surface-rules.md`; project `AGENTS.md`; 6 scoped refs | None | External `.agents/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.openhands/mcp.json` (user-scope) | 4 |
| Trae | 8 | None | `.trae/user_rules.md` + 6 scoped refs | None | None | Synapse + Grimoire MCP in `.trae/mcp.json` | 2 |
| Goose | 67 | 66 recipes in `recipes/*.yaml` | None | None | None | Synapse + Grimoire MCP in `~/.config/goose/config.yaml` (`extensions`, user-scope) | 3 |
| Grok Build | 305 | 66 command skills in `.grok/skills/*` | Project install emits `AGENTS.md`; default user build emits none | None | External `.grok/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.grok/settings.json` | 4 |
| Pi | 311 | 66 command skills in `.pi/agent/skills/*` | `.pi/agent/AGENTS.md` + 6 scoped refs | None | External `.pi/agent/skills/*` (Anthropic excluded) | None | 4 |
| Poolside | 312 | 66 command skills in `.config/poolside/skills/*` | `.config/poolside/.poolside` + 6 scoped refs | None | External `.config/poolside/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `settings.yaml` (`mcp_servers`) | 4 |
| Windsurf | 312 | 66 workflows in `.codeium/windsurf/global_workflows/*.md` | `.codeium/windsurf/memories/global_rules.md` + 6 scoped refs | None | External `.codeium/windsurf/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.codeium/windsurf/mcp_config.json` | 4 |
| Zed | 312 | 66 command skills in `.agents/skills/*` | `.config/zed/AGENTS.md` + 6 scoped refs | None | External `.agents/skills/*` (Anthropic excluded) | Synapse + Grimoire MCP in `.config/zed/settings.json` | 4 |

Bundled instruction targets inline only `alwaysApply: true` rules. Cybersecurity (`04`) and language rules (`10`–`14`) ship as separate reference files under each target's config tree, selected by project-aware commands such as `boot-new`. Cursor keeps all 12 as native `.mdc`; Kilo config-merges the 6 always-on rules and keeps the 6 scoped policies as references.

## OpenHands Notes

OpenHands support was added from live probes of the installed CLI/SDK. `openhands mcp add` writes `~/.openhands/mcp.json` with an `mcpServers` map, and the CLI accepts the same JSON shape that agent-surface already renders. The SDK loader found project AgentSkills in `.agents/skills`, root `AGENTS.md` as the project instruction file, and user skills in `~/.agents/skills` before `~/.openhands/skills`. Because of that lookup order, user-scope command/external skills intentionally use the shared `.agents/skills` root; OpenHands-specific user rules live in `~/.openhands/skills/agent-surface-rules.md`.

Not generated in the first adapter: plugins (`.plugin/` / `.claude-plugin/`), hooks (`.openhands/hooks.json`), setup scripts, ACP agent wiring, and model/runtime settings. Those are real OpenHands surfaces, but they remain project-owned until a concrete use case and live proof justify adding them.

Out of scope: Gemini CLI (EoL — use Antigravity CLI), Roo Code (EoL), Xcode.
