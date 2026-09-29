# Domain-Specific Guides

Detailed setup guidance for specific domains. Read the section relevant to your target domain.

---

## Trading Strategy Optimization

### Overview

You have a trading strategy (a set of rules for when to buy and sell a financial instrument). You want the AI agent to iteratively improve it by testing modifications against historical price data. The score is a risk-adjusted return metric.

### The Overfitting Problem (Read This First)

Trading backtests are the most dangerous domain for autonomous optimization. The fundamental issue: past price data is fixed. If you run 100 experiments against the same historical data, some strategies will look good by pure chance — they happened to buy before rallies and sell before drops in that specific dataset. This is called **overfitting** or **data snooping** or **curve fitting**.

The more experiments the agent runs, the worse this gets. After 100 experiments, you are virtually guaranteed to find a strategy that looks amazing on the backtest but will fail in live markets.

**Defenses (layer all of them):**

1. **Out-of-sample hold-out**: Split your data into TWO periods. The strategy runs on the first period (in-sample). The score comes from the second period (out-of-sample). The agent NEVER sees the out-of-sample results during strategy execution — only the harness sees them.

   ```
   Historical data:  2010 ──────────────── 2022 ──── 2024
                      ▲                      ▲         ▲
                      │ Strategy sees this    │ Score   │
                      │ (in-sample)           │ comes   │
                      │                       │ from    │
                      │                       │ this    │
                      │                       │ (OOS)   │
   ```

2. **Walk-forward validation**: Instead of a single split, use rolling windows. Train on months 1-12, test on month 13. Then train on months 2-13, test on month 14. Average the out-of-sample scores. This is more robust than a single split.

3. **Transaction cost modeling**: Include realistic transaction costs (spreads, slippage, commissions) in the harness. Strategies that trade too frequently will be penalized automatically. Many "profitable" backtest strategies evaporate when you add realistic costs.

4. **Complexity penalty**: Track how many parameters or lines of code each strategy has. The simplicity criterion helps here — simpler strategies are less likely to overfit.

5. **Multiple metrics in the log**: Even if the score is Sharpe ratio, also print max drawdown, number of trades, win rate, average holding period. The agent should watch for red flags (e.g., Sharpe improved but max drawdown doubled).

### evaluate.py Structure

```python
"""
Fixed evaluation harness for trading strategy optimization.
DO NOT MODIFY THIS FILE.
"""
import pandas as pd
import numpy as np
import time

# ── Constants ──────────────────────────────────────────────
TIME_BUDGET = 300  # 5 minutes
DATA_PATH = "data/prices.csv"

# ── Data splits ────────────────────────────────────────────
# Strategy sees in-sample data only.
# Score is computed on out-of-sample data only.
IN_SAMPLE_END = "2022-01-01"      # Strategy trains/optimizes up to here
OOS_START = "2022-01-01"          # Score computed from here onward

# ── Transaction costs ──────────────────────────────────────
COMMISSION_PER_TRADE = 0.001      # 0.1% per trade (10 bps)
SLIPPAGE_PER_TRADE = 0.0005       # 0.05% slippage

# ── Data loading ───────────────────────────────────────────
def load_data():
    df = pd.read_csv(DATA_PATH, parse_dates=["date"], index_col="date")
    return df

def get_in_sample(df):
    return df[df.index < IN_SAMPLE_END].copy()

def get_out_of_sample(df):
    return df[df.index >= OOS_START].copy()

# ── Scoring ────────────────────────────────────────────────
def compute_metrics(returns):
    """Compute risk-adjusted metrics from a return series."""
    if len(returns) == 0 or returns.std() == 0:
        return {"sharpe": 0.0, "sortino": 0.0, "max_dd": 0.0,
                "total_return": 0.0, "num_trades": 0, "win_rate": 0.0}

    sharpe = returns.mean() / returns.std() * np.sqrt(252)
    downside = returns[returns < 0].std()
    sortino = returns.mean() / downside * np.sqrt(252) if downside > 0 else 0.0
    cumulative = (1 + returns).cumprod()
    peak = cumulative.cummax()
    drawdown = (cumulative - peak) / peak
    max_dd = drawdown.min()
    total_return = cumulative.iloc[-1] - 1 if len(cumulative) > 0 else 0.0

    return {
        "sharpe": round(sharpe, 6),
        "sortino": round(sortino, 6),
        "max_dd": round(max_dd, 6),
        "total_return": round(total_return, 6),
    }

def apply_costs(signals, prices):
    """Apply transaction costs to a signal series."""
    trades = signals.diff().abs().fillna(0)
    cost_per_bar = trades * (COMMISSION_PER_TRADE + SLIPPAGE_PER_TRADE)
    raw_returns = signals.shift(1) * prices.pct_change()
    net_returns = raw_returns - cost_per_bar
    return net_returns.dropna()

# ── Main evaluation ────────────────────────────────────────
def run_evaluation(strategy_fn):
    """
    Called by strategy.py. Runs the strategy, computes score.
    strategy_fn(df) -> pd.Series of position signals (-1, 0, +1)
    """
    t0 = time.time()

    df = load_data()
    is_data = get_in_sample(df)
    oos_data = get_out_of_sample(df)

    # Let strategy see ONLY in-sample data for any fitting/optimization
    # But generate signals for the full dataset
    signals = strategy_fn(df, train_end=IN_SAMPLE_END)

    # Score on out-of-sample only
    oos_signals = signals[signals.index >= OOS_START]
    oos_prices = oos_data["close"]
    oos_returns = apply_costs(oos_signals, oos_prices)
    metrics = compute_metrics(oos_returns)

    elapsed = time.time() - t0

    # The score (what the agent optimizes)
    score = metrics["sharpe"]

    # Print results
    print("---")
    print(f"score:          {score}")
    print(f"time_seconds:   {elapsed:.1f}")
    print(f"sharpe:         {metrics['sharpe']}")
    print(f"sortino:        {metrics['sortino']}")
    print(f"max_drawdown:   {metrics['max_dd']}")
    print(f"total_return:   {metrics['total_return']}")
```

### strategy.py Structure

```python
"""
Trading strategy — the agent modifies this file.
Usage: python strategy.py
"""
import pandas as pd
import numpy as np

# ============================================================
# HYPERPARAMETERS (tune these)
# ============================================================
LOOKBACK = 20          # Moving average lookback period
THRESHOLD = 0.0        # Signal threshold (0 = always in market)
POSITION_SIZE = 1.0    # Full position sizing

# ============================================================
# STRATEGY LOGIC (modify this)
# ============================================================
def generate_signals(df, train_end=None):
    """
    Generate position signals from price data.

    Args:
        df: DataFrame with OHLCV columns (open, high, low, close, volume)
        train_end: str date — only use data before this for fitting/optimization

    Returns:
        pd.Series of signals: +1 (long), 0 (flat), -1 (short)
    """
    close = df["close"]

    # Simple moving average crossover
    fast_ma = close.rolling(LOOKBACK).mean()
    slow_ma = close.rolling(LOOKBACK * 2).mean()

    signals = pd.Series(0.0, index=df.index)
    signals[fast_ma > slow_ma] = POSITION_SIZE
    signals[fast_ma < slow_ma] = -POSITION_SIZE

    return signals

# ============================================================
# EXECUTION
# ============================================================
if __name__ == "__main__":
    from evaluate import run_evaluation
    run_evaluation(generate_signals)
```

---

## ML Model Training

### Overview

This is the original autoresearch use case. You have a neural network training script and want the agent to improve the model architecture, optimizer, and hyperparameters to get the best validation metric within a fixed time budget.

### Key Design Decisions

1. **Time budget, not step budget**: The training runs for a fixed number of wall-clock seconds. This means changes to batch size, model size, or optimizer are all automatically comparable — the question is always "what's the best validation score you can get in N minutes?"

2. **Single file**: The model, optimizer, and training loop are all in one file. This keeps diffs reviewable and the agent's scope manageable.

3. **Validation metric**: Use a metric that's independent of architectural choices. For language models, **bits per byte (BPB)** is ideal because it's vocab-size-independent. For vision, use accuracy on a fixed test set.

### evaluate.py Structure

```python
"""
Fixed evaluation harness for ML training.
DO NOT MODIFY.
"""
import torch
import time

# Constants
MAX_SEQ_LEN = 2048
TIME_BUDGET = 300  # 5 minutes
EVAL_TOKENS = 20_000_000

def load_data(split):
    """Load train or val data. Returns an iterator of batches."""
    ...

@torch.no_grad()
def evaluate(model, batch_size):
    """
    Compute validation metric (e.g., BPB).
    Uses fixed eval set and fixed sequence length.
    """
    ...
    return score
```

### strategy.py Structure (called train.py in autoresearch)

```python
"""
Model training script — agent modifies this.
"""
from evaluate import TIME_BUDGET, load_data, evaluate

# ── Hyperparameters ───
DEPTH = 8
LEARNING_RATE = 0.001
BATCH_SIZE = 128
# ...

# ── Model ─────────────
class Model(nn.Module):
    ...

# ── Training loop ─────
model = Model()
optimizer = ...
start = time.time()

while time.time() - start < TIME_BUDGET:
    batch = next(train_loader)
    loss = model(batch)
    loss.backward()
    optimizer.step()

# ── Evaluation ────────
model.eval()
score = evaluate(model, BATCH_SIZE)
print(f"score: {score}")
```

---

## Game AI / Simulation

### Overview

You have an AI agent that plays a game or operates in a simulation, and you want to optimize its strategy (heuristic weights, decision logic, evaluation function, etc.).

### evaluate.py Structure

```python
"""
Fixed game evaluation harness. DO NOT MODIFY.
"""
import random

GAMES_PER_EVAL = 100
TIME_BUDGET = 300
SEED = 42

def evaluate_agent(agent_fn):
    """
    Play N games against fixed opponents, return win rate.
    """
    random.seed(SEED)
    wins = 0
    for i in range(GAMES_PER_EVAL):
        result = play_game(agent_fn, opponent=baseline_opponent)
        if result == "win":
            wins += 1

    score = wins / GAMES_PER_EVAL
    print(f"score: {score}")
    print(f"games: {GAMES_PER_EVAL}")
    print(f"wins:  {wins}")
```

**Key points:**
- Fixed random seed for reproducibility
- Fixed set of opponents/scenarios (don't let the agent choose its opponents)
- Enough games to reduce variance (100+ is good)

---

## Prompt Engineering

### Overview

You have a prompt template and want to optimize it for accuracy on a test set. The score is the percentage of correct outputs.

### evaluate.py Structure

```python
"""
Fixed prompt evaluation harness. DO NOT MODIFY.
"""
import json

TEST_CASES_PATH = "data/test_cases.json"
# Hold-out cases the agent never sees scores for
HOLDOUT_PATH = "data/holdout_cases.json"

def load_test_cases():
    with open(TEST_CASES_PATH) as f:
        return json.load(f)

def load_holdout_cases():
    with open(HOLDOUT_PATH) as f:
        return json.load(f)

def evaluate_prompt(prompt_fn):
    """
    prompt_fn(input) -> output string
    """
    cases = load_holdout_cases()  # Score on holdout only
    correct = 0
    for case in cases:
        output = prompt_fn(case["input"])
        if judge(output, case["expected"]):
            correct += 1

    score = correct / len(cases)
    print(f"score: {score}")
```

### strategy.py Structure

```python
"""
Prompt template — agent modifies this.
"""
SYSTEM_PROMPT = """
You are a helpful assistant that...
"""

FEW_SHOT_EXAMPLES = [
    {"input": "...", "output": "..."},
    ...
]

def generate_prompt(input_text):
    """Build the full prompt for a given input."""
    examples = "\n".join(
        f"Input: {ex['input']}\nOutput: {ex['output']}"
        for ex in FEW_SHOT_EXAMPLES
    )
    return f"{SYSTEM_PROMPT}\n\n{examples}\n\nInput: {input_text}\nOutput:"

if __name__ == "__main__":
    from evaluate import evaluate_prompt
    evaluate_prompt(generate_prompt)
```

---

## Performance / Compiler Optimization

### Overview

You have a program and want to optimize its execution speed (or memory usage, throughput, etc.) while maintaining correctness.

### evaluate.py Structure

```python
"""
Fixed performance benchmark. DO NOT MODIFY.
"""
import time
import subprocess

REFERENCE_OUTPUT = "data/reference_output.txt"
TIME_BUDGET = 60  # 1 minute
WARMUP_RUNS = 3
MEASURE_RUNS = 10

def evaluate_performance(run_command):
    # Correctness check
    result = subprocess.run(run_command, capture_output=True, text=True)
    with open(REFERENCE_OUTPUT) as f:
        expected = f.read()
    assert result.stdout.strip() == expected.strip(), "Correctness check failed!"

    # Performance measurement
    times = []
    for _ in range(WARMUP_RUNS):
        subprocess.run(run_command, capture_output=True)
    for _ in range(MEASURE_RUNS):
        t0 = time.time()
        subprocess.run(run_command, capture_output=True)
        times.append(time.time() - t0)

    score = sum(times) / len(times)  # Lower is better
    print(f"score: {score}")
    print(f"median: {sorted(times)[len(times)//2]}")
    print(f"min:    {min(times)}")
    print(f"max:    {max(times)}")
```

**Key points:**
- ALWAYS verify correctness before measuring performance
- Use multiple runs and report median/mean (reduces noise)
- Warmup runs to avoid cold-cache effects
- Reference output for correctness checking — the optimized program must produce IDENTICAL output
