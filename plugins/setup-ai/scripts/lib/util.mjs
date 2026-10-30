import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PACKS_DIR = path.join(PLUGIN_ROOT, 'templates', 'packs');
export const GLOBAL_TOKENS = path.join(PLUGIN_ROOT, 'templates', 'placeholders.json');
export const CHANGELOG = path.join(PLUGIN_ROOT, 'CHANGELOG.md');
/** Install record, relative to the target repo. */
export const RECORD = path.join('.claude', 'setup-ai.json');
/**
 * Folder under AI_DIR whose files belong to the repo owner: render never
 * writes, records or deletes anything in it.
 */
export const EXTENSIONS_DIR = 'skill-extensions';
/** `npx skills` needs this Node version; the engine itself needs only 18. */
export const VENDOR_NODE_MIN = [22, 20];
export const IS_WIN = process.platform === 'win32';

/** Prints one JSON document — every command's only stdout. */
export const out = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');

/** Prints an `ok: false` document and exits 1. */
export const die = (msg, extra = {}) => {
  out({ ok: false, error: msg, ...extra });
  process.exit(1);
};

/** Parsed JSON at `p`, or `fallback` when the file is missing or not JSON. */
export const readJson = (p, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
};

export const exists = (p) => fs.existsSync(p);

/** Text with CRLF line endings turned into LF. */
export const lf = (s) => s.replace(/\r\n/g, '\n');

/** Short content hash used to tell user-edited files from rendered ones. */
export const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

export const posix = (p) => p.split(path.sep).join('/');

/** Every file under `dir`, recursively, as absolute paths. */
export function walk(dir) {
  const files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

/** True when the buffer has no NUL byte in its first 8 KB. */
export const isText = (buf) => !buf.subarray(0, 8000).includes(0);

/** True when the running Node is at least `[major, minor]`. */
export function nodeAtLeast([maj, min]) {
  const [a, b] = process.versions.node.split('.').map(Number);
  return a > maj || (a === maj && b >= min);
}

/** setup-ai's own version, from its plugin manifest. */
export const pluginVersion = () => readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), {}).version ?? '0.0.0';

/**
 * A comma-separated CLI flag value as a list of posix paths; `[]` when the
 * flag is absent or bare.
 */
export const listArg = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean) : []);

/**
 * Semver comparison of `a` and `b` (`x.y.z`, pre-release suffixes ignored).
 *
 * @returns {number} Negative when `a` is older, 0 when equal, positive when newer.
 */
export function compareVersions(a, b) {
  const parts = (v) => String(v ?? '0').split('-')[0].split('.').map((n) => Number(n) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}
