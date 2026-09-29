# Local instances — dev, build, and the "before" state

Everything a run verifies against runs on this machine.

> **Adapt me.** Fill in the port map and the dev/build split for this app. Both are
> measured facts — correct them the first time a run finds them wrong.

| Port / URL | Process | Who owns it |
|---|---|---|
| {{LOCAL_URL}} | the dev server (`{{DEV_CMD}}`) | The user. Use if up; never start a second one, never stop or restart it unasked |
| {{ProductionBuildPort}} | the production build's server | You, when you start it |
| {{SparePortForBeforeWorktree}} | a second dev server in a worktree | You, only with agreement |

## `dev` — the development server

Check {{LOCAL_URL}} first; if it answers, use it. Otherwise start `{{DEV_CMD}}` in the
background and poll until it answers. First compilation of a route can take seconds; a page
that stays blank was not given that time.

If the page disagrees with what the code plainly does, suspect a cached render or a stale
server, prove the unit in isolation (run its test alone), and ask before restarting.

## `build` — the production server

The repo's build and start commands, in the background; wait for the build's exit code.
Stop the server you started when the run ends.

## The dev/build split

| Surface | Dev server | Production build |
|---|---|---|
| Unknown path (document request) | {{DevBehaviour}} | {{BuildBehaviour}} |
| Caching headers | {{DevBehaviour}} | {{BuildBehaviour}} |
| Production-only gates | {{DevBehaviour}} | {{BuildBehaviour}} |
<!-- @if profile:nextjs -->

Typical for Next.js: `next dev` serves the not-found page with chrome at **HTTP 200** where
the build answers **404** with `no-store`; caching-header rules and `basePath`-dependent
behaviour are partly absent in dev; the prerendered static shell exists only in the build.
In dev, assert on rendered chrome and the "not found" title, not on the status.
<!-- @endif -->

## `url` — an instance someone else runs

A preview site or a staging slot, supplied by the requester. Read-only. Confirm what it is
before attributing anything to it (a health or version endpoint, if the app has one); compare
against the fix. You get `console`, `network requests`, `snapshot`, `screenshot` and `curl`;
you do not get server logs. Say in the report which layers were unavailable.

## The "before" state

A bug verdict needs the defect observed before the fix. Sources, cheapest first:

1. **The bugfix directory.** `{{AI_DIR}}/bugfixes/<NNN>-<slug>/` before captures are a dated,
   sourced measurement taken when the fix was written. Cite them; don't repeat them.
2. **Production**, when the fix has not deployed yet — observe only. Don't log in, submit
   forms or post anything there.
3. **A worktree at the pre-fix commit**, only when the requester agrees:

   ```bash
   git worktree add .claude/worktrees/before-<KEY> <fix-commit>~1
   ```

   then install dependencies there and start its dev server on the spare port in the
   background. Stop it and remove the worktree at the end. Two dev servers in two directories
   are fine; two in one directory usually are not.

Whichever source you use, the after-measurement must be the same route, the same action, the
same reading, so the pair means something.
