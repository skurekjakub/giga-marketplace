# Driving the app in a browser

Read before Phase 6a. `agent-browser` is the driver; load the `agent-browser` skill for the
command surface rather than working from memory — it moves.

```bash
agent-browser open {{LOCAL_URL}}/<route>
```

## Non-negotiables

1. **Look at the result.** `screenshot <path>` and open the file. A snapshot shows roles and
   names; it does not show an overlay covering the scrollbar, a header that jumped ten
   pixels, an icon that rendered as an empty box.
2. **Check the console after every step, not once at the end.** `errors` and `console` —
   messages are lost on navigation. Take a baseline before the first action; whatever was
   already there is not your finding.
3. **Both navigation modes.** `open <url>` is a fresh document. `pushstate <path>` is what a
   user's click does in a client-routed app. Then `back`. A client-rendered surface is
   verified only when all three agree.
4. **Wait for the app to settle.** Client-rendered UI hydrates after first paint. Use
   `wait --text` or a readiness attribute rather than reading straight after `open`, or the
   check races hydration and lies.
5. **Assert data attributes and roles, not classes.** `data-*`, `aria-*`, local storage, DOM
   structure; classes drift.
6. **Attribute behaviour from the exchange, never by inference.** `network requests` lists
   every request since the last navigation with status and type; `network har start/stop`
   captures headers and bodies.
7. **Record every anomaly** — an untranslated key, a layout jump, a slow step — as "noticed,
   not investigated". Do not drop it.

## Mechanics

- **Refs go stale after any navigation.** Re-run `snapshot -i`; never reuse `@eN` across
  steps.
- `click` on a client-side link waits for navigation and can exceed the timeout. If it hangs,
  `open` the href instead — but note that you then lost the soft-navigation case and cover
  it with `pushstate`.
- `eval` is synchronous in page context; wrap async work in an IIFE. Multi-line scripts go
  through `--file`.
- `offsetParent` is unreliable for visibility (transformed and fixed containers report
  `null` while visible). Use presence, `getComputedStyle().display`, or
  `getBoundingClientRect()`.
- `viewport <w> <h>` sets the size and sticks across navigations; `window.resizeTo` is a
  no-op.
- `img.complete` / `naturalWidth` is a false negative for lazy-loaded images. Assert the HTTP
  status from `network` instead.
- Some widgets ignore synthetic events (`element.click()`, setting `value`); `agent-browser
  click` sends real pointer events and `find … fill` targets the input rather than its
  wrapper. Drag-and-drop libraries usually need a real pointer drag; flag it as manual if it
  can't be driven.
<!-- @if profile:nextjs -->
- The Next.js error overlay lives in shadow DOM:
  `eval 'document.querySelector("nextjs-portal")?.shadowRoot?.querySelector("[data-nextjs-dialog]")?.textContent'`.
- On a dev instance, `/_next/mcp`'s `get_errors` adds the server's own account of a failure,
  including browser errors it caught.
<!-- @endif -->

## Component shapes worth knowing

> **Adapt me.** The component quirks a test run keeps rediscovering in this app — how tabs,
> disclosure widgets, dialogs and stateful widgets are built, and what attribute or storage
> key reveals their state.

- {{ComponentQuirk}}

## When to reach for more

| Need | Command |
|---|---|
| Dark / light / reduced motion | `set media dark` — flips the media query so the app's own theme resolution runs |
| Device or viewport emulation | `set device <name>`, `set viewport <w> <h>` |
| Accessibility audit | `a11y --tags wcag2a,wcag2aa` (axe-core) |
| A second isolated browser (a "before" next to an "after") | `--session <name>` |
| Recording, visual diff | `record start <abs path>`, `diff screenshot --baseline` |

Relative output paths resolve against the daemon's cwd — pass absolute paths.

## Stopping

`agent-browser --session <name> close` for each session. A browser left open holds the dev
server's hot-reload socket and pollutes the next run's baseline.
