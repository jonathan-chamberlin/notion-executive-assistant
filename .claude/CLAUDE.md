# Claude Code Instructions — Clawdbot-Based Executive Assistant

## Purpose of This File

This file defines **how Claude Code should behave while building the system**, not how the executive assistant behaves at runtime.

Claude Code must treat this repository as:
- A **Clawdbot workspace**
- Focused on **skills development**, configuration, and integration
- Governed by the system design defined in:

C:\Repositories for Git\notion-executive-assistant-folder\system_specifications.md

Claude must follow that specification as the source of truth.

---

## Core Development Philosophy

- **Clawdbot is the agent runtime**
- **Skills are the only place where custom logic lives**
- Do **not** re-implement messaging, orchestration, or session handling
- Prefer **explicit, deterministic code** over clever abstractions
- Every action must be auditable and reversible where possible

Claude Code should optimize for:
- Reliability
- Clarity
- Maintainability
- Minimal surface area

---

## What Claude Code Is Responsible For

Claude Code may:

- Create and modify **Clawdbot skills**
- Write `SKILL.md` files for each skill
- Implement API integrations (Notion, email, calendar)
- Add validation, schemas, and structured outputs
- Improve error handling and logging
- Refactor for clarity and safety
- Adjust configuration files required by Clawdbot

Claude Code must assume:
- Clawdbot handles sessions, memory, and messaging
- Telegram is already connected at the platform level
- LLM configuration is handled via Clawdbot settings

---

## What Claude Code Must NOT Do

Claude Code must NOT:

- Rebuild an agent framework
- Create a custom task router or planner
- Implement its own memory system
- Bypass Clawdbot’s skill execution model
- Embed large prompt logic directly into application code
- Hardcode secrets, tokens, or credentials

If a feature seems to require orchestration logic, it should be implemented as:
- A **skill**
- Or a **composition of skills**, not a new agent layer

---

## Skill Development Rules

When creating or modifying skills:

1. Each skill must live in its own directory under `/skills`
2. Each skill must include:
   - `SKILL.md` describing intent, inputs, outputs, and constraints
   - Clear, minimal code implementing the behavior
3. Skills must:
   - Accept structured inputs
   - Validate inputs defensively
   - Return structured, machine-readable outputs
4. Side effects (Notion writes, emails, calendar changes) must be explicit

Claude Code should prefer:
- Simple functions
- Clear data flow
- Predictable behavior

---

## Notion Integration Rules

- Notion is the **single source of truth** for tasks
- Skills must conform to the Notion schema defined in `system_specifications.md`
- Never infer schema dynamically
- Always validate property names and types
- Fail safely if schema mismatches occur

---

## Model Usage Guidance

- Claude is the **primary development model**
- If the system references GPT-5.2 Instant, that is a runtime configuration concern
- Claude Code should not hardcode or assume a specific model backend
- Prompt logic belongs in SKILL.md files, not embedded inline in code

---

## Code Quality Standards

Claude Code must ensure:

- Clear naming (no vague abstractions)
- Explicit error handling
- No silent failures
- Logs that explain *what happened and why*
- Comments only where they add clarity (not redundancy)

Prefer correctness over brevity.

---

## Change Discipline

Before making changes, Claude Code should:

1. Identify which part of the system specification applies
2. Confirm the change does not violate Clawdbot’s architecture
3. Make the smallest change that solves the problem
4. Avoid speculative or premature features

If a requested change conflicts with the system design, Claude Code must:
- Call out the conflict explicitly
- Propose a compliant alternative

---

## Assumptions

Claude Code may assume:

- The repository is version-controlled via Git
- Deployment happens outside this repo
- Secrets are injected via environment variables
- The developer understands Clawdbot basics

Claude Code should **not** explain Clawdbot concepts unless directly relevant to a code decision.

---

## Success Criteria for Claude Code

Claude Code is doing its job well if:

- Skills are easy to reason about
- The system matches `system_specifications.md`
- No unnecessary infrastructure is introduced
- Another engineer could maintain this repo without confusion

---

End of instructions.
