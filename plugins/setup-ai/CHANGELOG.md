# Changelog

What changed in setup-ai for a repo that installed it. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are setup-ai's `plugin.json` version, which `.claude/setup-ai.json` records as
`setupAiVersion`. `status` lists the entries newer than the recorded version.

## [Unreleased]

### Deferred

- `diff` falls back to line counts when `git` is unavailable; it has no built-in unified diff.
- Adopting an equivalent under another path (`rubber-duk.md` for `rubber-duk-review.md`) never
  reports that the template moved since; `diff` shows the current difference on request.
- Changed arrays in `.claude/settings.json` are re-serialized whole (a one-line array the merge
  appends to becomes multi-line); arrays the merge doesn't touch keep their text.

## [0.3.0] - 2026-10-30

### Added

- **Skill extensions.** The dev-workflow skills and the `rubber-duk-*` agents read an optional
  `<AI_DIR>/skill-extensions/<name>.md` and apply its `rules`, `scope`, `before-dispatch`,
  `verify` and `finish` sections at the matching points. Repo-specific rules live there instead
  of in the rendered skill, so `update` no longer conflicts on them. Render never writes, records
  or deletes anything in that folder.
- **Adopt.** `plan` lists `existing` repo files a template would land on — same path, or an
  equivalent elsewhere (`.claude/agents/rubber-duk.md`, a hook with an extension, a
  `comment-policy.md` / `commit-and-pr-format.md` / `gotchas.md` anywhere). `render --adopt
  <paths|all>` records them as the baseline without touching them; `status` reports them as
  `adopted`, `remove` keeps them, and `--update` raises one again only when its template changed.
- **`diff` command.** Per conflicting or adoptable file: the unified diff from the repo's file to
  the template, line counts, and `wouldDrop` — lines referencing paths, skills or files the
  template never mentions.
- **Path tokens** `CONVENTIONS_DIR`, `COMMENT_POLICY_PATH`, `PR_GUIDE_PATH`, `GOTCHAS_PATH`
  (defaults are the previous hard-coded paths, applied automatically, so existing installs render
  unchanged) and a global `STYLE_GUIDE_DIR`. `detect` infers them from the repo's own documents.
- `detect`: `existing` workspace files, `flags.existingWorkspace`, `flags.content`,
  `vendoredDuplicates` (skills in `.claude/skills/` that a plugin of this marketplace ships), and
  `placeholderSuggestions`.
- Values file `placeholders`: fills `{{PascalCase}}` skeleton placeholders at render (recorded,
  so updates keep them); `plan` and `render` list candidates for the rest under `todos`.
- baseline option `rulesImport`: import the working rules from `AGENTS.md` instead of
  `CLAUDE.md`; the default in a repo with an AGENTS.md and no CLAUDE.md, where no CLAUDE.md is
  created.
- review-agents: `rubber-duk-post`, a prose reviewer for posts, docs, specs and root-cause
  records (default when the repo holds MDX or content Markdown).
- hooks: `require-commit-format` (a `git commit` with one `-m`, `gh pr create --fill`) and
  `rtk-read-compact` (large JS/TS reads compacted with `rtk read`), both off by default.
- `prereqs --update`: refreshes the marketplaces the packs' plugins come from (and setup-ai's own)
  and updates installed plugins at project scope, run from the repo's directory.
- The install record stores `setupAiSource` (marketplace and git commit when determinable);
  `status` shows it with `changelog`, the entries of this file newer than the recorded version.

### Changed

- `render` refuses when an option the chosen packs declare is unset (`missingOptions`) instead of
  rendering it as "none"; `--defaults` takes `optionDefaults`. `remove`'s re-render uses the
  defaults for options a record predates.
- `.claude/settings.json` and `.mcp.json` are edited in place: unchanged members keep their text
  (comment keys, blank lines, one-line arrays), the file's indentation is kept, and a merge that
  changes nothing writes nothing.
- A hook script the repo already wires — under any matcher, through any command spelling such as
  a `run-hook.cmd <name>` wrapper — is not added a second time.
- The Bash guard hooks (`block-destructive-bash`'s git rules, `prefer-verify-script`,
  `require-commit-format`) let through commands that run outside `$CLAUDE_PROJECT_DIR` (a leading
  `cd <dir> &&`, or `git -C <dir>`). `rm -rf /` stays blocked everywhere.
- `project-context` injects AGENTS.md only when a CLAUDE.md exists and doesn't import it.

## [0.2.3] - 2026-10-28

Baseline for this changelog: packs `baseline`, `hooks`, `review-agents`, `dev-workflow`,
`issue-tracking`, `tech-writing`; commands `catalog`, `detect`, `plan`, `prereqs`, `render`,
`status`, `remove`, `vendor`, `session-check`.
