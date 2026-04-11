---
name: copilot-cli-extensions
description: Build Copilot CLI extensions — custom tools, lifecycle hooks, event subscriptions, UI elicitation, and programmatic messaging using the @github/copilot-sdk. Use when users want to create an extension, add custom tools to Copilot, intercept tool calls, block dangerous commands, inject context, auto-retry errors, scaffold extension files, register hooks, listen to session events, build security shields, lint-on-edit workflows, auto-openers, test enforcers, architecture guards, deployment gates, REPL loops, self-healing agents, or extend the Copilot CLI agent harness. Also covers extension gotchas, debugging, hot-reload, slash commands, system prompt customization, and the standalone SDK (CopilotClient).
---

# Copilot CLI Extensions

A skill for building extensions that give the Copilot CLI agent new tools, intercept its actions, and react to session events — all from a single `.mjs` file.

## What Extensions Are

Extensions are Node.js child processes that communicate with the CLI over JSON-RPC via stdio. They are **not** MCP servers. They are **not** GitHub App-based Copilot Extensions. They are local `.mjs` files that attach to the running CLI session and participate in the agent loop.

```
┌─────────────────────┐      JSON-RPC / stdio       ┌──────────────────────┐
│   Copilot CLI        │ ◄──────────────────────────► │  Extension Process   │
│   (parent process)   │   tool calls, events, hooks  │  (forked child)      │
│                      │                               │                      │
│  • Discovers exts    │                               │  • Registers tools   │
│  • Forks processes   │                               │  • Registers hooks   │
│  • Routes tool calls │                               │  • Listens to events │
│  • Manages lifecycle │                               │  • Uses SDK APIs     │
└─────────────────────┘                               └──────────────────────┘
```

### Lifecycle

1. **Discovery** — CLI scans `.github/extensions/` (project-scoped) and `~/.copilot/extensions/` (user-scoped) for subdirectories containing `extension.mjs`.
2. **Launch** — Each extension is forked as a child process. `@github/copilot-sdk` is resolved automatically — never `npm install` it.
3. **Connection** — The extension calls `joinSession()`, establishing JSON-RPC over stdio.
4. **Registration** — Tools and hooks declared in session options become available to the agent immediately.
5. **Lifecycle** — Extensions reload on `/clear` or `extensions_reload`. Stopped on CLI exit (SIGTERM, then SIGKILL after 5s).

Project extensions in `.github/extensions/` shadow user extensions on name collision.

### File structure

```
.github/extensions/
  my-extension/
    extension.mjs      ← Entry point (required, must be .mjs)
```

Only `.mjs` is supported. No TypeScript. The file **must** be named `extension.mjs`.

---

## Minimal Extension

```js
import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  tools: [],
  hooks: {},
});
```

Three meaningful lines. The `session` object that comes back is the entire API surface.

---

## Registering Custom Tools

Tools are functions the agent can call. Define them with a name, description, JSON Schema parameters, and a handler.

```js
tools: [
  {
    name: "tool_name",
    description: "What it does — shown to the agent",
    parameters: {
      type: "object",
      properties: {
        arg1: { type: "string", description: "..." },
      },
      required: ["arg1"],
    },
    handler: async (args, invocation) => {
      // args: parsed arguments matching the schema
      // invocation.sessionId: current session ID
      // invocation.toolCallId: unique call ID
      // invocation.toolName: this tool's name
      return `Result: ${args.arg1}`;
    },
  },
]
```

### Constraints

- Tool names must be **globally unique** across ALL loaded extensions. Collisions cause the second extension to fail.
- Handler returns a **string** (success) or a **structured object**: `{ textResultForLlm, resultType, binaryResultsForLlm?, error?, sessionLog?, toolTelemetry? }`.
- `resultType` values: `"success"`, `"failure"`, `"rejected"`, `"denied"`, `"timeout"`.
- Use `session.log()` to surface messages. **Never use `console.log()`** — stdout is reserved for JSON-RPC.
- Use a naming prefix per extension to prevent collisions (e.g., `myext_tool_name`).

### skipPermission — Trusted Tools

By default, custom tools trigger a user permission prompt. For read-only or low-risk tools, set `skipPermission: true`:

```js
{
  name: "read_config",
  description: "Read project config files",
  skipPermission: true,
  // ...
}
```

### overridesBuiltInTool

Set `overridesBuiltInTool: true` to intentionally replace a built-in tool of the same name. Without this flag, name clashes with built-in tools return an error.

---

## The Six Hooks

Hooks intercept the agent at lifecycle points. Each hook receives structured input and returns structured output. All inputs include `timestamp` (unix ms) and `cwd`. All handlers receive `(input, invocation)` where `invocation` has `{ sessionId }`.

### onSessionStart

Fires when a session begins. Inject baseline context.

**Input:** `{ source: "startup" | "resume" | "new", initialPrompt?, timestamp, cwd }`

**Output (all optional):**
| Field | Type | Effect |
|-------|------|--------|
| `additionalContext` | `string` | Injected as initial context |
| `modifiedConfig` | `Record<string, unknown>` | Modify session config |

### onUserPromptSubmitted

Fires before the agent sees the user's message. Rewrite, augment, or inject hidden context.

**Input:** `{ prompt, timestamp, cwd }`

**Output (all optional):**
| Field | Type | Effect |
|-------|------|--------|
| `modifiedPrompt` | `string` | Replaces the user's prompt |
| `additionalContext` | `string` | Hidden context the agent sees |
| `suppressOutput` | `boolean` | Suppress hook output display |

### onPreToolUse

Fires before every tool execution. The most powerful hook — block, allow, modify, or inject.

**Input:** `{ toolName, toolArgs, timestamp, cwd }`

**Output (all optional):**
| Field | Type | Effect |
|-------|------|--------|
| `permissionDecision` | `"allow" \| "deny" \| "ask"` | Override permission check |
| `permissionDecisionReason` | `string` | Shown if denied |
| `modifiedArgs` | `unknown` | Replaces tool arguments |
| `additionalContext` | `string` | Injected into conversation |
| `suppressOutput` | `boolean` | Suppress hook output display |

### onPostToolUse

Fires after every tool completes. Run linters, open files in editor, inject feedback.

**Input:** `{ toolName, toolArgs, toolResult: ToolResultObject, timestamp, cwd }`

**Output (all optional):**
| Field | Type | Effect |
|-------|------|--------|
| `modifiedResult` | `ToolResultObject` | Replaces tool result |
| `additionalContext` | `string` | Injected into conversation |
| `suppressOutput` | `boolean` | Suppress hook output display |

### onErrorOccurred

Automatic error recovery. Decide whether to retry, skip, or abort.

**Input:** `{ error, errorContext: "model_call" | "tool_execution" | "system" | "user_input", recoverable, timestamp, cwd }`

**Output (all optional):**
| Field | Type | Effect |
|-------|------|--------|
| `errorHandling` | `"retry" \| "skip" \| "abort"` | Recovery strategy |
| `retryCount` | `number` | Max retries (with `"retry"`) |
| `userNotification` | `string` | Message shown to user |
| `suppressOutput` | `boolean` | Suppress hook output display |

### onSessionEnd

Fires when the session ends. Generate summaries, log metrics, clean up.

**Input:** `{ reason: "complete" | "error" | "abort" | "timeout" | "user_exit", finalMessage?, error?, timestamp, cwd }`

**Output (all optional):**
| Field | Type | Effect |
|-------|------|--------|
| `sessionSummary` | `string` | Summary for persistence |
| `cleanupActions` | `string[]` | Cleanup descriptions |
| `suppressOutput` | `boolean` | Suppress hook output display |

---

## Session Events

Hooks are for **control**. Events are for **observation**. Subscribe with `session.on()`.

### Subscribing

```js
// Specific event type
const unsub = session.on("tool.execution_complete", (event) => {
  // event.data.toolName, event.data.success, event.data.result
});

// All events (wildcard)
session.on((event) => {
  console.error(`[${event.type}] ${JSON.stringify(event.data).substring(0, 200)}`);
});

// Unsubscribe
unsub();
```

### Complete Event Catalog

The actual event types from the v1.0.24 SDK (many more than the article lists):

**Core agent events:**
| Event | Key Data Fields |
|-------|----------------|
| `assistant.message` | `content`, `messageId`, `toolRequests` |
| `assistant.turn_start` | `turnId` |
| `assistant.turn_end` | — |
| `assistant.streaming_delta` | `totalResponseSizeBytes` (ephemeral) |
| `assistant.intent` | Agent's current intent |
| `assistant.reasoning` | Reasoning content |
| `assistant.usage` | Token usage stats |

**Tool events:**
| Event | Key Data Fields |
|-------|----------------|
| `tool.execution_start` | `toolCallId`, `toolName`, `arguments` |
| `tool.execution_complete` | `toolCallId`, `toolName`, `success`, `result`, `error` |
| `tool.execution_progress` | Progress updates during execution |
| `tool.execution_partial_result` | Partial results during execution |
| `tool.user_requested` | User explicitly requested a tool |

**User and permission events:**
| Event | Key Data Fields |
|-------|----------------|
| `user.message` | `content`, `attachments`, `source` |
| `permission.requested` | `requestId`, `permissionRequest.kind` |
| `permission.completed` | Permission decision result |
| `user_input.requested` | Agent asking user a question |
| `user_input.completed` | User's answer |

**Session lifecycle:**
| Event | Key Data Fields |
|-------|----------------|
| `session.start` | `sessionId`, `version`, `context` |
| `session.resume` | `resumeTime`, `eventCount` |
| `session.idle` | `backgroundTasks` |
| `session.error` | `errorType`, `message`, `stack` |
| `session.shutdown` | `shutdownType`, `totalPremiumRequests`, `codeChanges` |
| `session.mode_changed` | Mode change info |
| `session.model_change` | Model switch info |
| `session.plan_changed` | Plan file updated |
| `session.compaction_start` | Context compaction beginning |
| `session.compaction_complete` | Context compaction done |
| `session.extensions_loaded` | Extensions discovered and loaded |
| `session.skills_loaded` | Skills loaded |
| `session.mcp_servers_loaded` | MCP servers initialized |
| `session.tools_updated` | Available tools changed |
| `session.context_changed` | Session context changed |
| `session.truncation` | Context truncation occurred |

**Subagent and task events:**
| Event | Key Data Fields |
|-------|----------------|
| `subagent.started` | Subagent launched |
| `subagent.completed` | Subagent finished |
| `subagent.failed` | Subagent errored |
| `subagent.selected` | Subagent selected |
| `subagent.deselected` | Subagent deselected |
| `session.task_complete` | Background task done |

**Other events:**
| Event | Key Data Fields |
|-------|----------------|
| `hook.start` | Hook invocation beginning |
| `hook.end` | Hook invocation completed |
| `elicitation.requested` | UI form requested |
| `elicitation.completed` | UI form completed |
| `skill.invoked` | A skill was triggered |
| `command.execute` | Slash command executed |
| `command.completed` | Slash command finished |
| `system.message` | System message |
| `system.notification` | System notification |
| `session.warning` | Warning message |
| `session.info` | Info message |

---

## Session API

The `session` object from `joinSession()` is a live API into the session.

### session.send(options)

Fire-and-forget message:
```js
await session.send({ prompt: "Run the test suite." });
await session.send({
  prompt: "Review this file",
  attachments: [{ type: "file", path: "./src/index.ts" }],
});
```

### session.sendAndWait(options, timeout?)

Send and block until the agent finishes (resolves on `session.idle`):
```js
const response = await session.sendAndWait({ prompt: "What is 2+2?" });
// response?.data.content contains the agent's reply
```
Default timeout: 60000ms. Does not abort in-flight agent work.

### session.log(message, options?)

Log to the CLI timeline:
```js
await session.log("Extension ready");
await session.log("Rate limit approaching", { level: "warning" });
await session.log("Connection failed", { level: "error" });
await session.log("Processing...", { ephemeral: true }); // transient, not persisted
```

### session.abort()

Cancel a long-running request. The session remains valid for new messages.

### session.setModel(model, options?)

Change the model mid-session:
```js
await session.setModel("gpt-5.4");
await session.setModel("claude-sonnet-4.6", { reasoningEffort: "high" });
```

### session.getMessages()

Retrieve the complete conversation history as an array of session events.

### session.workspacePath

Path to the session workspace directory (`~/.copilot/session-state/<id>`). Contains `checkpoints/`, `plan.md`, `files/`. Undefined if infinite sessions are disabled.

### session.capabilities

Host capabilities. Check `session.capabilities.ui?.elicitation` before using UI methods.

### session.rpc

Low-level typed RPC access to all session APIs (model, mode, plan, workspace, agent, etc.).

---

## UI Elicitation — Structured Dialogs

Present structured forms to the user instead of parsing free-text answers. Uses JSON Schema — the same format as the agent's `ask_user` tool.

### Raw elicitation

```js
const result = await session.rpc.ui.elicitation({
  message: "Deploy to production?",
  requestedSchema: {
    type: "object",
    properties: {
      environment: {
        type: "string",
        title: "Target Environment",
        enum: ["staging", "production"],
        default: "staging",
      },
      description: {
        type: "string",
        title: "Change description",
      },
    },
  },
});
// result.action: "accept" | "decline" | "cancel"
// result.content: { environment: "production", description: "..." }
```

### Convenience methods via session.ui

```js
if (session.capabilities.ui?.elicitation) {
  const ok = await session.ui.confirm("Deploy to production?");
  const env = await session.ui.select("Target?", ["staging", "production"]);
  const name = await session.ui.input("Project name?", { default: "my-app" });
}
```

---

## Permission and Input Handlers

### Custom permission logic

```js
const session = await joinSession({
  onPermissionRequest: async (request) => {
    if (request.kind === "shell") {
      const cmd = request.fullCommandText || "";
      if (/^(cat|ls|find|grep|git\s+(status|log|diff))\b/.test(cmd)) {
        return { kind: "approved" };
      }
      if (/\b(rm|del|format|mkfs)\b/.test(cmd)) {
        return { kind: "denied-by-rules" };
      }
      return { kind: "ask-user" };
    }
    return { kind: "approved" };
  },
});
```

Permission kinds: `"shell"`, `"write"`, `"mcp"`, `"read"`, `"url"`, `"custom-tool"`.

Return values: `"approved"`, `"denied-by-rules"`, `"ask-user"`.

### Handling ask_user programmatically

```js
const session = await joinSession({
  onUserInputRequest: async (request) => {
    // request.question, request.choices, request.allowFreeform
    return { answer: "yes", wasFreeform: false };
  },
});
```

Critical for headless CI environments where no human is at the terminal.

---

## Slash Commands

Extensions can register custom slash commands:

```js
const session = await joinSession({
  commands: [
    {
      name: "deploy",
      description: "Deploy to the configured environment",
      handler: async (context) => {
        // context.sessionId, context.command, context.commandName, context.args
        await session.send({ prompt: `Deploy with args: ${context.args}` });
      },
    },
  ],
});
```

The command appears as `/deploy` in the CLI's command list.

---

## System Prompt Customization

Extensions using the standalone SDK (`CopilotClient`) can customize the system prompt in three modes:

### Append mode (default)
```js
systemMessage: {
  mode: "append",
  content: "Additional instructions appended after SDK sections."
}
```

### Replace mode
```js
systemMessage: {
  mode: "replace",
  content: "Complete system message. Removes all SDK guardrails."
}
```

### Customize mode — section-level overrides
```js
systemMessage: {
  mode: "customize",
  sections: {
    tone: { action: "replace", content: "Be terse and direct." },
    safety: { action: "remove" },
    guidelines: { action: "append", content: "\nAlways write tests." },
    identity: { action: "prepend", content: "You are a security expert.\n" },
    tool_instructions: {
      action: (currentContent) => currentContent.replace(/foo/g, "bar"),
    },
  },
}
```

Section IDs: `identity`, `tone`, `tool_efficiency`, `environment_context`, `code_change_rules`, `guidelines`, `safety`, `tool_instructions`, `custom_instructions`, `last_instructions`.

Actions: `"replace"`, `"remove"`, `"append"`, `"prepend"`, or a `(currentContent) => newContent` transform function.

---

## Hot Reload Workflow

1. Tell the CLI to create an extension (or create it yourself).
2. CLI scaffolds `.github/extensions/<name>/extension.mjs`.
3. Call `extensions_reload` — the new tool is available instantly. No restart.
4. Verify with `extensions_manage({ operation: "list" })`.

The scaffolding command: `extensions_manage({ operation: "scaffold", name: "my-extension" })`.
For user-scoped: add `location: "user"`.

---

## Extension Management

### CLI slash commands

```
/extensions list           — Show all installed extensions and their status
/extensions enable <name>  — Enable a specific extension
/extensions disable <name> — Disable without removing files
/extensions reload         — Hot-reload all active extensions
/extensions info <name>    — Show registered tools, hooks, commands
```

### Programmatic (from agent)

```
extensions_manage({ operation: "list" })
extensions_manage({ operation: "inspect", name: "my-extension" })
extensions_manage({ operation: "scaffold", name: "my-extension" })
extensions_reload({})
```

---

## The Standalone SDK — CopilotClient

Beyond `.github/extensions/`, the same SDK has a **standalone mode** for embedding Copilot in your own applications. Available in **four languages**:

| Language | Install | Entry Point |
|----------|---------|-------------|
| JavaScript/Node.js | `npm install @github/copilot-sdk` | `new CopilotClient()` |
| Python | `pip install github-copilot-sdk` | `CopilotClient()` |
| Go | `go get github.com/github/copilot-sdk/go` | `copilot.NewClient()` |
| .NET | `dotnet add package GitHub.Copilot.SDK` | `new CopilotClient()` |

**Important:** Multi-language SDKs use `CopilotClient` to spawn/connect to a CLI server process. This is different from `.github/extensions/` which must be `.mjs` using `joinSession()`. The concepts (tools, hooks, events) are identical — just a different entry point.

### CopilotClient key methods

- `client.createSession(config)` — Create a new conversation session
- `client.resumeSession(sessionId, config)` — Resume an existing session
- `client.listSessions(filter?)` — List all sessions (filter by cwd, repo, branch)
- `client.getSessionMetadata(sessionId)` — O(1) session lookup
- `client.deleteSession(sessionId)` — Permanently delete session and all data
- `client.listModels()` — List available models with capabilities
- `client.getAuthStatus()` — Check authentication state
- `client.ping()` — Verify connectivity
- `client.stop()` / `client.forceStop()` — Graceful/forced shutdown

### Connection modes

- **stdio** (default): `new CopilotClient()` — spawns CLI process, communicates via pipes
- **TCP**: `new CopilotClient({ cliUrl: "localhost:3000" })` — connects to existing server
- **External CLI**: `new CopilotClient({ cliPath: "/usr/local/bin/copilot" })`

### BYOK — Bring Your Own Key

```js
const session = await client.createSession({
  provider: {
    type: "openai",       // "openai" | "azure" | "anthropic"
    baseUrl: "http://localhost:11434/v1",
    apiKey: "sk-...",     // optional for local providers
    wireApi: "completions", // "completions" | "responses"
  },
  model: "deepseek-coder-v2:16b",
  onPermissionRequest: approveAll,
});
```

---

## Known Bugs and Workarounds

### Hook overwrite bug (CRITICAL)

If multiple extensions register hooks, only the **last-loaded** extension's hooks fire. Others are silently overwritten.

**Workaround:** Designate ONE extension as your "hooks extension." All other extensions use tools and `session.on()` event listeners instead.

### onSessionStart additionalContext dropped (pre-v1.0.11)

In CLI versions before v1.0.11, `additionalContext` from `onSessionStart` was silently ignored.

**Workaround:** Update to v1.0.11+. Or move startup context to `onUserPromptSubmitted`.

### Extension load order is undefined

The order extensions are discovered from `.github/extensions/` is not guaranteed. Combined with the hook overwrite bug, which hooks fire can change between sessions.

**Workaround:** Don't rely on load order. Use the one-hooks-extension pattern.

### Other gotchas

- **stdout is reserved for JSON-RPC.** Use `session.log()`, never `console.log()`. Writing to stdout corrupts the protocol.
- **Don't call `session.send()` synchronously from `onUserPromptSubmitted`.** Use `setTimeout(() => session.send(...), 0)` to avoid infinite loops.
- **State resets on `/clear`.** Extensions reload — all in-memory state is lost.
- **Only `.mjs` is supported.** No TypeScript compilation yet.
- **Tool name collisions are silent until load.** No warning until the second extension tries to register.

---

## Plugins — Extension Distribution

The CLI has a plugin system for distributing extensions:

```
copilot plugin install <source>     — Install from GitHub repo or marketplace
copilot plugin list                 — List installed plugins
copilot plugin uninstall <name>     — Remove a plugin
copilot plugin update <name>        — Update a plugin
copilot plugin marketplace browse   — Discover available plugins
```

Two default marketplaces: `copilot-plugins` (github/copilot-plugins) and `awesome-copilot` (github/awesome-copilot). Plugins can bundle skills, agents, hooks, MCP servers, and LSP servers.

---

## Pattern Recipes

### Self-healing REPL loop

Listen for `session.idle`, run validation, send failures back:

```js
session.on("session.idle", async () => {
  const result = await runTests();
  if (!result.success) {
    await session.send({
      prompt: `Tests failed:\n${result.output}\nFix the failures.`,
    });
  }
});
```

### Security shield

```js
hooks: {
  onSessionStart: async () => ({
    additionalContext: "Never hardcode secrets. Use environment variables.",
  }),
  onPreToolUse: async (input) => {
    if (input.toolName === "bash") {
      const cmd = String(input.toolArgs?.command || "");
      if (/rm\s+-rf\s+\//i.test(cmd)) {
        return { permissionDecision: "deny", permissionDecisionReason: "Destructive command blocked." };
      }
    }
    if (input.toolName === "edit" || input.toolName === "create") {
      const content = String(input.toolArgs?.file_text || input.toolArgs?.new_str || "");
      if (/(?:api[_-]?key|secret|password)\s*[:=]\s*["'][^"']+["']/i.test(content)) {
        return { permissionDecision: "deny", permissionDecisionReason: "Hardcoded secret detected." };
      }
    }
  },
}
```

### Lint on every edit

```js
import { exec } from "node:child_process";

hooks: {
  onPostToolUse: async (input) => {
    if (input.toolName === "edit" && input.toolArgs?.path?.endsWith(".ts")) {
      const result = await new Promise((resolve) => {
        exec(`npx eslint "${input.toolArgs.path}"`, (err, stdout) => {
          resolve(err ? stdout : null);
        });
      });
      if (result) {
        return { additionalContext: `Lint errors:\n${result}\nFix before proceeding.` };
      }
    }
  },
}
```

### Auto-open edited files in IDE

```js
import { exec } from "node:child_process";

hooks: {
  onPostToolUse: async (input) => {
    if (input.toolName === "create" || input.toolName === "edit") {
      const filePath = input.toolArgs?.path;
      if (filePath) exec(`code "${filePath}"`, () => {});
    }
  },
}
```

### Detect user file edits (not agent edits)

Track agent edits via events, then use `fs.watch` to detect user-initiated changes:

```js
import { watch, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";

const agentPaths = new Set();

session.on("tool.execution_start", (event) => {
  if (event.data.toolName === "edit" || event.data.toolName === "create") {
    agentPaths.add(resolve(String(event.data.arguments?.path || "")));
  }
});
session.on("tool.execution_complete", () => {
  setTimeout(() => agentPaths.clear(), 3000);
});

const cwd = process.cwd();
watch(cwd, { recursive: true }, (eventType, filename) => {
  if (!filename || eventType !== "change") return;
  const fullPath = join(cwd, filename);
  if (agentPaths.has(resolve(fullPath))) return;
  try { if (!statSync(fullPath).isFile()) return; } catch { return; }
  session.send({
    prompt: `The user edited \`${relative(cwd, fullPath)}\`.`,
    attachments: [{ type: "file", path: fullPath }],
  });
});
```

---

## When Building an Extension

1. **Start with `extensions_manage({ operation: "scaffold", name: "..." })`** to get the skeleton.
2. **Edit the generated `extension.mjs`** — add tools, hooks, events.
3. **Call `extensions_reload()`** — the extension is live immediately.
4. **Verify with `extensions_manage({ operation: "list" })`** — check it loaded without errors.
5. **If hooks are needed, use only ONE extension for all hooks** due to the overwrite bug.
6. **Use `session.on()` events** in all other extensions for observation.
7. **Test with `/extensions info <name>`** to confirm what was registered.
8. **Use `session.log()` for all output** — never `console.log()`.

---

## SDK Type Reference

For full type information, read the `.d.ts` files in the SDK package. Key files:

- `index.d.ts` — Exports and top-level types
- `types.d.ts` — All type definitions (Tool, SessionHooks, PermissionRequest, SessionConfig, etc.)
- `session.d.ts` — CopilotSession class with all methods
- `client.d.ts` — CopilotClient class for standalone mode
- `extension.d.ts` — `joinSession()` function signature
- `generated/session-events.d.ts` — Complete session event type union (70+ event types)
- `generated/rpc.d.ts` — RPC method signatures

The SDK package location on this system: `~/.cache/copilot/pkg/universal/<version>/copilot-sdk/`
