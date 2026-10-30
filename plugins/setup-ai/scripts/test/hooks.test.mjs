// Hook behaviour: renders the hooks pack into a throwaway repo and pipes
// PreToolUse payloads into the rendered scripts. Needs bash and jq; skipped
// without them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENGINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workspace.mjs');
const has = (bin) => spawnSync('sh', ['-c', `command -v ${bin}`]).status === 0;
const skip = process.platform === 'win32' || !has('bash') || !has('jq') ? 'needs bash and jq' : false;

function renderedHooks() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-ai-hooks-'));
  const repo = path.join(root, 'repo');
  const other = path.join(root, 'other');
  fs.mkdirSync(repo);
  fs.mkdirSync(other);
  spawnSync('git', ['init', '-q'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'shop', scripts: { verify: 'tsc' } }));
  const values = path.join(root, 'values.json');
  fs.writeFileSync(values, JSON.stringify({
    tokens: { PROJECT_NAME: 'shop', AI_DIR: '.ai', VERIFY_CMD: 'npm run verify' },
    options: { hooks: ['block-destructive-bash', 'prefer-verify-script', 'require-commit-format'] },
  }));
  const res = spawnSync(process.execPath, [ENGINE, 'render', '--dest', repo, '--packs', 'hooks', '--values', values], { encoding: 'utf8' });
  assert.equal(JSON.parse(res.stdout).ok, true, res.stdout);
  return { repo, other, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

// Exit code of hook `name` for `command` run from `cwd`.
function hook(env, name, command, cwd = env.repo) {
  const r = spawnSync('bash', [path.join(env.repo, '.claude', 'hooks', name)], {
    input: JSON.stringify({ cwd, tool_input: { command } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: env.repo },
    encoding: 'utf8',
  });
  return r.status;
}

test('the Bash guards block inside the project and stand aside outside it', { skip }, (t) => {
  // Arrange
  const env = renderedHooks();
  t.after(env.cleanup);
  // Act & Assert
  assert.equal(hook(env, 'require-commit-format', 'git commit -m "subject only"'), 2);
  assert.equal(hook(env, 'require-commit-format', `cd ${env.other} && git commit -m "subject only"`), 0);
  assert.equal(hook(env, 'require-commit-format', `git -C ${env.other} commit -m "subject only"`), 0);
  assert.equal(hook(env, 'require-commit-format', 'git commit -m "subject only"', env.other), 0);
  assert.equal(hook(env, 'require-commit-format', 'git commit -m "subject" -m "body"'), 0);
  assert.equal(hook(env, 'require-commit-format', 'gh pr create --fill'), 2);
  assert.equal(hook(env, 'block-destructive-bash', 'git push --force'), 2);
  assert.equal(hook(env, 'block-destructive-bash', `cd "${env.other}" && git push --force`), 0);
  assert.equal(hook(env, 'block-destructive-bash', `cd ${env.other} && rm -rf /`), 2);
  assert.equal(hook(env, 'prefer-verify-script', 'npm run lint && npm test'), 2);
  assert.equal(hook(env, 'prefer-verify-script', `cd ${env.other}; npm run lint && npm test`), 0);
  assert.equal(hook(env, 'prefer-verify-script', 'cd src && npm run lint && npm test'), 2);
});

test('a directory that does not resolve counts as inside the project', { skip }, (t) => {
  // Arrange
  const env = renderedHooks();
  t.after(env.cleanup);
  // Act & Assert
  assert.equal(hook(env, 'block-destructive-bash', 'cd /no/such/dir && git push --force'), 2);
});
