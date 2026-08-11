# GitHub Copilot adapter

Native surfaces:

- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md`
- `AGENTS.md` where supported by the consuming environment

Current implementation writes the global Copilot skill catalog and VS Code/Copilot user instruction surface.

Canonical and reviewed external skill root:

- `~/.copilot/skills/`

Instruction paths, under the VS Code user data directory:

- `instructions/agent-surface-copilot.instructions.md`
- `instructions/references/rules/<rule>.md`

Repository-level `.github/` files remain project-specific and are not written by user-scope installs.

Available high-impact commands use explicit-invocation compatibility skills with `disable-model-invocation: true`; Copilot enforcement remains unproven. VS Code and VSCodium use explicit prompt files instead.

The instruction file bundles only always-on rules. Scoped language policies are distributed as references for project-aware commands.
