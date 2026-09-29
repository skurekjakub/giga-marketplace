---
name: file-jira-issue
description: File or fill in a Jira issue in the Kentico doc backlog (DOC project on kentico.atlassian.net) with the jira-kentico MCP tools — locate the epic (a release epic for docs work, the Nextjs epic DOC-3807 for anything about the site's code, tests, tooling or deployment), match sibling house style, put the mandatory [layer] prefix on a codebase issue's summary, draft the four-block body (Context / What to document or What to do / Acceptance criteria / References), confirm with the user, file, verify, and make issue-key mentions render as real hyperlinks. Use this skill whenever the user asks to "file a jira issue", "fill in a ticket", "create a doc backlog item", "add a docs task for KX-1234", "put this under the 31.x epic", "file this under nextjs", "which layer does this go in", pastes a kentico.atlassian.net link wanting a ticket created or written from it, or asks what a good Jira issue body looks like. Skip only for pure reads or searches of existing tickets.
---

# File a Jira issue in the doc backlog

Produces a well-formed ticket in the DOC project, parented under the right
epic, whose body someone can pick up cold and act on. Two kinds of ticket go
through here:

- **Docs work** — a Documentation ticket under a release epic. Body format in
  [references/issue-body-template.md](references/issue-body-template.md).
- **Codebase work** — a Story or Bug about the site's code, tests, tooling or
  deployment, under the **Nextjs** epic (DOC-3807), with a `[layer]` prefix on
  the summary. The layer roster and the rules for the hard cases are in
  [references/layer-prefixes.md](references/layer-prefixes.md); the prefix is
  not optional and is never guessed from the symptom.

Read the reference that applies before drafting.

## The summary is at most six words

**Six words, after the `[layer]` prefix. Not a guideline.** The prefix does not
count against the six; everything after it does.

The summary carries no rank number. Severity is the Priority field and order is
the board's rank — a `#NN` in the title duplicates both, goes stale the moment
either changes, and collides across sweeps that number from one independently.

A summary is an index entry, not an abstract. It exists so someone scanning a
hundred rows on a board can tell whether this is the row they want. The
evidence, the mechanism, the file paths and the consequence all belong in the
body, where they are searchable, formattable and correctable — a summary that
carries them is unreadable on a board, truncated in every notification, and
wrong the moment the code moves.

Write the noun phrase a reader would use to ask for this ticket by name:

| Instead of | Write |
| --- | --- |
| `[test] Eight admin modules without a same-stem test, and two suites that count path segments to reach the repo root` | `[test] Admin modules missing same-stem tests` |
| `[emit] verify-algolia-index: the oversize check measures a projected hit and can never fire, the zero-record list is never computed, and the header claims a local comparison the code never makes` | `[emit] Index verifier checks never fire` |
| `[edge] Spell each cache-policy row once: a lib/http/cache-control.ts constants module` | `[edge] One constants module for cache policy` |

Rules that follow from it:

- **No colon-and-elaboration.** `Do X: here is how` is two sentences wearing a
  summary. Keep the first half.
- **No `and`-joined pairs.** Two things means either one title that names the
  shared cause, or two issues.
- **No file paths, symbols or line numbers.** They rot, and they are in the
  body.
- **No severity word.** Severity is the Priority field, which sorts and filters;
  a title that says "critical" does neither.
- Hyphenated compounds and a path-free module name count as one word.

Jira's own hard cap is 255 characters, which a six-word summary never
approaches — but a draft that exceeds 255 is rejected outright, so if you ever
see that error the title needed this rule, not a trim.

## Workflow

1. **Pull the source ticket** (`jira_get_issue` on the KX/other key). The body
   quotes what the source actually claims — summary, states, audience,
   fixVersion. When the source omits implementation specifics (command names,
   flags, output shapes), do not invent them; write the body so it tells the
   assignee to pull those from the implementation.

2. **Find the parent epic.** Release epics in the doc backlog are named after
   the version: `project = DOC AND issuetype = Epic AND summary ~ "<version>"`.
   More than one hit, or zero — ask the user rather than guessing. Codebase
   work skips the search: its parent is DOC-3807.

3. **Inspect the epic's children** (`project = DOC AND parent = <epic-key>`,
   with `includeDescription`) and copy their house style: issue type (release
   epics use **Documentation**, not Task/Story), summary phrasing
   (feature-titled, no ticket keys in the summary, six words — see above),
   and fixVersion habit
   (children usually leave it empty — the epic carries the release identity).
   DOC-3807 has over a hundred children; query it with `status != Closed` and
   no descriptions, then pull one Story and one Bug by key for the body shape.

3a. **Pick the layer** for codebase work before writing the summary. Locate
   where the fix lands in the tree (not where the symptom shows), map that
   path onto the roster in the reference file, and apply its hard-case rules
   when the work spans layers or is a test. Write the runner-up layer into the
   Context block when there is one. If the path maps onto no row of
   [`docs/conventions/lib-layering.md`](../../../docs/conventions/lib-layering.md),
   that is a gap in the convention: say so to the user rather than inventing a
   prefix.

4. **Draft the body** from the template in the reference file, then **show the
   draft and get a go-ahead before filing** — the tracker is shared and the
   ticket is visible to the whole team the moment it exists.

5. **File it**: `jira_create_issue` with `issueType: "Documentation"` and
   `parentKey` set to the epic; for codebase work `issueType` is `"Story"` or
   `"Bug"`, `parentKey` is `DOC-3807` and the summary starts with the
   `[layer]` prefix. The MCP tool only creates in the DOC project; for any
   other project fall back to direct REST (credentials below).

6. **Verify** with `jira_get_issue` and hand the user the ticket URL. The
   read-back flattens bullet lists — items concatenate with no separator. That
   is an artifact of the ADF→plain-text conversion, not a broken ticket; the
   Jira UI renders the lists fine.

7. **Links render only from ADF.** Jira Cloud never auto-links issue keys or
   URLs in REST-created text, and the markdown→ADF converter has no link
   syntax, so a body with any mention (`KX-25474`, a PR, a URL) must be passed
   as an ADF document — `description` accepts one directly — with a `link`
   mark or `inlineCard` where each mention goes. Node shapes and the render
   check are in the reference file's "Hyperlinks" section. An already-filed
   ticket is fixed the same way through `jira_update_issue`.

## Tool notes

- `description` on `jira_create_issue`, `jira_create_subtask` and
  `jira_update_issue` takes either a markdown-subset string or an ADF document
  (`{"type":"doc","version":1,"content":[…]}`) sent verbatim. The markdown
  subset is `#`–`######` headings, `-`/`*` bullets, blank-line paragraphs,
  inline `` `code` `` and `**bold**`; nothing else converts — no links, no
  tables, no nested lists — and a `**` glob segment such as `app/admin/**`
  is read as bold, so pass ADF for anything beyond prose and bullets
  (converter: `src/adf.ts` in https://github.com/skurekjakub/jira-mcp).
- `jira_update_issue` edits `summary`, `description`, `labels`, `parentKey`
  on an existing issue; `parentKey` moves it under another epic.
- Direct REST uses `JIRA_EMAIL_KENTICO_JIRA` + `JIRA_PAT_KENTICO_JIRA` from the
  session environment as Basic auth. They are set in the gitignored
  `.claude/settings.local.json`; never print them.
