# OpenHands Adapter

Generates OpenHands AgentSkills, instructions, external AgentSkills, and user-scope MCP wiring.

## Outputs

- User: `~/.agents/skills/<name>/SKILL.md`
- User: `~/.openhands/skills/agent-surface-rules.md`
- User: `~/.openhands/references/rules/<rule>.md`
- User merge: `~/.openhands/mcp.json` `mcpServers.{synapse,grimoire}`
- Project: `.agents/skills/<name>/SKILL.md`
- Project: `AGENTS.md`
- Project: `.openhands/references/rules/<rule>.md`
- External skills: user/project `.agents/skills/<external-skill>/...`

## Notes

- OpenHands' SDK loads `~/.agents/skills` before `~/.openhands/skills`, so canonical and external skills use the shared AgentSkills root that Codex and Zed also consume.
- High-impact manual commands are omitted because this target has no enforced explicit-only procedure surface.
- Project-level always-on rules use root `AGENTS.md`. User-scope rules render as one legacy OpenHands skill because the verified loader reads user skills but no user-global `AGENTS.md` path was proven.
- First-party MCP wiring (Synapse and Grimoire) is generated and safely merged into `~/.openhands/mcp.json`; external or secret-bearing MCPs remain opt-in.
- OpenHands plugins, hooks, setup scripts, ACP, and model/runtime settings are not generated in this adapter. They remain project-owned surfaces until there is a concrete use case and live proof.
