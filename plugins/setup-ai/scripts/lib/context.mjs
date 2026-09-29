import path from 'node:path';
import fs from 'node:fs';
import { RECORD, die, exists, isText, readJson, sha } from './util.mjs';
import { detect } from './detect.mjs';
import { loadPacks, resolvePacks, scanTokens, tokenCatalog } from './packs.mjs';

/** `--values` file contents as `{ tokens, options }`. Exits when unreadable. */
function loadValues(args) {
  const v = args.values ? readJson(args.values, null) : {};
  if (v === null) die(`cannot read --values ${args.values}`);
  return { tokens: v.tokens ?? {}, options: v.options ?? {} };
}

/** The `--packs` list. Exits when empty. */
export function packList(args) {
  const list = String(args.packs ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) die('--packs is required (comma-separated)');
  return list;
}

/** The install record of the target repo, or null. */
export const readRecord = (dest) => readJson(path.join(dest, RECORD), null);

/**
 * Evaluation context for conditions and rendering. `packs` — what `pack:`
 * conditions test — is the packs being rendered plus the ones the install
 * record says are already there, so adding a pack later never renders a file
 * as if its siblings were missing.
 */
export function ctxFor(args, order) {
  const { tokens, options } = loadValues(args);
  const dest = args.dest ?? process.cwd();
  const installed = (readRecord(dest)?.packs ?? []).map((p) => p.name);
  return { packs: [...new Set([...order, ...installed])], tokens, options, detect: detect(dest), dest };
}

// A value someone typed to get past a question is not a value: rendering it
// produces a skill that says "TODO_PRODUCT_NAME" or an MCP server pointed at
// "CHANGE_ME". Treated as missing so the wizard asks or drops the pack.
const PLACEHOLDER_RE = /^\s*$|^(todo|tbd|fixme|xxx|change[_ -]?me|replace[_ -]?me|placeholder|your[_-])|^<.*>$|^\{\{.*\}\}$/i;
const isPlaceholder = (v) => PLACEHOLDER_RE.test(String(v));

// Option values must be one of the declared choices; a typo would otherwise
// silently select nothing.
function invalidOptions(all, order, options) {
  const bad = [];
  for (const name of order) {
    for (const [key, opt] of Object.entries(all[name].options ?? {})) {
      if (!(key in options) || !opt.choices) continue;
      const allowed = opt.choices.map((c) => c.value);
      const given = Array.isArray(options[key]) ? options[key] : [options[key]];
      if (opt.type === 'multi' && !Array.isArray(options[key])) bad.push({ option: key, value: options[key], allowed, reason: 'must be an array' });
      for (const v of given) if (!allowed.includes(v)) bad.push({ option: key, value: v, allowed });
    }
  }
  return bad;
}

/**
 * Loads packs, resolves `--packs`, and lists the tokens still missing a value
 * (placeholder-shaped values count as missing) and any invalid option values.
 */
export function planFor(args) {
  const all = loadPacks();
  const { order, pulledIn, recommended } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const referenced = scanTokens(all, order, ctx);
  const cat = tokenCatalog(all, order);
  const missingTokens = [...referenced.keys()]
    .filter((t) => !(t in ctx.tokens) || isPlaceholder(ctx.tokens[t]))
    .map((t) => ({
      token: t,
      firstUsedIn: referenced.get(t),
      prompt: cat[t]?.prompt ?? null,
      default: cat[t]?.default ?? null,
      inferred: ctx.detect.tokens[t] ?? null,
      ...(t in ctx.tokens ? { rejected: ctx.tokens[t], reason: 'placeholder-shaped value' } : {}),
    }));
  return { all, order, pulledIn, recommended, ctx, missingTokens, invalidOptions: invalidOptions(all, order, ctx.options) };
}

/** Content hash that ignores CRLF vs LF, so a teammate's autocrlf checkout isn't "edited". */
export const contentHash = (buf) => sha(isText(buf) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : buf);

/**
 * What rendering `f` would do to the file on disk: `create`, `unchanged`,
 * `overwrite` (named in `--overwrite`), `update` (`--update` and the file
 * still matches the recorded hash, i.e. the user didn't edit it) or `conflict`.
 */
export function fileAction(dest, f, record, args) {
  const target = path.join(dest, f.dest);
  if (!exists(target)) return 'create';
  const cur = contentHash(fs.readFileSync(target));
  if (cur === contentHash(f.buf)) return 'unchanged';
  const overwrite = String(args.overwrite ?? '').split(',').map((s) => s.trim().replace(/\\/g, '/'));
  if (overwrite.includes(f.dest) || args.overwrite === 'all') return 'overwrite';
  if (args.update && record?.files?.[f.dest]?.hash === cur) return 'update';
  return 'conflict';
}
