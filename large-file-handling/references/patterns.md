# Large File Handling — Detailed Patterns

Concrete examples for each output type. Read the pattern that matches your current task.

**Core rule: Never use bash heredocs for prose content.** The shell security scanner blocks natural language containing words like "kill", dollar signs, backticks, and other patterns. Use the `create` tool, `edit` tool, or Python file writes instead.

## Prose Chapters (v1.md, v2.md, v3.md)

Split at scene boundaries. Each scene or scene-sequel pair is one tool call.

### Method A: create + edit tools (preferred)

```
# Scene 1 — create the file
create tool → .afternoon/chapters/{chapterId}/v1.md
content: The road from Thalassian Pass wound through birch forest...
[~1,000–2,000 words of opening scene]
```

```
# Scene 2 — edit to append
edit tool → .afternoon/chapters/{chapterId}/v1.md
old_str: [last paragraph of scene 1]
new_str: [last paragraph of scene 1]

[~1,000–2,000 words of middle scene]
```

### Method B: Python file writes (for bash contexts)

```bash
python3 << 'PYEOF'
scene1 = """The road from Thalassian Pass wound through birch forest...
[~1,000–2,000 words]"""

with open('.afternoon/chapters/chapter-1/v1.md', 'w') as f:
    f.write(scene1)
PYEOF
```

```bash
python3 << 'PYEOF'
scene2 = """The village sat in a hollow between two ridges...
[~1,000–2,000 words]"""

with open('.afternoon/chapters/chapter-1/v1.md', 'a') as f:
    f.write(scene2)
PYEOF
```

### Split Points for Prose

Good split points (reader won't notice the seam):
- Scene breaks (location change, time jump, POV shift)
- Beat transitions (scene-sequel boundaries)
- Chapter section dividers (if using `***` or `---` breaks)
- After a paragraph that ends a sequence of action

Bad split points (seam shows):
- Mid-paragraph
- Mid-dialogue exchange
- Between a dialogue line and its action beat
- Between a setup sentence and its payoff

## JSON Plans (beat plans, configs)

Split JSON at logical group boundaries. Use Python for reliable JSON assembly:

```bash
python3 << 'PYEOF'
import json

plan = {
    "chapterId": "chapter-1",
    "metadata": { ... },
    "chapterBridge": None,
    "beats": [
        {"id": 1, ...},
        {"id": 2, ...},
        # ... all beats
    ]
}

with open('.afternoon/plans/chapter-1.json', 'w') as f:
    json.dump(plan, f, indent=2)
PYEOF
```

For very large JSON (many beats), build the structure in parts:

```bash
python3 << 'PYEOF'
import json

# Build beats in groups
beats = []

# Group 1
beats.extend([
    {"id": 1, "type": "scene", "text": "..."},
    {"id": 2, "type": "sequel", "text": "..."},
    {"id": 3, "type": "scene", "text": "..."},
])

# Group 2
beats.extend([
    {"id": 4, "type": "sequel", "text": "..."},
    {"id": 5, "type": "scene", "text": "..."},
])

plan = {"chapterId": "chapter-1", "beats": beats}
with open('.afternoon/plans/chapter-1.json', 'w') as f:
    json.dump(plan, f, indent=2)
PYEOF
```

### JSON Rules

- **Always validate** with `python3 -c "import json; json.load(open('file.json'))"` after writing
- Using Python's `json.dump()` guarantees valid JSON — no trailing comma issues
- Split beat construction into multiple `extend()` calls for very long beat lists

## Per-Entity Memory Files

Entity files are small (~2-5KB each) and don't need the append pattern. Write each entity with the `create` tool:

```
# Character profile JSON
create tool → .afternoon/plans/memory/characters/sylvanas-windrunner.json
content: {
  "name": "Sylvanas Windrunner",
  "slug": "sylvanas-windrunner",
  ...
}
```

```
# Character profile markdown
create tool → .afternoon/plans/memory/characters/sylvanas-windrunner.md
content: # Sylvanas Windrunner

The Ranger-General of Silvermoon...
```

Write one entity at a time. After all entities in a category, write the index:

```
create tool → .afternoon/plans/memory/characters/_index.json
content: {
  "entries": [
    { "name": "Sylvanas Windrunner", "slug": "sylvanas-windrunner", "aliases": ["the Ranger-General"], "firstAppearance": "chapter-1" },
    { "name": "Jaina Proudmoore", "slug": "jaina-proudmoore", "aliases": ["the mage"], "firstAppearance": "chapter-1" }
  ]
}
```

## Outline Sections

Outlines split naturally by act or phase. Use `create` for the first act, `edit` to append subsequent acts:

```
# Act 1 — create the file
create tool → .afternoon/outlines/{chapterId}.md
content: # Chapter 1: [Title]

## Act 1: [Name]
[beats 1-5]
```

```
# Act 2 — edit to append
edit tool → .afternoon/outlines/{chapterId}.md
old_str: [last beat of Act 1]
new_str: [last beat of Act 1]

## Act 2: [Name]
[beats 6-10]
```

```
# Act 3 — edit to append
edit tool → .afternoon/outlines/{chapterId}.md
old_str: [last beat of Act 2]
new_str: [last beat of Act 2]

## Act 3: [Name]
[beats 11-15]

## Notes
[any closing notes]
```

## Verification Commands

Always verify after completing a multi-section write:

```bash
# Prose: word count
wc -w .afternoon/chapters/{chapterId}/v1.md

# JSON: syntax validation
python3 -c "import json; json.load(open('.afternoon/plans/{chapterId}.json'))"

# Any file: line count
wc -l path/to/output-file.md

# Directory listing: verify all entity files written
ls -la .afternoon/plans/memory/characters/
```
