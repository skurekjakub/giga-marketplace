import path from 'node:path';
import { RECORD, out, readJson } from '../lib/util.mjs';
import { buildFiles, defaultFor, fileTodos, packTodos } from '../lib/packs.mjs';
import { prereqStatus } from '../lib/prereqs.mjs';
import { fileAction, planFor } from '../lib/context.mjs';
import { mergePackageScripts } from '../lib/package-scripts.mjs';
import { attachEquivalents } from '../lib/repo-scan.mjs';

/**
 * `plan` — resolves packs and reports options, prerequisites, missing tokens
 * and options, manual steps, and — once every value is in — the file actions
 * a render would take, the repo files a template would land on (`existing`:
 * same path, or an equivalent under another path, each adoptable with
 * `--adopt`), and the skeleton placeholders left with candidate values.
 * Writes nothing.
 */
export function cmdPlan(args) {
  const { all, order, pulledIn, recommended, ctx, missingTokens, defaultedTokens, missingOptions, defaultedOptions, invalidOptions } = planFor(args);
  const prerequisites = prereqStatus(all, order, ctx, ctx.dest);
  let files = [];
  let built = [];
  if (!missingTokens.length && !invalidOptions.length && !missingOptions.length) {
    const record = readJson(path.join(ctx.dest, RECORD), null);
    built = attachEquivalents(ctx.dest, buildFiles(all, order, ctx));
    files = built.map((f) => ({ pack: f.pack, dest: f.dest, action: fileAction(ctx.dest, f, record, args), equivalent: f.equivalent }));
  }
  const existing = files.flatMap((f) => {
    if (f.action === 'conflict') return [{ dest: f.dest, pack: f.pack, file: f.dest, how: 'same-path' }];
    if (f.action === 'create' && f.equivalent) return [{ dest: f.dest, pack: f.pack, file: f.equivalent, how: 'equivalent' }];
    return [];
  });
  const options = Object.fromEntries(order.flatMap((n) => Object.entries(all[n].options ?? {})));
  out({
    ok: true,
    packs: order,
    pulledIn,
    recommended,
    options,
    optionDefaults: Object.fromEntries(Object.entries(options).map(([key, o]) => [key, defaultFor(o, ctx)])),
    missingOptions,
    defaultedOptions,
    prerequisites,
    missingTokens,
    defaultedTokens,
    invalidOptions,
    manualSteps: packTodos(all, order, ctx),
    packageScripts: mergePackageScripts(ctx.dest, ctx.packageScripts, true),
    files: files.map(({ equivalent: _e, ...f }) => f),
    conflicts: files.filter((f) => f.action === 'conflict').map((f) => f.dest),
    existing,
    todos: fileTodos(built.filter((f) => !['conflict', 'adopted', 'adopt'].includes(files.find((x) => x.dest === f.dest)?.action)), ctx),
  });
}
