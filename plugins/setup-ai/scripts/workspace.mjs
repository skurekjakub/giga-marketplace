#!/usr/bin/env node
/**
 * setup-ai workspace engine — CLI entry point. Requires Node.js >= 18 (no npm
 * packages); packs that install vendor skills need Node >= 22.20 because
 * `npx skills` does.
 *
 * The bootstrap-agent-workspace skill drives this; every command prints one
 * JSON document on stdout so the agent reads results instead of parsing prose.
 *
 *   catalog                                     list packs and global tokens
 *   detect   --dest <repo>                      repo facts + inferred token/option values
 *   plan     --dest <repo> --packs a,b [--values v.json] [--update] [--overwrite p1,p2]
 *                                               deps, prerequisites, missing tokens, file actions (writes nothing)
 *   prereqs  --dest <repo> --packs a,b [--values v.json]
 *                                               install missing marketplaces, plugins and vendor skills
 *   render   --dest <repo> --packs a,b --values v.json [--dry-run] [--overwrite p1,p2|all] [--update]
 *                                               write files, appends, settings, .mcp.json, install record
 *   status   --dest <repo>                      installed packs, file states, prerequisites (writes nothing)
 *   remove   --dest <repo> --packs a,b [--dry-run] [--delete-edited p1,p2|all] [--prune-vendor-skills]
 *                                               uninstall packs and re-render the rest
 *   vendor   check|install|restore --dest <repo> [--packs a,b] [--values v.json]
 *   session-check [--dest <repo>]               the plugin's SessionStart hook
 *
 * values.json: { "tokens": { "PROJECT_NAME": "…" }, "options": { "profile": "nextjs", … },
 *               "packageScripts": { "verify": "npm run lint && npm test" } }
 * Install record: <repo>/.claude/setup-ai.json (commit it).
 *
 * Layout: lib/ holds the shared modules (templating, packs, settings,
 * prerequisites, vendor skills, detection); commands/ holds one module per
 * command.
 */
import { die, out } from './lib/util.mjs';
import { detect } from './lib/detect.mjs';
import { cmdCatalog } from './commands/catalog.mjs';
import { cmdPlan } from './commands/plan.mjs';
import { cmdPrereqs } from './commands/prereqs.mjs';
import { cmdRender } from './commands/render.mjs';
import { cmdVendor } from './commands/vendor.mjs';
import { cmdStatus } from './commands/status.mjs';
import { cmdRemove } from './commands/remove.mjs';
import { cmdSessionCheck } from './commands/session-check.mjs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true;
    else {
      args[a.slice(2)] = next;
      i++;
    }
  }
  return args;
}

const COMMANDS = {
  catalog: cmdCatalog,
  detect: (args) => out({ ok: true, ...detect(args.dest ?? process.cwd()) }),
  plan: cmdPlan,
  prereqs: cmdPrereqs,
  render: cmdRender,
  status: cmdStatus,
  remove: cmdRemove,
  vendor: cmdVendor,
  'session-check': cmdSessionCheck,
};

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
try {
  if (!COMMANDS[cmd]) die(`usage: workspace.mjs ${Object.keys(COMMANDS).join('|')} [--dest repo] [--packs a,b] [--values v.json]`);
  COMMANDS[cmd](args);
} catch (err) {
  if (cmd === 'session-check') process.exit(0); // never break a session start
  die(err.message);
}
