# Source questions: capture, grade, triangulate

For questions about what happened or what sources say: trends, memes, histories,
controversies, the state of a field. This is step 3 of the main order. There is no subject to
probe, so the evidence is the sources themselves.

## 1. Find the anchor, then the originals

Start with the source that documents the timeline in the most detail. For internet culture that
is usually a meme encyclopedia entry; for a field, a survey paper; for an event, the earliest
dated report. Use it as a map, not as the answer. Capture the primary items it points at
wherever they can be fetched: the original posts, the first paper, the company's own
announcement.

## 2. Grade every source

Pass `--tier` to `capture.mjs`:

| Tier | What | Can carry a finding alone? |
|---|---|---|
| `primary` | The original post, paper, filing, dataset or statement | Yes |
| `secondary` | Reputable reporting or reference that cites its sources | Yes, for what it reports |
| `partisan` | Commentary with a stake in the framing | No. Use for "who framed it how" |
| `seo` | Content farms, keyword domains, auto-generated explainers | No. Corroborate or drop |
| `ai-summary` | Platform AI summaries, search-engine answers, fetch-tool digests | No. Leads only |

Agents tend to pick highly ranked SEO pages over authoritative ones that rank lower. Topics
that trend quickly attract keyword domains within days, so grade before you quote.

## 3. Triangulate in one table

A source question's answer to "the comparator table" is a table with claims or numbers as rows
and sources as columns. Each cell holds what that source says, with its observed-at date. Two
patterns matter:

- **Numbers that change** (likes, views, downloads, prices). Each cell records the value and
  the date that source saw it. Values that rise consistently across dates corroborate each
  other. A value that jumps or falls is a conflict.
- **Facts that disagree** (who did what, an etymology, a date). Each version gets its own cell.
  The version the evidence does not settle goes into the README's "Unresolved conflicts"
  section; do not pick one silently.

## 4. Order before cause

Build the timeline from dated captures before you accept any account of why something happened.
Opinion pieces often get the order wrong in a way that supports their framing. The steelman
step for a source question is the strongest competing account, tested against that timeline.

## 5. Platforms that resist capture

Social platforms often serve script-only shells or block scripted requests. In that case,
capture what does render (some platforms serve static trending or summary pages), plus
secondary sources that quote the posts with their dates and counts. Record which of the two
each fact came from.
