---
name: docs-write-release-notes
description: >-
  Write release notes for a {{PRODUCT_NAME}} feature or update. Use this skill whenever someone asks to write release notes, changelog entries, or feature announcements for {{PRODUCT_NAME}}. Trigger on phrases like 'write release notes', 'changelog entry', 'feature announcement', 'what's new entry', or when the user describes a new product capability and asks you to write it up. Not for hotfix/bug notes — use docs-write-hotfix-notes for those.
---

> **Template skill — fill in before use.** Replace every `{{...}}` placeholder with your product's specifics (search for `{{` to find them all), replace the examples with real entries from your own changelog, then delete this block.
>
> | Placeholder | Meaning |
> |---|---|
> | `{{PRODUCT_NAME}}` | The product the release notes describe |
> | `{{DOCS_LINK_SYNTAX}}` | How documentation links are written on your docs platform |
> | `{{RELEASE_NOTES_PATH}}` | Where release note files live in your docs repo |

Act as a senior technical writer specializing in product release notes. Your task is to write a clear, user-focused release note for the feature discussed in this conversation.

## Step 1: Gather context — source code or conversation

Before writing anything, determine where the feature information will come from. Use `askQuestions` or `ask_user` or similar tools to ask the user to provide a branch or commit or PR.

### If the user provides a source path or commit

<!-- @if option:writingSkills=docs-source-validation -->
1. Use the `docs-source-validation` skill.
<!-- @endif -->

2. **Read the implementation.** Use the path, commit hash, or branch the user provided. Explore the relevant source files — read class definitions, public APIs, method implementations, and configuration.
<!-- @if option:writingSkills=docs-source-validation -->
   Use the source navigation reference from the `docs-source-validation` skill (`references/solution-map.md`) if you need to locate related code.
<!-- @endif -->

3. **Extract the user-facing behavior.** From the source code, identify:
   - What capability is being added or changed
   - How it works from the user's perspective (not internal implementation details)
   - Any limitations, conditions, or configuration involved
   - Related features that are affected

4. **Confirm your understanding with the user** before writing — briefly summarize what you found and ask if anything is missing or if they want to emphasize a particular angle. The source code tells you *what* the feature does; the user tells you *how to frame it* for the audience.

### If the user declines source verification

Assess how much context is already available in the conversation (diffs, PRs, specs, descriptions). If the detail is thin, ask the user for more information — specifically:
- What can users do now that they couldn't before?
- How does the feature work at a high level?
- Are there any limitations or prerequisites?
- Is there related documentation to link to?

If the conversation already has rich context (code changes, specs, detailed descriptions), proceed directly to writing.

## Context

**Important**: Release notes are always about {{PRODUCT_NAME}} functionality, features, or bug fixes. Focus on capabilities and changes to the product itself, not implementation examples or documentation updates.

Use all available context from the current conversation, including:
- Code changes (diffs, PRs)
- Documentation outlines
- Technical specifications
- Any feature descriptions or requirements discussed
- Source code read from the product repository (if provided)

## Release Note Structure

Write the release note following this structure:

### Title
- Use a concise, descriptive title (3-7 words)
- Focus on the user benefit or capability
- Use sentence case

### Body
- **First paragraph**: Describe what users can now do (the capability)
- **Additional paragraphs** (if needed): Explain how it works, any limitations, or important details
- **Final sentence** (if applicable): Link to documentation with "See [Page name] for more information."
- **Documentation links**: Use your docs platform's link syntax rather than plain page names — {{DOCS_LINK_SYNTAX}}.

## Writing Guidelines

1. **User-focused**: Write from the user's perspective, emphasizing what they can accomplish
2. **Active voice**: Use present tense and active voice ("Users can now..." not "It has been made possible...")
3. **Concise**: Keep sentences under 20 words when possible
4. **Specific**: Include concrete details about functionality
5. **No jargon**: Avoid internal terminology; use terms users understand
6. **No version numbers**: Don't reference specific version numbers in the body

## Categorization

Determine if the release note belongs under:
- **New features** - Entirely new capabilities
- **Updates and changes** - Improvements to existing functionality

## Examples

> **Template note:** Replace these generic examples with real entries from your own changelog — the examples are what anchor the voice and level of detail. Keep at least one simple entry, one multi-paragraph entry with limitations, and one entry ending in a documentation link.

### New features

**Scheduled content publishing**
Editors can now schedule content to be published automatically at a specific date and time. Scheduled items are listed in a dedicated view where the schedule can be changed or canceled before publishing occurs.

**Two-factor authentication for the administration interface**
Administrators can now require two-factor authentication for all users signing in to the administration interface. The system supports authenticator apps out of the box, and developers can register custom verification methods. See Two-factor authentication for more information.

Currently, two-factor authentication is available for local accounts only. Support for external identity providers will be introduced in a future update.

**Bulk export of form submissions**
Form submissions can now be exported to a CSV file directly from the submission listing. The export respects the currently applied filters, making it easy to extract a specific subset of submissions for further processing.

### Updates and changes

**Default log retention increased**
The default retention period for the application event log was increased to 30 days on newly installed projects. No changes are applied when updating existing projects.

**Session timeout configuration key renamed**
The `LegacySessionTimeout` configuration key is now obsolete and was replaced by the more accurately named `SessionIdleTimeout` key. The new key applies to both the administration interface and the live site.

**Improved error reporting for failed imports**
If an error occurs during a content import, the error details are now surfaced directly in the import dialog, including the affected item and the reason the import failed, in addition to being written to the event log.

## Output — inline text only

Provide, as **inline text in your reply** and nothing else:

1. **Category**: New features / Updates and changes
2. **Release note**: The formatted release note following the structure above

Do not create, edit, or stage any file — in particular nothing under `{{RELEASE_NOTES_PATH}}`, and no scratch draft file either. The user reviews and reworks the wording before it goes anywhere.

Writing the note into a release folder is a separate, explicitly requested step: "add it to the release", "generate the composite page", "put it in the `<date>` folder". Only then produce a file, following your repo's release folder and naming conventions rather than inventing a path. Until the user asks, assume they only want the text.
