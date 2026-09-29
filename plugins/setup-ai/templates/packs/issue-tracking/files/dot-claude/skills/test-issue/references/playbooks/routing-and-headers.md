# Playbook — routing, status codes and headers

For a fix in routing, middleware, server config, a route handler, redirect data, or a caching
rule. The consumer is a crawler, an API client, a health probe, or a user who typed a URL.
**This playbook runs on the production build.** Dev servers often answer 200 where the build
answers 404 and skip header rules; a verdict taken on `dev` here is not a verdict.

## Probes

```bash
curl -s -o /dev/null -D - "<build url>/<path>"
```

Read status, `location`, `cache-control`, `content-type`, `x-robots-tag`, `vary`. Save the
transcript into the evidence directory. For a browser-side view, `agent-browser network
requests` after an `open` lists the document request and every follow-up;
`network har start` / `har stop <path>` captures headers and bodies.

Run the `{{AI_DIR}}/regression/` rows adjacent to the change — every row there is a measured
value promoted to an expectation.

## What to verify

1. **The path the ticket names**, document request: status and headers as the plan says.
2. **Its neighbours**: with and without trailing slash, with a query string, with a
   different `Accept` header, and as a client-side data request if the framework makes one.
3. **A redirect's target answers 200**, and the chain is one hop. `curl -sIL` shows the
   whole chain; more than one 3xx is a finding unless documented.
4. **Cache rules**: a long `max-age` only on versioned, immutable URLs; everything
   unversioned revalidates or expires fast; misses and per-user responses are `no-store` or
   `private`.
5. **Any route or cache check scripts the repo has** — run them and read their output; they
   are the tripwires the pipeline relies on.

## Supporting

- The unit tests for the middleware or handler, run alone.
- The e2e specs for routing — read for what they pin; unrun locally unless asked.

## Traps

- **Frameworks may rewrite headers after your middleware runs** (for example `Vary`). Verify
  the shipped header, not the middleware's intent.
- **Soft navigations and prefetches into a missing page can be 200.** Only the document
  request carries the 404 in many frameworks. Check the request type before calling a 200 a
  finding.
<!-- @if profile:nextjs -->
- **Next.js:** local probes run on a non-canonical host, so host-dependent headers (for
  example a `noindex` on non-production hosts) appear on every response; only per-route
  values are meaningful. RSC requests (`-H 'RSC: 1'`) are a neighbour worth probing.
<!-- @endif -->
