# Local instances — dev, build, and the "before" state

Everything a run verifies against runs on this machine. Ports come from
[`e2e/constants.ts`](../../../../e2e/constants.ts) and `AGENTS.md`:

| Port | Process | Who owns it |
|---|---|---|
| 3002 | `next dev` | The user. Use if up; never start a second one, never stop or restart it unasked |
| 3003 | Playwright's standalone server | `npm run test:e2e` — leave free |
| 3004 | `npm run start` (standalone build) | You, when you start it |
| 3010 | A second dev server in a worktree | You, only with agreement |

## `dev` — the development server

```bash
curl -sf http://localhost:3002/api/health
npm run dev
```

`npm run dev` starts the dev watcher, `next dev` on 3002 and the content-issues indexer
together; run it in the background and poll `/api/health` until it answers. First
compilation of a route takes seconds; a page that stays blank was not given that time.

What only `dev` gives you: `/_next/mcp` — `get_errors` (build and runtime errors, including
browser errors the server caught), `get_logs` (server stdout), `get_compilation_issues`,
`get_page_metadata`. What it lies about: everything in the split below.

**`restart-server` restarts the user's server.** HMR picks up nothing you changed, because a
verification run changes nothing — so there is no reason to call it. If the page disagrees
with what the code plainly does, suspect a cached render, prove the unit in isolation
(`npx vitest run <file>`), and ask before restarting.

## `build` — the standalone server

```bash
npm run build
npm run start
node scripts/free-port.mjs 3004
```

`build` takes minutes and a lot of memory; run it in the background and wait for the exit
code. `start` serves `.next/standalone/server.js` on 3004 (`next start` does not work with
this output). Leave `HOSTNAME` unset — a concrete address makes Next relay every proxy
rewrite over TCP and gated misses answer 500.

**A scratch MDX file under `content/` fails the build.** If `npm run build` dies on an
untracked page in `content/documentation`, that is someone's work in progress: park it
outside the tree for the build and put it back, never delete it, and say so.

## The dev/build split

Read before choosing the mode; the full list is in
[`.ai/regression/README.md`](../../../../.ai/regression/README.md) § Gotchas.

| Surface | `next dev` | Standalone build |
|---|---|---|
| Unknown path (document request) | Site 404 page **with HTTP 200** | **404**, `private, no-store`, `x-robots-tag: noindex` |
| `/md/...` miss, `.md` on a page with no projection | "Page not found" at 200 | 404 |
| `/admin` | Renders (dev-only editor) | Gated 404 |
| `base_url` virtual-directory prefix | Disabled | Honoured everywhere |
| `Cache-Control` rules, `?dpl=` versioning | Partly absent | As shipped — see `.ai/regression/cache-and-routing-smoke.md` |
| PPR static shell | Simulated via `?__nextppronly=1` under the static-shell debug switch | Real; `check:static-prerender` reads the `.meta` files |
| Theme toggle | Present | Tree-shaken |
| Soft-nav / prefetch into a miss | 200 | 200 (the 404 status applies to document requests only) |
| True redirects (`/x/` 308, `redirect_from` 308, collection-search 308, Azure host 301) | Same | Same — read with `curl -I` or `network` |

In `dev`, assert on rendered chrome and the "not found" title, not on the status.

## `url` — an instance someone else runs

A preview site or the staging slot, supplied by the requester. Read-only. Confirm what it
is before attributing anything to it: `/api/health` returns the `deploymentId` and process
start; compare against the fix. You get `console`, `network requests`, `snapshot`,
`screenshot` and `curl`; you do not get `/_next/mcp` at all. Say in the report which layers
were unavailable.

## The "before" state

A bug verdict needs the defect observed before the fix. Sources, cheapest first:

1. **The bugfix directory.** `.ai/bugfixes/<NNN>-<slug>/before.md` and `before.png` are a
   dated, sourced measurement taken when the fix was written. Cite them; do not repeat them.
2. **Production**, when the fix has not deployed yet. `docs.kentico.com` is read-only and free
   to observe in the same browser; append `.md` to a page URL for its exact source. Do not
   log in to anything, do not submit forms, do not post feedback there.
3. **A worktree at the pre-fix commit**, only when the requester agrees — it costs a second
   `node_modules` and a build of the indexes:

   ```bash
   /usr/bin/git worktree add .claude/worktrees/before-<KEY> <fix-commit>~1
   cp -al node_modules .claude/worktrees/before-<KEY>/node_modules
   ```

   then in that directory `npm run build:indexes` and
   `rtk proxy npx next dev --port 3010 --hostname localhost` in the background. Stop it with
   `node scripts/free-port.mjs 3010` and remove the worktree at the end. Two dev servers in
   two directories are fine; two in one directory are not.

Whichever source you use, the after-measurement must be the same route, the same action,
the same reading, so the pair means something.
