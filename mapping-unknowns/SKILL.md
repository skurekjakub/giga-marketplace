---
name: mapping-unknowns
description: Use before superpowers:brainstorming, a plan, or any long-horizon task whenever the person's own knowledge of the territory is the bottleneck rather than the design — they say they are new to this part of the codebase or to the domain, "I know nothing about X", "I don't know what good looks like here", "what am I not considering", "help me prompt you better", "teach me X so I can brief you", or literally ask for a "blind spot pass" or their "unknown unknowns"; also at the pre-brainstorm step of `feature-development` (after research) and `codebase-refactoring` (after inventory), and whenever a request is long on what to build and silent on what the person already knows. Standalone it is offered, never forced: one sentence from the person skips it. Not for a bounded bugfix, and not a substitute for brainstorming, which starts where this ends.
---

# Mapping unknowns

The prompt is a map. The codebase and its constraints are the territory. The
gap is the person's unknowns, and every unknown the agent meets later becomes a
guess about what they wanted. Brainstorming and the repo's flows assume the
person can answer design questions. This pass runs first and maps what the
person knows, knows they lack, would recognise on sight, and has never
considered, so the questions that follow are ones they can answer.

**The deliverable is a map of the person's knowledge, not a briefing on the
code.** A list of codebase facts under the heading "unknown unknowns" is the
failure this skill exists to prevent.

## The gate is soft

- At a trigger, load this skill and run the pass. Inside `feature-development`
  and `codebase-refactoring` it is the step before brainstorming or the spec.
- One sentence from the person ends it: "skip it", "go", "I know this area".
  Inside a flow, record `Unknowns pass: skipped by the person` as one line in
  the journal and continue. Never argue for the pass and never re-offer it
  within the same task.

## The pass

The output is these parts, in this order.

### 1. Light territory read

Read only enough to know what the person could be missing: the area's index
(the feature-constitution roster, the `docs/conventions/` listing, the area's
own README), the entry-point files the request names, and the area's recent
`git log`. Stop as soon as you can name four things:

- the nearest precedent, the thing already built that has this shape
- the nearest wrong-fit precedent, the thing that looks right and is not
- the house rule that constrains the request
- the other surfaces the change reaches beyond the one the person named

That is the whole budget. The pass maps; it does not research to completion.
Research is its own later phase.

### 2. Draft the map

A four-row table written from the person's perspective. Every entry names
where it came from: their words, a file, a doc.

| Quadrant | Fill with |
|---|---|
| **Known knowns** | What they told you they want and already know. |
| **Known unknowns** | What they said they lack, plus the decisions the territory forces that their prompt never mentioned. This row becomes brainstorming's input. |
| **Unknown knowns** | Criteria they would recognise on sight but cannot state: look, wording, behaviour. Candidates for a prototype or a reference. |
| **Unknown unknowns** | What the territory holds that their prompt never touches: precedents, name collisions, house rules, other emission surfaces, prior work. |

The first message is the draft map and the first question. Nothing else.

### 3. Interview, one question per message

- Order by how much the answer would change the architecture. Hardest to
  reverse goes first.
- Multiple choice when the territory gives the options; open otherwise.
- A question asks one thing about the person: what they know, have seen,
  would recognise, can point at. Its options are answers about them ("knew
  it", "didn't", "knew part"), never the design choices the fact forces.
  Those stay in known unknowns for brainstorming.
- For each unknown unknown, ask whether they know it. If not, teach it in two
  or three sentences and move it to known unknowns.
- Standing question, asked once: "Is there code, in any language, that already
  does what you want?" A yes turns into a reference.
- Each answer moves an entry across the map. Stop when the unknown-unknowns
  row is empty and every unknown known has a pattern assigned.

### 4. Close with the brief and the next pattern

The final message has two parts.

**How to brief me.** The decisions the person now owns, numbered, phrased so
they can paste them into their next prompt or into the spec.

**Next pattern.** Exactly one, with the reason the map gives for it.

| The map says | Pattern |
|---|---|
| The person lacks the vocabulary for the area | **Teach**: explain the concept before any design question. |
| Unknown knowns dominate | **Prototype**: two to four throwaway options to react to, no real wiring. |
| The person can point at code that does it | **Reference**: read it and match its semantics. |
| Only design decisions remain | **Brainstorm**: hand the known-unknowns row to `superpowers:brainstorming` as its first questions. |

### 5. Where it lands

- Inside a flow: `unknowns.md` in the work's journal folder, the constitution
  folder for a feature or `.ai/refactoring/NNN-<slug>/` for a refactor, holding
  the final map and the brief. The spec's open-questions section starts from
  it.
- Standalone: chat only, unless the person asks for a file.

## Example

Request: "Add a `deprecated` frontmatter field that renders a warning banner
on docs pages. I know nothing about frontmatter validation or the MDX
rendering pipeline here."

Draft map, one entry per row for brevity:

| Quadrant | Entry |
|---|---|
| Known knowns | Field named `deprecated`; a banner on docs pages (their words). |
| Known unknowns | How validation works (their words). Which eras carry the field, and bare boolean or message plus replacement link (`lib/corpus/frontmatter/schema/frontmatter.ts` is a strict object per era). |
| Unknown knowns | What the banner should look like: an in-body warning admonition or top-of-page chrome (`components/mdx/Admonition.tsx`, `components/layout/page/VersionBanner.tsx`). |
| Unknown unknowns | Page content ships to four surfaces, not one (the `mdx-emission-targets` constitution). "Deprecated" already names the collection version banner. House rule bans version notes on pages. |

First question: "Did you know a page's content is emitted to four surfaces,
the website, the `.md` projection, the AIRA corpus and the Algolia index?
(a) yes (b) no (c) I knew about `.md` only."

The map took five files to draft. Without this skill, four baseline runs on
the same request each read the subsystem to completion, answered with a long
briefing of codebase facts and design questions, and asked the person nothing.

## Common mistakes

| Mistake | Fix |
|---|---|
| A codebase briefing under the heading "unknown unknowns" | Territory facts fill the map's rows and then become questions. |
| Treating "I'm new to this part" as decoration and asking six architecture questions | Ask what they know first. Design questions wait for brainstorming. |
| All questions in one message | One per message, hardest to reverse first. |
| Reading the subsystem to completion before the first message | Stop at precedent, wrong-fit precedent, house rule, surfaces. |
| Ending without the brief | The numbered "hand me these" list is what the person keeps. |
| Re-offering after a skip | Record the skip in one line and continue. |

## Reference

`references/finding-your-unknowns.md` holds the source article's full pattern
catalog, including the post-implementation patterns this repo already
institutionalised: the explainer with its Q&A section is the pitch plus the
quiz, and the journal folder is the implementation notes.
