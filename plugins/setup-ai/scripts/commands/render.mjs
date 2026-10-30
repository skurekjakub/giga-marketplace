import fs from 'node:fs';
import path from 'node:path';
import { RECORD, die, exists, lf, out, readJson } from '../lib/util.mjs';
import { evalCond } from '../lib/conditions.mjs';
import { leftoverTokens, renderTokens } from '../lib/template.mjs';
import { provenance } from '../lib/marketplace.mjs';
import { attachEquivalents } from '../lib/repo-scan.mjs';
import { buildFiles, fileTodos, packTodos } from '../lib/packs.mjs';
import { mergeMcpFile, mergeSettingsFile } from '../lib/settings.mjs';
import { mergePackageScripts } from '../lib/package-scripts.mjs';
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
      // Compare and write in the file's own line endings: a CRLF checkout
      // (core.autocrlf) must neither miss a multi-line append nor mix EOLs.
      if (cur !== null && lf(cur).includes(text.trim())) continue;
      const eol = cur?.includes('\r\n') ? '\r\n' : '\n';
      const next = cur === null
        ? renderTokens(a.create ?? '', ctx.tokens) + text + '\n'
        : cur.replace(/\s*$/, eol + eol) + text.replace(/\n/g, eol) + eol;
      if (!dry) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, next);
      }
      appended.push({ to, pack: name, created: cur === null, text: text.trim() });
    }
  }
  return appended;
}

// The install record: what was installed, with which values, and a hash per
// file so `--update` can tell rendered files from user-edited ones. `fileEntries`
// holds this run's entries; a file it leaves out keeps its previous entry.
function writeRecord(all, order, ctx, fileEntries, prev, addedScripts, appended) {
  const fileHashes = { ...(prev?.files ?? {}), ...fileEntries };
  const packNames = [...new Set([...(prev?.packs ?? []).map((p) => p.name), ...order])];
  // A render of some packs must not forget what earlier renders required.
  const plugins = [...new Set([...(prev?.plugins ?? []), ...requiredPlugins(all, order, ctx).map((p) => p.id)])];
  const vendorSkills = [...(prev?.vendorSkills ?? [])];
  for (const { source, skill } of requiredVendorSkills(all, order, ctx)) {
    if (!vendorSkills.some((v) => v.skill === skill)) vendorSkills.push({ source, skill });
  }
  const { version, ...source } = provenance();
  const rec = {
    setupAiVersion: version,
    setupAiSource: source,
    installedAt: prev?.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    packs: packNames.map((n) => ({ name: n, version: all[n]?.version ?? null })),
    options: { ...(prev?.options ?? {}), ...ctx.options },
    tokens: { ...(prev?.tokens ?? {}), ...ctx.tokens },
    placeholders: { ...(prev?.placeholders ?? {}), ...ctx.placeholders },
    plugins,
    vendorSkills,
    // Only what this engine appended, so remove never strips a line the user had.
    appends: [...(prev?.appends ?? []), ...appended.filter((a) => !(prev?.appends ?? []).some((p) => p.to === a.to && p.text === a.text))],
    packageScripts: { ...(prev?.packageScripts ?? {}), ...Object.fromEntries(addedScripts.map((n) => [n, ctx.packageScripts[n]])) },
    files: fileHashes,
  };
  if (!Object.keys(rec.packageScripts).length) delete rec.packageScripts;
  if (!Object.keys(rec.placeholders).length) delete rec.placeholders;
  fs.mkdirSync(path.join(ctx.dest, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(ctx.dest, RECORD), JSON.stringify(rec, null, 2) + '\n');
}

/**
 * Writes the selected template files, applies appends, adds `packageScripts`
 * to package.json, merges `.claude/settings.json` and `.mcp.json`, and
 * writes the install record. `--adopt` records the repo's own files (or
 * their equivalents under another path) as the baseline instead of writing
 * the template over them. `--dry-run` computes the same report and writes
 * nothing. Returns the report; exits on invalid options, on options the
 * values leave unset (unless `--defaults`), or on missing tokens.
 */
export function renderPacks(args) {
  const { all, order, ctx, missingTokens, missingOptions, invalidOptions } = planFor(args);
  if (invalidOptions.length) die('invalid option values', { invalidOptions });
  if (missingTokens.length || missingOptions.length) {
    die('missing values — collect them first (an option left unset would silently mean "none"; pass --defaults to take the defaults)', { missingTokens, missingOptions });
  }
  const dry = Boolean(args['dry-run']);
  const record = readJson(path.join(ctx.dest, RECORD), null);
  const files = attachEquivalents(ctx.dest, buildFiles(all, order, ctx));
  const report = { written: [], unchanged: [], conflicts: [], adopted: [], appended: [], settings: null, errors: [], todos: [] };
  const fileEntries = {};
  const kept = new Set();

  for (const f of files) {
    const action = fileAction(ctx.dest, f, record, args);
    const hash = contentHash(f.buf);
    if (action === 'conflict' || action === 'adopted') {
      kept.add(f.dest);
      if (action === 'conflict') report.conflicts.push(f.dest);
      else report.adopted.push({ dest: f.dest, file: record.files[f.dest].adopted });
      continue;
    }
    if (action === 'adopt') {
      const file = exists(path.join(ctx.dest, f.dest)) ? f.dest : f.equivalent;
      kept.add(f.dest);
      fileEntries[f.dest] = { pack: f.pack, hash, adopted: file };
      report.adopted.push({ dest: f.dest, file });
      continue;
    }
    fileEntries[f.dest] = { pack: f.pack, hash };
    if (action === 'unchanged') report.unchanged.push(f.dest);
    else {
      if (!dry) {
        const target = path.join(ctx.dest, f.dest);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, f.buf);
      }
      report.written.push({ dest: f.dest, action });
    }
  }

  const appended = applyAppends(all, order, ctx, dry);
  report.appended = appended.map(({ text: _text, ...a }) => a);

  const scripts = mergePackageScripts(ctx.dest, ctx.packageScripts, dry);
  if (scripts?.error) report.errors.push(scripts.error);
  else if (scripts) report.packageScripts = scripts;

  const settings = mergeSettingsFile(all, order, ctx, dry);
  if (settings.error) report.errors.push(settings.error);
  else report.settings = settings.status;

  const mcp = mergeMcpFile(all, order, ctx, dry);
  if (mcp?.error) report.errors.push(mcp.error);
  else if (mcp) report.mcp = mcp;

  for (const f of files) {
    if (!f.text || kept.has(f.dest)) continue;
    for (const t of leftoverTokens(f.text)) report.errors.push(`${f.dest}: unfilled {{${t}}}`);
  }
  report.todos = fileTodos(files.filter((f) => !kept.has(f.dest)), ctx);

  if (!dry) writeRecord(all, order, ctx, fileEntries, record, report.packageScripts?.added ?? [], appended);
  return { ok: report.errors.length === 0, dryRun: dry, packs: order, ...report, manualSteps: packTodos(all, order, ctx) };
}

/** `render` — see renderPacks. */
export const cmdRender = (args) => out(renderPacks(args));
