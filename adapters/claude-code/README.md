# Claude Code adapter

Canonical skills are emitted unchanged to Claude Code. The five high-impact commands use the same skill surface with `disable-model-invocation: true`; normalized subagents use Claude Code subagent files.

Implemented target paths:

- user: `~/.claude/skills/<name>/SKILL.md`
- project: `.claude/skills/<name>/SKILL.md`
- user: `~/.claude/agents/<name>.md`
- project: `.claude/agents/<name>.md`
- user merge: `~/.claude.json` `mcpServers.{synapse,grimoire}`
- project merge: `.mcp.json` `mcpServers.{synapse,grimoire}`

Canonical skills may be selected automatically or invoked as `/<name>`. Manual commands remain user-invocable but cannot be selected by the model.

The current subagent batch emits `subagents/{boss,researcher,analyzer,adversary,reviewer,worker}.md` to `.claude/agents/*.md`. First-party MCP wiring (Synapse and Grimoire) is generated and safely merged; external or secret-bearing MCPs remain opt-in.

External skill packs render only when the optional-service entry declares `skill_roots`. `anthropic-cybersecurity-skills` is kept as a pinned source asset but is not emitted into Claude Code skill roots by default.
