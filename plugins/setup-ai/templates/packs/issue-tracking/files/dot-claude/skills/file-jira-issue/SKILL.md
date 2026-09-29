---
name: file-jira-issue
description: >-
  File or fill in a Jira issue in the {{JIRA_PROJECT}} project on {{JIRA_SITE}} with the {{JIRA_MCP_SERVER}} MCP tools — locate the parent epic, match sibling house style, keep the summary to six words, draft the four-block body (Context / What to do / Acceptance criteria / References), confirm with the user, file, verify, and make issue-key mentions render as real hyperlinks. Use whenever the user asks to "file a jira issue", "fill in a ticket", "create a backlog item", "add a task for PROJ-1234", "put this under the 2.x epic", pastes a {{JIRA_SITE}} link wanting a ticket created or written from it, or asks what a good issue body looks like. Skip for pure reads or searches of existing tickets.
---

# File a Jira issue in {{JIRA_PROJECT}}

Produces a well-formed ticket in the {{JIRA_PROJECT}} project, parented under
the right epic, whose body someone can pick up cold and act on. The body
format is in [references/issue-body-template.md](references/issue-body-template.md)
— read it before drafting.
<!-- @if option:codeWork=yes -->

Codebase work — a Story or Bug about the code, tests, tooling or deployment —
goes under the **{{JIRA_CODE_EPIC}}** epic with a `[layer]` prefix on the
summary. The layer roster and the rules for the hard cases are in
[references/layer-prefixes.md](references/layer-prefixes.md); the prefix is not
optional and is never guessed from the symptom.
<!-- @endif -->

## Tools

The `{{JIRA_MCP_SERVER}}` MCP server
([jira-mcp](https://github.com/skurekjakub/jira-mcp), configured in `.mcp.json`)
provides `mcp__{{JIRA_MCP_SERVER}}__jira_get_issue`, `…__jira_search_issues`,
`…__jira_create_issue`, `…__jira_create_subtask`, `…__jira_update_issue` and
`…__jira_add_comment`. If the tools are deferred, load them first (ToolSearch
`+{{JIRA_MCP_SERVER}}`); if the server isn't connected, say so rather than
improvising.

- `description` on create/update takes either a markdown-subset string
  (headings, `-` bullets, paragraphs, inline code, bold — no links, no tables,
  no nested lists) or an ADF document sent verbatim. Pass ADF for anything
  beyond prose and bullets; a `**` glob such as `src/**` is read as bold.
- `jira_update_issue` edits `summary`, `description`, `labels`, `priority`,
  `parentKey`; `parentKey` moves an issue under another epic.
- Creates go into `{{JIRA_PROJECT}}` only. For another project, fall back to
  the REST API with `JIRA_EMAIL` and `JIRA_API_TOKEN` as Basic auth — they
  live in the session environment (a shell profile or the git-ignored
  `.claude/settings.local.json` `env` block); never print them.

## The summary is at most six words

<!-- @if option:codeWork=yes -->
**Six words, after the `[layer]` prefix. Not a guideline.** The prefix doesn't
count against the six.
<!-- @endif -->
<!-- @if !option:codeWork=yes -->
**Six words. Not a guideline.**
<!-- @endif -->

The summary carries no rank number. Severity is the Priority field and order is
the board's rank — a `#NN` in the title duplicates both and goes stale the
moment either changes.

A summary is an index entry, not an abstract. It exists so someone scanning a
hundred rows on a board can tell whether this is the row they want. The
evidence, the mechanism, the file paths and the consequence all belong in the
body, where they are searchable and correctable — a summary that carries them
is unreadable on a board, truncated in every notification, and wrong the moment
the code moves.

Write the noun phrase a reader would use to ask for this ticket by name:

| Instead of | Write |
| --- | --- |
| `Eight admin modules without a same-stem test, and two suites that count path segments to reach the repo root` | `Admin modules missing same-stem tests` |
| `verify-index: the oversize check measures a projected hit and can never fire, and the zero-record list is never computed` | `Index verifier checks never fire` |
| `Spell each cache-policy row once: a cache-control constants module` | `One constants module for cache policy` |

- **No colon-and-elaboration.** `Do X: here is how` is two sentences wearing a
  summary. Keep the first half.
- **No `and`-joined pairs.** Two things means either one title that names the
  shared cause, or two issues.
- **No file paths, symbols or line numbers.** They rot, and they are in the
  body.
- **No severity word.** Severity is the Priority field.
- Hyphenated compounds and a path-free module name count as one word.

## Workflow

1. **Pull the source ticket**, if the work comes from one. The body quotes what
   the source actually claims — summary, states, audience, fixVersion. When the
   source omits implementation specifics, don't invent them; tell the assignee
   to pull those from the implementation.
2. **Find the parent epic.** For release work, search
   `project = {{JIRA_PROJECT}} AND issuetype = Epic AND summary ~ "<version>"`.
   More than one hit, or zero — ask the user rather than guessing.
<!-- @if option:codeWork=yes -->
   Codebase work skips the search: its parent is {{JIRA_CODE_EPIC}}.
<!-- @endif -->
3. **Inspect the epic's children** (`project = {{JIRA_PROJECT}} AND parent = <epic-key>`)
   and copy their house style: issue type, summary phrasing, fixVersion habit.
   On a big epic, query with `status != Closed` and no descriptions, then pull
   one Story and one Bug by key for the body shape.
<!-- @if option:codeWork=yes -->
4. **Pick the layer** for codebase work before writing the summary. Locate
   where the fix lands in the tree (not where the symptom shows), map that path
   onto the roster in the reference file, and apply its hard-case rules. Write
   the runner-up layer into the Context block when there is one. A path that
   maps onto no row is a gap in the roster — say so rather than inventing a
   prefix.
<!-- @endif -->
5. **Draft the body** from the template, then **show the draft and get a
   go-ahead before filing** — the tracker is shared and the ticket is visible to
   the whole team the moment it exists.
6. **File it** with the create tool, parented under the epic.
7. **Verify** by reading it back, and hand the user the ticket URL
   (`https://{{JIRA_SITE}}/browse/<KEY>`). Read-backs through a plain-text
   conversion often flatten bullet lists; that is the conversion, not a broken
   ticket.
8. **Links render only from ADF.** Jira Cloud never auto-links issue keys or
   URLs in API-created text, so a body with any mention (an issue key, a PR, a
   URL) must be sent as an ADF document with a `link` mark or `inlineCard`
   where each mention goes. Node shapes and the render check are in the
   reference file's "Hyperlinks" section. An already-filed ticket is fixed the
   same way with the update tool.
