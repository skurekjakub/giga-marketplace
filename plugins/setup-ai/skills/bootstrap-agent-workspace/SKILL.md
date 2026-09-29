---
name: bootstrap-agent-workspace
description: >-
  Set up (or add to, update, repair) an agent workspace in the current repository from the setup-ai template packs — working rules, guard-rail hooks, rubber-duk review agents, feature/bugfix/refactor/analysis workflows, Jira filing and QA, tech-writing skills. Asks what to set up, checks and installs each pack's prerequisites (plugins, npx skills, CLIs, MCP servers) after a yes/no confirmation, fills the templates with the repo's specifics, merges settings, and reports what's left to do. Use when the user says "bootstrap this repo", "set up the agent workspace", "install the review agents", "add the dev workflow", "set up hooks", "vendor the templates", "setup-ai", "update the setup-ai templates", or "repair the workspace" — or when a session-start notice from setup-ai asks for an update or repair.
argument-hint: "[install | add | update | repair]"
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
- Keep the values file outside the repository (your scratchpad, or the OS temp directory).
  Its shape: `{ "tokens": { "NAME": "value" }, "options": { "key": value } }`.

## 0. Pick the mode

Run `detect`. If `flags.installed` is true, the repo was bootstrapped before
(`.claude/setup-ai.json` exists): unless the user already said what they want, ask which of
**add** (more packs), **update** (re-render with newer templates) or **repair** (reinstall
missing prerequisites) — and jump to that section below. Otherwise it's **install**.

## Install

### 1. Detect

`detect` returns the package manager, scripts, framework flags (next, react, vitest,
playwright, tailwind, ado, …), inferred token values and a stack profile guess. Keep it —
it's the source of every default you offer.

### 2. Pick packs

Run `catalog` and ask a multi-select, with the packs `detect` suggests pre-marked as
recommended. Six packs don't fit one question — ask two:

- **Core:** `baseline`, `hooks`, `review-agents`, `dev-workflow`
- **Extras:** `issue-tracking`, `tech-writing`

Use each pack's `title` as the label and its `summary` as the description.

### 3. Resolve dependencies and options

Run `plan --packs <chosen>` (no values yet). From its output:

- **`pulledIn`** — packs added because a chosen pack requires them. Tell the user in one
  line; don't ask.
- **`recommended`** — offer them in one multi-select question; add what the user picks and
  re-run `plan`.
- **`options`** — one question per option, defaults from `optionDefaults`. A `multi` option
  with more than four choices is split into several questions. A `single` option with a
  `defaultFrom: detect` default (the stack profile) says what was detected.

Write the answers into the values file's `options`.

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
- **Yes** →
  1. `prereqs --packs <chosen> --values <file>` installs the plugins (adding their
     marketplaces first) and the third-party skills. Report each step's result; a failed step
     is shown with its error and the user decides whether to continue.
  2. Missing CLIs: show the install command, suggest the user run it with the `!` prefix,
     and re-run `plan` to confirm before continuing.
  3. Missing env vars: tell the user to add them to the git-ignored
     `.claude/settings.local.json` under `"env"` (or their shell profile), never to a
     committed file. They are needed at runtime, not to render — continue, and repeat the
     reminder in the final checklist.
  4. Plugins and MCP servers installed now load in the **next** session; say so.

### 5. Collect the values

Re-run `plan` and read `missingTokens`. Every token has a `prompt`, and usually an
`inferred` (from `detect`) or `default` value. Tokens whose value can be looked up are
looked up rather than asked (for example `JIRA_CLOUD_ID`: `curl -s
https://<JIRA_SITE>/_edge/tenant_info` → `cloudId`; `DEFAULT_BRANCH` from git). A default
that references another token (`{{AI_DIR}}/…`) is resolved with that token's value.

Confirm them with the user in batches: up to four tokens per `AskUserQuestion` call, each
question offering the inferred value as the first option and "Other" for their own. Nothing
is rendered until `missingTokens` is empty.

### 6. Dry run and conflicts

`render --dry-run --packs <chosen> --values <file>`. For each path in `conflicts` (the file
already exists and differs), ask: keep theirs, or overwrite with the template. Collect the
overwrites into `--overwrite path1,path2`.

### 7. Render

`render --packs <chosen> --values <file> [--overwrite …]`. It writes the files, appends to
`CLAUDE.md` and `.gitignore`, merges `.claude/settings.json` (hooks, `enabledPlugins`,
`extraKnownMarketplaces`) and `.mcp.json`, and records the install in
`.claude/setup-ai.json`.

### 8. Verify and report

- `errors` must be empty — a leftover `{{UPPER}}` token is a bug to fix, not a to-do.
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

## Update

Build the values file from the record (`tokens`, `options`), then `render --update --packs
<recorded packs> --values <file> --dry-run`. Files the user hasn't edited since the last
render are replaced; edited ones come back as `conflicts` — show the user what differs
(`git diff --no-index` against a temp render, or read both) and ask per file. Then render for
real with `--update` and the chosen `--overwrite` list. New tokens a newer template needs
show up in `missingTokens`; ask for those only.

## Repair

`vendor check` and `plan --packs <recorded> --values <from record>`; show what's missing;
after a yes, `vendor restore` and `prereqs`. Then re-render with `--update` only if files
the record lists are missing.

## Red flags — stop

- About to write, append or install before the prerequisite gate was answered "yes".
- About to write a token value that is a secret into any file.
- A `render` result with `errors`, reported as done.
- Overwriting a conflicting file without the user's explicit choice.
- Guessing a value `detect` didn't infer and the user wasn't asked about.
