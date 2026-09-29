# {{PRODUCT_NAME}} — Source Navigation Map

> This reference file is loaded on demand by the docs-source-validation skill.
> It provides a complete navigational map of the product source code repository.

> **Template — fill this out for your repository.** Replace every `{{...}}` placeholder and every `<!-- fill in -->` section with your product's actual layout, then delete this block. Guidelines for a useful map:
>
> - **Map every area an agent might need to grep.** The map's job is to let an agent scope a search to the right directory on the first try instead of grepping the whole repo.
> - **Keep entries short** — a name, a path, one line of purpose, and notable subdirectories. This file is reference material, not documentation.
> - **Group by product domain**, not by technical layer, when possible — agents arrive with feature names ("forms", "email", "search"), not layer names.
> - **Include the test layout and build system** — validation workflows regularly need both.
> - **Keep it current.** An outdated map sends agents to directories that no longer exist; re-verify it after large refactors.

Repository root: `{{SOURCE_REPO_PATH}}`
Entry point / solution file: `{{SOLUTION_OR_ENTRY_POINT}}`
Git remote: `{{SOURCE_REPO_URL}}`
Primary branch: `{{SOURCE_DEFAULT_BRANCH}}`
Language / runtime: `{{TECH_STACK}}`

---

## Top-Level Repository Structure

```
{{REPO_NAME}}/
├── src/                  # <!-- fill in: main source tree -->
├── build/                # <!-- fill in: build utilities, scripts -->
├── pipelines/            # <!-- fill in: CI/CD definitions -->
├── docs/                 # <!-- fill in: internal documentation -->
└── ...                   # <!-- fill in: remaining top-level directories -->
```

---

## Module / Project Organization

<!-- fill in: how the source tree is grouped into logical tiers or domains.
     Example format: -->

- **Core** — <!-- foundational libraries -->
- **Content** — <!-- content authoring & management -->
- **Security** — <!-- authentication, authorization, membership -->
- **Presentation** — <!-- web/UI layer -->
- **Integrations** — <!-- third-party integrations -->
- **Tools** — <!-- utility tools and CLI -->
- **Tests** — <!-- all test projects -->

---

## Key Product Areas

<!-- fill in: one subsection per major area an agent might need to locate.
     Repeat this pattern for each area: -->

### {{AreaName}} (`{{path/to/area/}}`)
<!-- One line: what this area is responsible for. -->
Subdirectories: <!-- notable subdirectories, comma-separated -->

---

## Platform Infrastructure

<!-- fill in: cross-cutting infrastructure modules, if any. Example format: -->

| Module | Location | Purpose |
|---|---|---|
| Logging | `{{path}}` | <!-- system event logging --> |
| Scheduler | `{{path}}` | <!-- task scheduling --> |
| Localization | `{{path}}` | <!-- culture & resource management --> |

---

## Integrations

<!-- fill in: third-party integration packages, if any. Example format: -->

| Package | Purpose |
|---|---|
| `{{PackageName}}` | <!-- cloud storage, email service, etc. --> |

---

## Testing

<!-- fill in: where tests live and how they're named. Example format: -->

Tests live in `{{SOURCE_TEST_DIR}}` and follow the pattern `{{TEST_NAMING_PATTERN}}`.

Key test projects:
- <!-- list the test projects an agent is most likely to consult for behavioral examples -->

---

## Build System

<!-- fill in: the files that control the build, and what each does. Example format: -->

| File | Purpose |
|---|---|
| `{{build-file}}` | <!-- target framework, signing, analysis settings --> |
| `{{packages-file}}` | <!-- centralized dependency versions --> |

<!-- If build output is organized in a meaningful way, document it here. -->

---

## Key Technology Stack

<!-- fill in: the major frameworks and libraries an agent will encounter. Example format: -->

- **Framework:** <!-- e.g., .NET 8.0+, Node 22 -->
- **Data access:** <!-- ORM / database layer -->
- **Testing:** <!-- test framework, mocking library -->
- **Code analysis:** <!-- linters, analyzers -->
