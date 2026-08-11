---
name: docs-write-hotfix-notes
description: >-
  Writes {{PRODUCT_NAME}} hotfix release notes (fixed issue entries for the changelog) from issue tracker tickets or bug descriptions. Use this skill whenever someone asks to write hotfix notes, changelog fixed issue entries, bug descriptions, or release notes for {{PRODUCT_NAME}} hotfixes. Also trigger when the user pastes an issue tracker ticket and asks for a hotfix description, fixed issue entry, or changelog entry.
---

> **Template skill — fill in before use.** Replace every `{{...}}` placeholder with your product's specifics (search for `{{` to find them all), replace the examples with real entries from your own changelog, then delete this block.
>
> | Placeholder | Meaning |
> |---|---|
> | `{{PRODUCT_NAME}}` | The product the hotfix notes describe |
> | `{{CHANGELOG_URL}}` | Where the public changelog is published |
> | `{{RELEASE_NOTES_PATH}}` | Where release note files live in your docs repo |
> | `{{CATEGORIES_FILE_PATH}}` | File containing the official list of changelog categories |
> | `{{RELEASE_SCAFFOLD_SKILL}}` | Your skill or doc describing release folder/naming conventions (drop that sentence if you have none) |

# Hotfix Release Notes Writer

You write "Fixed issues" entries for the {{PRODUCT_NAME}} changelog. These appear in the product changelog at {{CHANGELOG_URL}} and describe bugs that were resolved in a hotfix.

## Output — inline text only

Deliver the entry as **inline text in your reply**, and nothing else. Do not create, edit, or stage any file — in particular nothing under `{{RELEASE_NOTES_PATH}}`, and no scratch draft file either. The user reviews and reworks the wording before it goes anywhere.

Writing the entry into a release folder is a separate, explicitly requested step: "add it to the release", "generate the composite page", "put it in the `<date>` folder". Only then produce a file, and use the `{{RELEASE_SCAFFOLD_SKILL}}` skill for the folder and naming conventions rather than inventing a path. Until the user asks, assume they only want the text.

## Before You Start — Verify Input

You need sufficient context to write an accurate hotfix note. Before generating anything, check that the user has provided **at least one** of:

- A pasted issue tracker ticket (with description, bug tracker fields, etc.)
- A bug report or incident description with enough detail to understand the symptom
- A PR or commit diff with a clear bug description

If the input is too vague, ambiguous, or missing critical details (what broke, when, what component), **use the `ask_user` tool** to request the missing information. Specifically ask for:

- The full ticket content (paste it) or a link to the issue
- What component/feature was affected
- What the user experienced (the symptom)
- Which version introduced the problem

Do not guess or fabricate details. A wrong hotfix note is worse than no hotfix note.

## The Format

Each entry is a single inline block — category, separator, description — all in one flow:

```
Category -- Description in past tense. Additional context if needed. Mention when the issue started if a specific version introduced it.
```

Generic examples of the format (replace with real entries from your own changelog):

```
Admin UI -- Opening any page of the administration interface generated an information message in the browser console, with links related to a third-party dependency. This message could be classified as advertising by browsers and security tools. The issue occurred after updating to version 3.2.0 or newer.
```

```
Forms -- Submitting a form with a file upload field exceeding the configured size limit displayed a generic error page instead of a validation message next to the field.
```

```
File storage -- In multi-instance environments using cloud object storage, concurrent file access could result in I/O exception errors.
```

```
Content API -- After updating to version 3.3.0, retrieving items with a linking depth that fully traverses a cyclical relationship between types caused an out-of-memory error.
```

```
Email -- Sending emails containing multiple components that load content from the database could result in database connection errors, which prevented the email from being sent in certain cases.
```

## How to Write One

### 1. Extract from the ticket

Look for these fields (the user will typically paste a full issue tracker ticket — adapt the field names to your tracker):

| Ticket Field | Use |
|---|---|
| **Bug tracker category** | Becomes the category prefix (must match the official categories list) |
| **Description** | Full technical context — read for understanding |
| **Found in version** | The version that introduced the bug |
| **Fix versions** | The version shipping the fix |

### 2. Pick the right category

The category **must** come from the official categories list. Read the full list from `{{CATEGORIES_FILE_PATH}}` — relative to the **repository root**, not to this skill folder. Common examples:

Admin UI, API, Content items, Email, Forms, Pages, Performance, Search, Security, Workflow

If the ticket has a category field, use it directly (it should already match). If not, choose the most specific matching category from the list.

### 3. Write the description

- **Past tense** throughout ("occurred", "failed", "wasn't displayed", "caused", "could result in")
- **Symptom first**: what the user saw or experienced
- **Condition**: when or under what circumstances it happened
- **Version reference**: if the bug was introduced by a specific update, mention it ("The issue occurred after updating to version X.Y.Z or newer")
- **Length**: 1-3 sentences. One sentence for simple bugs, up to three for complex ones that need context
- Error messages and exception types users might encounter are OK to include (e.g., `OutOfMemoryException`, `TaskCanceledException`)
- UI element names should be in *italics* (e.g., *Export submissions*)
- Feature names and applications in *italics* on first mention (e.g., *Form Builder*, *Content hub*)

### What to Leave Out

- No root cause implementation details (no "because the query didn't have a cycle guard")
- No fix description (don't explain what was changed)
- No internal code references unless they're part of the public API (public API class names are fine; internal class names are not)
- No workarounds

### Separator

Always use ` -- ` (space, double hyphen, space) between category and description. Not an em dash (–), not a single hyphen (-).

### Tone

- Neutral and precise
- Multi-sentence descriptions with specific scenarios are fine when the bug needs context
- Professional but not stiff
