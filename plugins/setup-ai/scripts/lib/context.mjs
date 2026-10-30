import path from 'node:path';
import fs from 'node:fs';
import { GLOBAL_TOKENS, RECORD, die, exists, isText, listArg, readJson, sha } from './util.mjs';
import { detect } from './detect.mjs';
import { defaultFor, loadPacks, resolvePacks, scanTokens, tokenCatalog } from './packs.mjs';
import { renderTokens } from './template.mjs';
import { VERIFY_SCRIPT_NAMES } from './package-scripts.mjs';

/**
 * `--values` file contents as `{ tokens, options, packageScripts,
 * placeholders }` — or `args.valuesData` when a command renders from the
 * install record. Exits when the file is unreadable.
 */
function loadValues(args) {
  const v = args.valuesData ?? (args.values ? readJson(args.values, null) : {});
  if (v === null) die(`cannot read --values ${args.values}`);
  return {
    tokens: { ...(v.tokens ?? {}) },
    options: { ...(v.options ?? {}) },
    packageScripts: v.packageScripts ?? {},
    placeholders: v.placeholders ?? {},
  };
}

/**
 * Fills, in place, every global token marked `autoDefault` that `tokens`
 * lacks, with its catalog default rendered against the other tokens. A
 * default that still holds an unfilled token after that is not applied, so
 * the token stays missing.
 *
 * @param {Record<string, string>} tokens - Mutated.
 * @returns {string[]} The names filled.
 */
function applyAutoDefaults(tokens) {
  const auto = Object.entries(readJson(GLOBAL_TOKENS, {})).filter(([name, t]) => t.autoDefault && t.default && !(name in tokens));
  const filled = [];
  // Defaults may reference each other (COMMENT_POLICY_PATH -> CONVENTIONS_DIR),
  // so resolve until a pass adds nothing.
  for (let progress = true; progress;) {
    progress = false;
    for (const [name, t] of auto) {
      if (name in tokens) continue;
      const value = renderTokens(t.default, tokens);
      if (/\{\{[A-Z][A-Z0-9_]*\}\}/.test(value)) continue;
      tokens[name] = value;
      filled.push(name);
      progress = true;
    }
  }
  return filled;
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
 * record says are already there (minus `args.exclude`, the packs being
 * removed), so adding a pack later never renders a file as if its siblings
 * were missing. Global tokens marked `autoDefault` that the values lack get
 * their default (`defaultedTokens` names them), so a repo installed before a
 * path became a token renders as it did.
 */
export function ctxFor(args, order) {
  const { tokens, options, packageScripts, placeholders } = loadValues(args);
  const dest = args.dest ?? process.cwd();
  const exclude = args.exclude ?? [];
  const installed = (readRecord(dest)?.packs ?? []).map((p) => p.name).filter((n) => !exclude.includes(n));
  const facts = detect(dest);
  // A verify script the render is about to add counts as present, so defaults
  // keyed on it (the prefer-verify-script hook) switch on.
  if (Object.keys(packageScripts).some((n) => VERIFY_SCRIPT_NAMES.includes(n))) facts.flags.verifyScript = true;
  const defaultedTokens = applyAutoDefaults(tokens);
  return { packs: [...new Set([...order, ...installed])], tokens, options, packageScripts, placeholders, defaultedTokens, detect: facts, dest };
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
 * (placeholder-shaped values count as missing), the declared options the
 * values leave unset, and any invalid option values. With `args.defaults`,
 * unset options take their `defaultFor` value instead (`defaultedOptions`)
 * and only an option with no default stays missing.
 */
export function planFor(args) {
  const all = loadPacks();
  const { order, pulledIn, recommended } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const declared = Object.fromEntries(order.flatMap((n) => Object.entries(all[n].options ?? {})));
  const defaultedOptions = {};
  if (args.defaults) {
    for (const [key, opt] of Object.entries(declared)) {
      if (key in ctx.options) continue;
      const value = defaultFor(opt, ctx);
      if (value !== null) ctx.options[key] = defaultedOptions[key] = value;
    }
  }
  const missingOptions = Object.keys(declared).filter((k) => !(k in ctx.options));
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
  const defaultedTokens = ctx.defaultedTokens
    .filter((t) => referenced.has(t))
    .map((t) => ({ token: t, value: ctx.tokens[t], inferred: ctx.detect.tokens[t] ?? null, prompt: cat[t]?.prompt ?? null }));
  return {
    all, order, pulledIn, recommended, ctx, missingTokens, defaultedTokens, missingOptions, defaultedOptions,
    invalidOptions: invalidOptions(all, order, ctx.options),
  };
}

/** Content hash that ignores CRLF vs LF, so a teammate's autocrlf checkout isn't "edited". */
export const contentHash = (buf) => sha(isText(buf) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : buf);

/**
 * What rendering `f` would do to the file on disk:
 *
 * - `create` — no file there.
 * - `unchanged` — the file already equals the render.
 * - `overwrite` — named in `--overwrite`.
 * - `adopt` — named in `--adopt`: the repo's file at `f.dest` (or its
 *   equivalent `f.equivalent` when `f.dest` is free) is recorded as the
 *   baseline and nothing is written.
 * - `adopted` — adopted on an earlier run and kept: always for an equivalent
 *   under another path; for a file at `f.dest`, while the template still
 *   renders what it rendered when the file was adopted.
 * - `update` — `--update` and the file still matches the recorded hash, i.e.
 *   the user didn't edit it.
 * - `conflict` — anything else: the file exists and differs.
 *
 * @param {string} dest - Repo root.
 * @param {{dest: string, buf: Buffer, equivalent?: string}} f - A rendered file from `buildFiles`.
 * @param {?object} record - The install record.
 * @param {object} args - Engine args (`overwrite`, `adopt`, `update`).
 * @returns {'create'|'unchanged'|'overwrite'|'adopt'|'adopted'|'update'|'conflict'}
 */
export function fileAction(dest, f, record, args) {
  const named = (flag) => args[flag] === 'all' || listArg(args[flag]).includes(f.dest);
  const rec = record?.files?.[f.dest];
  const forced = named('overwrite');
  if (rec?.adopted && rec.adopted !== f.dest && !forced) return 'adopted';
  const target = path.join(dest, f.dest);
  if (!exists(target)) return f.equivalent && named('adopt') ? 'adopt' : 'create';
  const cur = contentHash(fs.readFileSync(target));
  const rendered = contentHash(f.buf);
  if (cur === rendered) return 'unchanged';
  if (forced) return 'overwrite';
  if (named('adopt')) return 'adopt';
  if (rec?.adopted === f.dest && rec.hash === rendered) return 'adopted';
  if (args.update && rec?.hash === cur) return 'update';
  return 'conflict';
}

/**
 * Engine args that render from the install record instead of a values file:
 * its tokens, options and placeholders, with `packs` pointing at `order`.
 */
export const recordArgs = (dest, record, order, extra = {}) => ({
  dest,
  packs: order.join(','),
  valuesData: { tokens: record.tokens ?? {}, options: record.options ?? {}, placeholders: record.placeholders ?? {} },
  ...extra,
});
