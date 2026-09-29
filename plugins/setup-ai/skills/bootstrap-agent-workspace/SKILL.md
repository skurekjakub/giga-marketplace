---
name: install-tech-writing-skills
description: >-
  Scaffold customizable tech-writing skills into a project or personal skills directory. Use when the user wants to set up, install, or scaffold documentation/tech-writing skills — release notes writing, hotfix notes writing, docs-vs-source validation, or draw.io diagram authoring — for their product or docs repository. Trigger on phrases like 'set up tech writing skills', 'install the release notes skill', 'scaffold docs skills', 'add documentation skills to this repo'.
---

# Install Tech-Writing Skills

This plugin ships four tech-writing skills as **templates** with `{{...}}` placeholders. They cannot run from the plugin itself — this skill installs them: copy the chosen templates into the user's skills directory, fill in the product-specific placeholders, and strip the template scaffolding.

The templates live in the `templates/` directory at the **plugin root** — resolve it relative to this skill's base directory as `<base-dir>/../../templates/`.

## Available templates

| Template | Installed skill's job | Placeholders to collect |
|---|---|---|
| `docs-write-release-notes` | Write user-facing release notes / changelog entries | `PRODUCT_NAME`, `DOCS_LINK_SYNTAX`, `RELEASE_NOTES_PATH` |
| `docs-write-hotfix-notes` | Write "Fixed issues" changelog entries from tickets | `PRODUCT_NAME`, `CHANGELOG_URL`, `RELEASE_NOTES_PATH`, `CATEGORIES_FILE_PATH` |
| `docs-source-validation` | Validate docs claims against the product source repo | `PRODUCT_NAME`, `SOURCE_REPO_PATH`, `SOURCE_REPO_URL`, `DEFAULT_BRANCH`, `TEST_DIR` (+ `SOLUTION_OR_ENTRY_POINT`, `TECH_STACK`, `REPO_NAME` in its solution map) |
| `docs-create-drawio-diagram` | Author editable `.drawio.svg` diagrams for docs pages | `ASSETS_ROOT`, `STYLE_GUIDE_PATH`, `EXAMPLE_DIAGRAM_PATH`, `ELEMENT_COLOR`, `CONNECTOR_COLOR`, `BRAND_FONT`, `MARKDOWN_SYNTAX_REF` |

Each template documents what its placeholders mean in the blockquote table at the top of its `SKILL.md` — read it before interviewing the user.

## Workflow

### 1. Choose skills

Ask which templates to install (multi-select — all four is a fine default for a docs repo). Skip any the user's product obviously can't use.

### 2. Choose destination

Ask where to install:

- **Project skills** — `.claude/skills/` in the current repo (recommended: versioned and shared with the team)
- **Personal skills** — `~/.claude/skills/` (available in every project, but only for this user)

If a chosen skill already exists at the destination, **ask before overwriting** — never silently replace it.

### 3. Collect placeholder values

Before asking, **infer what you can from the current repository** and present inferred values for confirmation instead of asking cold:

- Docs/changelog directory layout → `RELEASE_NOTES_PATH`, `ASSETS_ROOT`
- Existing style guides or syntax docs → `STYLE_GUIDE_PATH`, `MARKDOWN_SYNTAX_REF`
- Git remotes and sibling checkouts → `SOURCE_REPO_URL`, `SOURCE_REPO_PATH`, `DEFAULT_BRANCH`
- README / package metadata → `PRODUCT_NAME`

Ask about the rest. Collect every placeholder for every chosen template before writing anything — partial installs leave broken skills behind.

### 4. Install

For each chosen template:

1. Copy the template folder from `templates/` to the destination (including subdirectories — `references/`, `scripts/`).
2. Replace every `{{TOKEN}}` occurrence with the collected value — exact token replacement only, do not reword surrounding prose.
3. Delete the leading "**Template skill — fill in before use**" blockquote (the whole block including its placeholder table) from each installed `SKILL.md`.
4. Leave the inline "Template note" blockquotes (e.g., above the Examples sections) in place — they mark work the user still owns.

### 5. Point out what remains manual

Tell the user what the installer cannot do for them:

- **Replace the generic examples** in `docs-write-release-notes` and `docs-write-hotfix-notes` with real entries from their changelog — the examples anchor the voice.
- **Fill out `docs-source-validation/references/solution-map.md`** — it installs as a skeleton. If the source repo is available locally, **offer to generate the map now** by exploring the repo structure (with the user's consent — it's a large read).
- **Create the categories file** at `CATEGORIES_FILE_PATH` if it doesn't exist yet (`docs-write-hotfix-notes` hard-depends on it).
- **Confirm the style guide and example diagram exist** at the paths given for `docs-create-drawio-diagram`.

### 6. Verify

Grep the installed files for `{{`:

- In `SKILL.md` files, **nothing** may remain — a leftover token means a missed value; fix it.
- In `solution-map.md`, skeleton placeholders (`{{AreaName}}`, `{{path}}`, etc.) legitimately remain until the map is filled out — list them to the user as remaining work, don't fail on them.

Report what was installed, where, and the remaining manual steps as a short checklist.
