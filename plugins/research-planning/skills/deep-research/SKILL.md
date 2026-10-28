---
name: deep-research
description: >-
  Use when a question has to be answered from measurements or captured sources rather than memory, and the answer must outlive the conversation — "research this", "deep research X", "go deep on", "use whatever it takes", "compare what the vendors do", "what does the standard actually say", "is X the right call", "how did this trend / meme / controversy start", "what is the internet saying about X", a claim in a draft post or a design doc nobody has verified, a design decision the project's docs do not settle. Not for a single-fact lookup (use research-planning:iterative-research or a direct fetch), and not for making the change itself — once the question is answered, the project's feature or bugfix workflow takes over.
---

# Deep research

Answers a question from evidence and leaves the evidence behind. The deliverable is a record
under `research/NNN-<slug>/` at the repo root, or wherever the project already keeps research
records (look for an existing `NNN-<slug>/` folder with an `evidence/` inside). The record holds
a `README.md` a later session can cite, a `research-trail.md`, and an `evidence/` folder of
verbatim captures. The chat reply recaps the README; it is never the answer's only home.

**A verdict with no `evidence/` behind it is an opinion.** Search results, fetch-tool
summaries and the project's own docs are claims to test, not findings.

## Prerequisites

| Need | Use |
|---|---|
| The web rounds | **REQUIRED SUB-SKILL:** `research-planning:iterative-research`; its rounds go into `research-trail.md` |
| Capturing a web source | `node ${CLAUDE_SKILL_DIR}/scripts/capture.mjs <record>/evidence <url> --tier <tier>` |
| Checking the README's citations | `node ${CLAUDE_SKILL_DIR}/scripts/check-claims.mjs <record>` |
| Claiming the record is complete | `superpowers:verification-before-completion`, if installed |

A fetch tool that answers through a summarising model is not a capture. It can find a page;
`capture.mjs` is what saves it.

## Pick the question type

| The question is about… | Read | Example |
|---|---|---|
| How a system behaves: a site, an API, a library, a tool | `references/behaviour-questions.md` | "Does our 404 page answer Markdown when asked?" |
| What sources say: a trend, a history, a controversy, the state of a field | `references/source-questions.md` | "What is the X meme and where did it start?" |
| Both | both, behaviour steps first | "Do vendors really do what their docs claim?" |

## Size the effort

| Size | Signal | Rounds | Subagents | README |
|---|---|---|---|---|
| Small | One claim to confirm or refute | 1–2 | none | Verdict, Reasoning, Sources, Files |
| Standard | A question with a few angles | 3 | a document reader if the repo has relevant docs | full contract |
| Large | A decision with comparators, or a contested topic | 3, plus targeted fetches | reader, plus the verifier | full contract |

Every size gets the folder, the evidence and the citation check. Size changes how much you
gather, not whether you record it.

## The order

**Create a todo per step before starting.**

1. **Mint the record.** Number = highest existing `NNN` plus one, never reused. Write
   `README.md` holding only the question, as asked and then as a falsifiable statement.
2. **Ground truth from the repo**, when the repo has any. Read the code path yourself and cite
   `file:line`. For a pile of documents, dispatch a reader subagent with this brief: quote,
   cite `file:line`, say where a document is silent, offer no recommendation. Save its report
   verbatim as an evidence file.
3. **Gather**, by question type (the reference file you picked). Every source goes through
   `capture.mjs` with a tier. A source that stays unreadable after the script's fallbacks is
   kept in the manifest and listed in the README as "not used", with the reason.
4. **The web rounds.** Run `iterative-research` and write each round to `research-trail.md` as
   it happens, with a `Fetched:` line of the evidence numbers it produced. Capture the primary
   sources the rounds surface instead of trusting their snippets.
5. **Steelman before verdict.** A behaviour question gets the strongest case for the current
   behaviour; a source question gets the strongest competing account of what happened. Answer
   it point by point.
6. **Write the README** to `references/readme-template.md`. Each Reasoning item carries at
   least one quoted citation `[NN: "verbatim snippet"]`.
7. **Verify.** Run `check-claims.mjs` until it passes. For Large runs, also dispatch a verifier
   subagent with the brief in the template, and save its report as an evidence file.
8. **Reply.** Give a recap that stands on its own (verdict, the load-bearing evidence,
   unresolved conflicts, recommendation) and point at the README. The record exists before the
   reply is written.

## Subagents

- Every dispatch names its model; the reader and the verifier get a strong one.
- A brief names the evidence file the subagent writes, so its output lands in the record
  without passing through your context. Its final report is saved verbatim.
- Research happens in the primary checkout. Don't switch the session into a worktree while a
  subagent is still working there.

## Rationalizations

| Excuse | Reality |
|---|---|
| "The user needs this in an hour; chat is faster" | The record is the answer. A chat answer is gone next session, and the evidence with it. |
| "The fetch tool already gave me the gist" | A summary is not a capture. Run `capture.mjs`; quote from the `.txt`. |
| "The subagent's table is right there, I'll summarise it" | Summaries merge cells. The subagent writes the file; you point at it. |
| "The docs / the post / the search result say it does X" | Measure it, or capture the primary source. Docs describe intent; results describe docs. |
| "The source is blocked, I'll cite the snippet" | `capture.mjs` already tried Markdown and the Wayback Machine. Still blocked means "not used". |
| "I remember the number" | Read it back from `evidence/`. Numbers that change carry the date they were seen. |
| "Small question, the folder is ceremony" | A small question gets a short README in the same folder, not a chat answer. |
| "check-claims passed, so it's right" | It proves the quote exists, not that the claim follows. Read each claim against its quote. |

## Red flags — stop

- A verdict written before `evidence/` has a capture in it
- A README claim with no `[NN: "…"]` behind it, or `check-claims.mjs` not run
- A source of tier `seo` or `ai-summary` carrying a finding alone
- Two sources disagreeing and the README picking one without saying so
- A changing number (likes, views, prices, versions) with no observed-at date
- A subagent report paraphrased into the README instead of saved

Any of these: stop, produce the missing capture or section, then continue.
