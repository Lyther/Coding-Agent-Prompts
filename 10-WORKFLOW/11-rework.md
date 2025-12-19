# COMMAND: REWORK

# ALIAS: 10-08, rework-loop, fix-failures, worker-rework

## OBJECTIVE

Fix failures shown in RUNNER evidence with minimal diff.
No scope changes. No refactors. No new features.

## INPUT CONTRACT

You must be provided:

- BOSS JSON (AC + filescope + verify)
- Current diff/commit ref
- RUNNER failure summary + evidence paths/log snippets

If evidence is missing, request RUNNER output instead of guessing.

## PROTOCOL

1. Map each failing gate/test line to a specific code location.
2. Change only what is necessary to address the failure.
3. If a change would violate FILESCOPE, request OVERRIDE or RESPEC.
4. Keep verification commands identical to BOSS `verify`.

## OUTPUT FORMAT

Output ONLY:

1) A unified diff (`git diff` style) in a `diff` fence.
2) A single `text` block containing:
   - `MOTIVATION:` quotes from runner failure lines
   - `VERIFY:` the same ordered commands

## HARD RULES

1. Every change must be directly motivated by runner failure evidence.
2. No cleanup. No formatting. No unrelated edits.
