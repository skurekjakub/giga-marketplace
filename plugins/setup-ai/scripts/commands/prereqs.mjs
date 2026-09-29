import { out } from '../lib/util.mjs';
import { run } from '../lib/proc.mjs';
import { loadPacks, resolvePacks } from '../lib/packs.mjs';
import { prereqStatus, resetPluginCache } from '../lib/prereqs.mjs';
import { vendorInstall } from '../lib/vendor.mjs';
import { ctxFor, packList } from '../lib/context.mjs';

/**
 * `prereqs` — installs what can be installed for the resolved packs: missing
 * marketplaces, plugins (project scope) and vendor skills. CLIs and env vars
 * are only reported; the user installs or sets those. `--dry-run` lists the
 * commands it would run and runs none of them.
 */
export function cmdPrereqs(args) {
  const all = loadPacks();
  const { order } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const dry = Boolean(args['dry-run']);
  const status = prereqStatus(all, order, ctx, ctx.dest);
  const results = [];
  const exec = (argv) => {
    const label = `claude ${argv.join(' ')}`;
    if (dry) return results.push({ step: label, ok: true, dryRun: true });
    const r = run('claude', argv, { cwd: ctx.dest });
    return results.push({ step: label, ok: r.code === 0, stderr: r.code ? r.stderr.slice(-1500) : undefined });
  };

  const addedMarkets = new Set();
  for (const p of status.plugins.filter((x) => x.status !== 'installed')) {
    const market = p.id.split('@')[1];
    if (p.marketplaceKnown === false && p.marketplace?.repo && !addedMarkets.has(market)) {
      exec(['plugin', 'marketplace', 'add', p.marketplace.repo]);
      addedMarkets.add(market);
    }
    exec(p.status === 'disabled'
      ? ['plugin', 'enable', p.id, '--scope', 'project']
      : ['plugin', 'install', p.id, '--scope', 'project']);
  }
  for (const v of vendorInstall(ctx.dest, status.vendorSkills.filter((s) => s.status === 'missing'), dry)) {
    results.push({ step: v.command ?? 'npx skills', ok: v.ok, dryRun: v.dryRun, stderr: v.stderr ?? v.error });
  }

  resetPluginCache();
  const after = dry ? status : prereqStatus(all, order, ctx, ctx.dest);
  out({
    ok: results.every((r) => r.ok) && (dry || after.allSatisfied),
    dryRun: dry,
    results,
    prerequisites: after,
    note: dry
      ? 'Dry run: nothing was installed.'
      : 'Plugins installed now load in the NEXT session; restart Claude Code (or run /reload-plugins) before relying on them.',
  });
}
