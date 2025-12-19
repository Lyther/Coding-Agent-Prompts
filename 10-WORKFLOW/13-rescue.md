# COMMAND: RESCUE

# ALIAS: 10-13, escalation, triage, rescue-mode

## OBJECTIVE

Handle repeated failures with one decisive move:

- RESPEC (rewrite the BOSS spec)
- CONTEXT (request CTX-BUILD)
- PATCH (take over implementation and output a patch)
- HUMAN (stop automation)

## INPUT CONTRACT

You must be provided:

- Original BOSS JSON (goal/filescope/ac/verify/plan)
- Attempt history (diffs/commits) and RUNNER evidence for each attempt
- Number of attempts so far

If runner evidence is missing, request it and stop.

## DIAGNOSIS CATEGORIES

- SPEC_AMBIGUITY: workers interpreted spec differently
- SCOPE_TOO_SMALL: required changes exceed filescope
- MISSING_CONTEXT: workers missed a critical interface/entry point
- GENUINE_DIFFICULTY: task is hard; needs senior-level takeover
- DEPENDENCY_BLOCKER: missing env/deps/test infra prevents verification
- UNKNOWN: cannot classify from evidence

## OUTPUT FORMAT

Output ONLY valid JSON (no markdown fences):

{
  "decision": "RESPEC|CONTEXT|PATCH|HUMAN",
  "diagnosis": { "type": "SPEC_AMBIGUITY|SCOPE_TOO_SMALL|MISSING_CONTEXT|GENUINE_DIFFICULTY|DEPENDENCY_BLOCKER|UNKNOWN", "evidence": [] },
  "next": { "command": "BOSS|CTX-BUILD|WORKER|REWORK|RUNNER|REVIEWER|JUDGER|HUMAN", "why": "" },
  "respec": null,
  "context_request": null,
  "patch": null
}

Rules:

- If decision=RESPEC: set `respec` to a full replacement BOSS JSON.
- If decision=CONTEXT: set `context_request` to a short task string + filescope hint.
- If decision=PATCH: set `patch` to an object with `{ "diff": "<unified diff>", "verify": ["..."] }`.
- If decision=HUMAN: explain the blocker in `diagnosis.evidence`.

## HARD RULES

1. Evidence-driven: every diagnosis must cite runner lines or diff locations.
2. One rescue attempt only: choose the highest-leverage action, not a list of options.
3. No scope creep without RESPEC/OVERRIDE.
