import path from 'node:path';
import { RECORD, VENDOR_NODE_MIN, exists, nodeAtLeast, readJson } from './util.mjs';
import { run } from './proc.mjs';

/** True when `<dest>/.claude/skills/<skill>/SKILL.md` exists. */
export const vendorSkillPresent = (dest, skill) => exists(path.join(dest, '.claude', 'skills', skill, 'SKILL.md'));

// --copy writes real folders into .claude/skills instead of links into
// .agents/skills (junctions on Windows), so the committed repo is portable.
function npxSkillsAdd(dest, source, skills) {
  const env = { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1' };
  const argv = ['-y', 'skills', 'add', source, '--skill', ...skills, '-a', 'claude-code', '-y', '--copy'];
  const r = run('npx', argv, { cwd: dest, env });
  return { source, skills, ok: r.code === 0, command: `npx ${argv.join(' ')}`, stderr: r.code === 0 ? undefined : r.stderr.slice(-2000) };
}

function groupBySource(items) {
  const m = new Map();
  for (const it of items) {
    if (!m.has(it.source)) m.set(it.source, []);
    m.get(it.source).push(it.skill);
  }
  return [...m.entries()];
}

/**
 * Installs `{ source, skill }` items with `npx skills`, one call per source.
 *
 * @returns {{source, skills, ok, command, stderr?}[] | [{ok: false, error}]}
 */
export function vendorInstall(dest, items) {
  if (!items.length) return [];
  if (!nodeAtLeast(VENDOR_NODE_MIN)) {
    return [{ ok: false, error: `npx skills needs Node >= ${VENDOR_NODE_MIN.join('.')}; this is ${process.versions.node}` }];
  }
  return groupBySource(items).map(([source, skills]) => npxSkillsAdd(dest, source, skills));
}

/**
 * Re-installs the vendor skills recorded in `skills-lock.json` and the install
 * record that are missing from `.claude/skills`. (`npx skills
 * experimental_install` can't be used: it never writes to `.claude/skills`.)
 */
export function vendorRestore(dest) {
  const lock = readJson(path.join(dest, 'skills-lock.json'), null);
  const record = readJson(path.join(dest, RECORD), null);
  const items = [];
  for (const [skill, e] of Object.entries(lock?.skills ?? {})) items.push({ skill, source: e.ref ? `${e.source}#${e.ref}` : e.source });
  for (const v of record?.vendorSkills ?? []) if (!items.some((i) => i.skill === v.skill)) items.push(v);
  return vendorInstall(dest, items.filter((i) => !vendorSkillPresent(dest, i.skill)));
}
