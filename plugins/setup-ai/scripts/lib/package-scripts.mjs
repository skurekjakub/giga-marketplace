import fs from 'node:fs';
import path from 'node:path';
import { exists } from './util.mjs';

/** Names of the scripts `detect` treats as the repo's one verify command. */
export const VERIFY_SCRIPT_NAMES = ['verify', 'check', 'ci'];

// Keep the file's own indentation and line endings so the diff is just the
// added lines.
function style(text) {
  const minified = !text.trim().includes('\n');
  const indent = minified ? '' : text.match(/^[ \t]+(?=")/m)?.[0] ?? '  ';
  return { indent, eol: text.includes('\r\n') ? '\r\n' : '\n' };
}

/**
 * Adds the values file's `packageScripts` to `<dest>/package.json`. Only
 * missing names are added — a script the repo already has is the repo's, and
 * is reported under `kept` even when its command differs.
 *
 * @returns {null | {added: string[], kept: string[]} | {error: string}}
 */
export function mergePackageScripts(dest, scripts, dry) {
  const names = Object.keys(scripts ?? {});
  if (!names.length) return null;
  const file = path.join(dest, 'package.json');
  if (!exists(file)) return { error: 'packageScripts given but the repo has no package.json — scripts not added' };
  const text = fs.readFileSync(file, 'utf8');
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return { error: 'package.json is not valid JSON — scripts not added' };
  }
  pkg.scripts ??= {};
  const kept = names.filter((n) => n in pkg.scripts);
  const added = names.filter((n) => !(n in pkg.scripts));
  for (const n of added) pkg.scripts[n] = scripts[n];
  if (added.length && !dry) {
    const { indent, eol } = style(text);
    fs.writeFileSync(file, JSON.stringify(pkg, null, indent).replace(/\n/g, eol) + eol);
  }
  return { added, kept };
}

/**
 * Removes scripts setup-ai added (named in the install record) whose command
 * is still the one it wrote; a script someone changed since is kept.
 *
 * @returns {{removed: string[], kept: string[]}}
 */
export function unmergePackageScripts(dest, recorded, dry) {
  const file = path.join(dest, 'package.json');
  const res = { removed: [], kept: [] };
  if (!recorded || !exists(file)) return res;
  const text = fs.readFileSync(file, 'utf8');
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return { ...res, kept: Object.keys(recorded) };
  }
  for (const [name, cmd] of Object.entries(recorded)) {
    if (pkg.scripts?.[name] === cmd) {
      delete pkg.scripts[name];
      res.removed.push(name);
    } else if (pkg.scripts && name in pkg.scripts) res.kept.push(name);
  }
  if (res.removed.length && !dry) {
    const { indent, eol } = style(text);
    fs.writeFileSync(file, JSON.stringify(pkg, null, indent).replace(/\n/g, eol) + eol);
  }
  return res;
}
