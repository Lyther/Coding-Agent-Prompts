# COMMAND: OVERRIDE

# ALIAS: 10-05, tweak, unblock, patch-plan, revise-spec

## OBJECTIVE

Surgically adjust a stuck BOSS plan / AC / context packet without rewriting everything.
This is the fastest way to recover when reality disagrees with the spec.

## MODEL SUGGESTION (COST / QUALITY)

- Preferred: any model; use a high-reasoning model when changes are contentious or ambiguous.
- Keep output minimal and directly reusable.

## INPUT CONTRACT

You must be provided:

- The original element to modify (BOSS JSON, or the specific fields)
- The issue observed (error, ambiguity, reviewer feedback, runner log snippet)
- Any constraints from the user

If the requested change introduces new requirements, ask for clarification instead of inventing them.

## OUTPUT FORMAT

Output ONLY valid JSON (no markdown fences):

{
  "target": "plan|ac|verify|filescope|context|risk|mixed",
  "updated": { "plan": [], "ac": [], "context": {}, "risk": {}, "open_questions": [] },
  "delta": ["minimal change list"],
  "reason": "one short sentence"
}

## EXECUTION RULES

1. Keep the delta minimal. Touch only what unblocks progress.
2. Do not add scope silently. If scope expands, make it explicit in `delta` and ask for confirmation.
3. Preserve the handoff: output must remain directly usable by WORKER/REVIEWER.
