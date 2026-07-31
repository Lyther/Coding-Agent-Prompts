---
name: arch-contract
phase: decide
description: "Define aligned domain, data, API, and interface contracts without exposing internal storage as the public boundary."
---
## OBJECTIVE

Produce or update the system's architecture contract as one coherent decision:

- the internal domain and data model, when the system owns state;
- the external and in-process interface contracts, when callers cross a boundary;
- the explicit mapping between internal entities and boundary DTOs; and
- the matching `## Data and State` and `## Interfaces and Contracts` sections of `docs/architecture.md`.

Do not invent persistence, endpoints, transports, or versioning that the concept and architecture do not require. Mark a track `NOT_APPLICABLE` with evidence when the system genuinely has no owned state or no callable boundary. Report `RESEARCH_REQUIRED` when a required decision lacks evidence.

## DECISION STANDARD

Treat this as one contract with two distinct views:

- **Domain and data** describe the system's internal truth: entities, relationships, invariants, ownership, storage, and lifecycle.
- **Interfaces** describe promises made across boundaries: operations, inputs, outputs, errors, authorization, compatibility, and retry behavior.

Keep the views aligned without collapsing them. Storage rows and internal entities are not public DTOs. Every exposed field and operation must map deliberately to domain behavior, and every material invariant must have one owner.

Define the smallest contract that satisfies current requirements. A contract is expensive to change after callers or persisted data depend on it, so make required behavior precise and leave speculative surfaces out.

## INPUTS

Read, in order:

1. Explicit user requirements and constraints.
2. `docs/context/concept-zero.md` or the verified equivalent.
3. `docs/architecture.md`, especially system context, boundaries, data, interfaces, and source tree.
4. Existing schemas, migrations, ORM/domain types, route definitions, public types, protocol files, and handlers.
5. Repository conventions for storage, validation, serialization, identity, authorization, errors, and compatibility.
6. Authoritative standards or platform documentation only where the selected contract depends on them.

Preserve the established stack and datastore unless the user asks for a change. Report conflicts instead of silently migrating or introducing another representation.

## PRINCIPLES

- **Concept before schema or transport**: requirements determine entities and interactions; technology follows.
- **One source of truth**: generate or derive secondary representations instead of maintaining equivalent schemas by hand.
- **Internal and external separation**: map entities to DTOs; never expose secrets, storage keys, internal flags, or implementation-specific fields.
- **Minimum sufficient shape**: add an entity, field, operation, index, version, or transport only for a current requirement.
- **Owned invariants**: each rule belongs to one constraint, type, validator, or domain module.
- **Consistent boundaries**: one error model, authorization model, pagination strategy, and compatibility policy per surface unless a named requirement forces a difference.
- **Behavior over shape**: ordering, limits, idempotency, null semantics, failure behavior, and lifecycle are part of the contract.

## PROTOCOL

### 1. Establish applicability and boundaries

Identify:

- state the system owns versus reads from another system;
- entities and relationships stakeholders recognize;
- callers and interactions that cross process, service, plugin, library, UI, CLI, or MCP boundaries;
- the system of record for each stateful concept; and
- what is explicitly not stored or exposed.

Classify the domain/data and interface tracks as `REQUIRED`, `NOT_APPLICABLE`, or `RESEARCH_REQUIRED`. Do not use `NOT_APPLICABLE` merely because implementation has not started.

### 2. Define the domain and logical model

For each entity, specify:

- meaning and owner;
- identity, attributes, types, required versus optional state, and allowed values;
- relationships and cardinality;
- uniqueness and other invariants;
- sensitivity and retention expectations; and
- the component that enforces each invariant.

Prefer stable identities, explicit optionality, typed time and money, and closed sets where the language or datastore supports them. Keep illegal states hard to represent without adding ceremony to trivial fields.

### 3. Define physical storage and lifecycle

When the system owns persistent state, map the logical model to the selected store:

- canonical schema, migration, or ORM representation;
- primary, foreign, unique, and check constraints;
- indexes justified by actual access paths;
- transaction and consistency boundaries;
- deletion, retention, recovery, and corruption posture; and
- versioned migration and rollback behavior.

Keep schema and domain types aligned from one canonical representation where practical. Do not add a datastore, cache, queue, event log, or replication path without a current requirement.

### 4. Define interface operations

For each required boundary, choose the simplest transport already supported by the architecture and define:

- consumer, trigger, operation, and stable name;
- inputs, outputs, validation, and nullability;
- result and error behavior;
- authentication and authorization;
- idempotency and retry semantics;
- ordering, pagination, filtering, and limits where relevant; and
- compatibility, deprecation, and migration rules.

Use the repository's native contract form: OpenAPI, GraphQL SDL, protobuf, MCP schemas, public language types, CLI grammar, or another established source. Do not add HTTP, GraphQL, RPC, streaming, or messaging merely to appear complete.

### 5. Map internal state to boundary contracts

For every request and response shape:

- map fields and operations to domain concepts;
- state where boundary validation ends and domain validation begins;
- exclude secrets and internal-only state;
- distinguish create/update inputs from stored entities and returned DTOs; and
- verify that interface behavior preserves domain invariants.

Resolve naming or type disagreements explicitly. Do not duplicate a model under two names or serialize a storage record as a shortcut.

### 6. Write and validate the artifacts

Write only the artifacts required by the selected stack:

- schema, migrations, ORM/domain types, and a concise data dictionary for non-obvious fields;
- API, RPC, MCP, CLI, or public-library contract files;
- `docs/architecture.md` data and interface sections with links to canonical sources; and
- an ERD or boundary/dataflow view through `arch-diagram` when relationships are not obvious in prose.

Run the cheapest real checks available: schema or migration validation, contract lint, breaking-change comparison, type-check, build, and relevant real tests. Missing tooling or prerequisites are `BLOCKED` for that proof; do not substitute a fake contract path.

## OUTPUT

Produce one aligned result:

1. **Domain/data contract**: canonical model artifacts, owned invariants, migration posture, and data dictionary, or an evidenced `NOT_APPLICABLE`.
2. **Interface contract**: canonical machine-readable or typed boundary artifacts, behavior and compatibility rules, or an evidenced `NOT_APPLICABLE`.
3. **Mapping**: explicit entity-to-DTO and validation ownership, including fields that must never cross the boundary.
4. **Architecture documentation**: synchronized `Data and State`, `Interfaces and Contracts`, and source ownership references.

## EXECUTION RULES

1. Model internal truth before exposing boundary shapes, but design both in the same run.
2. Never make persisted entities the public contract by default.
3. Never invent storage or an interface to satisfy the command structure.
4. Keep one canonical representation for each fact and derive secondary forms where possible.
5. Validate external input before it becomes domain state.
6. Treat persisted-data and published-interface compatibility as deliberate lifecycle decisions.
7. Stop for a material unresolved product or compatibility decision; do not guess a contract that implementation will entrench.

## COMPLETION REPORT

- Changed: full paths to model, schema, interface, dictionary, and architecture artifacts.
- Applicability: domain/data and interface tracks as `REQUIRED` or `NOT_APPLICABLE`, with evidence.
- Checks: real schema, migration, contract, type, build, and test commands as `passed`, `failed`, `blocked`, or `not run`.
- Blockers: unresolved contract decisions, whether human input is required, and the concrete unblock path.
- Next command: usually `arch-diagram`, `workflow-boss`, or a named implementation workflow.
