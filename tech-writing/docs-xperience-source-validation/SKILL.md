---
name: docs-xperience-source-validation
description: >-
  Validate Xperience by Kentico documentation against the actual product source code in resources/repositories/xperience. Use this skill whenever you need to verify that documentation (existing or planned) accurately describes the real product behavior, compare what changed in a commit or branch, or trace source code logic to confirm a documented claim. Trigger on phrases like 'validate against source', 'check the source code', 'is this accurate', 'diff against master', 'what changed in this commit/branch', 'trace this behavior in source', 'verify this API exists', or any request that involves cross-referencing documentation with the Xperience codebase. Also trigger when the user mentions the xperience repo, xperience source, CMS solution, or asks about how a feature actually works under the hood.
---

# Xperience Source Validation

Validate documentation claims against the Xperience by Kentico source code repository.

## Gate — ensure the repo is available before anything else

This is a **hard gate**. The skill cannot run without the Xperience source. Run this check first, every time, before any other step:

```bash
git -C resources/repositories/xperience rev-parse --is-inside-work-tree
```

The repo is expected at `resources/repositories/xperience` relative to the docs repository root.

**If it is missing**, stop and ask — **never clone without the user's explicit consent** (the clone is large). Use AskUserQuestion to offer it:

```bash
git clone https://kenticoxperience@dev.azure.com/kenticoxperience/CMS/_git/xperience resources/repositories/xperience
```

- If the user **consents** — run the clone, confirm it succeeded, then continue.
- If the user **points at a clone elsewhere** — use that path for the rest of the session.
- If the user **declines** (or does not consent) — **stop here. The skill cannot continue.** Do not validate from memory, training data, or guesswork.

Proceed to the workflows below only once the repo is confirmed present.

Once confirmed, pull latest master so you never validate against stale code (cheap, do it even if recent):

```bash
git -C resources/repositories/xperience fetch origin master
git -C resources/repositories/xperience checkout master
git -C resources/repositories/xperience pull origin master
```

Exception: when validating against a specific commit (a feature's merge commit), fetching is enough — check out or `git show` that commit instead of master.

Then pick the matching workflow below. If the user's intent doesn't map to one, ask.

---

## Workflow: Validate documentation against source

The core workflow. The user has a documentation claim (a sentence, a page, a planned change) and wants to know if it's accurate.

1. **Identify the claim.** Extract the specific technical assertions from the documentation. Break compound claims into individual verifiable statements. *"The `MemberInfo` class stores user credentials and supports multi-factor authentication"* is two claims: (a) `MemberInfo` stores credentials, (b) `MemberInfo` supports MFA.

2. **Locate relevant source.** Use the solution map (see below) to find the right project area, then Grep for the specific classes, methods, or configuration, scoping `path` to the relevant project directory rather than the whole repo.

3. **Trace the behavior.** Don't stop at finding the class — read the implementation. Follow the call chain far enough to confirm or deny the documented behavior:
   - Does the class/method/property actually exist?
   - Does it behave as documented (parameters, return values, side effects)?
   - Are there conditions, feature flags, or configuration that change the behavior?
   - Is the documented API current, or renamed/moved/deprecated?
   - UI-facing display names come from resx files, not from constant names — verify the actual string.

4. **Report findings.** For each claim: **Verified** / **Incorrect** / **Partially correct** / **Outdated**, the source file(s) and line(s) that prove it, and — if incorrect — what the source actually says. Never let an unverifiable claim pass silently as verified.

### Tips for deep validation

- Check `[Obsolete]` attributes — the API might exist but be deprecated.
- Look at interfaces, not just implementations — the documented contract might differ from a specific implementation.
- Check the test projects (`CMSSolution/Tests/`) for behavioral examples when a method's purpose is ambiguous.
- For admin UI behavior, check both the C# backend and the `Mvc/Client/` frontend code.
- Jira tickets and PR descriptions state intent; only the code states what shipped. When they disagree, the code wins.

---

## Workflow: Diff a commit or PR against master

The user wants to understand what changed in a specific commit or merged PR.

1. **Get the diff:**

   ```bash
   git -C resources/repositories/xperience show --stat <hash>
   git -C resources/repositories/xperience show <hash>
   ```

   For large diffs, start from `--stat`, then read per-file with `git show <hash> -- <path>`.

2. **Categorize the changes** by product area using the solution map. Group them logically (e.g., "ContentEngine changes", "Admin UI changes", "Test updates").

3. **Summarize the behavioral impact.** Don't just list changed files — read the actual diffs and explain what the changes *do*.

4. **Flag documentation relevance:** new or removed public APIs, changed method signatures or behavior, new configuration options, changed defaults.

---

## Workflow: Diff a branch against master

```bash
git -C resources/repositories/xperience fetch origin <branch-name>
git -C resources/repositories/xperience diff master...origin/<branch-name>
```

For large diffs, scope to the areas the user cares about:

```bash
git -C resources/repositories/xperience diff master...origin/<branch-name> -- CMSSolution/ContentEngine/
```

Then categorize and summarize as in the commit diff workflow.

---

## Workflow: Explore / navigate the solution

The user wants to find where something lives. Use the solution map, then drill down with Grep/Glob scoped to the candidate module directory. Exclude test projects when looking for production code by scoping to the specific module directory rather than the entire solution.

---

## Solution Navigation Reference

The main .NET solution is at `resources/repositories/xperience/CMSSolution/CMSSolution.sln`.

**Read `references/solution-map.md` when you need to locate a specific module or understand the project layout** — it maps every project area, subdirectories, build system, and test structure.
