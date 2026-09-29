import fs from 'node:fs';
import path from 'node:path';
import { GLOBAL_TOKENS, RECORD, die, exists, out, readJson } from '../lib/util.mjs';
import { evalCond } from '../lib/conditions.mjs';
import { renderTokens } from '../lib/template.mjs';
import { loadPacks } from '../lib/packs.mjs';
import { unmergeMcpFile, unmergeSettingsFile } from '../lib/settings.mjs';
import { unmergePackageScripts } from '../lib/package-scripts.mjs';
import { requiredPlugins, requiredVendorSkills } from '../lib/prereqs.mjs';
import { contentHash, ctxFor, packList, planFor, readRecord, recordArgs } from '../lib/context.mjs';
import { renderPacks } from './render.mjs';

// Deletes empty folders from `file`'s parent up to (not including) `dest`.
function pruneDirs(dest, file) {
  const root = path.resolve(dest);
  let dir = path.resolve(path.dirname(file));
  while (dir.startsWith(root + path.sep)) {
    if (!exists(dir) || fs.readdirSync(dir).length) return;
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

// Recorded files of the removed packs: deleted when still as rendered (or
// named in `--delete-edited`), kept when someone edited them.
function removeFiles(dest, record, removing, deleteEdited, dry) {
  const res = { deleted: [], keptEdited: [], alreadyGone: [] };
  for (const [rel, { pack, hash }] of Object.entries(record.files ?? {})) {
    if (!removing.includes(pack)) continue;
    const target = path.join(dest, rel);
    if (!exists(target)) {
      res.alreadyGone.push(rel);
      continue;
    }
    const edited = contentHash(fs.readFileSync(target)) !== hash;
    if (edited && !(deleteEdited === 'all' || deleteEdited.includes(rel))) {
      res.keptEdited.push(rel);
      continue;
    }
    if (!dry) {
      fs.rmSync(target);
      pruneDirs(dest, target);
    }
    res.deleted.push(rel);
  }
  return res;
}

// Takes the text each removed pack appended (per the record — never a line
// the user already had) back out of its file, unless a remaining pack appends
// the same text. A file the engine created is deleted when nothing but its
// stub is left.
function removeAppends(all, record, removing, remaining, ctx, dry) {
  const active = (names) => names.flatMap((n) => (all[n].appends ?? [])
    .filter((a) => !a.when || evalCond(a.when, ctx))
    .map((a) => ({ to: renderTokens(a.to, ctx.tokens), text: renderTokens(a.text, ctx.tokens).trim(), create: renderTokens(a.create ?? '', ctx.tokens).trim() })));
  const keep = active(remaining);
  const stubs = active(removing);
  const byFile = new Map();
  for (const a of (record.appends ?? []).filter((r) => removing.includes(r.pack))) {
    if (keep.some((k) => k.to === a.to && k.text === a.text)) continue;
    if (!byFile.has(a.to)) byFile.set(a.to, []);
    byFile.get(a.to).push(a);
  }
  const res = [];
  for (const [to, entries] of byFile) {
    const target = path.join(ctx.dest, to);
    if (!exists(target)) continue;
    let text = fs.readFileSync(target, 'utf8');
    const removed = entries.filter((a) => text.includes(a.text));
    // Appends land at the end of the file, so the last occurrence is ours.
    for (const a of removed) {
      const at = text.lastIndexOf(a.text);
      text = text.slice(0, at) + text.slice(at + a.text.length);
    }
    if (!removed.length) continue;
    text = text.replace(/(\r?\n){3,}/g, '$1$1').replace(/\s*$/, '\n');
    const stub = entries.some((a) => a.created) ? stubs.find((st) => st.to === to && st.create)?.create ?? '' : null;
    const deletedFile = stub !== null && (text.trim() === '' || text.trim() === stub);
    if (!dry) {
      if (deletedFile) fs.rmSync(target);
      else fs.writeFileSync(target, text);
    }
    res.push({ from: to, lines: removed.length, deletedFile });
  }
  return res;
}

// Vendor skills no remaining pack needs; with `--prune-vendor-skills` their
// folders and skills-lock.json entries are deleted.
function pruneVendorSkills(dest, skills, dry) {
  const lockFile = path.join(dest, 'skills-lock.json');
  const lock = readJson(lockFile, null);
  for (const s of skills) {
    const dir = path.join(dest, '.claude', 'skills', s);
    if (!dry && exists(dir)) fs.rmSync(dir, { recursive: true, force: true });
    if (lock?.skills) delete lock.skills[s];
  }
  if (!dry && lock) fs.writeFileSync(lockFile, JSON.stringify(lock, null, 2) + '\n');
}

// The record without the removed packs: their files, option keys and the
// tokens only they declare go; plugins and vendor skills are recomputed.
function nextRecord(all, record, removing, remaining, ctxRemaining) {
  const globals = Object.keys(readJson(GLOBAL_TOKENS, {}));
  const stillDeclared = new Set([...globals, ...remaining.flatMap((n) => Object.keys(all[n].tokens ?? {}))]);
  const dropTokens = removing.flatMap((n) => Object.keys(all[n].tokens ?? {})).filter((t) => !stillDeclared.has(t));
  const dropOptions = removing.flatMap((n) => Object.keys(all[n].options ?? {}));
  const omit = (obj, keys) => Object.fromEntries(Object.entries(obj ?? {}).filter(([k]) => !keys.includes(k)));
  return {
    ...record,
    updatedAt: new Date().toISOString(),
    packs: record.packs.filter((p) => !removing.includes(p.name)),
    options: omit(record.options, dropOptions),
    tokens: omit(record.tokens, dropTokens),
    plugins: requiredPlugins(all, remaining, ctxRemaining).map((p) => p.id),
    vendorSkills: requiredVendorSkills(all, remaining, ctxRemaining).map(({ source, skill }) => ({ source, skill })),
    files: Object.fromEntries(Object.entries(record.files ?? {}).filter(([, f]) => !removing.includes(f.pack))),
    appends: (record.appends ?? []).filter((x) => !removing.includes(x.pack)),
  };
}

/**
 * `remove` — uninstalls packs: deletes their unedited files, takes their
 * appends, hooks and MCP servers back out, updates the record, and re-renders
 * the remaining packs with `--update` so sections that mentioned the removed
 * packs drop out. Plugins are never uninstalled; they are reported.
 */
export function cmdRemove(args) {
  const dest = args.dest ?? process.cwd();
  const dry = Boolean(args['dry-run']);
  const record = readRecord(dest);
  if (!record) die('nothing to remove — this repo has no .claude/setup-ai.json');
  const all = loadPacks();
  const recorded = record.packs.map((p) => p.name);
  const removing = packList(args);
  const notInstalled = removing.filter((n) => !recorded.includes(n));
  if (notInstalled.length) die('not installed', { notInstalled, installed: recorded });
  const unknown = removing.filter((n) => !all[n]);
  if (unknown.length) die('these packs are not in this setup-ai version — cannot tell what they wrote', { unknown });
  const remaining = recorded.filter((n) => !removing.includes(n) && all[n]);
  const dependents = remaining
    .map((n) => ({ pack: n, requires: (all[n].requires?.packs ?? []).filter((d) => removing.includes(d)) }))
    .filter((d) => d.requires.length);
  if (dependents.length) die('other installed packs require these — remove them too, or keep these', { dependents });

  const next = nextRecord(all, record, removing, remaining, ctxFor(recordArgs(dest, record, remaining, { exclude: removing }), remaining));
  if (remaining.length) {
    // Checked before anything is deleted, so a failing re-render can't leave
    // the repo half-removed.
    const { missingTokens, invalidOptions } = planFor(recordArgs(dest, next, remaining, { exclude: removing }));
    if (missingTokens.length || invalidOptions.length) die('the remaining packs cannot be re-rendered from the record', { missingTokens, invalidOptions });
  }
  const ctxBefore = ctxFor(recordArgs(dest, record, recorded), recorded);
  const deleteEdited = args['delete-edited'] === 'all' ? 'all' : String(args['delete-edited'] ?? '').split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean);
  const report = { dryRun: dry, removed: removing, remaining, errors: [] };

  report.files = removeFiles(dest, record, removing, deleteEdited, dry);
  report.appends = removeAppends(all, record, removing, remaining, ctxBefore, dry);
  const settings = unmergeSettingsFile(all, removing, ctxBefore, dry);
  if (settings.error) report.errors.push(settings.error);
  else report.settings = settings.status;
  const mcp = unmergeMcpFile(all, removing, ctxBefore, dry);
  if (mcp?.error) report.errors.push(mcp.error);
  else if (mcp) report.mcp = mcp;

  const unneededPlugins = (record.plugins ?? []).filter((id) => !next.plugins.includes(id));
  report.pluginsNoLongerRequired = unneededPlugins.map((id) => ({ id, uninstall: `claude plugin uninstall ${id} --scope project` }));
  const unneededSkills = (record.vendorSkills ?? []).map((v) => v.skill).filter((s) => !next.vendorSkills.some((v) => v.skill === s));
  report.vendorSkillsNoLongerRequired = unneededSkills;
  if (args['prune-vendor-skills'] && unneededSkills.length) {
    pruneVendorSkills(dest, unneededSkills, dry);
    report.vendorSkillsPruned = unneededSkills;
  }

  if (!remaining.length) {
    report.packageScripts = unmergePackageScripts(dest, record.packageScripts, dry);
    if (!dry) {
      fs.rmSync(path.join(dest, RECORD));
      pruneDirs(dest, path.join(dest, RECORD));
    }
    report.record = 'deleted';
  } else {
    if (!dry) fs.writeFileSync(path.join(dest, RECORD), JSON.stringify(next, null, 2) + '\n');
    report.record = 'updated';
    const r = renderPacks(recordArgs(dest, next, remaining, { update: true, 'dry-run': dry, exclude: removing }));
    report.rerender = { written: r.written, conflicts: r.conflicts, errors: r.errors };
    report.errors.push(...r.errors);
  }
  out({ ok: report.errors.length === 0, ...report });
}
