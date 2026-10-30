import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CHANGELOG, PLUGIN_ROOT, compareVersions, exists, pluginVersion, readJson } from './util.mjs';
import { run } from './proc.mjs';

const MANIFEST = path.join('.claude-plugin', 'marketplace.json');

/**
 * Where the marketplace that ships this engine lives on disk, found from the
 * engine's own location: a checkout of the marketplace repo (the plugin sits
 * at `<root>/plugins/setup-ai`), or Claude Code's install layout, where the
 * plugin is cached at `<plugins>/cache/<marketplace>/<plugin>/<version>` and
 * the marketplace clone is listed in `<plugins>/known_marketplaces.json`.
 *
 * @param {string} [pluginRoot] - The plugin folder to start from; the engine's own by default.
 * @returns {?{root: string, name: string, manifest: object}} Null when no
 *   manifest can be found — callers report the feature as unavailable.
 */
export function marketplaceRoot(pluginRoot = PLUGIN_ROOT) {
  const fromRoot = (root) => {
    const manifest = readJson(path.join(root, MANIFEST), null);
    return manifest ? { root, name: manifest.name, manifest } : null;
  };
  const checkout = fromRoot(path.resolve(pluginRoot, '..', '..'));
  if (checkout) return checkout;
  const cacheDir = path.resolve(pluginRoot, '..', '..', '..');
  const market = path.basename(path.resolve(pluginRoot, '..', '..'));
  const pluginsDirs = [
    path.dirname(cacheDir),
    path.join(process.env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'plugins'),
  ];
  for (const dir of pluginsDirs) {
    const known = readJson(path.join(dir, 'known_marketplaces.json'), {});
    const loc = known[market]?.installLocation ?? path.join(dir, 'marketplaces', market);
    const hit = fromRoot(loc);
    if (hit) return hit;
  }
  return null;
}

// `name:` from a SKILL.md frontmatter, else null.
function skillName(file) {
  try {
    const m = fs.readFileSync(file, 'utf8').match(/^---\s*\n[\s\S]*?^name:\s*["']?([^"'\n]+?)["']?\s*$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Every skill a plugin of the marketplace ships, by folder name and
 * frontmatter name.
 *
 * @param {?{root: string, name: string, manifest: object}} market - From `marketplaceRoot()`.
 * @returns {{skill: string, folder: string, plugin: string, id: string}[]} Empty when `market` is null.
 */
export function marketplaceSkills(market) {
  if (!market) return [];
  const skills = [];
  for (const p of market.manifest.plugins ?? []) {
    if (typeof p.source !== 'string') continue;
    const dir = path.join(market.root, p.source, 'skills');
    if (!exists(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const name = skillName(path.join(dir, ent.name, 'SKILL.md')) ?? ent.name;
      skills.push({ skill: name, folder: ent.name, plugin: p.name, id: `${p.name}@${market.name}` });
    }
  }
  return skills;
}

/**
 * Where this engine came from: its plugin version, and — when the
 * marketplace on disk is a git checkout — the marketplace name and commit.
 *
 * @returns {{version: string, marketplace: ?string, commit: ?string}}
 */
export function provenance() {
  const market = marketplaceRoot();
  let commit = null;
  if (market && exists(path.join(market.root, '.git'))) {
    const r = run('git', ['-C', market.root, 'rev-parse', 'HEAD'], { shell: false });
    if (r.code === 0) commit = r.stdout.trim() || null;
  }
  return { version: pluginVersion(), marketplace: market?.name ?? null, commit };
}

/**
 * Entries of setup-ai's CHANGELOG.md (Keep a Changelog headings
 * `## [x.y.z] - date`) newer than `since`. The `Unreleased` section is left out.
 *
 * @param {?string} since - A recorded setup-ai version; null lists every entry.
 * @returns {{version: string, date: ?string, text: string}[]} Newest first; empty when the file is missing.
 */
export function changelogSince(since) {
  let text;
  try {
    text = fs.readFileSync(CHANGELOG, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return [];
  }
  const entries = [];
  const re = /^## \[([^\]]+)\](?:\s*-\s*(\S+))?[^\n]*\n([\s\S]*?)(?=^## \[|(?![\s\S]))/gm;
  for (const m of text.matchAll(re)) {
    if (!/^\d+\.\d+\.\d+/.test(m[1])) continue;
    if (since && compareVersions(m[1], since) <= 0) continue;
    entries.push({ version: m[1], date: m[2] ?? null, text: m[3].trim() });
  }
  return entries;
}
