# Preflight

Run before reading the issue. Each check exists because skipping it costs a run late, after the
expensive work was done. Report the resolved result as a table, then continue.

## 1. Jira reachable — hard

```
mcp__{{JIRA_MCP_SERVER}}__jira_get_issue  issueKey: <KEY>
```

A result with `summary` and `issueType` is the gate. The MCP server is configured in
`.mcp.json` and needs `JIRA_EMAIL` and `JIRA_API_TOKEN` in the environment; if the tool is
absent or answers 401, stop — without the issue there is nothing to test.

The same server posts the comment (`jira_add_comment`) and searches for duplicates
(`jira_search_issues`). Confirm all three are in the tool list.

## 2. The repository — hard

```bash
git fetch origin {{DEFAULT_BRANCH}}
git status --porcelain
```

Record the `--porcelain` output verbatim as the baseline; the end-of-run comparison is
load-bearing. Untracked files already there are not yours to touch.

## 3. Dependencies and generated files — hard

Dependencies installed, and anything the app must generate before it can serve a request.

> **Adapt me:** {{ListGeneratedPrerequisites}} — the commands this app needs before it can
> start (for example a codegen or index-build script), and the error you see when they are
> missing.

## 4. Instance mode — hard

Decide now; it changes which evidence exists. Details in
[`local-instances.md`](local-instances.md).

| Mode | When | Gives |
|---|---|---|
| `dev` | Content, components, client behaviour | Server logs, hot reload, fastest |
| `build` | Status codes, headers, redirects, caching, production-only gates | The shipped behaviour |
| `url` (requester-supplied) | A preview or staging site someone else stands up | Reduced: no server logs |

```bash
curl -sf -o /dev/null {{LOCAL_URL}} && echo up
```

Up means the user's dev server is running — use it and do not start another. A connection
refusal means you may start one (`{{DEV_CMD}}`, in the background) and you own it.

## 5. Browser tooling — hard for any page surface

```bash
agent-browser --version
```

`agent-browser` is the driver (snapshots, `errors`, `console`, `network`, emulation,
isolated `--session`s). Load the `agent-browser` skill for the command surface rather than
working from memory. If it is missing, install it (`npm i -g agent-browser@latest`, then
`agent-browser install`).
<!-- @if profile:nextjs -->

For Next.js dev servers, `/_next/mcp` also answers what the framework knows — routes,
compilation issues, server errors, logs — and exists only while `next dev` runs. Load the
`next-dev-loop` skill before driving.
<!-- @endif -->

## 6. Evidence directory — soft

```bash
mkdir -p .cache/test-issue/<KEY>-<yyyymmdd>
```

`.cache/` must be git-ignored. Copy each screenshot you cite into this directory under the
caption you gave it, so the report's evidence survives the session.

## Custom fields

> **Adapt me.** If the {{JIRA_PROJECT}} project keeps test instructions, reproduction steps or
> reporter text in custom fields, list them here so Phase 1 requests them with `extraFields`
> — they are invisible otherwise.

| Field id | Holds |
|---|---|
| `{{CustomFieldId}}` | {{WhatItHolds}} |
