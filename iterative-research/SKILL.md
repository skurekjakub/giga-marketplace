---
name: iterative-research
description: Multi-round deepening WebSearch pattern for complex, open-ended research questions. Three rounds of 3 parallel WebSearch queries each, synthesizing after every round before deciding the next batch — never plan all nine queries upfront. Use this skill whenever the user asks for "research", "best practices for X", "current state of Y", "modern patterns for", "before designing Z", "study this domain", "look this up properly", "deep-dive the web on", or explicitly says "iterative search", "3 by 3 websearch", "X rounds of websearch", "X by Y rounds". Also use whenever Claude is about to commit to a non-trivial architecture decision, agent prompt, library choice, or system design without checking current sources first — proactively ground recommendations in primary docs rather than training data. Skip only when the question is genuinely narrow enough for a single targeted query (e.g. "what's the current Node LTS version").
---

# Iterative Research

Three-round deepening web search for complex research questions. Each round runs **three parallel WebSearch queries in one message**, then you synthesize before picking the next round's queries. You never plan all nine queries upfront — that defeats the whole point of iterating.

The reason this works: a single round of queries reflects only what you *expected* to find. Each round of synthesis exposes what you actually learned, which reshapes what's worth asking next. Pre-planning nine queries gives you nine first-round queries, not a research pipeline.

## When to use

- Open-ended "what's the modern way to X" questions
- Pre-design research before writing a non-trivial system, agent, prompt, or architecture decision
- Verifying that something you think you know still holds in current versions (training data lies by omission about anything newer than the cutoff)
- Surveying a domain the user is about to commit to (frameworks, patterns, tooling)
- The user explicitly asked for iterative or multi-round research

Skip when a single query would do. "What's the current Node LTS" is one query. "How should we design an adversarial code-review agent for a Next 16 / TS project" is this skill.

## The pattern

### Round 1 — Survey

Three parallel queries in one message, each attacking the question from a **distinct angle**. Don't refine yet; cast wide. The angles should probe different facets so the three result sets don't overlap. Typical choices:

- The named pattern or technique itself, in the abstract
- The host framework / platform / stack the pattern lives inside
- The known anti-patterns, pitfalls, or failures in that space

After the round, write **one short paragraph** of synthesis: what each angle revealed, which signals look strongest, where the gaps are, what named patterns or specific sources surfaced. That synthesis is what informs round 2 — without it round 2 is just guessing.

### Round 2 — Deepen

Pick the strongest signals from round 1 and dive deeper. Specifics now: named patterns, concrete repos, vendor blog posts, version-pinned docs. Three parallel queries again, each chasing a specific signal from round 1.

Typical choices:

- The named pattern you spotted in round 1, but for specific implementation details (templates, example repos, real prompts)
- The official primary-source documentation (vendor docs, RFCs, framework changelogs) for the specific feature you're applying
- A high-signal study, benchmark, or post that round 1 hinted at

Synthesize again. One paragraph. What got confirmed? What got disconfirmed? What new specifics surfaced that you didn't know to ask about in round 1?

### Round 3 — Verify and harden

By now you have a direction. Round 3 verifies it and hunts edge cases. Three parallel queries:

- Authoritative reference for the chosen pattern (the **primary source**, not aggregators — vendor docs, framework GitHub repos, RFCs)
- Known failure modes, anti-patterns, or pitfalls specific to the chosen direction
- An adjacent concern you'd be irresponsible not to check (version compat, security implications, perf characteristics, breaking-change history)

Final synthesis: enumerate concrete takeaways the downstream task should bake in. Each takeaway tied to its source.

## Rules

- **Parallel within a round, sequential across rounds.** Three queries always go in the same message (one tool-call block, three WebSearch invocations). Rounds run in series because each depends on the prior synthesis.
- **Never plan all nine queries upfront.** If you can pre-write all nine, you don't need this skill — you're not actually iterating. Round 2's queries must be discoverable only after round 1 lands.
- **Primary sources beat aggregators.** Vendor docs, RFCs, official changelogs, framework repos beat Medium articles, LinkedIn posts, content farms. When both surface for the same claim, cite the primary.
- **Cite as you go.** Tag each finding with its source so the user (or the downstream task you're informing) can verify. Anything you can't cite is a guess, not a finding.
- **Synthesize between rounds.** A short paragraph — strongest signal, weakest, what you're about to chase. Without this synthesis the rounds are isolated, not iterating.
- **Stop early if you have the answer.** Three rounds is the default ceiling, not a mandate. If round 2 nails it, write the final synthesis and move on.
- **Stop early if you're stalled.** If a round produces nothing new, change the angle or escalate scope rather than burning the next round on more of the same. Two productive rounds beat three repetitive ones.
- **Match query length to the question.** Long, specific queries with exact terms work better for round 2 and round 3. Round 1 can be broader.

## Output format

When iterative research is the **primary task** (user explicitly asked you to research something), surface the per-round structure explicitly so the user sees the trail:

```
## Round 1 — survey
Queries:
  - <query 1>
  - <query 2>
  - <query 3>
Synthesis: <one paragraph — named patterns spotted, strongest signal, gaps>

## Round 2 — deepen
Queries:
  - <query 1>
  - <query 2>
  - <query 3>
Synthesis: <one paragraph — what confirmed, what disconfirmed, new specifics>

## Round 3 — verify
Queries:
  - <query 1>
  - <query 2>
  - <query 3>
Synthesis: <one paragraph — concrete takeaways with sources>

## Final takeaways
- <takeaway> — [source]
- <takeaway> — [source]
```

When the research is **embedded** in a larger task (you're researching to inform a prompt, agent, or implementation you're about to write), collapse the structure into terse one-liners and skip the formal headings — but still do three rounds with synthesis between them. The discipline is the same; only the user-facing format gets compressed.

## Worked example

Designing a hostile code-review subagent for a Next 16 / React 19 / TS project:

- **Round 1** — (a) adversarial code-review prompt design generally, (b) Claude Code subagent YAML conventions, (c) Next 16 / cacheComponents anti-patterns.
  Synthesis: spotted multi-perspective review pattern (security/perf/maintainability), confirmed YAML frontmatter shape (name, description, tools, model), saw a cited study showing AGENTS.md context beat skills on Next 16 evals.

- **Round 2** — (a) concrete code-reviewer subagent templates with severity formats, (b) the specific AGENTS.md study (100% vs 79% pass rate), (c) `"use cache"` pitfalls in Next 16.
  Synthesis: confirmed severity-bucket output format (BLOCKER / IMPORTANT / NIT) with a nit cap, surfaced specific cached-scope pitfalls (`cookies()`/`headers()` inside cached scope, Promise closures, class instances returned from cached fns).

- **Round 3** — (a) primary `code-reviewer.md` template from awesome-claude-code-subagents, (b) RSC anti-patterns around the `"use client"` boundary, (c) TS strict around `await params` / `await searchParams` typing mistakes.
  Final takeaways: severity buckets with nit cap; file:line citations; no-praise calibration; explicit hunt list spanning Next 16 / React 19 / TS / Tailwind 4 / repo conventions; AGENTS.md-anchored reading order.

Three rounds, nine queries, each round narrowed by the prior synthesis — and the resulting agent ended up substantively shaped by signals that didn't exist in round 1 queries.
