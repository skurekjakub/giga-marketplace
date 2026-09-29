# Measurement recipes

Numbers in a follow-up come from one of these, with the method named in the
file. Each recipe lists the trap that produced a wrong number before. Add the
recipes your stack needs as you pay for them.

## File and corpus statistics

```bash
find <dir> -name '*.<ext>' -type f -printf '%s\n' \
  | awk '{n++; s+=$1; if($1>m)m=$1} END {printf "files=%d total=%.1fMB mean=%.0fB max=%dB\n", n, s/1048576, s/n, m}'
find <dir> -name '*.<ext>' -type f -printf '%s %p\n' | sort -n | tail -5
```

Trap: counting occurrences across many files needs `grep -c` per file summed,
not `grep -rc` eyeballed. On macOS, `find -printf` doesn't exist — use
`stat -f '%z'` or `gfind`.

## Micro-benchmark of a code path

Scripts live in the scratchpad (never the repo), import the repo's own modules,
and resolve the repo's dependencies. For TypeScript with `tsx`:

```bash
S=<scratchpad>; ln -sfn "$PWD/node_modules" $S/node_modules
npx tsx --tsconfig tsconfig.json $S/bench.mts; rm -f $S/node_modules
```

Shape: three passes, report the third (warm); mean / p50 / p90 / max; sample
across the real inputs plus the known outliers by size. Use the repo's own
configuration of the code path (its plugin lists, options, fixtures) — a
benchmark with a different configuration measures a different pipeline.

Trap: `.ts` under tsx hits `ERR_PACKAGE_PATH_NOT_EXPORTED` for ESM-only
dependencies — name the script `.mts`.

## Server response timing

```bash
curl -s -o /dev/null -w '%{time_starttransfer}\n' {{LOCAL_URL}}/<route>   # first (cold) vs second (warm) request
```

Measure against a production build when the question is about production:
dev servers compile on demand and skip caches.

## Client payload of a page

Save the HTML (`curl` or `agent-browser get html`) and the network log; byte
count what each visitor downloads, and `gzip -c file | wc -c` for what the
wire actually carries.

## Runtime behaviour in the browser

`agent-browser vitals <url>` for TTFB / LCP / CLS / FCP / INP. Render
profiling only captures what mounts *after* it starts; across a navigation it
often captures nothing — use `vitals` for load-time questions.

<!-- @if profile:nextjs -->
## Next.js specifics

- **Cache hits:** `node_modules/next/dist/server/lib/cache-handlers/default.js`
  logs every `'use cache'` get/set when `NEXT_PRIVATE_DEBUG_CACHE=1` is set on
  the production server — count `set … done` per request to prove a cache hit
  or a duplicate.
- **Build output footprint:** `ls -la .next/server/app/<route>.*`,
  `du -sh .next/server/app/<route>.segments`.
- **Static generation time:** the build log line "Generating static pages
  (N/N)". CI build logs are often larger than a tool's output limit — save to a
  file and grep locally.
- Trap: `x-nextjs-cache` is not set on App Router page responses — only the
  Pages handler and the server-action path emit it. Use first-vs-second
  request timing instead.
- **Flight payload:** split the inline RSC rows out of the saved HTML:

  ```js
  const rows = [...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)]
    .map(m => JSON.parse(m[1])[1]).join('');        // element [1] is the chunk
  // rows are "<id>:<payload>\n"; byte-count by id, then look up the ids that matter
  ```

  Traps: `curl -H 'RSC: 1'` can return 0 bytes on routes that need the router
  state — parse the inline payload instead. A `D` (debug) row shares an id with
  the data row; match `<id>:[` for data. Flight dedupes by *reference*, so two
  byte-identical arrays built separately ship twice.
<!-- @endif -->

## Framework and library facts

1. The installed framework source (for example `node_modules/<framework>/…`) —
   the behaviour that ships. Cite `file:line`. Read the function, not the
   comment above it.
2. The version-matched docs the stack profile names — cite `path:line`. Newer
   than anything in training data.
3. Package source for libraries (`node_modules/<pkg>/…`).
4. Vendor pages via WebFetch — note the URL and that it was fetched today;
   vendor docs redirect between product generations, so confirm the product and
   tier on the page you landed on.

Repo docs (`docs/conventions`, `{{AI_DIR}}/*`, README prose) are hypotheses, not
evidence; they go stale exactly where the interesting findings are.

## Shell traps that cost a round trip

- A `cd` inside a compound command moves the persistent working directory for
  every later call; use absolute paths.
- `grep` with huge `.{0,N}` windows on minified files hangs — slice by byte
  offset in node instead.
- If a proxy or wrapper filters command output, compute facts that come from
  output (a count, a version) with `awk`/`node` so nothing is elided.
