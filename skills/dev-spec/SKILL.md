---
name: dev-spec
description: "Define a development change with discriminating RED tests that fail for the intended behavioral reason before implementation."
---

## OBJECTIVE

Turn a requirement into executable checks that fail on the current tree and pass only when the requested behavior is correct.

This is a development workflow: it defines the contract and writes RED tests or interfaces before production implementation. It does not certify an existing implementation and does not replace `verify-test`, `verify-prove`, or `verify-readiness`.

## INPUTS

- Exact user outcome and acceptance criteria.
- Current behavior through the real entry point.
- Interfaces, inputs, outputs, errors, and invariants.
- Risk surfaces such as auth, money, persistence, concurrency, parsing, and idempotency.

If a material product or architecture choice remains unresolved, use `ops-ask` before fixing it into tests.

## DISCRIMINATION GATE

A development spec is accepted only when:

- each new test fails on the current tree for the intended behavioral reason, not only because a symbol or dependency is missing;
- success, failure, boundary, and invariant behavior are represented where applicable;
- expectations come from the requirement, a standard, a human-locked example, or an independent property rather than copied implementation output;
- a constant-returning stub, weakened assertion, skipped path, or transcript-only result cannot satisfy it;
- the test uses the real implementation and data path unless a substitute passes the repository's necessity gate;
- the planned implementation can remain proportionate to the requested maturity.

## PROTOCOL

1. **Locate the contract.** Read the current entry point, tests, types, public docs, and callers.
2. **Write the behavior table.**

```text
Case | Input/state | Observable outcome | Error/effect | Invariant
```

3. **Choose independent oracles.** Prefer standards-derived vectors, state invariants, metamorphic relations, or externally observable outcomes.
4. **Write the smallest test set that distinguishes the change.** Do not generate a broad suite merely to increase coverage.
5. **Run the focused test on the current tree.** Capture the exact intended failure.
6. **Run an anti-cheat probe when risk warrants it.** Confirm a trivial constant or no-op implementation would still fail.
7. **Stop before production implementation.** Hand the accepted spec to `dev-feature` or `dev-fix`.

## TEST SHAPES

- Example tests for named product behavior.
- Property tests for broad input domains and invariants.
- Metamorphic tests when no simple expected output exists.
- Contract tests at public boundaries.
- Real integration tests when the behavior depends on persistence, auth, networking, or another component.

Test substitutes are default-denied. A justified substitute remains diagnostic and cannot prove the replaced boundary; unavailable real prerequisites make that proof `BLOCKED`.

## VERDICT

- `PASS`: the focused RED run failed for the intended reason and the discrimination gate is satisfied.
- `FAIL`: the test passed prematurely, failed for setup/import reasons, used a circular oracle, or can be cheated trivially.
- `BLOCKED`: the real dependency or environment needed to define the behavior is unavailable.

## OUTPUT

```markdown
## Contract
- Outcome:
- Preserved behavior:
- Cases and invariants:

## RED Evidence
- Command:
- Intended failure:
- Anti-cheat result:

## Proof Boundary
- Real components exercised:
- Blocked or substitute-backed boundaries:

## Verdict
PASS | FAIL | BLOCKED
```
