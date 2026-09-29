# Stack profile — {{PROJECT_NAME}}

> **Adapt me.** Every `rubber-duk-*` agent reads this file before it reviews or
> writes code. It holds everything that depends on *this* stack
> ({{STACK_SUMMARY}}): the framework docs to trust over training data, the
> skills to load, and the stack-specific hunt lists. The agents' own prompts
> stay stack-neutral — when the stack changes, change this file, not the
> agents. Delete sections that don't apply; add the rules your team keeps
> repeating in review.

<!-- @if profile:nextjs -->
## Framework docs and skills

- **Next.js docs ship with the package.** Before any Next.js claim or change,
  find and read the relevant page under `node_modules/next/dist/docs/`
  (routing, caching, RSC, headers, route handlers, middleware/proxy). Training
  data is outdated; the version-matched bundled docs are the source of truth.
  Cite the page path in findings.
- **Cache Components.** When `cacheComponents: true` is set in
  `next.config.*`, load the `next-cache-components-adoption` and
  `next-cache-components-optimizer` skills before touching `'use cache'`,
  `cacheLife`, `cacheTag`, `updateTag`, `revalidateTag`,
  `generateStaticParams`, `await params` / `await searchParams`, or Suspense
  placement in `app/**/{page,layout,route}.*`.
- **Dev loop.** Load the `next-dev-loop` skill before driving the dev server
  to verify a change.
- **React.** Load `vercel-react-best-practices` (and
  `vercel-composition-patterns` for component APIs) before reviewing or
  writing React. Code that goes against them is a finding.

## Review hunt list (rubber-duk-review, rubber-duk-backend)

### Next.js / Cache Components
- Sync `params` / `searchParams` access — both are Promises.
- `await params` / `await searchParams` outside a Suspense boundary in a
  page's default export — blocks the static shell.
- A client component using `useSearchParams` / `usePathname` rendered without
  a server-side `<Suspense>` ancestor at the server-parent call site —
  cascades to a client-side-rendering bailout.
- `'use cache'` not the first statement in the function body; file-level
  `'use cache'` with non-async exports.
- Missing `cacheLife()` on a `'use cache'` block — state the lifetime
  explicitly.
- `cookies()` / `headers()` / `draftMode()` inside `'use cache'` — throws at
  request time, or caches one caller's identity for everyone.
- A Promise captured into `'use cache'` from a non-cached parent — the build
  hangs.
- Class instances (`NextResponse`, `URL`), Symbols, WeakMap/WeakSet or
  functions returned from `'use cache'` — not serializable.
- `outputFileTracingIncludes` missing paths the runtime reads with `fs` — a
  silent production break in standalone output.
- Per-route headers set inline instead of in `next.config.*` `headers()`.

### React 19 / Server Components
- `useEffect` for data fetching where a Server Component can fetch.
- `'use client'` wider than the smallest interactive subtree.
- `useState` lazy initializer reading `typeof window` — hydration mismatch.
- JSX `<meta>` / `<title>` / `<link>` inside a cached scope — belongs in
  `metadata` / `generateMetadata`.

### TypeScript strict
- `any` smuggled in via `as unknown as X`.
- `params: Promise<…>` mistyped as a plain object.
- Non-null `!` on values you don't control (`process.env.X!`).
- `as const` arrays widened to `string[]` at the consumer.
- Discriminated unions with overlapping discriminants.

### Tailwind CSS 4
- `@tailwind base/components/utilities` — removed; use `@import "tailwindcss"`.
- `tailwind.config.js` — replaced by `@theme {}` in CSS.
- Dynamically built class names (`` `bg-${color}-500` ``) — the scanner can't
  see them; map props to complete static class names.
- Hard-coded hex colours or inline `style={…}` where a theme token or utility
  exists.

## Security surface (rubber-duk-auditor)

- **Canonical config:** `next.config.*` `headers()` holds the CSP and the
  security-header set; `proxy.ts` / `middleware.ts` is the only place for
  nonces, HTTPS enforcement and request-time blocking. Read both end to end
  before any header or CSP finding; cite them.
- `NEXT_PUBLIC_*` is shipped to the client bundle — anything sensitive in it
  is a blocker.
- `process.env.X` (non-public) read in a `'use client'` module — it's
  `undefined` in the browser; the author thinks they read a secret.
- Sensitive props crossing `'use client'` — the RSC payload is in the HTML
  and network traffic. Project server-side to exactly what the client needs.
- Server-only modules imported into client code without the `server-only`
  guard.
- Server Actions without input validation or an authorization check.
- `productionBrowserSourceMaps: true` without justification.
- Build output (`.next/standalone/`) that could pick up `.env*` files.

## Backend surface (rubber-duk-backend)

- `app/**/{page,layout,route}.*` — server components, route handlers,
  layouts, Suspense boundaries.
- `middleware.ts` / `proxy.ts`, `next.config.*`, build scripts.
- Everything under the server-side library folders (for example `lib/`,
  `server/`).
- Hand anything rendering JSX for the browser to `rubber-duk-frontend`.

## Frontend (rubber-duk-frontend)

- Default to Server Components; add `'use client'` only for event handlers,
  browser APIs or client state, around the smallest interactive surface.
- Style with the theme tokens / utilities; never hard-code hex.
- Every interactive element: hover state with a clear inverse, a
  `:focus-visible` ring, and a `prefers-reduced-motion` gate on transitions
  (`motion-reduce:transition-none`).
- Verify in the running dev server (`{{DEV_CMD}}`, {{LOCAL_URL}}) with the
  browser tools — screenshots of default and hover states are the ground
  truth.
<!-- @endif -->
<!-- @if profile:generic -->
## Framework docs and skills

- {{ListFrameworkDocs}} — where the version-matched docs for your framework
  live (for example `node_modules/<pkg>/docs/`, a pinned docs site). Agents
  cite these over training data.
- {{ListSkillsToLoad}} — skills the agents should load before touching a
  given surface (for example a framework best-practices skill).

## Review hunt list (rubber-duk-review, rubber-duk-backend)

- {{ListFrameworkAntiPatterns}} — the framework and language anti-patterns
  your reviewers keep catching, one bullet each, "forbidden → do instead".

## Security surface (rubber-duk-auditor)

- **Canonical config:** {{WhereHeadersAndCspLive}} — the file(s) that define
  response headers, CSP, CORS and cookies. The auditor reads them end to end
  before any header finding.
- {{ListClientServerBoundaryRules}} — what may never reach the client
  (bundles, serialized payloads, public env vars).

## Backend surface (rubber-duk-backend)

- {{ListBackendFolders}} — the folders and file patterns rubber-duk-backend
  owns. Everything rendering UI goes to rubber-duk-frontend.

## Frontend (rubber-duk-frontend)

- {{ListFrontendRules}} — component, styling-token and accessibility rules
  specific to your UI stack.
<!-- @endif -->

<!-- @if detect:vitest -->
## Unit tests (rubber-duk-tests)

- Runner: Vitest. Load the `vitest` skill for `test.extend`, `test.for`,
  `vi.mocked` / `vi.hoisted`, mocking and reset semantics. **Version caveat:**
  the skill may target an older major than `package.json` declares — verify
  mocking, fixture and config claims against the official docs for the
  installed major.
- jsdom via the `// @vitest-environment jsdom` docblock; the default
  environment is `node`.
- Read `vitest.config.*` for the mechanics the suite relies on (globals,
  `restoreMocks` / `clearMocks`, setup files, aliases).
<!-- @endif -->
<!-- @if detect:jest -->
## Unit tests (rubber-duk-tests)

- Runner: Jest. Read `jest.config.*` for environments, setup files and mock
  reset semantics before judging a test.
<!-- @endif -->

<!-- @if detect:playwright -->
## E2E (rubber-duk-e2e)

- Runner: Playwright. Read `playwright.config.*` for the base URL, the web
  server it starts (dev server or production build), projects/browsers and
  retries.
- Prefer running e2e against a production build: a dev server's
  compile-on-demand makes hydration timing non-deterministic.
<!-- @endif -->
