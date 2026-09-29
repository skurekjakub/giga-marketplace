# Measurement recipes

Numbers in a follow-up come from one of these, with the method named in the
file. Each recipe lists the trap that produced a wrong number before.

## Corpus statistics

```bash
find content -name '*.mdx' -type f -printf '%s\n' \
  | awk '{n++; s+=$1; if($1>m)m=$1} END {printf "files=%d total=%.1fMB mean=%.0fB max=%dB\n", n, s/1048576, s/n, m}'
find content -name '*.mdx' -type f -printf '%s %p\n' | sort -n | tail -5
grep -rlE '^(import|export) ' content --include='*.mdx'   # then open the hits: fenced samples are not ESM
```

Trap: rtk's `find` rejects compound predicates; use a single predicate or
`rtk proxy find …`. Counting occurrences across the corpus needs `grep -c`
per file summed, not `grep -rc` eyeballed.

## Micro-benchmark of a pipeline stage (tsx)

Scripts live in the scratchpad, import repo modules through the `@/` alias,
and need the repo's `node_modules` visible from the script's directory:

```bash
S=<scratchpad>; ln -sfn "$PWD/node_modules" $S/node_modules
npx tsx --tsconfig tsconfig.json $S/bench.mts; rm -f $S/node_modules
```

Shape: three passes, report the third (warm); mean / p50 / p90 / max; sample
every ~30th file of two collections plus the known outliers by size. Use the
repo's own plugin arrays (`lib/corpus/loader/pipeline/mdx-pipeline.ts`) — a benchmark
with a different plugin list measures a different pipeline.

Traps: `.ts` under tsx hits `ERR_PACKAGE_PATH_NOT_EXPORTED` for ESM-only
dependencies — name the script `.mts`. `--conditions=react-server` breaks any
import chain that reaches `react` context APIs; benchmark the library call
directly instead of the loader that wraps it.

## Server-side cost of a page

`node_modules/next/dist/server/lib/cache-handlers/default.js` logs every
`'use cache'` get/set when `NEXT_PRIVATE_DEBUG_CACHE=1` is set on the
standalone server — count `set … done` per request to prove a cache hit or a
duplicate. Build-output footprint: `ls -la .next/server/app/<route>.*`,
`du -sh .next/server/app/<route>.segments`; gzip with `gzip -c file | wc -c`
to get what the wire carries. Static-generation time comes from the pipeline
build log line "Generating static pages (N/N)" — fetch with
`pipelines_build_log`, save to a file, grep locally (the log exceeds the tool's
token limit).

Trap: `x-nextjs-cache` is not set on App Router page responses in 16.x — only
the Pages handler and the server-action path emit it. Use
`curl -s -o /dev/null -w '%{time_starttransfer}\n'` first vs second request.

## Client payload of a page

Save the HTML (`curl` or `agent-browser get html`), then split the inline Flight rows:

```js
const rows = [...html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)]
  .map(m => JSON.parse(m[1])[1]).join('');        // element [1] is the chunk
// rows are "<id>:<payload>\n"; byte-count by id, then look up the ids that matter
```

Traps: `curl -H 'RSC: 1'` can return 0 bytes on routes that need the router
state — parse the inline payload instead. A `D` (debug) row shares an id with
the data row; match `<id>:[` for data. Flight dedupes by *reference*, so two
byte-identical arrays built separately ship twice — count bytes, don't trust
"it's the same data".

## Runtime behaviour in the browser

`agent-browser vitals <url>` for TTFB / LCP / CLS / FCP / INP and hydration.
`agent-browser react renders start/stop` only captures what mounts *after*
start; across a navigation it often captures nothing — use `vitals` for
load-time questions.

## Framework facts

1. `node_modules/next/dist/server/**/*.js` — the behaviour that ships. Cite
   `file:line`. Read the function, not the comment above it.
2. `node_modules/next/dist/docs/**/*.md` — the bundled docs for this exact
   version. Cite `path:line`. Newer than anything in training data.
3. Package source for libraries (`node_modules/@mdx-js/mdx/lib/*.js`).
4. Vendor pages via WebFetch — note the URL and that it was fetched today;
   Azure Learn redirects between SKU generations, so confirm the SKU name on
   the page you landed on.

Repo docs (`docs/conventions`, `.ai/*`, README prose) are hypotheses, not
evidence; they go stale exactly where the interesting findings are.

## Shell traps that cost a round trip

- A `cd` inside a compound command moves the persistent working directory for
  every later call; use absolute paths.
- `grep` with huge `.{0,N}` windows on minified files hangs — slice by byte
  offset in node instead.
- rtk filters tool output; when a fact comes from output (a count, a version),
  run it through `rtk proxy` or compute it with `awk`/`node` so nothing is
  elided.
