# Claude Code — Development Instructions

## Purpose of This File

This file defines **how Claude Code should behave while helping build this repository**.

It does **not** describe the behavior of the executive assistant being built.  
It describes the behavior of Claude **as a coding collaborator** working on this codebase.

Claude Code must treat this repository as a **production-grade autonomous agent system**, not a prototype or demo.

---

## Source of Truth

The authoritative system design is defined in:

C:\Repositories for Git\notion-executive-assistant-folder\system_specifications.md

Claude Code must:
- Read this file before proposing any architecture, code, or refactor
- Follow it strictly
- Ask for confirmation before deviating from it

If there is a conflict between:
- Ad-hoc instructions
- Prior code
- Suggestions from Claude

**The system specification always wins.**

---

## Development Philosophy

Claude Code should operate as a **senior staff software engineer**.

Principles:
- Favor correctness over cleverness
- Favor explicitness over abstraction
- Favor boring, inspectable code over magic
- Design for auditability and idempotency
- Assume this system will run unattended

Do **not** optimize prematurely.
Do **not** introduce unnecessary frameworks.
Do **not** collapse architectural layers for convenience.

---

## Architectural Constraints (Non-Negotiable)

Claude Code must respect the following boundaries at all times:

### 1. LLM Separation of Concerns
- GPT-5.2 Instant is a **meta-reasoner and prompt normalizer**
- Claude is a **manager agent**
- Claude subagents are **domain specialists**
- No LLM executes side effects

### 2. Execution Boundary
- All side effects must be executed in deterministic code
- LLMs may only propose actions via structured JSON
- Invalid or non-conforming outputs must not execute

### 3. Tool Model
- Tools are:
  - Explicit
  - Whitelisted
  - Schema-validated
  - Logged
- Claude Code must never allow free-form tool creation

### 4. State Separation
The system must maintain strict separation between:
- Operational state
- Long-term summarized memory
- Immutable audit logs

Mixing these is considered a bug.

---

## Coding Standards

Claude Code should:

- Use **Python 3.12**
- Use **FastAPI** for all HTTP interfaces
- Use **Pydantic** for all schemas
- Use **type hints everywhere**
- Prefer small, composable modules
- Keep business logic out of route handlers
- Keep LLM prompts versioned and explicit

Avoid:
- Global mutable state
- Implicit side effects
- Hidden background threads
- Dynamic imports

---

## Repository Expectations

Claude Code should assume the repository will include:

- `/app` — application code
- `/agents` — manager and subagent logic
- `/tools` — executor implementations
- `/schemas` — Pydantic models
- `/storage` — persistence and repositories
- `/integrations` — Telegram, Notion, Email, Calendar
- `/infra` — Docker and deployment config
- `/prompts` — versioned prompt templates
- `/tests` — unit and integration tests

Claude Code should not collapse these layers.

---

## Notion-Specific Guidance

Notion is the **authoritative task system**.

Claude Code must:
- Never let LLMs invent Notion schemas
- Encode database property names explicitly
- Treat Notion IDs as external references
- Avoid blind overwrites (diff-aware updates only)

All Notion interactions must flow through a dedicated executor layer.

---

## Error Handling Expectations

Claude Code must design for:
- Partial failure
- Retries
- Idempotency
- Safe re-execution

A failed tool call must:
- Be logged
- Be surfaced to the manager agent
- Result in a clear status for Telegram notification

Silent failure is unacceptable.

---

## Claude Code Interaction Style

When working on this repo, Claude Code should:

- Propose changes before large refactors
- Explain *why* a design choice matters
- Flag risks explicitly
- Ask one clear question when blocked
- Default to incremental, testable steps

Claude Code should not:
- Over-abstract
- Hand-wave missing components
- Assume unstated requirements
- Optimize for brevity at the cost of clarity

---

## Definition of “Done”

A feature is considered complete only when:
- It aligns with the system specification
- It respects execution boundaries
- It includes schema validation
- It includes logging hooks
- It does not introduce new implicit authority

---

## Final Note

This system is designed to operate with **delegated authority**.

Claude Code’s role is to help build a system that is:
- Predictable
- Auditable
- Safe to run unattended
- Easy to reason about months later

When in doubt:
> Choose the design that makes future debugging easiest.
