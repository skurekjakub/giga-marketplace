# additionalContext — Complete Reference

The `additionalContext` field is the primary mechanism for extensions to inject invisible instructions, domain knowledge, and real-time guidance into the agent's conversation. The agent sees it; the user does not. It appears in **four of the six hooks** and serves a different tactical purpose in each.

---

## Where It Exists

| Hook | Output Field | SDK Description | When It Fires |
|------|-------------|-----------------|---------------|
| `onSessionStart` | `additionalContext?: string` | Injected as initial context | Once, when session begins |
| `onUserPromptSubmitted` | `additionalContext?: string` | Appended as hidden context the agent sees | Every user message |
| `onPreToolUse` | `additionalContext?: string` | Injected into the conversation | Before each tool execution |
| `onPostToolUse` | `additionalContext?: string` | Injected into the conversation | After each tool execution |

**Not available in:** `onSessionEnd` (no point — the agent is done) and `onErrorOccurred` (uses `userNotification` instead, which is shown to the user, not the agent).

---

## How It Works

1. Your hook returns `{ additionalContext: "some string" }`.
2. The CLI injects that string into the agent's conversation as hidden context — a message the agent processes but that never appears in the user's terminal output.
3. The agent incorporates the context into its next reasoning step.
4. The user has no indication the context was injected unless the agent's behavior visibly changes.

**Type signature (same across all four hooks):**

```ts
additionalContext?: string;
```

Plain string. No structured format, no markup requirement. The CLI passes it verbatim to the LLM.

---

## Behavioral Details

### Visibility

- **Agent sees it:** Yes — it becomes part of the conversation history the LLM receives.
- **User sees it:** No — it does not render in the terminal, timeline, or session log.
- **Session history:** The context IS included in the conversation messages. If you call `session.getMessages()`, injected context appears in the history.

### Lifetime and Accumulation

Each `additionalContext` injection is a **discrete message in the conversation**. They accumulate:

- `onSessionStart` context persists for the entire session — it sits near the top of the conversation.
- `onUserPromptSubmitted` context is injected once per user message. If the user sends 10 messages and your hook returns context every time, there are 10 separate injections in history.
- `onPreToolUse` and `onPostToolUse` context is injected per tool call. In a turn where the agent calls 15 tools, your hook could inject 15 (or 30) context messages.

**This means context accumulates and consumes the context window.** There is no automatic deduplication or compaction of injected context. If you inject large strings on every tool call, you will accelerate context window exhaustion and trigger compaction sooner.

### Interaction with Other Output Fields

`additionalContext` can be returned alongside any other output field in the same hook response:

```js
// onPreToolUse — deny AND inject context explaining why
return {
  permissionDecision: "deny",
  permissionDecisionReason: "Blocked: database writes are read-only in staging.",
  additionalContext: "This environment is staging. All database operations must be read-only. Use SELECT queries only.",
};

// onUserPromptSubmitted — modify prompt AND add context
return {
  modifiedPrompt: input.prompt.replace(/deploy/gi, "dry-run deploy"),
  additionalContext: "The user said 'deploy' but we rewrote it to 'dry-run deploy'. Complete the dry run, report what would change, then ask for confirmation before actual deployment.",
};

// onPostToolUse — modify the result AND add context
return {
  modifiedResult: {
    ...input.toolResult,
    textResultForLlm: redactSecrets(input.toolResult.textResultForLlm),
  },
  additionalContext: "Secrets were redacted from the tool output. Do not attempt to reconstruct or guess redacted values.",
};
```

### Interaction with suppressOutput

When `suppressOutput: true` is also returned, the hook's other outputs (like `permissionDecisionReason`) are suppressed from the user-facing log. But `additionalContext` is already invisible to the user — `suppressOutput` has no effect on it. The two fields are orthogonal.

### Multiple Extensions

If multiple extensions register the same hook, only the last-loaded extension's hook fires (this is the **hook overwrite bug** documented in the SKILL.md). That means only ONE extension can return `additionalContext` from a given hook.

**Workaround:** Designate one extension as the "hooks extension." Other extensions communicate via events or shared state, and the hooks extension aggregates their context into a single `additionalContext` return.

### Empty and Undefined

- Returning `undefined` or omitting the field: no context injected (no-op).
- Returning `""` (empty string): technically injected but contains nothing. Avoid this — it wastes a message slot.
- Returning `void` from the hook: same as omitting all fields.

---

## Hook-by-Hook Usage Guide

### onSessionStart — Foundational Rules

Fires once per session. Use this for persistent instructions the agent should follow throughout.

**Best for:**
- Team coding standards, style guides, architectural rules
- Environment descriptions (staging vs production, available services)
- Security policies the agent must respect
- Project-specific constraints

```js
onSessionStart: async (input) => {
  const rules = [
    "This is a TypeScript monorepo. All code must pass strict mode.",
    "Never use `any` type. Use `unknown` with type guards.",
    "Database migrations require a corresponding rollback script.",
    "All API endpoints require input validation with Zod schemas.",
    "Commits must follow Conventional Commits format.",
  ];
  return {
    additionalContext: rules.join("\n"),
  };
},
```

**Dynamic initial context based on session source:**

```js
onSessionStart: async (input) => {
  if (input.source === "resume") {
    return {
      additionalContext: "This is a resumed session. Check session history before taking action — work may already be in progress.",
    };
  }
  if (input.source === "startup") {
    return {
      additionalContext: "Fresh session. Start by reading the plan if one exists.",
    };
  }
},
```

**⚠️ Known Bug (pre-v1.0.11):** In CLI versions before v1.0.11, `additionalContext` from `onSessionStart` was silently dropped. Verify your CLI version with `copilot --version`.

### onUserPromptSubmitted — Per-Message Steering

Fires on every user message. Use this for context that should accompany every prompt.

**Best for:**
- Dynamic instructions that change based on time, branch, or environment
- Injecting current project state (open PRs, failing tests, active sprint)
- Persona or tone instructions
- Conditional rules based on what the user asked

```js
onUserPromptSubmitted: async (input) => {
  // Always inject current branch context
  const branch = await getCurrentBranch();
  const context = [`Current branch: ${branch}`];

  // Add protection rules for main/production branches
  if (branch === "main" || branch === "production") {
    context.push("PROTECTED BRANCH. Do not push directly. Create a PR instead.");
    context.push("Run the full test suite before proposing any changes.");
  }

  // Detect what the user is asking about
  if (/test/i.test(input.prompt)) {
    context.push("When writing tests, aim for >80% branch coverage. Use describe/it blocks. Mock external services.");
  }

  if (/refactor/i.test(input.prompt)) {
    context.push("Refactoring rules: no behavioral changes. Preserve all existing tests. Run tests after each file change.");
  }

  return { additionalContext: context.join("\n") };
},
```

**Token-conscious conditional injection:**

```js
onUserPromptSubmitted: async (input) => {
  // Only inject heavy context when relevant — don't waste tokens
  if (/database|migration|schema|sql/i.test(input.prompt)) {
    return {
      additionalContext: await readFile("docs/database-conventions.md", "utf-8"),
    };
  }
  if (/api|endpoint|route|handler/i.test(input.prompt)) {
    return {
      additionalContext: await readFile("docs/api-style-guide.md", "utf-8"),
    };
  }
  // No context needed for this prompt
},
```

### onPreToolUse — Just-in-Time Guidance Before Execution

Fires before every tool call. Use this to give the agent last-second instructions about how to use (or not use) a tool.

**Best for:**
- Tool-specific instructions the agent should follow
- Warnings about dangerous operations
- Context about the file or resource the tool is about to touch
- Supplementing a `deny` or `allow` decision with explanation

```js
onPreToolUse: async (input) => {
  // Add context when editing config files
  if ((input.toolName === "edit" || input.toolName === "create") &&
      /\.(env|config|ya?ml|json)$/i.test(String(input.toolArgs?.path || ""))) {
    return {
      additionalContext: "You are editing a configuration file. Double-check all values. Never hardcode secrets — use environment variable references. Validate the file format after editing.",
    };
  }

  // Add context when running shell commands
  if (input.toolName === "bash") {
    const cmd = String(input.toolArgs?.command || "");
    if (/docker/i.test(cmd)) {
      return {
        additionalContext: "Docker daemon runs as root. Verify image sources. Never use :latest in production. Check resource limits.",
      };
    }
    if (/git push/i.test(cmd)) {
      return {
        additionalContext: "Before pushing: verify you are on the correct branch, all tests pass, and there are no uncommitted changes.",
      };
    }
  }
},
```

**Combining with permission decisions:**

```js
onPreToolUse: async (input) => {
  if (input.toolName === "bash") {
    const cmd = String(input.toolArgs?.command || "");
    if (/curl.*-X\s*(POST|PUT|DELETE|PATCH)/i.test(cmd)) {
      return {
        permissionDecision: "ask",  // Let user decide
        additionalContext: "This command makes a mutating HTTP request. If the user approves, proceed carefully. If denied, suggest a read-only alternative (GET request or --dry-run).",
      };
    }
  }
},
```

**⚠️ Context budget warning:** If the agent calls 20 tools in a turn and you inject context on every call, that is 20 extra messages. Gate your injection — only return context when genuinely relevant.

### onPostToolUse — Reactive Context After Execution

Fires after every tool call completes. Use this to add analysis, warnings, or follow-up instructions based on what actually happened.

**Best for:**
- Interpreting tool results for the agent
- Running secondary checks (lint, type-check, security scan) and feeding results back
- Warning about patterns in the output (deprecation notices, error codes)
- Providing follow-up instructions based on tool outcome

```js
onPostToolUse: async (input) => {
  // After any file edit, run the linter and feed results to the agent
  if (input.toolName === "edit") {
    const filePath = String(input.toolArgs?.path || "");
    if (/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      const lintResult = await runLint(filePath);
      if (lintResult.errors > 0) {
        return {
          additionalContext: `Lint errors found in ${filePath}:\n${lintResult.output}\nFix these errors before moving on.`,
        };
      }
    }
  }

  // After a test run, add analysis context
  if (input.toolName === "bash" && /npm test|jest|vitest|pytest/i.test(String(input.toolArgs?.command || ""))) {
    const result = input.toolResult?.textResultForLlm || "";
    const failCount = (result.match(/FAIL/g) || []).length;
    if (failCount > 0) {
      return {
        additionalContext: `${failCount} test(s) failed. Analyze each failure individually. Fix the simplest failures first. Re-run the full suite after fixing all failures to check for regressions.`,
      };
    }
  }

  // After git operations, provide status context
  if (input.toolName === "bash" && /git\s+(commit|merge|rebase|cherry-pick)/i.test(String(input.toolArgs?.command || ""))) {
    if (input.toolResult?.resultType === "failure") {
      return {
        additionalContext: "The git operation failed. Check for merge conflicts, unstaged changes, or hook failures. Run `git status` to diagnose.",
      };
    }
  }
},
```

**Feeding structured analysis back:**

```js
onPostToolUse: async (input) => {
  if (input.toolName === "bash" && input.toolResult?.resultType === "success") {
    const output = input.toolResult.textResultForLlm || "";

    // Detect deprecation warnings the agent might ignore
    const deprecations = output.match(/deprecated|will be removed|no longer supported/gi);
    if (deprecations && deprecations.length > 0) {
      return {
        additionalContext: `⚠️ ${deprecations.length} deprecation warning(s) detected in the command output. Address these proactively — update to the recommended replacement.`,
      };
    }
  }
},
```

---

## Patterns and Recipes

### Pattern 1: Layered Context (Session + Per-Message + Per-Tool)

Use all three injection points together for progressively specific context:

```js
hooks: {
  onSessionStart: async () => ({
    // Broad, persistent rules
    additionalContext: "TypeScript monorepo. Strict mode. Conventional Commits. No `any` types.",
  }),

  onUserPromptSubmitted: async (input) => ({
    // Per-message dynamic state
    additionalContext: `Branch: ${await getBranch()}. Last CI: ${await getCIStatus()}.`,
  }),

  onPreToolUse: async (input) => {
    // Per-tool surgical guidance
    if (input.toolName === "edit" && String(input.toolArgs?.path).includes("migrations/")) {
      return { additionalContext: "Migration files are append-only. Never modify existing migrations. Create a new migration instead." };
    }
  },

  onPostToolUse: async (input) => {
    // Per-result reactive feedback
    if (input.toolName === "bash" && input.toolResult?.resultType === "failure") {
      return { additionalContext: "Command failed. Read the error output carefully. Propose a fix or alternative approach." };
    }
  },
},
```

### Pattern 2: Token-Conscious Injection

Track total injected context size to avoid blowing the context window:

```js
let totalInjectedChars = 0;
const MAX_INJECTED = 50_000; // rough char budget

function inject(text) {
  if (totalInjectedChars + text.length > MAX_INJECTED) {
    return undefined; // stop injecting — budget exhausted
  }
  totalInjectedChars += text.length;
  return text;
}

hooks: {
  onUserPromptSubmitted: async (input) => {
    const ctx = inject("Follow team coding standards. Use 4-space indentation.");
    return ctx ? { additionalContext: ctx } : undefined;
  },
  onPostToolUse: async (input) => {
    if (input.toolName === "edit") {
      const lint = await runLint(input.toolArgs?.path);
      if (lint.errors > 0) {
        const ctx = inject(`Lint errors:\n${lint.output}`);
        return ctx ? { additionalContext: ctx } : undefined;
      }
    }
  },
},
```

### Pattern 3: Conditional Context by File Type

Route different instructions based on what file is being touched:

```js
const FILE_RULES = {
  "\\.tsx?$": "TypeScript file. Ensure strict types, no `any`, named exports.",
  "\\.css$": "CSS file. Use CSS custom properties. No magic numbers. Check responsive breakpoints.",
  "\\.sql$": "SQL file. Use parameterized queries. Include IF NOT EXISTS guards. Comment complex joins.",
  "\\.ya?ml$": "YAML config. Validate indentation. Anchor repeated values with &/aliases.",
  "\\.md$": "Markdown file. Use ATX headers. One sentence per line for clean diffs.",
  "Dockerfile": "Dockerfile. Use multi-stage builds. Pin base image versions. Minimize layers.",
};

function getFileRules(filePath) {
  if (!filePath) return null;
  for (const [pattern, rules] of Object.entries(FILE_RULES)) {
    if (new RegExp(pattern, "i").test(filePath)) return rules;
  }
  return null;
}

hooks: {
  onPreToolUse: async (input) => {
    if (input.toolName === "edit" || input.toolName === "create") {
      const rules = getFileRules(String(input.toolArgs?.path || ""));
      if (rules) return { additionalContext: rules };
    }
  },
},
```

### Pattern 4: External Knowledge Injection

Load reference docs from disk when the agent enters a relevant domain:

```js
import { readFile } from "node:fs/promises";

const DOC_CACHE = new Map();

async function loadDoc(path) {
  if (!DOC_CACHE.has(path)) {
    try {
      DOC_CACHE.set(path, await readFile(path, "utf-8"));
    } catch {
      DOC_CACHE.set(path, null);
    }
  }
  return DOC_CACHE.get(path);
}

const TOPIC_DOCS = [
  { pattern: /auth|login|session|jwt|token/i, doc: "docs/auth-architecture.md" },
  { pattern: /payment|stripe|billing|invoice/i, doc: "docs/payment-integration.md" },
  { pattern: /deploy|ci|pipeline|release/i, doc: "docs/deployment-guide.md" },
];

hooks: {
  onUserPromptSubmitted: async (input) => {
    for (const { pattern, doc } of TOPIC_DOCS) {
      if (pattern.test(input.prompt)) {
        const content = await loadDoc(doc);
        if (content) {
          return { additionalContext: `Reference documentation for this topic:\n\n${content}` };
        }
      }
    }
  },
},
```

### Pattern 5: Aggregated Multi-Source Context

Collect context from multiple extensions via shared state, emit from one hook:

```js
// shared-context.mjs — imported by multiple extensions
const contextQueue = [];

export function enqueue(source, text) {
  contextQueue.push({ source, text, timestamp: Date.now() });
}

export function drain() {
  const items = contextQueue.splice(0);
  if (items.length === 0) return undefined;
  return items.map((i) => `[${i.source}] ${i.text}`).join("\n");
}
```

```js
// hooks-extension (the ONE extension that registers hooks)
import { drain } from "../shared-context.mjs";
import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  hooks: {
    onUserPromptSubmitted: async () => {
      const ctx = drain();
      return ctx ? { additionalContext: ctx } : undefined;
    },
  },
});
```

```js
// other-extension (contributes context without registering hooks)
import { enqueue } from "../shared-context.mjs";
import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession();

session.on("tool.execution_complete", (event) => {
  if (!event.data.success) {
    enqueue("error-tracker", `Tool ${event.data.toolName} failed. Consider alternative approach.`);
  }
});
```

---

## Anti-Patterns

### ❌ Injecting on Every Tool Call Unconditionally

```js
// BAD — injects on EVERY tool call, floods the context window
onPreToolUse: async () => ({
  additionalContext: "Remember to follow our coding standards and write tests.",
}),
```

This fires for every `view`, `grep`, `glob`, `bash`, `edit`, `create` — potentially hundreds of times per session. Each injection is a separate message that persists in conversation history.

**Fix:** Gate on tool name, file type, or command content. Only inject when the context is specifically relevant.

### ❌ Injecting Large Documents Every Time

```js
// BAD — injects the entire style guide on every user message
onUserPromptSubmitted: async () => ({
  additionalContext: await readFile("docs/style-guide.md", "utf-8"), // 15KB
}),
```

If the user sends 10 messages, that is 150KB of context consumed by the style guide alone.

**Fix:** Inject large docs once in `onSessionStart`, or conditionally when the user's message is relevant. Use `onUserPromptSubmitted` for short, dynamic context.

### ❌ Using additionalContext for User-Facing Messages

```js
// BAD — the user never sees this
onPostToolUse: async (input) => {
  if (input.toolResult?.resultType === "failure") {
    return {
      additionalContext: "⚠️ The command failed! Please check the output.",
    };
  }
},
```

This speaks to the agent, not the user. If you want to notify the user, use `session.log()`:

```js
await session.log("⚠️ The command failed!", { level: "warning" });
```

### ❌ Contradicting Other Output Fields

```js
// BAD — denies the tool but then tells the agent to proceed
return {
  permissionDecision: "deny",
  additionalContext: "Go ahead and run this command using a different approach.",
};
```

The agent sees both signals. It knows the tool was denied, but the context says to proceed. This creates confused behavior. Make your context consistent with your permission decision.

### ❌ Depending on additionalContext for Critical Security Gates

```js
// BAD — additionalContext is a suggestion, not an enforcement mechanism
onSessionStart: async () => ({
  additionalContext: "NEVER delete production databases.",
}),
```

The agent generally follows context, but it is an LLM — it can ignore instructions. For hard security boundaries, use `permissionDecision: "deny"` in `onPreToolUse` to actually block the operation.

---

## Comparison: additionalContext vs Alternatives

| Mechanism | Audience | Persistent | Blocks Actions | Use Case |
|-----------|----------|-----------|----------------|----------|
| `additionalContext` | Agent only | Yes (in conversation) | No | Steer agent behavior, inject knowledge |
| `modifiedPrompt` | Agent only | Yes (replaces original) | No | Rewrite what the user asked |
| `modifiedArgs` | Agent only | No (one tool call) | No | Fix tool arguments before execution |
| `modifiedResult` | Agent only | Yes (replaces original) | No | Redact or enhance tool output |
| `permissionDecision` | System | No | Yes (`deny`) | Hard-block dangerous operations |
| `permissionDecisionReason` | User | No | No | Explain to user why blocked |
| `session.log()` | User | Optional | No | Show status messages in terminal |
| `session.send()` | Agent | Yes | No | Inject a full new user turn |
| `userNotification` | User | No | No | Show error info to user |

### additionalContext vs session.send()

Both inject content the agent sees. The difference:

- **`additionalContext`** is a lightweight annotation attached to the current turn. It rides alongside whatever triggered the hook.
- **`session.send()`** creates an entirely new user turn. The agent will process it as a separate message and produce a separate response. Use this for follow-up instructions that should trigger a new agent action, not for passive context.

### additionalContext vs System Prompt Customization

`additionalContext` is per-hook, per-event, dynamic. System prompt customization (via `CopilotClient` in standalone mode) is session-wide, static, and modifies the foundational system prompt. Use system prompt customization for identity, tone, and permanent rules. Use `additionalContext` for dynamic, contextual guidance.
