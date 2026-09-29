import fs from 'node:fs';
import path from 'node:path';
import { RECORD, exists, readJson } from './util.mjs';
import { run } from './proc.mjs';

const PM_RUNNERS = {
  yarn: (s) => `yarn ${s}`,
  pnpm: (s) => `pnpm ${s}`,
  bun: (s) => `bun run ${s}`,
  npm: (s) => `npm run ${s}`,
};

function packageManager(dest, pkg) {
  if (exists(path.join(dest, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(dest, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(dest, 'bun.lockb')) || exists(path.join(dest, 'bun.lock'))) return 'bun';
  return pkg ? 'npm' : null;
}

/**
 * Repo facts the wizard derives its defaults from: package manager, scripts,
 * framework flags, inferred token values and a stack-profile guess. Reads
 * files and runs git; writes nothing.
 */
export function detect(dest) {
  const pkg = readJson(path.join(dest, 'package.json'), null);
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const scripts = pkg?.scripts ?? {};
  const pm = packageManager(dest, pkg);
  const runScript = PM_RUNNERS[pm] ?? PM_RUNNERS.npm;
  const git = (argv) => {
    const r = run('git', argv, { cwd: dest, shell: false });
    return r.code === 0 ? r.stdout.trim() : '';
  };
  const originHead = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']).replace(/^origin\//, '');
  const remote = git(['remote', 'get-url', 'origin']);
  const has = (d) => d in deps;
  const npmrc = path.join(dest, '.npmrc');
  const firstScript = (...names) => names.find((n) => n in scripts);
  const verify = firstScript('verify', 'check', 'ci');

  const flags = {
    node: Boolean(pkg),
    next: has('next'), react: has('react'), vue: has('vue'), svelte: has('svelte'), vite: has('vite'),
    vitest: has('vitest'), jest: has('jest'), playwright: has('@playwright/test') || has('playwright'),
    tailwind: has('tailwindcss'), typescript: has('typescript') || exists(path.join(dest, 'tsconfig.json')),
    eslint: has('eslint'), prettier: has('prettier'),
    ado: /dev\.azure\.com|visualstudio\.com/.test(remote) || exists(path.join(dest, 'azure-pipelines.yml')),
    github: /github\.com/.test(remote),
    npmrcCooldown: exists(npmrc) && /min-release-age/.test(fs.readFileSync(npmrc, 'utf8')),
    claudeMd: exists(path.join(dest, 'CLAUDE.md')),
    agentsMd: exists(path.join(dest, 'AGENTS.md')),
    claudeSettings: exists(path.join(dest, '.claude', 'settings.json')),
    installed: exists(path.join(dest, RECORD)),
    verifyScript: Boolean(verify),
  };

  // Without an origin/HEAD, an existing main/master beats the checked-out
  // branch, which is often a feature branch or a worktree's branch.
  const localBranch = ['main', 'master'].find((b) => git(['rev-parse', '--verify', '--quiet', `refs/heads/${b}`]));
  const tokens = {
    PROJECT_NAME: pkg?.name?.replace(/^@[^/]+\//, '') || path.basename(path.resolve(dest)),
    DEFAULT_BRANCH: originHead || localBranch || git(['branch', '--show-current']) || 'main',
    AI_DIR: '.ai',
  };
  // Gates chained with && as VERIFY_CMD work, but a named script is easier to
  // run, to allow in a hook, and to keep in step with CI — so the wizard offers
  // to add one when the repo has several gates and no verify script.
  let verifyScriptProposal = null;
  if (pm) {
    const gates = ['typecheck', 'lint', 'test', 'build'].filter((n) => n in scripts);
    if (!verify && gates.length >= 2) {
      verifyScriptProposal = { script: 'verify', command: gates.map(runScript).join(' && '), verifyCmd: runScript('verify') };
    }
    const e2e = firstScript('test:e2e', 'e2e', 'test:playwright');
    if ('dev' in scripts) tokens.DEV_CMD = runScript('dev');
    if (verify) tokens.VERIFY_CMD = runScript(verify);
    else if (gates.length) tokens.VERIFY_CMD = gates.map(runScript).join(' && ');
    if ('test' in scripts) tokens.TEST_CMD = pm === 'npm' ? 'npm test' : runScript('test');
    if (e2e) tokens.E2E_CMD = runScript(e2e);
    if ('typecheck' in scripts) tokens.TYPECHECK_CMD = runScript('typecheck');
    if ('build' in scripts) tokens.BUILD_CMD = runScript('build');
  }
  const gh = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/);
  if (gh) tokens.GITHUB_REPO = gh[1];
  if (flags.next) tokens.LOCAL_URL = 'http://localhost:3000';
  else if (flags.vite) tokens.LOCAL_URL = 'http://localhost:5173';
  tokens.UNIT_TEST_GLOB = exists(path.join(dest, '__tests__')) ? '__tests__/**' : exists(path.join(dest, 'test')) ? 'test/**' : '**/*.test.*';
  if (flags.playwright || exists(path.join(dest, 'e2e'))) tokens.E2E_GLOB = exists(path.join(dest, 'e2e')) ? 'e2e/**' : 'tests/e2e/**';
  const stack = [
    flags.next && 'Next.js', flags.react && !flags.next && 'React', flags.vue && 'Vue', flags.svelte && 'Svelte',
    flags.typescript && 'TypeScript', flags.tailwind && 'Tailwind CSS', flags.vitest && 'Vitest', flags.jest && 'Jest',
    flags.playwright && 'Playwright',
  ].filter(Boolean);
  if (stack.length) tokens.STACK_SUMMARY = stack.join(' / ');

  return {
    dest: path.resolve(dest),
    packageManager: pm,
    scripts: Object.keys(scripts),
    flags,
    tokens,
    options: { profile: flags.next ? 'nextjs' : 'generic' },
    proposals: { verifyScript: verifyScriptProposal },
    suggestedPacks: ['baseline', 'hooks', 'review-agents', 'dev-workflow'],
    remote: remote || null,
  };
}
