---
name: ops-ask
phase: improve
description: "Clarify a material requirement, evidence conflict, architectural choice, or risky assumption before implementation proceeds."
model_invocation: true
---
## OBJECTIVE

Resolve one material uncertainty without turning normal engineering judgment into repeated human approval.

Use `ops-ask` when the answer can change product behavior, architecture, data, authority, irreversible work, or substantial implementation cost. Do not use it for naming, style, reversible implementation details, or facts that can be discovered from the repository or a live authoritative source.

## TRIGGERS

- The requirement permits materially different outcomes.
- The requested approach conflicts with the stated goal or current evidence.
- The current design is known to be incorrect, but the request assumes it should be extended.
- A better route removes meaningful complexity, cost, risk, or user harm.
- An architectural choice changes a public contract, persistent data, dependencies, deployment shape, or long-term ownership.
- A destructive or irreversible workflow lacks a clear target, preservation boundary, or rollback point.

## PROTOCOL

1. **Investigate first.** Read the relevant code, config, tests, history, and authoritative documentation. Do not ask the user for discoverable facts.
2. **State the shared goal.** Separate the desired outcome from the proposed means.
3. **Name the conflict.** Cite the concrete evidence and the likely impact of continuing.
4. **Recommend one route.** Give the smallest approach that satisfies the goal. Include at most two alternatives when the trade-off is genuinely material.
5. **Ask one focused question.** The answer must unblock the next action.
6. **Pause only the affected mutation.** Continue independent read-only investigation when useful. Do not implement both alternatives or guess through an irreversible choice.

If the user confirms the original route, proceed unless it violates P0 or cannot achieve the stated outcome.

## OUTPUT

```markdown
**Decision Needed**

Goal: <shared outcome>
Conflict: <evidence and impact>
Recommendation: <smallest better route and reason>
Alternative: <optional material alternative and trade-off>
Question: <one answerable question>
```

## ANTI-PATTERNS

- Asking for permission to run an operation already authorized by the task.
- Asking broad questions such as "What do you want?"
- Presenting several cosmetic variants as architecture choices.
- Continuing a known-wrong design because the user named an implementation.
- Treating disagreement as refusal instead of proposing a workable route.
- Stopping the whole task when only one branch of work is uncertain.
