# Finding your unknowns — a field guide to working with Claude

Distilled from ["A field guide to Claude Fable 5: Finding your unknowns"](https://www.anthropic.com/news) by Thariq Shihipar (Anthropic, July 2026). Adapted as a working guide for this repo.

## The core idea: map vs. territory

Your prompt, skills, and context are the **map** — a representation of the work to be done. The codebase and its real constraints are the **territory**. The gap between them is your **unknowns**. Whenever Claude hits an unknown, it makes a best-guess decision about what you want; the more work in flight, the more unknowns it will hit.

With current models, the quality of the output is bottlenecked less by the model and more by your ability to clarify unknowns — before, during, and after implementation. Planning ahead alone isn't enough: unknowns surface deep in implementation, and sometimes they reveal that the problem should be solved a different way entirely.

Break a problem down four ways:

| Quadrant | Question to ask yourself |
|---|---|
| **Known knowns** | What do I tell the agent I want? (This is your prompt.) |
| **Known unknowns** | What haven't I figured out yet — and know I haven't? |
| **Unknown knowns** | What's so obvious I'd never write it down, but would recognize on sight? |
| **Unknown unknowns** | What haven't I considered at all? Do I even know how good the result can be? |

The best agentic coders have few unknowns — they know what they want in detail and are in sync with both the codebase and the model's behavior. But they also *assume* unknowns exist and plan for them. Reducing and planning for unknowns is the core skill of agentic coding.

Instruction is a balance: too specific, and Claude follows you off a cliff when a pivot was warranted; too vague, and Claude fills gaps with industry defaults that may not fit. The fix in both directions is the same — account for your unknowns, and give Claude context about your starting point: where you are in your thinking, your experience with the problem and the codebase, and let it work as a thought partner.

## Pattern catalog

### Pre-implementation

#### 1. Blind spot pass

**When:** entering unfamiliar territory — a new part of the codebase, an unfamiliar domain. You don't yet know what questions to ask, what "good" looks like, what historical work exists, or which potholes to avoid.

**How:** ask Claude explicitly for a "blind spot pass" on your "unknown unknowns" (use those literal words), and give it context on who you are and what you already know.

> "I'm working on adding a new auth provider but I know nothing about the auth modules in this codebase. Can you do a blind spot pass to help me figure out my relevant unknown unknowns and help me prompt you better."

> "I don't know what color grading is but I need to grade this video. Can you teach me to understand my unknown unknowns about color grading, so that I can prompt better?"

#### 2. Brainstorms and prototypes

**When:** the area is full of *unknown knowns* — criteria you can only articulate once you see them (visual design is the classic case). Finding these during implementation is expensive: small spec changes can mean drastically different code, and reverting is harder than not building.

**How:** ask for cheap, throwaway prototypes before any real wiring — multiple divergent options you can react to. Start almost every session with an exploration or brainstorming phase; it sets intent and scope, surfaces high-value approaches you'd have missed, and keeps scope from being too narrow or too wide.

> "I want a dashboard for this data but I have no visual taste and don't know what's possible. Make me an HTML page with 4 wildly different design directions so I can react to them."

> "Before wiring anything up, make a single HTML file mocking the new editor toolbar with fake data. I want to react to the layout before you touch the real app."

> "Here's my rough problem: users churn after onboarding. Search the codebase and brainstorm 10 places we could intervene, from cheapest to most ambitious. I'll tell you which ones resonate."

#### 3. Interviews

**When:** after brainstorming, when known unknowns and ambiguities remain.

**How:** have Claude interview *you*, with enough problem context to guide its questions.

> "Interview me one question at a time about anything ambiguous, prioritize questions where my answer would change the architecture."

#### 4. References

**When:** you can't describe what you want in words — you lack the vocabulary, or the description would take too long.

**How:** point Claude at a reference. Diagrams, docs, and screenshots work, but **source code is the best reference** — even in a different language. It carries far richer detail about structure and semantics than any screenshot.

> "This Rust crate in vendor/rate-limiter implements the exact backoff behavior I want. Read it and reimplement the same semantics in our TypeScript API client."

#### 5. Implementation plans

**When:** you think you're ready to implement.

**How:** ask for a plan that *leads with the decisions most likely to change* — data models, type interfaces, UX flows — so review effort lands where alterations are likely. Mechanical refactoring goes at the bottom.

> "Write an implementation plan in HTML, but lead with the decisions I'm most likely to tweak: data model changes, new type interfaces, and anything user-facing. Bury the mechanical refactoring at the bottom, I trust you on that part."

Once satisfied with the plan, start a **fresh session** and pass the planning artifacts (spec, prototype) into the prompt — a clean context window with all the compiled information.

### During implementation

#### 6. Implementation notes

No amount of planning eliminates unknown unknowns — the agent may hit an edge case mid-work that forces a different tack. Have it keep a running log so deviations are visible and feed the next attempt.

> "Keep an implementation-notes.md file. If you hit an edge case that forces you to deviate from the plan, pick the conservative option, log it under 'Deviations', and keep going."

(In this repo, the `.ai/feature-constitution/<slug>/` journal serves this role for feature work.)

### Post-implementation

#### 7. Pitches and explainers

Shipping means buy-in. Package the work into a document that walks reviewers through the unknowns you started with — it accelerates understanding for reviewers who share those unknowns, and accelerates approval from experts checking that you accounted for the failure points they'd anticipate.

> "Package the prototype, the spec, and the implementation notes into a single doc I can drop in Slack to get buy-in. Lead with the demo GIF."

#### 8. Quizzes

After a long session, Claude may have accomplished more than you realize, and diffs alone give only shallow understanding — much of the behavior depends on existing code paths. Ask for a context-rich report with a quiz at the end. **Only merge after passing the quiz perfectly.**

> "I want to make sure I understand everything that's happened in this change. Give me an HTML report on the changes for me to read and understand with context, intuition, what was done, etc. and a quiz at the bottom on the changes that I must pass."

## Worked example: editing a launch video

The author edited a launch video end-to-end with Claude Code, in a domain new to him:

1. **Start from known knowns:** Claude can edit and transcribe video via code — but was accuracy sufficient? He asked Claude to *explain* how Whisper-style transcription works and whether ffmpeg could reliably cut "ums" and long pauses (blind spot pass).
2. **Prototype the risky bet:** unsure whether a word-timed UI was even possible, he asked for a prototype video using Remotion plus a transcript before committing (brainstorm/prototype).
3. **Recognize the wrong pattern and switch:** the footage looked muted — a color-grading problem, but he didn't know what color grading *was*. A first attempt at "generate variations to pick from" failed because he didn't know what *good* looked like. So he switched patterns: asked Claude to teach him color grading first, converting unknown unknowns into known unknowns before iterating.

## Takeaway

The better the model, the more the ceiling is set by your approach. When a long-horizon task comes back wrong, the likely cause isn't the model — it's unclarified unknowns, or a plan that couldn't adapt through them. Every explainer, brainstorm, interview, prototype, and reference is a cheap way to find out what you didn't know **before** it gets expensive to fix.

Start the next project by asking Claude to help you find your unknowns.
