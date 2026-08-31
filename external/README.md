# External Services

This directory contains git submodules wired into local agents and IDEs around `agent-surface`. They are not part of the core compiler surface: core builds still work without initializing them.

Source-packs with `status: required` and `served_by: ["grimoire"]` in the registry (currently `anthropic-cybersecurity-skills` and `rev-skills`) must be initialized for `npm run install:grimoire`. Other externals remain optional.

The authoritative optional-service inventory is `registry/optional-services.json`.

## Current Submodules

| Service | Path | Kind | Local wiring |
| --- | --- | --- | --- |
| sanyuan-skills | `external/sanyuan-skills` | skill pack | Codex/agent and Claude skill symlinks for all six skills |
| andrej-karpathy-skills | `external/andrej-karpathy-skills` | skill pack | Codex/agent and Claude skill symlinks for `karpathy-guidelines` |
| ctf-skills | `external/ctf-skills` | skill pack | Codex/agent and Claude CTF skill symlinks |
| anthropic-cybersecurity-skills | `external/anthropic-cybersecurity-skills` | source-pack (Grimoire) | Not mirrored; `grimoire_search` / `grimoire_get` |
| rev-skills | `external/rev-skills` | source-pack (Grimoire) | Not mirrored; `rev-skills:<name>` via Grimoire |

## Security Notes

- Do not commit private disclosure files, secrets, local MCP credentials, or generated agent config files from home-directory installs.
