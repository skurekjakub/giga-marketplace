---
name: autoloop
description: Bootstrap and run autonomous optimization loops — the "autoresearch" pattern generalized to any domain. Use this skill whenever a user wants to set up an autonomous experiment loop where an AI agent iteratively modifies code, runs it, measures a score, keeps improvements and discards failures. Applies to trading strategy optimization, game AI, hyperparameter search, compiler tuning, simulation calibration, portfolio optimization, prompt engineering, or any problem with a measurable fitness metric. Also use when the user mentions "autoresearch", "overnight experiments", "autonomous optimization", "experiment loop", or wants to "let the agent run while I sleep."
---

# Autoloop: Autonomous Optimization Loop Pattern

A skill for bootstrapping autonomous, self-improving experiment loops in any domain. The AI agent iteratively modifies a strategy file, runs it against a fixed evaluation harness, measures a score, keeps improvements, discards failures, and repeats indefinitely — no human in the loop until they choose to stop it.

This skill captures the core pattern from Karpathy's autoresearch (autonomous LLM training optimization) and generalizes it to any domain with a measurable optimization target.

---

## The Pattern in One Paragraph

You have three components: a **fixed evaluation harness** (the ground truth — agent cannot touch it), a **strategy file** (the single file the agent modifies), and an **experiment protocol** (instructions that tell the agent how to form hypotheses, test them, and decide what to keep). The agent runs in a loop: edit strategy → run → measure score → keep or discard → log → repeat. The human writes the protocol and the harness. The agent does the research.

---

## Core Architecture

Every autoloop project has exactly this structure:

```
project/
├── evaluate.py          # FIXED. The evaluation harness. Agent CANNOT modify.
│                        # Contains: data loading, scoring function, time budget.
│                        # Outputs a single numeric score to stdout.
│
├── strategy.py          # MUTABLE. The single file the agent edits.
│                        # Contains: the strategy/model/algorithm being optimized.
│                        # Must be runnable: `python strategy.py` → prints score.
│
├── protocol.md          # The agent's operating manual (human writes this).
│                        # Contains: setup steps, experiment loop, scoring rules,
│                        # what to try, what constraints to respect.
│
├── results.tsv          # Experiment log (untracked by git).
│                        # Tab-separated: commit, score, status, description.
│
└── data/                # Input data (historical prices, training corpus, etc.)
    └── ...              # Agent cannot modify. Part of the fixed harness.
```

### The Three Roles

| Component | Who writes it | Who modifies it | Purpose |
|-----------|--------------|-----------------|---------|
| `evaluate.py` | Human | Nobody (read-only) | The controlled variable. Defines what "better" means. |
| `strategy.py` | Human (initial version) | Agent (iteratively) | The experimental variable. The thing being optimized. |
| `protocol.md` | Human | Human (between runs) | The meta-program. Instructions for how to do science. |

### Why This Separation Matters

The agent cannot modify the evaluation harness. This is the single most important design constraint. Without it, the agent can "improve" its score by weakening the evaluation — the optimization equivalent of grading your own homework. The harness is the controlled experiment. The strategy is the independent variable. The score is the dependent variable.

---

## The Experiment Loop (Detailed)

This is the core loop the agent runs. Every domain uses this exact sequence:

```
SETUP (once):
  1. Create a fresh git branch: autoloop/<tag>
  2. Read all in-scope files for full context
  3. Verify data/dependencies exist
  4. Create results.tsv with header row
  5. Run the unmodified strategy.py to establish BASELINE score
  6. Log baseline to results.tsv

LOOP (forever, until human interrupts):
  1. HYPOTHESIZE
     - Look at the current strategy code
     - Look at the experiment history (results.tsv)
     - Come up with a specific, testable idea
     - The idea should be one conceptual change (not five things at once)

  2. IMPLEMENT
     - Edit strategy.py to implement the idea
     - Keep changes minimal and focused
     - git commit with a descriptive message

  3. RUN
     - Execute: python strategy.py > run.log 2>&1
     - NEVER let output flood the agent's context (always redirect)
     - Respect the time budget — kill runs that exceed 2x the budget

  4. MEASURE
     - Extract the score: grep "^score:" run.log
     - If grep is empty → the run crashed
     - If crashed: read the last 50 lines of run.log for the error
       - If it's a trivial fix (typo, import): fix and re-run
       - If the idea is fundamentally broken: log as crash, move on
       - Max 3 fix attempts per idea, then abandon

  5. DECIDE
     - If score IMPROVED (better than current best):
       → KEEP the commit. This is the new baseline.
       → Log: commit, score, "keep", description
     - If score is EQUAL or WORSE:
       → DISCARD. git reset --hard to the previous best commit.
       → Log: commit, score, "discard", description
     - If CRASHED:
       → git reset --hard to the previous best commit.
       → Log: commit, 0.0, "crash", description

  6. REFLECT (every ~10 experiments)
     - Review results.tsv for patterns
     - What kinds of changes tend to work?
     - What has been tried and failed?
     - Are there untested directions?
     - Adjust strategy accordingly

  7. NEVER STOP
     - Do NOT pause to ask the human
     - Do NOT ask "should I continue?"
     - The human may be asleep
     - If you run out of ideas, think harder:
       * Re-read the strategy file for new angles
       * Try combining two previous near-misses
       * Try the opposite of what's been working
       * Try radical structural changes
       * Try simplification (removing things)
     - The loop runs until the human manually stops you
```

---

## Setting Up a New Autoloop Project

### Step 1: Understand the domain

Before writing any code, clarify these with the user:

1. **What is being optimized?** (a trading strategy, a game AI, a model, a config...)
2. **What is the score?** (Sharpe ratio, win rate, val_loss, throughput, accuracy...)
3. **Is higher or lower better?** (critical — gets baked into the keep/discard logic)
4. **What data does it run on?** (historical prices, a test set, a simulation, a benchmark...)
5. **What is the time budget per experiment?** (1 min, 5 min, 30 min — depends on domain)
6. **What language?** (Python is default; could be anything with stdout)
7. **What constraints?** (no external APIs, no new dependencies, memory limits, etc.)
8. **What's the overfitting risk?** (especially for backtest-based domains — see below)

### Step 2: Write the evaluation harness (`evaluate.py`)

The harness must:

- Load the input data (training set, historical prices, test cases, etc.)
- Import/call the strategy
- Run the strategy against the data
- Compute and print a single numeric score to stdout
- Enforce the time budget (wall-clock, not steps — so experiments are comparable regardless of what the agent changes)
- Be DETERMINISTIC given the same strategy (set random seeds, fix data splits)

**Output format** (printed to stdout, agent extracts via grep):
```
---
score:            0.847200
time_seconds:     300.1
memory_mb:        2048.3
extra_metric_1:   value
extra_metric_2:   value
```

The `score:` line is the only required field. Everything else is informational.

**Critical design rule**: The harness must include a HELD-OUT evaluation set that the agent never sees during strategy execution. This is the defense against overfitting:

- For trading: train on 2010-2022, evaluate on 2023-2024 (agent never sees 2023+ data during strategy execution)
- For ML: standard train/val split where val data is only used by the harness
- For games: evaluate against a fixed set of opponents/scenarios, not the ones the strategy practices on
- For simulation: calibrate on one dataset, evaluate on another

### Step 3: Write the initial strategy (`strategy.py`)

This is the starting point — the baseline the agent will improve from. It should:

- Be a single file (keeps scope manageable, diffs reviewable)
- Be runnable: `python strategy.py` works end-to-end
- Import from `evaluate.py` only what it needs (data loaders, constants, the scoring call)
- Contain clearly labeled sections the agent can modify (hyperparameters, logic, structure)
- Start simple — give the agent room to improve

**Structure it with clear modification points:**
```python
# ============================================================
# HYPERPARAMETERS (tune these)
# ============================================================
LOOKBACK_WINDOW = 20
THRESHOLD = 0.02
POSITION_SIZE = 0.1

# ============================================================
# STRATEGY LOGIC (modify this)
# ============================================================
def generate_signals(data):
    ...

# ============================================================
# EXECUTION (calls evaluate harness — do not modify structure)
# ============================================================
if __name__ == "__main__":
    from evaluate import run_evaluation
    run_evaluation(generate_signals)
```

### Step 4: Write the protocol (`protocol.md`)

This is the meta-program — the "brain" of the loop. See `references/protocol-template.md` for a complete template. The protocol must contain:

1. **Setup instructions** — how to create the branch, verify data, establish baseline
2. **The experiment loop** — the exact sequence from the section above
3. **Scope rules** — what the agent CAN and CANNOT modify
4. **Scoring rules** — what the score means, which direction is better
5. **The simplicity criterion** — all else equal, simpler code wins
6. **Logging format** — exact TSV structure for results.tsv
7. **Never-stop rule** — the agent runs indefinitely until interrupted
8. **Domain-specific guidance** — what kinds of changes to try first, what pitfalls to avoid

### Step 5: Initialize and run

```bash
# Create branch
git checkout -b autoloop/<tag>

# Verify everything works
python strategy.py            # Should print score

# Start the agent
# Point your AI agent at protocol.md and let it go.
# Disable all confirmation prompts — the agent must run autonomously.
```

---

## The Simplicity Criterion

This is a non-obvious but critical rule. Include it in every protocol:

> All else being equal, simpler is better. A tiny score improvement that adds ugly complexity is not worth it. Removing code and getting equal or better results IS worth it — that's a simplification win. When deciding whether to keep a change, weigh the complexity cost against the improvement magnitude.

**Rules of thumb for the agent:**
- +0.001 score from deleting code → definitely keep
- +0.001 score from adding 20 lines of hacky code → probably discard
- +0.01 score from adding 20 lines of clean code → probably keep
- ≈0 score change but much simpler code → keep (simplification win)

---

## Domain-Specific Guidance

Read `references/domain-guides.md` for detailed guidance on specific domains. Here's a summary:

### Trading / Backtesting

**Score**: Sharpe ratio, Sortino ratio, total return, or a composite.
**Overfitting risk**: EXTREMELY HIGH. The biggest danger in this domain.
**Defenses**:
- Walk-forward validation: train on rolling windows, evaluate on the next period
- Out-of-sample hold-out: NEVER let the strategy see the test period
- Penalize complexity: more parameters = more overfitting surface
- Track multiple metrics: a strategy that improves Sharpe but doubles max drawdown is suspicious
- Limit the strategy's access to future data (no look-ahead bias)

**What to put in evaluate.py**:
- Historical price data loading (OHLCV)
- Transaction cost model (slippage, commissions)
- Walk-forward or hold-out split logic
- Risk metrics (drawdown, volatility, Sharpe, Sortino)
- Position sizing constraints
- The scoring function that combines metrics into one number

**What to put in strategy.py**:
- Signal generation logic (when to buy/sell)
- Indicator calculations (moving averages, RSI, etc.)
- Position sizing rules
- Entry/exit logic
- Hyperparameters (lookback periods, thresholds)

### Game AI / Simulation

**Score**: Win rate, ELO, fitness, or a domain-specific metric.
**Overfitting risk**: Moderate. The agent might overfit to specific opponents or scenarios.
**Defenses**:
- Evaluate against a diverse set of opponents/scenarios
- Include random seeds in the harness
- Run multiple evaluation games and average

### ML Model Training (the original autoresearch use case)

**Score**: Validation loss, accuracy, BPB, or similar.
**Overfitting risk**: Standard ML overfitting — use a held-out validation set.
**Key constraint**: Fixed time budget (wall-clock), so the agent jointly optimizes model quality AND training efficiency.

### Prompt Engineering

**Score**: Accuracy on a test set, human preference rating, or LLM-as-judge score.
**Overfitting risk**: High — prompts can overfit to specific test cases.
**Defenses**: Large, diverse test set. Hold out a subset the agent never sees scores for.

### Compiler / Performance Optimization

**Score**: Execution time, throughput, or resource usage.
**Overfitting risk**: Low (hard to cheat on runtime benchmarks).
**Key constraint**: Correctness — the optimized code must produce identical output to the baseline.

---

## Results Logging Format

Every experiment gets logged to `results.tsv` (tab-separated, NOT comma-separated):

**Header:**
```
commit	score	status	description
```

**Fields:**
1. `commit` — git short hash (7 chars)
2. `score` — the numeric score (e.g., 1.847). Use 0.0 for crashes.
3. `status` — one of: `keep`, `discard`, `crash`
4. `description` — short text describing what this experiment tried

**Example:**
```
commit	score	status	description
a1b2c3d	0.847	keep	baseline
b2c3d4e	0.892	keep	increase lookback window to 40
c3d4e5f	0.801	discard	switch to exponential moving average
d4e5f6g	0.000	crash	double position size (runtime error)
e5f6g7h	0.903	keep	add RSI filter with threshold 30
```

**Rules:**
- Do NOT commit results.tsv to git (keep it untracked)
- Log EVERY experiment, including crashes and discards
- The description should be specific enough to understand what was tried without reading the diff
- Add extra columns if needed for the domain (memory, drawdown, etc.)

---

## Git Workflow

The git branch is the experiment log. Each commit is one experiment.

```
main
  └── autoloop/mar5
        ├── a1b2c3d  baseline
        ├── b2c3d4e  increase lookback (keep — score improved)
        │   └── [c3d4e5f  switch to EMA (discard — reset back)]
        ├── e5f6g7h  add RSI filter (keep — score improved)
        │   └── [f6g7h8i  triple model size (crash — reset back)]
        └── g7h8i9j  reduce threshold (keep — score improved)
```

Only "keep" commits stay on the branch. Discards and crashes get reset away. The branch tip always represents the current best strategy.

**Commands the agent uses:**
```bash
# Start
git checkout -b autoloop/<tag>

# After each edit
git add strategy.py
git commit -m "experiment: <description>"

# If score improved (keep)
# Nothing — the commit stays

# If score equal/worse (discard) or crash
git reset --hard HEAD~1
```

---

## Time Budget Design

Every experiment runs for a FIXED time budget (wall-clock seconds, not iterations). This is a critical design choice with two major benefits:

1. **Fair comparison**: Regardless of what the agent changes (bigger model, different algorithm, more iterations), experiments are compared on equal footing — "what's the best score you can get in N minutes?"

2. **Joint optimization**: The agent must optimize for both quality AND efficiency. A brilliant but slow strategy that can't finish in time is worthless. This naturally selects for practical approaches.

**How to implement in evaluate.py:**
```python
import time

TIME_BUDGET = 300  # 5 minutes

start = time.time()
while time.time() - start < TIME_BUDGET:
    # run one step/iteration of the strategy
    strategy.step()

score = strategy.evaluate()
print(f"score: {score}")
```

**Choosing the budget:**
- Too short (< 1 min): not enough time for meaningful experiments
- Sweet spot (3-10 min): enough to see real results, fast enough for ~10-20 experiments/hour
- Too long (> 30 min): too few experiments per session, slow iteration

**Rule of thumb**: You want ~10-12 experiments per hour. So budget = 5-6 minutes is ideal. You get ~100 experiments in an overnight session (8 hours).

---

## Overfitting Prevention

This section is CRITICAL for any backtest-based domain (trading, ML, etc.).

### The Problem

The agent's optimization loop is a search process. The more experiments it runs, the more likely it is to find a strategy that scores well on the evaluation data by chance. This is the multiple comparisons problem — if you test 100 strategies, some will look good just by luck.

### Defenses (Layer Them)

1. **Hold-out test set**: The evaluation harness uses data the strategy NEVER sees during execution. The agent cannot peek at this data. It's the final arbiter.

2. **Walk-forward validation** (for time-series data): Train on data up to time T, evaluate on T+1 to T+N, then slide the window forward. This simulates real-world deployment where you never have future data.

3. **Complexity penalty**: Track how many parameters/lines of code each strategy has. Simpler strategies that score well are more likely to generalize. The simplicity criterion helps here.

4. **Multiple metrics**: Don't optimize a single number in isolation. If the agent improves Sharpe ratio but max drawdown doubles, something is wrong. The harness can print multiple metrics; the protocol should tell the agent to watch for warning signs.

5. **Robustness checks** (optional, advanced): Run the best strategy with different random seeds, slightly perturbed parameters, or on shuffled data. If the score is fragile, it's probably overfit.

---

## Bootstrapping Checklist

When setting up a new autoloop project, go through this checklist:

- [ ] **Score defined**: One numeric metric, clear which direction is better
- [ ] **Harness written**: `evaluate.py` loads data, runs strategy, prints score
- [ ] **Harness is read-only**: Agent instructions explicitly forbid modification
- [ ] **Data exists**: Input data is downloaded/prepared and accessible
- [ ] **Hold-out split**: Evaluation uses data the strategy doesn't see
- [ ] **Time budget set**: Fixed wall-clock budget in the harness
- [ ] **Strategy file written**: `strategy.py` runs end-to-end, prints score
- [ ] **Strategy is simple**: Gives the agent room to improve
- [ ] **Protocol written**: `protocol.md` covers the full loop
- [ ] **Protocol says never stop**: Agent runs indefinitely
- [ ] **Simplicity criterion included**: In the protocol
- [ ] **Git branch created**: `autoloop/<tag>`
- [ ] **Baseline established**: First run logged to results.tsv
- [ ] **Agent permissions disabled**: No confirmation prompts

---

## Reference Files

- `references/protocol-template.md` — Complete, copy-paste-ready protocol.md template. Read this when scaffolding a new project. It's a generic version of the experiment protocol that works for any domain. Fill in the domain-specific blanks.

- `references/domain-guides.md` — Detailed setup guidance for specific domains: trading, ML training, game AI, prompt engineering, performance optimization. Read the section for your target domain.

---

## Common Failure Modes

| Failure | Cause | Fix |
|---------|-------|-----|
| Agent asks "should I continue?" | Protocol doesn't have the never-stop rule | Add it explicitly: "NEVER pause to ask the human" |
| Agent modifies the harness | Protocol doesn't clearly forbid it | Add: "You CANNOT modify evaluate.py. It is read-only." |
| All experiments crash | Bad initial strategy.py | Make sure the baseline runs cleanly before starting the loop |
| Score improves but strategy is garbage | Overfitting to evaluation data | Add hold-out set, complexity penalty, multiple metrics |
| Agent runs out of ideas after 10 experiments | Protocol doesn't suggest directions | Add a "what to try" section with 20+ concrete ideas |
| Agent floods its own context | Output not redirected | Protocol must say: `python strategy.py > run.log 2>&1` |
| Experiments take too long | No time budget enforcement | Add wall-clock budget to evaluate.py |
| Git history is a mess | Agent not resetting on failures | Protocol must specify exact git reset commands |
| Agent makes 5 changes at once | No "one idea per experiment" rule | Add: "each experiment should test one conceptual change" |

---

## Quick Start

If the user just wants to get going fast:

1. Ask what they're optimizing and what the score is
2. Read `references/protocol-template.md`
3. Scaffold the three files (evaluate.py, strategy.py, protocol.md)
4. Fill in domain-specific details
5. Run the baseline
6. Hand off to the agent with: "Read protocol.md and let's kick off a new experiment"
