import fs from 'node:fs';
import path from 'node:path';
import { exists, readJson } from './util.mjs';
import { evalCond } from './conditions.mjs';
import { renderTokens } from './template.mjs';
import { requiredPlugins } from './prereqs.mjs';

const isEmpty = (v) => (Array.isArray(v) ? v.length === 0 : v && typeof v === 'object' && Object.keys(v).length === 0);

/**
 * Drops entries whose `@when` is false, strips the `@when` keys, and prunes
 * arrays/objects left empty so no `"Stop": []` noise lands in settings.
 */
export function filterSettings(node, ctx) {
  if (Array.isArray(node)) {
    return node
      .filter((v) => !(v && typeof v === 'object' && v['@when'] && !evalCond(v['@when'], ctx)))
      .map((v) => filterSettings(v, ctx))
      .filter((v) => !isEmpty(v));
  }
  if (node && typeof node === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '@when') continue;
      const f = filterSettings(v, ctx);
      if (!isEmpty(f)) res[k] = f;
    }
    return res;
  }
  return node;
}

/**
 * Merges `src` into `target` in place. Objects merge key by key, arrays append
 * entries not already present, and a scalar the user already set wins.
 */
export function deepMerge(target, src) {
  if (Array.isArray(target) && Array.isArray(src)) {
    const seen = new Set(target.map((v) => JSON.stringify(v)));
    for (const v of src) if (!seen.has(JSON.stringify(v))) target.push(v);
    return target;
  }
  if (target && typeof target === 'object' && src && typeof src === 'object' && !Array.isArray(src)) {
    for (const [k, v] of Object.entries(src)) {
      if (k in target && typeof target[k] === 'object' && target[k] !== null) deepMerge(target[k], v);
      else if (!(k in target)) target[k] = v;
    }
  }
  return target;
}

// Two packs (or two runs) adding the same matcher produce two entries; fold
// entries with an identical matcher into one and dedupe their commands.
function mergeHookEntries(settings) {
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    const byMatcher = new Map();
    for (const e of entries) {
      const key = e.matcher ?? '';
      if (!byMatcher.has(key)) byMatcher.set(key, { ...e, hooks: [] });
      const tgt = byMatcher.get(key);
      for (const h of e.hooks ?? []) if (!tgt.hooks.some((x) => JSON.stringify(x) === JSON.stringify(h))) tgt.hooks.push(h);
    }
    settings.hooks[event] = [...byMatcher.values()];
  }
  return settings;
}

// enabledPlugins + extraKnownMarketplaces so teammates opening the repo are
// prompted to install what the packs need.
function pluginSettings(all, order, ctx) {
  const s = { enabledPlugins: {}, extraKnownMarketplaces: {} };
  for (const req of requiredPlugins(all, order, ctx)) {
    s.enabledPlugins[req.id] = true;
    if (req.marketplace?.repo && req.marketplace.name !== 'claude-plugins-official') {
      s.extraKnownMarketplaces[req.marketplace.name] = { source: { source: 'github', repo: req.marketplace.repo } };
    }
  }
  if (!Object.keys(s.extraKnownMarketplaces).length) delete s.extraKnownMarketplaces;
  if (!Object.keys(s.enabledPlugins).length) delete s.enabledPlugins;
  return s;
}

/**
 * Merges every pack's settings fragment and the required plugins into
 * `<dest>/.claude/settings.json`.
 *
 * @returns {{status: 'merged'|'unchanged'} | {error: string}}
 */
export function mergeSettingsFile(all, order, ctx, dry) {
  const file = path.join(ctx.dest, '.claude', 'settings.json');
  const current = readJson(file, exists(file) ? null : {});
  if (current === null) return { error: '.claude/settings.json exists but is not valid JSON — settings not merged' };
  const merged = structuredClone(current);
  for (const name of order) {
    deepMerge(merged, JSON.parse(renderTokens(JSON.stringify(filterSettings(all[name].settings ?? {}, ctx)), ctx.tokens)));
  }
  deepMerge(merged, pluginSettings(all, order, ctx));
  mergeHookEntries(merged);
  const changed = JSON.stringify(merged) !== JSON.stringify(current);
  if (changed && !dry) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n');
  }
  return { status: changed ? 'merged' : 'unchanged' };
}

// MCP servers the packs declare, filtered by @when and rendered. Secrets must
// stay ${VAR} references in pack.json — .mcp.json is committed.
function packMcpServers(all, order, ctx) {
  const servers = {};
  for (const name of order) {
    for (const [key, def] of Object.entries(all[name].mcp ?? {})) {
      if (def['@when'] && !evalCond(def['@when'], ctx)) continue;
      const { '@when': _when, ...rest } = def;
      servers[renderTokens(key, ctx.tokens)] = JSON.parse(renderTokens(JSON.stringify(rest), ctx.tokens));
    }
  }
  return servers;
}

/**
 * Adds the packs' MCP servers to `<dest>/.mcp.json`. A server entry that
 * already exists under the same name is the user's and is left untouched.
 *
 * @returns {null | {servers, keptExisting, file, changed} | {error: string}}
 */
export function mergeMcpFile(all, order, ctx, dry) {
  const servers = packMcpServers(all, order, ctx);
  if (!Object.keys(servers).length) return null;
  const file = path.join(ctx.dest, '.mcp.json');
  const cur = readJson(file, exists(file) ? null : {});
  if (cur === null) return { error: '.mcp.json exists but is not valid JSON — MCP servers not merged' };
  const next = structuredClone(cur);
  next.mcpServers ??= {};
  const kept = Object.keys(servers).filter((k) => k in next.mcpServers);
  for (const [k, v] of Object.entries(servers)) if (!(k in next.mcpServers)) next.mcpServers[k] = v;
  const changed = JSON.stringify(next) !== JSON.stringify(cur);
  if (changed && !dry) fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  return { servers: Object.keys(servers), keptExisting: kept, file: '.mcp.json', changed };
}
