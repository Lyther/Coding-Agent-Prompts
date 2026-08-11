---
name: verify-performance
description: "Prove latency, capacity, and concurrency against an explicit baseline — not a vanity P99."
---

## OBJECTIVE

Detect bottlenecks, leaks, and concurrency failures that would break the readiness claim — relative to a stated baseline or SLO, not a generic magic number.

## CORE RULE

Numbers without a baseline are anecdotes.

PASS requires:

- An explicit performance claim or SLO for this scope (from docs, prior run, or user).
- Measurement on a representative workload (prod-like shape, not toy empty DB unless that is the product).
- Comparison to baseline or stated threshold — pass/fail criteria written before the run.
- Concurrency/correctness failures treated as FAIL even if latency looks fine.

If no SLO/baseline exists, produce measurements as `INFORMATIONAL` and verdict `BLOCKED` for any “performance is production-ready” claim — or get the user to set a threshold first.

## PROTOCOL

### Phase 1: Define The Contract

Write one sentence:

- Bad: `API should be fast.`
- Good: `POST /orders P95 ≤ 200ms at 50 RPS for 5m on staging dataset D; error rate < 0.1%; zero lost writes under 5 concurrent clients.`

Record: environment, dataset size, warm vs cold, concurrency, duration, success criteria.

### Phase 2: Micro-Benchmarks (Optional)

Use when algorithmic hotspots are in scope (`vitest bench`, `pytest-benchmark`, `criterion`, `tinybench`).

Micro-benches do not prove system SLOs. Label them clearly.

### Phase 3: System Load

Prefer scriptable load (`k6`, `vegeta`, or repo harnesses).

Scenarios as needed by the claim:

| Scenario | Purpose |
|----------|---------|
| Smoke | 1 user / low RPS — sanity |
| Load | Target concurrency sustained for agreed duration |
| Stress | Ramp to find breaking point (only if claim includes capacity headroom) |

Metrics: P50/P95/P99 latency, error rate, throughput, saturation signals (CPU/RSS/queue depth when available).

### Phase 4: Correctness Under Load

While load runs (or immediately after):

- No lost/duplicate writes where invariants require otherwise.
- No auth bypass or cross-tenant bleed introduced by races.
- Short concurrency smoke on the critical path if not already in `verify-prove`.

Latency PASS with correctness FAIL is FAIL.

### Phase 5: Profile Only On Fail Or Regression

If the contract fails or regresses vs baseline, capture a profile (flamegraph, `cProfile`, etc.) and name the top hotspot. Do not optimize without a failing contract.

## OUTPUT FORMAT

```markdown
# PERFORMANCE REPORT

## Contract
- claim: <SLO sentence>
- baseline: <prior number or none>
- environment: <...>

## Results
- scenario: ...
- P95 / P99: ...
- error rate: ...
- correctness under load: pass|fail

## Comparison
- vs baseline/SLO: pass|fail|informational

## Hotspot (if failed)
- <function or query>: evidence

## Verdict
PASS|FAIL|BLOCKED
```

## HARD RULES

1. No universal `P99 < 100ms` default — thresholds come from the claim or baseline.
2. Cold and warm called out when relevant.
3. Prod-like data volume when the claim is production capacity.
4. Do not claim production performance from laptop-only anecdotes without labeling environment limits.
5. Hand journey proof to `verify-prove`; hand readiness certification to `verify-readiness`.
