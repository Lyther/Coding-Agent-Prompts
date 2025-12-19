# COMMAND: CTX-BUILD

# ALIAS: 10-04, context-builder, ctx, summarize-repo, context-packet

## OBJECTIVE

Compress the repo into a **task-scoped context packet** that other commands can reuse to save tokens.
This is factual extraction, not brainstorming.

## MODEL SUGGESTION (COST / QUALITY)

- Preferred: Gemini 3 (large context).
- Spend tokens on coverage of relevant files, not prose (target < ~5k tokens output).

## PROTOCOL

1. Identify likely hotspots using semantic search + grep (entry points, routes, core modules).
2. Read only what is necessary for the task (target 10–20 files).
3. Extract:
   - Relevant file paths
   - Key symbols/signatures (classes/functions/types)
   - High-level call flow (entry → dependencies)
   - Existing tests and what they cover
   - Build/test commands discovered in manifests/README
4. Capture unknowns as explicit questions.

## OUTPUT FORMAT

Output Markdown:

- Task
- Relevant paths (max 15)
- Key interfaces (signatures only, with file path)
- Call sites / entry points
- Existing tests (paths + gaps vs AC, max 3 bullets)
- Pitfalls (max 7, concrete)
- Dependencies to verify (manifest entries)
- Open questions / missing context

## EXECUTION RULES

1. Factual only: every statement must be supported by files you actually observed.
2. If you didn't read it, don't claim it.
3. Keep it compact: one short line per file, no copy-pasted code dumps.
