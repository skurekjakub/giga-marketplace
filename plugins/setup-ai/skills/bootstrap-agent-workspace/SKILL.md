---
name: bootstrap-agent-workspace
description: >-
  Use when the user wants the agent workspace set up in the current repository, or added to, updated, repaired, inspected or removed — "bootstrap this repo", "set up the agent workspace", "setup-ai", "install the review agents", "add the dev workflow", "set up hooks", "vendor the templates", "update the setup-ai templates", "repair the workspace", "what did setup-ai install", "remove the hooks pack", "uninstall setup-ai" — or when a setup-ai session-start notice asks for an update or repair.
argument-hint: "[install | add | update | repair | status | remove]"
---

# Bootstrap an agent workspace

You are the installer wizard. The deterministic work — rendering files, merging settings,
installing plugins and third-party skills, recording what was installed — is done by the
engine; your job is to ask the right questions, in the right order, and to never write
anything the user hasn't agreed to.

```bash
ENGINE="${CLAUDE_SKILL_DIR}/../../scripts/workspace.mjs"
node "$ENGINE" <command> --dest <repo root> [--packs a,b] [--values <values.json>]
```

Every engine command prints one JSON document. Read it; don't paraphrase it from memory.
[`references/engine.md`](references/engine.md) has each command's input and output.

**Node.js is a hard requirement** (the engine, and `npx skills` for third-party skills,
which needs Node ≥ 22.20). Check `node --version` first. If Node is missing, stop and tell
the user how to install it for their platform — nothing else in this skill works without it.

## Rules

- **Nothing is written before the user has picked packs, confirmed prerequisites and
  confirmed the values.** `plan` and `render --dry-run` write nothing; use them freely.
- **Never overwrite a file the user has.** Conflicts are resolved one by one with the user.
- **Never write a secret.** API tokens and passwords stay `${VAR}` references; tell the user
  where to set them and let them do it.
- **Never commit.** Offer to at the end.
- Ask with `AskUserQuestion`. It takes up to four questions per call and two to four options
  per question — split longer lists across questions, and put the recommended option first
  with "(Recommended)" in its label.
- Keep the values file outside the repository — your scratchpad, or the OS temp directory as
  `setup-ai-<repo folder name>-values.json` — and delete it when the run ends. Its shape:
  `{ "tokens": { "NAME": "value" }, "options": { "key": value }, "placeholders": { "PascalName": "value" } }`.
- **Repo-specific rules never go into a rendered skill or agent.** They go into
  `<AI_DIR>/skill-extensions/<skill-or-agent-name>.md` (see **Skill extensions** below), which
  the engine never writes — so the next `update` doesn't conflict on them.

## 0. Pick the mode

Run `detect`. If `flags.installed` is true, the repo was bootstrapped before
(`.claude/setup-ai.json` exists): run `status` and, unless the user already said what they
want, ask which of **add** (more packs), **update** (re-render with newer templates),
**repair** (reinstall missing prerequisites and files) or **remove** (uninstall packs) —
recommending what `status.suggest` names — and jump to that section below. A question about
what is installed is **status**. Otherwise it's **install** — and when
`flags.existingWorkspace` is true the repo already has hand-made agents, hooks, skills or
convention docs, so step 6 runs as **adopt** for every file the templates would land on.

## Install

### 1. Detect

`detect` returns the package manager, scripts, framework flags (next, react, vitest,
playwright, tailwind, ado, content, …), inferred token values and a stack profile guess. Keep
it — it's the source of every default you offer. Also read:

- **`existing`** — the agents, hooks, skills and convention docs (comment policy, PR/commit
  guide, gotchas, style guides) the repo already has. Tell the user in one line that you'll
  offer to adopt them rather than overwrite them.
- **`vendoredDuplicates.duplicates`** — skills copied into `.claude/skills/` that a plugin of
  this marketplace ships (`id`). A copy drifts from the plugin and shadows it. For each, ask:
  **replace with the plugin (Recommended)** — install `id` at project scope with `prereqs`
  semantics (`claude plugin install <id> --scope project`, run from the repo), move any
  repo-specific notes the copy carries (read it; `git log -p` on it shows what was added
  locally) into a project file such as `<AI_DIR>/skill-extensions/<skill>.md`, then delete the
  folder — or **keep the copy**. When `available` is false the marketplace couldn't be found
  from the engine's location; say so and skip this.
- **`placeholderSuggestions`** — candidates for skeleton placeholders; used in step 5.

### 2. Pick packs

Run `catalog` and ask a multi-select, with the packs `detect` suggests pre-marked as
recommended. Six packs don't fit one question — ask two:

- **Core:** `baseline`, `hooks`, `review-agents`, `dev-workflow`
- **Extras:** `issue-tracking`, `tech-writing`

Use each pack's `title` as the label and its `summary` as the description.

### 3. Resolve dependencies and options

**Offer a verify script first.** When `detect.proposals.verifyScript` is set, the repo has
two or more quality gates and no `verify`/`check`/`ci` script, so `VERIFY_CMD` would be the
gates chained with `&&`. Ask one question, before the options:

- **Add `"verify": "<command>"` to package.json (Recommended)** — one name for agents, hooks
  and CI to run. Put `"packageScripts": { "verify": "<command>" }` in the values file and
  set the `VERIFY_CMD` token to the proposal's `verifyCmd`.
- **Use the chained command** — nothing is added; `VERIFY_CMD` is the `&&` chain.

Ask it before the options because the answer changes their defaults (the
`prefer-verify-script` hook is on by default only with a verify script).

Run `plan --packs <chosen>` (no values yet, or the values file with `packageScripts`).
From its output:

- **`pulledIn`** — packs added because a chosen pack requires them. Tell the user in one
  line; don't ask.
- **`recommended`** — offer them in one multi-select question; add what the user picks and
  re-run `plan`.
- **`options`** — one question per option, defaults from `optionDefaults`. A `multi` option
  with more than four choices is split into several questions. A `single` option with a
  `defaultFrom: detect` default (the stack profile) says what was detected.

Write the answers into the values file's `options`. Every key in `missingOptions` needs an
answer: `render` refuses while one is unset, because an unset `hooks` or `agents` would
otherwise install none. (`--defaults` takes `optionDefaults` for all of them — only when the
user said "use the defaults".) In a repo with an `AGENTS.md` and no `CLAUDE.md`,
`rulesImport` defaults to `agents-md`: the working rules are imported from AGENTS.md and no
CLAUDE.md is created.

### 4. The prerequisite gate

Run `plan --packs <chosen> --values <file>` and read `prerequisites`. Show the user **one
list** of everything the chosen packs need, grouped, each with its status and its `why`:

- **Claude Code plugins** (`plugins[]`) — installed at project scope.
- **Third-party skills** (`vendorSkills[]`) — installed with `npx skills` into
  `.claude/skills/`, plus the Node ≥ 22.20 requirement (`node`).
- **Command-line tools** (`clis[]`) — can't be installed by the engine; give the install
  command for the user's platform (for example `winget install jqlang.jq`, `brew install
  jq`, `sudo apt install jq`).
- **Environment variables** (`env[]`) — secrets the user sets themselves.

Then ask one yes/no question: *"These packs need the prerequisites above. Install them and
continue?"*

- **No** → stop. Say that nothing was written, and which pack needs which prerequisite, so
  they can come back with a smaller selection.
- **Yes** → carry on to the values. The installs themselves run in step 7, right before the
  render, so a user who stops at the values or conflicts has nothing half-installed.
  Meanwhile:
  1. Missing CLIs: show the install command, suggest the user run it with the `!` prefix,
     and re-run `plan` to confirm before rendering.
  2. Missing env vars: tell the user to add them to the git-ignored
     `.claude/settings.local.json` under `"env"` (or their shell profile), never to a
     committed file. They are needed at runtime, not to render — continue, and repeat the
     reminder in the final checklist.

### 5. Collect the values

Re-run `plan` and read `missingTokens`. Every token has a `prompt`, and usually an
`inferred` (from `detect`) or `default` value. Tokens whose value can be looked up are
looked up rather than asked (for example `JIRA_CLOUD_ID`: `curl -s
https://<JIRA_SITE>/_edge/tenant_info` → `cloudId`; `DEFAULT_BRANCH` from git). A default
that references another token (`{{AI_DIR}}/…`) is resolved with that token's value.

Confirm them with the user in batches: up to four tokens per `AskUserQuestion` call, each
question offering the inferred value as the first option and "Other" for their own. Nothing
is rendered until `missingTokens` is empty.

A token has exactly three sources: what `detect` inferred, the catalog `default`, or the
user's answer. When none of the three gives a value — the user can't answer, won't, or said
"don't ask me" — drop the packs or options that need that token (`firstUsedIn` names them),
tell the user which and why, and install the rest. A made-up value (`TODO_…`, `CHANGE_ME`,
`example.com`, a guessed project key) renders a broken skill; the engine rejects the
placeholder-shaped ones as missing. If `plan` reports `invalidOptions`, fix the option
values before continuing.

**Paths.** `defaultedTokens` lists path tokens (`CONVENTIONS_DIR`, `COMMENT_POLICY_PATH`,
`PR_GUIDE_PATH`, `GOTCHAS_PATH`) that took their catalog default because the values file
doesn't set them. When an entry's `inferred` differs from its `value`, the repo already keeps
that document elsewhere: ask, with the inferred path first, and write the answer into
`tokens` — the templates then point at the repo's own file instead of creating a second one.

**Skeleton placeholders.** Once `missingTokens` is empty, `plan` lists `todos`: `{{PascalCase}}`
placeholders left in the rendered files, with `suggestions` per placeholder. For each one that
has suggestions, ask with the suggestions as the first options and "Leave for later"; put
answers into the values file's `placeholders` (`{ "ReferenceComponentPath": "…" }`). The
engine fills them at render and records them, so an update keeps them.

### 6. Existing files: adopt, overwrite, or carry over

Re-run `plan` and read `existing`: every file a template would land on — `how: same-path`
(the file exists and differs) or `how: equivalent` (the repo does the same job under another
path: `.claude/agents/rubber-duk.md` for `rubber-duk-review.md`, a hook with an extension,
a convention doc of the same name elsewhere). For those, run

```bash
node "$ENGINE" diff --dest <repo> --packs <chosen> --values <file> [--files p1,p2] [--summary]
```

and, per file, show the user `stats`, a short summary of the diff, and **`wouldDrop`** —
lines of their file that reference paths, skills or files the template never mentions (the
repo-specific rules an overwrite would lose). Then ask, per file:

- **Keep mine (adopt)** — the repo's file stays and is recorded as the baseline; later
  `status` reports it as `adopted` and `update` raises it again only when its template
  changes. Collect into `--adopt path1,path2` (the template path, `dest`).
- **Overwrite and carry over (Recommended when `wouldDrop` is not empty and the file is a
  skill or agent)** — before the render, write the `wouldDrop` lines (and anything else in
  the diff the user wants kept) into `<AI_DIR>/skill-extensions/<skill-or-agent>.md` under the
  matching point heading (see **Skill extensions**); show the user that file; then collect
  the path into `--overwrite`.
- **Overwrite** — the template replaces it. Collect into `--overwrite`.

A convention doc (comment policy, PR guide, stack profile) has no extension point: offer keep
or overwrite only. With nothing in `existing`, there is nothing to ask.

### 7. Install prerequisites, then render

1. `prereqs --packs <chosen> --values <file>` installs the plugins (adding their
   marketplaces first) and the third-party skills. Report each step's result; a failed step
   is shown with its error and the user decides whether to continue. Plugins and MCP servers
   installed now load in the **next** session; say so.
2. `render --packs <chosen> --values <file> [--overwrite …] [--adopt …]`. It writes the
files, appends to `CLAUDE.md` (or `AGENTS.md`) and `.gitignore`, adds the accepted
`packageScripts` to `package.json`, merges `.claude/settings.json` (hooks,
`enabledPlugins`, `extraKnownMarketplaces` — editing the file in place, and never adding a
hook script the repo already wires) and `.mcp.json`, and records the install in
`.claude/setup-ai.json`.

### 8. Verify and report

- `errors` must be empty — a leftover `{{UPPER}}` token is a bug to fix, not a to-do.
- Delete the values file.
- `git status --short` shows only the files the render reported.
- Report, as a short checklist:
  - what was installed (packs, agents, skills, hooks, MCP servers) and where;
  - `todos` — skeleton placeholders (`{{PascalCase}}`) the user fills in, per file;
  - `manualSteps` from the packs;
  - env vars still to set, CLIs still to install;
  - "start a new session so the new plugins, hooks, agents and MCP servers load";
  - that `.claude/setup-ai.json` should be committed with the rest, and an offer to commit.

## Add

Same as install, but the pack question lists only packs not in `.claude/setup-ai.json`, and
the values file starts from the record's `tokens` and `options` so nothing is asked twice.
Render the recorded packs **and** the new ones together, with `--update`: files of the
existing packs that switch on sections for the new pack (the working rules, the workflows)
are refreshed where the user hasn't edited them, and edited ones come back as conflicts.

## Update

1. **Say what changed.** `status` returns `changelog` — setup-ai's entries newer than the
   recorded version — and `setupAiSource` (recorded vs available marketplace commit). Summarize
   the entries in a few bullets before asking anything.
2. **Refresh the marketplace and plugins.** `prereqs --update --packs <recorded> --values
   <file> --dry-run` lists the `claude plugin marketplace update` and `claude plugin update …
   --scope project` steps; after a yes, run it without `--dry-run`. The engine runs them from
   the repo's directory — a project-scope update run from anywhere else updates a different
   project. If you run one by hand, `cd` into the repo first.
3. **Re-render.** Build the values file from the record (`tokens`, `options`, `placeholders`),
   then `render --update --packs <recorded packs> --values <file> --dry-run`. New tokens a
   newer template needs show up in `missingTokens` and new options in `missingOptions`; ask for
   those only. Files the user hasn't edited since the last render are replaced; edited ones
   come back as `conflicts`. Run `diff` for them and handle each as in install step 6 (adopt,
   overwrite and carry over, overwrite). Then render for real with `--update` and the chosen
   `--overwrite` / `--adopt` lists.

## Repair

`vendor check` and `plan --packs <recorded> --values <from record>`; show what's missing;
after a yes, `vendor restore` and `prereqs`. Then re-render with `--update` only if files
the record lists are missing.

## Status

`status` writes nothing. Summarize it for the user:

- packs with their recorded and available versions (`outdated`), and `notInstalled`;
- the setup-ai version recorded vs available, and the `changelog` entries in between;
- files: the counts, then every `edited`, `missing` and `adopted` file by name;
- `packageScripts` setup-ai added and whether they still match;
- prerequisites that aren't satisfied on this machine;
- the modes in `suggest`, as the next step to offer.

## Remove

1. Run `status` and ask which installed packs to remove (a multi-select).
2. `remove --packs <chosen> --dry-run`. If it fails with `dependents`, a pack that stays
   requires one being removed: tell the user which, and ask whether to remove it too or keep
   both.
3. Show the dry run as one list: files to delete; lines to take out of appended files, and
   files that go because nothing else is left in them; hooks leaving
   `.claude/settings.json`; MCP servers leaving `.mcp.json`; files of the remaining packs
   that are re-rendered (`rerender.written`) or would conflict (`rerender.conflicts`).
4. For each path in `files.keptEdited` (edited since it was rendered), ask: keep it, or
   delete it anyway. Collect the deletes into `--delete-edited path1,path2`.
5. If `vendorSkillsNoLongerRequired` is not empty, ask whether to delete those skills
   (`--prune-vendor-skills`).
6. Ask one yes/no question to go ahead. On yes, run `remove` without `--dry-run` and with
   the chosen flags. On no, stop — nothing was changed.
7. `pluginsNoLongerRequired`: list each with its `uninstall` command and ask per plugin —
   it may be in use outside these packs. Run only the ones the user says yes to.
8. Report what was removed and what was kept (`files.keptAdopted` are the repo's own files
   and always stay), and offer **update** for any `rerender.conflicts`. Offer to commit.

## Skill extensions

The dev-workflow skills (`feature-development`, `project-bugfixing`, `codebase-refactoring`,
`codebase-analysis`) and the `rubber-duk-*` agents read
`<AI_DIR>/skill-extensions/<skill-or-agent-name>.md` when it exists. It is the repo owner's
file — the engine never writes, records or deletes anything in that folder — so it survives
every `update`. Its sections, all optional:

```markdown
## rules            <!-- bind the whole run -->
## scope            <!-- paths and areas the work never touches -->
## before-dispatch  <!-- carried into every subagent brief, e.g. "subagents run on opus or sonnet" -->
## verify           <!-- gates beyond VERIFY_CMD -->
## finish           <!-- steps before the commit: CHANGELOG entry, commit-message format -->
```

Agents apply the whole file. Write one when the user asks for a repo-specific rule in a
workflow or agent, and when carrying over in step 6; keep each bullet one rule, pointing at
the repo file that holds the detail (`see .ai/shared/commit-and-pr-format.md`) rather than
copying it.

## Red flags — stop

- About to write, append or install before the prerequisite gate was answered "yes".
- A token value nobody inferred, defaulted or answered.
- About to write a token value that is a secret into any file.
- A `render` result with `errors`, reported as done.
- Overwriting a conflicting file without the user's explicit choice, or with `wouldDrop`
  lines the user never saw.
- About to add a repo-specific rule to a rendered skill or agent instead of its
  skill-extensions file.
- Passing `--defaults` the user didn't ask for.
- Deleting an edited file, or uninstalling a plugin, without the user's explicit choice.
- Editing `package.json` other than through `packageScripts` the user accepted.
- Guessing a value `detect` didn't infer and the user wasn't asked about.
