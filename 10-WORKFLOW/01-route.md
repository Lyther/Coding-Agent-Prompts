# COMMAND: ROUTE

# ALIAS: 10-12, router, choose-workflow, cost-router

## OBJECTIVE

Choose the cheapest workflow that still meets risk/quality needs.
Decide: CTX-BUILD vs direct, single WORKER vs swarm, escalate vs stop.

## INPUT CONTRACT

You receive:

- user task description
- any constraints (security, time, cost)
- repo size signals if available (number of files / language / test runner)

If critical info is missing, ask exactly one question; otherwise route with explicit assumptions.

## OUTPUT FORMAT

Output ONLY valid JSON (no markdown fences):

{
  "risk": "low|medium|high",
  "recommended_sequence": ["CTX-BUILD", "BOSS", "WORKERx4", "RUNNER", "REVIEWER", "JUDGER?"],
  "model_budget": {
    "BOSS": "high-reasoning|mid|cheap",
    "CTX-BUILD": "large-context|skip",
    "WORKER": "cheap|mid",
    "REVIEWER": "high-reasoning|mid",
    "JUDGER": "high-reasoning"
  },
  "swarm": { "enabled": true, "count": 4, "why": "" },
  "notes": [],
  "assumptions": [],
  "clarification_question": null
}

## ROUTING HEURISTICS (APPLY SILENTLY)

- High-risk (auth/crypto/money/deletion/security): always BOSS + RUNNER + REVIEWER; consider JUDGER.
- Medium-risk: BOSS + WORKER; RUNNER required; REVIEWER optional if diff is small.
- Low-risk trivial: skip BOSS; use single WORKER + RUNNER.
- Large repo / unknown hotspot: run CTX-BUILD first to avoid token burn.
- Swarm only when implementation choices are non-obvious or failure cost is high.
