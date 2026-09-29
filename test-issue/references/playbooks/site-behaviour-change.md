# Playbook — a site behaviour change

For a fix under `components/`, `app/`, `lib/` (outside the proxy), or an MDX tag's
implementation: chrome, search UI, page tree, lightbox, reading mode, learn-portal
progression, a tag's rendering. The consumer is a reader in a browser, on a fresh load and
after client navigation.

## Map the surfaces

```bash
rg -l "<ComponentName>" app components
```

Read the importers one level up until you reach a route. Every route found is a surface;
pick one per distinct render path (a legacy collection page and an XbyK one; a page with
headings and one without; the homepage and a content page) rather than every page.

`.ai/regression/navigation-and-chrome.md`, `content-rendering.md`, `search-and-ai.md` and
`learn-portal-progression.md` list the boxes for these surfaces. Tick the ones the change
touches; add a box if none covers the behaviour and the fix went in without one.

## The three navigations

For every surface, in this order, with `errors` + `console` after each:

1. `open <url>` — fresh document. Screenshot.
2. From a page a reader would come from: `open <origin>`, then `pushstate <target>` — the
   segment cache reuses mounted client components; `initial*` props are read once at
   mount, `usePathname` updates, widget state may not. This is where same-route submits,
   stale search boxes and parked-then-returned widgets break.
3. `back` — the parked segment returns from the Activity boundary; libraries with deferred
   teardown die here (react-instantsearch renders `null` permanently). Then `pushstate`
   forward again.

A behaviour is verified when all three agree with the plan.

## What to read

- Hydration: `errors` for React #418/#423, the overlay text through the shadow-DOM `eval`,
  and `agent-browser vitals <url>` when the ticket is about layout shift or hydration cost.
- State: `eval` on `data-*` / `aria-*` attributes, `localStorage` keys, `document.title`.
  Never on class names.
- Layout: `screenshot` at the default viewport and at `viewport 375 812`; the header,
  sidebar and reading-mode toggles change shape below `lg`.
- Theme and motion: `agent-browser set media dark` / `reduced-motion` in a separate
  session when the change touches colour or animation.
- Focus: after a submit or a dialog close, `eval 'document.activeElement?.outerHTML'`.

## Supporting

- The unit test that pins the fix, run alone: `npx vitest run <file>`. Then, once, the
  mutation check: does it go red without the fix? Only if the requester asks — it means
  editing the tree, in a worktree.
- The e2e spec's assertions, read. `e2e/` specs run against fixture collections (`/test`,
  `/test-unsupported`, `/test-k13` — mounted only under `NEXT_PUBLIC_E2E=1`), so a spec name that matches the
  ticket still needs its assertions read before it is cited.
- `docs/gotchas.md` — before diagnosing an "unexpected" behaviour as a defect, check
  whether it is a recorded framework trap.

## Traps

- **The `/` shortcut, the header search and DocsBot are collection-gated.** DocsBot mounts
  on `docsbot: true` collections and `/`; the Ask-AI row is XbyK-family only; the header
  search hides on `/search`, `/<collection>/search`, legacy homepages and
  `headerSearch: false` collections. Absence on the wrong page is a finding; absence on
  those is the rule.
- **Prerendered vs fallback collections differ in the shell.** XbyK and K13 routes are in
  the static set; k8–k12sp are not, so their chrome that reads `usePathname` shows a
  skeleton until hydration. A skeleton-then-nothing on `/k12sp/...` is the recorded class,
  not a regression, unless the ticket is about it.
- **Keyed remounts drop widget state.** Search UIs remount on segment return and on a
  server-seeded query change; facet refinements reset by design.
