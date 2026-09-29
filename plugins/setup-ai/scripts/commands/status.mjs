import fs from 'node:fs';
import path from 'node:path';
import { exists, out, pluginVersion, readJson } from '../lib/util.mjs';
import { loadPacks } from '../lib/packs.mjs';
import { prereqStatus } from '../lib/prereqs.mjs';
import { contentHash, ctxFor, readRecord, recordArgs } from '../lib/context.mjs';

// Every file the record lists: still as rendered, edited since, or gone.
function fileStates(dest, files) {
  const states = { unchanged: [], edited: [], missing: [] };
  for (const [rel, { pack, hash }] of Object.entries(files ?? {})) {
    const target = path.join(dest, rel);
    if (!exists(target)) states.missing.push({ file: rel, pack });
    else if (contentHash(fs.readFileSync(target)) === hash) states.unchanged.push({ file: rel, pack });
    else states.edited.push({ file: rel, pack });
  }
  return states;
}

/**
 * `status` — what setup-ai installed in the repo and how it stands now: packs
 * and whether newer templates exist, each recorded file's state, the
 * prerequisites on this machine, and which wizard mode would fix what's off.
 * Writes nothing.
 */
export function cmdStatus(args) {
  const dest = args.dest ?? process.cwd();
  const record = readRecord(dest);
  if (!record) return out({ ok: true, installed: false });
  const all = loadPacks();
  const packs = (record.packs ?? []).map((p) => ({
    name: p.name,
    version: p.version,
    available: all[p.name]?.version ?? null,
    outdated: Boolean(all[p.name]?.version && p.version && all[p.name].version !== p.version),
  }));
  const known = packs.filter((p) => all[p.name]).map((p) => p.name);
  const ctx = ctxFor(recordArgs(dest, record, known), known);
  const files = fileStates(dest, record.files);
  const prerequisites = prereqStatus(all, known, ctx, dest);
  const pkg = readJson(path.join(dest, 'package.json'), null);
  const packageScripts = Object.entries(record.packageScripts ?? {}).map(([name, command]) => ({
    name,
    state: pkg?.scripts?.[name] === undefined ? 'missing' : pkg.scripts[name] === command ? 'unchanged' : 'edited',
  }));

  const suggest = [];
  if (packs.some((p) => p.outdated)) suggest.push('update');
  if (files.missing.length || !prerequisites.allSatisfied) suggest.push('repair');
  out({
    ok: true,
    installed: true,
    setupAiVersion: { recorded: record.setupAiVersion, available: pluginVersion() },
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
    packs,
    unknownPacks: packs.filter((p) => !all[p.name]).map((p) => p.name),
    notInstalled: Object.keys(all).filter((n) => !packs.some((p) => p.name === n)),
    options: record.options ?? {},
    files: {
      counts: { unchanged: files.unchanged.length, edited: files.edited.length, missing: files.missing.length },
      edited: files.edited,
      missing: files.missing,
    },
    packageScripts,
    prerequisites,
    suggest,
  });
}
