---
name: dev-core
description: "Implement the smallest runnable architectural spine after an independent RED spec, then stop before feature breadth."
---

## OBJECTIVE

Turn an accepted architecture and independently authored RED spec into one production-shaped vertical slice. Prove the real entry point, central ownership, and required dependency or data path without building the remaining product around them.

`dev-core` is for architecture-heavy work where an early implementation decision will shape later development. Skip it for localized features, routine fixes, and mature code paths whose ownership and boundaries are already established.

## POSITION IN THE DEVELOPMENT PATH

```text
arch-roadmap  (family A)
  -> dev-spec (fresh family B)
  -> dev-core (family A, frontier model, xhigh or max when justified)
  -> pause
  -> dev-feature (family A at proportionate effort, or family C)
```

The family labels are relative roles, not fixed vendors. Prefer a different model family for `dev-spec` so it can challenge family A's assumptions. Model diversity reduces correlated blind spots; it does not replace requirement-derived expectations, independent oracles, or real execution.

Assign a frontier model at `xhigh` by default when the runtime supports it. Reserve `max` for unusually hard or expensive-to-reverse decisions. If neither level is available, use the highest validated available effort and report the actual model and effort; report unknown values rather than claiming compliance.

## INPUT GATE

Require:

- an accepted roadmap or equivalent architecture evidence;
- a fresh `dev-spec` result whose expectations come from the user outcome, a standard, a public contract, or another independent oracle;
- a RED test set scoped to the first runnable core slice;
- the current maturity target and the real entry point to exercise.

The first `dev-spec` must not pre-install a full future feature suite that `dev-core` is intentionally not meant to satisfy. If normal repository gates would remain red after the core slice, return to `dev-spec` and narrow the executable contract. Later feature slices may repeat `dev-spec` before `dev-feature`.

## CONTRACT

- Treat the accepted spec and its RED tests as immutable. Implement against them; do not weaken, broaden, delete, skip, or rewrite them.
- If the spec is materially wrong or contradicts the accepted architecture, stop and return the conflict to `dev-spec` or `ops-ask`.
- Preserve the repository stack, existing dependencies, and established local patterns unless the accepted architecture explicitly changes them.
- Use real production paths. No placeholder functions, TODO implementations, fake dependencies, or scaffolding that only compiles.
- Preserve unrelated dirty work.

## CORE METHOD

1. **Load only the governing evidence.** Read the accepted architecture boundaries, the roadmap's first vertical slice, the RED spec, the real entry point, and the smallest set of affected files.
2. **Reuse before construction.** Search the repository, framework, standard library, and installed dependencies for the required capability.
3. **Choose the minimum spine.** Establish only the entry point, central domain owner, necessary side-effect boundary, and real dependency or data path required by the slice.
4. **Implement the slice.** Make the selected journey run end to end. Add no extension point, provider layer, configuration axis, compatibility path, or background mechanism without a present requirement.
5. **Prove it.** Make the focused RED test pass, run the cheapest relevant repository check, and exercise the real entry point with the real primary dependency when available.
6. **Subtract once.** Remove any new layer, helper, state, or option that the proven slice does not exercise or need.
7. **Stop.** Do not continue into feature breadth, secondary journeys, polish, generalized hardening, or a detailed implementation roadmap.

## OUT OF SCOPE

- Optional integrations, second providers, plugin systems, and hypothetical callers.
- Broad compatibility or migration machinery without a current consumer.
- Production, enterprise, scale, observability, or security systems not required by the stated maturity and threat model.
- Exhaustive edge suites, comprehensive documentation, and cleanup outside the core slice.
- Detailed instructions for how another worker should implement the remaining features.

## HANDOFF

Pause after the core slice passes. Return only the minimum durable handoff:

```markdown
## Core Slice
- Runnable path:
- Authoritative boundaries:
- Deliberately absent:

## Proof
- Focused RED-to-green check:
- Real entry-point scenario:
- Model family / effort: known value or unknown

## Delivery
- Changed: full paths
- Status: COMPLETE | IMPLEMENTED BUT UNVERIFIED | BLOCKED
- Blockers: unresolved items and concrete unblock path only

## Next
`dev-feature` for the next accepted behavior slice.
```

Do not commit, publish, or start `dev-feature` unless the user separately requests that workflow.
