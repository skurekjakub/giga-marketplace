// Engine smoke tests: `node --test plugins/setup-ai/scripts/test/*.test.mjs`.
// Each test renders into a throwaway git repo and asserts on the result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workspace.mjs');
const ALL_PACKS = 'baseline,hooks,review-agents,dev-workflow,issue-tracking,tech-writing';

const VALUES = {
  tokens: {
    PROJECT_NAME: 'shop', DEFAULT_BRANCH: 'main', AI_DIR: '.agents', DEV_CMD: 'npm run dev', VERIFY_CMD: 'npm run verify',
    TEST_CMD: 'npm test', LOCAL_URL: 'http://localhost:3000', UNIT_TEST_GLOB: '**/*.test.*', E2E_GLOB: 'e2e/**',
    E2E_CMD: 'npm run test:e2e', STACK_SUMMARY: 'Next.js / TypeScript', JIRA_SITE: 'acme.atlassian.net', JIRA_CLOUD_ID: 'id',
    JIRA_PROJECT: 'ABC', JIRA_MCP_SERVER: 'jira', JIRA_CODE_EPIC: 'ABC-1', PRODUCT_NAME: 'Acme', DOCS_LINK_SYNTAX: '[t](/p)',
    RELEASE_NOTES_PATH: 'changelog', CHANGELOG_URL: 'https://acme.dev/changelog', CATEGORIES_FILE_PATH: 'changelog/categories.md',
    SOURCE_REPO_PATH: '../acme', SOURCE_REPO_URL: 'https://github.com/acme/acme', SOURCE_DEFAULT_BRANCH: 'main',
    SOURCE_TEST_DIR: 'tests', SOLUTION_OR_ENTRY_POINT: 'src/index.ts', TECH_STACK: 'TypeScript', REPO_NAME: 'acme',
    TEST_NAMING_PATTERN: '*.test.ts', ASSETS_ROOT: 'public/assets', STYLE_GUIDE_PATH: 'docs/d.md',
    EXAMPLE_DIAGRAM_PATH: 'public/assets/e.drawio.svg', ELEMENT_COLOR: '#123456', CONNECTOR_COLOR: '#654321',
    BRAND_FONT: 'Inter', MARKDOWN_SYNTAX_REF: 'docs/s.md', STYLE_GUIDE_DIR: '.agents/styleguides', CONTENT_GLOB: 'content/**',
    AGY_MODEL: 'model-high', GITHUB_REPO: 'acme/shop',
  },
  options: {
    profile: 'nextjs',
    rulesImport: 'claude-md',
    hooks: ['block-destructive-bash', 'prefer-verify-script', 'format-on-edit', 'project-context', 'remind-rules', 'notify-done', 'ado-pr-body', 'require-commit-format', 'rtk-read-compact'],
    agents: ['rubber-duk-review', 'rubber-duk-auditor', 'rubber-duk-backend', 'rubber-duk-frontend', 'rubber-duk-tests', 'rubber-duk-e2e', 'rubber-duk-post'],
    issueSkills: ['file-jira-issue', 'test-issue', 'file-github-issue'],
    codeWork: 'yes',
    writingSkills: ['docs-write-release-notes', 'docs-write-hotfix-notes', 'docs-source-validation', 'docs-create-drawio-diagram', 'docs-gemini-style-review'],
  },
};

function scratchRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-ai-test-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'shop', scripts: { dev: 'next dev', verify: 'tsc' }, devDependencies: { next: '16', react: '19' } }));
  const values = path.join(dir, '..', `${path.basename(dir)}-values.json`);
  fs.writeFileSync(values, JSON.stringify(VALUES));
  return { dir, values, cleanup: () => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(values, { force: true }); } };
}

function engine(...argv) {
  const r = spawnSync(process.execPath, [ENGINE, ...argv], { encoding: 'utf8' });
  return JSON.parse(r.stdout);
}

test('catalog lists every pack with unique option keys', () => {
  // Arrange & Act
  const cat = engine('catalog');
  // Assert
  assert.equal(cat.ok, true);
  assert.deepEqual(cat.packs.map((p) => p.name).sort(), ALL_PACKS.split(',').sort());
});

test('render fills every token, writes the record, and a second run changes nothing', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  // Act
  const first = engine('render', '--dest', repo.dir, '--packs', ALL_PACKS, '--values', repo.values);
  const second = engine('render', '--dest', repo.dir, '--packs', ALL_PACKS, '--values', repo.values);
  // Assert
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  assert.deepEqual(first.errors, []);
  assert.ok(first.written.length > 0);
  assert.ok(fs.existsSync(path.join(repo.dir, '.claude', 'setup-ai.json')));
  assert.equal(second.written.length, 0);
  assert.deepEqual(second.appended, []);
  assert.equal(second.settings, 'unchanged');
});

test('render drops @if blocks and never leaves markers or upper tokens behind', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  // Act
  engine('render', '--dest', repo.dir, '--packs', ALL_PACKS, '--values', repo.values);
  // Assert
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(repo.dir)) {
    const text = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(text, /@(if|endif)\b/, f);
    assert.doesNotMatch(text, /\{\{[A-Z][A-Z0-9_]*\}\}/, f);
  }
});

test('a locally edited file is a conflict on update, not an overwrite', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values);
  const agent = path.join(repo.dir, '.claude', 'agents', 'rubber-duk-review.md');
  fs.appendFileSync(agent, '\nlocal edit\n');
  // Act
  const res = engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--update');
  // Assert
  assert.deepEqual(res.conflicts, ['.claude/agents/rubber-duk-review.md']);
  assert.match(fs.readFileSync(agent, 'utf8'), /local edit/);
});

test('secrets stay ${VAR} references in .mcp.json', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  // Act
  engine('render', '--dest', repo.dir, '--packs', 'issue-tracking', '--values', repo.values);
  // Assert
  const mcp = JSON.parse(fs.readFileSync(path.join(repo.dir, '.mcp.json'), 'utf8'));
  assert.equal(mcp.mcpServers.jira.env.JIRA_API_TOKEN, '${JIRA_API_TOKEN}');
  assert.equal(mcp.mcpServers.jira.env.JIRA_PROJECT_KEY, 'ABC');
});

test('render refuses while tokens are missing', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  fs.writeFileSync(repo.values, JSON.stringify({ tokens: {}, options: {} }));
  // Act
  const res = engine('render', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values);
  // Assert
  assert.equal(res.ok, false);
  assert.ok(res.missingTokens.some((m) => m.token === 'AI_DIR'));
  assert.equal(fs.existsSync(path.join(repo.dir, 'CLAUDE.md')), false);
});

test('adding a pack keeps earlier requirements in the record and sees installed packs', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values);
  // Act
  engine('render', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values);
  // Assert
  const rec = JSON.parse(fs.readFileSync(path.join(repo.dir, '.claude', 'setup-ai.json'), 'utf8'));
  assert.ok(rec.plugins.includes('research-planning@giga-marketplace'));
  assert.ok(rec.vendorSkills.some((v) => v.skill === 'web-design-guidelines'));
  const rules = fs.readFileSync(path.join(repo.dir, '.agents', 'agent-working-rules.md'), 'utf8');
  assert.match(rules, /comment-policy\.md` is the policy/);
});

test('placeholder-shaped token values count as missing', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, tokens: { ...VALUES.tokens, JIRA_PROJECT: 'CHANGE_ME', PRODUCT_NAME: 'TODO_PRODUCT_NAME' } }));
  // Act
  const res = engine('plan', '--dest', repo.dir, '--packs', 'issue-tracking,tech-writing', '--values', repo.values);
  // Assert
  assert.deepEqual(res.missingTokens.map((m) => m.token).sort(), ['JIRA_PROJECT', 'PRODUCT_NAME']);
  assert.deepEqual(res.files, []);
});

test('an option value outside its choices is reported and blocks render', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, options: { ...VALUES.options, hooks: ['block-destructive-bsh'] } }));
  // Act
  const plan = engine('plan', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  const render = engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  // Assert
  assert.equal(plan.invalidOptions[0].value, 'block-destructive-bsh');
  assert.equal(render.ok, false);
  assert.equal(fs.existsSync(path.join(repo.dir, '.claude', 'hooks')), false);
});

test('a CRLF checkout of an unedited file is not a conflict on update', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values);
  const agent = path.join(repo.dir, '.claude', 'agents', 'rubber-duk-review.md');
  fs.writeFileSync(agent, fs.readFileSync(agent, 'utf8').replace(/\n/g, '\r\n'));
  // Act
  const res = engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--update');
  // Assert
  assert.deepEqual(res.conflicts, []);
});

test('condition grammar: ! negates, + ands, | ors', async () => {
  // Arrange
  const { evalCond } = await import('../lib/conditions.mjs');
  const ctx = { packs: ['hooks'], options: { profile: 'nextjs', agents: ['a', 'b'] }, detect: { flags: { vitest: true } } };
  // Act & Assert
  assert.equal(evalCond('pack:hooks', ctx), true);
  assert.equal(evalCond('!pack:hooks', ctx), false);
  assert.equal(evalCond('option:agents=a+detect:vitest', ctx), true);
  assert.equal(evalCond('option:agents=c+detect:vitest', ctx), false);
  assert.equal(evalCond('option:agents=c|profile:nextjs', ctx), true);
  assert.equal(evalCond('option:agents', ctx), true);
  assert.throws(() => evalCond('nonsense:x', ctx), /bad condition term/);
});

test('deepMerge keeps user scalars, merges objects and dedupes arrays', async () => {
  // Arrange
  const { deepMerge } = await import('../lib/settings.mjs');
  const target = { model: 'mine', permissions: { allow: ['a'] }, hooks: { Stop: [{ x: 1 }] } };
  // Act
  deepMerge(target, { model: 'theirs', permissions: { allow: ['a', 'b'] }, hooks: { Stop: [{ x: 1 }, { y: 2 }] }, newKey: true });
  // Assert
  assert.deepEqual(target, { model: 'mine', permissions: { allow: ['a', 'b'] }, hooks: { Stop: [{ x: 1 }, { y: 2 }] }, newKey: true });
});

test('every @if/@endif marker in the templates sits on its own line', () => {
  // Arrange
  const packs = path.join(path.dirname(ENGINE), '..', 'templates', 'packs');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const own = /^\s*(<!--|#)\s*@(if\s+\S.*|endif)\s*(-->)?\s*$/;
  // Act
  const bad = walk(packs).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n')
    .map((line, i) => [line, i + 1])
    .filter(([line]) => /@(if|endif)\b/.test(line) && /<!--\s*@|#\s*@(if|endif)/.test(line) && !own.test(line))
    .map(([, n]) => `${path.relative(packs, f)}:${n}`));
  // Assert
  assert.deepEqual(bad, []);
});

test('without an e2e agent, no pack asks for e2e tokens', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  const { E2E_GLOB, E2E_CMD, ...tokens } = VALUES.tokens;
  fs.writeFileSync(repo.values, JSON.stringify({ tokens, options: { ...VALUES.options, agents: ['rubber-duk-review', 'rubber-duk-tests'] } }));
  // Act
  const res = engine('plan', '--dest', repo.dir, '--packs', 'baseline,review-agents,dev-workflow', '--values', repo.values);
  // Assert
  assert.deepEqual(res.missingTokens.map((m) => `${m.token} (${m.firstUsedIn})`), []);
});

const snapshot = (dir) => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  return Object.fromEntries(walk(dir).map((f) => [path.relative(dir, f).split(path.sep).join('/'), fs.readFileSync(f, 'utf8')]));
};

test('removing every pack leaves the repo as it was, apart from enabledPlugins', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  fs.writeFileSync(path.join(repo.dir, 'CLAUDE.md'), '# shop\n\n@AGENTS.md\n');
  fs.writeFileSync(path.join(repo.dir, 'AGENTS.md'), '# Agents\n');
  const before = snapshot(repo.dir);
  engine('render', '--dest', repo.dir, '--packs', ALL_PACKS, '--values', repo.values);
  // Act
  const res = engine('remove', '--dest', repo.dir, '--packs', ALL_PACKS);
  // Assert
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  const { '.claude/settings.json': settings, ...after } = snapshot(repo.dir);
  assert.deepEqual(after, before);
  assert.equal(JSON.parse(settings).hooks, undefined);
  assert.ok(res.pluginsNoLongerRequired.some((p) => p.id === 'research-planning@giga-marketplace'));
});

test('a CRLF checkout (core.autocrlf) neither duplicates appends on re-render nor keeps them on remove', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'baseline,hooks,dev-workflow', '--values', repo.values);
  for (const f of ['.gitattributes', '.gitignore', 'CLAUDE.md']) {
    const p = path.join(repo.dir, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\n/g, '\r\n'));
  }
  // Act
  const again = engine('render', '--dest', repo.dir, '--packs', 'baseline,hooks,dev-workflow', '--values', repo.values);
  const removed = engine('remove', '--dest', repo.dir, '--packs', 'hooks');
  // Assert
  assert.deepEqual(again.appended, []);
  assert.equal(removed.ok, true, JSON.stringify(removed.errors));
  assert.equal(fs.existsSync(path.join(repo.dir, '.gitattributes')), false);
  assert.match(fs.readFileSync(path.join(repo.dir, '.gitignore'), 'utf8'), /\r\n/);
});

test('remove refuses a pack that another installed pack requires', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'dev-workflow', '--values', repo.values);
  // Act
  const res = engine('remove', '--dest', repo.dir, '--packs', 'review-agents');
  // Assert
  assert.equal(res.ok, false);
  assert.deepEqual(res.dependents, [{ pack: 'dev-workflow', requires: ['review-agents'] }]);
  assert.ok(fs.existsSync(path.join(repo.dir, '.claude', 'agents', 'rubber-duk-review.md')));
});

test('remove keeps an edited file, unhooks settings, and re-renders what mentioned the pack', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'baseline,hooks,issue-tracking', '--values', repo.values);
  const edited = path.join(repo.dir, '.claude', 'hooks', 'notify-done');
  fs.appendFileSync(edited, '\n# ours\n');
  // Act
  const res = engine('remove', '--dest', repo.dir, '--packs', 'hooks,issue-tracking');
  // Assert
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.deepEqual(res.files.keptEdited, ['.claude/hooks/notify-done']);
  assert.equal(fs.existsSync(path.join(repo.dir, '.claude', 'hooks', 'block-destructive-bash')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(repo.dir, '.claude', 'settings.json'), 'utf8')).hooks, undefined);
  assert.equal(fs.existsSync(path.join(repo.dir, '.gitattributes')), false);
  assert.equal(fs.existsSync(path.join(repo.dir, '.mcp.json')), false);
  const rules = fs.readFileSync(path.join(repo.dir, '.agents', 'agent-working-rules.md'), 'utf8');
  assert.doesNotMatch(rules, /file-jira-issue/);
  const rec = JSON.parse(fs.readFileSync(path.join(repo.dir, '.claude', 'setup-ai.json'), 'utf8'));
  assert.deepEqual(rec.packs.map((p) => p.name), ['baseline']);
  assert.equal(rec.tokens.JIRA_PROJECT, undefined);
  assert.equal(rec.options.issueSkills, undefined);
});

test('status reports edited and missing files and suggests repair', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values);
  fs.appendFileSync(path.join(repo.dir, '.claude', 'agents', 'rubber-duk-review.md'), '\nlocal edit\n');
  fs.rmSync(path.join(repo.dir, '.claude', 'agents', 'rubber-duk-tests.md'));
  // Act
  const res = engine('status', '--dest', repo.dir);
  // Assert
  assert.equal(res.installed, true);
  assert.deepEqual(res.files.edited.map((f) => f.file), ['.claude/agents/rubber-duk-review.md']);
  assert.deepEqual(res.files.missing.map((f) => f.file), ['.claude/agents/rubber-duk-tests.md']);
  assert.ok(res.suggest.includes('repair'));
});

test('an accepted verify script is added to package.json, turns the verify hook on, and goes on remove', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  const pkgFile = path.join(repo.dir, 'package.json');
  fs.writeFileSync(pkgFile, JSON.stringify({ name: 'shop', scripts: { lint: 'eslint .', test: 'vitest run', build: 'vite build' } }, null, 2) + '\n');
  const original = fs.readFileSync(pkgFile, 'utf8');
  const proposal = engine('detect', '--dest', repo.dir).proposals.verifyScript;
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, tokens: { ...VALUES.tokens, VERIFY_CMD: proposal.verifyCmd }, packageScripts: { [proposal.script]: proposal.command, lint: 'other' } }));
  // Act
  const plan = engine('plan', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  const render = engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  const scripts = JSON.parse(fs.readFileSync(pkgFile, 'utf8')).scripts;
  engine('remove', '--dest', repo.dir, '--packs', 'hooks');
  // Assert
  assert.equal(proposal.command, 'npm run lint && npm run test && npm run build');
  assert.equal(proposal.verifyCmd, 'npm run verify');
  assert.ok(plan.optionDefaults.hooks.includes('prefer-verify-script'));
  assert.deepEqual(render.packageScripts, { added: ['verify'], kept: ['lint'] });
  assert.equal(scripts.verify, proposal.command);
  assert.equal(scripts.lint, 'eslint .');
  assert.equal(fs.readFileSync(pkgFile, 'utf8'), original);
});

test('the GitHub issue skill needs gh and none of the Jira setup', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  const { JIRA_SITE, JIRA_CLOUD_ID, JIRA_PROJECT, JIRA_MCP_SERVER, JIRA_CODE_EPIC, ...tokens } = VALUES.tokens;
  fs.writeFileSync(repo.values, JSON.stringify({ tokens, options: { issueSkills: ['file-github-issue'], codeWork: 'no' } }));
  // Act
  const plan = engine('plan', '--dest', repo.dir, '--packs', 'issue-tracking', '--values', repo.values);
  const render = engine('render', '--dest', repo.dir, '--packs', 'issue-tracking', '--values', repo.values);
  // Assert
  assert.deepEqual(plan.missingTokens, []);
  assert.deepEqual(plan.prerequisites.clis.map((c) => c.name), ['gh']);
  assert.deepEqual(plan.prerequisites.env, []);
  assert.equal(render.ok, true, JSON.stringify(render.errors));
  assert.equal(fs.existsSync(path.join(repo.dir, '.mcp.json')), false);
  assert.match(fs.readFileSync(path.join(repo.dir, '.claude', 'skills', 'file-github-issue', 'SKILL.md'), 'utf8'), /--repo acme\/shop/);
});

const write = (dir, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const record = (dir) => JSON.parse(read(dir, '.claude/setup-ai.json'));

test('render refuses an unset option instead of reading it as "none", and --defaults takes the defaults', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  const { hooks: _hooks, ...options } = VALUES.options;
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, options }));
  // Act
  const refused = engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  const wroteOnRefusal = fs.existsSync(path.join(repo.dir, '.claude', 'setup-ai.json'));
  const defaulted = engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values, '--defaults');
  // Assert
  assert.equal(refused.ok, false);
  assert.deepEqual(refused.missingOptions, ['hooks']);
  assert.equal(wroteOnRefusal, false);
  assert.equal(defaulted.ok, true, JSON.stringify(defaulted.errors));
  assert.ok(fs.existsSync(path.join(repo.dir, '.claude', 'hooks', 'block-destructive-bash')));
  assert.ok(record(repo.dir).options.hooks.includes('block-destructive-bash'));
});

test('path tokens default to the old paths and follow a convention doc the repo already has', (t) => {
  // Arrange
  const fresh = scratchRepo();
  const owned = scratchRepo();
  t.after(fresh.cleanup);
  t.after(owned.cleanup);
  write(owned.dir, '.ai/comment-policy.md', '# Our policy\n');
  write(owned.dir, '.ai/shared/commit-and-pr-format.md', '# Commits\n');
  write(owned.dir, '.ai/shared/voice-style-guide.md', '# Voice\n');
  // Act
  engine('render', '--dest', fresh.dir, '--packs', 'review-agents,baseline', '--values', fresh.values);
  const facts = engine('detect', '--dest', owned.dir);
  // Assert
  assert.ok(fs.existsSync(path.join(fresh.dir, 'docs', 'conventions', 'comment-policy.md')));
  assert.ok(fs.existsSync(path.join(fresh.dir, 'docs', 'gotchas.md')));
  assert.ok(fs.existsSync(path.join(fresh.dir, '.agents', 'resources', 'pr-guidelines.md')));
  assert.match(read(fresh.dir, '.claude/agents/rubber-duk-review.md'), /`docs\/conventions\/comment-policy\.md` is authoritative/);
  assert.equal(record(fresh.dir).tokens.COMMENT_POLICY_PATH, 'docs/conventions/comment-policy.md');
  assert.equal(facts.tokens.COMMENT_POLICY_PATH, '.ai/comment-policy.md');
  assert.equal(facts.tokens.PR_GUIDE_PATH, '.ai/shared/commit-and-pr-format.md');
  assert.equal(facts.tokens.STYLE_GUIDE_DIR, '.ai/shared');
  assert.equal(facts.flags.existingWorkspace, true);
});

test('adopting keeps the repo file, records it as the baseline, and only re-raises it when the template moves', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  write(repo.dir, '.claude/agents/rubber-duk-review.md', '# our reviewer\n');
  write(repo.dir, '.claude/agents/rubber-duk.md', '# our single reviewer\n');
  const values = { ...VALUES, options: { ...VALUES.options, agents: ['rubber-duk-review', 'rubber-duk-post'] } };
  fs.writeFileSync(repo.values, JSON.stringify(values));
  // Act
  const plan = engine('plan', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values);
  const render = engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--adopt', 'all');
  const update = engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--update');
  const status = engine('status', '--dest', repo.dir);
  const removed = engine('remove', '--dest', repo.dir, '--packs', 'review-agents');
  // Assert
  assert.deepEqual(plan.existing.map((e) => [e.dest, e.file, e.how]).sort(), [
    ['.claude/agents/rubber-duk-post.md', '.claude/agents/rubber-duk.md', 'equivalent'],
    ['.claude/agents/rubber-duk-review.md', '.claude/agents/rubber-duk-review.md', 'same-path'],
  ]);
  assert.equal(render.ok, true, JSON.stringify(render.errors));
  assert.deepEqual(render.adopted.map((a) => a.file).sort(), ['.claude/agents/rubber-duk-review.md', '.claude/agents/rubber-duk.md']);
  assert.equal(fs.existsSync(path.join(repo.dir, '.claude', 'agents', 'rubber-duk-post.md')), false);
  assert.deepEqual(update.conflicts, []);
  assert.equal(update.adopted.length, 2);
  assert.equal(status.files.counts.adopted, 2);
  assert.deepEqual(status.files.missing, []);
  assert.equal(read(repo.dir, '.claude/agents/rubber-duk-review.md'), '# our reviewer\n');
  assert.equal(removed.ok, true, JSON.stringify(removed.errors));
  assert.deepEqual(removed.files.keptAdopted.sort(), ['.claude/agents/rubber-duk-review.md', '.claude/agents/rubber-duk.md']);
  assert.ok(fs.existsSync(path.join(repo.dir, '.claude', 'agents', 'rubber-duk.md')));
});

test('an adopted file whose template changed since comes back as a conflict on update', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  write(repo.dir, '.claude/agents/rubber-duk-review.md', '# our reviewer\n');
  engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--adopt', '.claude/agents/rubber-duk-review.md');
  const rec = record(repo.dir);
  rec.files['.claude/agents/rubber-duk-review.md'].hash = 'older-template';
  write(repo.dir, '.claude/setup-ai.json', JSON.stringify(rec));
  // Act
  const update = engine('render', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--update');
  // Assert
  assert.deepEqual(update.conflicts, ['.claude/agents/rubber-duk-review.md']);
  assert.equal(read(repo.dir, '.claude/agents/rubber-duk-review.md'), '# our reviewer\n');
});

test('diff shows each conflict as a unified diff and lists the lines the template would drop', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values);
  const rules = '.agents/agent-working-rules.md';
  fs.appendFileSync(path.join(repo.dir, rules), '\n- Every change ends with a `CHANGELOG.md` entry; see `.ai/shared/commit-and-pr-format.md`.\n');
  // Act
  const res = engine('diff', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values);
  // Assert
  assert.equal(res.ok, true, res.error);
  assert.equal(res.files.length, 1);
  assert.equal(res.files[0].dest, rules);
  assert.match(res.files[0].diff, /^-- Every change ends with a `CHANGELOG\.md` entry/m);
  assert.deepEqual(res.files[0].wouldDrop.flatMap((d) => d.refs).sort(), ['.ai/shared/commit-and-pr-format.md', 'CHANGELOG.md']);
});

test('render never writes the skill-extensions folder and the workflows point at it', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  write(repo.dir, '.agents/skill-extensions/feature-development.md', '## finish\n\n- Add a CHANGELOG.md entry.\n');
  // Act
  const res = engine('render', '--dest', repo.dir, '--packs', 'dev-workflow', '--values', repo.values);
  // Assert
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.equal(res.written.some((w) => w.dest.includes('skill-extensions')), false);
  assert.equal(Object.keys(record(repo.dir).files).some((f) => f.includes('skill-extensions')), false);
  assert.equal(read(repo.dir, '.agents/skill-extensions/feature-development.md'), '## finish\n\n- Add a CHANGELOG.md entry.\n');
  for (const skill of ['feature-development', 'project-bugfixing', 'codebase-refactoring', 'codebase-analysis']) {
    assert.match(read(repo.dir, `.claude/skills/${skill}/SKILL.md`), new RegExp(`\\.agents/skill-extensions/${skill}\\.md`));
  }
});

test('settings.json is edited in place: comment keys, blank lines and untouched arrays keep their text', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  const original = '{\n    "//": "Project settings; overrides go in settings.local.json.",\n\n    "permissions": {\n        "deny": ["Bash(npm publish*)"]\n    }\n}\n';
  write(repo.dir, '.claude/settings.json', original);
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, options: { ...VALUES.options, hooks: ['block-destructive-bash'] } }));
  // Act
  engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  const after = read(repo.dir, '.claude/settings.json');
  const again = engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  // Assert
  assert.ok(after.startsWith('{\n    "//": "Project settings; overrides go in settings.local.json.",\n\n    "permissions": {\n        "deny": ["Bash(npm publish*)"]\n    },\n    "hooks": {\n        "PreToolUse": [\n'), after);
  assert.equal(JSON.parse(after).hooks.PreToolUse[0].matcher, 'Bash');
  assert.equal(again.settings, 'unchanged');
  assert.equal(read(repo.dir, '.claude/settings.json'), after);
});

test('editJson removes and adds keys without touching the members around them', async () => {
  // Arrange
  const { editJson } = await import('../lib/json-edit.mjs');
  const text = '{\n  "a": [1, 2],\n\n  "gone": { "x": 1 },\n  "b": "keep"\n}\n';
  // Act
  const removed = editJson(text, { a: [1, 2], b: 'keep' });
  const added = editJson(text, { a: [1, 2], gone: { x: 1 }, b: 'keep', c: { d: true } });
  // Assert
  assert.equal(removed, '{\n  "a": [1, 2],\n  "b": "keep"\n}\n');
  assert.equal(added, '{\n  "a": [1, 2],\n\n  "gone": { "x": 1 },\n  "b": "keep",\n  "c": {\n    "d": true\n  }\n}\n');
  assert.equal(editJson(text, JSON.parse(text)), text);
});

test('a hook the repo already wires through a wrapper is not added a second time', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  const wrapped = (name) => ({ type: 'command', command: `"\${CLAUDE_PROJECT_DIR}/.claude/hooks/run-hook.cmd" ${name}` });
  write(repo.dir, '.claude/settings.json', JSON.stringify({
    '//': 'keep me',
    hooks: {
      PostToolUse: [{ matcher: 'Edit|Write|MultiEdit|Bash', hooks: [wrapped('remind-rules')] }],
      PreToolUse: [{ matcher: 'Bash', hooks: [wrapped('block-destructive-bash')] }],
    },
  }, null, 2));
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, options: { ...VALUES.options, hooks: ['block-destructive-bash', 'remind-rules'] } }));
  // Act
  engine('render', '--dest', repo.dir, '--packs', 'hooks', '--values', repo.values);
  // Assert
  const settings = JSON.parse(read(repo.dir, '.claude/settings.json'));
  const commands = (event) => settings.hooks[event].flatMap((e) => e.hooks.map((h) => h.command));
  assert.equal(settings['//'], 'keep me');
  assert.equal(commands('PostToolUse').filter((c) => c.includes('remind-rules')).length, 1);
  assert.equal(commands('PreToolUse').filter((c) => c.includes('block-destructive-bash')).length, 1);
  assert.equal(commands('UserPromptSubmit').filter((c) => c.includes('remind-rules')).length, 1);
});

test('an AGENTS.md-only repo gets the rules import in AGENTS.md and no CLAUDE.md', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  write(repo.dir, 'AGENTS.md', '# Agents\n');
  const { rulesImport: _r, ...options } = VALUES.options;
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, options }));
  // Act
  const plan = engine('plan', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values);
  const render = engine('render', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values, '--defaults');
  // Assert
  assert.equal(plan.optionDefaults.rulesImport, 'agents-md');
  assert.equal(render.ok, true, JSON.stringify(render.errors));
  assert.equal(fs.existsSync(path.join(repo.dir, 'CLAUDE.md')), false);
  assert.equal(read(repo.dir, 'AGENTS.md'), '# Agents\n\n@.agents/agent-working-rules.md\n');
  assert.match(read(repo.dir, '.agents/agent-working-rules.md'), /imported from `AGENTS\.md`/);
});

test('placeholder values fill skeleton placeholders, and plan suggests candidates for the rest', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  write(repo.dir, 'app/components/Callout.tsx', 'export {};\n');
  write(repo.dir, 'tests/lib/x.test.ts', '');
  // Act
  const plan = engine('plan', '--dest', repo.dir, '--packs', 'dev-workflow', '--values', repo.values);
  fs.writeFileSync(repo.values, JSON.stringify({ ...VALUES, placeholders: { ReferenceComponentPath: 'app/components/Callout.tsx' } }));
  const render = engine('render', '--dest', repo.dir, '--packs', 'dev-workflow', '--values', repo.values);
  // Assert
  const ui = plan.todos.find((x) => x.file.endsWith('ui-surface-rules.md'));
  assert.deepEqual(ui.suggestions.ReferenceComponentPath, ['app/components/Callout.tsx']);
  assert.ok(plan.todos.find((x) => x.file.endsWith('test-layout.md')).suggestions.DescribeWhereIntegrationTestsLive[0].startsWith('tests/'));
  assert.equal(render.todos.some((x) => x.placeholders.includes('ReferenceComponentPath')), false);
  assert.match(read(repo.dir, '.claude/skills/feature-development/references/ui-surface-rules.md'), /app\/components\/Callout\.tsx/);
  assert.equal(record(repo.dir).placeholders.ReferenceComponentPath, 'app/components/Callout.tsx');
});

test('the record carries provenance and status lists the changelog since the recorded version', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  engine('render', '--dest', repo.dir, '--packs', 'baseline', '--values', repo.values);
  const rec = record(repo.dir);
  write(repo.dir, '.claude/setup-ai.json', JSON.stringify({ ...rec, setupAiVersion: '0.2.3' }));
  // Act
  const status = engine('status', '--dest', repo.dir);
  // Assert
  assert.equal(rec.setupAiSource.marketplace, 'giga-marketplace');
  assert.match(rec.setupAiSource.commit ?? '', /^[0-9a-f]{40}$/);
  assert.ok(status.changelog.length >= 1);
  assert.ok(status.changelog.every((e) => e.version !== '0.2.3'));
  assert.ok(status.suggest.includes('update'));
});

test('detect reports skills vendored from a plugin of this marketplace', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  write(repo.dir, '.claude/skills/iterative-research/SKILL.md', '---\nname: iterative-research\n---\n');
  write(repo.dir, '.claude/skills/our-own/SKILL.md', '---\nname: our-own\n---\n');
  // Act
  const facts = engine('detect', '--dest', repo.dir);
  // Assert
  assert.equal(facts.vendoredDuplicates.available, true);
  assert.deepEqual(facts.vendoredDuplicates.duplicates.map((d) => [d.skill, d.id]), [['iterative-research', 'research-planning@giga-marketplace']]);
});

test('prereqs --update refreshes marketplaces and updates plugins from the repo directory', (t) => {
  // Arrange
  const repo = scratchRepo();
  t.after(repo.cleanup);
  // Act
  const res = engine('prereqs', '--dest', repo.dir, '--packs', 'review-agents', '--values', repo.values, '--update', '--dry-run');
  // Assert
  const steps = res.results.map((r) => r.step);
  assert.ok(steps.includes('claude plugin marketplace update giga-marketplace'), JSON.stringify(steps));
  assert.ok(res.results.filter((r) => r.step.startsWith('claude ')).every((r) => r.cwd === repo.dir));
});
