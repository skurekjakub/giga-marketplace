# README contract

Use the sections in this order. Scale each one to the question: a small question gets a short
section, not a missing one. A section marked *(Standard+)* may be dropped for a Small run.

```markdown
# NNN: <title>

**Measured:** <date>, from <branch / environment>, against <targets or "web sources">.
Changed: nothing. The change, once it lands, lives in <where>.

## Question

As asked: "<the user's words>"

Falsifiable: <a statement the evidence can prove or break>

## Verdict

<One paragraph: the answer and the single strongest reason.>

## Reasoning

1. <Finding.> [NN: "verbatim snippet from evidence/NN-*.txt"]
2. <Finding.> [NN: "…"] [MM: "…"]

<The comparator or triangulation table. Every changing number carries its observed-at date.>

## Unresolved conflicts

- <What sources disagree on>: <source A says …> [NN: "…"]; <source B says …> [MM: "…"].
  <What would settle it.>
  Or: "None found."

## The steelman            (Standard+)

<Behaviour question: the strongest case for the current behaviour. Source question: the
strongest competing account. Then the answer to it, point by point.>

## Recommendation          (Standard+)

<The rule, plus each open sub-choice with a recommendation.>

## What would change       (Standard+)

<Files, tests and documents with file:line, marked as a map. Or "Nothing.">

## Side findings           (Standard+)

<Out of scope, surfaced for a decision. Each gets a follow-up in the project's usual place, or a
line saying it was consciously dropped.>

## Sources

- <URL>: <tier>. <What it settled.>
- <URL>: not used. <Why: blocked after all fallbacks, or tier too low to rely on.>

## Files

`evidence/MANIFEST.tsv` lists every capture with its URL, fetch route, status, fetch time,
publish date, hash and tier. Add one line here for each file the manifest does not describe:
scripts, subagent reports, raw probe output.
```

## Citation syntax

`[NN: "snippet"]` with the snippet copied from `evidence/NN-*.txt` (or `.md`). Keep snippets
short and distinctive, 5–20 words. `check-claims.mjs` matches them regardless of whitespace,
case and quote style, and fails on:

- a snippet that is not in its file;
- an `NN` with no file;
- a numbered Reasoning item with no quoted citation.

A pointer without a quote, such as `(evidence/05)`, is allowed in other sections but does not
count for Reasoning.

## Verifier brief (Large runs)

Dispatch a fresh subagent on a strong model. It must not have seen the research.

> Read `<record>/README.md` and the files in `<record>/evidence/`. For each numbered Reasoning
> item and each Verdict sentence, open the cited evidence and decide one of: SUPPORTED (the
> quote says it), OVERREACH (the quote is real but the claim goes further), UNSUPPORTED (no
> cited text says it), or CONFLICTED (another evidence file says otherwise; name it). Also flag
> any finding resting only on `seo` or `ai-summary` tier sources, using `evidence/MANIFEST.tsv`.
> Write the table to `<record>/evidence/NN-verifier-report.md`. Do not edit the README. Do not
> recommend.

Fix every row that isn't SUPPORTED, then re-run `check-claims.mjs`.

## Record hygiene

- Number `evidence/` files in capture order and name them for what they hold.
- Never edit a capture once it is saved. A later measurement is a new file.
- Exclude the evidence folders from formatters so captures stay byte-exact.
- `research-trail.md` follows the `iterative-research` output format, with a `Fetched:` line
  per round.
