#!/usr/bin/env node
// Check that every quoted citation in a research README appears in the
// evidence file it points at.
//
//   node check-claims.mjs <record-dir>
//
// Citation syntax in README.md: [NN: "verbatim snippet"], where NN is the
// evidence file number. Several may sit in one line. The check is a
// whitespace-, case- and quote-style-insensitive substring match against
// evidence/NN-*.txt (or .md, then any other NN-* file).
//
// Fails (exit 1) when a snippet is missing from its file, when NN matches no
// evidence file, or when a numbered item under "## Reasoning" carries no
// quoted citation at all.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node check-claims.mjs <record-dir>');
  process.exit(2);
}

const readme = readFileSync(join(dir, 'README.md'), 'utf8');
const evDir = join(dir, 'evidence');
const evFiles = readdirSync(evDir);

const norm = s => s
  .replace(/[‘’‚′]/g, "'")
  .replace(/[“”„″]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .trim();

const cache = new Map();
function evidenceText(nn) {
  if (cache.has(nn)) return cache.get(nn);
  const mine = evFiles.filter(f => f.startsWith(`${nn}-`));
  const rank = f => (f.endsWith('.txt') ? 0 : f.endsWith('.md') ? 1 : 2);
  mine.sort((a, b) => rank(a) - rank(b));
  const text = mine.length ? norm(mine.map(f => readFileSync(join(evDir, f), 'utf8')).join('\n')) : null;
  cache.set(nn, { text, files: mine });
  return cache.get(nn);
}

const CITE = /\[(\d{2,3}):\s*"([^"]+)"\]/g;
let failures = 0;
let checked = 0;

for (const m of readme.matchAll(CITE)) {
  const [, nn, snippet] = m;
  const { text, files } = evidenceText(nn);
  checked++;
  if (text === null) {
    console.log(`NO FILE  [${nn}] "${snippet}"`);
    failures++;
  } else if (!text.includes(norm(snippet))) {
    console.log(`MISSING  [${nn}] "${snippet}"  (searched ${files.join(', ')})`);
    failures++;
  }
}

// Every numbered item in the Reasoning section needs at least one quoted citation.
const reasoning = /^## Reasoning\s*$([\s\S]*?)(?=^## )/m.exec(readme + '\n## end\n')?.[1] ?? '';
const items = reasoning.split(/^(?=\d+\.\s)/m).filter(b => /^\d+\.\s/.test(b));
for (const item of items) {
  CITE.lastIndex = 0;
  if (!CITE.test(item)) {
    console.log(`UNCITED  ${item.split('\n')[0].slice(0, 100)}`);
    failures++;
  }
}
if (!items.length) {
  console.log('UNCITED  no numbered items found under "## Reasoning"');
  failures++;
}

console.log(`${checked} citation(s) checked, ${items.length} reasoning item(s), ${failures} problem(s)`);
process.exit(failures ? 1 : 0);
