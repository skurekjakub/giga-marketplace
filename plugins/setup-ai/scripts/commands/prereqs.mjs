import { out } from '../lib/util.mjs';
import { run } from '../lib/proc.mjs';
import { loadPacks, resolvePacks } from '../lib/packs.mjs';
import { prereqStatus, resetPluginCache } from '../lib/prereqs.mjs';
import { vendorInstall } from '../lib/vendor.mjs';
import { ctxFor, packList } from '../lib/context.mjs';

/**
 * `prereqs` — installs what can be installed for the resolved packs: missing
 * marketplaces, plugins (project scope) and vendor skills. CLIs and env vars
 * are only reported; the user installs or sets those.
 */
export function cmdPrereqs(args) {
  const all = loadPacks();
  const { order } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const status = prereqStatus(all, order, ctx, ctx.dest);
  const results = [];
  const step = (label, r) => results.push({ step: label, ok: r.code === 0, stderr: r.code ? r.stderr.slice(-1500) : undefined });

  const addedMarkets = new Set();
  for (const p of status.plugins.filter((x) => x.status !== 'installed')) {
    const market = p.id.split('@')[1];
    if (p.marketplaceKnown === false && p.marketplace?.repo && !addedMarkets.has(market)) {
      step(`marketplace add ${p.marketplace.repo}`, run('claude', ['plugin', 'marketplace', 'add', p.marketplace.repo], { cwd: ctx.dest }));
      addedMarkets.add(market);
    }
    const argv = p.status === 'disabled'
      ? ['plugin', 'enable', p.id, '--scope', 'project']
      : ['plugin', 'install', p.id, '--scope', 'project'];
    step(`claude ${argv.join(' ')}`, run('claude', argv, { cwd: ctx.dest }));
  }
  for (const v of vendorInstall(ctx.dest, status.vendorSkills.filter((s) => s.status === 'missing'))) {
    results.push({ step: v.command ?? 'npx skills', ok: v.ok, stderr: v.stderr ?? v.error });
  }

  resetPluginCache();
  const after = prereqStatus(all, order, ctx, ctx.dest);
  out({
    ok: results.every((r) => r.ok) && after.allSatisfied,
    results,
    prerequisites: after,
    note: 'Plugins installed now load in the NEXT session; restart Claude Code (or run /reload-plugins) before relying on them.',
  });
}
