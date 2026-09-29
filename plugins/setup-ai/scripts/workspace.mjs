#!/usr/bin/env node
/**
 * setup-ai workspace engine. Requires Node.js >= 18 (no npm packages); packs
 * that install vendor skills need Node >= 22.20 because npx skills does.
 *
 * The bootstrap-agent-workspace skill drives this; every subcommand prints one
 * JSON document on stdout so the agent reads results instead of parsing prose.
 *
 *   catalog                                   list packs (name, title, summary, deps, options, tokens)
 *   detect   --dest <repo>                    repo facts + inferred token/option values
 *   plan     --dest <repo> --packs a,b [--values v.json]
 *                                             resolve pack deps, prerequisite status, missing tokens,
 *                                             file plan with conflicts (writes nothing)
 *   prereqs  --dest <repo> --packs a,b [--values v.json]
 *                                             install missing marketplaces, plugins (project scope)
 *                                             and vendor skills for the resolved packs
 *   render   --dest <repo> --packs a,b --values v.json [--dry-run] [--overwrite p1,p2] [--update]
 *                                             write files, apply appends, merge settings, write record
 *   vendor   install|check|restore --dest <repo> [--packs a,b] [--values v.json]
 *   session-check --dest <repo>               SessionStart hook: drift notice / optional auto-restore
 *
 * values.json: { "tokens": { "PROJECT_NAME": "…" }, "options": { "profile": "nextjs", "hooks": ["…"] } }
 * Record of an install: <repo>/.claude/setup-ai.json (commit it).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS_DIR = path.join(PLUGIN_ROOT, 'templates', 'packs');
const GLOBAL_TOKENS = path.join(PLUGIN_ROOT, 'templates', 'placeholders.json');
const RECORD = path.join('.claude', 'setup-ai.json');
const VENDOR_NODE_MIN = [22, 20];
const IS_WIN = process.platform === 'win32';

// ---------- small utils ----------

const out = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
const die = (msg, extra = {}) => { out({ ok: false, error: msg, ...extra }); process.exit(1); };
const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
const exists = (p) => fs.existsSync(p);
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const posix = (p) => p.split(path.sep).join('/');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

// On Windows, npx/claude may be .cmd shims that only run through a shell, so
// build one quoted command line instead of passing args with shell:true
// (which Node deprecates because the args are concatenated unescaped).
function run(cmd, argv, opts = {}) {
  const useShell = opts.shell ?? IS_WIN;
  const quote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `"${String(a).replace(/"/g, '\\"')}"`);
  const r = useShell
    ? spawnSync([cmd, ...argv].map(quote).join(' '), { encoding: 'utf8', ...opts, shell: true })
    : spawnSync(cmd, argv, { encoding: 'utf8', ...opts, shell: false });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: (r.stderr ?? '') + (r.error ? String(r.error) : '') };
}

// On Windows `where bash` can resolve to WSL's System32\bash.exe, which is not
// what Claude Code runs hooks with. Look for Git Bash the way Claude Code does.
function gitBashOnWindows() {
  const candidates = [
    process.env.CLAUDE_CODE_GIT_BASH_PATH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);
  return candidates.some((p) => exists(p));
}

function onPath(bin) {
  if (bin === 'bash' && IS_WIN) return gitBashOnWindows();
  const r = IS_WIN ? run('where', [bin]) : run('sh', ['-c', `command -v ${bin}`], { shell: false });
  return r.code === 0;
}

function nodeAtLeast([maj, min]) {
  const [a, b] = process.versions.node.split('.').map(Number);
  return a > maj || (a === maj && b >= min);
}

function walk(dir) {
  const files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

function isText(buf) {
  return !buf.subarray(0, 8000).includes(0);
}

// ---------- packs ----------

function loadPacks() {
  const packs = {};
  for (const name of fs.readdirSync(PACKS_DIR)) {
    const manifest = readJson(path.join(PACKS_DIR, name, 'pack.json'));
    if (!manifest) continue;
    packs[manifest.name] = { ...manifest, root: path.join(PACKS_DIR, name) };
  }
  return packs;
}

function resolvePacks(all, requested) {
  const order = [];
  const pulledIn = [];
  const visit = (name, via) => {
    if (order.includes(name)) return;
    const pack = all[name];
    if (!pack) die(`unknown pack: ${name}`, { known: Object.keys(all) });
    for (const dep of pack.requires?.packs ?? []) visit(dep, name);
    order.push(name);
    if (via) pulledIn.push({ pack: name, requiredBy: via });
  };
  for (const name of requested) visit(name, null);
  const recommended = [...new Set(order.flatMap((n) => all[n].recommends ?? []))].filter((n) => !order.includes(n));
  return { order, pulledIn: pulledIn.filter((p) => !requested.includes(p.pack)), recommended };
}

function pluginVersion() {
  return readJson(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), {}).version ?? '0.0.0';
}

// ---------- conditions ----------
// pack:x | option:key[=value] | profile:x | detect:<flag> | platform:win32, '!' negates, '|' ors.

function evalCond(expr, ctx) {
  return expr.split('|').some((raw) => {
    let term = raw.trim();
    const neg = term.startsWith('!');
    if (neg) term = term.slice(1).trim();
    let val = false;
    const [kind, rest = ''] = term.split(/:(.*)/s);
    if (kind === 'pack') val = ctx.packs.includes(rest);
    else if (kind === 'profile') val = ctx.options.profile === rest;
    else if (kind === 'detect') val = Boolean(ctx.detect?.flags?.[rest]);
    else if (kind === 'platform') val = process.platform === rest;
    else if (kind === 'option') {
      const [key, want] = rest.split('=');
      const have = ctx.options[key];
      val = want === undefined ? Boolean(have && (!Array.isArray(have) || have.length)) : Array.isArray(have) ? have.includes(want) : String(have) === want;
    } else throw new Error(`bad condition term: ${term}`);
    return neg ? !val : val;
  });
}

// Line-based @if blocks. Markers may be HTML comments or '#' comments so the
// same syntax works in Markdown, shell and YAML. Nesting is supported.
const IF_RE = /^\s*(?:<!--|#)\s*@if\s+(.+?)\s*(?:-->)?\s*$/;
const ENDIF_RE = /^\s*(?:<!--|#)\s*@endif\s*(?:-->)?\s*$/;

function applyConditionals(text, ctx, file) {
  const lines = text.split('\n');
  const outLines = [];
  const stack = [];
  for (const line of lines) {
    const m = line.match(IF_RE);
    if (m) { stack.push(stack.every(Boolean) && evalCond(m[1], ctx)); continue; }
    if (ENDIF_RE.test(line)) {
      if (!stack.length) throw new Error(`unbalanced @endif in ${file}`);
      stack.pop();
      continue;
    }
    if (stack.every(Boolean)) outLines.push(line);
  }
  if (stack.length) throw new Error(`unclosed @if in ${file}`);
  return outLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

const TOKEN_RE = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;
const TODO_RE = /\{\{(?![A-Z][A-Z0-9_]*\}\})([A-Za-z][\w.-]*)\}\}/g;

function renderTokens(text, tokens) {
  return text.replace(TOKEN_RE, (m, name) => (name in tokens ? String(tokens[name]) : m));
}

// Removes the "> **Template skill — fill in before use.**" blockquote (and the
// blank line after it). Inline "> **Template note:**" blocks are kept.
function stripBanner(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^>\s*\*\*Template skill\b/.test(l));
  if (start === -1) return text;
  let end = start;
  while (end < lines.length && lines[end].startsWith('>')) end++;
  if (lines[end] === '') end++;
  lines.splice(start, end - start);
  return lines.join('\n');
}

// ---------- file planning ----------

function destRel(rel, tokens) {
  const segs = posix(rel).split('/').map((s) => (s === 'dot-claude' ? '.claude' : s));
  return renderTokens(segs.join('/'), tokens);
}

function fileAllowed(pack, rel, ctx) {
  for (const [prefix, cond] of Object.entries(pack.fileConditions ?? {})) {
    if (posix(rel).startsWith(prefix) && !evalCond(cond, ctx)) return false;
  }
  return true;
}

function buildFiles(all, order, ctx) {
  const files = [];
  for (const name of order) {
    const pack = all[name];
    const filesDir = path.join(pack.root, 'files');
    if (!exists(filesDir)) continue;
    for (const abs of walk(filesDir)) {
      const rel = path.relative(filesDir, abs);
      if (!fileAllowed(pack, rel, ctx)) continue;
      let buf = fs.readFileSync(abs);
      let text = null;
      if (isText(buf)) {
        text = buf.toString('utf8');
        text = applyConditionals(text, ctx, `${name}/${posix(rel)}`);
        text = stripBanner(text);
        text = renderTokens(text, ctx.tokens);
        buf = Buffer.from(text, 'utf8');
      }
      files.push({ pack: name, src: posix(rel), dest: destRel(rel, ctx.tokens), buf, text });
    }
  }
  return files;
}

function scanTokens(all, order, ctx) {
  // Tokens referenced by the files, appends and settings the chosen packs would write.
  const found = new Map();
  const note = (name, where) => { if (!found.has(name)) found.set(name, where); };
  const scan = (text, where) => { for (const m of text.matchAll(TOKEN_RE)) note(m[1], where); };
  for (const name of order) {
    const pack = all[name];
    const filesDir = path.join(pack.root, 'files');
    if (exists(filesDir)) {
      for (const abs of walk(filesDir)) {
        const rel = path.relative(filesDir, abs);
        if (!fileAllowed(pack, rel, ctx)) continue;
        scan(posix(rel), `${name}/${posix(rel)}`);
        const buf = fs.readFileSync(abs);
        if (isText(buf)) scan(applyConditionals(buf.toString('utf8'), ctx, rel), `${name}/${posix(rel)}`);
      }
    }
    scan(JSON.stringify(pack.appends ?? []), `${name}/pack.json appends`);
    scan(JSON.stringify(filterSettings(pack.settings ?? {}, ctx)), `${name}/pack.json settings`);
  }
  return found;
}

function tokenCatalog(all, order) {
  const globals = readJson(GLOBAL_TOKENS, {});
  const cat = { ...globals };
  for (const name of order) Object.assign(cat, all[name].tokens ?? {});
  return cat;
}

// ---------- settings merge ----------

// Drops entries whose "@when" is false, strips the "@when" keys, and prunes
// arrays/objects left empty so no `"Stop": []` noise lands in settings.
function filterSettings(node, ctx) {
  const empty = (v) => (Array.isArray(v) ? v.length === 0 : v && typeof v === 'object' && Object.keys(v).length === 0);
  if (Array.isArray(node)) {
    return node
      .filter((v) => !(v && typeof v === 'object' && v['@when'] && !evalCond(v['@when'], ctx)))
      .map((v) => filterSettings(v, ctx))
      .filter((v) => !empty(v));
  }
  if (node && typeof node === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === '@when') continue;
      const f = filterSettings(v, ctx);
      if (!empty(f)) res[k] = f;
    }
    return res;
  }
  return node;
}

function deepMerge(target, src) {
  if (Array.isArray(target) && Array.isArray(src)) {
    const seen = new Set(target.map((v) => JSON.stringify(v)));
    for (const v of src) if (!seen.has(JSON.stringify(v))) target.push(v);
    return target;
  }
  if (target && typeof target === 'object' && src && typeof src === 'object' && !Array.isArray(src)) {
    for (const [k, v] of Object.entries(src)) {
      if (k in target && typeof target[k] === 'object' && target[k] !== null) deepMerge(target[k], v);
      else if (!(k in target)) target[k] = v;
      // an existing scalar the user set wins
    }
    return target;
  }
  return target;
}

function mergeHookEntries(settings) {
  // Two packs (or two runs) adding the same matcher produce two entries; fold
  // entries with an identical matcher into one and dedupe their commands.
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    const byMatcher = new Map();
    for (const e of entries) {
      const key = e.matcher ?? '';
      if (!byMatcher.has(key)) { byMatcher.set(key, { ...e, hooks: [] }); }
      const tgt = byMatcher.get(key);
      for (const h of e.hooks ?? []) if (!tgt.hooks.some((x) => JSON.stringify(x) === JSON.stringify(h))) tgt.hooks.push(h);
    }
    settings.hooks[event] = [...byMatcher.values()];
  }
  return settings;
}

function pluginSettings(all, order, ctx) {
  const s = { enabledPlugins: {}, extraKnownMarketplaces: {} };
  for (const req of requiredPlugins(all, order, ctx)) {
    s.enabledPlugins[req.id] = true;
    if (req.marketplace?.repo && req.marketplace.name !== 'claude-plugins-official') {
      s.extraKnownMarketplaces[req.marketplace.name] = { source: { source: 'github', repo: req.marketplace.repo } };
    }
  }
  if (!Object.keys(s.extraKnownMarketplaces).length) delete s.extraKnownMarketplaces;
  if (!Object.keys(s.enabledPlugins).length) delete s.enabledPlugins;
  return s;
}

// ---------- prerequisites ----------

function requiredPlugins(all, order, ctx) {
  const seen = new Map();
  for (const name of order) {
    for (const p of all[name].requires?.plugins ?? []) {
      if (p.when && !evalCond(p.when, ctx)) continue;
      if (!seen.has(p.id)) seen.set(p.id, { ...p, requiredBy: [name] });
      else seen.get(p.id).requiredBy.push(name);
    }
  }
  return [...seen.values()];
}

function requiredVendorSkills(all, order, ctx) {
  const res = [];
  for (const name of order) {
    for (const v of all[name].requires?.vendorSkills ?? []) {
      if (v.when && !evalCond(v.when, ctx)) continue;
      for (const skill of v.skills) {
        const hit = res.find((r) => r.skill === skill);
        if (hit) hit.requiredBy.push(name);
        else res.push({ source: v.source, skill, why: v.why, requiredBy: [name] });
      }
    }
  }
  return res;
}

function requiredClis(all, order, ctx) {
  const res = [];
  for (const name of order) {
    for (const c of all[name].requires?.cli ?? []) {
      if (c.when && !evalCond(c.when, ctx)) continue;
      if (!res.some((r) => r.name === c.name)) res.push({ ...c, requiredBy: [name] });
    }
  }
  return res;
}

let pluginListCache;
function installedPlugins() {
  if (pluginListCache) return pluginListCache;
  const r = run('claude', ['plugin', 'list', '--json']);
  if (r.code !== 0) return (pluginListCache = null);
  try { pluginListCache = JSON.parse(r.stdout); } catch { pluginListCache = null; }
  return pluginListCache;
}

function knownMarketplaces() {
  const r = run('claude', ['plugin', 'marketplace', 'list', '--json']);
  if (r.code !== 0) return null;
  try { return JSON.parse(r.stdout).map((m) => m.name); } catch { return null; }
}

function vendorSkillPresent(dest, skill) {
  return exists(path.join(dest, '.claude', 'skills', skill, 'SKILL.md'));
}

function prereqStatus(all, order, ctx, dest) {
  const list = installedPlugins();
  const markets = knownMarketplaces();
  const plugins = requiredPlugins(all, order, ctx).map((p) => {
    const hit = list?.find((i) => i.id === p.id);
    const status = list === null ? 'unknown' : hit ? (hit.enabled ? 'installed' : 'disabled') : 'missing';
    const marketplaceKnown = markets === null ? null : markets.includes(p.id.split('@')[1]);
    return { id: p.id, why: p.why, requiredBy: p.requiredBy, status, marketplaceKnown, marketplace: p.marketplace };
  });
  const vendorSkills = requiredVendorSkills(all, order, ctx).map((v) => ({ ...v, status: vendorSkillPresent(dest, v.skill) ? 'installed' : 'missing' }));
  const clis = requiredClis(all, order, ctx).map((c) => ({ ...c, status: onPath(c.name) ? 'installed' : 'missing' }));
  const node = vendorSkills.length
    ? { required: `>=${VENDOR_NODE_MIN.join('.')}`, have: process.versions.node, ok: nodeAtLeast(VENDOR_NODE_MIN), reason: 'npx skills (vendor skills)' }
    : null;
  const missing = [
    ...plugins.filter((p) => p.status !== 'installed'),
    ...vendorSkills.filter((v) => v.status === 'missing'),
    ...clis.filter((c) => c.status === 'missing' && !c.optional),
  ];
  return { plugins, vendorSkills, clis, node, allSatisfied: missing.length === 0 && (!node || node.ok) };
}

// ---------- vendor skills (npx skills) ----------

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

function vendorInstall(dest, items) {
  if (!items.length) return [];
  if (!nodeAtLeast(VENDOR_NODE_MIN)) return [{ ok: false, error: `npx skills needs Node >= ${VENDOR_NODE_MIN.join('.')}; this is ${process.versions.node}` }];
  return groupBySource(items).map(([source, skills]) => npxSkillsAdd(dest, source, skills));
}

function vendorRestore(dest) {
  const lock = readJson(path.join(dest, 'skills-lock.json'), null);
  const record = readJson(path.join(dest, RECORD), null);
  const items = [];
  for (const [skill, e] of Object.entries(lock?.skills ?? {})) items.push({ skill, source: e.ref ? `${e.source}#${e.ref}` : e.source });
  for (const v of record?.vendorSkills ?? []) if (!items.some((i) => i.skill === v.skill)) items.push(v);
  return vendorInstall(dest, items.filter((i) => !vendorSkillPresent(dest, i.skill)));
}

// ---------- detection ----------

function detect(dest) {
  const pkg = readJson(path.join(dest, 'package.json'), null);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const scripts = pkg?.scripts ?? {};
  const pm = exists(path.join(dest, 'pnpm-lock.yaml')) ? 'pnpm'
    : exists(path.join(dest, 'yarn.lock')) ? 'yarn'
    : exists(path.join(dest, 'bun.lockb')) || exists(path.join(dest, 'bun.lock')) ? 'bun'
    : pkg ? 'npm' : null;
  const runScript = (s) => (pm === 'yarn' ? `yarn ${s}` : pm === 'pnpm' ? `pnpm ${s}` : pm === 'bun' ? `bun run ${s}` : `npm run ${s}`);
  const git = (argv) => { const r = run('git', argv, { cwd: dest, shell: false }); return r.code === 0 ? r.stdout.trim() : ''; };
  const originHead = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '');
  const remote = git(['remote', 'get-url', 'origin']);
  const has = (d) => d in deps;
  const flags = {
    node: Boolean(pkg), next: has('next'), react: has('react'), vue: has('vue'), svelte: has('svelte'),
    vite: has('vite'), vitest: has('vitest'), jest: has('jest'), playwright: has('@playwright/test') || has('playwright'),
    tailwind: has('tailwindcss'), typescript: has('typescript') || exists(path.join(dest, 'tsconfig.json')),
    eslint: has('eslint'), prettier: has('prettier'),
    ado: /dev\.azure\.com|visualstudio\.com/.test(remote) || exists(path.join(dest, 'azure-pipelines.yml')),
    github: /github\.com/.test(remote),
    npmrcCooldown: /min-release-age/.test(fs.existsSync(path.join(dest, '.npmrc')) ? fs.readFileSync(path.join(dest, '.npmrc'), 'utf8') : ''),
    claudeMd: exists(path.join(dest, 'CLAUDE.md')), agentsMd: exists(path.join(dest, 'AGENTS.md')),
    claudeSettings: exists(path.join(dest, '.claude', 'settings.json')),
    installed: exists(path.join(dest, RECORD)),
    verifyScript: Boolean(pkg?.scripts && ['verify', 'check', 'ci'].some((n) => n in pkg.scripts)),
  };
  const firstScript = (...names) => names.find((n) => n in scripts);
  const verify = firstScript('verify', 'check', 'ci');
  const gates = ['typecheck', 'lint', 'test', 'build'].filter((n) => n in scripts);
  const tokens = {
    PROJECT_NAME: pkg?.name?.replace(/^@[^/]+\//, '') || path.basename(path.resolve(dest)),
    DEFAULT_BRANCH: originHead || git(['branch', '--show-current']) || 'main',
    AI_DIR: '.ai',
  };
  if (pm) {
    if ('dev' in scripts) tokens.DEV_CMD = runScript('dev');
    if (verify) tokens.VERIFY_CMD = runScript(verify);
    else if (gates.length) tokens.VERIFY_CMD = gates.map(runScript).join(' && ');
    if ('test' in scripts) tokens.TEST_CMD = pm === 'npm' ? 'npm test' : runScript('test');
    const e2e = firstScript('test:e2e', 'e2e', 'test:playwright');
    if (e2e) tokens.E2E_CMD = runScript(e2e);
    if ('typecheck' in scripts) tokens.TYPECHECK_CMD = runScript('typecheck');
    if ('build' in scripts) tokens.BUILD_CMD = runScript('build');
  }
  if (flags.next) tokens.LOCAL_URL = 'http://localhost:3000';
  else if (flags.vite) tokens.LOCAL_URL = 'http://localhost:5173';
  tokens.UNIT_TEST_GLOB = exists(path.join(dest, '__tests__')) ? '__tests__/**' : exists(path.join(dest, 'test')) ? 'test/**' : '**/*.test.*';
  if (flags.playwright || exists(path.join(dest, 'e2e'))) tokens.E2E_GLOB = exists(path.join(dest, 'e2e')) ? 'e2e/**' : 'tests/e2e/**';
  const stack = [flags.next && 'Next.js', flags.react && !flags.next && 'React', flags.vue && 'Vue', flags.svelte && 'Svelte',
    flags.typescript && 'TypeScript', flags.tailwind && 'Tailwind CSS', flags.vitest && 'Vitest', flags.jest && 'Jest', flags.playwright && 'Playwright'].filter(Boolean);
  if (stack.length) tokens.STACK_SUMMARY = stack.join(' / ');
  const options = { profile: flags.next ? 'nextjs' : 'generic' };
  const suggestedPacks = ['baseline', 'hooks', 'review-agents', 'dev-workflow'];
  if (flags.claudeMd || flags.agentsMd) { /* baseline appends an import instead of overwriting */ }
  return { dest: path.resolve(dest), packageManager: pm, scripts: Object.keys(scripts), flags, tokens, options, suggestedPacks, remote: remote || null };
}

// ---------- commands ----------

function loadValues(args) {
  const v = args.values ? readJson(args.values, null) : {};
  if (v === null) die(`cannot read --values ${args.values}`);
  return { tokens: v.tokens ?? {}, options: v.options ?? {} };
}

function ctxFor(args, order) {
  const { tokens, options } = loadValues(args);
  const dest = args.dest ?? process.cwd();
  return { packs: order, tokens, options, detect: detect(dest), dest };
}

function packList(args) {
  const list = String(args.packs ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) die('--packs is required (comma-separated)');
  return list;
}

function cmdCatalog() {
  const all = loadPacks();
  out({
    ok: true,
    version: pluginVersion(),
    globalTokens: readJson(GLOBAL_TOKENS, {}),
    packs: Object.values(all).map(({ root, files, ...p }) => p),
  });
}

function planFor(args) {
  const all = loadPacks();
  const { order, pulledIn, recommended } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const referenced = scanTokens(all, order, ctx);
  const cat = tokenCatalog(all, order);
  const missingTokens = [...referenced.keys()].filter((t) => !(t in ctx.tokens)).map((t) => ({
    token: t, firstUsedIn: referenced.get(t), prompt: cat[t]?.prompt ?? null, default: cat[t]?.default ?? null, inferred: ctx.detect.tokens[t] ?? null,
  }));
  return { all, order, pulledIn, recommended, ctx, missingTokens };
}

function cmdPlan(args) {
  const { all, order, pulledIn, recommended, ctx, missingTokens } = planFor(args);
  const prereqs = prereqStatus(all, order, ctx, ctx.dest);
  let files = [];
  if (!missingTokens.length) {
    const record = readJson(path.join(ctx.dest, RECORD), null);
    files = buildFiles(all, order, ctx).map((f) => ({ pack: f.pack, dest: f.dest, action: fileAction(ctx.dest, f, record, args) }));
  }
  const options = Object.fromEntries(order.flatMap((n) => Object.entries(all[n].options ?? {})));
  const optionDefaults = Object.fromEntries(Object.entries(options).map(([key, o]) => [key, defaultFor(o, ctx)]));
  const missingOptions = Object.keys(options).filter((k) => !(k in ctx.options));
  out({ ok: true, packs: order, pulledIn, recommended, options, optionDefaults, missingOptions, prerequisites: prereqs, missingTokens, files,
    conflicts: files.filter((f) => f.action === 'conflict').map((f) => f.dest) });
}

// Default for one pack option, evaluated against the repo. multi → array of
// values; single → one value. `defaultWhen` is a condition expression.
function defaultFor(opt, ctx) {
  const on = (c) => c.default === true || (c.defaultWhen ? evalCond(c.defaultWhen, ctx) : false);
  if (opt.type === 'multi') return opt.choices.filter(on).map((c) => c.value);
  if (opt.defaultFrom === 'detect') return ctx.detect.options?.[opt.key] ?? opt.default ?? null;
  return (opt.choices ?? []).find(on)?.value ?? opt.default ?? null;
}

function fileAction(dest, f, record, args) {
  const target = path.join(dest, f.dest);
  if (!exists(target)) return 'create';
  const cur = fs.readFileSync(target);
  if (sha(cur) === sha(f.buf)) return 'unchanged';
  const overwrite = String(args.overwrite ?? '').split(',').map((s) => s.trim());
  if (overwrite.includes(f.dest) || args.overwrite === 'all') return 'overwrite';
  if (args.update && record?.files?.[f.dest] && record.files[f.dest].hash === sha(cur)) return 'update';
  return 'conflict';
}

function cmdPrereqs(args) {
  const all = loadPacks();
  const { order } = resolvePacks(all, packList(args));
  const ctx = ctxFor(args, order);
  const status = prereqStatus(all, order, ctx, ctx.dest);
  const results = [];
  const addedMarkets = new Set();
  for (const p of status.plugins.filter((x) => x.status !== 'installed')) {
    const market = p.id.split('@')[1];
    if (p.marketplaceKnown === false && p.marketplace?.repo && !addedMarkets.has(market)) {
      const r = run('claude', ['plugin', 'marketplace', 'add', p.marketplace.repo], { cwd: ctx.dest });
      results.push({ step: `marketplace add ${p.marketplace.repo}`, ok: r.code === 0, stderr: r.code ? r.stderr.slice(-1500) : undefined });
      addedMarkets.add(market);
    }
    const argv = p.status === 'disabled' ? ['plugin', 'enable', p.id, '--scope', 'project'] : ['plugin', 'install', p.id, '--scope', 'project'];
    const r = run('claude', argv, { cwd: ctx.dest });
    results.push({ step: `claude ${argv.join(' ')}`, ok: r.code === 0, stderr: r.code ? r.stderr.slice(-1500) : undefined });
  }
  const vendor = vendorInstall(ctx.dest, status.vendorSkills.filter((v) => v.status === 'missing'));
  results.push(...vendor.map((v) => ({ step: v.command ?? 'npx skills', ok: v.ok, stderr: v.stderr ?? v.error })));
  pluginListCache = undefined;
  const after = prereqStatus(all, order, ctx, ctx.dest);
  out({ ok: results.every((r) => r.ok) && after.allSatisfied, results, prerequisites: after,
    note: 'Plugins installed now load in the NEXT session; restart Claude Code (or run /reload-plugins) before relying on them.' });
}

function cmdRender(args) {
  const { all, order, ctx, missingTokens } = planFor(args);
  if (missingTokens.length) die('missing token values — collect them first', { missingTokens });
  const dry = Boolean(args['dry-run']);
  const record = readJson(path.join(ctx.dest, RECORD), null);
  const files = buildFiles(all, order, ctx);
  const report = { written: [], unchanged: [], conflicts: [], appended: [], settings: null, errors: [], todos: [] };

  for (const f of files) {
    const action = fileAction(ctx.dest, f, record, args);
    if (action === 'unchanged') { report.unchanged.push(f.dest); continue; }
    if (action === 'conflict') { report.conflicts.push(f.dest); continue; }
    if (!dry) {
      const target = path.join(ctx.dest, f.dest);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.buf);
    }
    report.written.push({ dest: f.dest, action });
  }

  // appends: add a line/block to an existing file (or create it) exactly once
  for (const name of order) {
    for (const a of all[name].appends ?? []) {
      if (a.when && !evalCond(a.when, ctx)) continue;
      const to = renderTokens(a.to, ctx.tokens);
      const text = renderTokens(a.text, ctx.tokens);
      const target = path.join(ctx.dest, to);
      const cur = exists(target) ? fs.readFileSync(target, 'utf8') : null;
      if (cur !== null && cur.includes(text.trim())) continue;
      const next = cur === null ? renderTokens(a.create ?? '', ctx.tokens) + text + '\n' : cur.replace(/\s*$/, '\n\n') + text + '\n';
      if (!dry) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, next); }
      report.appended.push({ to, pack: name, created: cur === null });
    }
  }

  // settings: pack fragments + required plugins, deep-merged, user values win
  const settingsPath = path.join(ctx.dest, '.claude', 'settings.json');
  const current = readJson(settingsPath, exists(settingsPath) ? null : {});
  if (current === null) report.errors.push('.claude/settings.json exists but is not valid JSON — settings not merged');
  else {
    const merged = structuredClone(current);
    for (const name of order) {
      const frag = JSON.parse(renderTokens(JSON.stringify(filterSettings(all[name].settings ?? {}, ctx)), ctx.tokens));
      deepMerge(merged, frag);
    }
    deepMerge(merged, pluginSettings(all, order, ctx));
    mergeHookEntries(merged);
    const changed = JSON.stringify(merged) !== JSON.stringify(current);
    if (changed && !dry) { fs.mkdirSync(path.dirname(settingsPath), { recursive: true }); fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + '\n'); }
    report.settings = changed ? 'merged' : 'unchanged';
  }

  // leftover tokens (errors) and skeleton placeholders (to-dos) in what we wrote
  for (const f of files) {
    if (!f.text || report.conflicts.includes(f.dest)) continue;
    for (const m of f.text.matchAll(TOKEN_RE)) report.errors.push(`${f.dest}: unfilled {{${m[1]}}}`);
    const todos = [...new Set([...f.text.matchAll(TODO_RE)].map((m) => m[1]))];
    if (todos.length) report.todos.push({ file: f.dest, placeholders: todos });
  }

  if (!dry) {
    const prev = record ?? {};
    const fileHashes = { ...(prev.files ?? {}) };
    for (const f of files) if (!report.conflicts.includes(f.dest)) fileHashes[f.dest] = { pack: f.pack, hash: sha(f.buf) };
    const packs = [...new Set([...(prev.packs ?? []).map((p) => p.name), ...order])].map((n) => ({ name: n, version: all[n]?.version ?? null }));
    const rec = {
      setupAiVersion: pluginVersion(),
      installedAt: prev.installedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      packs,
      options: { ...(prev.options ?? {}), ...ctx.options },
      tokens: { ...(prev.tokens ?? {}), ...ctx.tokens },
      plugins: requiredPlugins(all, order, ctx).map((p) => p.id),
      vendorSkills: requiredVendorSkills(all, order, ctx).map(({ source, skill }) => ({ source, skill })),
      files: fileHashes,
    };
    fs.mkdirSync(path.join(ctx.dest, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(ctx.dest, RECORD), JSON.stringify(rec, null, 2) + '\n');
  }
  out({ ok: report.errors.length === 0, dryRun: dry, packs: order, ...report });
}

function cmdVendor(args) {
  const mode = args._[1];
  const dest = args.dest ?? process.cwd();
  if (mode === 'restore') return out({ ok: true, results: vendorRestore(dest) });
  const record = readJson(path.join(dest, RECORD), null);
  let items;
  if (args.packs) {
    const all = loadPacks();
    const { order } = resolvePacks(all, packList(args));
    items = requiredVendorSkills(all, order, ctxFor(args, order));
  } else items = record?.vendorSkills ?? [];
  const status = items.map((i) => ({ ...i, status: vendorSkillPresent(dest, i.skill) ? 'installed' : 'missing' }));
  if (mode === 'check') return out({ ok: status.every((s) => s.status === 'installed'), skills: status });
  if (mode === 'install') {
    const results = vendorInstall(dest, status.filter((s) => s.status === 'missing'));
    return out({ ok: results.every((r) => r.ok), results });
  }
  die('usage: vendor install|check|restore --dest <repo>');
}

function cmdSessionCheck(args) {
  // Must stay cheap and silent: most sessions are in repos that were never bootstrapped.
  const dest = args.dest ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const record = readJson(path.join(dest, RECORD), null);
  if (!record) return;
  const notes = [];
  const all = loadPacks();
  const outdated = (record.packs ?? []).filter((p) => all[p.name]?.version && p.version && all[p.name].version !== p.version);
  if (outdated.length) notes.push(`template packs updated (${outdated.map((p) => `${p.name} ${p.version}→${all[p.name].version}`).join(', ')}) — run /setup-ai:bootstrap-agent-workspace update`);
  // Tools the installed packs need at runtime on *this* machine (a teammate who
  // cloned the repo may not have them). Only the cheap PATH checks run here.
  for (const p of record.packs ?? []) {
    for (const c of all[p.name]?.requires?.cli ?? []) {
      if (c.optional || (c.when && !evalCond(c.when, { packs: [], options: record.options ?? {}, tokens: {}, detect: null }))) continue;
      if (!onPath(c.name)) notes.push(`${c.name} is not installed but the ${p.name} pack needs it (${c.why})`);
    }
  }
  const missing = (record.vendorSkills ?? []).filter((v) => !vendorSkillPresent(dest, v.skill));
  if (missing.length) {
    const auto = String(process.env.CLAUDE_PLUGIN_OPTION_AUTOINSTALLVENDORSKILLS ?? '').toLowerCase() === 'true';
    const dataDir = process.env.CLAUDE_PLUGIN_DATA;
    const stampFile = dataDir ? path.join(dataDir, `restore-${sha(Buffer.from(path.resolve(dest)))}.json`) : null;
    const last = stampFile ? readJson(stampFile, {}).at ?? 0 : 0;
    if (auto && Date.now() - last > 24 * 3600 * 1000) {
      if (stampFile) { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(stampFile, JSON.stringify({ at: Date.now() })); }
      const results = vendorRestore(dest);
      const failed = results.filter((r) => !r.ok);
      notes.push(failed.length ? `auto-restore of vendor skills failed for ${failed.map((f) => f.source).join(', ')} — run /setup-ai:bootstrap-agent-workspace repair` : `restored vendor skills: ${missing.map((m) => m.skill).join(', ')} (they load next session)`);
    } else {
      notes.push(`missing vendor skills: ${missing.map((m) => m.skill).join(', ')} — run /setup-ai:bootstrap-agent-workspace repair`);
    }
  }
  if (!notes.length) return;
  out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `setup-ai: ${notes.join('; ')}.` } });
}

// ---------- main ----------

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
try {
  if (cmd === 'catalog') cmdCatalog();
  else if (cmd === 'detect') out({ ok: true, ...detect(args.dest ?? process.cwd()) });
  else if (cmd === 'plan') cmdPlan(args);
  else if (cmd === 'prereqs') cmdPrereqs(args);
  else if (cmd === 'render') cmdRender(args);
  else if (cmd === 'vendor') cmdVendor(args);
  else if (cmd === 'session-check') cmdSessionCheck(args);
  else die('usage: workspace.mjs catalog|detect|plan|prereqs|render|vendor|session-check [--dest repo] [--packs a,b] [--values v.json]');
} catch (err) {
  if (cmd === 'session-check') process.exit(0); // never break a session start
  die(err.message);
}
