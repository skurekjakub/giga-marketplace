# Playbook — a content change

For a fix whose diff is under `content/`, `learn-portal/`, or a composite page source:
copy, a link, frontmatter, an MDX tag's usage, a learn-portal record. The consumer is a
reader on the rendered page and an agent reading the `.md` projection.

## Find the URL

The page's route is its identifier, not its file path. `lib/corpus/index/generated/` maps
identifiers to files after `npm run build:indexes`; the quickest read is the frontmatter's
`identifier` plus the collection: `/<collection>/<identifier path>`. A page in a legacy
collection (`13`, `k12sp`, …) lives at `/<collection>/<slug>`. `/search` and
`/<collection>/search` are app routes with no map entry — a miss in the map never proves a
URL is dead.

## What to verify, per named page

1. **The rendered page** (`goto`, then `snapshot` + `screenshot`): the changed passage reads
   as the ticket asks, headings and the right-sidebar TOC agree, code blocks render (no
   escaped braces, no stray backticks — DOC-3842 was exactly that), images resolve
   (`network` shows 200 for each `docsassets` request, with `?dpl=` on the src).
2. **The `.md` projection**: `curl -s <url>.md` (or `-H 'Accept: text/markdown'`). The
   changed text must appear there too; the projection is what LLM agents and the MCP
   endpoint read. A page with no projection answers 404 on the build and "Page not found"
   at 200 in dev.
3. **Every link the change touches**: `curl -sI` each `href`, status per link. Internal
   links are routed through the identifier map; a relative link to a moved page is the
   common regression. External links are not validated locally (the nightly pipeline owns
   that) — prove a single URL with `curl -sI` if the ticket is about it, nothing more.
4. **Conditional content**: `<CoreOnly>` / `<MvcOnly>` blocks on K12SP/K13 pages switch with
   the dev-model switcher in the header; a change inside one is verified in both models.
5. **Search**: a new or renamed page is **not** in the Algolia index until the production
   pipeline reindexes. Say so; do not mark it NOT TESTED as if it were your gap.

## Supporting

- `npm run content:validate` runs locally without a build and covers frontmatter, MDX,
  identifiers and composite anchors. Run it bare; read the summary.
- For a learn-portal record: the admin editor at `/admin` (dev only) shows the record;
  the public page under `/modules`, `/paths`, `/personas` is the consumer.

## Traps

- **Legacy collections are never reconverted.** `13` and `k*` pages were hand-ported from
  the Jekyll site; a fix in one is a hand edit, and the Jekyll source at tag `jekyll-final`
  is the reference for what it used to say.
- **`style` attributes on content JSX are a violation** the validator flags; a fix that
  adds one is not a fix.
- The dev watcher rebuilds on `content/**` edits and broadcasts over `ws://localhost:3005`;
  a page that still shows old copy after the fix was pulled usually needs a `goto`, not a
  server restart.
