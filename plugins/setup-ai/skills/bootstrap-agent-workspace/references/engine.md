# workspace.mjs — command reference

`node workspace.mjs <command> --dest <repo> [--packs a,b] [--values v.json] [flags]`.
Every command prints one JSON document on stdout; `ok: false` carries `error`.

| Command | Writes | Returns |
|---|---|---|
| `catalog` | nothing | `version`, `packs[]` (name, title, summary, version, requires, recommends, options, tokens, todo), `globalTokens` |
| `detect` | nothing | `packageManager`, `scripts`, `flags` (next, react, vue, svelte, vite, vitest, jest, playwright, tailwind, typescript, eslint, prettier, ado, github, npmrcCooldown, claudeMd, agentsMd, claudeSettings, installed, verifyScript, content, existingWorkspace), `tokens` (inferred, path tokens included), `options` (profile), `proposals.verifyScript` ({script, command, verifyCmd} or null), `suggestedPacks`, `existing` {agents, hooks, skills, commentPolicy, prGuides, gotchas, styleGuides, conventionsDirs, workingRules}, `vendoredDuplicates` {available, marketplace, duplicates [{skill, plugin, id, path}]}, `placeholderSuggestions` {Name: [candidates]} |
| `plan` | nothing | `packs` (dependency order), `pulledIn`, `recommended`, `options`, `optionDefaults`, `missingOptions`, `defaultedOptions`, `prerequisites` {plugins, vendorSkills, clis, env, node, allSatisfied}, `missingTokens` [{token, prompt, default, inferred, firstUsedIn}], `defaultedTokens` [{token, value, inferred, prompt}], `manualSteps`, `packageScripts` {added, kept}, `files` [{dest, action}], `conflicts`, `existing` [{dest, pack, file, how: same-path\|equivalent}], `todos` [{file, placeholders, suggestions}] — `files`, `existing` and `todos` only once no token or option is missing |
| `diff` | nothing (a temp render, deleted unless `--keep`) | `files` [{dest, file, how, action, stats {added, removed}, diff, wouldDrop [{line, text, refs}]}], `tempDir` |
| `prereqs` | project settings (plugins), `.claude/skills/` (vendor skills), `skills-lock.json` — nothing with `--dry-run` | `results` per step ({step, cwd, ok}; the commands, with `--dry-run`), `prerequisites` after |
| `render` | the pack files, appends, `package.json` scripts, `.claude/settings.json`, `.mcp.json`, `.claude/setup-ai.json` | `written`, `unchanged`, `conflicts`, `adopted` [{dest, file}], `appended`, `packageScripts`, `settings`, `mcp`, `errors`, `todos`, `manualSteps`; fails with `missingTokens` / `missingOptions` |
| `status` | nothing | `installed`; when true: `setupAiVersion` {recorded, available}, `setupAiSource` {recorded, available}, `changelog` [{version, date, text}], `packs` [{name, version, available, outdated}], `notInstalled`, `options`, `files` {counts, edited, missing, adopted}, `packageScripts`, `prerequisites`, `suggest` (modes) |
| `remove` | deletes the packs' unedited files; edits appended files, `.claude/settings.json`, `.mcp.json`, the record; re-renders the rest — nothing with `--dry-run` | `files` {deleted, keptEdited, keptAdopted, alreadyGone}, `appends`, `settings`, `mcp`, `pluginsNoLongerRequired` [{id, uninstall}], `vendorSkillsNoLongerRequired`, `record`, `rerender` {written, conflicts}; fails with `dependents` when a remaining pack requires a removed one |
| `vendor check` / `install` / `restore` | `.claude/skills/`, `skills-lock.json` | per-skill status / per-source results |
| `session-check` | nothing (a rate-limit stamp in the plugin data dir when auto-restoring) | a SessionStart `additionalContext` notice, or nothing |

## Flags

- `render --dry-run` — compute everything, write nothing.
- `render --overwrite a,b` (or `all`) — replace these conflicting files.
- `render --adopt a,b` (or `all`) — template paths (`dest`) whose existing repo file — at the
  same path, or the equivalent `plan.existing` names — is kept and recorded as the baseline.
- `render --update` — replace files whose on-disk hash still matches the record (the user
  didn't edit them); edited files are conflicts.
- `render` / `plan` `--defaults` — options the values leave unset take `optionDefaults`.
  Without it, `render` refuses while `missingOptions` is non-empty.
- `diff --files a,b` — only these template paths; `--summary` leaves the diff text out;
  `--context n` sets the unified-diff context; `--keep` keeps the temp render.
- `prereqs --update` — first `claude plugin marketplace update <name>` for the marketplaces the
  packs' plugins come from (and setup-ai's own), then `claude plugin update <id> --scope
  project` for each installed one — all run with the repo as the working directory.
- `remove --dry-run` — report what would be deleted and changed.
- `remove --delete-edited a,b` (or `all`) — also delete these files although they were edited.
- `remove --prune-vendor-skills` — delete third-party skills no remaining pack needs, and
  their `skills-lock.json` entries.

`remove` never uninstalls plugins or touches `enabledPlugins` — the plugin install wrote
those, and they may be used outside these packs; it lists them with the uninstall command.
A `package.json` script setup-ai added stays until the last pack goes, and only if unchanged.
Adopted files are the repo's own and are never deleted.

## File actions in `plan` / `render`

`create` (new), `unchanged` (identical), `update` (record hash matches, replaced),
`overwrite` (named in `--overwrite`), `adopt` (named in `--adopt`: recorded, not written),
`adopted` (adopted earlier and kept — a same-path one turns back into `conflict` once its
template renders differently from when it was adopted), `conflict` (exists, differs, not
overwritten).

## Settings merge

`.claude/settings.json` and `.mcp.json` are edited in place: members the merge doesn't change
keep their exact text (comment keys such as `"//"`, blank lines, one-line arrays), changed
subtrees are re-serialized in the file's own indentation, and a merge that changes nothing
writes nothing. A pack hook is skipped when the same event already runs that hook script —
recognised by the `.claude/hooks/<name>` it runs, also through a `run-hook.cmd <name>` wrapper.

## Values

```json
{
  "tokens": { "PROJECT_NAME": "shop", "AI_DIR": ".ai", "VERIFY_CMD": "npm run verify", "COMMENT_POLICY_PATH": ".ai/comment-policy.md" },
  "options": { "profile": "nextjs", "rulesImport": "claude-md", "hooks": ["block-destructive-bash"], "agents": ["rubber-duk-review"] },
  "packageScripts": { "verify": "npm run lint && npm run test && npm run build" },
  "placeholders": { "ReferenceComponentPath": "src/components/Button.tsx" }
}
```

A token referenced by a file the chosen packs and options would write must have a value, or
`render` refuses (`missingTokens`). Path tokens marked `autoDefault` in `placeholders.json`
(`CONVENTIONS_DIR`, `COMMENT_POLICY_PATH`, `PR_GUIDE_PATH`, `GOTCHAS_PATH`) take their
default when unset and are listed in `plan.defaultedTokens`. Every option the chosen packs
declare must be set (`missingOptions`), or `render` refuses unless `--defaults`.
`placeholders` fill `{{PascalCase}}` skeleton placeholders and are recorded. `packageScripts`
are added to `package.json` only where the name is free; an existing script is reported under
`kept` and never replaced.

## Install record

`.claude/setup-ai.json`: `setupAiVersion`, `setupAiSource` {marketplace, commit}, `packs`,
`options`, `tokens`, `placeholders`, `plugins`, `vendorSkills`, `appends`, `packageScripts`,
and `files` {path: {pack, hash[, adopted]}} — `adopted` names the repo file kept in place of
the template. Nothing under `<AI_DIR>/skill-extensions/` is ever recorded or written.
