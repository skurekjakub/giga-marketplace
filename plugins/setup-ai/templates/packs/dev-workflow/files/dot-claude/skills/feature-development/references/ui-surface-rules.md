# UI surface rules

Read this before landing any feature that introduces UI surface — a new
component, a new stylesheet, a new chrome element, a new content renderer,
anything that lands a colour, background or border in styles or markup.

- **Theme tokens, never literals.** Colours, spacing and typography come from
  the design tokens the project defines; never hard-code a hex value. Tokens
  are what make every theme (including dark mode, if the product has one)
  follow for free.
- **Every theme, every surface.** If the product supports more than one theme,
  a new surface must render correctly in each before it ships — check it in
  the Phase 5 smoke test.
- **One styling approach for new code.** New components follow the project's
  current styling convention; legacy styles that predate it are not rewritten
  wholesale — touch them only when the feature requires it.
- **Reference component:** {{ReferenceComponentPath}} — the component whose
  shape new UI copies (styling, state handling, accessibility).

<!-- @if detect:tailwind -->
## Tailwind CSS

New components style themselves with **utility classes in the markup** — not a
scoped CSS file, not `@apply`. Utility-first is the canonical Tailwind
workflow, and the Tailwind docs name component extraction as the correct
alternative to `@apply`.

- Use the generated theme-token utilities (for example `bg-surface`,
  `text-muted`), never arbitrary hex values.
- Native-element state via `group` / `peer` variants (for example
  `group-open:rotate-90` on a `<details>` chevron) instead of JavaScript.
- **Tailwind v4 syntax only:** tokens live in `@theme {}` (no
  `tailwind.config.js`); slash opacity (`bg-black/50`), `bg-linear-*`,
  trailing `!`, `bg-(--var)`. Don't emit v3 forms (`@tailwind`,
  `bg-opacity-50`, `bg-gradient-to-r`) — they compile silently to nothing.
<!-- @endif -->
