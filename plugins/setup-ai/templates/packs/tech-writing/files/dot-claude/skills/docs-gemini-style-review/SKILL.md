---
name: docs-gemini-style-review
description: >-
  Use when {{PRODUCT_NAME}} docs prose was just written or edited and its wording should get a second opinion from another model before commit — "style check this", "review this copy", "run the gemini review", "does this match the style guide", "second opinion on this wording", "check this against the word list" — or proactively after drafting new user-facing docs; also at the end of a branch to audit the doc and inline comments it added ("gemini review the comments"). Not for factual accuracy against product source (docs-source-validation) or for reviewing code logic.
---

# Gemini style review

## Why hand this to another model

The value here is not that Gemini writes better English than you do. It is that it arrives at the paragraph with no memory of writing it, no attachment to the phrasing, and the style guide in front of it. Self-review of prose you produced minutes ago reliably misses terminology drift and voice slips, because you re-read your intent instead of the words. A cold reader with the rules to hand catches those.

It is also cheap and runs out-of-process, so it costs this session almost nothing but the prompt.

Treat the result as advisory. The reviewer has not read the rest of the page, does not know the corpus conventions unless you tell it, and will confidently invent rules if the style guide it was given does not cover something. Every finding gets checked against the actual guide before you act on it.

## Before running: scope the review to a named block

The single biggest quality lever is telling the reviewer exactly what to judge. Point it at a page and it will critique paragraphs written years ago by other people, and the real findings drown.

Name the file and the line range, and say plainly that the rest of the page is not under review. If the block is short, paste it verbatim rather than making the reviewer find it.

## Two shapes of prompt: paste the block, or hand over an inventory

A single paragraph or admonition gets pasted into the prompt with the guide it is judged by; that is the self-contained form below, and it is the reliable one for a short block.

A branch-wide pass — every comment a refactor reworded, every JSDoc a feature added — does not. Pasting a diff and a guide into one prompt produces a prompt the reviewer skims, and the assembly is where the errors creep in. For that shape the reviewer reads the repo itself, and the prompt carries what it cannot infer:

- **the rulebook by path**, told to read it first (`docs/conventions/comment-policy.md` for code comments; the style guide from the table below for docs prose);
- **what the branch did**, in a few sentences: the shape before, the shape after, the names involved;
- **an inventory of files, one line each, with what changed in that file** — "the JSDoc on `fakeProvider`'s `def` parameter" beats "the file"; a file where nothing under review changed is listed too, with "confirm and move on", so the reviewer does not go looking;
- **how to find the changed lines** — `git diff <base> HEAD -- <file>` — and that unchanged lines in a changed file are out of scope;
- **what moved verbatim and is therefore not under review**, or every relocated block comes back as a finding.

The reviewer is capable of opening the files and the diff itself; what it lacks is the judgement of which lines are the branch's and which are inherited. The inventory supplies exactly that and nothing more.

## Pick the right style guide

Style guides can disagree on purpose — a reference page and a tutorial are not held to the same standard. Feed the whole file for the audience; it is the yardstick for a single callout and for a whole new page alike.

> **Template note:** map your content areas to the guides in `{{STYLE_GUIDE_DIR}}`.

| What you edited | Feed it |
|---|---|
| {{ContentArea}} | {{StyleGuideFile}} |
| Anything with product nouns, feature names, UI labels | the word list / terminology guide — always, alongside the above |

## Preflight

Run this first. Every environment failure here surfaces at the call site as the same symptom — the review command exits successfully having printed nothing — so without a preflight you will spend the next several minutes rewriting a prompt that was never the problem.

```bash
bash ${CLAUDE_SKILL_DIR}/scripts/preflight.sh
```

It checks the CLI is on PATH, that the model is offered (which round-trips to the service, so it also catches an expired login), that the style guides are present and readable, that print mode answers at all, and that a file read survives the permission layer. Each failure prints its own remedy. `--model <id>` checks a different tier; `--skip-smoke` skips the two live calls when you only want the local checks.

## Running it

`agy models` lists what is available. Models newer than your training data exist — don't claim a listed model is made up. Reasoning tiers of one model are offered as separate ids; a style review wants the highest tier (`{{AGY_MODEL}}` by default).

### The normal case — let it read the files

```bash
agy -p "$(cat prompt.txt)" --model {{AGY_MODEL}} --mode plan --dangerously-skip-permissions --print-timeout 30m
```

Write the prompt to a file in the scratchpad first; a heredoc into `prompt.txt` keeps backticks and `$` intact and keeps the shell argument readable. This is the form for the inventory-shaped prompt above. Redirect the output to a second scratchpad file and run it in the background — a branch-wide pass reads a dozen files and the diff and takes several minutes.

Two flags carry weight here:

- `--dangerously-skip-permissions` is not optional in headless mode. Print mode cannot show a permission prompt, so every tool call is auto-denied instead and the command exits with `no output produced — a tool required the "command" permission that headless mode cannot prompt for`. Without the flag the reviewer cannot open a single file.
- `--mode plan` is what makes that safe: the reviewer can read anything but cannot write, so it can never touch the branch it is reviewing.

Both flags go on **every review run**, the self-contained form below included; the preflight's smoke probe is the one deliberate exception, a two-character answer that needs no tool. There is no "no-tools" mode: the reviewer always has its tools, and it reaches for one even when every file it needs is pasted into the prompt. Without the flag that call is auto-denied and the whole run ends with this single line and nothing else:

```
no output produced — a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied.
```

The one form that is refused outright is an editing mode (`--mode accept-edits` and up) combined with `--dangerously-skip-permissions`; the Claude Code classifier blocks it. Never drop `--mode plan` to get around anything.

### The self-contained prompt — paste the material in

For one short block, pasting the guide and the block into the prompt is the reliable shape: the reviewer has no reason to go looking, and it cannot wander into unrelated files even if it tries. Keep the two flags anyway, and tell the reviewer in the prompt's first lines that everything it needs is pasted below and that it must not call a tool, run a command, or open a file. Do not use this form for a branch-wide pass; that is the inventory shape.

```bash
{ cat prompt-head.txt
  cat {{STYLE_GUIDE_DIR}}/<style-guide>.md
  printf '\n\n===== WORD LIST =====\n'
  cat {{STYLE_GUIDE_DIR}}/<word-list>.md
  printf '\n\n===== BLOCK UNDER REVIEW =====\n'
  sed -n '61,71p' <file under review>
} > prompt.txt

agy -p "$(cat prompt.txt)" --model {{AGY_MODEL}} \
  --mode plan --dangerously-skip-permissions --print-timeout 30m
```

`"$(cat prompt.txt)"` inserts the file contents literally — command substitution output is not re-expanded, so backticks, `$`, and quotes inside the style guide stay intact. Building the prompt string inline with the guide text pasted into a shell argument does not survive that.

Write "go through the pasted text" rather than "read the file" in the prompt: the verb "read" is what sends the reviewer to its file tool.

### Timeouts

The `--print-timeout` default is 5 minutes and a thorough pass on a 75 KB prompt takes longer than that. Set `30m` — an inventory-shaped comment pass over a dozen files came back as only the timeout line at `15m` — run the command in the background (the Bash tool's own ceiling is 10 minutes), and pick the output up from the task file. The preflight's file-read probe timing out at its own 2-minute budget is the same slowness, not a permissions failure — it reports as a warning, not a failure, and the round-trip check above it passing is what matters. A timed-out run prints this before whatever partial output it has:

```
[agy] print timeout after 2m0s with turn in progress; returning partial output
```

A run whose output is empty or a single line means the reviewer was denied a tool or timed out mid-turn, never that it had nothing to say. Fix the flags or the timeout and rerun before touching the prompt.

## What every prompt must carry

These points are what separate a useful review from a page of false positives. They are corpus facts the reviewer has no way to know:

- **Markup is not prose.** Components, shortcodes or directives (for example `<Callout>` in MDX, `{% include %}` in Liquid) are how the corpus links and calls out; the reviewer judges the words, not the markup.
- **Corpus quirks.** {{CorpusQuirksTheReviewerMustBeTold}} — escapes, generated markup or conventions that look like mistakes and aren't. Say each one explicitly or the reviewer reports every instance and buries the real findings.
- **Only the named block is under review.** State it twice if the block sits inside a long page.
- **Do not edit any files.** Plan mode already enforces this, but saying it stops the reviewer wasting its turn planning an edit.

Give it the surrounding context in a sentence — what the page is, who reads it, what changed and why. A reviewer that knows the paragraph announces newly archived repositories judges the wording very differently from one that thinks it is generic boilerplate.

Ask for findings in a fixed shape: the offending phrase quoted, the rule it breaks named, and a corrected rewrite. A rewrite is what makes a finding actionable, and demanding one exposes the findings that were only vibes — a reviewer that cannot produce a better sentence usually did not have a real objection.

For a comment pass, also ask it to verify every factual claim a comment makes against the code the comment sits on, and to say what it checked. A comment reviewer that only judges tone will wave through a sentence that is well formed and false.

## Reading the verdict

Sort what comes back into three piles:

- **Rule violations with a citation you can find in the guide** — apply them.
- **Improvements the guide does not actually mandate** — your call, and often worth taking anyway.
- **Findings that contradict the corpus** — discard, and add the missing caveat to the prompt for next time.

If more than a couple of findings land in the third pile, the prompt was underspecified rather than the reviewer being wrong. Fix the prompt and re-run; it costs almost nothing.

## Applying a rewrite

When the reviewer hands back a rewrite you are going to take, take its wording verbatim. Correct factual inaccuracies — a wrong count, a claim the code or the page does not bear out, a rule it invented — and change nothing else. Do not re-phrase it into your own voice, tighten it, or "improve" it on the way in: the rewrite was asked for precisely because the reviewer's prose reads better than the author's, and every edit you make on the way in trades that away for nothing. A rewrite that needs more than a factual fix goes back to the reviewer with the correction in the prompt.

The same rule holds when the pass is over docblocks and inline comments in code rather than docs prose. Verify each claim against the code it sits on, fix the ones that are wrong, and keep the sentences as written.

Never paste the review into a commit message or a PR body as though it were a verdict. It is one model's opinion on prose, and it carries exactly as much weight as you can defend.
