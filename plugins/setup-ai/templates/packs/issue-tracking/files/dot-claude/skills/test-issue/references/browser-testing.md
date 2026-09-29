# Driving the site in a browser

Read before Phase 6a. `agent-browser` is the driver; `/_next/mcp` answers the questions
about what the framework did. Load the `next-dev-loop` skill for the command surface
rather than working from memory — it moves.

```bash
agent-browser open --enable react-devtools http://localhost:3002/<route>
```

## Non-negotiables

1. **Look at the result.** `screenshot <path>` and open the file. A snapshot shows
   roles and names; it does not show a lightbox that covers the scrollbar, a header that
   jumped ten pixels, an icon that rendered as an empty box.
2. **Check the console after every step, not once at the end.** `errors` and `console`
   — messages are lost on navigation. Take a baseline before the first action; whatever
   was already there is not your finding. On a dev instance, `/_next/mcp`'s `get_errors`
   adds the server's own account, including browser errors it caught.
3. **Both navigation modes.** `open <url>` is a fresh document. `pushstate <path>` is what
   a reader's click does, and the segment cache reuses mounted components on it. Then
   `back`. A client-rendered surface is verified only when all three agree.
4. **Wait for React to settle.** Chrome hydrates after first paint: the page tree, the
   header search, redirects, progression state. `wait --load networkidle` or
   `wait --text` rather than reading straight after `open`, or the check races hydration
   and lies.
5. **Assert data attributes and roles, not classes.** `data-*`, `aria-*`, `localStorage`,
   DOM structure; classes drift. The admin surface ships no testids — use role and text.
6. **Attribute behaviour from the exchange, never by inference.** `network requests` lists
   every request since the last navigation with status and type; `network har start/stop`
   captures headers and bodies. Whether the server or the client produced a value is
   decided there.
7. **Record every anomaly** — an untranslated key, a layout jump, a slow step — as
   "noticed, not investigated". Do not drop it.

## Mechanics

- **Refs go stale after any navigation.** Re-run `snapshot -i`; never reuse `@eN` across
  steps.
- `click` on a Next `<Link>` waits for navigation and can exceed the timeout. If it hangs,
  cancel and `open` the href instead — but note that you then lost the soft-navigation case
  and cover it with `pushstate`.
- `eval` is synchronous in page context; wrap async work in an IIFE. Multi-line scripts go
  through `--file`.
- The Next error overlay lives in shadow DOM:
  `eval 'document.querySelector("nextjs-portal")?.shadowRoot?.querySelector("[data-nextjs-dialog]")?.textContent'`.
- The prerendered shell is a response, not a browser mode: `curl <url>`, or
  `?__nextppronly=1` under `__NEXT_EXPERIMENTAL_STATIC_SHELL_DEBUGGING=1`
  (`docs/conventions/static-prerender-debugging.md`).
- `offsetParent` is unreliable for visibility here (transformed and fixed containers
  report `null` while visible). Use presence, `getComputedStyle().display`, or
  `getBoundingClientRect()`.
- Some routes render content in `<article>` with no `<main>` (`/changelog`); do not key
  visibility checks on `main` alone.
- `viewport <w> <h>` sets the size and it sticks across navigations; `window.resizeTo` is a
  no-op.
- `img.complete` / `naturalWidth` is a false negative for lazy-loaded images. Assert the
  HTTP status from `network` instead.

## Component shapes worth knowing

From [`.ai/regression/README.md`](../../../../.ai/regression/README.md):

- **Tabbed** = hidden radio + `<label>` + panel (`[data-tabbed]`) — click the label.
  **Collapsible** = native `<details data-collapsible>`. The MDX catalogue is fastest to
  exercise at `/samples/syntax/<component>`, one page per component.
- Right-sidebar TOC and Related pages render only on pages with in-page headings.
- The theme toggle adds `theme-dark` to `<html>` (not `dark`), persisted as
  `localStorage.kenticoDocumentationTheme`, dev-only.
- Search facets are `react-instantsearch` widgets; a synthetic `.click()` or `value=` set
  does nothing. `agent-browser click` sends real pointer events; `agent-browser find first
  "[data-testid='header-search-box'] input" fill …` targets the input, not its wrapper.
- dnd-kit reorder needs a real pointer drag; `eval` cannot do it. Verify the non-drag
  siblings and flag the drag as manual.
- Learn-portal progression is `localStorage.kenticoLearnPortalStore` (schema v2, UPPERCASE
  states); cards show status as visible text.

## When to switch to agent-browser

| Need | Command |
|---|---|
| Dark / light / reduced motion | `set media dark` — flips the media query so the app's own pre-paint resolution runs |
| Device or viewport emulation with a real profile | `set device <name>`, `set viewport <w> <h>` |
| Accessibility audit | `a11y --tags wcag2a,wcag2aa` (axe-core) |
| A second isolated browser (a "before" site next to an "after") | `--session <name>` |
| Recording, visual diff | `record start <abs path>`, `diff screenshot --baseline` |

Relative output paths resolve against the daemon's cwd — pass absolute paths.
`agent-browser --session <name> wait --load networkidle` is the settle primitive there.

## Stopping

`agent-browser --session <name> close` for each session. A browser
left open holds the dev server's HMR socket and the next run's baseline is polluted.
