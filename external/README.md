# Optional External Services

This directory contains optional git submodules that can be wired into local agents and IDEs around `agent-surface`. They are not part of the core compiler surface, and core builds must continue to work without initializing these submodules.

The authoritative optional-service inventory is `registry/optional-services.json`.

## Current Optional Submodules

| Service | Path | Kind | Local wiring |
| --- | --- | --- | --- |
| sanyuan-skills | `external/sanyuan-skills` | skill pack | Codex/agent and Claude skill symlinks for all six skills |
| andrej-karpathy-skills | `external/andrej-karpathy-skills` | skill pack | Codex/agent and Claude skill symlinks for `karpathy-guidelines` |
| ctf-skills | `external/ctf-skills` | skill pack | Codex/agent and Claude CTF skill symlinks |
| pua | `external/pua` | behavior pack | Narrow Codex/agent and Claude wiring for `pua` and `pua-en` only |

## Security Notes

- `pua` is optional-caution. It can increase token usage and may reduce model performance on ordinary tasks, so only the narrow `pua` and `pua-en` skills are wired by default.
- Do not commit private disclosure files, secrets, local MCP credentials, or generated agent config files from home-directory installs.
