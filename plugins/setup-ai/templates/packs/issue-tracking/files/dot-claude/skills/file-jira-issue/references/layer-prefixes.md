# Layer prefix on codebase issues

Every issue about the site's code, its tests, its tooling or its deployment
goes under the **Nextjs** epic (DOC-3807), and its summary starts with the
layer the work lands in, in square brackets: `[edge] Collapse the proxy's two
namespace gates onto one not-found rewrite`. The prefix is how the layering
runs (DOC-3901) find the work that moves with them; an unprefixed summary
under that epic is a filing error, not a style choice.

The roster's authority is the refactor journal,
`.ai/refactoring/041-lib-layering/` — `decisions.md` for the rulings that
placed each directory and `plan.md` for what each PR moved. Read those when
the placement is not obvious from the table below. The proposal document the
layering started from lives at the repo root but is untracked, so do not cite
it: a reader in a fresh clone does not have it.

## The roster

Ten `lib/` layers, ordered by what each may import, each named by its
`lib/<layer>/` subs. `docs/conventions/test-layout.md` § The layer map
translates a pre-refactor directory to its sub module by module, departures
included.

| Prefix | Holds today | Examples |
|---|---|---|
| `kernel` | `lib/kernel/{lazy,url,errors,headers,fs,http,runtime,observability,workers,async,cache,text,emission,validation,config}` | site-url, lazy, walk-files, pool sizing |
| `client` | `lib/client/{theme,cookies,dev-model,layout,docsbot,dom,storage,analytics,feedback,search,icons}` | pre-paint IIFEs, typed localStorage registry, browser search clients |
| `data` | `lib/data/{engine,resources,dal,relations,validation,settings}` and its root modules (`dispatch`, `contracts`, `openapi`, `resource*`) | resource registry, YAML persistence, setting catalog |
| `corpus` | `lib/corpus/{entries,frontmatter,loader,resolve,collections,navigation,redirects,links,search,index,composite,write}` | mdx-loader, page-tree, redirect manifest, identifier index, composite pipeline |
| `render` | `lib/render/{tags,fences,emission,schemas,scan,editor-descriptors,markdown,shiki,api-examples,icons}` | tag catalog, tag validators, fences, scan, remark plugins, code-link markers, icon registry |
| `emit` | `lib/emit/{algolia,aira,seo,markdown-surface,job,client}` | indexer, AIRA envelope, OG cards, sitemaps, llms.txt, discovery header |
| `edge` | `lib/edge/{proxy,negotiate,config,redirects,admin-gate,helpservice,client/helpservice}` | proxy chain steps, the AIRA reverse proxy, the markdown-unavailable notice, the admin route gates, site-origin, the client-config builder, help-service dropdown |
| `quality` | `lib/quality/{issues,content,external-links}` | rule engine, content:validate, external-link pinger |
| `admin` | `lib/admin/{changelog,client,composite-pages,editor,mcp}` | blades, composite CLI, changelog parser and ingest, the management MCP server |
| `portal` | `lib/portal/{serving,client,compose}` | the snapshot reader, in-memory portal search, the subpage splitter and link rerouters, the progress store |

Two trees above `lib/`:

| Prefix | Holds | Examples |
|---|---|---|
| `components` | `components/`, `app/admin/{components,context,hooks,lib,views}` | header search dialog, MDX tag components, status badge, learn-portal cards |
| `app` | `app/` routes, layouts, route handlers, `globals.css`, `app/styles/` | the `/md` route handler, list-item margins in global CSS |

Three names for work that is in none of the above:

| Prefix | Holds |
|---|---|
| `infra` | Dockerfile, Bicep, pipelines that ship an image, slots, App Service, prod restarts |
| `tooling` | `scripts/`, knip, patch-package, `verify`, Playwright and Vitest config, e2e fixtures, test-impact, pipeline stages that run a check |
| `docs` | `docs/`, `.ai/`, README, conventions |

## Deciding the hard cases

- **A test takes the layer of the code it pins.** A Vitest suite for the
  Algolia indexer is `emit`; an e2e spec for the header search dialog is
  `components`. Only harness work that pins nothing is `tooling`.
- **Pipeline YAML splits on what the stage does.** A stage that ships an
  image is `infra`; a stage that runs a check is `tooling`.
- **An MDX tag splits on what changes.** What the tag renders (a new prop,
  a caption, dark-mode colours) is `components`; how it is parsed, scanned
  or projected (remark plugins, the tag catalog, code-link markers) is
  `render`.
- **A fix goes where the fix lands, not where the symptom shows.** A missing
  asset that takes down a page is `corpus` when the fix is the asset reader
  returning null, even though the reader sees it in an image component.
- **A route handler that only calls into a layer is `app`;** the layer it
  calls is not the prefix unless the change is in that layer.
- **Cross-cutting work takes the layer with most of the sites.** State the
  runner-up in the body's Context block so the layering runs can see it.
- **One prefix only.** A change that genuinely needs two is two issues.
- **The layering umbrella itself (DOC-3901) carries no prefix.** Its chunks
  do.

## Body shape under the Nextjs epic

Same four blocks as the doc backlog, with the second block renamed:

```
Context
What to do
Acceptance criteria
References
```

Issue type is **Story** for planned work and **Bug** for a defect; the
Documentation type belongs to release epics only. Siblings to copy from:
DOC-3810 (story), DOC-3898 (bug).
