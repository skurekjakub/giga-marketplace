---
name: docs-create-drawio-diagram
description: Create or edit draw.io diagrams for docs pages and save them as editable .drawio.svg assets under {{ASSETS_ROOT}}. Use this skill whenever the user asks for a diagram, flowchart, architecture overview, process/upgrade-path visual, or any .drawio / .drawio.svg file — creating a new one, restyling an existing one, or changing boxes/arrows/labels in a diagram embedded on a docs page — even if they don't say "draw.io" explicitly. Also use it when a task involves reading the diagram source out of an existing .drawio.svg asset.
---

> **Template skill — fill in before use.** Replace every `{{...}}` placeholder with your docs repo's specifics (search for `{{` to find them all), then delete this block. The workflow and scripts are generic; only the paths and house style are yours to define.
>
> | Placeholder | Meaning |
> |---|---|
> | `{{ASSETS_ROOT}}` | Root directory for docs image assets (e.g., `public/assets`) |
> | `{{STYLE_GUIDE_PATH}}` | Your diagram style guide (shape libraries, palette, font) |
> | `{{EXAMPLE_DIAGRAM_PATH}}` | A reference diagram in the house style |
> | `{{ELEMENT_COLOR}}` / `{{CONNECTOR_COLOR}}` | Brand colors for shapes and connectors |
> | `{{BRAND_FONT}}` | The font your diagrams reference |
> | `{{MARKDOWN_SYNTAX_REF}}` | Doc describing your docs platform's image/asset syntax |

# Create draw.io diagrams

Author diagrams as **mxGraphModel XML**, then render them into a `.drawio.svg`
with the bundled export script. One file serves both purposes: browsers render
the SVG body, and the drawio editor opens the XML source embedded in the root
`<svg content="...">` attribute. Never ship a static PNG/JPG export — the next
person to touch the diagram needs the editable source.

## Gate — Python is mandatory

Both scripts are Python. **Hard gate**: run this before authoring any XML.

```bash
python3 --version || python --version || py -3 --version
```

**If none answer**, stop and tell the user the skill needs Python, offering to
install it — **never install without their explicit consent**:

```bash
winget install --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements  # Windows
brew install python@3.12                                                                       # macOS
sudo apt-get install -y python3                                                                # Debian/Ubuntu
```

If they point at an interpreter elsewhere, use that path throughout. If they
decline, **stop — the skill cannot continue.** Never hand-write the SVG body
instead: it is exporter output, and hand-authored markup silently diverges
(wrong label nesting, missing `requiredFeatures` probes, dead `content=`
payloads that no longer open in the editor).

Chrome needs no gate — the export script takes it from PATH, else the
Playwright cache, else `npx playwright install chromium`.

## Where the file goes

`{{ASSETS_ROOT}}/<collection>/<page-slug>/<diagram-name>.drawio.svg`

The directory tree of the source page is dropped — only the collection name and
the page's final slug are used, the same `(collection, page-slug)` convention
every other asset tag resolves against (see `{{MARKDOWN_SYNTAX_REF}}`).
Create the directory if it doesn't exist. Adapt this section if your docs repo
uses a different asset-path convention.

**Source page:** `content/documentation/guides/authentication/implement-single-sign-on.mdx`
**Asset:** `{{ASSETS_ROOT}}/documentation/implement-single-sign-on/sso-login-flow.drawio.svg`

## Before drawing anything

Read `{{STYLE_GUIDE_PATH}}` — it fixes the shape
libraries, color palette (`{{ELEMENT_COLOR}}` elements, `{{CONNECTOR_COLOR}}` connectors), and the
`{{BRAND_FONT}}` font. `{{EXAMPLE_DIAGRAM_PATH}}`
is a reference diagram in the house style. Icons are welcome where they aid
comprehension; skip cutesy embellishment on highly technical diagrams — keep
the target audience in mind.

## Workflow

**New diagram:**
1. Write the `<mxGraphModel>` XML (a plain XML file — cells, geometry, styles).
2. Export: `python3 scripts/export_drawio_svg.py model.xml <asset-path>.drawio.svg --screenshot /tmp/check.png`
3. Look at the screenshot. Overlapping labels, crossed edges, and clipped text
   are only visible rendered — never call a diagram done without viewing it.

The `.drawio.svg` is the only deliverable — it goes straight into the page via
the standard image syntax for your docs platform (see `{{MARKDOWN_SYNTAX_REF}}`).
The screenshot and the intermediate `model.xml` are verification scratch
files: keep them in a temp directory, never next to the asset, never
committed.

**Editing an existing `.drawio.svg`:**
1. `python3 scripts/decode_drawio_svg.py <asset>.drawio.svg -o model.xml`
2. Edit the XML, re-export as above. Never hand-edit the rendered SVG body —
   it is a build artifact; the XML is the source of truth.

The export script runs the official diagrams.net viewer in headless Chrome and
serializes `graph.getSvg()`, so output is structurally identical to an
editor-made export (preamble, text fallbacks, font attrs, trailing "Text is
not SVG" marker), and it verifies the embedded source roundtrips before
exiting.

The canvas exports as `light-dark(<--background>, #121212)` under
`color-scheme: light dark`, so an inlined diagram follows the site theme
toggle rather than the OS preference. Pass `--background transparent` only for
a diagram meant to sit on whatever is behind it.

## Authoring notes

- **Data URIs in cell styles use the comma form** —
  `image=data:image/svg+xml,<base64>` — never `;base64,`. Semicolons delimit
  style keys in mxGraph, so `;base64` silently truncates the style and the
  image breaks.
- **Font may render as a fallback in local screenshots.** Assets reference
  `{{BRAND_FONT}}` by name without embedding it (matching every existing asset);
  machines without the font fall back to a default. Judge layout from the
  screenshot, not typography.
- **Keep the default 40px border.** Existing assets use it; a flush canvas
  looks cropped on the page.
- **Label an edge instead of adding a box** when a step is a transformation
  along a path rather than a station on it. Put the text in the edge's
  `value` and set `labelBackgroundColor=#FFFFFF` so the line doesn't strike
  through it.
- **Stable, semantic cell ids** (`authCore`, `legendBox`) — the next editing
  session greps for them.

## Verification checklist

- Screenshot reviewed (layout, no overlaps, arrows point the right way).
- Export script reported `roundtrip ok` (file still opens in the drawio editor).
- File lives under the correct `(collection, page-slug)` directory.
- Page embeds the asset with the standard image syntax.
- Only the `.drawio.svg` is staged — no `.png`, no loose `model.xml`.
