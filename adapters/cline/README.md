# Cline adapter

The adapter maps agent-surface sources onto Cline's current file-backed configuration surfaces.

Last runtime probe: Cline CLI `3.0.46` on 2026-07-21, using an isolated user home and project. Cline discovered the generated configured agents, workflow/skill catalog, bundled rule, and both MCP registrations without accessing provider credentials.

## Generated paths

User scope:

- workflows: `~/.cline/workflows/*.md`
- rules: `~/.cline/rules/agent-surface.md`
- scoped rule references: `~/.cline/rules/references/rules/<rule>.md`
- configured agents: `~/.cline/agents/*.yaml`
- external Agent Skills: `~/.cline/skills/<skill>/...`
- MCP: `~/.cline/data/settings/cline_mcp_settings.json`

Project scope:

- workflows: `.clinerules/workflows/*.md`
- rules: `.clinerules/agent-surface.md`
- scoped rule references: `.clinerules/references/rules/<rule>.md`
- configured agents: `.cline/agents/*.yaml`
- external Agent Skills: `.cline/skills/<skill>/...`
- ignore policy: `.clineignore`

`--dest` relocates the selected scope's relative paths under the reviewed destination.

## Runtime contracts

Cline command sources remain workflows. They are not duplicated as Agent Skills.

`registry/targets.json` records normalized render classes, not Cline product labels. The Cline mappings are:

| Render token | agent-surface input | Cline output |
|---|---|---|
| `commands-as-workflows` | `commands/*.md` | workflow Markdown |
| `rules` | `rules/*.mdc` | bundled rules and scoped references |
| `subagents` | `subagents/*.md` | Configured Agent YAML |
| `ignores` | `ignores/*` | `.clineignore` |
| `external` | pinned external skill packs | Agent Skill directories |
| `mcps` | registry-backed MCP services | shared MCP settings |

The repository therefore does have a `subagents` source primitive. For Cline, that primitive compiles to Configured Agents in `.cline/agents/*.yaml`. Cline Configured Agents contain `name`, `description`, an optional tool allowlist, and a non-empty prompt body. The adapter translates normalized subagent access into Cline tool aliases:

- `read-only`: read, search, and skill activation
- `read-write`: read-only tools plus editor tools
- `read-write-shell`: read-write tools plus command execution

Configured Agents are distinct from Cline's built-in `spawn_agent` delegation and persistent agent teams. `spawn_agent` is runtime behavior and needs no generated definition file; agent-team state is created and owned by Cline at runtime.

The bundled rule file contains only always-on rules. Cline's rule loader reads direct files from each rules root and does not recursively activate `references/rules/`; scoped policies remain reference-only until a matching project workflow attaches them.

MCP is user-global. The current shared Cline loader resolves `~/.cline/data/settings/cline_mcp_settings.json`; it does not load the older `.cline/mcp.json` route. Synapse and Grimoire are non-destructively merged into `mcpServers`. External or secret-bearing MCP services remain opt-in.

The current Cline configuration guide and runtime source disagree on the user workflow directory: the guide shows `~/.cline/data/workflows`, while the loader scans `~/.cline/workflows`. The adapter follows the executable loader. Project workflows retain the supported `.clinerules/workflows` compatibility route.

## Not generated

Hooks, plugins, cron specs and scheduling, connectors, provider/model settings, and persistent agent-team state are not generated. agent-surface has no matching source primitive for those configuration or state surfaces. They remain user-, project-, or runtime-owned; executable hooks/plugins and credential-bearing connector/provider settings must not be synthesized from unrelated command, rule, or subagent sources.

Cline's built-in `spawn_agent` subagents are supported by the Cline runtime but are not a configuration surface. They are neither generated nor missing: the generated `subagents` render token refers specifically to Configured Agent YAML.

`.clineignore` is still emitted for project compatibility, but Cline marks the feature for deprecation. The adapter should migrate only after Cline exposes a replacement with equivalent project exclusion behavior.
