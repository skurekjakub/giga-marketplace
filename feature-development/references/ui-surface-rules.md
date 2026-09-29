# UI surface rules

Read this before landing any feature that introduces UI surface.

Any feature that introduces UI surface — a new component, a new CSS file, a
new chrome element, a new MDX renderer, anything that lands a
`background-color` / `color` / `border-color` / hex literal in CSS or a
`bg-*` / `text-*` / `border-*` Tailwind utility in JSX — must theme correctly
in dark mode. `.ai/feature-constitution/site-chrome/dark-mode/README.md` is
the full spec.

New MDX and content components style themselves with **Tailwind utility
classes in the JSX markup** — not a scoped `.css` file, not `@apply`.
Utility-first is the canonical Tailwind workflow, and the Tailwind docs name
component extraction (a React component) as the correct alternative to
`@apply`. `components/mdx/Collapsible.tsx` is the reference example: a
native `<details>/<summary>` styled entirely in `className`, theme-token
colour utilities (`bg-surface`, `bg-surface-alt`, `border-surface-border`,
`text-text-muted`) so dark mode follows for free, native-element state via
`group` + `group-open:` (the chevron rotates with `group-open:rotate-90`, no
JS), and arbitrary variants for the long tail
(`[&::-webkit-details-marker]:hidden`, `[&>:first-child]:mt-0`). Copy its
shape.

- **Theme tokens, never literals.** Use the generated `--color-*` utilities
  (`bg-surface`, `border-surface-border`, …); never hardcode a hex. This is
  what makes dark mode automatic.
- **Tailwind v4 syntax only.** Tokens live in `@theme {}` (no
  `tailwind.config.js`); slash-opacity (`bg-black/50`), `bg-linear-*`,
  trailing `!` (`flex!`), `bg-(--var)`. Don't emit v3 forms (`@tailwind`,
  `bg-opacity-50`, `bg-gradient-to-r`) — they compile silently to nothing.
- **Legacy scoped-CSS components stay put.** The files under
  `app/styles/components/content/` (`admonitions.css`, `columns.css`,
  `code.css`, …) predate this convention and are not rewritten wholesale —
  only new components follow utility-first. Touch a legacy CSS file only
  when the feature you are building requires it.
