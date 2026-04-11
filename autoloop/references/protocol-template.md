# Protocol Template

A complete, copy-paste-ready `protocol.md` for any autoloop project. Fill in the bracketed placeholders with your domain-specific details.

---

# [PROJECT NAME] — Autonomous Optimization

This is an experiment to autonomously optimize [WHAT YOU'RE OPTIMIZING].

## Setup

To set up a new experiment, work with the user to:

1. **Agree on a run tag**: propose a tag based on today's date (e.g. `apr11`). The branch `autoloop/<tag>` must not already exist — this is a fresh run.
2. **Create the branch**: `git checkout -b autoloop/<tag>` from current main.
3. **Read the in-scope files**: The repo is small. Read these files for full context:
   - `README.md` — repository context.
   - `evaluate.py` — fixed evaluation harness, data loading, scoring. Do not modify.
   - `strategy.py` — the file you modify. [BRIEF DESCRIPTION OF WHAT'S IN IT].
4. **Verify data exists**: Check that `[DATA_PATH]` contains the required data files. If not, tell the human to run `[DATA_PREP_COMMAND]`.
5. **Initialize results.tsv**: Create `results.tsv` with just the header row. The baseline will be recorded after the first run.
6. **Confirm and go**: Confirm setup looks good.

Once you get confirmation, kick off the experimentation.

## Experimentation

Each experiment runs on [COMPUTE DESCRIPTION]. The evaluation runs for a **fixed time budget of [TIME_BUDGET] minutes** (wall clock). You launch it simply as: `[RUN_COMMAND]`.

**What you CAN do:**
- Modify `strategy.py` — this is the only file you edit. Everything is fair game: [LIST WHAT'S FAIR GAME — e.g., "signal logic, indicators, position sizing, thresholds, entry/exit rules, etc."]

**What you CANNOT do:**
- Modify `evaluate.py`. It is read-only. It contains the fixed evaluation, data loading, scoring function, and constraints ([TIME_BUDGET]-minute budget, hold-out data split, transaction costs, etc).
- Install new packages or add dependencies. You can only use what's already available.
- Modify the scoring function. The `[SCORING_FUNCTION_NAME]` function in `evaluate.py` is the ground truth metric.

**The goal is simple: get the [BEST DIRECTION — "highest" or "lowest"] [SCORE_NAME].** Since the time budget is fixed, you don't need to worry about runtime — it's always [TIME_BUDGET] minutes. Everything is fair game: [REITERATE WHAT CAN BE CHANGED]. The only constraint is that the code runs without crashing and finishes within the time budget.

**Simplicity criterion**: All else being equal, simpler is better. A small improvement that adds ugly complexity is not worth it. Conversely, removing something and getting equal or better results is a great outcome — that's a simplification win. When evaluating whether to keep a change, weigh the complexity cost against the improvement magnitude.

**The first run**: Your very first run should always be to establish the baseline, so you will run the strategy as-is.

## Output format

Once the script finishes it prints a summary like this:

```
---
score:            [EXAMPLE_SCORE]
time_seconds:     [EXAMPLE_TIME]
[ADDITIONAL_METRICS]
```

You can extract the key metric from the log file:

```
grep "^score:" run.log
```

## Logging results

When an experiment is done, log it to `results.tsv` (tab-separated, NOT comma-separated — commas break in descriptions).

The TSV has a header row and columns:

```
commit	score	[EXTRA_COLUMNS]	status	description
```

1. git commit hash (short, 7 chars)
2. score achieved (e.g. [EXAMPLE_SCORE]) — use 0.0 for crashes
3. [DESCRIBE EXTRA COLUMNS — e.g., "max_drawdown as percentage", "memory_gb"]
4. status: `keep`, `discard`, or `crash`
5. short text description of what this experiment tried

Example:

```
commit	score	status	description
a1b2c3d	[BASELINE_SCORE]	keep	baseline
b2c3d4e	[IMPROVED_SCORE]	keep	[example improvement description]
c3d4e5f	[WORSE_SCORE]	discard	[example failed experiment]
d4e5f6g	0.0	crash	[example crash]
```

## The experiment loop

The experiment runs on a dedicated branch (e.g. `autoloop/apr11`).

LOOP FOREVER:

1. Look at the git state: the current branch/commit we're on.
2. Edit `strategy.py` with an experimental idea by directly modifying the code.
3. `git add strategy.py && git commit -m "experiment: <description>"`
4. Run the experiment: `[RUN_COMMAND] > run.log 2>&1` (redirect everything — do NOT use tee or let output flood your context)
5. Read out the results: `grep "^score:" run.log`
6. If the grep output is empty, the run crashed. Run `tail -n 50 run.log` to read the stack trace and attempt a fix. If you can't get things to work after more than 3 attempts, give up on this idea.
7. Record the results in the TSV (NOTE: do not commit results.tsv, leave it untracked)
8. If score improved ([DIRECTION] than previous best), you "advance" the branch, keeping the git commit.
9. If score is equal or worse, `git reset --hard HEAD~1` back to where you started.

The idea is that you are a completely autonomous researcher trying things out. If they work, keep. If they don't, discard. And you're advancing the branch so that you can iterate.

**Timeout**: Each experiment should take ~[TIME_BUDGET] minutes total (+ overhead). If a run exceeds [2x TIME_BUDGET] minutes, kill it and treat it as a failure (discard and revert).

**Crashes**: If a run crashes, use your judgment: If it's something dumb and easy to fix (typo, missing import), fix it and re-run. If the idea itself is fundamentally broken, just skip it, log "crash" as the status, and move on.

**NEVER STOP**: Once the experiment loop has begun (after the initial setup), do NOT pause to ask the human if you should continue. Do NOT ask "should I keep going?" or "is this a good stopping point?". The human might be asleep, or gone from a computer and expects you to continue working *indefinitely* until you are manually stopped. You are autonomous. If you run out of ideas, think harder — re-read the strategy file for new angles, try combining previous near-misses, try more radical changes, try simplification. The loop runs until the human interrupts you, period.

## What to try

Here are categories of experiments to explore, roughly ordered from safe to adventurous:

### Quick wins (try first)
- [DOMAIN-SPECIFIC QUICK WINS — e.g., "Tune the lookback window: try 10, 30, 50, 100"]
- [e.g., "Adjust thresholds up and down by 50%"]
- [e.g., "Try different indicator periods"]

### Structural changes
- [e.g., "Replace SMA with EMA"]
- [e.g., "Add a second confirming indicator"]
- [e.g., "Change entry logic from threshold-based to crossover-based"]

### Radical experiments
- [e.g., "Completely different strategy paradigm (momentum → mean reversion)"]
- [e.g., "Remove the primary indicator entirely and use only volume"]
- [e.g., "Combine the top 3 previous improvements into one strategy"]

### Simplification experiments
- Remove components and check if the score stays the same
- Reduce the number of parameters
- Replace complex logic with simpler alternatives

---

## Placeholders to fill in

When using this template, replace all `[BRACKETED]` text with your domain-specific values:

| Placeholder | Example (trading) | Example (ML) |
|-------------|-------------------|---------------|
| `[PROJECT NAME]` | SPY Momentum Strategy | GPT Pretraining |
| `[WHAT YOU'RE OPTIMIZING]` | a trading strategy for SPY | an LLM training setup |
| `[DATA_PATH]` | `data/spy_daily.csv` | `~/.cache/autoresearch/` |
| `[DATA_PREP_COMMAND]` | `python prepare_data.py` | `python prepare.py` |
| `[TIME_BUDGET]` | 5 | 5 |
| `[RUN_COMMAND]` | `python strategy.py` | `uv run train.py` |
| `[SCORE_NAME]` | sharpe_ratio | val_bpb |
| `[BEST DIRECTION]` | highest | lowest |
| `[SCORING_FUNCTION_NAME]` | `evaluate_strategy` | `evaluate_bpb` |
| `[EXAMPLE_SCORE]` | 1.847 | 0.998 |
| `[BASELINE_SCORE]` | 1.234 | 0.998 |
| `[COMPUTE DESCRIPTION]` | a single machine with Python 3.10+ | a single NVIDIA GPU |
