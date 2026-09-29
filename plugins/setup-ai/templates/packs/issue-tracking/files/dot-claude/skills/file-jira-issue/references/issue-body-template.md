# Issue body

## Why this shape

Research on ticket structure converges on four blocks: context with the "why"
(the most-skipped, most-useful part), explicit scope, a testable
acceptance-criteria checklist (3–7 yes/no items), and references. The classic
user-story form ("As a…, I want…") suits product features but reads contrived
for engineering or docs tasks. Sources:
[Atlassian on acceptance criteria](https://www.atlassian.com/work-management/project-management/acceptance-criteria),
[AltexSoft on AC formats](https://www.altexsoft.com/blog/acceptance-criteria-purposes-formats-and-best-practices/).

## Template

Summary: six words, feature- or defect-titled like the epic's siblings, no
ticket keys (those belong in the body).

```
Context

<What this is about, one or two sentences quoting what the source ticket or
finding claims (<SOURCE-KEY>)>. <Why it matters: who is affected and what it
replaces or unblocks.>

What to do

- <The change itself — and when the source doesn't name specifics, say "pull
  the specifics from the implementation" instead of inventing them>
- <Each behaviour or state: what it means and what happens next>
- <Machine-facing surface: exit codes / output shapes, with an example>
- <Placement: which files, pages or components host the change>

Acceptance criteria

- <Testable yes/no item>
- <3–7 total; if more, split the ticket>

References

- <SOURCE-KEY> — source ticket
- <PR, doc or follow-up file>
```

> **Template note:** once the project has a ticket that follows this shape
> well, name it here as the worked example to open next to a new draft.

## Hyperlinks

Jira Cloud does not auto-link issue keys or URLs in API-created text, and
markdown-to-ADF converters in MCP servers often have no link support — so
mentions like `PROJ-123` in a markdown body land dead. Send the description as
an ADF document with real link nodes where the mentions go.

Two node shapes, both render:

An in-sentence hyperlink — a `text` node with a `link` mark:

```json
{
  "type": "text",
  "text": "PROJ-123",
  "marks": [
    { "type": "link", "attrs": { "href": "https://{{JIRA_SITE}}/browse/PROJ-123" } }
  ]
}
```

A smart-link chip (icon + summary + status, best in a References list) — an
`inlineCard` node:

```json
{ "type": "inlineCard", "attrs": { "url": "https://{{JIRA_SITE}}/browse/PROJ-123" } }
```

Through REST, the PUT replaces the whole description, so rebuild the full ADF
doc (`{"fields": {"description": {"type": "doc", "version": 1, "content": [...]}}}`
— paragraphs, `bulletList`/`listItem` wrappers, and the link nodes above):

```bash
curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  -H "Content-Type: application/json" --data @description.json \
  "https://{{JIRA_SITE}}/rest/api/3/issue/<KEY>"
```

204 means updated. Verify the render without a browser: GET the issue with
`?expand=renderedFields&fields=description`. A link mark comes back as an
anchor showing the key; an `inlineCard` as an anchor with
`title="smart-link"` showing the bare URL (a chip in the Jira UI).
