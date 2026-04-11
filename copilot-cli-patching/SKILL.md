---
name: copilot-cli-patching
description: Create, update, revert, and troubleshoot patches to the Copilot CLI baked-in system prompt (app.js). Use this skill whenever patching copilot's system prompt, adding a new replacement pair to patch-copilot-king.py or patch-copilot-writer.py, diagnosing why copilot stopped working after a patch, reverting a broken patch, or updating patches after `copilot update`. Also triggers on 'add a line to the patch', 'the patch broke copilot', 'copilot stopped working', 'update the system prompt', 'add to patch-copilot', 'revert the patch', 'copilot update broke things', 'why did copilot crash', 'SyntaxError in app.js', 'patch script', or any request to modify how the CLI agent behaves at the system-prompt level.
---

# Copilot CLI Patching

The two patch scripts (`patch-copilot-king.py`, `patch-copilot-writer.py`) inject custom system-prompt behavior into the Copilot CLI by replacing exact substrings in the minified `app.js` bundle. This lets you override the CLI's identity, persona, tool instructions, and output rules without forking the CLI itself.

Read `references/patch-anatomy.md` before writing new replacements.
Read `references/troubleshooting.md` when diagnosing a broken CLI.

---

## How the patch works

The CLI ships a minified JS bundle (`app.js`) that embeds its system prompt as string literals. The patch scripts find that file via two paths:

- **Cached versions**: `~/.cache/copilot/pkg/*/*/app.js` (auto-discovered by glob, sorted — all versions get patched)
- **Global npm install**: `/usr/local/lib/node_modules/@github/copilot/app.js` (requires `sudo` to write)

Each script defines a list of `(old_string, new_string)` replacement pairs that are applied as exact substring replacements. A patch marker string is used to detect whether a file is already patched and skip it.

---

## When to use which script

The two scripts are **mutually exclusive** — run only one at a time:

| Script | Persona | Use when |
|---|---|---|
| `patch-copilot-king.py` | Stephen King craft philosophy | Default pipeline persona |
| `patch-copilot-writer.py` | Explicit fantasy/erotic fiction writer | Explicit content runs |

---

## Commands

```bash
# Apply patch (normal user — patches cache, skips system install)
python3 patch-copilot-king.py

# Apply patch to system install too
sudo python3 patch-copilot-king.py

# Revert all patches from backup
python3 patch-copilot-king.py --revert

# Idempotent: revert if patched, no-op if already clean
python3 patch-copilot-king.py --ensure-unpatched

# Check what would change without writing anything
python3 patch-copilot-king.py --dry-run

# Verify patch is active in the running version
python3 -c "
content = open('/home/jakub/.cache/copilot/pkg/universal/1.0.12/app.js').read()
print('PATCHED' if 'Stephen King' in content or 'professional explicit fantasy' in content else 'CLEAN')
"

# Check copilot still starts after patching
/usr/local/bin/copilot --version
```

---

## Adding a new replacement pair

1. Find the exact string to replace by searching `app.js`:

```python
python3 -c "
content = open(sorted(__import__('glob').glob('/home/jakub/.cache/copilot/pkg/*/*/app.js'))[-1]).read()
idx = content.find('YOUR SEARCH TERM')
if idx >= 0:
    print(repr(content[max(0,idx-200):idx+300]))
"
```

2. Add the pair to `REPLACEMENTS` in the correct patch script. Follow the rules in `references/patch-anatomy.md`.

3. **Critical safety check before writing**: the new string must not contain any of these characters that break JS string parsing:
   - Backticks (`` ` ``) — these start JS template literals inside the string
   - Unescaped single quotes if the surrounding JS string uses single-quote delimiters
   - Dollar signs followed by `{` — these trigger JS template expression parsing

4. Test with `--dry-run` first, then apply and verify:

```bash
python3 patch-copilot-king.py --dry-run
python3 patch-copilot-king.py --revert && python3 patch-copilot-king.py
/usr/local/bin/copilot --version
```

---

## After `copilot update`

The update installs a new versioned directory. Patches on old versions still apply (the glob picks up all versions), but the new version starts unpatched. Run the patch script again — it auto-discovers the new version.

```bash
python3 patch-copilot-king.py
/usr/local/bin/copilot --version
```

---

## Subagent tool-availability reasoning loop fix

GPT 5.4 subagents sometimes enter a reasoning loop where they doubt they have file-write tools (20+ reasoning rounds, ~21K log lines per span). Three mitigations are in place:

1. **`subagentStart` hook** (`.github/hooks/subagent-context.json`) — injects a tool-availability statement into every subagent at spawn time before the first reasoning turn.
2. **Agent file anchors** — every pipeline agent with file-write duties has an explicit tool-list at the top: `"You have full tool access: create (new files), edit (modify files)..."`.
3. **Patch script workspace efficiency block** — the baked-in CLI workspace efficiency string now opens with a tool-availability line.

The hook is the strongest mitigation because it runs at the API context level before any model reasoning begins.

---

## Reference files

- `references/patch-anatomy.md` — Full anatomy of the replacement pair list, patch marker, path discovery, and the JS string escaping rules.
- `references/troubleshooting.md` — Diagnosis and recovery for common failure modes (SyntaxError, copilot not found, permission denied on system install, already-patched detection).
