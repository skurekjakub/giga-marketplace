# Agent working rules

Standing rulings the repository owner has given agents working in this
checkout. `git log` on this file is the only date a ruling carries, so read it
when a rule looks stale.

Every section is bullets. A bullet is one rule, its reason when the reason is
not obvious, and how to apply it.

---

## 1. Talking to the user

- **Bullets, never paragraphs, in the terminal reply.** Lead with the outcome
  on one line, then one fact per bullet. Anything that needs several sentences
  belongs in a file (spec, follow-up, commit body, PR description), where
  prose is still correct.
- **Plain language first.** Say what breaks, what it means and why it matters
  before any `file:line` chain or type name. Say "throws" or "fails the build";
  never "loud-fail" or "eager-fail".
- **No gratuitous counting.** File counts, line counts and "every member of
  the set" enumerations are banned in replies, plans, audits and comments.
  Benchmarks, measured costs and thresholds a decision turns on stay, with
  their method.
- **Answer at the end of the turn.** Text before a tool call is swallowed by
  the harness. Do the tool work first, then reply in one text block with no
  tool calls beside it (AGENTS.md primary instruction 2).

## 3. Subagents, models and parallel runs

- **Before compaction, write a handoff** into the work's own journal folder —
  `.ai/refactoring/NNN-<slug>/` for a refactor, `.ai/bugfixes/NNN-<slug>/` for a
  fix, `.ai/feature-constitution/<domain>/<slug>/` for a feature — as
  `<date>-handoff.md`, untracked: where the run is, what is running and where
  its output lands, next steps in order, decisions made, accumulated user
  instructions, scratchpad paths. The handoff belongs beside the spec and plan
  it hands off, not in a directory of its own.
- **Working files go where the skill driving the work says**, which for every
  `superpowers:*` skill in this repo is that same journal folder — their
  upstream defaults under `docs/superpowers/` are overridden on every
  invocation, and a file left at the default is misplaced. Transient scratch
  (lane reports, TSVs, command output, commit-message files) goes under
  `.cache/claude-scratch/<lane>/`, never `/tmp`, which is RAM-backed on this
  WSL host and dies with the session.

## 4. Design rulings

- **Async-first.** When a function comes to depend on an async read, flip its
  signature to `Promise<…>`
- **Refactor first.** Before adding code, scan the touched area for
  duplication and fold it into a shared helper as part of the task.
- **Avoid generated runtime JSON** as a long-term ambition, not a hard rule.
  Prefer runtime providers reading the source over build-time snapshots read
  at runtime. Snapshots stay where they earn their keep (proxy and middleware
  hot paths); the real debt is N independent walker-plus-parser builders.
- **Audit dedup against the whole tree.** For every hand-rolled helper a
  diff introduces (regex, pool, walker, formatter, body parser), search
  `lib/`, `scripts/` and `app/` for an existing equivalent, not just the
  feature's siblings. Report "checked, legitimately new" beside the misses.
- **Dead is dead, whatever the doc says.** An unreachable branch kept "for
  extensibility" goes, even when a repo doc says "dormant, do not delete".
  Record the doc's scenarios in the refactor's spec and commit message, then
  delete the code, the guard and the doc. Knip convention:
  `docs/conventions/dead-code-sweep.md`.

## 5. Comments and docblocks

Four corrections enforced stricter than `docs/conventions/comment-policy.md`:

- **No archaeology, including comparative framing.** Not only "X removed" but
  "replaces `rehype-slug`", "mirrors the old contract", "now uses…". No
  absence annotations marking where something was deleted. When ripping out
  X, delete every comment mentioning X and describe the current state as if
  the code had always been this way.

### Test comments

- **Every Vitest phase is labelled.** Each `it` or `test` body gets
  `// Arrange`, `// Act`, `// Assert` above the first statement of each phase
  (`// Act & Assert` when one expression; absent phase, no label; the label
  is the whole comment). This is the user's override of Vitest's own guide.
  Written into `comment-policy.md` § Tests and `test-quality.md` P6.
- **Policy rules that do not fit tests get amended, not ignored**, and the
  amendment is grounded on the vendored Vitest docs.
- **Comment audits fix comments only.** Naming, fixture and structure
  findings are reported and filed to Jira in one batch; the lane never fixes
  them.

## 6. Tests

- **No test asserts against shipped production data** (learn-portal
  vocabulary rows, production `content/`).

## 7. Content corpus

- **Docs pages carry no version notes.** "Since version X" and upgrade
  effects go in a changelog entry under `content/changelog/_release-notes/`
  via `docs-write-xbyk-hotfix-notes` (fixes) or
  `docs-write-xbyk-release-notes` (features). The page states current
  behaviour only. Read `.ai/resources/styleguides/` before drafting prose.

## 8. Finishing a branch and deferred work

- **A workflow branch finishes on three things:** the `explainer.html`
  artifact published, the ADO PR opened, and a comment on the Jira task
  linking both. Publish the explainer first so the PR body and the Jira
  comment can carry its URL. The user reads the explainer instead of the
  diff.
- **Explainer shape:** a broad summary of the changes, then a simplified
  explainer, then a thorough walkthrough, then a question-and-answer section
  for the user to test their understanding. Written into
  `codebase-refactoring`, `codebase-analysis` and `feature-development`;
  `project-bugfixing` keeps its own older four-section contract.
- **Artifacts are public by default for this user.** Do not ask about
  visibility or caveat the link.
- **Deferred work is a standalone follow-up file**, never folded into a
  spec, plan, README or commit:
  `.ai/followups/<area>/<YYYYMMDD>-<slug>.md` in the main checkout
- **Follow-ups from a move wait for the new paths**, so their locators
  resolve.
- **When a run ends with a deferred-work list, ask which shape the user
  wants: follow-up files or Jira issues.** Recent runs asked for Jira
  (project DOC, the Nextjs epic, same component and label as the parent
  issue, written with post-refactor paths).

## 9. Tooling: ADO, Jira, Gemini, browser

### Gemini second opinions via `agy`

- `agy` (`~/.local/bin/agy`) runs Gemini 3.8 Flash headlessly; the model
  post-dates Claude's training data, so do not claim it does not exist.
  Invocation:
  `agy -p "$(cat prompt.txt)" --model <id> --mode plan --dangerously-skip-permissions --print-timeout 30m`,
  in the background.
- **Always `--mode plan --dangerously-skip-permissions`, even with every file
  pasted into the prompt.** Print mode cannot show a permission prompt, so a
  tool call is auto-denied and the run exits 0 having printed nothing;

### agent-browser

- `press Alt+r` delivers a proper keydown with the modifier set.
  `keydown Alt` followed by `keydown t` does not: `altKey` and `repeat` are
  always false. For autorepeat or modifier-hold checks, dispatch a synthetic
  `KeyboardEvent` via `eval --stdin` with the flags set, or rely on the
  Playwright e2e. `set media dark` did not flip the site theme.
