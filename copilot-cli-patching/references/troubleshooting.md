# Troubleshooting

Diagnosis and recovery for common Copilot CLI patch failures.

---

## Copilot stopped working after patching

### Symptom: `SyntaxError: Unexpected identifier 'X'`

```
Failed to load package index: ...index.js SyntaxError: Unexpected identifier 'create'
```

**Cause**: A replacement string contains a backtick. Backticks inside JS minified string literals end/start template literals and break the parser.

**Fix**:
1. Revert immediately: `python3 patch-copilot-king.py --revert`
2. Verify copilot works: `/usr/local/bin/copilot --version`
3. Find the offending replacement pair — search for backtick characters in any `new_string` in `REPLACEMENTS`
4. Remove backticks: replace `` `create` `` with `create`, etc.
5. Re-apply: `python3 patch-copilot-king.py`
6. Verify again: `/usr/local/bin/copilot --version`

---

### Symptom: `Cannot find GitHub Copilot CLI`

```
Cannot find GitHub Copilot CLI (https://docs.github.com/...)
Install GitHub Copilot CLI? ['y/N']
```

**Cause**: The `copilot` command in PATH resolves to the VS Code shim (`~/.config/Code/User/globalStorage/github.copilot-chat/copilotCli/copilot`), which wraps VS Code Electron, not the system install. The shim may be broken independently of the patch.

**Diagnosis**:
```bash
which copilot                    # shows which binary is found
/usr/local/bin/copilot --version # test system install directly
```

**Fix**: If `/usr/local/bin/copilot --version` works, the system install is fine — the shim is misconfigured or VS Code's extension is broken. Not a patch issue.

---

### Symptom: `node:sqlite ERR_UNKNOWN_BUILTIN_MODULE`

```
Error [ERR_UNKNOWN_BUILTIN_MODULE]: No such built-in module: node:sqlite
```

**Cause**: The system Node.js version is too old for `node:sqlite` (requires Node ≥21). This is a version mismatch between the CLI and the system Node, unrelated to patching.

**Diagnosis**: `node --version` — if < v21, this is the cause.

**Fix**: The Copilot CLI uses bundled Node via the VS Code Electron runtime, not system Node. Run via `/usr/local/bin/copilot` (uses the npm-loader which picks the right runtime) rather than invoking `node app.js` directly.

---

### Symptom: `PermissionError: [Errno 13] Permission denied`

```
PermissionError: [Errno 13] Permission denied: '/usr/local/lib/node_modules/@github/copilot/app.js'
```

**Cause**: The system install is owned by root.

**Fix**: Run with `sudo` for the system install path. The cached paths under `~/.cache/` don't need sudo.

```bash
python3 patch-copilot-king.py          # patches ~/.cache/ versions (no sudo needed)
sudo python3 patch-copilot-king.py     # also patches /usr/local/lib/ version
```

---

### Symptom: 0 replacements applied (all skipped)

```
DRY   /path/to/app.js: 0 replacements would apply, 13 not found
```

**Cause**: Either the file is already patched (will say "already patched" instead), or `copilot update` installed a new version that changed the string literals the patch targets.

**Diagnosis**:
```python
python3 -c "
import glob
path = sorted(glob.glob('/home/jakub/.cache/copilot/pkg/*/*/app.js'))[-1]
content = open(path).read()
# Check the first replacement target
print('found' if 'You are the GitHub Copilot CLI, a terminal assistant built by GitHub.' in content else 'NOT FOUND - strings may have changed')
print('patched marker present:', 'Stephen King' in content or 'professional explicit fantasy' in content)
"
```

**Fix**: If the CLI was updated, find the new string values for each changed replacement and update the `REPLACEMENTS` list. The old strings will be in SKIP count — find which ones are missing by checking each `old` string manually.

---

### Symptom: patched with wrong script (erotic writer on king slot)

```
SKIP  /path/to/app.js (patched with erotic writer — revert that first)
```

**Fix**:
```bash
python3 patch-copilot-writer.py --revert   # revert writer patch
python3 patch-copilot-king.py              # apply king patch
```

---

## After `copilot update`

The update creates a new versioned directory alongside the old ones. All old patched versions remain patched. The new version starts clean.

```bash
# Check what versions exist
ls ~/.cache/copilot/pkg/

# Re-run the patch — it picks up all versions including the new one
python3 patch-copilot-king.py

# Verify the new version is patched
/usr/local/bin/copilot --version   # should print version without error
```

---

## Verify patch content is correct

Check any specific string landed correctly:

```python
python3 -c "
import glob
path = sorted(glob.glob('/home/jakub/.cache/copilot/pkg/*/*/app.js'))[-1]
content = open(path).read()
search = 'never debate tool availability'
idx = content.find(search)
if idx >= 0:
    print(repr(content[max(0,idx-100):idx+200]))
else:
    print('NOT FOUND in', path)
"
```
