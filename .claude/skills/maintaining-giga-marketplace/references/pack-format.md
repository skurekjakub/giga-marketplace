# setup-ai pack format

The engine is `plugins/setup-ai/scripts/workspace.mjs`; this file describes what it reads.
When they disagree, the engine wins — fix this file.

## `pack.json`

```jsonc
{
  "name": "review-agents",            // == folder name
  "version": "0.1.0",                 // bump on every change (session-check compares it)
  "title": "…", "summary": "…",       // shown in the wizard's pack menu
  "requires": {
    "packs": ["review-agents"],       // auto-pulled in by resolvePacks()
    "plugins": [{ "id": "frontend-design@claude-plugins-official",
                  "marketplace": { "name": "claude-plugins-official", "repo": "anthropics/claude-plugins-official" },
                  "when": "option:agents=rubber-duk-frontend", "why": "…" }],
    "vendorSkills": [{ "source": "vercel-labs/agent-skills", "skills": ["web-design-guidelines"], "when": "…", "why": "…" }],
    "cli": [{ "name": "jq", "when": "…", "why": "…", "optional": false }]
  },
  "recommends": ["hooks"],            // offered, not forced
  "options": {
    "hooks":   { "type": "multi",  "prompt": "…", "choices": [{ "value": "…", "label": "…", "description": "…", "default": true }, { "value": "…", "defaultWhen": "detect:prettier" }] },
    "profile": { "type": "single", "prompt": "…", "defaultFrom": "detect", "key": "profile", "choices": [ … ] }
  },
  "tokens": { "PACK_TOKEN": { "prompt": "…", "default": "…", "infer": "…" } },   // pack-only tokens
  "fileConditions": { "dot-claude/hooks/notify-done": "option:hooks=notify-done" }, // path-prefix → condition
  "appends": [{ "to": "CLAUDE.md", "text": "@{{AI_DIR}}/agent-working-rules.md", "create": "# {{PROJECT_NAME}}\n\n", "when": "…" }],
  "settings": { "hooks": { "PreToolUse": [{ "@when": "option:hooks=x", "matcher": "Bash", "hooks": [ … ] }] } }
}
```

- `requires.plugins` → the wizard installs them at project scope and `render` writes `enabledPlugins` (+ `extraKnownMarketplaces` for non-official marketplaces) into the target's `.claude/settings.json`.
- `requires.vendorSkills` → `npx skills add <source> --skill … -a claude-code -y --copy` (Node ≥ 22.20). `--skill` takes the SKILL.md `name:`, not the folder.
- `requires.cli` → only checked and reported (plan, session-check); nothing installs CLIs. On `platform:win32`, `bash` means Git Bash.
- The wizard shows the merged prerequisites of the chosen packs and asks yes/no before installing anything; no aborts the install.
- `appends` add text once (skipped when already present) — use them for files the user already owns (`CLAUDE.md`, `.gitignore`). Never ship those as `files/`.
- `settings` is deep-merged; user values win; `@when` entries are dropped when false and empty arrays pruned.

## `files/**`

- Mirrors the target repo. `dot-claude/` → `.claude/`. That is the **only** dot-directory remapped (`destRel()`); a new `dot-<x>` needs an engine change there, never a literal dot folder.
- Path segments may hold tokens: `files/{{AI_DIR}}/reminders.md`.
- Existing target files are never overwritten — `render` reports a conflict; `--overwrite` / `--update` decide.

## Markers inside files

| Marker | Meaning |
|---|---|
| `{{UPPER_SNAKE}}` | Filled at install from `values.tokens`. Left over = render error. Missing ones show in `plan.missingTokens`. |
| `{{PascalCase}}` / `{{camelCase}}` | Placeholder the user fills later — reported as a to-do, never an error |
| `<!-- @if cond -->` … `<!-- @endif -->` | Line-based conditional block (nestable). `# @if cond` / `# @endif` in shell/YAML. |
| `> **Template skill — fill in before use.** …` | Stripped at install (the whole blockquote) |
| `> **Adapt me.** …` | Kept — tells the repo owner to edit the installed file |

`${{ github.expr }}` (with spaces) is left alone — only unspaced `{{NAME}}` is a token.

**Condition grammar:** `pack:<name>` · `option:<key>` (non-empty) · `option:<key>=<value>` (multi: contains) · `profile:<name>` · `detect:<flag>` · `platform:win32`. `!` negates a term, `+` ands, `|` ors (`+` binds tighter): `detect:vitest+option:agents=rubber-duk-tests`.

## Tokens and detection

- A token used by more than one pack goes in `templates/placeholders.json` (`prompt`, `default`, `infer`). Pack-only tokens go in that pack's `tokens`.
- A new `detect:<flag>` or inferred token value means editing `detect()` in `workspace.mjs` — it must stay cheap and read-only (package.json, lockfiles, git remote, a few `exists` checks).

## Hooks

- Vendored hook = extensionless bash in `files/dot-claude/hooks/`, wired as `{ "type": "command", "shell": "bash", "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/<name>\"" }` under an `@when` choice of `options.hooks`, plus its `fileConditions` entry.
- Plugin-level hooks (setup-ai's own) use exec form: `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/…"]` — no shell needed.
- Read payloads with `jq`; a guard must not fail open without it (see `block-destructive-bash`'s raw-payload fallback). Deny = exit 2 with the reason on stderr.

## Verify

```bash
S=$(mktemp -d) && git -C "$S" init -q && echo '{"name":"t","scripts":{"test":"vitest run"}}' > "$S/package.json"
W=plugins/setup-ai/scripts/workspace.mjs
node $W catalog                                              # pack appears, JSON parses
node $W plan   --dest "$S" --packs <pack> --values v.json    # missingTokens, prerequisites, file plan
node $W render --dest "$S" --packs <pack> --values v.json    # ok: true, errors: []
grep -rnE '\{\{[A-Z][A-Z0-9_]*\}\}' "$S" --exclude-dir=.git  # must print nothing
node $W render --dest "$S" --packs <pack> --values v.json    # second run: unchanged, no overwrite
```

For a hook, also pipe a payload in and check the exit code:
`echo '{"tool_input":{"command":"git push --force"}}' | bash "$S/.claude/hooks/block-destructive-bash"; echo $?` → `2`.
