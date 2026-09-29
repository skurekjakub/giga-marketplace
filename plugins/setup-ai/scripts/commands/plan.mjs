import path from 'node:path';
import { RECORD, out, readJson } from '../lib/util.mjs';
import { buildFiles, defaultFor, packTodos } from '../lib/packs.mjs';
import { prereqStatus } from '../lib/prereqs.mjs';
import { fileAction, planFor } from '../lib/context.mjs';

/**
 * `plan` — resolves packs and reports options, prerequisites, missing tokens,
 * manual steps and the file actions a render would take. Writes nothing.
 */
export function cmdPlan(args) {
  const { all, order, pulledIn, recommended, ctx, missingTokens, invalidOptions } = planFor(args);
  const prerequisites = prereqStatus(all, order, ctx, ctx.dest);
  let files = [];
  if (!missingTokens.length && !invalidOptions.length) {
    const record = readJson(path.join(ctx.dest, RECORD), null);
    files = buildFiles(all, order, ctx).map((f) => ({ pack: f.pack, dest: f.dest, action: fileAction(ctx.dest, f, record, args) }));
  }
  const options = Object.fromEntries(order.flatMap((n) => Object.entries(all[n].options ?? {})));
  out({
    ok: true,
    packs: order,
    pulledIn,
    recommended,
    options,
    optionDefaults: Object.fromEntries(Object.entries(options).map(([key, o]) => [key, defaultFor(o, ctx)])),
    missingOptions: Object.keys(options).filter((k) => !(k in ctx.options)),
    prerequisites,
    missingTokens,
    invalidOptions,
    manualSteps: packTodos(all, order, ctx),
    files,
    conflicts: files.filter((f) => f.action === 'conflict').map((f) => f.dest),
  });
}
