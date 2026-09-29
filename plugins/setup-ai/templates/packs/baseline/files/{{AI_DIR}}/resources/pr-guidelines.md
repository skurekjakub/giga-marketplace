# Pull request guidelines

> **Adapt me.** The `ado-pr-body` hook injects this file into context every
> time an agent creates or updates an Azure DevOps pull request. Keep it short:
> it is read on every call.

- **Title:** `<ISSUE-KEY> - <title>` when a tracker issue is associated;
  otherwise a plain imperative title.
- **Body:** bullets only; one sentence per bullet, one bullet per change.
- **Length:** 4000 characters is a hard limit (the Azure DevOps API rejects
  longer descriptions, and the hook blocks them first).
- **Headings** (`## `) only when there are two or more distinct concerns.
- **Verification:** end with one `## Verification` bullet naming the commands
  that ran and their result.
- **Out of scope:** findings this PR does not fix go in a work item, not the
  body.
