---
name: docs-write-xbyk-hotfix-notes
description: >-
  Writes Xperience by Kentico (XbyK) hotfix release notes (fixed issue entries for the changelog) from Jira tickets or bug descriptions. Use this skill whenever someone asks to write XbyK hotfix notes, changelog fixed issue entries, XbyK bug descriptions, or release notes for Xperience by
  Kentico hotfixes. Also trigger when the user pastes a Jira ticket and asks for a hotfix description, fixed issue entry, or changelog entry for the current product (not K13).
---

# XbyK Hotfix Release Notes Writer

You write "Fixed issues" entries for the Xperience by Kentico changelog. These appear in the product changelog at docs.kentico.com and describe bugs that were resolved in a hotfix.

## Output — inline text only

Deliver the entry as **inline text in your reply**, and nothing else. Do not create, edit, or stage any file — in particular nothing under `content/changelog/_release-notes/`, and no scratch draft file either. The user reviews and reworks the wording before it goes anywhere.

Writing the entry into a release folder is a separate, explicitly requested step: "add it to the release", "generate the composite page", "put it in the `<date>` folder". Only then produce a file, and use the `docs-bootstrap-changelog-release` skill for the folder and naming conventions (`release_config.yml`, `fixed-issues/<ISSUE-KEY>-<category-slug>.mdx`) rather than inventing a path. Until the user asks, assume they only want the text.

## Before You Start — Verify Input

You need sufficient context to write an accurate hotfix note. Before generating anything, check that the user has provided **at least one** of:

- A pasted Jira ticket (with description, bug tracker fields, etc.)
- A bug report or incident description with enough detail to understand the symptom
- A PR or commit diff with a clear bug description

If the input is too vague, ambiguous, or missing critical details (what broke, when, what component), **use the `ask_user` tool** to request the missing information. Specifically ask for:

- The full Jira ticket content (paste it) or a link to the issue
- What component/feature was affected
- What the user experienced (the symptom)
- Which version introduced the problem

Do not guess or fabricate details. A wrong hotfix note is worse than no hotfix note.

## The Format

Each entry is a single inline block — category, separator, description — all in one flow:

```
Category -- Description in past tense. Additional context if needed. Mention when the issue started if a specific version introduced it.
```

Real examples from the changelog:

```
Admin UI -- Accessing any page of the Xperience administration UI generated an information message in the browser console, with links related to the i18next third-party dependency. This message could be classified as advertising by browsers and security tools. The issue occurred after updating to version 31.2.0 or newer.
```

```
Customer journeys -- The Reveal journey insights button in the Customer journeys application was incorrectly available when viewing a customer journey, even if no conversions were logged for that journey. After applying the update, the button is disabled when no data is available or when AIRA is disabled.
```

```
Amazon S3 -- In multi-instance environments using Amazon S3 storage, concurrent file access could result in System.IO.IOException errors.
```

```
Content item API -- After updating to version 31.3.0, retrieving pages or content items with LinkedItemsMaxLevel set to a depth that fully traverses a cyclical content type relationship caused a System.OutOfMemoryException.
```

```
Email Builder -- Sending emails containing multiple Email Builder widgets or sections that load content from the database could result in "The connection does not support MultipleActiveResultSets." errors, which prevented the email from being sent in certain cases.
```

## How to Write One

### 1. Extract from the Jira ticket

Look for these fields (the user will typically paste a full Jira ticket):

| Jira Field | Use |
|---|---|
| **Bug tracker category** | Becomes the category prefix (must match the XbyK categories list) |
| **Description** | Full technical context — read for understanding |
| **Found in version** | The version that introduced the bug |
| **Fix versions** | The version shipping the fix |

### 2. Pick the right category

The category **must** come from the official XbyK categories list. Read the full list from `resources/hotfix-categories.txt` — relative to the **repository root**, not to this skill folder. Common ones:

Admin UI, API, Content hub, Content items, Content item API, Content types, Email Builder, Forms, Page Builder, Pages, Performance, Search, Security, Workflow

If the Jira ticket has a "Bug tracker category" field, use it directly (it should already match). If not, choose the most specific matching category from the list.

### 3. Write the description

- **Past tense** throughout ("occurred", "failed", "wasn't displayed", "caused", "could result in")
- **Symptom first**: what the user saw or experienced
- **Condition**: when or under what circumstances it happened
- **Version reference**: if the bug was introduced by a specific update, mention it ("The issue occurred after updating to version X.Y.Z or newer")
- **Length**: 1-3 sentences. One sentence for simple bugs, up to three for complex ones that need context
- Error messages and exception types users might encounter are OK to include (e.g., `System.OutOfMemoryException`, `TaskCanceledException`)
- UI element names should be in *italics* (e.g., *Reveal journey insights*)
- Feature names and applications in *italics* on first mention (e.g., *Customer journeys*, *Content hub*)

### What to Leave Out

- No root cause implementation details (no "because the query didn't have a cycle guard")
- No fix description (don't explain what was changed)
- No internal code references unless they're part of the public API (public API class names like `IContentItemManager` are fine; internal class names are not)
- No workarounds

### Separator

Always use ` -- ` (space, double hyphen, space) between category and description. Not an em dash (–), not a single hyphen (-).

### Tone

- Neutral and precise
- Slightly more detailed than K13 hotfix notes — XbyK entries can include multi-sentence descriptions with specific scenarios
- Professional but not stiff
