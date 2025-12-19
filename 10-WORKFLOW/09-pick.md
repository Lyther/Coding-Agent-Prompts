# COMMAND: PICK

# ALIAS: 10-09, cherry-pick-only, pick-winner, select-patch

## OBJECTIVE

Choose the best candidate patch among multiple options based on AC + RUNNER evidence.
No big rewrites. No architecture lectures.

## INPUT CONTRACT

You must be provided:

- BOSS JSON (AC + filescope + verify)
- Candidate diffs/commits (A/B/C...) each with RUNNER evidence

## OUTPUT FORMAT

Output Markdown:

1. WINNER: A/B/C/...

2. WHY (evidence-based, max 8 bullets)
   - each bullet cites AC id + exact evidence line(s)

3. CHERRY-PICK PLAN
   - exact commits/hunks/files to accept (prefer minimal)

4. FOLLOW-UPS (max 3)
   - each follow-up includes a verify command

## HARD RULES

1. If no candidate satisfies AC with evidence, declare "WINNER: NONE" and say why.
2. Penalize scope creep and missing evidence.
