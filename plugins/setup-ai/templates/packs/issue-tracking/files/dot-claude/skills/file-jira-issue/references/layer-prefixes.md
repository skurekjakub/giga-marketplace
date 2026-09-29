# Layer prefix on codebase issues

Every issue about the code, its tests, its tooling or its deployment goes under
the **{{JIRA_CODE_EPIC}}** epic, and its summary starts with the layer the work
lands in, in square brackets: `[api] Collapse the two auth gates`. The prefix
is how anyone planning work in one layer finds the tickets that move with it;
an unprefixed summary under that epic is a filing error, not a style choice.

## The roster

> **Adapt me.** One row per layer of *this* codebase, ordered by what each may
> import. Keep it to the layers a reader would name; the examples column is
> what makes the table usable.

| Prefix | Holds | Examples |
|---|---|---|
| `{{LayerName}}` | {{PathsThisLayerHolds}} | {{TwoOrThreeExamples}} |

Three names for work that is in none of the code layers:

| Prefix | Holds |
|---|---|
| `infra` | container images, infrastructure-as-code, deploy pipelines, environments |
| `tooling` | scripts, linters and their config, test-runner config, CI stages that run a check |
| `docs` | `docs/`, `{{AI_DIR}}/`, READMEs, conventions |

## Deciding the hard cases

- **A test takes the layer of the code it pins.** Only harness work that pins
  nothing is `tooling`.
- **Pipeline YAML splits on what the stage does.** A stage that ships an image
  is `infra`; a stage that runs a check is `tooling`.
- **A fix goes where the fix lands, not where the symptom shows.**
- **A route or handler that only calls into a layer takes its own layer;** the
  layer it calls is not the prefix unless the change is in that layer.
- **Cross-cutting work takes the layer with most of the sites.** State the
  runner-up in the body's Context block.
- **One prefix only.** A change that genuinely needs two is two issues.

## Body shape

Same four blocks as `issue-body-template.md`. Issue type is **Story** for
planned work and **Bug** for a defect.
