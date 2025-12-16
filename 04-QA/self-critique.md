# COMMAND: SELF-CRITIQUE

# ALIAS: reflect, refine, improve, audit-self

## OBJECTIVE

**THE MIRROR TEST.**
You are your own harshest critic.
Before you declare "Done", you must pause and look in the mirror.
**Your Goal**: Catch your own mistakes (logic, style, incomplete thoughts) before the human does.
**The Standard**: If the human finds a trivial bug you could have found, you failed.

## CONTEXT STRATEGY (TOKEN ECONOMICS)

1. **Wait State**:
    - Do NOT run this on every single line change.
    - Run this **after** a `feature` implementation but **before** `commit`.
2. **Fresh Eyes**:
    - "Forget" the prompt that generated the code. Look at the *Result* as if a stranger wrote it.

## PROTOCOL

### Phase 1: The Completion Audit (Did I finish?)

*AI often gets tired and leaves `// TODO` or `...`.*

1. **Scan for Placeholders**:
    - Grep for: `TODO`, `FIXME`, `...`, `pass`, `impl later`.
    - **Action**: If found, **STOP**. You are not done.
    - **Self-Correction**: Implement the missing piece immediately.
2. **Scan for Hallucinations**:
    - Look at imports. Do they look "too convenient"? (e.g., `import { magicFix } from 'utils'`).
    - **Action**: Verify the file/export actually exists.

### Phase 2: The Logic Interrogation

*Does it actually work, or does it just look like code?*

1. **The "Happy Path" Check**:
    - Trace the inputs. If `user` is null, what happens?
    - If `api` times out, does it crash?
2. **The "Off-By-One" Check**:
    - Loops and array indexing.
    - Ranges (`start..end` vs `start..=end`).

### Phase 3: The Refinement Loop

*Polishing the stone.*

1. **Complexity Check**:
    - "Is this `if/else` nested 4 levels deep?" → **Flatten it**.
    - "Is this function 50 lines?" → **Split it**.
2. **Naming Check**:
    - "Is variable `x` descriptive?" → Rename to `userIndex`.
    - "Is function `doIt` descriptive?" → Rename to `processTransaction`.

## PROMPT PAYLOAD

```text
Act as a Senior Software Engineer reviewing a Junior's PR.
Analyze the code I just wrote/modified in: {{files}}.

**1. Completion Check**:
- Are there any `TODO`s, `...`, or missing implementations?
- **Action**: If YES, list them and implement them NOW.

**2. Hallucination Check**:
- Are all imports real?
- Are all variable names defined?

**3. Quality Check**:
- Are there any "Happy Path" assumptions (missing error handling)?
- Is there any code that is overly complex (nesting > 3)?
- Are type definitions strict (no `any`)?

**OUTPUT**:
- If Clean: "✅ SELF-CRITIQUE PASSED. Ready to commit."
- If Issues: List specific issues and the **Corrected Code Block**.
```

## OUTPUT FORMAT

```markdown
# 🪞 SELF-CRITIQUE REPORT

## 🔴 Unfinished Business
- Found `// TODO: Handle error` in `src/auth.ts`.
- **Fix**: Implemented `try/catch` block.

## ⚠️ Code Smells
- Nested `if` in `calculateTax` (Depth 4).
- **Fix**: Refactored to Guard Clauses.

## ✅ Verdict
Code is now clean. Running tests...
```

## EXECUTION RULES

1. **AUTO-FIX**: Do not just "report" the error. **FIX IT**.
2. **NO APOLOGIES**: Don't say "I forgot X". Just say "Fixed X".
3. **STRICT TYPES**: If you used `any` because you were lazy, fix it now.
4. **REALITY**: If you imported a ghost library, delete it and write the util yourself.
