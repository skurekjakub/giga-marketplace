import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { IS_WIN, exists } from './util.mjs';

/**
 * Runs a command and returns `{ code, stdout, stderr }`; never throws.
 *
 * On Windows, npx/claude may be .cmd shims that only run through a shell, so
 * the command is built as one quoted line instead of passing args with
 * shell:true (which Node deprecates because the args are concatenated
 * unescaped). Pass `shell: false` for a real executable.
 */
export function run(cmd, argv, opts = {}) {
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

/** True when `bin` can be run from this machine (Git Bash for `bash` on Windows). */
export function onPath(bin) {
  if (bin === 'bash' && IS_WIN) return gitBashOnWindows();
  const r = IS_WIN ? run('where', [bin]) : run('sh', ['-c', `command -v ${bin}`], { shell: false });
  return r.code === 0;
}
