import fs from 'node:fs';
import path from 'node:path';
import { RECORD, die, exists, out, pluginVersion, readJson } from '../lib/util.mjs';
import { evalCond } from '../lib/conditions.mjs';
import { leftoverTokens, renderTokens, todoPlaceholders } from '../lib/template.mjs';
import { buildFiles, packTodos } from '../lib/packs.mjs';
import { mergeMcpFile, mergeSettingsFile } from '../lib/settings.mjs';
import { requiredPlugins, requiredVendorSkills } from '../lib/prereqs.mjs';
import { contentHash, fileAction, planFor } from '../lib/context.mjs';

// Adds each pack's `appends` text to its file (creating it) exactly once.
function applyAppends(all, order, ctx, dry) {
  const appended = [];
  for (const name of order) {
    for (const a of all[name].appends ?? []) {
      if (a.when && !evalCond(a.when, ctx)) continue;
      const to = renderTokens(a.to, ctx.tokens);
      const text = renderTokens(a.text, ctx.tokens);
      const target = path.join(ctx.dest, to);
      const cur = exists(target) ? fs.readFileSync(target, 'utf8') : null;
      if (cur !== null && cur.includes(text.trim())) continue;
      const next = cur === null ? renderTokens(a.create ?? '', ctx.tokens) + text + '\n' : cur.replace(/\s*$/, '\n\n') + text + '\n';
      if (!dry) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, next);
      }
      appended.push({ to, pack: name, created: cur === null });
    }
  }
  return appended;
}

// The install record: what was installed, with which values, and a hash per
// file so `--update` can tell rendered files from user-edited ones.
function writeRecord(all, order, ctx, files, conflicts, prev) {
  const fileHashes = { ...(prev?.files ?? {}) };
  for (const f of files) if (!conflicts.includes(f.dest)) fileHashes[f.dest] = { pack: f.pack, hash: contentHash(f.buf) };
  const packNames = [...new Set([...(prev?.packs ?? []).map((p) => p.name), ...order])];
  // A render of some packs must not forget what earlier renders required.
  const plugins = [...new Set([...(prev?.plugins ?? []), ...requiredPlugins(all, order, ctx).map((p) => p.id)])];
  const vendorSkills = [...(prev?.vendorSkills ?? [])];
  for (const { source, skill } of requiredVendorSkills(all, order, ctx)) {
    if (!vendorSkills.some((v) => v.skill === skill)) vendorSkills.push({ source, skill });
  }
  const rec = {
    setupAiVersion: pluginVersion(),
    installedAt: prev?.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    packs: packNames.map((n) => ({ name: n, version: all[n]?.version ?? null })),
    options: { ...(prev?.options ?? {}), ...ctx.options },
    tokens: { ...(prev?.tokens ?? {}), ...ctx.tokens },
    plugins,
    vendorSkills,
    files: fileHashes,
  };
  fs.mkdirSync(path.join(ctx.dest, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(ctx.dest, RECORD), JSON.stringify(rec, null, 2) + '\n');
}

/**
 * `render` — writes the selected template files, applies appends, merges
 * `.claude/settings.json` and `.mcp.json`, and writes the install record.
 * `--dry-run` computes the same report and writes nothing.
 */
export function cmdRender(args) {
  const { all, order, ctx, missingTokens, invalidOptions } = planFor(args);
  if (invalidOptions.length) die('invalid option values', { invalidOptions });
  if (missingTokens.length) die('missing token values — collect them first', { missingTokens });
  const dry = Boolean(args['dry-run']);
  const record = readJson(path.join(ctx.dest, RECORD), null);
  const files = buildFiles(all, order, ctx);
  const report = { written: [], unchanged: [], conflicts: [], appended: [], settings: null, errors: [], todos: [] };

  for (const f of files) {
    const action = fileAction(ctx.dest, f, record, args);
    if (action === 'unchanged') report.unchanged.push(f.dest);
    else if (action === 'conflict') report.conflicts.push(f.dest);
    else {
      if (!dry) {
        const target = path.join(ctx.dest, f.dest);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, f.buf);
      }
      report.written.push({ dest: f.dest, action });
    }
  }

  report.appended = applyAppends(all, order, ctx, dry);

  const settings = mergeSettingsFile(all, order, ctx, dry);
  if (settings.error) report.errors.push(settings.error);
  else report.settings = settings.status;

  const mcp = mergeMcpFile(all, order, ctx, dry);
  if (mcp?.error) report.errors.push(mcp.error);
  else if (mcp) report.mcp = mcp;

  for (const f of files) {
    if (!f.text || report.conflicts.includes(f.dest)) continue;
    for (const t of leftoverTokens(f.text)) report.errors.push(`${f.dest}: unfilled {{${t}}}`);
    const todos = todoPlaceholders(f.text);
    if (todos.length) report.todos.push({ file: f.dest, placeholders: todos });
  }

  if (!dry) writeRecord(all, order, ctx, files, report.conflicts, record);
  out({ ok: report.errors.length === 0, dryRun: dry, packs: order, ...report, manualSteps: packTodos(all, order, ctx) });
}
