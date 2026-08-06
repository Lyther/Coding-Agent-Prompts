# Trae adapter

Current implementation writes Trae's native global skill catalog, global user rules, and MCP config.

Implemented target path:

- `~/.trae/user_rules.md`
- `~/.trae/skills/<name>/SKILL.md`
- `~/.trae/references/rules/<rule>.md`
- `~/.trae/mcp.json` `mcpServers.{synapse,grimoire}`

Known project-level surfaces:

- `.trae/project_rules.md`
- `.trae/mcp.json`

First-party MCP wiring (Synapse and Grimoire) is generated and safely merged. External or secret-bearing MCPs remain opt-in. Canonical and reviewed external skills use the installed Trae version's native global skill root; high-impact commands are omitted.

Generated Trae rules bundle only always-on rules. Scoped language policies are distributed as references for project-aware commands.
