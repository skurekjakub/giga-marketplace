# Playbooks

One playbook per ticket type the app keeps producing — the part of `test-issue` that grows.

## When to write one

After a run that verified a ticket type no playbook covers (search, an admin editor, feeds,
exports, an embedded widget…), write down what was specific while it is fresh: the surfaces,
the probes, the traps. Never write a playbook you have not executed.

## Shape

```markdown
# Playbook — <ticket type>

For <which diffs / which tickets>. The consumer is <who>. **Runs on <dev | build>.**

## Map the surfaces      — how to find every place a user meets the change
## What to verify        — numbered, each an observation with its command
## Supporting            — unit tests, validators, specs (read, not trusted)
## Traps                 — rules with a reason, each locator resolving
```

Write findings as rules with a reason, not as an account of the run that produced them.
