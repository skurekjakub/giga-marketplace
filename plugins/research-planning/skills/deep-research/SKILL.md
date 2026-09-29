---
name: deep-research
description: >-
  Use when a question about behaviour has to be measured rather than remembered and the answer must outlive the conversation — "research this", "compare what the vendors do", "is X the right call", "what does the standard actually say", a claim in a draft post or a design doc nobody has verified, a design decision the project's docs do not settle, "go deep on", "use whatever it takes". Produces a durable research record with verbatim evidence. Not for a single-fact lookup (use iterative-research or a direct fetch), and not for making the change itself — once the question is answered, the project's feature or bugfix workflow takes over.
---

# Deep research

Answers a question by measuring, and leaves the measurements behind. The deliverable is a
record under `research/NNN-<slug>/` at the repo root (or wherever the project already keeps
research) — a `README.md` a later session or a post can cite, a `research-trail.md`, and an
`evidence/` folder of verbatim captures. The chat reply is a recap of the README, never the
answer's only home.

**A verdict with no `evidence/` behind it is an opinion.** Without the record, an agent asked
the same question a week later re-derives it; with a summary instead of a capture, it inherits
the transcription error (a vendor table with two cells merged into one is the classic case).
Web search results and the project's own docs are claims to test, not findings — a design doc
that says "same behaviour as vendor X" is exactly the claim that turns out wrong for the case
that matters.

## Prerequisites

| Need | Skill |
|---|---|
| The web rounds | `research-planning:iterative-research` — **REQUIRED SUB-SKILL**; its rounds go into `research-trail.md` |
| Reading a pile of repo documents | a subagent on a strong model (for example `model: "opus"`) |
| Claiming the record is complete | `superpowers:verification-before-completion`, if installed |

## The order

**Create a todo per step before starting.** A research run with no checklist is how the
consumer test or the trail quietly goes missing.

1. **Mint the record first.** List `research/` — highest `NNN` plus one, never reused.
   Write `README.md` with only the question: as the user asked it, then as a falsifiable
   statement ("a request for a missing page should get the HTML 404 because …"). Everything
   after this step writes into the folder.
2. **Ground truth from the repo, with locators.** Read the code path yourself (`file:line`).
   Dispatch a subagent for the documents — design docs, plans, bugfix notes, eval notes, the
   tests that pin today's behaviour, any upstream project this one derives from — with the
   brief: quote, cite `file:line`, say where a document is silent, offer no recommendation. Its
   report is saved verbatim as an evidence file; you do not retype it.
3. **Measure the subject.** Write the measurement as a script in `evidence/` and save its raw
   output. The script declares its inputs at the top so it can be re-run against anything.
   Cover at least: a case that has the feature, a case that exists without it, a case that
   does not exist at all, and any edge class the implementation lets through.
   *HTTP example:* a probe whose rows are URLs and whose columns are status, content type,
   `vary`, `cache-control`, `x-robots-tag`, `link`, and length or redirect target.
4. **Measure the comparators with the same script.** The vendors or implementations the user
   named (in the order they named them), then the ones the domain makes obvious, then any
   upstream. Same case classes each. A vendor claim from a blog post, a search summary, or a
   design doc is not a measurement until the script has run against that vendor. Long batches
   go in the background one target at a time; the raw output is the evidence file, not your
   paraphrase.
5. **Measure the consumer.** What the real client sends and what it does with the answer.
   *HTTP example:* point the actual tool (a fetch tool, `curl` with the tool's headers, a
   crawler's documented user agent) at an echo endpoint such as `https://httpbin.org/headers`;
   then point the same tool at the live URL under question and record what reaches the model —
   a tool that drops the body of every non-2xx response changes the verdict. Save both.
6. **Primary sources, verbatim.** Standards and specs: fetch the text and quote the deciding
   paragraphs with section numbers. Vendor documentation and packages: download the package
   (for npm, `npm view <pkg> dist.tarball`), keep the README and the source that decides, and
   note version and date. A source the fetch tool cannot read is retried with
   `curl -H 'Accept: text/markdown'`, then plain `curl`; a source that stays unreadable is
   listed as "not used" with the reason.
7. **The web rounds.** `iterative-research`, three rounds of three, each round's queries and
   synthesis written into `research-trail.md` as it happens. Fetch the primary sources the
   rounds surface (step 6) rather than trusting their snippets.
8. **Steelman before verdict.** Write the strongest case for the current behaviour and answer
   it point by point. Then the verdict, the recommendation, and — when the answer implies a
   change — a "what would change" map: files, tests, documents, with `file:line`, marked as a
   map. Side findings the research surfaced but did not settle get their own section; each one
   also becomes a follow-up in the project's usual place (a follow-ups folder, a tracker issue)
   or a line saying it was consciously dropped.
9. **Write the README to the contract below**, then the file index. Every number, header
   value and vendor behaviour in it points at an evidence file. Re-read `evidence/` before
   claiming a measurement you remember taking.
10. **Reply.** A recap that stands on its own — verdict, the load-bearing evidence, the
    recommendation, the side findings — pointing at the README. The record exists before the
    reply is written.

## `README.md` — the contract

In this order. Scale each section to the question; a narrow question gets a short README, not a
missing section.

1. **Header** — what was measured, against what, on which date, from which branch; what the
   research changed (nothing) and where the change lives once it lands.
2. **Question** — as asked, then falsifiable.
3. **Verdict** — one paragraph, the answer and the single strongest reason.
4. **Reasoning** — numbered lines of evidence, each with its evidence-file pointer; the
   comparator table (target × decides-by × the case classes, measured date) sits here.
5. **The steelman** — the current behaviour's best case, answered.
6. **Recommendation** — the rule, and the open sub-choices with a recommendation each.
7. **What would change** — the map, marked as a map; or "nothing".
8. **Side findings** — out of scope, surfaced for a decision, each with its follow-up.
9. **Sources** — every URL used, with a clause on what it settled.
10. **Files** — the evidence index: one line per file, what it holds.

`research-trail.md` follows the `iterative-research` output format. `evidence/` files are
numbered in the order they were captured, named for what they hold, and never edited after
capture; a later measurement is a new file. Exclude `research/*/evidence/` from formatters so
captures stay byte-exact.

## Subagents

- Every dispatch names its model; the document reader and any reviewer get a strong one.
- A brief names the evidence file the subagent writes and its format, so its captures land in
  the record without passing through your context. The final report is saved verbatim beside
  them.
- Research happens in the primary checkout; the change it recommends is the workflow that
  branches. Don't switch the session into a worktree while a subagent is still working in the
  primary checkout.

## Rationalizations

| Excuse | Reality |
|---|---|
| "The user needs this in an hour; chat is faster than a record" | The record is the answer. A chat answer is gone by the next session and the evidence with it. |
| "The subagent's table is right there, I'll summarise it" | You will merge two cells. The subagent writes the file; you point at it. |
| "The design doc / the post already says what it does" | Measure it. Docs describe intent, not behaviour. |
| "Search results say vendor X does Y" | Run the measurement against vendor X. Results describe their docs, not their edge cases. |
| "The behaviour is documented, the consumer test is overkill" | The decisive fact — for example a fetch tool that drops 4xx bodies — is often documented nowhere. |
| "The source didn't fetch, I'll cite the summary" | Try `Accept: text/markdown`, then plain `curl`; if it still fails, say "not used" and why. |
| "I remember the number" | Read it back from `evidence/`. |
| "This is a small question, the folder is ceremony" | A small question gets a short README in the same folder shape, not a chat answer. |

## Red flags — stop

- A verdict written before `evidence/` has a capture in it
- A comparator row in the README with no raw output behind it
- A number, header value or quotation in the README that no evidence file contains
- "Measured" with no date, or a date with no target named
- A subagent report paraphrased into the README instead of saved
- The chat reply longer than the README's verdict and reasoning

Any of these: stop, produce the missing capture, then continue.
