# OpenCode adapter

Canonical skills use OpenCode's native skill root. Available high-impact commands remain custom commands; normalized subagents and rules use their native OpenCode surfaces.

Implemented target paths:

- user: `~/.config/opencode/commands/*.md`
- user: `~/.config/opencode/skills/<name>/SKILL.md`
- user: `~/.config/opencode/agents/<name>.md`
- user: `~/.config/opencode/AGENTS.md` for always-on rules
- user: `~/.config/opencode/references/rules/<rule>.md`
- user merge: `~/.config/opencode/opencode.json` `mcp.{synapse,grimoire}`
- project: `.opencode/commands/*.md`
- project: `.opencode/skills/<name>/SKILL.md`
- project: `.opencode/agents/<name>.md`
- project: `AGENTS.md` plus `.opencode/references/rules/<rule>.md`
- project merge: `.opencode/opencode.json` `mcp.{synapse,grimoire}`

First-party MCP wiring (Synapse and Grimoire) is generated and safely merged. External or secret-bearing MCPs remain opt-in. Reviewed external skill packs use the same native skill roots as canonical skills.

Native plugin packaging remains future generated-surface work:

- `opencode mcp`
- `opencode plugin`

Generated instruction files bundle only always-on rules. Scoped language policies are reference files for project-aware commands.
