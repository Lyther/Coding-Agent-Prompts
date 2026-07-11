---
name: verify-spec
phase: verify
description: "Write the definition of done as tests that fail for the right reason before code exists."
---
## OBJECTIVE

Turn the requirement into executable checks that fail on today's tree and will only pass when the behavior is actually correct.

This is the RED step: spec first, implementation later. A spec that passes immediately, or fails only because a symbol is missing, has proven nothing. The test must fail because the **behavior** is wrong, and it must be hard to make pass by cheating.

## CORE RULE

A spec is trustworthy only if it discriminates.

PASS (spec accepted) requires:

- Each new test **fails on the current tree for the intended behavioral reason** — not merely a compile/import error.
- Success, failure, boundary, and invariant behavior are all specified, not just the happy path.
- The oracle is independent of the implementation under test (spec-derived expectations, injected fakes, or properties) — never values pasted from a future run.
- The spec cannot be satisfied by a tautology, a hard-coded return, or a weakened assertion.

FAIL the spec if it only checks the happy path, asserts identity/`true`, or would pass against a stub that returns a constant.

## INPUTS

- The requirement (mission file if present, otherwise exact user intent) and its acceptance criteria.
- The interface/contract shape (types, inputs, outputs, error classes) for the unit under spec.
- Risk surface: money, auth, persistence, concurrency, parsing, idempotency.

## RULE: NO IMPLEMENTATION

You may write tests, interfaces, and in-memory fakes only. Do not write the production implementation in this phase — that is `dev-feature`'s job.

## PROTOCOL

### Phase 1: Contract First

1. Define the types/interfaces for inputs, outputs, and **typed errors** (not string errors).
2. Prefer dependency injection over `jest.mock()`/monkeypatch: a DB becomes a `Repository` interface, time becomes a `Clock`. Generate in-memory fakes for them so tests stay hermetic without mocking the unit under test.

### Phase 2: Behavior Classes (all four, not "the critical three")

Specify each class that applies to the surface:

- **Happy path**: valid input → correct, asserted output shape and value.
- **Sad path**: invalid input / dependency failure → the correct typed error, and safe state (fails closed, nothing half-written).
- **Boundary / equivalence partitions**: for each input, one representative from each valid class plus the edges and the invalid side — empty, null, min, max, min−1, max+1, huge, unicode/RTL, duplicates.
- **Invariants (properties)**: state what must hold *for all* inputs and encode it with property-based testing (`fast-check`, `hypothesis`, QuickCheck) — e.g. "a withdrawal never yields a negative balance", "encode∘decode is identity", "the operation is idempotent under retry". Prefer these for money, crypto, serialization, merges, and idempotency.

When there is no obvious oracle, use a **metamorphic relation** instead of a hard-coded expectation: assert a relationship between runs (e.g. `sort(xs)` and `sort(shuffle(xs))` are equal; `GET` twice returns the same result) so the test does not depend on knowing the exact right answer.

### Phase 3: Prove the Spec Bites (RED, for the right reason)

1. Run the new tests against the current tree.
2. Each must FAIL — and the failure must be a **behavioral assertion failure**, not just "symbol not defined". If the only failure is a missing import, add a minimal stub that returns a wrong/constant value and confirm the test still fails; a test a constant-returning stub can satisfy is too weak.
3. Record the observed red failure per test as evidence for the downstream `verify-test` regression check.

### Phase 4: Anti-Cheat Guard

- No `expect(true).toBe(true)`, identity assertions, or empty test bodies.
- No expected values copied from a run of the (unwritten or draft) implementation.
- Readable intent names: `it('rejects a just-expired token')`, not `test1`.
- No `setTimeout`/real clock/real network flakiness — use the injected `Clock` and fakes.
- Data builders/factories (`makeUser({...overrides})`) instead of giant inline literals, so the assertion, not the fixture noise, is what's under review.

## OUTPUT FORMAT

```markdown
# SPEC (RED)

## Contract
- interface + typed errors defined

## Behavior classes
- happy: <it names>
- sad: <it names> (typed error + safe state)
- boundary: <partitions covered>
- invariants/properties: <property names + tool>
- metamorphic: <relations, if oracle-free>

## RED proof
- <test>: fails on current tree — reason: behavioral (not just missing symbol)
- constant-stub check: still fails → discriminating

## Verdict
SPEC READY | NEEDS STRENGTHENING
```

## HARD RULES

1. **Red for the right reason.** A test that only fails on a missing import is not yet a spec; make a constant-returning stub still fail it.
2. **All four behavior classes**, not just the happy path. Sad/boundary/invariant are where AI code breaks.
3. **Independent oracle.** Never derive expected values from the implementation; prefer spec constants, properties, or metamorphic relations.
4. **No implementation here.** Only tests, interfaces, and fakes.
5. **No cheating to green.** Tautologies, identity asserts, and empty tests are rejected.
6. Hand implementation to `dev-feature`, discrimination scoring to `verify-coverage`, hostile inputs to `verify-edge`.
