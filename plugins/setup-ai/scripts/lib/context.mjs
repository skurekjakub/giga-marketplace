import path from 'node:path';
import fs from 'node:fs';
import { die, exists, readJson, sha } from './util.mjs';
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

/** Evaluation context for conditions and rendering. */
export function ctxFor(args, order) {
  const { tokens, options } = loadValues(args);
  const dest = args.dest ?? process.cwd();
  return { packs: order, tokens, options, detect: detect(dest), dest };
}

/** Loads packs, resolves `--packs`, and lists the tokens still missing a value. */
export function planFor(args) {
  const all = loadPacks();
  const { order, pulledIn, recommended } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const referenced = scanTokens(all, order, ctx);
  const cat = tokenCatalog(all, order);
  const missingTokens = [...referenced.keys()].filter((t) => !(t in ctx.tokens)).map((t) => ({
    token: t,
    firstUsedIn: referenced.get(t),
    prompt: cat[t]?.prompt ?? null,
    default: cat[t]?.default ?? null,
    inferred: ctx.detect.tokens[t] ?? null,
  }));
  return { all, order, pulledIn, recommended, ctx, missingTokens };
}

/**
 * What rendering `f` would do to the file on disk: `create`, `unchanged`,
 * `overwrite` (named in `--overwrite`), `update` (`--update` and the file
 * still matches the recorded hash, i.e. the user didn't edit it) or `conflict`.
 */
export function fileAction(dest, f, record, args) {
  const target = path.join(dest, f.dest);
  if (!exists(target)) return 'create';
  const cur = fs.readFileSync(target);
  if (sha(cur) === sha(f.buf)) return 'unchanged';
  const overwrite = String(args.overwrite ?? '').split(',').map((s) => s.trim());
  if (overwrite.includes(f.dest) || args.overwrite === 'all') return 'overwrite';
  if (args.update && record?.files?.[f.dest]?.hash === sha(cur)) return 'update';
  return 'conflict';
}
