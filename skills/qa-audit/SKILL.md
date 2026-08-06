---
name: qa-audit
description: "Audit a project or system across code, architecture, security, dependencies, tests, operations, and repository integrity."
---

## OBJECTIVE

Perform an evidence-backed audit at the depth justified by the project's maturity, exposed risks, and requested claim. Security is one audit domain, not a separate mandatory ceremony.

`qa-audit` is broad and read-only. Use `qa-review` for a focused review of a current diff and `qa-trace` for deep root-cause, dataflow, race, or exploitability tracing. Route accepted remediation through the appropriate development or operations workflow.

## INPUT

```text
qa-audit [target]
  [--domain architecture|code|security|dependencies|tests|operations|repository|all]
  [--depth quick|standard|deep]
  [--maturity prototype|mvp|core|usable|production|business|auto]
```

Defaults: `--domain all --depth standard --maturity auto`.

## SCOPE GATE

Before running tools, resolve:

- the target tree, artifact, service, or deployment;
- the maturity and claim being assessed;
- the user-visible and externally reachable surfaces;
- applicable repository policy, threat boundaries, and acceptance evidence;
- exclusions and unavailable real dependencies.

Do not apply production, enterprise, compliance, or supply-chain requirements to a prototype or MVP unless its actual data, exposure, or contract requires them. Do not lower the bar for auth, secrets, destructive effects, money, or sensitive data merely because the project is early.

## AUDIT DOMAINS

### Architecture

- Does the design serve the current outcome, or preserve a disproven premise?
- Are ownership, state, dataflow, and failure boundaries clear?
- Are abstractions, services, compatibility layers, and configuration axes earned?
- Is there one source of truth, or duplicated authority and synchronization?

### Code

- Trace primary behavior and failure paths through real entry points.
- Find correctness defects, swallowed errors, unsafe state transitions, races, leaks, and user-visible regressions.
- Flag duplicate implementations, dead paths, speculative frameworks, and hand-built substitutes for proven local or standard capabilities.

### Security

- Build a threat model from real assets, actors, trust boundaries, and reachable inputs.
- Review authentication, authorization, secrets, injection, data exposure, unsafe defaults, destructive actions, and dependency risk where applicable.
- Reproduce findings safely when possible. Severity must reflect reachability, prerequisites, impact, and confidence.
- SBOMs, provenance, SAST suites, KEV/EPSS correlation, signing, and compliance controls are required only when the release, deployment, customer, or regulatory contract calls for them.

### Dependencies

- Identify unused, duplicated, vulnerable, abandoned, unpinned, or unjustifiably heavy dependencies.
- Verify current advisories and maintenance from authoritative sources before making time-sensitive claims.
- Compare a proposed dependency with the existing stack and a small local implementation; include license, install scripts, native code, transitive footprint, compatibility, and lockfile impact.

### Tests

- Check whether tests discriminate real faults and use independent oracles.
- Reject unjustified substitutes, tautological assertions, skip/xfail drift, mock-only boundary proof, and tests that pass on the pre-fix tree.
- Separate diagnostic test results from real integration, E2E, acceptance, and readiness evidence.

### Operations

- Review configuration, observability, deployment, migration, rollback, recovery, idempotency, resource limits, and failure visibility at the maturity actually claimed.
- Treat unavailable real environments as `BLOCKED`, not passed.

### Repository

- Find dead files, temporary artifacts, stale scripts, generated debris, broken references, misleading docs, obsolete configs, duplicate assets, and ownership ambiguity.
- Distinguish tracked product artifacts from ignored local state and generated outputs.

## METHOD

1. Inventory the target at low resolution.
2. Select only applicable domains and tools.
3. Trace the highest-impact surfaces first.
4. Confirm each finding against source, runtime evidence, or an authoritative external source.
5. Remove duplicates and non-findings; do not inflate severity.
6. Report proof gaps separately from defects.

Read-only probes may run in parallel. Keep one synthesis owner. Do not mutate the target, install remediations, weaken gates, or create a findings file unless the user requests it.

## VERDICT

- `FAIL`: at least one confirmed Critical or High issue in the audited claim, or evidence shows the claim is false.
- `PASS`: no open Critical or High issue in the completed scope and the required real evidence exists.
- `BLOCKED`: required target access, dependency, environment, or evidence is unavailable.
- `ADVISORY`: no pass/fail claim was requested; report severity-ranked findings and gaps.

## OUTPUT

```markdown
## Audit Scope
- Target:
- Maturity and claim:
- Domains:
- Evidence run:
- Not run / blocked:

## Findings
### [Critical|High|Medium|Low] Title
- Evidence:
- Impact:
- Recommendation:

## Proof Gaps
- ...

## Verdict
PASS | FAIL | BLOCKED | ADVISORY
```
