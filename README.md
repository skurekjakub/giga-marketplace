# giga-marketplace

A Claude Code plugin marketplace: plug-and-play skills for agentic engineering, research and
planning, Copilot CLI and npm maintenance — plus **setup-ai**, a bootstrap wizard that vendors
customizable agent-workspace templates into any repository.

```bash
/plugin marketplace add skurekjakub/giga-marketplace
```

## Plugins

### Plug-and-play

Install and use — nothing to configure.

| Plugin | What it gives you |
|---|---|
| `agent-architecture` | Designing, building and auditing multi-agent systems: agent-as-function orchestrators with filesystem artifact handoff, fractal orchestrator architectures, workflow evals, guided agent-family creation, autonomous optimization loops. |
| `research-planning` | Iterative multi-round web research, deep research that leaves a measured evidence record, mapping your own unknown unknowns before a long task, task-graph planning. |
| `copilot-cli` | GitHub Copilot CLI: debug-log analysis, extension development, system-prompt patching, writing large files without timeouts. |
| `npm-maintenance` | Moving npm dependencies safely: audit fixes, in-range refreshes, release-age cooldown failures. |

### setup-ai — templates vendored into your repo

Some things only make sense against a specific stack and project: review agents that know
your conventions, workflows that write journals into your repo, hooks that know your verify
command. `setup-ai` ships those as **template packs** and one wizard skill that installs them:

```
/setup-ai:bootstrap-agent-workspace
```

It detects the repo, asks which packs you want, shows every prerequisite the chosen packs
need and asks once before installing them, fills the templates with your project's details,
merges `.claude/settings.json` and `.mcp.json`, and records the install in
`.claude/setup-ai.json` so `add`, `update`, `repair`, `status` and `remove` work later.
`remove` deletes only files nobody edited and takes its hooks, appended lines and MCP
servers back out.

| Pack | Installs |
|---|---|
| `baseline` | Agent working rules imported from `CLAUDE.md`, PR guidelines |
| `hooks` | Guard-rail bash hooks: block destructive commands, prefer the verify command, format on edit, re-inject context after compaction, periodic rule reminders, done notifications, ADO PR limits |
| `review-agents` | `rubber-duk-*` subagents (review, security audit, backend, frontend, unit tests, e2e) with a per-repo stack profile (Next.js or generic) and starter convention docs |
| `dev-workflow` | Feature, bugfix, refactor and read-only analysis workflows with journals, review gates and published explainers |
| `issue-tracking` | Jira ticket filing and ticket QA, with the [jira-mcp](https://github.com/skurekjakub/jira-mcp) server wired into `.mcp.json`; GitHub issue filing with the `gh` CLI |
| `tech-writing` | Release notes, hotfix notes, docs-vs-source validation, draw.io diagrams, a Gemini (agy) style review |

**Requirements:** Node.js (the engine; packs with third-party skills need Node ≥ 22.20 for
`npx skills`). The hooks pack needs `jq`, and Git Bash on Windows. Each pack lists anything
else it needs, and the wizard checks it before installing.

## Companion plugins

Several packs build on these, and the wizard installs them when a chosen pack needs them:
[`superpowers`](https://github.com/obra/superpowers), `frontend-design` and `skill-creator`
from `claude-plugins-official`.

## Renamed plugins

`agentic-work` is now `agent-architecture`, `general` is `research-planning`, `harnesses` is
`copilot-cli`, and `tech-writing` is a `setup-ai` pack. Reinstall under the new names.

## Maintaining this repo

The `maintaining-giga-marketplace` skill (`.claude/skills/`) covers layout, where new things
belong, the pack format and the checks to run before committing. Only Claude Code is
supported out of the box; adapt skills for other harnesses as needed.
