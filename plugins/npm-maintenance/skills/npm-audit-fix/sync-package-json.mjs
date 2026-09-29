#!/usr/bin/env node
/**
 * Rewrites every direct dependency range in package.json to `^<installed>`,
 * where installed is the version recorded for that package in package-lock.json.
 * Prints one `name old -> new` line per changed range; prints nothing when the
 * two files already agree. Run from the repo root after `npm update` or
 * `npm audit fix`, then `npm install --package-lock-only` to refresh lock metadata.
 *
 * @throws {Error} When package.json or package-lock.json is missing or not JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const changed = [];

for (const field of [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    const installed = lock.packages[`node_modules/${name}`]?.version;
    if (!installed) continue;
    const next = `^${installed}`;
    if (range === next) continue;
    changed.push(`${name} ${range} -> ${next}`);
    pkg[field][name] = next;
  }
}

writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
console.log(changed.join('\n'));
