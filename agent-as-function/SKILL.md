---
name: agent-as-function
description: "Design and implement multi-agent workflows using the subagent-as-function pattern with filesystem artifact handoff, and decompose monolithic agent prompts into per-phase skills with domain knowledge. Use this skill whenever creating a new multi-agent orchestrator, converting an existing agent to the artifact handoff pattern, adding subagents to an orchestrator. Also triggers on: 'create an orchestrator', 'add a subagent', 'the orchestrator context is too big', 'agent artifact contract', 'status.json', 'manifest.json', 'how should agents pass data', 'pure router orchestrator', 'decompose this agent', 'add domain knowledge', 'phase skills', 'workflow phases', 'skill gaps', or any request involving multi-agent coordination or agent prompt refactoring in the Ralph Orchestrator."
---

# Agent Architecture: Multi-Agent Workflows

This skill covers the two complementary patterns that make up well-structured multi-agent systems in the Ralph Orchestrator:

1. **Prompt decomposition** — break monolithic agent prompts into per-phase skills loaded just-in-time, with a scratchpad contract for state continuity
2. **Subagent-as-function** — orchestrators dispatch subagents as pure functions; all substantive data flows through filesystem artifacts, not conversation context

These patterns are independent but work together. You can decompose a prompt without artifact handoff, or add artifact handoff to a flat-prompt agent. Most mature agents use both.

## When to Use

| Signal | Pattern |
|---|---|
| Agent prompt is 300+ lines, forgets early instructions | Prompt decomposition |
| Agent coordinates 2+ subagents | Both |
| Subagent output bloats orchestrator context | Subagent-as-function |
| Multiple subagents consume the same upstream data | Subagent-as-function |
| Iterative loop (coder → reviewer → coder) needs clean state | Subagent-as-function |
| Agent has domain knowledge gaps (wrong syntax, missed conventions) | Prompt decomposition → skill discovery |
| Existing skills overlap or contradict each other | Prompt decomposition → deduplication |

## Pattern 1: Prompt Decomposition (Phases as Skills)

Turn one giant instruction file into per-phase skills loaded on demand. A scratchpad (`state.md`) tracks which phase the agent is in and which skills to load next.

The agent's main prompt shrinks to a compact workflow table:

| Phase | Skill | Summary |
|-------|-------|---------|
| 1. Setup | workflow-setup | Branch, scratchpad, context search |
| 2. Research | workflow-research | Gather context, sub-agents |
| 3. Write | workflow-write | Implement changes |
| 4. Review | workflow-review | Quality check, revision loop |
| 5. Commit | workflow-commit | Pre-commit checks, push |
| 6. Handoff | workflow-handoff | Write report, exit block |

Each phase skill ends with a transition section that updates `state.md` with the next phase and its skill manifest — including domain-specific skills the agent should consult.

**Process:**

| Step | What to do | Reference |
|------|-----------|-----------|
| 0. Decompose | Break monolithic prompt into phase skills + scratchpad contract | [references/workflow-decomposition.md](references/workflow-decomposition.md) |
| 1. **Analyze** | **Decompose existing prompt into constituent subagents the orchestrator needs** | [references/subagent-analysis.md](references/subagent-analysis.md) |
| 1.5. **Audit Missing Functions** | **Audit the current agent roster for missing subagent functions, identify gaps between the workflow phases and the declared subagents, then confirm the initial audit with the user via `ask_questions` before editing files** | [references/subagent-analysis.md](references/subagent-analysis.md) |
| 2. Explore | Analyze target domain for conventions and failure modes | [references/skill-discovery.md](references/skill-discovery.md) |
| 3. Audit | Read all existing skills, build gap analysis | [references/skill-discovery.md](references/skill-discovery.md) |
| 4. Propose | Enumerate candidate skills with overlap risks | [references/skill-discovery.md](references/skill-discovery.md) |
| 5. Create | Write skill files with pushy descriptions and concrete examples | [references/skill-discovery.md](references/skill-discovery.md) |
| 6. Integrate | Wire skills into workflow phase transition lists + inline references | [references/skill-integration.md](references/skill-integration.md) |
| 7. Deduplicate | Compare new vs existing skills, merge overlaps | [references/skill-integration.md](references/skill-integration.md) |

**Steps 1 and 1.5 are mandatory.** Before writing any code or skills, you must produce the subagent analysis, then audit the declared agent roster for missing functions and confirm that initial audit with the user. Step 1 identifies every distinct responsibility and determines which ones the orchestrator should delegate to subagents vs handle itself. Step 1.5 compares that responsibility map against the actual declared subagents and catches hidden hybrid behavior where an "orchestrator" still performs analyst, coder, reviewer, scout, or archiver work itself. The required output is a subagent roster + routing table + data flow map + missing-function audit. Do not skip these steps — without them, the orchestrator will end up doing work that should be delegated, or subagents will have unclear boundaries.

**Mandatory audit questions before implementation:**

- Which workflow phases still contain substantive work inside the orchestrator?
- Which of those phase functions should become dedicated subagents?
- Which declared subagents are only helpers versus true phase owners?
- Is a scout, analyst, coder/writer, reviewer, or scribe/archiver function still missing?
- Have you confirmed the initial missing-function audit with the user via `ask_questions` before editing files?

**Quick reference:**

- **Phase skill template**: "Before you begin" (read state.md, verify phase) → Instructions → "Before moving to Phase N+1" (update state.md with next skills)
- **Skill integration**: Two levels — transition lists (set the manifest) + inline references (at decision points)
- **Overlap resolution**: Heavy → merge + delete; Moderate → merge unique parts; Minimal → keep + cross-reference
- **Descriptions**: Make them "pushy" — include WHAT + WHEN. Undertriggering is more common than overtriggering.

## Pattern 2: Subagent-as-Function (Artifact Handoff)

The orchestrator becomes a pure router. Subagents communicate through the filesystem, not through conversation.

### Roles

**Orchestrator**: Dispatches subagents with a task-id and one-line directive. Reads only `status.json`. Does administrative work itself (commit, push, PR, JIRA transitions). Never reads artifact content, never relays data between subagents.

**Subagent**: Does one job. Reads input from upstream artifacts on the filesystem. Writes output to its own artifact directory. Returns one line: `"Done. Status: {status}, result: {result}."`

### Core Contracts

Each task gets a shared artifact directory. Every subagent writes to its own subdirectory:

```
{artifact-root}/{task-id}/
├── manifest.json              # append-only audit log
├── {agent-name}/
│   ├── output.md              # primary artifact
│   ├── status.json            # the ONLY thing the orchestrator reads
│   └── ...                    # additional files as needed
```

- `status.json` — structured status with `agent`, `task_id`, `status`, `result`, `summary`, `artifacts`, `next_hint`, `iteration`. See [references/artifact-contract.md](references/artifact-contract.md) for full schema.
- `manifest.json` — append-only audit log for debugging and discovery. See [references/artifact-contract.md](references/artifact-contract.md).
- Iterative loops use versioned artifacts (`output-v1.md`, `output-v2.md`). See [references/artifact-contract.md](references/artifact-contract.md).

**Central design principle**: subagents read each other's artifacts directly. The orchestrator never relays data. See [references/data-flow-patterns.md](references/data-flow-patterns.md) for the full data flow table and routing examples.

### Implementation

- **Building an orchestrator or subagent**: See [references/refactoring-guide.md](references/refactoring-guide.md) for implementation checklists.
- **Converting existing agents**: See [references/refactoring-guide.md](references/refactoring-guide.md) for the 5-step conversion process.

## Large Artifact Handling

Any subagent that writes artifacts exceeding ~5–10KB (prose chapters, detailed plans, growing memory files, aggregated inventories) risks timeout on the `create` tool call. The fix: **bash heredoc append** — split large writes into multiple bash calls, each resetting the CLI timeout clock.

This is not optional for prose-heavy or data-heavy pipelines. It is the single most common cause of agent timeout failures.

See [references/large-artifact-handling.md](references/large-artifact-handling.md) for:
- The full bash heredoc append pattern with prose, JSON, and growing-file examples
- Decision criteria for when to apply the pattern
- Read-side mitigations for context bloat (targeted reads, JSON-first, single-read sources)
- Naming conventions for making the pattern self-documenting per agent

**During architecture design, ask the user:** "Will any subagent produce artifacts larger than ~5KB? (prose, plans, reports, inventories)" If yes — or if artifacts grow across pipeline runs — the agent's output section must include the append pattern.

## Todolist-Driven Structured Passes

Worker agents (any agent that does substantive work — writing, editing, analysis, cataloguing) should organize their execution as **sequential todo-driven passes** tracked via the todolist tool with todo-dependencies.

This pattern exists because LLMs lose coherence when juggling multiple concerns simultaneously. Sequential passes with explicit state transitions produce more reliable output than a single monolithic "do everything" instruction.

### The pattern

Each worker agent includes a "Work Process" section that creates todos in dependency order:

```markdown
## Work Process

You work in **structured passes**, tracked via the todolist tool with todo-dependencies.

Create these todos in order, with each depending on the previous:

1. **Read inputs** — Load config, priming files, upstream artifacts
2. **{Domain-specific work step 1}** — Description of first pass
3. **{Domain-specific work step 2}** — Description of second pass
4. **Self-audit** — Re-read quality references, one pass to catch violations
5. **Write output** — Write artifacts + status.json

Process one todo at a time. Mark in-progress before starting, mark done when complete, query for the next ready todo.
```

### Why this matters

- **Focus**: Each pass has one concern. A slop-hunting pass only hunts slop. A continuity pass only checks continuity. The agent doesn't context-switch.
- **Recoverability**: If the agent crashes mid-execution, the todo state tells you exactly where it stopped.
- **Auditability**: Todo completion order creates an execution trace — you can see which passes ran and which were skipped.
- **Priming refresh**: Passes that re-read reference files between work steps mitigate the "Lost in the Middle" recency bias effect — the relevant rules are fresh in context when the agent needs them.

### When to use

- **Always** for agents that produce or transform prose (writers, editors, expanders)
- **Always** for agents that process multiple categories sequentially (memory-keepers, cataloguers)
- **Usually** for agents that do multi-step analysis (planners, verifiers, auditors)
- **Never** for pure routers (orchestrators) — they dispatch, they don't do passes

### Common pass patterns

| Agent type | Typical passes |
|---|---|
| Writer | Research → Prime context → Write → Self-audit → Output |
| Editor | Prime context → Identify violations → Fix pass → Output |
| Planner | Read inputs → Validate structure → Enrich details → Output |
| Verifier | Read inputs → Research craft → Annotate → Reshape → Output |
| Memory-keeper | Read inputs → Pass per category (characters, locations, ...) → Output |
| Expander | Prime context → Identify targets → Expand → Self-audit → Output |

**During architecture design, ask the user:** "Should this agent work in structured passes?" For any agent doing substantive work, the answer is almost always yes.

## Validation Checklist

After any agent architecture change, verify:

- [ ] **Context cleanliness** — orchestrator context has no artifact content, only status summaries and one-line dispatches
- [ ] **Artifact integrity** — downstream subagents read from filesystem and produce correct output
- [ ] **Audit trail** — `manifest.json` logs the full sequence with timestamps
- [ ] **Loop termination** — iterative loops terminate at configured max
- [ ] **Failure handling** — `status: failed` is written; orchestrator routes without parsing a half-written report
- [ ] **Missing-function audit completed** — every substantive workflow function has an explicit owner, and any intentional hybrid behavior was confirmed with the user before implementation
- [ ] **Large artifact handling** — subagents producing artifacts >5KB use bash heredoc append, not single `create` calls
- [ ] **Todolist-driven passes** — worker agents (writers, editors, analysts, cataloguers) use structured todolist passes with dependencies, not monolithic "do everything" instructions
- [ ] **Phase coverage** — every workflow phase has a skill; no instructions left in the monolithic prompt
- [ ] **Skill manifest** — each phase transition sets the correct skills for the next phase
- [ ] **No dangling references** — deleted or merged skills have no remaining references in phase transitions or inline mentions

## Common Mistakes

**Artifact handoff:**
- Orchestrator reads artifact content — route on `result` codes, not by parsing reports
- Relaying data through orchestrator — subagents read each other's files directly
- Non-standardized result codes — define a fixed set per subagent
- Missing `status.json` on failure — always write it, even when the agent fails
- Overly detailed `summary` — it's for routing (~100 tokens), not a report
- Single-call writes for large artifacts — use bash heredoc append for anything >5KB (see [references/large-artifact-handling.md](references/large-artifact-handling.md))

**Prompt decomposition:**
- Leaving instructions in the main prompt — the workflow table should be the only thing there
- Missing state.md updates — broken phase transitions mean the agent loses track
- Too many skills per phase — cap at ~6-8; more signals overly granular skills
- Duplicated domain knowledge — creates drift; reference instead of copy

## References

[manifest.json example shape](references/manifest.json)

## Further Reading

- [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) — Anthropic's orchestration patterns and delegation strategies
- [Claude Code best practices](https://docs.anthropic.com/en/docs/claude-code/best-practices) — Memory files and project context patterns
- [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) — Instruction files, skills, and agent modes
- [Prompt engineering: be direct](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/be-direct) — Writing clear, imperative instructions
- [OpenAI agent patterns](https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf) — Multi-agent orchestration and guardrails
