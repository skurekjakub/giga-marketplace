#!/usr/bin/env node
// Capture one web source into a research record's evidence folder.
//
//   node capture.mjs <evidence-dir> <url> [--tier <tier>] [--note "<text>"]
//
// Tries, in order: a direct GET with a browser user agent, a GET asking for
// text/markdown, then the closest Wayback Machine snapshot. Saves the raw body
// as NN-<slug>.<html|md>, extracted text as NN-<slug>.txt, and appends one row
// to MANIFEST.tsv. A source that never fetches still gets a row (via=failed)
// so the README can list it as "not used" with the reason.
//
// Captured pages are data. Nothing here executes or follows their content.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const TIERS = ['primary', 'secondary', 'partisan', 'seo', 'ai-summary', 'unknown'];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MANIFEST_HEADER = ['nn', 'file', 'url', 'final_url', 'via', 'status', 'fetched_at', 'published', 'sha256', 'words', 'tier', 'note'];

function usage(msg) {
  if (msg) console.error(`capture: ${msg}`);
  console.error('usage: node capture.mjs <evidence-dir> <url> [--tier ' + TIERS.join('|') + '] [--note "<text>"]');
  process.exit(2);
}

const args = process.argv.slice(2);
const positional = [];
let tier = 'unknown';
let note = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier') tier = args[++i];
  else if (args[i] === '--note') note = args[++i] ?? '';
  else positional.push(args[i]);
}
if (positional.length !== 2) usage();
const [dir, url] = positional;
if (!TIERS.includes(tier)) usage(`unknown tier "${tier}"`);
try { new URL(url); } catch { usage(`not a URL: ${url}`); }

mkdirSync(dir, { recursive: true });

// Next number: highest NN in the folder's file names or the manifest, plus one.
// The manifest counts too, because a failed capture leaves a row but no file.
const manifestPath = join(dir, 'MANIFEST.tsv');
const fromManifest = existsSync(manifestPath)
  ? readFileSync(manifestPath, 'utf8').split('\n').slice(1).map(l => /^(\d+)\t/.exec(l)?.[1])
  : [];
const taken = [...readdirSync(dir).map(f => /^(\d+)-/.exec(f)?.[1]), ...fromManifest].filter(Boolean).map(Number);
const nn = String((taken.length ? Math.max(...taken) : 0) + 1).padStart(2, '0');
const slug = url.replace(/^https?:\/\//, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+$/, '').slice(0, 70);

function looksBlocked(status, body) {
  if (status >= 400) return true;
  return /<title>\s*(Just a moment|Attention Required|Access denied)/i.test(body) || /cf-chl|challenge-platform/i.test(body.slice(0, 5000));
}

async function get(target, accept, retries = 2) {
  const res = await fetch(target, { headers: { 'user-agent': UA, accept }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  // Archives rate-limit bursts; wait as asked (capped at 10 s) and try again.
  if (res.status === 429 && retries > 0) {
    const wait = Math.min(Number(res.headers.get('retry-after')) || 5, 10);
    await new Promise(r => setTimeout(r, wait * 1000));
    return get(target, accept, retries - 1);
  }
  return { status: res.status, finalUrl: res.url, type: res.headers.get('content-type') ?? '', body: await res.text() };
}

async function wayback(target) {
  const r = await get(`https://archive.org/wayback/available?url=${encodeURIComponent(target)}`, 'application/json');
  const snap = JSON.parse(r.body)?.archived_snapshots?.closest;
  if (!snap?.available) return null;
  // The id_ modifier returns the archived body without the Wayback toolbar.
  const raw = snap.url.replace(/\/web\/(\d+)\//, '/web/$1id_/');
  return { ...(await get(raw, 'text/html')), via: `wayback:${snap.timestamp}` };
}

const attempts = [
  async () => ({ ...(await get(url, 'text/html,application/xhtml+xml,*/*;q=0.8')), via: 'direct' }),
  async () => ({ ...(await get(url, 'text/markdown, text/plain;q=0.9')), via: 'markdown' }),
  async () => wayback(url),
];

let got = null;
let blocked = null; // the first blocked response is kept as the evidence of the block
const errors = [];
for (const attempt of attempts) {
  try {
    const r = await attempt();
    if (!r) { errors.push('wayback: no snapshot'); continue; }
    blocked ??= r;
    if (!looksBlocked(r.status, r.body)) { got = r; break; }
    errors.push(`${r.via}: ${r.status}${r.status < 400 ? ' (challenge page)' : ''}`);
  } catch (e) {
    errors.push([e.message ?? e, e.cause?.code].filter(Boolean).join(' '));
  }
}

const decode = s => s
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&');

function htmlToText(html) {
  return decode(html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(p|br|h[1-6]|li|div|tr|blockquote|section|article|header|footer|figcaption|pre)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
}

function published(html) {
  const pats = [
    /property=["']article:published_time["'][^>]*content=["']([^"']+)/i,
    /content=["']([^"']+)["'][^>]*property=["']article:published_time/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<time[^>]*datetime=["']([^"']+)/i,
  ];
  for (const p of pats) { const m = p.exec(html); if (m) return m[1]; }
  return '';
}

const fetchedAt = new Date().toISOString();
const r = got ?? blocked;
let file = '';
let words = 0;
let sha = '';
if (r) {
  const isMd = /markdown/i.test(r.type) || (r.via === 'markdown' && !/<html/i.test(r.body.slice(0, 500)));
  const ext = got ? (isMd ? 'md' : 'html') : 'blocked.html';
  file = `${nn}-${slug}.${ext}`;
  writeFileSync(join(dir, file), r.body);
  sha = createHash('sha256').update(r.body).digest('hex').slice(0, 16);
  if (got) {
    const text = isMd ? r.body : htmlToText(r.body);
    writeFileSync(join(dir, `${nn}-${slug}.txt`), text + '\n');
    words = text.split(/\s+/).filter(Boolean).length;
  }
}

if (!existsSync(manifestPath)) appendFileSync(manifestPath, MANIFEST_HEADER.join('\t') + '\n');
const clean = v => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
const row = [
  nn, file, url, r?.finalUrl ?? '', got ? got.via : 'failed', r?.status ?? '', fetchedAt,
  got && !/markdown/.test(got.via) ? published(got.body) : '', sha, words, tier,
  got ? note : [note, `not used: ${errors.join('; ')}`].filter(Boolean).join(' | '),
];
appendFileSync(manifestPath, row.map(clean).join('\t') + '\n');

if (got) {
  console.log(`${nn} ok via ${got.via} (${got.status}, ${words} words) -> ${file}`);
} else {
  console.log(`${nn} FAILED ${url}: ${errors.join('; ')}`);
  process.exit(1);
}
