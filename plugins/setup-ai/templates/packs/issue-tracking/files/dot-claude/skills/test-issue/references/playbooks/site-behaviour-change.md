# Playbook — a UI behaviour change

For a fix in a component, page, layout or client-side module: chrome, search UI, navigation,
dialogs, a widget's rendering or state. The consumer is a user in a browser, on a fresh load
and after client navigation.

## Map the surfaces

```bash
grep -rl "<ComponentName>" <source roots>
```

Read the importers one level up until you reach a route. Every route found is a surface; pick
one per distinct render path (a page with the optional data and one without; the home page
and a deep page) rather than every page.

The `{{AI_DIR}}/regression/` suites list the boxes for these surfaces. Tick the ones the
change touches; add a box if none covers the behaviour and the fix went in without one.

## The three navigations

For every surface, in this order, with `errors` + `console` after each:

1. `open <url>` — fresh document. Screenshot.
2. From a page a user would come from: `open <origin>`, then `pushstate <target>` — client
   routers reuse mounted components; props read once at mount go stale here, and so do
   search boxes and widget state.
3. `back` — cached pages return; libraries with deferred teardown break here. Then
   `pushstate` forward again.

A behaviour is verified when all three agree with the plan.

## What to read

- Hydration: `errors` for hydration mismatches, and `agent-browser vitals <url>` when the
  ticket is about layout shift or load cost.
- State: `eval` on `data-*` / `aria-*` attributes, local storage keys, `document.title`.
  Never on class names.
- Layout: `screenshot` at the default viewport and at `viewport 375 812`.
- Theme and motion: `agent-browser set media dark` / `reduced-motion` in a separate session
  when the change touches colour or animation.
- Focus: after a submit or a dialog close, `eval 'document.activeElement?.outerHTML'`.

## Supporting

- The unit test that pins the fix, run alone. The mutation check (does it go red without the
  fix?) only if the requester asks — it means editing the tree, in a worktree.
- The e2e spec's assertions, read. A spec name that matches the ticket still needs its
  assertions read before it is cited.
- `docs/gotchas.md` — before diagnosing an "unexpected" behaviour as a defect, check whether
  it is a recorded framework trap.

## Traps

> **Adapt me.** App-specific traps a run keeps rediscovering: features gated to some pages
> or tenants, routes with a different render path, widgets that reset state by design.

- {{AppSpecificTrap}}
