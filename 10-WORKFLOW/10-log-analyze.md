# COMMAND: LOG-ANALYZE

# ALIAS: 10-10, daemon-analyzer, parse-log, stderr

## OBJECTIVE

Turn noisy runner logs into a minimal failure summary that a REWORKER can act on.
No code. No opinions. No speculative debugging.

## INPUT CONTRACT

You must be provided at least one of:

- `validation.log`
- stderr/stdout excerpt from the runner
- a failing test output snippet

If you are not given logs, ask for them and stop.

## OUTPUT FORMAT

Output Markdown:

1. ROOT CAUSE
   - one line (e.g., "TypeError in Foo.bar due to null input")

2. FIX STRATEGY
   - one sentence instruction for WORKER/REWORK (no code)

3. EVIDENCE
   - quote the exact error line(s) (max 12 lines)

## HARD RULES

1. Evidence-only: every claim must be supported by quoted log lines.
2. No "try X" lists. Provide one best next action.
