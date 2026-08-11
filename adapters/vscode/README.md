# VS Code adapter

VS Code uses native Agent Skills for safe reusable procedures and prompt files for available high-impact manual workflows.

Implemented user-profile surfaces:

- `instructions/agent-surface.instructions.md`
- `instructions/references/rules/<rule>.md`
- `prompts/<manual-command>.md`
- `mcp.json` with `servers.{synapse,grimoire}`

Canonical skills and reviewed external skill packs install under `~/.agents/skills/`.

These paths are relative to the VS Code user data directory:

- macOS: `~/Library/Application Support/Code/User`
- Linux: `~/.config/Code/User`
- Windows: `%APPDATA%/Code/User`

Settings, keybindings, and extension recommendations are not merged automatically. First-party MCP wiring (Synapse and Grimoire) is generated and safely merged into `mcp.json`; external or secret-bearing MCPs remain opt-in.

VS Code and Copilot have native MCP and Agent Skills support. Policy-gated extension activation remains outside agent-surface.

Generated instructions bundle only always-on rules. Scoped language policies are distributed as references for project-aware commands.
