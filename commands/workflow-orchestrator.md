---
name: workflow-orchestrator
phase: arbitrate
description: "Run risk-adaptive development, review, multi-agent, and release workflows with runtime preflight, bounded retries, liveness checks, isolated writers, and evidence-backed handoffs."
---
## OBJECTIVE

Control the execution shape without becoming the implementer, reviewer, or release judge.

IRON LAW: DEFAULT TO ONE OWNER; ADD ROLES ONLY WHEN RISK, INDEPENDENT PARALLELISM, OR RELEASE PROOF REQUIRES THEM.

The orchestrator owns routing, runtime selection, liveness, isolation, and handoffs. Role commands own their work. Repository state and real checks outrank agent narration.

## STEP 1: ADMISSION CONTROL ⚠️ REQUIRED

Run `ops-flow` against the current request and repository evidence. Record its routing object before spawning anything.

Follow exactly one profile:

```text
direct      -> return to the current session for the bounded edit
standard    -> one route-specific owner; no BOSS, formal ledger, or external reviewer
reviewed    -> one writer -> local verification -> one independent read-only reviewer
orchestrated-> BOSS -> isolated workers -> integration -> reviewer using workflow.v3
release     -> freeze candidate -> build/prove -> independent release QA using workflow.v3 when durable state is needed
audit       -> read-only QA/analysis; no implementation without a new route decision
parallel    -> bounded read-only probes or isolated proposals; one owner consolidates
ship        -> route to the requested shipping command after accepted evidence exists
```

If `direct` or `standard` is selected, collapse the workflow immediately. Do not open `.agent-surface/workflows/` merely because this command was invoked.

If `reviewed` is selected, use a lightweight loop with the Git diff and check output as the handoff. Do not create BOSS/judger/rescue artifacts. Allow at most two developer-review cycles; repeated disagreement requires a human decision or a fresh route classification.

Only `orchestrated` and `release` may create or rehydrate the formal workflow ledger.

## STEP 2: DEFINE THE MINIMUM CONTRACT

For a bounded fix, give the writer:

```text
Objective:
Current behavior:
Expected behavior:
Must remain unchanged:
Filescope:
Acceptance checks:
```

For an orchestrated or release run, invoke `workflow-boss`. BOSS may create at most five tasks in a batch and should normally create three or fewer. It must prove either:

- at least two writable tasks are independent and isolated; or
- the run needs durable long-running/release state that a lightweight loop cannot preserve safely.

Otherwise downgrade to `reviewed` or `standard`.

## STEP 3: CHOOSE AND PROBE THE RUNTIME

Use the current session or native subagents when they satisfy the role. External provider diversity is optional for ordinary work and valuable for independent high-risk review only after operational fit is proven.

Before assigning any external/headless runtime, invoke `workflow-runtime`. The probe must demonstrate the task-shaped capabilities the role needs:

- read an exact repository path;
- identify a verifiable symbol or value;
- run a harmless repository command;
- for writers, create a scratch edit and return a diff;
- materialize the required output artifact;
- report the actual model/runtime identity and output shape.

Chat success alone is not a worker preflight. A runtime that cannot materialize its handoff is ineligible for that role.

Full-execution consent covers external service calls, provider probes, live installs, and networked launches required by the task. Inject only the named credential needed by the selected provider; never print secrets, dump `.env`, or send raw customer data or unrelated repository content.

Select by this order:

1. tool and repository fit;
2. privacy and authorization fit;
3. task quality;
4. liveness and reliability;
5. latency and cost;
6. provider-family independence when review independence matters.

Do not infer capability from a model name, extension login, prior snapshot, or provider reputation.

## STEP 4: EXECUTE THE SELECTED PROFILE

### Standard

One owner performs:

```text
locate -> implement -> focused check -> broader relevant gate -> self-review -> report
```

Do not spawn a planner, reviewer, or rescue role. The owner may use read-only subagents for independent discovery when useful, but remains responsible for the patch and checks.

### Reviewed

```text
writer -> verify -> independent reviewer
                    | PASS -> done
                    | findings -> same writer repairs -> verify -> reviewer
                    | repeated dispute/failure -> human or reroute
```

Rules:

- One active writer owns the filescope.
- Reviewer is read-only and receives the contract, exact diff, checks, and relevant source.
- Reviewer reports severity-ranked, evidenced defects; style preferences do not trigger rework.
- Use a different model family for high/critical review when an approved, operationally proven runtime exists. Otherwise record degraded independence and require stronger deterministic evidence or human review.
- Maximum two rework cycles.

### Orchestrated

Use the existing `workflow.v3` ledger and role ownership:

```text
workflow-boss -> isolated worker sessions -> integration -> workflow-reviewer
                    |                                  |
                    +-- rework, max two cycles --------+
                    +-- repeated substantive failure -> workflow-judger
```

Rules:

- Default execution remains serial.
- Parallel writers require disjoint filescope, no dependency edge, separate worktrees, and no shared generated output, lockfile, migration, service port, database, or fixture.
- One integration owner reconciles worker output before review.
- When concurrent agents use Synapse, give each process a distinct `SYNAPSE_AGENT_ID` and the run a shared `SYNAPSE_PROJECT`; leave both unset for a single-agent run. Do not persist these process-local values in artifacts.
- `workflow-rescue` is exceptional: use it only after a concrete spec/context/runtime failure cannot be resolved by one retry or normal rework. Do not spawn rescue to restate a stall.
- Formal role state advances only through `agent-surface workflow apply`.

### Release

```text
freeze source identity -> build artifact -> real acceptance/proof -> independent QA -> readiness decision
```

Do not freeze or prove every intermediate patch. A failed acceptance invalidates the candidate; fix the product, freeze a new candidate, and rerun the relevant proof.

## STEP 5: LIVENESS AND RECOVERY ⚠️ REQUIRED

For formal `orchestrated` or `release` sessions, create `.agent-surface/workflows/<run_id>/agents.json` with `schema_version: workflow.monitor.v2`. Use run-level retry/review policy plus per-agent liveness budgets. This is mutable monitor state, not product evidence and never committed.

For a lightweight `reviewed` loop, enforce the same budgets through the host's native session controls and concise progress updates; do not open a formal ledger solely to store monitor state.

Default budgets unless repository evidence justifies another value:

| Role | First materialized output | No-progress timeout | Role timeout |
| --- | ---: | ---: | ---: |
| plan/BOSS | 2 min | 3 min | 10 min |
| worker | 3 min | 5 min | 40 min |
| reviewer/QA | 3 min | 5 min | 15 min |
| judger/rescue | 2 min | 3 min | 10 min |

A progress event must reference real activity: inspected file, materialized plan/diff/artifact, command start/finish, check result, or blocker. Repeated prose such as “still working” is not progress.

On timeout:

1. Poll once and inspect the latest real output.
2. Interrupt or terminate the stalled session when the runtime supports it.
3. Retry once with the same contract and fresh context, or switch to an already-probed compatible runtime.
4. After the second stall on the same role/task, downgrade to a simpler profile or require human input. Do not start an unbounded rescue chain.
5. Mark late output from superseded sessions `stale`; never let it overwrite current ledger state.

Run `agent-surface workflow doctor --run <run_id>` before each formal transition. Stale heartbeats, contradictory task buckets, malformed monitor state, or mismatched ledger transitions fail closed.

## STEP 6: MEASURE THE WORKFLOW

Record actual values when available:

- wall time and time to first materialized output;
- implementation, verification, review, and orchestration time;
- runtime/model identity, token usage, and cost;
- stalls, retries, rework cycles, reviewer findings, and acceptance failures;
- downstream verdict on each role's output.

Do not persist thinking/chain-of-thought text. Store only whether reasoning was enabled/present, trace handling, usage, final output, and verdict.

If orchestration consumes more time than implementation on a non-release task, or no real parallelism remains, collapse the next round to `reviewed` or `standard` and record why.

## TERMINAL CONDITIONS

Stop only when one is true:

- the selected lightweight profile completed its checks and required review;
- `workflow-close` closed or aborted the formal run;
- a role set `requires_human: true` with a concrete decision needed;
- an external prerequisite blocks the required acceptance path;
- the run was quarantined because source, artifact, lock, or ledger identity is inconsistent.

A role returning is a handoff, not automatically completion. A stalled runtime is an execution failure, not a product blocker.

## OUTPUT

Keep the user-facing update compact:

```text
Profile: standard|reviewed|orchestrated|release|audit|parallel|ship
State: developing|verifying|reviewing|acceptance|done|blocked|stalled
Owner: <role/runtime>
Materialized: <diff/artifact/check ref or none>
Elapsed: <wall time>
Next: <command/action or human decision>
```

## ANTI-PATTERNS

- Do not force BOSS -> worker -> reviewer -> judger -> rescue for a linear fix.
- Do not use several CLIs as fake provider independence when they resolve to the same model family.
- Do not parallelize overlapping writers.
- Do not wait indefinitely without materialized progress.
- Do not treat a runtime stall as evidence that the implementation is blocked.
- Do not count self-created workflow artifact defects as product-quality wins.
- Do not keep both canonical and manually maintained copies of the same state; the ledger is authoritative and other views are derived.
