---
name: boot-workflow
phase: observe
description: "Show the risk-adaptive agent-surface workflow map, execution profiles, formal-ledger boundary, and next-command rules without starting implementation."
---
## OBJECTIVE

Explain the available execution shapes and identify the next command. This command does not implement work or start a workflow by itself.

## CORE LOOP

```text
understand -> choose the lightest safe profile -> execute -> verify -> review when required -> prove only the frozen candidate
```

## PROFILE MAP

```text
                              [ops-flow]
                                  |
          +-----------+-----------+------------+-------------+
          |           |                        |             |
          v           v                        v             v
       direct      standard                 reviewed      orchestrated
   current owner   one owner         one writer + one QA   formal ledger
          |           |                        |             |
          +-----------+------------------------+-------------+
                                  |
                                  v
                            stable candidate
                                  |
                                  v
                               release
                    artifact + real proof + readiness
```

Supporting paths:

```text
audit    -> qa-review | qa-audit | qa-trace | ops-report
parallel -> ops-swarm for independent read-only or isolated probes
ship     -> ship-commit | ship-artifact | ship-cicd | ship-release | ship-deploy
```

Invoke `ops-flow` for the evidence-backed routing object. High risk normally upgrades `standard` to `reviewed`; it does not automatically create several writers. Orchestration is for real parallel width or durable long-running/release state.

## PROFILE DETAILS

### Direct

Use for a tiny, obvious, reversible change with an obvious check.

```text
inspect -> edit -> focused check -> report
```

### Standard — default development

Use for ordinary bounded implementation.

```text
one owner: locate -> implement -> verify -> self-review -> report
```

No BOSS, formal ledger, external reviewer, judger, or rescue role.

### Reviewed

Use when the change is security-sensitive, affects a public/shared contract, or has meaningful regression cost.

```text
writer -> verify -> read-only reviewer
                    | PASS -> done
                    | defect -> writer repairs -> verify -> reviewer
```

Limit the loop to two rework cycles. Repeated substantive disagreement requires a human decision or route change.

### Orchestrated

Use only for at least two independent writable workstreams or a long-running dependency graph that needs durable local state.

```text
workflow-orchestrator
    -> workflow-boss
    -> isolated worker sessions
    -> integration owner
    -> workflow-reviewer
    -> workflow-judger only after repeated substantive failure
    -> workflow-rescue only for exceptional spec/context/runtime breakdown
```

Parallel writers require separate worktrees and disjoint files, generated outputs, lockfiles, migrations, ports, databases, and fixtures.

### Release

Use for readiness, deployment, artifact, or formal acceptance claims.

```text
freeze candidate -> build shipped bits -> real dependency path -> independent QA -> readiness verdict
```

Do not create release-grade proof for unstable intermediate patches.

## FORMAL WORKFLOW LEDGER

The formal `workflow.v3` ledger belongs only to `orchestrated` and `release` profiles.

Canonical local paths:

```text
.agent-surface/workflows/current.json
.agent-surface/workflows/<run_id>/run.json
.agent-surface/workflows/<run_id>/events.ndjson
.agent-surface/workflows/<run_id>/lock
.agent-surface/workflows/<run_id>/rounds/round-<round_id>/
.agent-surface/workflows/<run_id>/boss.json
.agent-surface/workflows/<run_id>/worker.json
.agent-surface/workflows/<run_id>/reviewer.json
.agent-surface/workflows/<run_id>/judger.json
.agent-surface/workflows/<run_id>/rescue.json
.agent-surface/workflows/<run_id>/agents.json
```

Rules:

- Project-local and gitignored; never commit workflow state.
- `run.json` plus `events.ndjson` is authoritative. Root role files are latest-role views; canonical round artifacts retain history.
- One active formal run per project.
- Never choose a handoff by mtime or chat history.
- Every role owns only its own artifact and allowed source files.
- Advance formal state only with:

```bash
agent-surface workflow apply --role <role> --run <run_id> --artifact <path>
```

- Validate before every transition:

```bash
agent-surface workflow doctor --run <run_id>
```

- Task-state buckets are mutually exclusive. A task cannot be active, accepted, rework, deferred, or closed at the same time.
- Patch manifests are required when partial merge or concurrent writable task isolation is part of the plan. Do not use them as ceremony for a simple single-owner patch.
- `agents.json` is mutable runtime state under `workflow.monitor.v2`; it records liveness and materialized outputs, not product acceptance.
- A stalled session is an execution failure. It does not make the product task human-blocked.

Load the owning command for detailed artifact shape instead of duplicating it here:

- `workflow-boss`: spec and task queue.
- route-specific `dev-*`: worker artifact.
- `workflow-reviewer`: independent per-task verdict.
- `workflow-judger`: repeated-failure decision.
- `workflow-rescue`: exceptional recovery or human escalation.
- `workflow-close`: terminal run transition.
- `workflow-doctor`: schema, identity, semantic-state, evidence, and liveness validation.

## RUNTIME CONTROL

Invoke `workflow-runtime` only when the selected profile delegates to a runtime that has not already passed a current task-shaped probe.

The runtime command owns:

- CLI/version/help checks;
- resolved model identity;
- repository read/command/write/artifact probes;
- permission and output-shape evidence;
- provider-family independence;
- liveness and cancellation behavior.

Do not keep a volatile model catalog in this boot map. Model and provider availability must be re-probed.

## COMMAND PROTOCOL

```text
1. Command is present in current context -> execute it.
2. Generated command exists on disk -> read that target-native command -> execute it.
3. Source checkout is agent-surface -> read commands/<name>.md -> execute it.
4. Unknown command -> ask; never invent a process.
```

## RED FLAGS

Return to `ops-flow` if any appear:

- BOSS is being started for a small sequential fix.
- Two writers need the same file or generated output.
- Workflow artifacts outnumber materialized product outputs.
- No agent produced a plan, diff, command result, or artifact before its liveness deadline.
- A candidate is being formally proven while source is still changing.
- Several runtimes are called independent but resolve to the same model family.
- A schema-valid run contains contradictory task dispositions.

## OUTPUT

```text
Profile: direct|standard|reviewed|orchestrated|release|audit|parallel|ship
Why: <short evidence>
Roles: <minimal required roles>
Formal ledger: yes|no
Runtime probe: required|not required
Next: <one command>
```
