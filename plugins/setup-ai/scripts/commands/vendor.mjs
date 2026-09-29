import path from 'node:path';
import { RECORD, die, out, readJson } from '../lib/util.mjs';
import { loadPacks, resolvePacks } from '../lib/packs.mjs';
import { requiredVendorSkills } from '../lib/prereqs.mjs';
import { vendorInstall, vendorRestore, vendorSkillPresent } from '../lib/vendor.mjs';
import { ctxFor, packList } from '../lib/context.mjs';

/**
 * `vendor check|install|restore` — third-party skills for `--packs`, or for the
 * install record when no packs are given.
 */
export function cmdVendor(args) {
  const mode = args._[1];
  const dest = args.dest ?? process.cwd();
  if (mode === 'restore') return out({ ok: true, results: vendorRestore(dest) });

  let items;
  if (args.packs) {
    const all = loadPacks();
    const { order } = resolvePacks(all, packList(args));
    items = requiredVendorSkills(all, order, ctxFor(args, order));
  } else items = readJson(path.join(dest, RECORD), null)?.vendorSkills ?? [];
  const status = items.map((i) => ({ ...i, status: vendorSkillPresent(dest, i.skill) ? 'installed' : 'missing' }));

  if (mode === 'check') return out({ ok: status.every((s) => s.status === 'installed'), skills: status });
  if (mode === 'install') {
    const results = vendorInstall(dest, status.filter((s) => s.status === 'missing'));
    return out({ ok: results.every((r) => r.ok), results });
  }
  return die('usage: vendor install|check|restore --dest <repo>');
}
