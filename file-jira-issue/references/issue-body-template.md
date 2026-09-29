# Doc-backlog issue body

## Why this shape

Research on Jira ticket structure converges on four blocks: context with the
"why" (the most-skipped, most-useful part), explicit scope, a testable
acceptance-criteria checklist (3–7 yes/no items), and references. The classic
user-story form ("As a…, I want…") suits product features but reads contrived
for a docs task. Sources:
[Atlassian on acceptance criteria](https://www.atlassian.com/work-management/project-management/acceptance-criteria),
[AltexSoft on AC formats](https://www.altexsoft.com/blog/acceptance-criteria-purposes-formats-and-best-practices/),
[GitLab technical-writing workflow](https://handbook.gitlab.com/handbook/product/ux/technical-writing/workflow/).

## Template

Summary: feature-titled like the epic's siblings — no "Document…" prefix, no
ticket keys (those belong in the body).

```
Context

<Release> adds <the feature, one or two sentences quoting what the source
ticket claims — states, behaviors, audience> (<SOURCE-KEY>). <Why it matters:
who consumes it and what it replaces.>

What to document

- <The thing itself: name, arguments, where it runs — and when the source
  ticket doesn't name specifics, say "pull the specifics from the
  implementation" instead of inventing them>
- <Each behavior/state: what it means and what the reader does next>
- <Machine-facing surface: exit codes / output shapes, with an example>
- <Placement: which existing pages host or link to the new content>

Acceptance criteria

- <Testable yes/no item>
- <3–7 total; if more, split the ticket>
- Checked against shipped <release> behavior

References

- <SOURCE-KEY> — source story, fixVersion <release>
```

## Worked example

DOC-3755 (for KX-25474, under epic DOC-3698 "31.9.0") follows this template
verbatim — open it next to a new draft when in doubt.

## Hyperlinks

The markdown→ADF converter has no link support, and Jira Cloud does not
auto-link issue keys or URLs in REST-created text — so mentions like
`KX-25474` in a markdown body land dead. Pass the description as an ADF
document instead (`jira_create_issue` and `jira_update_issue` both accept one
in place of the string) with real link nodes where the mentions go.

Two node shapes, both verified to render:

An in-sentence hyperlink — a `text` node with a `link` mark:

```json
{
  "type": "text",
  "text": "KX-25474",
  "marks": [
    { "type": "link", "attrs": { "href": "https://kentico.atlassian.net/browse/KX-25474" } }
  ]
}
```

A smart-link chip (icon + summary + status, best in a References list) — an
`inlineCard` node:

```json
{ "type": "inlineCard", "attrs": { "url": "https://kentico.atlassian.net/browse/KX-25474" } }
```

The PUT replaces the whole description, so rebuild the full ADF doc
(`{"fields": {"description": {"type": "doc", "version": 1, "content": [...]}}}`
— paragraphs, `bulletList`/`listItem` wrappers, and the link nodes above where
the mentions go):

```bash
curl -s -o /dev/null -w "%{http_code}" -X PUT \
  -u "$JIRA_EMAIL_KENTICO_JIRA:$JIRA_PAT_KENTICO_JIRA" \
  -H "Content-Type: application/json" --data @description.json \
  "https://kentico.atlassian.net/rest/api/3/issue/<KEY>"
```

204 means updated. Verify the render without opening a browser: GET the issue
with `?expand=renderedFields&fields=description`. Both node shapes come back as
anchors, told apart by their attributes:

```html
<a href="…/browse/KX-25474">KX-25474</a>                          <!-- link mark -->
<a href="…/browse/KX-25474" title="smart-link" class="external-link"
   rel="nofollow noreferrer">https://…/browse/KX-25474</a>        <!-- inlineCard -->
```

So grep for `title="smart-link"` to confirm an `inlineCard`, and read the
anchor text to tell the two apart — a link mark shows the key, an `inlineCard`
shows the bare URL and becomes a chip in the Jira UI. `jira_get_issue` cannot
show any of this; its plain-text conversion drops marks entirely and swallows
`inlineCard` nodes whole, leaving a leading space where the chip sits.
