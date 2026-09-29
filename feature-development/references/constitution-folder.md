# The constitution folder

Read this before minting a new `<domain>/<slug>/` folder or choosing which
existing one a change belongs under.

`.ai/feature-constitution/<domain>/<slug>/` holds two kinds of file. Keeping
them distinct is the load-bearing rule of this convention — they rot in
opposite ways, so they cannot share the same document.

| Class | Files | Audience | Lifecycle |
| --- | --- | --- | --- |
| **Implementation artifacts** | `research.md`, `unknowns.md`, `spec.md`, `plan*.md` | The agents and people doing the build, during the build | Frozen — captures how the work was thought through |
| **Final spec** | `README.md` (mandatory) | Future agents and people reading the codebase | Evergreen — always describes the _current_ state |
| **Explainer** | `explainer.html` (mandatory, published) | The user, once the feature ships | Frozen — describes the branch as it landed |

`README.md` and `explainer.html` are the mandatory artifacts. The
implementation artifacts are committed when their phase ran and absent when
the phase was skipped or done conversationally — that is expected, not a bug.

`<slug>` is kebab-case and descriptive (`frontmatter-validation`,
`sitemap-md`, `dev-model-switching`). No central registry, no `F-NNN` IDs.

## First — does this belong under an existing constitution?

Before minting a fresh `<domain>/<slug>/`, read
`.ai/feature-constitution/README.md` — it carries the seven domains and the
full roster — and ask whether the work is really a _new_ feature or a change
to an existing one.

- A refactor, extraction, rename, prop-retirement, consolidation, validation
  tweak, or perf change to an existing feature belongs under that feature's
  constitution — not a new folder. Fold the resulting state into the
  parent's `README.md`, and keep any journal artifacts (`spec.md`,
  `plan*.md`) under the parent's folder. A new folder per change
  proliferates near-duplicates that drift from the feature they modify.
- Mint a fresh `<slug>` folder only for a genuinely self-contained
  capability — a new component, surface, route, dev tool, or distinct
  subsystem that stands on its own.
- If unsure which existing constitution is the parent, pick the feature
  whose code the change most touches; if nothing fits, it is probably a real
  new feature.

This keeps the corpus a map of _features_, not a changelog of _edits_.

## Then — which domain?

`<domain>` is one of the seven in the roster, chosen by **what the feature is
about for a reader**, not by which directory its code lands in. A feature
whose code spans `lib/`, `app/` and `components/` still has one subject.

| Domain | Pick it when |
| --- | --- |
| `authoring/` | a docs author's behaviour changes — an MDX construct, or the contract over one |
| `composite-pages/` | it is about assembling many dated entries into one page |
| `discovery/` | the consumer is a crawler, an agent, or a search index |
| `learn-portal/` | it only makes sense if the learn portal exists |
| `management/` | it is about editing managed data, not about rendering pages |
| `platform/` | it changes how the app runs, not what it says |
| `site-chrome/` | a reader sees it on every page, and it is not content |

Seven is deliberate. A feature that fits none of them is evidence for an
eighth domain — propose the domain alongside the feature, and add it to the
roster in the same branch. Never open a `misc/`.

Adding a folder means adding its row to the roster in
`.ai/feature-constitution/README.md`, in the same commit. `npm run
check:constitution-links` fails otherwise — an index that misses a folder is
worse than no index, because it is read as complete.

## Cross-referencing another constitution

Write `[[slug]]`, never a path. The slug is unique across all seven domains,
so a name resolves without one, and a constitution that moves domain breaks
no link. `../other-feature/README.md` and
`.ai/feature-constitution/<domain>/<slug>/` both encode a directory depth
that a regroup invalidates silently; `[[slug]]` encodes only identity. The
same check enforces that every `[[slug]]` resolves.

Paths remain correct for locators outside the corpus — `docs/conventions/*`,
a `lib/` module, a test file.

## Implementation artifacts — what they may contain

Allowed and expected in `research.md`, `unknowns.md`, `spec.md`, `plan*.md`:

- Branch names, commit SHAs, PR numbers.
- Task lists, checkboxes, "Track A / B / C" framing.
- Status markers like `[x] shipped`, `<details>` collapses for done work.
- References to specific past discussions, audits, alternatives considered,
  dead ends explored.
- "Pre-correction the audit thought X" — useful context for the agent doing
  the work, captures why a decision was made.
- Self-references like "see Task 4 below".

These files are a journal of how the work got done. They stay on disk because
deleting institutional knowledge is bad, not because anyone should be reading
them by default a year from now.
