# workspace.mjs — command reference

`node workspace.mjs <command> --dest <repo> [--packs a,b] [--values v.json] [flags]`.
Every command prints one JSON document on stdout; `ok: false` carries `error`.

| Command | Writes | Returns |
|---|---|---|
| `catalog` | nothing | `packs[]` (name, title, summary, version, requires, recommends, options, tokens, todo), `globalTokens` |
| `detect` | nothing | `packageManager`, `scripts`, `flags` (next, react, vue, svelte, vite, vitest, jest, playwright, tailwind, typescript, eslint, prettier, ado, github, npmrcCooldown, claudeMd, agentsMd, claudeSettings, installed, verifyScript), `tokens` (inferred), `options` (profile), `suggestedPacks` |
| `plan` | nothing | `packs` (dependency order), `pulledIn`, `recommended`, `options`, `optionDefaults`, `missingOptions`, `prerequisites` {plugins, vendorSkills, clis, env, node, allSatisfied}, `missingTokens` [{token, prompt, default, inferred, firstUsedIn}], `manualSteps`, `files` [{dest, action}], `conflicts` |
| `prereqs` | project settings (plugins), `.claude/skills/` (vendor skills), `skills-lock.json` — nothing with `--dry-run` | `results` per step (the commands, with `--dry-run`), `prerequisites` after |
| `render` | the pack files, appends, `.claude/settings.json`, `.mcp.json`, `.claude/setup-ai.json` | `written`, `unchanged`, `conflicts`, `appended`, `settings`, `mcp`, `errors`, `todos`, `manualSteps` |
| `vendor check` / `install` / `restore` | `.claude/skills/`, `skills-lock.json` | per-skill status / per-source results |
| `session-check` | nothing (a rate-limit stamp in the plugin data dir when auto-restoring) | a SessionStart `additionalContext` notice, or nothing |

## Flags

- `render --dry-run` — compute everything, write nothing.
- `render --overwrite a,b` (or `all`) — replace these conflicting files.
- `render --update` — replace files whose on-disk hash still matches the record (the user
  didn't edit them); edited files are conflicts.

## File actions in `plan` / `render`

`create` (new), `unchanged` (identical), `update` (record hash matches, replaced),
`overwrite` (named in `--overwrite`), `conflict` (exists, differs, not overwritten).

## Values

```json
{
  "tokens": { "PROJECT_NAME": "shop", "AI_DIR": ".ai", "VERIFY_CMD": "npm run verify" },
  "options": { "profile": "nextjs", "hooks": ["block-destructive-bash"], "agents": ["rubber-duk-review"] }
}
```

A token referenced by a file the chosen packs and options would write must have a value, or
`render` refuses (`missingTokens`). Options not given default to nothing — ask for every key
in `missingOptions`.
