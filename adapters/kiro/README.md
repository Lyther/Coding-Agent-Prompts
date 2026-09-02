# Kiro adapter

One Kiro target covers the installed IDE and CLI because they share the current `.kiro` formats. It generates native Agent Skills, steering, Markdown custom agents, capability permissions, first-party MCP wiring, and reviewed external skills.

Always-on and file-matched source rules map to steering inclusion modes. High-impact workflows map to `inclusion: manual`, so they appear in slash completion but do not auto-load. Custom agents reference both steering and skill roots and map normalized access to current tool tags and capability rules.

User installs emit `~/.kiro/settings/permissions.yaml` with `capability: all` / `effect: allow`. Headless acceptance uses `kiro-cli chat --no-interactive --trust-all-tools`; immutable Kiro restrictions still apply. MCP lives at `.kiro/settings/mcp.json` in the selected user or project root.

References:

- [Skills](https://kiro.dev/docs/cli/skills/)
- [Steering](https://kiro.dev/docs/steering/)
- [Custom agents](https://kiro.dev/docs/custom-agents/configuration-reference/)
- [Permissions](https://kiro.dev/docs/cli/chat/permissions/)
- [Headless mode](https://kiro.dev/docs/cli/headless/)
