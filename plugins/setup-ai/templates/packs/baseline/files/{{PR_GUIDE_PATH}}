# Pull request guidelines

> **Adapt me.** Agents follow this file whenever they open or update a pull
> request. Keep it short.
<!-- @if option:hooks=ado-pr-body -->
> The `ado-pr-body` hook also injects it on every Azure DevOps PR create/update
> call and blocks bodies over the API's limit.
<!-- @endif -->

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
