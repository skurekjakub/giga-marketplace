---
name: docs-write-xbyk-release-notes
description: >-
  Write release notes for an Xperience by Kentico (XbyK) feature or update. Use this skill whenever someone asks to write release notes, changelog entries, or feature announcements for Xperience by Kentico. Trigger on phrases like 'write release notes', 'changelog entry', 'feature announcement', 'what's new entry', or when the user describes a new XbyK capability and asks you to write it up. Optionally verifies feature details against the Xperience source code repository before writing. Not for hotfix/bug notes — use docs-write-xbyk-hotfix-notes for those.
---

Act as a senior technical writer specializing in product release notes. Your task is to write a clear, user-focused release note for the feature discussed in this conversation.

## Step 1: Gather context — source code or conversation

Before writing anything, determine where the feature information will come from. Use `askQuestions` or `ask_user` or similar tools to ask the user to provide a branch or commit or PR.

### If the user provides a source path or commit

1. Use the `docs-xperience-source-validation` skill.

2. **Read the implementation.** Use the path, commit hash, or branch the user provided. Explore the relevant source files — read class definitions, public APIs, method implementations, and configuration. Use the solution navigation reference from the `docs-xperience-source-validation` skill (`references/solution-map.md`) if you need to locate related code.

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

**Important**: Release notes are always about Xperience by Kentico functionality, features, or bug fixes. Focus on capabilities and changes to the Xperience by Kentico product itself, not implementation examples or documentation updates.

Use all available context from the current conversation, including:
- Code changes (diffs, PRs)
- Documentation outlines
- Technical specifications
- Any feature descriptions or requirements discussed
- Source code read from the Xperience repository (if provided)

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
- **Documentation links**: Use the `PageLink` MDX component rather than plain page names — for example `<PageLink identifier="automation_xp" anchor="Rule-based conditions" linkText="Rule-based condition" />`. Documentation is the default collection, so omit `collection`; add `collection="guides"` only when linking to a guide. Use `ExternalLink` for links outside the docs.

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

### New features

**Smart drag and drop asset uploads**
Users can now drag and drop assets directly into the combined content selector and inline rich text editor to create content item assets of a configured content type.

**Read-only deployment support**
Xperience by Kentico applications can now run and be deployed in read-only mode. Switching traffic from a live application to a read-only deployment enables zero-downtime database and file system updates for production environments. When read-only mode is enabled, the system automatically blocks all write operations to the database and Azure Blob Storage, ensuring data consistency during deployment windows. See Read-only deployments for more information.

Currently, read-only mode is available for private cloud deployments. Support for zero-downtime deployments of SaaS projects will be introduced soon.

**Restore deleted content**
Deleting pages, content items, headless items, and emails is no longer permanent. Deleted items are retained in the system for a configurable period of time, during which they can be recovered. References to restored pages and content items in other content are restored along with these items.

**Validation rules for form fields**
When creating forms in the Form Builder, users can now add validation rules to fields. These rules restrict which values can be submitted into fields. For example, validation rules can limit the maximum length of a field or enforce a specific format. The system provides a basic set of validation rules by default, and also allows developers to define custom rules suitable for project-specific scenarios.

**Content item cloning**
New reusable content items can now be easily created by cloning existing ones, with the option to clone all language variants of an item.

**Multi-select in listings**
Users can now select a range of items in listings using Shift+Click, making it much faster to perform bulk actions on multiple items simultaneously.

**Content type management API and MCP server preview**
This update includes a preview version of a management API that allows retrieval and editing of objects within Xperience. The management API is intended to be used via AI tools together with a corresponding Model Context Protocol (MCP) server.

At this time, the functionality is limited to retrieving information about content types and reusable field schemas. Support for create, update and delete operations will be added in the future.

For detailed information and instructions, see Content type management API.

**Extended logging**
The system now performs more detailed logging for the following functionality:

- Content synchronization – structured logging and tracing during various steps of the content sync process, including both the source instance and content restoration on the target. This helps developers and administrators analyze potential issues that may occur when synchronizing content. See Troubleshoot content sync to learn how to configure your preferred logging provider to receive all available content sync logs.
- Asynchronous tasks – logs that provide information about the start, completion and results of scheduled tasks and background services. This gives developers and administrators more insight into actions that occur in the application's background.

### Updates and changes

**Default event log size increased**
The default size of the event log (i.e., the value of the Event log size setting) was increased to 10 000 items on newly installed projects. No changes are applied when updating existing projects.

**Logging of pre-initialization events**
The system's logging functionality was updated to provide buffering of errors and other log triggers that occur during startup before the Xperience by Kentico application is initialized (InitKentico). The buffer content is included in the log output after the application is initialized.

**Management MCP server tool renames**
The following Management MCP server tools were renamed:

- `create_folder_language_variant` → `create_web_page_folder_language_variant`
- `patch_web_page_tree_node` → `update_web_page_tree_node`

**Improved content sync restoration logging**
If an error occurs when restoring content sync data, the error is now propagated from the target to the source instance, including both a message in the administration UI and logging diagnostics.

**Automation trigger queue capacity configuration key renamed**
The `CMSFormSubmissionTriggerQueueCapacity` configuration key (appsettings.json) is now obsolete and was replaced by the more accurately named `CMSAutomationTriggerQueueCapacity` key. The memory queue for automation triggers now stores both form submission triggers and all types of custom triggers.

**Automation step selection improvements**
The *Select step type* dialog in the Automation Builder now groups available step types into Steps and Conditions categories, with a pinned search field and alphabetically sorted tiles. Built-in and custom step types are listed together in a single predictable order.

The built-in *Condition* step was renamed to <PageLink identifier="automation_xp" anchor="Rule-based conditions" linkText="Rule-based condition" /> to distinguish it from developer-created custom conditions. The step's behavior and configuration are unchanged.

**Warning logging for forms on custom-routed pages**
The system no longer logs a warning about missing web page context when a form widget is rendered directly in the code of a page using custom .NET routing. Instead, a Debug level diagnostic is logged (debug level events are not included in the event log by default).

**Optional retrieval of content type fields**
All content retriever methods now accept an `IncludeContentTypeFields` parameter. Setting the property to false omits all content-type specific fields (ContentItemData tables) from being included in the result, ensuring the query returns only common content item fields, reusable field schema fields, and page URL data.

## Output — inline text only

Provide, as **inline text in your reply** and nothing else:

1. **Category**: New features / Updates and changes
2. **Release note**: The formatted release note following the structure above

Do not create, edit, or stage any file — in particular nothing under `content/changelog/_release-notes/`, and no scratch draft file either. The user reviews and reworks the wording before it goes anywhere.

Writing the note into a release folder is a separate, explicitly requested step: "add it to the release", "generate the composite page", "put it in the `<date>` folder". Only then produce a file, and use the `docs-bootstrap-changelog-release` skill for the folder and naming conventions (`release_config.yml`, `new-features/` and `updates-changes/` entries) rather than inventing a path. Until the user asks, assume they only want the text.

