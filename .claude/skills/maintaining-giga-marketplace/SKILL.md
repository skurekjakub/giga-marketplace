---
name: maintaining-giga-marketplace
description: >-
  Use when adding, changing, moving or removing anything in the giga-marketplace repo — a skill, agent, hook, plugin, setup-ai template pack, pack.json, template file, marketplace.json entry, or the workspace.mjs engine — or when deciding whether something new belongs in a plug-and-play plugin or in a setup-ai template pack.
---

# Maintaining giga-marketplace

Two kinds of content, one rule each: **plug-and-play plugins** run straight from the
installed plugin and reference nothing outside it; **setup-ai template packs** are copied
into a target repo and filled in there. Nothing in either may name a specific project,
company or person.

## Layout

| Path | What |
|---|---|
| `.claude-plugin/marketplace.json` | One entry per plugin: `name`, `source: ./plugins/<name>`, `description`, `category`, `tags` |
| `plugins/{agent-architecture,research-planning,copilot-cli,npm-maintenance}/` | Plug-and-play: `.claude-plugin/plugin.json` + `skills/<skill>/SKILL.md` (+ `references/`, `scripts/`) |
| `plugins/setup-ai/scripts/` | Node engine (no npm deps): `workspace.mjs` is the CLI entry (`catalog`, `detect`, `plan`, `prereqs`, `render`, `status`, `remove`, `vendor`, `session-check`); `lib/` shared modules (templating, packs, settings, prerequisites, vendor skills, detection); `commands/` one module per command; `test/` the `node:test` suite |
| `plugins/setup-ai/hooks/hooks.json` | SessionStart → `node …/workspace.mjs session-check` (exec form) |
| `plugins/setup-ai/skills/bootstrap-agent-workspace/` | The one wizard skill that drives the engine |
| `plugins/setup-ai/templates/placeholders.json` | Global `{{TOKENS}}` shared by all packs |
| `plugins/setup-ai/templates/packs/<pack>/` | `pack.json` + `files/**` mirroring target-repo paths |
| `.gitattributes` | `* text=auto eol=lf` — bash hooks break on CRLF |

## Where does it go?

| The thing… | Goes in |
|---|---|
| Works in any repo as-is, reads only its own plugin's files | An **existing** plug-and-play plugin whose domain fits; a new plugin only when none does |
| Needs repo paths, commands, stack rules, tracker keys, or will be edited per repo | A setup-ai template pack (existing pack if it fits, else a new pack) |
| An agent, a hook, a convention doc, a workflow with a journal folder | A template pack — these always end up repo-specific |
| Third-party skill (`npx skills`) or another marketplace's plugin | Never vendored here — declare it in a pack's `requires` |

## Plug-and-play changes

- New plugin: `plugins/<name>/.claude-plugin/plugin.json` (`name`, `version`, `description`, `author` `{name: skurekj, email: skurekjakub@gmail.com}`, `keywords`) **and** a marketplace entry whose `description`/`tags` match it. Change one, change both.
- Bump the plugin's `version` (semver minor for new skills, patch for fixes) on every content change.
- Frontmatter `description` is always a folded scalar — `description: >-` then the text indented. A plain scalar containing `: ` silently parses to empty metadata. It starts with "Use when…" and lists triggers only — no "Walks through…"/"Covers…" sentence, or agents follow the summary instead of the skill.
- Bundled scripts: invoke via interpreter and `${CLAUDE_SKILL_DIR}` (`node ${CLAUDE_SKILL_DIR}/x.mjs`); `${CLAUDE_PLUGIN_ROOT}` for plugin-wide files.
- Skills in other plugins are named `plugin:skill` (`research-planning:iterative-research`).

## Template pack changes

REQUIRED: read `references/pack-format.md` before touching `pack.json`, `files/**`, `placeholders.json` or `detect()`. Bump the pack's `version` on every change — `session-check` tells bootstrapped repos to update when it moves — and bump `setup-ai`'s `plugin.json` version with it. Adding or removing a pack also means editing the pack list in setup-ai's `plugin.json` description **and** its marketplace entry.

Either kind: keep the plugin/pack catalog in `README.md` in step.

## Before every commit

Run all of these; paste failures, don't summarize them.

```bash
claude plugin validate .                          # marketplace manifest
for p in plugins/*; do claude plugin validate "$p"; done   # manifests + skill frontmatter
node --test plugins/setup-ai/scripts/test/*.test.mjs   # engine suite (also syntax-checks every module)
for h in plugins/setup-ai/templates/packs/hooks/files/dot-claude/hooks/*; do bash -n "$h"; done
```

Pack or engine touched → also the smoke test in `references/pack-format.md` § Verify.

Commit on a branch, never `master`. Message: imperative subject, bullet body of what and why, ending with a `Co-Authored-By: <your model> <noreply@anthropic.com>` trailer in the format `git log` shows. Stage only your own paths — others may have work in progress.

## Red flags — stop

- A new plugin created while an existing one covers the domain
- `marketplace.json` and a `plugin.json` disagreeing on description or name
- A version not bumped after a content change
- `description:` without `>-`
- A plug-and-play skill pointing at `.ai/`, `docs/conventions/`, or any path its plugin doesn't ship
- A hook that exits 0 when its input can't be parsed
- Skipping `claude plugin validate` because "JSON.parse passed"
