# Large Artifact Handling

Agents running in the Copilot CLI have a hard timeout per tool call. When a subagent writes a large artifact using the `create` tool (or any single-call file write), the write can timeout if the content exceeds ~5–10KB — killing the agent mid-write and producing a corrupt or truncated file.

This is the single most common cause of agent timeout failures in production pipelines. Any subagent that produces artifacts that grow with input size (chapter prose, detailed plans, memory files, analysis reports, aggregated inventories) is vulnerable.

## The Problem

| Artifact size | Risk | Example |
|---|---|---|
| < 5KB | Safe | Status files, short summaries, small JSON configs |
| 5–15KB | Medium | Beat plans, review reports, short chapters |
| 15–50KB | High | Full chapters, detailed outlines, memory files at chapter 5+ |
| 50KB+ | Critical | Assembled multi-chapter documents, comprehensive inventories |

The risk compounds with context length. An agent that has consumed 50KB of input before writing is more likely to timeout than one that consumed 5KB — the model is slower to generate when the context window is fuller.

## The Solution: Bash Heredoc Append

Split large writes into multiple bash heredoc calls. Each call resets the CLI timeout clock.

### Pattern

```bash
# First section — create/overwrite
cat << 'SECTION_END' > path/to/output.md
... first chunk of content ...
SECTION_END

# Subsequent sections — append
cat << 'SECTION_END' >> path/to/output.md

... next chunk of content ...
SECTION_END

# More sections as needed...
cat << 'SECTION_END' >> path/to/output.md

... final chunk of content ...
SECTION_END
```

**Key rules:**
- First call uses `>` (create/overwrite). All subsequent calls use `>>` (append).
- Use single-quoted delimiters (`'SECTION_END'`) to prevent shell variable expansion.
- Split at **natural boundaries** — scene breaks, section headers, JSON array groups, schema boundaries. Not mid-sentence or mid-object.
- Each bash call should produce ~1,000–3,000 words of prose or ~5–15KB of structured data.
- After the final append, verify the file: `wc -w` for prose, `python3 -c "import json; json.load(open('file.json'))"` for JSON.

### For Prose Artifacts (chapters, outlines, reports)

Split at scene boundaries, act breaks, or section headers. Each bash call writes one scene or section:

```bash
# Scene 1
cat << 'CHAPTER_SECTION' > .pipeline/chapters/ch01/v1.md
... opening scene prose ...
CHAPTER_SECTION

# Scene 2
cat << 'CHAPTER_SECTION' >> .pipeline/chapters/ch01/v1.md

... middle scene prose ...
CHAPTER_SECTION

# Scene 3
cat << 'CHAPTER_SECTION' >> .pipeline/chapters/ch01/v1.md

... closing scene prose ...
CHAPTER_SECTION

# Verify
wc -w .pipeline/chapters/ch01/v1.md
```

### For Structured Data (JSON plans, inventories, matrices)

Split at array element boundaries. Ensure valid JSON after concatenation:

```bash
# Opening structure + first batch
cat << 'JSON_SECTION' > .pipeline/plans/chapter-01.json
{
  "chapterId": "ch01",
  "metadata": { ... },
  "beats": [
    { "id": "beat-01", ... },
    { "id": "beat-02", ... },
JSON_SECTION

# Middle batch (watch the commas!)
cat << 'JSON_SECTION' >> .pipeline/plans/chapter-01.json
    { "id": "beat-03", ... },
    { "id": "beat-04", ... },
JSON_SECTION

# Final batch + closing
cat << 'JSON_SECTION' >> .pipeline/plans/chapter-01.json
    { "id": "beat-05", ... }
  ]
}
JSON_SECTION

# Validate
python3 -c "import json; json.load(open('.pipeline/plans/chapter-01.json'))"
```

### For Growing Files (memory, inventories that accumulate across chapters)

Files that grow with each pipeline run have two strategies:

**Strategy 1: Split per-entity** (preferred for memory/inventory files). Instead of one `characters.md` that grows unbounded, split into one file per entity:

```
.pipeline/memory/characters/
├── _index.json              # Lightweight roster for discovery
├── alice.json + alice.md    # ~2-5KB each, forever
└── bob.json + bob.md
```

Each entity file stays small. The memory-keeper only reads/writes entities that appeared in the current run. Consumers read the index for scanning, then load individual profiles by slug.

**Strategy 2: Append within monolith** (fallback — only use when entity splitting genuinely doesn't apply, e.g., a linear log or a single prose chapter). Use per-entry splitting once the file exceeds ~10KB:

```bash
# Example: a prose chapter split at scene boundaries (NOT for memory/inventory files — use Strategy 1)
cat << 'SECTION' > .pipeline/output/chapter-01.md
... scene 1 ...
SECTION

cat << 'SECTION' >> .pipeline/output/chapter-01.md

... scene 2 ...
SECTION
```

Prefer Strategy 1 for any file that accumulates entries across pipeline runs. It solves both the write-side timeout problem AND the read-side context pollution problem. Strategy 2 only solves write-side timeouts — readers still load the full monolith.

## When to Apply This Pattern

Ask these questions during architecture design:

1. **Does any subagent write prose artifacts?** (chapters, reports, outlines) → Almost certainly needs append pattern.
2. **Does any subagent write structured data that grows with input?** (beat plans, inventories, analysis matrices) → Needs append pattern once input exceeds ~20 items.
3. **Does any subagent aggregate output from multiple upstream agents?** (scribes, assemblers, report writers) → Aggregated output can be very large.
4. **Do any artifacts grow across pipeline runs?** (memory files, continuity ledgers, cumulative inventories) → Eventually needs append pattern even if small initially.

If the answer to ANY of these is yes, the agent's output section must include the bash heredoc append pattern with domain-appropriate splitting guidance.

## Context Bloat: The Read Side

Large files are also dangerous on the **read** side. An agent that reads 500KB of input before writing anything will be slow and prone to "Lost in the Middle" attention degradation (Liu et al. 2023).

Mitigations for the read side:

| Strategy | When to use |
|---|---|
| **Targeted reads** | Agent runs multiple passes — read only the reference files relevant to each pass, not all of them |
| **JSON-first** | Both `.md` and `.json` versions exist — read the compact `.json` for structured lookups, `.md` only when narrative context is needed |
| **Single-read sources** | Agent extracts different categories from the same source — read once at startup, work from context |
| **Progressive loading** | Agent has phases — read phase-specific content just-in-time via workflow skills, not all at once |

## Naming Convention

Each pipeline names its append pattern for the agent's role. This aids debugging and makes agent prompts self-documenting:

| Agent role | Pattern name | Splitting unit |
|---|---|---|
| Outline builder | Stonemason's Method | Per-act sections |
| Prose writer | Bricklayer's Method | Per-scene chunks |
| AI pattern editor | Exterminator's Method | Per-pass sections |
| Style editor | Plating Method | Per-scene sections |
| Memory keeper | Archivist's Method | Per-entry splits |
| Plan verifier | Scribe's Method | Metadata + beat groups |
| Report writer | Compositor's Method | Per-section |
| Inventory builder | Surveyor's Method | Per-domain groups |

The name doesn't matter technically — it's a mnemonic that tells the agent "you know how to do this, here's how." Pick a name that fits the agent's persona or role.
