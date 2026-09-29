import fs from 'node:fs';
import path from 'node:path';
import { PACKS_DIR, GLOBAL_TOKENS, die, exists, isText, posix, readJson, walk } from './util.mjs';
import { evalCond } from './conditions.mjs';
import { TOKEN_RE, applyConditionals, destRel, renderTokens, stripBanner } from './template.mjs';
import { filterSettings } from './settings.mjs';

/**
 * Every pack under templates/packs, keyed by name.
 *
 * @throws Exits via `die` when two packs declare the same option key — option
 *   keys share one namespace in the values file, so one would silently answer
 *   for the other.
 */
export function loadPacks() {
  const packs = {};
  for (const name of fs.readdirSync(PACKS_DIR)) {
    const manifest = readJson(path.join(PACKS_DIR, name, 'pack.json'));
    if (!manifest) continue;
    packs[manifest.name] = { ...manifest, root: path.join(PACKS_DIR, name) };
  }
  const owner = {};
  for (const p of Object.values(packs)) {
    for (const key of Object.keys(p.options ?? {})) {
      if (owner[key] && owner[key] !== p.name) die(`option key "${key}" is declared by both ${owner[key]} and ${p.name}`);
      owner[key] = p.name;
    }
  }
  return packs;
}

/**
 * The requested packs plus everything they require, dependencies first.
 *
 * @returns {{order: string[], pulledIn: {pack, requiredBy}[], recommended: string[]}}
 */
export function resolvePacks(all, requested) {
  const order = [];
  const pulledIn = [];
  const visit = (name, via) => {
    if (order.includes(name)) return;
    const pack = all[name];
    if (!pack) die(`unknown pack: ${name}`, { known: Object.keys(all) });
    for (const dep of pack.requires?.packs ?? []) visit(dep, name);
    order.push(name);
    if (via) pulledIn.push({ pack: name, requiredBy: via });
  };
  for (const name of requested) visit(name, null);
  const recommended = [...new Set(order.flatMap((n) => all[n].recommends ?? []))].filter((n) => !order.includes(n));
  return { order, pulledIn: pulledIn.filter((p) => !requested.includes(p.pack)), recommended };
}

/** False when any `fileConditions` prefix matching `rel` has a false condition. */
function fileAllowed(pack, rel, ctx) {
  for (const [prefix, cond] of Object.entries(pack.fileConditions ?? {})) {
    if (posix(rel).startsWith(prefix) && !evalCond(cond, ctx)) return false;
  }
  return true;
}

/** Template files of `pack` that the current options select, as `[abs, rel]`. */
function selectedFiles(pack, ctx) {
  const filesDir = path.join(pack.root, 'files');
  if (!exists(filesDir)) return [];
  return walk(filesDir)
    .map((abs) => [abs, path.relative(filesDir, abs)])
    .filter(([, rel]) => fileAllowed(pack, rel, ctx));
}

/**
 * Renders every selected template file in memory: conditionals, banner strip,
 * tokens. Binary files pass through untouched.
 *
 * @returns {{pack, src, dest, buf: Buffer, text: ?string}[]}
 */
export function buildFiles(all, order, ctx) {
  const files = [];
  for (const name of order) {
    for (const [abs, rel] of selectedFiles(all[name], ctx)) {
      let buf = fs.readFileSync(abs);
      let text = null;
      if (isText(buf)) {
        text = applyConditionals(buf.toString('utf8'), ctx, `${name}/${posix(rel)}`);
        text = renderTokens(stripBanner(text), ctx.tokens);
        buf = Buffer.from(text, 'utf8');
      }
      files.push({ pack: name, src: posix(rel), dest: destRel(rel, ctx.tokens), buf, text });
    }
  }
  return files;
}

/**
 * Tokens referenced by the files, appends, settings and MCP servers the chosen
 * packs and options would write, each with where it is first used.
 *
 * @returns {Map<string, string>}
 */
export function scanTokens(all, order, ctx) {
  const found = new Map();
  const scan = (text, where) => {
    for (const m of text.matchAll(TOKEN_RE)) if (!found.has(m[1])) found.set(m[1], where);
  };
  for (const name of order) {
    const pack = all[name];
    for (const [abs, rel] of selectedFiles(pack, ctx)) {
      const where = `${name}/${posix(rel)}`;
      scan(posix(rel), where);
      const buf = fs.readFileSync(abs);
      if (isText(buf)) scan(applyConditionals(buf.toString('utf8'), ctx, rel), where);
    }
    scan(JSON.stringify(pack.appends ?? []), `${name}/pack.json appends`);
    scan(JSON.stringify(filterSettings(pack.settings ?? {}, ctx)), `${name}/pack.json settings`);
    for (const [key, def] of Object.entries(pack.mcp ?? {})) {
      if (def['@when'] && !evalCond(def['@when'], ctx)) continue;
      scan(key + JSON.stringify(def), `${name}/pack.json mcp`);
    }
  }
  return found;
}

/** Prompt/default/infer metadata for every token: globals, then each pack's. */
export function tokenCatalog(all, order) {
  const cat = { ...readJson(GLOBAL_TOKENS, {}) };
  for (const name of order) Object.assign(cat, all[name].tokens ?? {});
  return cat;
}

/**
 * Default for one pack option, evaluated against the repo: an array of values
 * for `multi`, one value for `single`. `defaultWhen` is a condition.
 */
export function defaultFor(opt, ctx) {
  const on = (c) => c.default === true || (c.defaultWhen ? evalCond(c.defaultWhen, ctx) : false);
  if (opt.type === 'multi') return opt.choices.filter(on).map((c) => c.value);
  if (opt.defaultFrom === 'detect') return ctx.detect.options?.[opt.key] ?? opt.default ?? null;
  return (opt.choices ?? []).find(on)?.value ?? opt.default ?? null;
}

/** Manual steps the packs leave the user (pack.json `todo`), filtered by `when`. */
export function packTodos(all, order, ctx) {
  return order.flatMap((n) => (all[n].todo ?? [])
    .filter((t) => !t.when || evalCond(t.when, ctx))
    .map((t) => ({ pack: n, text: t.text })));
}
