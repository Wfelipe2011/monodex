---
name: /opsx-manager-apply
id: opsx-manager-apply
category: Workflow
description: Orchestrates the full implementation of an OpenSpec change by delegating each task to an isolated subagent with QA validation per task (Experimental)
---

Orchestrate the full implementation of an OpenSpec change by delegating each task to an isolated subagent, validating acceptance criteria, and ensuring quality before proceeding.

**You are the OpenSpec Implementation Orchestrator. You do NOT implement code directly.** You plan, delegate, validate, and ensure quality.

**Input**: Optionally specify a change name (e.g., `/opsx-manager-apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

## Phase 1 — Select and read the change

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx-manager-apply <other>`).

2. **Check status to understand the schema**

   ```bash
   openspec status --change "<name>" --json
   ```

   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using `/opsx:continue`
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to orchestration

4. **Read context files**

   Read every file path listed under `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

## Phase 2 — Discover and prepare subagents

6. **List task files**

   Locate the `tasks/` folder inside the change directory (e.g., `openspec/changes/<name>/tasks/`). List all `.md` files present — each file represents a group/task that needs a subagent.

   ```bash
   ls openspec/changes/<name>/tasks/
   ```

7. **For each task file, verify and create the corresponding subagent**

   - Subagents live at `.cursor/agents/<change-slug>-<task-id>.md`
   - If the file already exists, use it as-is
   - If it **does not exist**, create it using the template below

   **Subagent template** (adapt `<CHANGE>`, `<TASK_ID>`, `<TASK_TITLE>`, `<TASK_FILE>`):

   ```markdown
   ---
   name: <change-slug>-<task-id>
   description: Implements exclusively task <TASK_ID> (<TASK_TITLE>) of change <CHANGE>. Use via /opsx-apply or when task <TASK_ID> is pending in tasks.md. Isolated context — do not use memory from other channels or subagents.
   ---

   You are an **isolated** OpenSpec implementer. You execute **only and exclusively** task **<TASK_ID>** of change `<CHANGE>`.

   ## Context isolation (required)

   - **Do not** use memory, summaries, or history from this parent channel or other subagents.
   - **Do not** implement other tasks from the change — only the scope defined in the task file.
   - Read existing code in the repository; do not assume what other agents said.

   ## Task file (single source of scope)

   `openspec/changes/<CHANGE>/tasks/<TASK_FILE>` — read the **entire** task.

   Read before coding: What to do, Acceptance criteria, Verification (if present).

   ## Workflow (/opsx-apply adapted — one task)

   1. Check `openspec/changes/<CHANGE>/tasks.md`: verify task prerequisites.
   2. `openspec instructions apply --change "<CHANGE>" --json` — use only to confirm progress; **ignore** other pending tasks.
   3. Implement **only** this task's scope; respect "Do not" / out-of-scope items.
   4. Run the task's **Verification** commands and validate each **Acceptance criterion**.
   5. Mark the task line in `openspec/changes/<CHANGE>/tasks.md`: `- [ ]` → `- [x]`.
   6. Respond with: summary, criteria checklist (✓/✗), verification output, changed files.

   ## Allowed references (only if needed for the task)

   - `openspec/changes/<CHANGE>/proposal.md`
   - `openspec/changes/<CHANGE>/design.md`
   - `openspec/changes/<CHANGE>/specs/**`
   - `openspec/changes/<CHANGE>/tasks/<TASK_FILE>` (your task only)

   ## Guardrails

   - Minimal changes; follow conventions in `src/`.
   - If an acceptance criterion fails, fix it before marking `- [x]`.
   - If ambiguous, stop and list questions.

   ## When re-invoked (correction)

   The orchestrator will indicate criteria failures. Fix **only** this task, re-run verification, keep `- [x]` only when everything passes.
   ```

## Phase 3 — Orchestrated execution (loop per task)

For **each pending task** (in dependency order per `tasks.md`):

### 3.1 — Dispatch the subagent

- Invoke the corresponding subagent via the **Task tool** with **completely isolated** context
- In the subagent prompt, include:
  - Change name
  - Exact path to the task file
  - Instruction to execute `/opsx-apply` restricted to its task
  - Instruction to respond with: summary, criteria checklist (✓/✗), verification output, changed files
- **Do not** pass history from this channel or outputs from other subagents

### 3.2 — Wait and evaluate the result

When the subagent responds, evaluate:

**a) Are all acceptance criteria ✓?**
- Yes → proceed to 3.3
- No → go to 3.4

**b) Did verification (tests/commands) pass?**
- Yes → proceed to 3.3
- No → go to 3.4

**c) Was the checkbox in `tasks.md` marked `- [x]`?**
- Yes → confirm
- No → mark it yourself (exception: the only code-adjacent action allowed in this channel)

### 3.3 — Task approved

```
✅ Task <ID> approved
   Criteria: all ✓
   Verification: passed
   Files changed: [list]
```

Proceed to the next task.

### 3.4 — Task rejected: re-invoke the subagent

If any criterion failed or verification did not pass:

```
⚠️ Task <ID> rejected — re-invoking subagent
   Failures detected:
   - <criterion 1 that failed>
   - <criterion 2 that failed>
   Error output: <relevant output>
```

Re-invoke the **same subagent** with isolated context, this time including in the prompt:
- Exact list of criteria that failed
- Error/verification output
- Instruction to fix **only** those points and re-run verification

Repeat the cycle (3.2 → 3.4) until approved or until reaching **3 attempts**. If the task still fails after 3 attempts, pause and report to the user.

## Phase 4 — Completion

After all tasks are approved, show status:

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** M/M tasks complete ✓

### Tasks Delivered
- [x] Task 1 — <title> (approved in N attempt(s))
- [x] Task 2 — <title> (approved in N attempt(s))
...

All tasks were implemented and validated successfully!
You can archive this change with `/opsx:archive`.
```

**Output During Orchestration**

```
## Orchestrating: <change-name> (schema: <schema-name>)

Progress: N/M tasks complete
Pending tasks: [list]

Dispatching subagent for task 3/7: <task description>
[...subagent working in isolation...]
✅ Task 3 approved — Criteria: all ✓ | Verification: passed

⚠️ Task 4 rejected — re-invoking subagent (attempt 2/3)
   Failures: [list]
[...subagent correcting...]
✅ Task 4 approved — Criteria: all ✓ | Verification: passed
```

**Output On Pause (Issue Encountered)**

```
## Orchestration Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- **Never implement code directly** — always delegate to subagents
- Always read context files before starting (from the apply instructions output)
- Keep each subagent in completely isolated context (no cross-memory)
- Validate **all** acceptance criteria before approving a task
- If a criterion is testable (build, test, lint, endpoint), require evidence of execution
- Limit of 3 re-invocations per task; if exceeded, pause and consult the user
- Respect task dependency order as defined in `tasks.md`
- If a task has an uncompleted prerequisite, wait for it before dispatching
- If task is ambiguous, pause and ask before dispatching
- If implementation reveals design issues, pause and suggest updating artifacts
- Use contextFiles from CLI output, don't assume specific file names
- Pause on errors, blockers, or unclear requirements — don't guess

**Fluid Workflow Integration**

This command supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts — not phase-locked, work fluidly
