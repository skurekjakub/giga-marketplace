# End-to-end test conventions

> **Adapt me.** `rubber-duk-e2e` writes, heals and audits specs in
> `{{E2E_GLOB}}` against the E1–E7 yardstick below. Add your runner's
> specifics (config file, target server, readiness helpers) here and in
> `stack-profile.md` § E2E.

**North-star: would this spec fail if the behaviour it covers broke?**

## E1 — Page objects

Specs talk to the app only through page objects and component drivers. No raw
locators or page-level assertions in a spec body. A page object may own
reusable `expect*` assertions; scenario-specific assertions stay in the spec.

## E2 — Readiness gate

Every navigation waits until the app is interactive, not just loaded: a
readiness sentinel (for example a `data-hydrated` attribute set once the client
is interactive), wrapped in a helper such as `gotoReady(page, url)`. A lazily
rendered or streamed subtree gets its own sentinel and wait helper before a
spec clicks into it. If a subtree has no sentinel, add one — never a sleep.

Readiness helpers in this repo: {{ListYourReadinessHelpers}}

## E3 — Selector hierarchy

Role → label / placeholder → test id → a CSS locator scoped to a stable
container. A bare `.first()` on a broad locator is a defect.

## E4 — State through `data-*` or role

Assert `data-state`, `aria-*`, role and text. Never class names, computed
styles or colour literals.

## E5 — Web-first assertions

Auto-retrying assertions only. No fixed sleeps, no "network idle" waits.

## E6 — Isolation

One behaviour per spec. The fixture URL is a constant at the top of the file.
Persisted client state (local storage, cookies) is reset in `beforeEach` when a
test depends on it. Specs target frozen fixture content, never production
content.

## E7 — No theater

An assertion that can't fail when the behaviour breaks, a spec testing five
things, or a heal that loosened an assertion to go green, is a blocker.

## Running

- Whole suite: `{{E2E_CMD}}`.
- One spec: `{{E2E_CMD}}` with the spec path appended. Run it bare — never
  pipe e2e output through `head`/`tail`/`grep`.
