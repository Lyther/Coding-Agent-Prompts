---
name: boot-new
description: "Bootstrap the smallest runnable project structure that fits the product goal, stack, and requested maturity."
---

## OBJECTIVE

Create or repair a project scaffold without preloading it with speculative architecture, tooling, policy, or operational machinery.

The result must support the first real end-to-end behavior and the next development step. It is not a checklist for every technology the project may eventually need.

## MODES

```text
boot-new [check|run]
  [--maturity prototype|mvp|core|usable|production|business|auto]
```

- `check`: inspect and return the smallest coherent scaffold plan without writing.
- `run`: apply the plan, build the first runnable slice, and verify it.

A bare invocation runs `check` first. Existing projects preserve their proven stack and conventions; this workflow does not migrate technology for taste.

## INPUT CONTRACT

Resolve from the request and repository:

- product outcome and first user journey;
- maturity level and claims;
- language, framework, package manager, and deployment target;
- data, integration, platform, licensing, and compatibility constraints;
- expected entry point and acceptance command;
- files or local state that must remain untouched.

Use `ops-ask` only when a missing answer materially changes those decisions. Do not ask for facts available in manifests, lockfiles, existing code, or authoritative documentation.

## MATURITY SHAPE

### Prototype

- One executable path that resolves the named uncertainty.
- Minimal dependency manifest and run instructions.
- No CI, deployment, plugin system, compatibility layer, editor workspace, or extensive docs unless the experiment requires them.
- Explicitly disposable; no production claim.

### MVP

- One complete primary user journey using real components available to the project.
- Standard manifest and lockfile, focused tests, basic errors and data integrity, `.gitignore`, and concise run instructions.
- One simple configuration path. Add CI or packaging only when needed to deliver the MVP.
- Defer scale, extensibility, secondary workflows, and enterprise controls.

### Core

- Cohesive domain boundaries and stable central interfaces.
- Deterministic build and test commands.
- Persistence and integrations required by the core contract.
- No peripheral product shell or operational platform unless it is part of the core.

### Usable

- Complete primary journeys, understandable errors, recovery, accessibility, configuration, and operator/user documentation.
- Packaging and routine maintenance commands needed for regular use.

### Production

- Deployment, migration, rollback, observability, recovery, resource limits, security controls, and performance evidence derived from the real environment, data, threat model, and SLOs.
- No generic production checklist can substitute for those inputs.

### Business or Regulated

- Tenancy, audit, compliance, governance, support, and organizational controls required by the actual business or regulatory contract.
- Do not add them merely because the project may become commercial.

## SCAFFOLD METHOD

1. **Inspect the environment.** Read manifests, lockfiles, source layout, build scripts, CI, ignores, docs, and current status. Identify the ecosystem's normal project shape.
2. **Choose the minimum structure.** Every proposed directory and file must have a current producer, consumer, or execution role. Do not create empty architecture, roadmap, context, scripts, assets, or test directories for future use.
3. **Reuse the stack.** Prefer repository and ecosystem conventions. Research an existing library before hand-building established parsing, protocol, scheduling, storage, security, physics, or domain logic.
4. **Define one source of truth.** Use one dependency manifest, one configuration path, one primary entry point, and one command per routine action.
5. **Create the first vertical slice.** Scaffold enough product code to execute observable behavior, not only folders and configuration.
6. **Verify from a clean invocation.** Run the documented install/build/test/run path applicable to the maturity level.

## REQUIRED BASELINE

Add only applicable items:

- ecosystem-standard manifest and lockfile;
- source and test files needed by the first slice;
- `.gitignore` for generated output, local tooling, credentials, and platform debris;
- `.env.example` when environment configuration exists, containing names and dummy values only;
- concise `README.md` with purpose, prerequisites, run command, test command, and current limits;
- explicit license when distribution requires one.

Initialize Git only if this is a new unversioned project and version control is part of the requested setup. Preserve staged, unstaged, ignored, and untracked work in existing repositories.

## TOOLING RULES

- Use the repository's package manager and pinned tools.
- Add one formatter/linter path only when the project has selected and gated it. Do not install overlapping formatters, import organizers, or generic pre-commit suites.
- Add CI when remote integration, collaboration, publication, or the maturity contract requires it. CI should call the same local commands, not define a second build.
- Add editor or agent configuration only when the user requests it or the repository already owns it. User-local overlays remain untracked.
- Add scripts only for repeatable project workflows that cannot be expressed clearly through the ecosystem's normal commands.
- Do not add databases, caches, queues, services, containers, monorepos, microservices, frontend shells, or cloud resources without a current requirement.

## SECURITY AND DATA

- Never commit secrets; ignore real environment files and private keys.
- Validate external inputs and preserve data integrity at the actual trust boundaries.
- Match controls to reachable threats and maturity while preserving P0 requirements for auth, authorization, cryptography, payments, destructive effects, and sensitive data.
- Missing credentials or services make the affected live proof `BLOCKED`; they do not justify fake integration.

## EXISTING PROJECTS

For an existing tree:

- do not relocate files merely to match this command;
- preserve stronger established checks and controls;
- remove or replace stale scaffold only when ownership and behavior are proven;
- route broad accumulated cleanup to `ops-clean`;
- route intentional architecture or behavior changes to the relevant `arch-*` or `dev-*` workflow.

For an `ops-nuke` respawn, the approved respawn contract overrides historical layout. The old implementation remains reference evidence, not a template to copy.

## OUTPUT

```markdown
## Scaffold Contract
- Goal and first journey:
- Maturity:
- Stack:
- Preserved state:

## Minimal Structure
| Path | Current purpose | Producer / consumer |
| --- | --- | --- |

## Commands
- Install:
- Build/run:
- Test:

## Verification
- Scenario:
- Result:
- Blocked boundaries:

## Deferred
- Capability:
- Evidence required before adding it:
```

## COMPLETION

`COMPLETE` requires the scaffold and first vertical slice to run through the documented entry point with the applicable real components. A directory tree, generated boilerplate, or green substitute-backed test alone is not completion.
