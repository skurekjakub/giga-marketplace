# Patch Anatomy

Full reference for the structure of `patch-copilot-king.py` and `patch-copilot-writer.py`.

---

## Path discovery

```python
def find_app_js_paths():
    home = os.path.expanduser("~")
    paths = []
    cache_pattern = os.path.join(home, ".cache/copilot/pkg/*/*/app.js")
    paths.extend(sorted(glob.glob(cache_pattern)))          # all cached versions
    npm_path = "/usr/local/lib/node_modules/@github/copilot/app.js"
    if os.path.isfile(npm_path):
        paths.append(npm_path)                              # global install
    return paths
```

The glob picks up every cached version directory (e.g. `linux-x64/1.0.11/`, `universal/1.0.12/`). All get patched. The system install at `/usr/local/lib/` requires `sudo` because it's owned by root.

---

## Patch marker

```python
PATCH_MARKER = "expert fiction writer channeling Stephen King"
# (writer script uses: "professional explicit fantasy and erotic fiction writer")
```

Before applying replacements, the script checks for the marker. If found, the file is already patched and is skipped. This makes `python3 patch-copilot-king.py` idempotent on already-patched files.

---

## REPLACEMENTS list

Each entry is a `(old_string, new_string)` tuple. The patch logic applies them with `content.replace(old, new, 1)` — the `1` limits it to the first occurrence. **Each old string must appear exactly once in app.js** — if it appears 0 times it's silently skipped (counted in the "skipped" output), never zero-count-silently-fails.

### Current replacement slots (king patch, 13 total)

| # | What it replaces | Purpose |
|---|---|---|
| 1 | CLI identity preamble (first line) | Set persona |
| 2 | "interactive CLI tool" description | Set fiction mission |
| 3 | Feature advertise block (software tasks) | Replace with craft philosophy |
| 4 | Tool efficiency block | Replace with workspace efficiency + tool-availability line |
| 5 | Code change instructions | Replace with writing craft instructions |
| 6 | Linting/testing instructions | Replace with prose quality checks |
| 7 | Ecosystem tools line | Replace with scene library line |
| 8 | Style comment rule | Replace with narrator (limited third) rule |
| 9 | Quality/persistence closing | Replace with prose quality closing |
| 10 | Task completion block | Replace with chapter completion block |
| 11 | "Respond concisely" sign-off | Replace with "be expansive when writing prose" |
| 12 | "Your job is to perform the task" | Replace with "Your job is to write fiction" |
| 13 | (additional king-specific block) | Stephen King voice/craft addition |

---

## JS string escaping rules — CRITICAL

The replacement strings land inside minified JavaScript string literals. The surrounding delimiters and template literal markers are invisible in the Python source, but they govern what characters are safe.

### NEVER use in replacement strings

| Character | Why it breaks JS |
|---|---|
| Backtick (`` ` ``) | Ends the current JS template literal or starts a new one inside the string |
| `${` | Triggers JS template expression interpolation inside a template literal |
| Bare `\n` in Python non-raw strings | Must be `\\n` to produce a literal newline in the JS string |

### How this broke copilot

In this session, adding `` `create` ``, `` `edit` `` etc. to the workspace efficiency string caused:

```
SyntaxError: Unexpected identifier 'create'
```

The backticks ended/started template literal boundaries inside the already-minified JS code. The fix was removing all backticks from replacement strings.

### Safe alternatives

- Use plain names without delimiters: `create (new files)` not `` `create` (new files) ``
- Use apostrophes instead of backticks for emphasis: `'create'` is safer (if surrounding JS uses double quotes), but plain names are safest
- Unicode em-dash `—` is safe (it's tested and works)
- `\u2014` (Python unicode escape for —) is safe in Python string literals

---

## Backup and revert

Before writing, the script copies `app.js` to `app.js.bak` if no backup exists yet. The revert command copies `.bak` back over `app.js` and deletes the backup. This means:

- If you run `--revert` and the `.bak` is gone (never patched or already reverted), it skips with "no backup".
- The system install at `/usr/local/lib/` needs `sudo` for both patch and revert.

### State matrix

| `.bak` exists? | File patched? | State |
|---|---|---|
| No | No | Clean, never patched |
| No | Yes | Patched but backup lost — cannot revert safely |
| Yes | Yes | Patched, revertable |
| Yes | No | Already reverted but backup left behind |

---

## Adding a new replacement pair — step by step

1. **Find the string** in the actual bundle:

```python
python3 -c "
import glob
path = sorted(glob.glob('/home/jakub/.cache/copilot/pkg/*/*/app.js'))[-1]
content = open(path).read()
idx = content.find('your search term')
print(repr(content[max(0,idx-300):idx+400]))
"
```

2. **Verify it appears exactly once**:

```python
python3 -c "
import glob
path = sorted(glob.glob('/home/jakub/.cache/copilot/pkg/*/*/app.js'))[-1]
content = open(path).read()
print(content.count('your search term'), 'occurrences')
"
```

3. **Write the replacement tuple** in the `REPLACEMENTS` list. Use the section comment pattern to label it.

4. **Escape correctly**: no backticks, use `\\n` for newlines inside non-raw Python strings.

5. **Dry-run first**: `python3 patch-copilot-king.py --dry-run` — confirm the applied count increases by 1.

6. **Revert and re-apply**:
   ```bash
   python3 patch-copilot-king.py --revert
   python3 patch-copilot-king.py
   /usr/local/bin/copilot --version    # must print version, not SyntaxError
   ```
