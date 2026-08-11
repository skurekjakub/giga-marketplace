#!/usr/bin/env python3
"""
Scaffold a new autoloop project.

Usage:
    python scaffold.py <project_dir> --domain <domain>

Creates the directory structure and starter files for an autonomous
optimization loop. Domains: trading, ml, game, prompt, performance, generic.
"""
import argparse
import os
import sys
import textwrap

DOMAINS = {
    "trading": {
        "score_name": "sharpe_ratio",
        "direction": "highest",
        "time_budget": 300,
        "description": "trading strategy",
        "evaluate_template": "trading",
        "strategy_template": "trading",
    },
    "ml": {
        "score_name": "val_loss",
        "direction": "lowest",
        "time_budget": 300,
        "description": "ML model training",
        "evaluate_template": "ml",
        "strategy_template": "ml",
    },
    "game": {
        "score_name": "win_rate",
        "direction": "highest",
        "time_budget": 300,
        "description": "game AI strategy",
        "evaluate_template": "game",
        "strategy_template": "game",
    },
    "prompt": {
        "score_name": "accuracy",
        "direction": "highest",
        "time_budget": 120,
        "description": "prompt template",
        "evaluate_template": "prompt",
        "strategy_template": "prompt",
    },
    "performance": {
        "score_name": "execution_time",
        "direction": "lowest",
        "time_budget": 60,
        "description": "program performance",
        "evaluate_template": "performance",
        "strategy_template": "performance",
    },
    "generic": {
        "score_name": "score",
        "direction": "highest",
        "time_budget": 300,
        "description": "your target metric",
        "evaluate_template": "generic",
        "strategy_template": "generic",
    },
}


def create_evaluate(domain_cfg):
    return textwrap.dedent(f'''\
    """
    Fixed evaluation harness for {domain_cfg["description"]} optimization.
    DO NOT MODIFY THIS FILE. The agent cannot touch this.

    This file contains:
    - Data loading
    - Scoring function
    - Time budget enforcement
    - Hold-out data split (overfitting defense)
    """
    import time

    # ── Constants (fixed, do not modify) ───────────────────────
    TIME_BUDGET = {domain_cfg["time_budget"]}  # seconds
    SCORE_NAME = "{domain_cfg["score_name"]}"
    DIRECTION = "{domain_cfg["direction"]}"  # "highest" or "lowest"

    # ── Data loading ───────────────────────────────────────────
    def load_data():
        """
        TODO: Load your dataset here.
        Return whatever format your strategy needs.
        """
        raise NotImplementedError("Fill in data loading")

    # ── Scoring ────────────────────────────────────────────────
    def compute_score(result):
        """
        TODO: Compute the optimization metric from strategy output.
        Must return a single float. {domain_cfg["direction"].capitalize()} is better.
        """
        raise NotImplementedError("Fill in scoring logic")

    # ── Main evaluation entry point ────────────────────────────
    def run_evaluation(strategy_fn):
        """
        Called by strategy.py. Runs the strategy, enforces time budget,
        computes and prints the score.

        strategy_fn: a callable that takes data and returns a result
        """
        t0 = time.time()

        data = load_data()
        result = strategy_fn(data)

        elapsed = time.time() - t0
        score = compute_score(result)

        print("---")
        print(f"score:          {{score}}")
        print(f"time_seconds:   {{elapsed:.1f}}")

    if __name__ == "__main__":
        print("This file is the evaluation harness. Run strategy.py instead.")
        print(f"Score metric: {{SCORE_NAME}} ({{DIRECTION}} is better)")
        print(f"Time budget:  {{TIME_BUDGET}}s")
    ''')


def create_strategy(domain_cfg):
    return textwrap.dedent(f'''\
    """
    Strategy file — the AI agent modifies this.
    Usage: python strategy.py
    """

    # ============================================================
    # HYPERPARAMETERS (tune these)
    # ============================================================
    PARAM_1 = 1.0   # TODO: Replace with your domain's parameters
    PARAM_2 = 0.5

    # ============================================================
    # STRATEGY LOGIC (modify this)
    # ============================================================
    def run_strategy(data):
        """
        TODO: Implement your strategy here.

        Args:
            data: whatever load_data() returns from evaluate.py

        Returns:
            result: whatever compute_score() expects in evaluate.py
        """
        raise NotImplementedError("Fill in strategy logic")

    # ============================================================
    # EXECUTION (calls evaluation harness — keep this structure)
    # ============================================================
    if __name__ == "__main__":
        from evaluate import run_evaluation
        run_evaluation(run_strategy)
    ''')


def create_protocol(domain_cfg, project_name):
    direction_word = "higher" if domain_cfg["direction"] == "highest" else "lower"
    return textwrap.dedent(f'''\
    # {project_name} — Autonomous Optimization

    This is an experiment to autonomously optimize {domain_cfg["description"]}.

    ## Setup

    1. **Agree on a run tag**: propose a tag based on today's date (e.g. `apr11`).
    2. **Create the branch**: `git checkout -b autoloop/<tag>` from current main.
    3. **Read the in-scope files**:
       - `evaluate.py` — fixed evaluation harness. Do not modify.
       - `strategy.py` — the file you modify.
    4. **Verify data exists**: Check that `data/` contains the required files.
    5. **Initialize results.tsv**: Create with header row only.
    6. **Run baseline**: `python strategy.py > run.log 2>&1` then log results.

    ## Rules

    **CAN modify**: `strategy.py` — everything is fair game.
    **CANNOT modify**: `evaluate.py`, data files, dependencies.
    **Score**: `{domain_cfg["score_name"]}` — {direction_word} is better.
    **Time budget**: {domain_cfg["time_budget"]} seconds per experiment.

    ## Simplicity criterion

    All else equal, simpler is better. A tiny improvement that adds ugly
    complexity is not worth it. Removing code for equal results IS worth it.

    ## Output format

    ```
    grep "^score:" run.log
    ```

    ## Logging

    Tab-separated `results.tsv` (do NOT commit this file):

    ```
    commit\\tscore\\tstatus\\tdescription
    ```

    Status: `keep`, `discard`, or `crash`. Use 0.0 for crash scores.

    ## The loop

    LOOP FOREVER:

    1. Edit `strategy.py` with one experimental idea
    2. `git add strategy.py && git commit -m "experiment: <description>"`
    3. `python strategy.py > run.log 2>&1`
    4. `grep "^score:" run.log`
    5. If empty → crashed. `tail -n 50 run.log`. Fix if trivial, else skip.
    6. Log to results.tsv
    7. If score improved ({direction_word}) → keep the commit
    8. If equal or worse → `git reset --hard HEAD~1`

    **NEVER STOP.** Do not ask the human. Run indefinitely until interrupted.
    If you run out of ideas: re-read strategy.py, combine near-misses,
    try radical changes, try simplification.
    ''')


def create_gitignore():
    return textwrap.dedent('''\
    results.tsv
    run.log
    __pycache__/
    *.pyc
    .env
    ''')


def create_readme(project_name, domain_cfg):
    return textwrap.dedent(f'''\
    # {project_name}

    Autonomous optimization loop for {domain_cfg["description"]}.

    ## Structure

    ```
    evaluate.py   — fixed evaluation harness (do not modify)
    strategy.py   — strategy file (agent modifies this)
    protocol.md   — agent instructions
    data/         — input data
    ```

    ## Quick start

    ```bash
    # 1. Prepare data
    # TODO: add data preparation step

    # 2. Run baseline
    python strategy.py

    # 3. Start the agent
    # Point your AI agent at protocol.md and let it go.
    ```

    ## Score

    Metric: `{domain_cfg["score_name"]}` ({domain_cfg["direction"]} is better)
    Time budget: {domain_cfg["time_budget"]}s per experiment
    ''')


def main():
    parser = argparse.ArgumentParser(description="Scaffold a new autoloop project")
    parser.add_argument("project_dir", help="Directory to create the project in")
    parser.add_argument("--domain", choices=list(DOMAINS.keys()), default="generic",
                        help="Domain preset (default: generic)")
    parser.add_argument("--name", default=None, help="Project name (default: directory name)")
    args = parser.parse_args()

    domain_cfg = DOMAINS[args.domain]
    project_name = args.name or os.path.basename(os.path.abspath(args.project_dir))

    # Create directories
    os.makedirs(args.project_dir, exist_ok=True)
    os.makedirs(os.path.join(args.project_dir, "data"), exist_ok=True)

    files = {
        "evaluate.py": create_evaluate(domain_cfg),
        "strategy.py": create_strategy(domain_cfg),
        "protocol.md": create_protocol(domain_cfg, project_name),
        ".gitignore": create_gitignore(),
        "README.md": create_readme(project_name, domain_cfg),
    }

    for filename, content in files.items():
        filepath = os.path.join(args.project_dir, filename)
        if os.path.exists(filepath):
            print(f"  SKIP {filename} (already exists)")
            continue
        with open(filepath, "w") as f:
            f.write(content)
        print(f"  CREATE {filename}")

    print(f"\nProject scaffolded at {args.project_dir}/")
    print(f"Domain: {args.domain} ({domain_cfg['description']})")
    print(f"Score:  {domain_cfg['score_name']} ({domain_cfg['direction']} is better)")
    print(f"Budget: {domain_cfg['time_budget']}s per experiment")
    print(f"\nNext steps:")
    print(f"  1. Fill in evaluate.py (data loading + scoring)")
    print(f"  2. Fill in strategy.py (initial strategy)")
    print(f"  3. Add data to data/")
    print(f"  4. Run: python strategy.py")
    print(f"  5. Point your AI agent at protocol.md")


if __name__ == "__main__":
    main()
