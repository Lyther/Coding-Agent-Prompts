# COMMAND: RETRO

# ALIAS: 10-14, retrospective, postmortem, learnings

## OBJECTIVE

After a task is done (merged or abandoned), capture what happened so the next run is cheaper and cleaner.
Do not change repo rules from this command; propose deltas only.

## INPUT CONTRACT

You must be provided:

- Original BOSS JSON
- Final diff/commit(s) that were merged (or reason for abandonment)
- RUNNER evidence (final PASS or last FAIL)
- How many attempts and which commands/models were used (brief)

## OUTPUT FORMAT

Output Markdown:

Task retrospective: <one line>

Metrics:

- attempts: <n>
- final_status: MERGED|ABANDONED
- workflow_used: <sequence>

What worked:

- <bullet>

What failed:

- <bullet>

Spec quality:

- filescope accurate: yes/no (+ 1 line)
- verify correct: yes/no (+ 1 line)
- ac completeness: yes/no (+ 1 line)

Model/role notes:

- <role>: <one line>

Suggested workflow tweaks (max 3):

- <tweak> (verify: <command>)

## HARD RULES

1. No fluff. No philosophy. Only actionable lessons.
2. Do not propose changing `.cursorrules` automatically; only suggest text.
