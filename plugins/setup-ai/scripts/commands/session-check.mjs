import fs from 'node:fs';
import path from 'node:path';
import { RECORD, out, readJson, sha } from '../lib/util.mjs';
import { evalCond } from '../lib/conditions.mjs';
import { onPath } from '../lib/proc.mjs';
import { loadPacks } from '../lib/packs.mjs';
import { envVarSet } from '../lib/prereqs.mjs';
import { vendorRestore, vendorSkillPresent } from '../lib/vendor.mjs';

const RESTORE_INTERVAL_MS = 24 * 3600 * 1000;

// Tools and env vars the installed packs need on *this* machine — a teammate
// who cloned the repo may not have them. Only cheap PATH/env checks run here.
function runtimeNotes(all, record, dest) {
  const notes = [];
  const ctx = { packs: [], options: record.options ?? {}, tokens: {}, detect: null };
  for (const p of record.packs ?? []) {
    for (const c of all[p.name]?.requires?.cli ?? []) {
      if (c.optional || (c.when && !evalCond(c.when, ctx))) continue;
      if (!onPath(c.name)) notes.push(`${c.name} is not installed but the ${p.name} pack needs it (${c.why})`);
    }
    for (const e of all[p.name]?.requires?.env ?? []) {
      if (e.when && !evalCond(e.when, ctx)) continue;
      if (!envVarSet(dest, e.name)) notes.push(`environment variable ${e.name} is not set but the ${p.name} pack needs it (${e.why})`);
    }
  }
  return notes;
}

// Missing vendor skills: a notice, or — with the plugin's
// autoInstallVendorSkills option on — a restore, at most once a day per repo.
function vendorNotes(record, dest) {
  const missing = (record.vendorSkills ?? []).filter((v) => !vendorSkillPresent(dest, v.skill));
  if (!missing.length) return [];
  const names = missing.map((m) => m.skill).join(', ');
  const auto = String(process.env.CLAUDE_PLUGIN_OPTION_AUTOINSTALLVENDORSKILLS ?? '').toLowerCase() === 'true';
  const dataDir = process.env.CLAUDE_PLUGIN_DATA;
  const stampFile = dataDir ? path.join(dataDir, `restore-${sha(Buffer.from(path.resolve(dest)))}.json`) : null;
  const last = stampFile ? readJson(stampFile, {}).at ?? 0 : 0;
  if (!auto || Date.now() - last <= RESTORE_INTERVAL_MS) {
    return [`missing vendor skills: ${names} — run /setup-ai:bootstrap-agent-workspace repair`];
  }
  if (stampFile) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(stampFile, JSON.stringify({ at: Date.now() }));
  }
  const failed = vendorRestore(dest).filter((r) => !r.ok);
  return [failed.length
    ? `auto-restore of vendor skills failed for ${failed.map((f) => f.source).join(', ')} — run /setup-ai:bootstrap-agent-workspace repair`
    : `restored vendor skills: ${names} (they load next session)`];
}

/**
 * `session-check` — the plugin's SessionStart hook. Silent (and cheap) in repos
 * that were never bootstrapped; otherwise one `additionalContext` line about
 * outdated packs, missing tools or env vars, and missing vendor skills.
 */
export function cmdSessionCheck(args) {
  const dest = args.dest ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const record = readJson(path.join(dest, RECORD), null);
  if (!record) return;
  const all = loadPacks();
  const notes = [];
  const outdated = (record.packs ?? []).filter((p) => all[p.name]?.version && p.version && all[p.name].version !== p.version);
  if (outdated.length) {
    notes.push(`template packs updated (${outdated.map((p) => `${p.name} ${p.version}→${all[p.name].version}`).join(', ')}) — run /setup-ai:bootstrap-agent-workspace update`);
  }
  notes.push(...runtimeNotes(all, record, dest), ...vendorNotes(record, dest));
  if (!notes.length) return;
  out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `setup-ai: ${notes.join('; ')}.` } });
}
