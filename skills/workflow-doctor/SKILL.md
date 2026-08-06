---
name: workflow-doctor
description: "Validate active workflow state before any role acts on it."
---

## OBJECTIVE

Validate the active agent-surface workflow state before any role acts on it.

`workflow-doctor` is read-only. It diagnoses state drift, stale artifacts, invalid schemas, lock problems, branch/base mismatches, missing evidence, and unsafe compatibility copies.

## CANONICAL PATHS

```text
.agent-surface/workflows/current.json
.agent-surface/workflows/<run_id>/run.json
.agent-surface/workflows/<run_id>/events.ndjson
.agent-surface/workflows/<run_id>/lock
.agent-surface/workflows/<run_id>/boss.json
.agent-surface/workflows/<run_id>/worker.json
.agent-surface/workflows/<run_id>/reviewer.json
.agent-surface/workflows/<run_id>/judger.json
.agent-surface/workflows/<run_id>/rescue.json
.agent-surface/workflows/<run_id>/agents.json
.agent-surface/workflows/<run_id>/rounds/<round_id>/
```

`.cursor/.workflow/` is an adapter compatibility surface only. It must not override canonical `.agent-surface/workflows/` state.

## CHECKS

1. Resolve active run from `.agent-surface/workflows/current.json`.
2. Confirm `run.json` exists and has `schema_version: workflow.v3`.
3. Validate `run_id`, `branch`, `base_commit`, `base_tree_hash`, `current_round`, and `workflow_next_command`.
4. Verify current git branch and base commit/tree binding.
5. Verify lock owner, role, timestamp, and stale-lock policy.
6. Parse every present role artifact before reading free text.
7. Validate role artifact `schema_version`, `workflow.run_id`, `workflow.round_id`, `workflow.owner`, and `workflow.next_command`.
8. Validate parent artifact hashes before trusting downstream artifacts.
9. Validate `events.ndjson` is append-only parseable JSONL and references existing artifacts.
10. Confirm evidence refs exist and hashes match for completed worker tasks.
11. Confirm patch refs exist and hashes match for completed worker tasks.
12. Confirm root role files match the latest canonical round artifacts.
13. Confirm `run.json.workflow_next_command` matches the `to` field of the latest transition in `events.ndjson`. A mismatch means a role wrote its artifact but never ran `agent-surface workflow apply`, so the ledger pointer lags the accepted state — fail closed.
14. Report `.cursor/.workflow/` compatibility files as stale if they disagree with canonical artifacts.
15. Confirm workflow state is gitignored.
16. Confirm `active_task_ids`, `accepted_task_ids`, `rework_task_ids`, `deferred_task_ids`, and `closed_task_ids` are mutually exclusive and every current BOSS task appears in one bucket. Prior-round accepted/closed IDs may remain in the run ledger.
17. When `agents.json` exists, validate `workflow.monitor.v2`, matching `run_id`, retry budget, in-run existence of materialized outputs, time to first output, no-progress timeout, role timeout, and distinct workspaces/filescopes for concurrent writers.

## OUTPUT

```json
{
  "status": "PASS|WARN|FAIL",
  "run_id": "id or null",
  "canonical_dir": ".agent-surface/workflows/<run_id>",
  "issues": [
    {
      "severity": "blocker|major|minor",
      "check": "short check name",
      "evidence": "file/path/field",
      "fix": "concrete next action"
    }
  ],
  "next_command": "workflow-boss|dev-feature|dev-fix|dev-chore|dev-refactor|qa-trace|qa-review|workflow-reviewer|workflow-judger|workflow-rescue|workflow-close|null"
}
```

## HARD RULES

1. Do not repair artifacts.
2. Do not delete locks.
3. Do not choose the newest file by mtime.
4. Do not trust `.cursor/.workflow/` when canonical `.agent-surface/workflows/` exists.
5. If canonical and compatibility artifacts disagree, canonical wins and status is at least `WARN`.
6. A schema-valid but contradictory task disposition is `FAIL`.
7. A stale running session is `FAIL` for further automatic routing; mark or terminate it before the next transition. It is not automatically a product blocker.
