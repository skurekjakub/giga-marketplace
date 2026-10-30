import fs from 'node:fs';
import path from 'node:path';
import { exists, posix } from './util.mjs';
import { run } from './proc.mjs';
import { marketplaceRoot, marketplaceSkills } from './marketplace.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.cache', 'vendor', 'target']);
const WALK_DEPTH = 6;

/**
 * Repo-relative posix paths of the files in `dest`: tracked and untracked but
 * not ignored, per `git ls-files`. Outside a git repo, a depth-limited walk
 * that skips dependency and build folders.
 *
 * @param {string} dest - Repo root.
 * @returns {string[]}
 */
export function repoFiles(dest) {
  const r = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: dest, shell: false, maxBuffer: 64 * 1024 * 1024 });
  if (r.code === 0) return r.stdout.split('\0').filter(Boolean).filter((f) => exists(path.join(dest, f)));
  const files = [];
  const visit = (dir, depth) => {
    let ents;
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (depth < WALK_DEPTH && !SKIP_DIRS.has(ent.name)) visit(p, depth + 1);
      } else files.push(posix(path.relative(dest, p)));
    }
  };
  visit(dest, 0);
  return files;
}

const base = (f) => f.split('/').pop();
const dir = (f) => (f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.');
const shortestFirst = (a, b) => a.split('/').length - b.split('/').length || a.length - b.length;
const byBase = (files, ...names) => files.filter((f) => names.includes(base(f))).sort(shortestFirst);
const STYLE_GUIDE_RE = /style-?guide/i;

/**
 * Agent-workspace files the repo already has, found by name: agents, hooks
 * and skills under `.claude/`, and the convention docs setup-ai's packs ship
 * an equivalent of wherever they live.
 *
 * @param {string[]} files - From `repoFiles()`.
 * @returns {{agents, hooks, skills, commentPolicy, prGuides, gotchas, styleGuides, conventionsDirs, workingRules}} Lists of repo-relative paths (skill folder names for `skills`).
 */
export function existingWorkspace(files) {
  const under = (prefix) => files.filter((f) => f.startsWith(prefix));
  return {
    agents: under('.claude/agents/').filter((f) => f.endsWith('.md')),
    hooks: under('.claude/hooks/'),
    skills: [...new Set(under('.claude/skills/').filter((f) => f.endsWith('/SKILL.md')).map((f) => f.split('/')[2]))],
    commentPolicy: byBase(files, 'comment-policy.md'),
    prGuides: byBase(files, 'commit-and-pr-format.md', 'pr-guidelines.md'),
    gotchas: byBase(files, 'gotchas.md'),
    styleGuides: files.filter((f) => f.endsWith('.md') && STYLE_GUIDE_RE.test(base(f))).sort(shortestFirst),
    conventionsDirs: [...new Set(files.filter((f) => /(^|\/)conventions\/[^/]+\.md$/.test(f)).map(dir))].sort(shortestFirst),
    workingRules: byBase(files, 'agent-working-rules.md'),
  };
}

/**
 * Values for the path tokens, inferred from where the repo already keeps the
 * equivalent documents. A token with nothing to infer from is left out, so
 * its catalog default applies.
 *
 * @param {ReturnType<typeof existingWorkspace>} ws
 * @returns {Record<string, string>}
 */
export function inferPathTokens(ws) {
  const t = {};
  if (ws.commentPolicy[0]) t.COMMENT_POLICY_PATH = ws.commentPolicy[0];
  if (ws.prGuides[0]) t.PR_GUIDE_PATH = ws.prGuides[0];
  if (ws.gotchas[0]) t.GOTCHAS_PATH = ws.gotchas[0];
  if (ws.conventionsDirs[0]) t.CONVENTIONS_DIR = ws.conventionsDirs[0];
  const guideDir = ws.styleGuides.map(dir).find((d) => d !== '.');
  if (guideDir) t.STYLE_GUIDE_DIR = guideDir;
  return t;
}

/** True when the repo holds prose content: any `.mdx`, or Markdown under a content/posts/blog folder. */
export const hasContent = (files) => files.some((f) => !f.startsWith('.') && (/\.mdx$/.test(f) || /^(content|posts|_posts|blog|src\/content)\/.+\.md$/.test(f)));

/**
 * Skills vendored into `.claude/skills/` that a plugin of setup-ai's own
 * marketplace already ships — copies that drift from the plugin and shadow it.
 *
 * @param {string[]} skillDirs - Folder names under `.claude/skills/`.
 * @returns {{available: boolean, marketplace: ?string, duplicates: {skill, plugin, id, path}[]}}
 *   `available` is false when the marketplace manifest cannot be found from the engine's location.
 */
export function vendoredDuplicates(skillDirs) {
  const market = marketplaceRoot();
  const shipped = marketplaceSkills(market);
  const duplicates = [];
  for (const d of skillDirs) {
    const hit = shipped.find((s) => s.folder === d || s.skill === d);
    if (hit) duplicates.push({ skill: d, plugin: hit.plugin, id: hit.id, path: `.claude/skills/${d}` });
  }
  return { available: Boolean(market), marketplace: market?.name ?? null, duplicates };
}

/**
 * Candidate values for skeleton placeholders (`{{PascalCase}}`) the user
 * fills later, guessed from the file listing. Only placeholders with at
 * least one candidate appear.
 *
 * @param {string[]} files - From `repoFiles()`.
 * @returns {Record<string, string[]>} Placeholder name to candidates, best first.
 */
export function placeholderSuggestions(files) {
  const s = {};
  const first = (re, n = 3) => files.filter((f) => re.test(f)).sort(shortestFirst).slice(0, n);
  const components = first(/^(src\/)?(app\/)?components\/[^/]+\.(tsx|jsx|vue|svelte)$/);
  if (components.length) s.ReferenceComponentPath = components;
  const testConfigs = first(/^(vitest|jest|playwright)\.config\.[cm]?[jt]s$/);
  const testDirs = [...new Set(files.filter((f) => /(^|\/)(tests?|__tests__)\/.+\.(test|spec)\.[cm]?[jt]sx?$/.test(f))
    .map((f) => f.match(/^(.*?(?:^|\/)(?:tests?|__tests__))\//)[1]))].sort(shortestFirst).slice(0, 3);
  const integration = files.filter((f) => /integration/i.test(f) && /\.(test|spec)\.[cm]?[jt]sx?$/.test(f)).map(dir);
  const integrationDirs = [...new Set(integration)].sort(shortestFirst).slice(0, 2);
  const testWhere = [...integrationDirs.map((d) => `${d}/ (integration tests found there)`), ...testDirs.map((d) => `${d}/`), ...testConfigs.map((c) => `configured by ${c}`)];
  if (testWhere.length) s.DescribeWhereIntegrationTestsLive = testWhere;
  const backend = ['app/api', 'src/app/api', 'pages/api', 'lib', 'src/lib', 'server', 'src/server', 'api', 'scripts']
    .filter((d) => files.some((f) => f.startsWith(`${d}/`)));
  if (backend.length) s.ListBackendFolders = [backend.map((d) => `\`${d}/\``).join(', ')];
  const headers = first(/^(src\/)?(next\.config\.[cm]?[jt]s|middleware\.[jt]s|proxy\.[jt]s|vercel\.json|netlify\.toml|_headers)$/, 4);
  if (headers.length) s.WhereHeadersAndCspLive = [headers.map((h) => `\`${h}\``).join(', ')];
  const guides = files.filter((f) => f.endsWith('.md') && STYLE_GUIDE_RE.test(base(f))).sort(shortestFirst).slice(0, 3);
  if (guides.length) s.StyleGuideFile = guides;
  return s;
}

/**
 * Sets `f.equivalent` (best match) and `f.equivalents` on each rendered file
 * whose own path is free but whose job an existing repo file already does.
 *
 * @param {string} dest - Repo root.
 * @param {{dest: string}[]} files - From `buildFiles`; mutated.
 * @returns {typeof files}
 */
export function attachEquivalents(dest, files) {
  const listing = repoFiles(dest);
  for (const f of files) {
    if (exists(path.join(dest, f.dest))) continue;
    const eq = equivalentsOf(f.dest, listing);
    if (eq.length) Object.assign(f, { equivalent: eq[0], equivalents: eq });
  }
  return files;
}

/**
 * Files the repo already has that do the job of `templateDest`, under another
 * path: the single-agent `rubber-duk.md`, a hook with the same name and an
 * extension, or a convention doc of the same name anywhere in the tree.
 *
 * @param {string} templateDest - The rendered file's repo-relative path.
 * @param {string[]} files - From `repoFiles()`.
 * @returns {string[]} Best match first; never `templateDest` itself.
 */
export function equivalentsOf(templateDest, files) {
  let found = [];
  const name = base(templateDest);
  const stem = (f) => base(f).replace(/\.[^.]+$/, '');
  if (/^\.claude\/agents\/rubber-duk-(review|post)\.md$/.test(templateDest)) found = files.filter((f) => f === '.claude/agents/rubber-duk.md');
  else if (templateDest.startsWith('.claude/hooks/')) found = files.filter((f) => f.startsWith('.claude/hooks/') && stem(f) === name && f !== templateDest);
  else if (['pr-guidelines.md', 'commit-and-pr-format.md'].includes(name)) found = byBase(files, 'commit-and-pr-format.md', 'pr-guidelines.md');
  else if (['comment-policy.md', 'agent-working-rules.md', 'gotchas.md'].includes(name)) found = byBase(files, name);
  return found.filter((f) => f !== templateDest);
}
