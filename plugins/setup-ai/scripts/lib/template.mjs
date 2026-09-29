import { evalCond } from './conditions.mjs';
import { posix } from './util.mjs';

/** `{{UPPER_SNAKE}}` — filled at install; one left over is an error. */
export const TOKEN_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
/** `{{PascalCase}}` and friends — skeleton placeholders the user fills in later. */
const TODO_RE = /\{\{(?![A-Z][A-Z0-9_]*\}\})([A-Za-z][\w.-]*)\}\}/g;

// Line-based @if blocks. Markers may be HTML comments or '#' comments so the
// same syntax works in Markdown, shell and YAML. Nesting is supported.
const IF_RE = /^\s*(?:<!--|#)\s*@if\s+(.+?)\s*(?:-->)?\s*$/;
const ENDIF_RE = /^\s*(?:<!--|#)\s*@endif\s*(?:-->)?\s*$/;

/**
 * Keeps the lines inside `@if` blocks whose condition holds and drops the rest,
 * markers included; collapses the blank-line runs that leaves behind.
 *
 * @throws {Error} On an unbalanced `@endif` or an unclosed `@if` in `file`.
 */
export function applyConditionals(text, ctx, file) {
  const kept = [];
  const stack = [];
  for (const line of text.split('\n')) {
    const m = line.match(IF_RE);
    if (m) {
      stack.push(stack.every(Boolean) && evalCond(m[1], ctx));
      continue;
    }
    if (ENDIF_RE.test(line)) {
      if (!stack.length) throw new Error(`unbalanced @endif in ${file}`);
      stack.pop();
      continue;
    }
    if (stack.every(Boolean)) kept.push(line);
  }
  if (stack.length) throw new Error(`unclosed @if in ${file}`);
  return kept.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Replaces every `{{TOKEN}}` that has a value; unknown tokens are left as-is. */
export function renderTokens(text, tokens) {
  return text.replace(TOKEN_RE, (m, name) => (name in tokens ? String(tokens[name]) : m));
}

/**
 * Removes the "> **Template skill — fill in before use.**" blockquote and the
 * blank line after it. Inline "> **Template note:**" and "> **Adapt me.**"
 * blocks are kept — they mark work the user still owns.
 */
export function stripBanner(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^>\s*\*\*Template skill\b/.test(l));
  if (start === -1) return text;
  let end = start;
  while (end < lines.length && lines[end].startsWith('>')) end++;
  if (lines[end] === '') end++;
  lines.splice(start, end - start);
  return lines.join('\n');
}

/**
 * Target path for a template file: `dot-<name>` segments become `.<name>`
 * (template trees store dot-folders that way so a stored `.claude/skills`
 * never loads as live config in this repo), then tokens are rendered.
 */
export function destRel(rel, tokens) {
  const segs = posix(rel).split('/').map((s) => (s.startsWith('dot-') ? '.' + s.slice(4) : s));
  return renderTokens(segs.join('/'), tokens);
}

/** Leftover `{{UPPER}}` token names in rendered text. */
export const leftoverTokens = (text) => [...text.matchAll(TOKEN_RE)].map((m) => m[1]);

/**
 * Skeleton placeholders in rendered prose. Fenced and inline code are skipped:
 * they legitimately hold `{{…}}` syntax of their own (Jira wiki markup,
 * Handlebars, GitHub Actions).
 */
export function todoPlaceholders(text) {
  const prose = text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  return [...new Set([...prose.matchAll(TODO_RE)].map((m) => m[1]))];
}
