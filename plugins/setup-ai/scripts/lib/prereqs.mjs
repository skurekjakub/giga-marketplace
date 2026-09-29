import path from 'node:path';
import { VENDOR_NODE_MIN, nodeAtLeast, readJson } from './util.mjs';
import { evalCond } from './conditions.mjs';
import { onPath, run } from './proc.mjs';
import { vendorSkillPresent } from './vendor.mjs';

// One collector per requirement kind: filter by `when`, dedupe across packs,
// and remember which packs asked for it.
function collect(all, order, ctx, pick, keyOf) {
  const byKey = new Map();
  for (const name of order) {
    for (const item of pick(all[name].requires ?? {})) {
      if (item.when && !evalCond(item.when, ctx)) continue;
      const key = keyOf(item);
      if (byKey.has(key)) byKey.get(key).requiredBy.push(name);
      else byKey.set(key, { ...item, requiredBy: [name] });
    }
  }
  return [...byKey.values()];
}

/** Claude Code plugins the packs need: `{ id, marketplace, why, requiredBy }`. */
export const requiredPlugins = (all, order, ctx) => collect(all, order, ctx, (r) => r.plugins ?? [], (p) => p.id);

/** Third-party skills, one entry per skill: `{ source, skill, why, requiredBy }`. */
export const requiredVendorSkills = (all, order, ctx) => collect(
  all, order, ctx,
  (r) => (r.vendorSkills ?? []).flatMap((v) => v.skills.map((skill) => ({ source: v.source, skill, why: v.why, when: v.when }))),
  (v) => v.skill,
).map(({ when: _when, ...v }) => v);

const requiredClis = (all, order, ctx) => collect(all, order, ctx, (r) => r.cli ?? [], (c) => c.name);
const requiredEnv = (all, order, ctx) => collect(all, order, ctx, (r) => r.env ?? [], (e) => e.name);

/**
 * Whether an environment variable is available. Secrets are never read or
 * printed — only whether the variable exists in the process environment or is
 * declared in the git-ignored local settings file.
 */
export function envVarSet(dest, name) {
  if (process.env[name]) return true;
  const local = readJson(path.join(dest, '.claude', 'settings.local.json'), {});
  return Boolean(local?.env && name in local.env);
}

let pluginListCache;

/** Installed plugins from `claude plugin list --json`, or null when unavailable. */
function installedPlugins() {
  if (pluginListCache !== undefined) return pluginListCache;
  const r = run('claude', ['plugin', 'list', '--json']);
  try {
    pluginListCache = r.code === 0 ? JSON.parse(r.stdout) : null;
  } catch {
    pluginListCache = null;
  }
  return pluginListCache;
}

/** Forget the cached plugin list — call after installing plugins. */
export const resetPluginCache = () => { pluginListCache = undefined; };

function knownMarketplaces() {
  const r = run('claude', ['plugin', 'marketplace', 'list', '--json']);
  if (r.code !== 0) return null;
  try {
    return JSON.parse(r.stdout).map((m) => m.name);
  } catch {
    return null;
  }
}

/**
 * Status of every prerequisite the resolved packs need on this machine.
 *
 * @returns {{plugins, vendorSkills, clis, env, node, allSatisfied: boolean}}
 */
export function prereqStatus(all, order, ctx, dest) {
  const list = installedPlugins();
  const markets = knownMarketplaces();
  const plugins = requiredPlugins(all, order, ctx).map((p) => {
    const hit = list?.find((i) => i.id === p.id);
    const status = list === null ? 'unknown' : hit ? (hit.enabled ? 'installed' : 'disabled') : 'missing';
    const marketplaceKnown = markets === null ? null : markets.includes(p.id.split('@')[1]);
    return { id: p.id, why: p.why, requiredBy: p.requiredBy, status, marketplaceKnown, marketplace: p.marketplace };
  });
  const vendorSkills = requiredVendorSkills(all, order, ctx).map((v) => ({ ...v, status: vendorSkillPresent(dest, v.skill) ? 'installed' : 'missing' }));
  const clis = requiredClis(all, order, ctx).map((c) => ({ ...c, status: onPath(c.name) ? 'installed' : 'missing' }));
  const env = requiredEnv(all, order, ctx).map((e) => ({ ...e, status: envVarSet(dest, e.name) ? 'set' : 'missing' }));
  const node = vendorSkills.length
    ? { required: `>=${VENDOR_NODE_MIN.join('.')}`, have: process.versions.node, ok: nodeAtLeast(VENDOR_NODE_MIN), reason: 'npx skills (vendor skills)' }
    : null;
  const missing = [
    ...plugins.filter((p) => p.status !== 'installed'),
    ...vendorSkills.filter((v) => v.status === 'missing'),
    ...clis.filter((c) => c.status === 'missing' && !c.optional),
    ...env.filter((e) => e.status === 'missing'),
  ];
  return { plugins, vendorSkills, clis, env, node, allSatisfied: missing.length === 0 && (!node || node.ok) };
}
