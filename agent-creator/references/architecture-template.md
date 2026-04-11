# Architecture Template

Use this template for the Phase 2 deliverable. Reference `agent-as-function/references/data-flow-patterns.md` for routing table patterns.

---

# Architecture: {Agent Family Name}

## Subagent Roster Summary

| Name | Model | Role | Conditional? |
|---|---|---|---|
| {subagent-1} | {claude-opus-4.6} | {One-line role} | {No / Yes — condition} |
| {subagent-2} | {claude-sonnet-4} | {One-line role} | {No / Yes — condition} |

## Routing Table

| Agent completed | result | Action |
|---|---|---|
| {subagent-1} | {result-code-1} | {dispatch subagent-2} |
| {subagent-1} | {result-code-2} | {log blocker, exit with blocked status} |
| {subagent-2} | {result-code-1} | {dispatch subagent-3} |
| {subagent-2} | {result-code-2} | {dispatch subagent-2 (iteration++, max N)} |
| {subagent-3} | {result-code-1} | {dispatch subagent-4} |
| Any subagent | `failed` | {Log failure, exit with error status} |

### Completeness Check

- [ ] Every subagent's every result code appears in the table
- [ ] Every row has a clear next action
- [ ] Iteration limits are explicit with max counts
- [ ] Error/blocked paths lead to graceful exits
- [ ] No action results in an infinite loop or hang

## Data Flow

```
{subagent-1} → writes {subagent-1}/output.md
  ↓ (filesystem read)
{subagent-2} → reads {subagent-1}/output.md, writes {subagent-2}/output.md
  ↓ (filesystem read)
{subagent-3} → reads {subagent-2}/output.md + {changed files}, writes {subagent-3}/output.md
  ↓ (routing loop on needs-revision)
{subagent-2} → reads {subagent-3}/output-v{N-1}.md, writes {subagent-2}/output-v{N}.md
  ...
{final-agent} → reads all */output.md + manifest.json, writes {final-agent}/output.md
```

### Data Flow Verification

- [ ] Orchestrator appears nowhere in data transmission
- [ ] Every file written by one subagent that's read by another is listed
- [ ] No subagent depends on data only available in the orchestrator's context

## Artifact Directory Structure

```
{artifact-root}/
├── {subagent-1}/
│   ├── output.md
│   └── status.json
├── {subagent-2}/
│   ├── output-v{N}.md       (versioned for iterating agents)
│   └── status.json
├── {subagent-3}/
│   ├── output-v{N}.md
│   └── status.json
├── {final-agent}/
│   ├── output.md
│   └── status.json
└── manifest.json
```

**Artifact root:** `{e.g., .ralph/tasks/{task-id}/artifacts/}`

## Model Allocation

| Agent | Model | Rationale |
|---|---|---|
| orchestrator | {claude-opus-4.6} | {Routing complexity requires strong reasoning} |
| {subagent-1} | {claude-opus-4.6} | {Deep analysis / coding / review} |
| {subagent-2} | {claude-sonnet-4} | {Mechanical extraction / formatting} |

## Iteration Loops

| Loop | Agents involved | Max iterations | Trigger |
|---|---|---|---|
| {e.g., write-review} | {writer → reviewer → writer} | {3} | {reviewer returns `needs-revision`} |
| {e.g., build-fix} | {coder → coder} | {2} | {coder returns `build-broken`} |

## Parallel Dispatch Opportunities

| Group | Agents | Dispatch condition | Aggregation |
|---|---|---|---|
| {e.g., review panel} | {reviewer-1, reviewer-2, reviewer-3} | {After writer completes} | {All must complete; any rejection triggers revision} |

{If no parallel dispatch opportunities, write "None — fully sequential pipeline."}

## Ordering Constraints

Hard sequencing rules that must never be violated:

1. {e.g., researcher MUST complete BEFORE planner is dispatched}
2. {e.g., planner MUST complete BEFORE writer is dispatched}
3. {e.g., All reviewers MUST complete BEFORE commit}

## Error Handling

| Failure | Agent | Response |
|---|---|---|
| {e.g., Access denied to repo} | {researcher} | {Exit with `blocked`, log blocker} |
| {e.g., Build broken after max retries} | {coder} | {Set status `partial`, proceed to handoff} |
| {e.g., Reviewer crashes} | {reviewer} | {Log, proceed without that review} |

## Post-Task Hooks

{If this agent family needs post-execution analysis (scientist-style), define the hooks here.}

| Hook | Purpose | Model |
|---|---|---|
| {e.g., run-analyzer} | {Per-subagent quality analysis} | {claude-opus-4.6} |

{If no post-task hooks, write "None planned for initial version."}

## Large Artifact Handling

{Which subagents produce artifacts that can exceed ~5KB? These need bash heredoc append patterns in their output sections.}

| Agent | Artifact | Estimated max size | Append pattern needed? |
|---|---|---|---|
| {e.g., writer} | {output-v{N}.md — prose chapter} | {15–50KB} | {Yes — split at scene boundaries} |
| {e.g., planner} | {plan.json — beat plan} | {10–30KB} | {Yes — split metadata + beat groups} |
| {e.g., memory-keeper} | {characters/ dir — per-entity files} | {2-5KB each, forever} | {No — split per entity solves growth. Use _index.json for discovery.} |
| {e.g., scribe} | {handoff.md — aggregated report} | {3–8KB} | {No — under threshold} |

{If no agent produces large artifacts, write "All artifacts under 5KB — no append patterns needed."}

**Read-side mitigations:** {Are there agents that read large input corpora? List targeted reads, JSON-first strategies, or single-read-source rules. Reference `agent-as-function/references/large-artifact-handling.md` for patterns.}

### Growing Files — Per-Entity Architecture

{If any agent accumulates data across pipeline runs (memory, inventories, ledgers), design per-entity file splitting from the start. Do NOT create monolith files that grow unbounded.}

**Pattern:** One directory per category, one file per entity, one lightweight `_index.json` for discovery:

```
{working-dir}/memory/
├── {category}/                  # e.g., characters/, locations/, relationships/
│   ├── _index.json              # Roster: name, slug, aliases, firstAppearance, lastAppearance
│   ├── {entity-slug}.json       # Full structured profile (~2-5KB, stays small forever)
│   └── {entity-slug}.md         # Human-readable bible entry
```

**Slug convention:** lowercase, hyphen-separated. Remove apostrophes. For relationship pairs: alphabetical names, double-dash separator (`jaina--sylvanas`).

**Read patterns that benefit:**
- *Broad scans* (e.g., continuity annotation) → read `_index.json` files only (~1KB each)
- *Targeted reads* (e.g., writer loading required characters) → load specific `{slug}.json` files by path
- *Merge writes* (e.g., memory-keeper updating after a chapter) → read + overwrite single entity files

{If the pipeline has no growing files, write "No growing files — skip per-entity architecture."}

## Worker Agent Workflow Design

{For each worker subagent (anything that's not a pure router), define its todolist-driven pass sequence. Pure routers/orchestrators skip this section.}

### {Agent Name} — Pass Sequence

| Pass | Todo | Depends on | What it does |
|---|---|---|---|
| 1 | Read inputs | — | Load config, upstream artifacts, priming files |
| 2 | {Domain pass 1} | Read inputs | {One-concern work step — e.g., "Hunt slop patterns"} |
| 3 | {Domain pass 2} | {Pass 1} | {Next concern — e.g., "Fix identified violations"} |
| 4 | Self-audit | {Pass 2} | Re-read quality references, verify output |
| 5 | Write output | Self-audit | Write artifacts + status.json |

**Priming refreshes:** {Which passes re-read reference files? Where do you place them to combat recency bias? E.g., "Re-read slop-hitlist between Hunt and Fix passes."}

{Repeat this subsection for each worker subagent. Orchestrators and pure routers get no pass sequence — they dispatch.}

### Pass Design Principles

- **One concern per pass.** A slop-hunting pass only hunts slop. A continuity pass only checks continuity.
- **Priming goes first.** Read quality references before the pass that needs them, not at agent startup.
- **Self-audit goes last.** One final pass against key quality references before writing output.
- **Dependencies are linear.** Each pass depends on the previous. No parallel passes within a single agent — parallel dispatch happens at the orchestrator level.
