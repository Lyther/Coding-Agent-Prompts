# Claude Code adapter

Current implementation renders command sources to Claude Code Agent Skills and normalized subagent sources to Claude Code subagents. Claude Code's legacy `.claude/commands` format is intentionally not generated.

Implemented target paths:

- user: `~/.claude/skills/<name>/SKILL.md`
- project: `.claude/skills/<name>/SKILL.md`
- user: `~/.claude/agents/<name>.md`
- project: `.claude/agents/<name>.md`
- user merge: `~/.claude.json` `mcpServers.{synapse,grimoire}`
- project merge: `.mcp.json` `mcpServers.{synapse,grimoire}`

Generated workflow skills remain user-invocable as `/<name>`. Sources with `model_invocation: true` may also be selected by Claude when their description matches the task; all others render `disable-model-invocation: true`.

The current subagent batch emits `subagents/{boss,researcher,analyzer,adversary,reviewer,worker}.md` to `.claude/agents/*.md`. First-party MCP wiring (Synapse and Grimoire) is generated and safely merged; external or secret-bearing MCPs remain opt-in.

External skill packs render only when the optional-service entry declares `skill_roots`. `anthropic-cybersecurity-skills` is kept as a pinned source asset but is not emitted into Claude Code skill roots by default.
