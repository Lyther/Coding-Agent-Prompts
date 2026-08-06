# Antigravity CLI plugin adapter

Package canonical Agent Skills, always-on rules, scoped rule references, and normalized subagents. High-impact manual commands are omitted because this plugin surface does not enforce explicit-only invocation.

Default user install target:

- `~/.gemini/config/plugins/agent-surface/plugin.json`
- `~/.gemini/config/plugins/agent-surface/README.md`
- `~/.gemini/config/plugins/agent-surface/rules/<always-on-rule>.md`
- `~/.gemini/config/plugins/agent-surface/references/rules/<scoped-rule>.md`
- `~/.gemini/config/plugins/agent-surface/skills/<name>/SKILL.md`
- `~/.gemini/config/plugins/agent-surface/skills/<external-skill>/SKILL.md`
- `~/.gemini/config/plugins/agent-surface/agents/<name>.md`
- `~/.gemini/config/plugins/agent-surface/mcp_config.json` `mcpServers.{synapse,grimoire}`

Validate generated output with:

```bash
agy plugin validate ~/.gemini/config/plugins/agent-surface
```

Canonical skills use the standard directory form. Re-run `agy plugin validate` after Antigravity changes its plugin loader before claiming live plugin compatibility.

External skill packs render only when the optional-service entry declares `skill_roots`. `anthropic-cybersecurity-skills` is kept as a pinned source asset but is not emitted into the Antigravity CLI plugin by default.

The separate `antigravity` binary is a desktop-supervised surface unless current help/probe output proves a headless mode. Gemini CLI is EoL in this project; do not use it as an adapter or as proof that Antigravity CLI plugin packaging works.

Only `alwaysApply: true` rules are packaged under plugin `rules/`. Cybersecurity policy is always-on; scoped language policies are reference files and should be attached by project-aware commands only when applicable.

First-party MCP services (Synapse, Grimoire) are generated and non-destructively merged into the plugin's `mcp_config.json` (`mcpServers` map), which Antigravity discovers from the staged plugin. External or secret-bearing MCPs remain opt-in. Confirm the plugin MCP loads with a live `agy`/Antigravity probe before treating the host as runtime-verified (the file shape follows Antigravity's documented plugin `mcp_config.json` + shared `~/.gemini/config/mcp_config.json`).
