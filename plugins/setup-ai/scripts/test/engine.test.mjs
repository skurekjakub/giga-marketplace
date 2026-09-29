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
    AGY_MODEL: 'model-high',
  },
  options: {
    profile: 'nextjs',
    hooks: ['block-destructive-bash', 'prefer-verify-script', 'format-on-edit', 'project-context', 'remind-rules', 'notify-done', 'ado-pr-body'],
    agents: ['rubber-duk-review', 'rubber-duk-auditor', 'rubber-duk-backend', 'rubber-duk-frontend', 'rubber-duk-tests', 'rubber-duk-e2e'],
    jiraSkills: ['file-jira-issue', 'test-issue'],
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
