# Reporting — the requester report and the Jira comment

Read at Phase 7. Two artifacts come out of a run. The **requester report** is the full
account, in the conversation and in `report.md` in the evidence directory. The **Jira
comment** is the short one for the developer, the writer and whoever reads the issue in six
months. Keep them separate; detail lives in the report.

## The requester report

1. **Verdict** — PASS / PASS with gaps / FAIL / BLOCKED, stated plainly. For a defect, the
   **before → after** pair: where the defect was observed before the fix and that it is gone
   after, or plainly that it could not be reproduced.
2. **Coverage table** — one row per clause of the assembled plan, with its **source**
   (ticket field, description, bugfix artifact, regression box, diff), the status
   PASS / FAIL / NOT TESTED / COVERED-BY-AUTOMATION / NOT APPLICABLE, and the evidence with
   the layer it came from (browser / HTTP / script). Never fold a clause into another.

   `NOT TESTED` needs a real reason: every route to the surface is blocked, or the change
   cannot reach it. "The run was getting long" is not one; neither is "it needed a build".

   `COVERED-BY-AUTOMATION` requires all four: you **read the assertions**, the test is **not
   skipped**, you hold **a result for the code under test** (a Vitest run you made, or an
   e2e result the requester supplied), and you **opened the surface yourself**. A filename
   or an `rg` hit is none of these.
3. **Coverage added beyond the plan** — surfaces the diff reaches that no source named, and
   why. This is what separates testing from instruction-following; make it visible.
4. **Supporting evidence** — unit run, `content:validate`, `curl` transcripts, each labelled
   with its layer. On a requester-supplied URL, which layers were unavailable.
5. **Environment and state left behind** — instance mode, servers still running, a
   worktree, the evidence directory path. An inventory, not a caveat.
6. **Sibling issues** the same evidence covers.
7. **Notes, not defects** — surprising-but-by-design behaviour; say whether confirmed by
   experiment or inferred.
8. **What was not verified**, and why. The dev/build split belongs here whenever the run
   stayed on `dev` for a surface the build decides.

If any clause is NOT TESTED, the verdict is at best **PASS with gaps** — in the first line.

## The Jira comment

Posted for every verdict, including FAIL, as its own comment. **Never claim a human
verified anything**; never transition the issue; never change a field.

**Print it in the conversation before posting.** Nothing can edit or delete it afterwards.

`mcp__jira-kentico__jira_add_comment` takes **Jira wiki markup**: `h3.` / `h4.` headings,
`*` bullets, `*bold*`, `{{code}}`, `[text|url]` links, real newlines. Markdown headings and
backticks render as literal text. Use this structure exactly:

```
h3. 🤖 Testing by AI - PASS ✅

h4. Setup

* *Fix tested* - {{<merge commit>}} on {{main}} ([PR <id>|<url>]), local {{build}} on :3004
* *Environment* - standalone build, Chrome via agent-browser; before state from {{.ai/bugfixes/<dir>/before.md}}

h4. Technical notes

* {{<the unit test file>}} passes locally against the fix → ✅

h4. Test plan coverage

* *<clause>* ✅ → <evidence: what was opened, what was read, both navigation modes>
* *<clause>* ⚠️ → <evidence, plus what needs attention>

h4. Testing beyond the plan

<why these were added — e.g. "Other routes rendering the changed component:">

* *<surface>* — <one line>

Console clean against the baseline on every step ✅

h4. Not tested

* *<what>* — <why, and what would be required>

h4. Unrelated bugs found ⚠️

* <symptom in one sentence>
** *Root cause:* <file / function, what is wrong>
** *Isolation:* <what pins the trigger>
** *Impact:* <latent or immediate>. *Not caused by this change.*
** *Related:* [DOC-####|https://kentico.atlassian.net/browse/DOC-####] — <how>
```

Formatting rules:

- **The verdict is in the heading.** One of exactly four: `PASS ✅`, `PASS with gaps ⚠️`,
  `FAIL ❌`, `BLOCKED ⚠️`. Any NOT TESTED clause makes it `PASS with gaps`.
- A `BLOCKED` run is still posted: what blocked it, how far it got, what would unblock it,
  and plainly that no verdict on the fix was reached.
- `h3.` title, `h4.` sections, nothing larger. No rules, no tables.
- Pattern per item: `*Bold label* <emoji> → evidence`. Emoji: ✅ and ⚠️ in the body, one per
  item; 🤖 and the verdict emoji in the heading only.
- Nested bullets (`**`) only for a bug's root cause / isolation / impact / related.
- Every issue key is a link: `[DOC-3842|https://kentico.atlassian.net/browse/DOC-3842]`.
- Leave out: layer-by-layer breakdowns, long sibling lists, process questions, suggestions
  about the ticket's wording, commentary on how testing was performed.

The failure mode to avoid is volume. If the comment reads as hard to follow, cut content.

## On a FAIL

Post as normal, then say in the handover that **the reader should confirm the failure
themselves before returning the issue to the assignee.** A false FAIL sends a developer to
debug something that is not broken.

## Before proposing a new issue for something found along the way

Search first:

```
mcp__jira-kentico__jira_search_issues
  jql: project = DOC AND (text ~ "<symptom>" OR text ~ "<identifier>") ORDER BY created DESC
```

Search on the visible symptom and on the code identifier, read the closest few rather than
judging on summaries, and report: already filed (key), not filed, or related to given keys.
Filing is the requester's call; the `file-jira-issue` skill does it when they say so.
