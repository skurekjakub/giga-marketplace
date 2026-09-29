# Preflight

Run before reading the issue. Each check exists because skipping it has cost a run late,
after the expensive work was done. Report the resolved result as a table, then continue.

## 1. Jira reachable — hard

```
mcp__jira-kentico__jira_get_issue  issueKey: <KEY>
```

A result with `summary` and `issueType` is the gate. The MCP server is configured in
`.mcp.json`; if the tool is absent, stop — there is no fallback that can read the custom
fields Phase 1 needs, and without the issue there is nothing to test.

The same MCP posts the comment (`jira_add_comment`) and searches for duplicates
(`jira_search_issues`). Confirm all three are in the tool list.

## 2. The repository — hard

This checkout is the repository under test; there is no separate clone to locate.

```bash
/usr/bin/git fetch origin main
/usr/bin/git status --porcelain
```

Record the `--porcelain` output verbatim as the baseline. Use `--porcelain`, not bare
`status`: the rtk filter can drop untracked entries from the short form, and the end-of-run
comparison is load-bearing. The checkout routinely carries other branches' untracked
analysis files; they are not yours to touch.

Inside a Claude worktree, `git` must be `/usr/bin/git` and one command per call — the
rtk-wrapped `git` is refused there.

## 3. Dependencies and generated indexes — hard

```bash
ls node_modules/.bin/next
npm run build:indexes
```

The generated content index is untracked. Without it the dev server dies on its first
request with `ENOENT … lib/corpus/index/generated/redirects-map.json`, which the rtk-filtered
output reports only as "Errors: 1". In a fresh worktree `node_modules` is absent too:
`cp -al <main checkout>/node_modules ./node_modules` (hard links — a symlink breaks
dependency-cruiser and escapes `.gitignore`).

## 4. Instance mode — hard

Decide now; it changes which evidence exists. Details and the dev/build split are in
[`local-instances.md`](local-instances.md).

| Mode | When | Gives |
|---|---|---|
| `dev` (3002) | Content, components, client behaviour | `/_next/mcp` (`get_errors`, `get_logs`), HMR, fastest |
| `build` (3004) | Status codes, headers, redirects, caching, PPR shell, `base_url`, admin gate | The shipped behaviour; browser `console` only |
| `url` (requester-supplied) | A preview or staging site someone else stands up | Reduced: no server logs, no framework errors |

```bash
curl -sf http://localhost:3002/api/health
```

A 200 means the user's dev server is up — use it and do not start another. A connection
refusal means you may start one (`npm run dev`, background) and you own it. Never run a
second `next dev` in the same checkout.

## 5. Browser tooling — hard for any page surface

```bash
agent-browser --version
curl -sS -X POST http://localhost:3002/_next/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | sed -n 's/^data: //p'
```

`agent-browser` is the driver (snapshots, React tree, `errors`, `console`, `network`,
emulation, recording, isolated `--session`s). `/_next/mcp` answers what the dev server
knows — routes, compilation issues, server errors, logs — and exists only while
`next dev` runs. Load the `next-dev-loop` skill before driving; run
`agent-browser skills get core` for the command surface, which matches the installed
version. The split is in
[`docs/conventions/browser-tooling.md`](../../../../docs/conventions/browser-tooling.md).

If `agent-browser` is missing or below 0.31.1, `npm i -g agent-browser@latest` and
`agent-browser install`.

## 6. Evidence directory — soft

```bash
mkdir -p .cache/test-issue/<KEY>-<yyyymmdd>
```

`/.cache/` is gitignored. `agent-browser` writes screenshots to
`~/.agent-browser/tmp/screenshots`; copy each one you cite into
this directory under the caption you gave it, so the report's evidence survives the
session. Do not put scratch files anywhere else in the tree.
