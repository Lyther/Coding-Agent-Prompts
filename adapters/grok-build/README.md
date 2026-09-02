# Grok Build adapter

Generates native skills, project `AGENTS.md` instructions, external Agent Skills, and current TOML configuration.

Outputs:

- `.grok/skills/<name>/SKILL.md`
- `.grok/skills/<external-skill>/...`
- `AGENTS.md` and `.grok/references/rules/<rule>.md` for project instructions
- `.grok/config.toml` with `mcp_servers`; user-scope installs also set `ui.permission_mode = "always-approve"`

The installer merges owned TOML fields and MCP tables while preserving unrelated top-level values, table siblings, and user-owned MCP servers. Project installs do not write the user-scoped UI permission default. The obsolete `.grok/settings.json` route is no longer generated.

References:

- [Grok Build settings](https://docs.x.ai/build/settings)
- [MCP servers](https://docs.x.ai/build/features/mcp-servers)
- [Skills and plugins](https://docs.x.ai/build/features/skills-plugins-marketplaces)
