---
name: /opsx-propose-v2
id: opsx-propose-v2
category: Workflow
description: Propose a new change with all artifacts generated in one step AND task files enriched with implementation details per group (Experimental)
---

Propose a new change — create the change, generate all artifacts in one step, and enrich each task group with dedicated files ready for isolated subagents.

Extension of `/opsx-propose` with automatic task enrichment.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- specs/ (requirements)
- tasks.md (implementation steps with links to enriched task files)
- tasks/task-NN-<slug>.md (one detailed file per group, ready for subagents)

When ready to implement, run `/opsx-manager-apply` (or `/opsx:apply` for direct implementation).

---

**Input**: The argument after `/opsx-propose-v2` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

## Steps 1–5: Same as `/opsx-propose`

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   This creates a scaffolded change at `openspec/changes/<name>/` with `.openspec.yaml`.

3. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies

4. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes:
        - `context`: Project background (constraints for you - do NOT include in output)
        - `rules`: Artifact-specific rules (constraints for you - do NOT include in output)
        - `template`: The structure to use for your output file
        - `instruction`: Schema-specific guidance for this artifact type
        - `outputPath`: Where to write the artifact
        - `dependencies`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - Create the artifact file using `template` as the structure
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all `applyRequires` artifacts are complete**
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - Check if every artifact ID in `applyRequires` has `status: "done"` in the artifacts array
      - Stop when all `applyRequires` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

5. **Show artifact status**
   ```bash
   openspec status --change "<name>"
   ```

   **Do NOT proceed to Step 6 until ALL artifacts in `applyRequires` are `done`.**

## Step 6: Enrich tasks (v2 differentiator)

After `tasks.md` is created and complete, run automatic task enrichment.

### 6a. Parse groups from tasks.md

Read `openspec/changes/<name>/tasks.md`. Identify each numbered group:

```
## 1. Group Name
## 2. Another Group
...
```

Each `## N. Title` is a group. Each `- [ ] N.M description` line within a group is a subtask.

### 6b. Create one file per group

For each group `N`, create `openspec/changes/<name>/tasks/task-NN-<slug>.md` where:
- `NN` is the number zero-padded (01, 02, ...).
- `<slug>` is the group title in kebab-case.

Example: `## 2. OpenAPI — paths and REST schemas` → `tasks/task-02-openapi-paths-and-rest-schemas.md`.

Each file **must contain**:

```markdown
# Task N — <Group Title>

**Change:** `<name>`
**Group:** N of <total>
**Prerequisites:** <groups this group depends on, with relative links>
**Unlocks:** <groups that depend on this one>

## Group objective

<1–2 sentences: what is delivered when this group is complete>

## Context for the subagent

<Critical codebase facts the subagent needs to know:
  - Relevant files (exact paths)
  - Runtime behaviors (Bun, Node, etc.)
  - Project conventions (naming, snake_case, etc.)
  - What NOT to change>

## Expected files on completion

| File | Action (create / edit / delete) |
|------|----------------------------------|
| ...  | ...                              |

---

## N.M — <Subtask Title>

### What to do

<Specific instructions with enough detail for execution without additional context.
  Include: schemas, JSON/YAML examples, references to real handlers/functions in the codebase,
  shell commands when applicable.>

### Acceptance criteria

- [ ] <objective verification>
- [ ] <objective verification>

### Do not

- <explicit guardrail>

---

<repeat N.M section for each subtask in the group>

---

## Group verification

<How to confirm the group is complete (tests, curl, checklist)>

## Handoff to next task

<What the next subagent will find / assume as ready>
```

**Content sources for enrichment:**
- `design.md`: technical decisions, risks, module structure.
- `specs/<capability>/spec.md`: requirements and scenarios.
- `proposal.md`: scope, impact.
- Real repository code: read relevant files mentioned in the design.

**Detail rule:** each subtask must be self-contained enough for a subagent to execute it receiving only the task file as context.

### 6c. Update tasks.md with links and index

Rewrite `tasks.md` keeping all checkboxes but adding:

1. **Index table** at the top (before the first `## 1.`):

```markdown
| Group | Detail file |
|-------|-------------|
| 1 | [task-01-<slug>.md](./tasks/task-01-<slug>.md) |
| 2 | [task-02-<slug>.md](./tasks/task-02-<slug>.md) |
...

**Execution order:** 1 → 2 → ... (indicate parallelism if applicable)

**Context artifacts:** [proposal.md](./proposal.md) · [design.md](./design.md) · specs
```

2. **📄 link** in each group header:

```markdown
## 1. Group Name

📄 [Details](./tasks/task-01-<slug>.md)

- [ ] 1.1 ...
```

**Output**

After completing all 6 steps, summarize:

```
Change: <name>
Location: openspec/changes/<name>/

Artifacts created:
- proposal.md
- design.md
- specs/<capability>/spec.md
- tasks.md (with links to enriched tasks)
- tasks/task-01-*.md
- tasks/task-02-*.md
  ...

Ready for implementation.
Use /opsx-manager-apply to orchestrate subagents, or /opsx:apply to implement directly.
```

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
- **Do not implement application code in this command** (OpenSpec artifacts only)
- **Do not create empty task files** — if content is insufficient, read more of the codebase before writing
- **Keep tasks.md checkboxes intact** (do not alter `- [ ]` items)
- **Read real code files** before writing technical details in task files (avoid inventing paths or schemas)
