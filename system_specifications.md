Perfect — Notion fits *cleanly* into this architecture, and adding it now (at the spec level) is exactly the right move.
Below is the **same final markdown spec**, with **Notion added explicitly as a first-class tool** and scoped correctly so it doesn’t become a mess later.

You can paste this directly over the previous spec in your repo.

---

````markdown
# Autonomous Claude Operator — System Specification

## 1. System Goal

Build a cloud-hosted autonomous agent system where:
- A single conversational Claude instance acts as the **manager**
- GPT-5.2 Instant acts as a **meta-reasoner and prompt writer**
- Specialized Claude subagents handle domain-specific planning
- All real-world side effects are executed by deterministic code
- The user interacts exclusively via a two-way Telegram chat
- The agent executes actions immediately and reports all side effects
- **Notion is the system of record for tasks and planning**

No permission prompts. Full audit transparency.

---

## 2. Core Design Principles

1. **LLMs do not execute**
2. **All side effects flow through code**
3. **All actions are logged**
4. **Telegram is an interface, not a state store**
5. **Idempotency and auditability are mandatory**
6. **One conversational agent, many specialists**
7. **Notion is authoritative for task state**

---

## 3. High-Level Architecture

Telegram  
→ FastAPI Webhook  
→ GPT-5.2 Instant (Instruction Normalization)  
→ Claude Manager Agent  
→ Claude Subagents  
→ Tool Executor Layer  
→ External Services (Email, Calendar, Notion)  
→ Audit Log  
→ Telegram Notifications  

---

## 4. LLM Roles

### GPT-5.2 Instant — Meta-Reasoner
Responsibilities:
- Rewrite user input into unambiguous task specifications
- Clarify assumptions
- Normalize intent and scope
- Generate structured plans for Claude

Restrictions:
- No tool access
- No execution authority
- No API credentials
- No direct interaction with Telegram

---

### Claude — Manager Agent
Responsibilities:
- Interpret structured task specs
- Decide which subagents to invoke
- Maintain global task coherence
- Resolve conflicts between subagents
- Decide when a task is complete

Restrictions:
- No direct API calls
- No credential access
- No raw code execution

---

### Claude Subagents — Specialists

#### EmailAgent
- Drafts and proposes email actions

#### CalendarAgent
- Proposes calendar modifications

#### NotionAgent
- Manages task creation, updates, and organization in Notion

Responsibilities:
- Propose tool actions
- Operate within narrow domain scope
- Return structured, machine-verifiable outputs

Restrictions:
- Limited tool visibility
- No cross-domain authority
- No execution capability

---

## 5. Tool Execution Model

All tools are:
- Hard-coded
- Whitelisted
- Schema-validated
- Audited
- Idempotent

Claude and subagents output **structured JSON only**.  
Invalid or non-conforming output is rejected.

---

## 6. Supported Tools (Initial Set)

### Email Tool
```json
{
  "name": "send_email",
  "side_effect": true,
  "reversible": false
}
````

### Calendar Tool

```json
{
  "name": "update_calendar_event",
  "side_effect": true,
  "reversible": true
}
```

### Notion Tools

```json
{
  "name": "create_notion_task",
  "side_effect": true,
  "reversible": true
}
```

```json
{
  "name": "update_notion_task",
  "side_effect": true,
  "reversible": true
}
```

```json
{
  "name": "query_notion_tasks",
  "side_effect": false,
  "reversible": true
}
```

Notion is treated as:

* **The authoritative task list**
* A structured external memory
* A system requiring diff-aware updates (no blind overwrites)

---

## 7. Core Infrastructure Stack

### Language

* Python 3.12

### Web Framework

* FastAPI

### Background Jobs

* Redis (queues, locks, deduplication)
* Worker processes

### Storage

* PostgreSQL

  * Tasks
  * Execution state
  * Audit logs
  * Idempotency keys
  * External object references (Notion IDs, Calendar IDs)

### Containerization

* Docker

### Cloud Runtime

* Fly.io (primary)
* AWS acceptable alternative

### Interface

* Telegram Bot (webhook mode)

### Version Control

* Git (local)
* GitHub (remote)

---

## 8. Data Stores (Separated by Function)

### Operational State

* Active tasks
* Pending tool actions
* Execution status

### Long-Term Memory (Summarized)

* User preferences
* Stable assumptions
* Task patterns

### Audit Log (Immutable)

* Every tool execution
* Tool parameters
* External IDs (Notion task IDs, email IDs)
* Timestamps
* Success or failure state

---

## 9. Execution Guarantees

* Immediate execution on user command
* Deterministic tool behavior
* Idempotent retries
* Explicit failure propagation
* Telegram notification on **every** side effect
* Notion updates always reflected back to the user

---

## 10. Security Constraints

* No raw shell execution
* No raw SQL from LLMs
* Scoped API credentials per tool
* Secrets managed via environment variables
* All tool calls logged and auditable
* Notion access restricted to approved databases only

---

## 11. Deployment Philosophy

* Local development via Docker
* Cloud deployment via container
* Source of truth is the GitHub repository
* No manual changes in production
* Rollbacks via git + redeploy

---

## 12. Initial Build Scope

### Phase 1 — Spine

* Telegram → GPT-5.2 → Claude
* JSON-only responses
* No tools

### Phase 2 — Notion First

* NotionAgent
* Create / update / query tasks
* Full audit logging
* Telegram notifications

### Phase 3 — Email Integration

* EmailAgent
* Send-only
* Task-linked emails

### Phase 4 — Calendar Integration

* CalendarAgent
* Parallel execution with Notion + Email

---

## 13. Non-Goals (Explicitly Out of Scope)

* Browser automation
* Free-form shell access
* Unbounded autonomy
* Self-modifying code
* Direct LLM writes to Notion

---

## 14. Success Criteria

The system is successful when:

* A single Telegram message can create or update multiple Notion tasks
* Notion reflects the authoritative task state at all times
* Emails and calendar events are linked to Notion tasks
* Every side effect is logged and reported
* The agent can operate continuously without supervision




