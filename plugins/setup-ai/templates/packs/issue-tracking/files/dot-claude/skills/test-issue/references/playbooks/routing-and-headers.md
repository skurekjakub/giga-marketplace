# Playbook — routing, status codes and headers

For a fix under `lib/edge/proxy/`, `proxy.ts`, `next.config.ts`, a route handler, redirect data
(`redirect_from`, the redirects map), or a caching rule. The consumer is a crawler, an
agent, the App Service health probe, or a reader who typed a URL. **This playbook runs on
the standalone build.** `next dev` answers 200 where the build answers 404 and skips most
header rules; a verdict taken on `dev` here is not a verdict.

## Instance

```bash
npm run build
npm run start
```

Then every probe against `http://localhost:3004`. Local probes run on a non-canonical host,
so `x-robots-tag: noindex` appears on every response; only per-route `noindex` (the 404
surface, `.md` responses) is meaningful.

## Probes

```bash
curl -s -o /dev/null -D - "http://localhost:3004/<path>"
```

Read status, `location`, `cache-control`, `content-type`, `x-robots-tag`, `vary`. Save the
transcript into the evidence directory. For a browser-side view,
`agent-browser network requests` after an `open` lists the document request and every
follow-up; `network har start` / `har stop <path>` captures the headers and bodies.

Verdict order for an unknown path, and which steps stay 200 for RSC and prefetch requests,
are in [`docs/conventions/unknown-path-gate.md`](../../../../../docs/conventions/unknown-path-gate.md).
The expected rows — docsassets, image optimizer, `.md`, 404 tiers, redirects — are in
[`.ai/regression/cache-and-routing-smoke.md`](../../../../../.ai/regression/cache-and-routing-smoke.md);
every row there is a measured value promoted to an expectation. Run the rows adjacent to
the change.

## What to verify

1. **The path the ticket names**, document request: status and headers as the plan says.
2. **Its neighbours**: with and without trailing slash (`/x/` is a 308), with a query
   string, as an RSC request (`-H 'RSC: 1'`), as a `.md` request, and the same path on a
   legacy collection if the rule is collection-aware.
3. **A redirect's target answers 200**, and the chain is one hop. `curl -sIL` shows the
   whole chain; more than one 3xx is a finding unless documented.
4. **Cache rules**: a long `max-age` only on a deploy-versioned URL (`?dpl=`); everything
   unversioned revalidates or expires fast; misses and per-request responses are
   `no-store`. [`docs/conventions/cache-policy.md`](../../../../../docs/conventions/cache-policy.md)
   is the contract.
5. **The gates that exist**: `npm run check:route-cache-churn` (with the server up) and
   `npm run check:static-prerender` after the build, when the change touches the
   unknown-path gate or prerendering. Read their output; they are the tripwires the
   pipeline relies on.

## Supporting

- The unit tests under `__tests__/unit/lib/edge/proxy` and the route handler's test, run alone.
- `e2e/scenarios/routing/unknown-path-gate.spec.ts`, `redirects.spec.ts`, `not-found.spec.ts`
  — read for what they pin; unrun locally unless asked.

## Traps

- **`Vary` cannot be extended by the proxy** on app pages — Next replaces it after the
  proxy runs. A ticket asking for a new `Vary` field is verified on the shipped header,
  not on the proxy's intent.
- **A generated `servable-paths.json` gates app routes.** If `/docsassets` answers an HTML
  404 with `text/html` instead of `text/plain`, the gate swallowed it before the route
  handler; that is the tripwire, not a content bug.
- **Soft navigations and prefetches into a miss are 200 in both modes.** Only the document
  request carries the 404. A "the 404 page returns 200" report is checked against the
  request type before it is a finding.
