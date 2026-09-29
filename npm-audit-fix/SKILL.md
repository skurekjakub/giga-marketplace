---
name: npm-audit-fix
description: Use when npm dependencies in this repo need moving — npm audit reports vulnerabilities ("npm audit", "audit fix", "security advisories", "CVE in deps", a pipeline/security-team report), or the user wants a routine refresh ("bump deps", "update dependencies", "dependabot-style", "latest minor versions", "npm update", "what's outdated"). Also use when an install fails because a package version is too new (min-release-age / release-age cooldown error).
---

# npm dependency bumps

## Overview

Two paths, one set of guardrails. **Audit fix** remediates advisories with
plain `npm audit fix`. **Dependency refresh** is what Dependabot's
"bump to latest in-range" does nightly: `npm update` moves every direct
dependency to the newest minor/patch its caret range allows. Both end in a
verified PR. Nothing either path cannot do cleanly is forced — it is
**reported**. Majors are never taken on either path.

## Pick the path

| User wants | Path |
|---|---|
| Advisories gone, scanner report, CVE list | Audit fix |
| Everything current, "like dependabot", routine bump | Dependency refresh (then run audit fix on top — same branch) |

## Shared steps

1. **Branch** — `git fetch origin membership-next && git checkout -b chore/<path-name> origin/membership-next` (or from the current HEAD when asked).
2. **Clean install** — `npm ci`, then `npm audit` and `npm outdated` to capture the baseline.
3. **Move** — the path-specific command below.
4. **Sync package.json** — `node .claude/skills/npm-audit-fix/sync-package-json.mjs`
   rewrites every direct range to `^<installed>` (repo policy: the two stay
   in sync). Then `npm install --package-lock-only` to refresh lock metadata.
5. **Verify** — `npm run verify`. If a renderer/content dep moved (shiki,
   @mdx-js/*, remark-*, micromark-*, tailwind), also `npm run content:validate`.
   Minor bumps can break typecheck (a dep starts shipping a global type the
   repo also declares locally); fix that fallout on this branch — the bump
   caused it.
6. **Ship** — commit (lock + package.json + fallout fixes), push, PR targeting
   `membership-next`. PR bullets name the bumped versions, list what was
   left behind and why, and end with a `## Verification` bullet.

## Path: audit fix

`npm audit fix`. Plain. No flags. Advisories with "No fix available" or a
fix inside the cooldown go in the PR's "remaining" list.

## Path: dependency refresh

`npm update`. Plain. It respects the caret ranges in `package.json` and the
`.npmrc` cooldown, so it cannot cross a major and cannot pick a version
younger than 3 days. After it, run `npm audit fix` too — transitive
advisories are cheap to clear on the same branch.

Majors that `npm outdated` lists under **Latest** but not **Wanted** stay
where they are. Name them in the commit message and PR body as a finding;
each is its own reviewed task (changelog read, typecheck, e2e), never a
line in a bulk bump.

## Hard rules

**`npm audit fix --force` is never run.** Not with `--dry-run` "just to look",
not for one package, not to hit a deadline. `--force` takes semver-major /
downgrade decisions nobody reviewed. "No fix available" is a *finding for the
PR body*, not a problem this workflow solves — manual major bumps, `overrides`
blocks, and swapping dependencies are separate, human-decided tasks.

**No major bumps on a refresh.** No `npm install pkg@latest`, no
`npx npm-check-updates -u` without `--target minor`, no hand-editing a range
past its major. Dependabot's major PRs are separate PRs for a reason.

**`@types/node` tracks the runtime, not `latest`.** Its major is the Node
major it describes; the runtime major is the `Dockerfile` base image
(`node:24-…`) and `engines.node`. Types newer than the runtime make `tsc`
accept APIs that throw in the container. On a refresh, leave it alone; if
`npm outdated` shows it above the runtime major, the fix is
`npm install @types/node@<runtime major>` — a downgrade — in its own PR.
Same rule for any `@types/*` that shadows a runtime version.

**The `.npmrc` `min-release-age=3` cooldown is never bypassed.** No
`npm config set`, no `--min-release-age 0`, no `min-release-age-exclude`,
no `.npmrc` edit, no env override. The cooldown is the supply-chain defence
exactly when a "fresh patch" exists — a just-published version is the attack
window. If the version is younger than 3 days, it stays in the PR's
"remaining" list with a note that it self-resolves once the window passes.

## Rationalizations

| Excuse | Reality |
|---|---|
| "Security wants zero highs by EOD" | A forced major bump or cooldown bypass trades a scanner number for unreviewed risk. Ship the clean fixes; the remainder is the report. |
| "Scoped, one-time, logged bypass" | A logged bypass is still a bypass. The cooldown has no exception path. |
| "It's build-time only, blast radius is small" | Compromised build-time deps exfiltrate from CI. Blast-radius guesses don't override policy. |
| "`--force --dry-run` just to inspect" | Inspection is `npm audit` output and the advisory pages. `--force` output is a plan you must not execute. |
| "I'll add an `overrides` entry, it's not --force" | Same unreviewed-major-bump risk with different syntax. Separate task, human decision. |
| "Dependabot would take the major too" | Dependabot opens one PR per major with its own CI run. A bulk refresh is the in-range PR only. |
| "It's only a types package / dev dep, the major is safe" | `@types/node`, `typescript`, `eslint` majors change what typechecks and lints. Separate PR. |
| "`@types/node` 26 typechecks green, ship it" | Green means the types are a superset, not that Node 24 runs the code. Match the Dockerfile. |

## Red flags — stop

- Typing `--force`, `overrides`, `@latest`, or any `min-release-age` / `min-release-age-exclude` mutation.
- Editing `.npmrc`.
- Installing a specific `pkg@version` to "finish off" an advisory or an outdated row.
- A range in `package.json` whose major differs from the one on `origin/membership-next`.
- `@types/node` above the `Dockerfile` Node major.
- A PR claiming zero advisories when `npm audit` still lists some.
