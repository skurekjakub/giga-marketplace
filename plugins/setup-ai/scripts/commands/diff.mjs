import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { die, listArg, lf, out } from '../lib/util.mjs';
import { run } from '../lib/proc.mjs';
import { buildFiles } from '../lib/packs.mjs';
import { attachEquivalents } from '../lib/repo-scan.mjs';
import { fileAction, planFor, readRecord } from '../lib/context.mjs';

const URL_RE = /\bhttps?:\/\/\S+/g;
// A path-like word: has a slash and either a dot or a trailing slash, or is a
// bare file name with a known extension. "and/or" is not a path.
const PATH_RE = /(?:\.?[\w<>*{}@-]+\/)+(?:[\w<>*{}@.-]*\.[\w*]+|(?=[\s`'")\]:,;]|$))|\b[\w-]+\.(?:md|mdx|ts|tsx|js|mjs|cjs|json|ya?ml|sh|html|css|py|toml)\b/g;
const SKILL_REF_RE = /`([a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*)`/g;
const IDENT_RE = /`([a-z0-9][a-z0-9-]+)`/g;

/**
 * Paths, `plugin:skill` references and names of the repo's own skills and
 * agents that one line of text mentions.
 *
 * @param {string} line
 * @param {Set<string>} names - Skill and agent names to recognise in backticks.
 * @returns {string[]}
 */
export function lineRefs(line, names) {
  const text = line.replace(URL_RE, ' ');
  const refs = new Set();
  const imp = text.match(/^@(\S+)/);
  if (imp) refs.add(imp[1]);
  for (const m of text.matchAll(PATH_RE)) refs.add(m[0]);
  for (const m of text.matchAll(SKILL_REF_RE)) refs.add(m[1]);
  for (const m of text.matchAll(IDENT_RE)) if (names.has(m[1])) refs.add(m[1]);
  // `*/` closing a code-sample comment and product names like Next.js look
  // like paths to the regex; neither is something a template could drop.
  return [...refs].filter((r) => /[A-Za-z0-9]/.test(r) && !/^[A-Z][A-Za-z]*\.js$/.test(r));
}

/**
 * Lines of the repo's file that reference a path, a skill or a file the
 * template render never mentions — what overwriting the file with the
 * template would silently lose.
 *
 * @param {string} theirs - The repo's file.
 * @param {string} template - The rendered template.
 * @param {Set<string>} names - Skill and agent names to recognise.
 * @returns {{line: number, text: string, refs: string[]}[]}
 */
export function wouldDrop(theirs, template, names) {
  const mentioned = (ref) => template.includes(ref) || (/\.\w+$/.test(ref) && template.includes(ref.split('/').pop()));
  return lf(theirs).split('\n').flatMap((text, i) => {
    const refs = lineRefs(text, names).filter((r) => !mentioned(r));
    return refs.length ? [{ line: i + 1, text: text.trim(), refs }] : [];
  });
}

// Line-multiset counts, for when git is unavailable to produce a real diff.
function lineSummary(theirs, template) {
  const count = (s) => s.split('\n').reduce((m, l) => m.set(l, (m.get(l) ?? 0) + 1), new Map());
  const [a, b] = [count(lf(theirs)), count(lf(template))];
  const only = (x, y) => [...x].reduce((n, [l, c]) => n + Math.max(0, c - (y.get(l) ?? 0)), 0);
  return { removed: only(a, b), added: only(b, a) };
}

/**
 * `diff` — for every file a render would leave alone because the repo has
 * its own version (a conflict at the same path, a file adopted earlier, or an
 * equivalent under another path), the unified diff from the repo's file to
 * the template render, line counts, and `wouldDrop`: the repo file's lines
 * that reference paths, skills or files the template does not mention.
 * Renders into a temp folder (kept and reported with `--keep`); writes
 * nothing in the repo. `--files a,b` limits it to those template paths;
 * `--summary` leaves the diff text out.
 */
export function cmdDiff(args) {
  const { all, order, ctx, missingTokens, missingOptions, invalidOptions } = planFor(args);
  if (missingTokens.length || missingOptions.length || invalidOptions.length) {
    die('missing or invalid values — diff renders the templates, so it needs what render needs', { missingTokens, missingOptions, invalidOptions });
  }
  const record = readRecord(ctx.dest);
  const files = attachEquivalents(ctx.dest, buildFiles(all, order, ctx));
  const only = listArg(args.files);
  const existing = ctx.detect.existing ?? {};
  const names = new Set([...(existing.skills ?? []), ...(existing.agents ?? []).map((a) => path.basename(a, '.md'))]);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-ai-diff-'));
  const results = [];
  try {
    for (const f of files) {
      if (only.length && !only.includes(f.dest)) continue;
      const action = fileAction(ctx.dest, f, record, { update: args.update });
      const theirs = action === 'conflict' ? f.dest
        : action === 'adopted' ? record.files[f.dest].adopted
          : action === 'create' ? f.equivalent : null;
      if (!theirs) continue;
      const how = theirs === f.dest ? 'same-path' : 'equivalent';
      if (f.text === null) {
        results.push({ dest: f.dest, file: theirs, how, action, binary: true });
        continue;
      }
      const theirText = fs.readFileSync(path.join(ctx.dest, theirs), 'utf8');
      // Both sides LF, so a CRLF checkout doesn't show every line as changed.
      const a = path.posix.join('repo', theirs);
      const b = path.posix.join('template', f.dest);
      for (const [rel, body] of [[a, lf(theirText)], [b, f.text]]) {
        fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
        fs.writeFileSync(path.join(tmp, rel), body);
      }
      const r = run('git', ['diff', '--no-index', '--no-color', `-U${Number(args.context ?? 3)}`, '--', a, b], { cwd: tmp, shell: false });
      const diff = r.code === 0 || r.code === 1 ? r.stdout : null;
      results.push({
        dest: f.dest,
        file: theirs,
        how,
        action,
        stats: lineSummary(theirText, f.text),
        ...(args.summary ? {} : { diff }),
        ...(diff === null ? { diffError: r.stderr.slice(-500) } : {}),
        wouldDrop: wouldDrop(theirText, f.text, names),
      });
    }
  } finally {
    if (!args.keep) fs.rmSync(tmp, { recursive: true, force: true });
  }
  out({ ok: true, packs: order, files: results, tempDir: args.keep ? tmp : null });
}
