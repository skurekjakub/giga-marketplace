# Complete Extension Examples

Production-ready examples covering the full extension API surface.

## 1. Multi-Feature Extension — Tools + Hooks + Events

An extension that combines custom tools, lifecycle hooks, and event subscriptions.

```js
import { execFile, exec } from "node:child_process";
import { joinSession } from "@github/copilot-sdk/extension";

const isWindows = process.platform === "win32";
let copyNextResponse = false;

function copyToClipboard(text) {
  const proc = execFile(isWindows ? "clip" : "xclip", isWindows ? [] : ["-selection", "clipboard"], () => {});
  proc.stdin.write(text);
  proc.stdin.end();
}

function openInEditor(filePath) {
  if (isWindows) exec(`code "${filePath}"`, () => {});
  else execFile("code", [filePath], () => {});
}

const session = await joinSession({
  hooks: {
    onUserPromptSubmitted: async (input) => {
      if (/\bcopy this\b/i.test(input.prompt)) {
        copyNextResponse = true;
      }
      return {
        additionalContext: "Follow our team style guide. Use 4-space indentation.",
      };
    },
    onPreToolUse: async (input) => {
      if (input.toolName === "bash") {
        const cmd = String(input.toolArgs?.command || "");
        if (/rm\s+-rf\s+\//i.test(cmd)) {
          return {
            permissionDecision: "deny",
            permissionDecisionReason: "Destructive commands blocked by policy.",
          };
        }
      }
    },
    onPostToolUse: async (input) => {
      if (input.toolName === "create" || input.toolName === "edit") {
        const filePath = input.toolArgs?.path;
        if (filePath) openInEditor(filePath);
      }
    },
    onErrorOccurred: async (input) => {
      if (input.recoverable && input.errorContext === "tool_execution") {
        return { errorHandling: "retry", retryCount: 2 };
      }
      return { errorHandling: "abort", userNotification: `Error: ${input.error}` };
    },
  },
  tools: [
    {
      name: "copy_to_clipboard",
      description: "Copies text to the system clipboard.",
      skipPermission: true,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to copy" },
        },
        required: ["text"],
      },
      handler: async (args) => {
        return new Promise((resolve) => {
          const cmd = isWindows ? "clip" : "xclip";
          const cmdArgs = isWindows ? [] : ["-selection", "clipboard"];
          const proc = execFile(cmd, cmdArgs, (err) => {
            if (err) resolve(`Error: ${err.message}`);
            else resolve("Copied to clipboard.");
          });
          proc.stdin.write(args.text);
          proc.stdin.end();
        });
      },
    },
  ],
});

session.on("assistant.message", (event) => {
  if (copyNextResponse) {
    copyNextResponse = false;
    copyToClipboard(event.data.content);
  }
});

session.on("tool.execution_complete", (event) => {
  const status = event.data.success ? "✓" : "✗";
  session.log(`[${status}] ${event.data.toolName}`, { ephemeral: true });
});
```

---

## 2. GitHub PR Creator with UTF-8 Encoding

Handles PowerShell's backtick-mangling by writing to temp files.

```js
import { execFile } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { joinSession } from "@github/copilot-sdk/extension";

function tempFile(content) {
  const name = join(tmpdir(), `gh-pr-${randomBytes(6).toString("hex")}.md`);
  writeFileSync(name, content, "utf-8");
  return name;
}

function gh(args) {
  return new Promise((resolve) => {
    execFile("gh", args, { encoding: "utf-8" }, (err, stdout, stderr) => {
      if (err) resolve({ textResultForLlm: stderr || err.message, resultType: "failure" });
      else resolve(stdout.trim());
    });
  });
}

const session = await joinSession({
  tools: [
    {
      name: "create_pr",
      description: "Create a GitHub PR with proper UTF-8 encoding.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "PR title" },
          body: { type: "string", description: "PR body in Markdown" },
        },
        required: ["title", "body"],
      },
      handler: async (args) => {
        const bodyFile = tempFile(args.body);
        try {
          return await gh(["pr", "create", "--title", args.title, "--body-file", bodyFile]);
        } finally {
          try { unlinkSync(bodyFile); } catch {}
        }
      },
    },
  ],
});
```

---

## 3. Test Enforcer

Blocks `git commit` if source files were modified without touching corresponding test files.

```js
import { execFile } from "node:child_process";
import { joinSession } from "@github/copilot-sdk/extension";

const modifiedSources = new Set();
const modifiedTests = new Set();

function isTestFile(path) {
  return /\.(test|spec)\.(js|ts|jsx|tsx|mjs)$/.test(path) || path.includes("__tests__/");
}

function sourceToTestPattern(path) {
  return path.replace(/\.(js|ts|jsx|tsx|mjs)$/, "").replace(/^src\//, "");
}

const session = await joinSession({
  hooks: {
    onPostToolUse: async (input) => {
      if (input.toolName === "edit" || input.toolName === "create") {
        const path = input.toolArgs?.path;
        if (!path) return;
        if (isTestFile(path)) {
          modifiedTests.add(sourceToTestPattern(path));
        } else if (/\.(js|ts|jsx|tsx|mjs)$/.test(path)) {
          modifiedSources.add(sourceToTestPattern(path));
        }
      }
    },
    onPreToolUse: async (input) => {
      if (input.toolName === "bash") {
        const cmd = String(input.toolArgs?.command || "");
        if (/git\s+commit/i.test(cmd)) {
          const untestedSources = [...modifiedSources].filter(
            (s) => ![...modifiedTests].some((t) => t.includes(s))
          );
          if (untestedSources.length > 0) {
            return {
              permissionDecision: "deny",
              permissionDecisionReason:
                `Source files modified without corresponding tests:\n` +
                untestedSources.map((s) => `  - ${s}`).join("\n") +
                `\nWrite tests before committing.`,
            };
          }
        }
      }
    },
  },
  tools: [],
});
```

---

## 4. Session Metrics Logger

Tracks tool execution counts, durations, and error rates across the session.

```js
import { joinSession } from "@github/copilot-sdk/extension";

const metrics = {
  toolCalls: {},
  errors: 0,
  totalDuration: 0,
  startTime: Date.now(),
};

const inFlight = new Map();

const session = await joinSession({
  hooks: {
    onSessionEnd: async (input) => {
      const elapsed = ((Date.now() - metrics.startTime) / 1000).toFixed(1);
      const summary = Object.entries(metrics.toolCalls)
        .sort(([, a], [, b]) => b.count - a.count)
        .map(([name, data]) => `  ${name}: ${data.count} calls, ${data.errors} errors`)
        .join("\n");
      return {
        sessionSummary:
          `Session ran ${elapsed}s. ${metrics.errors} total errors.\n` +
          `Tool breakdown:\n${summary}`,
      };
    },
  },
  tools: [],
});

session.on("tool.execution_start", (event) => {
  inFlight.set(event.data.toolCallId, Date.now());
});

session.on("tool.execution_complete", (event) => {
  const name = event.data.toolName;
  if (!metrics.toolCalls[name]) {
    metrics.toolCalls[name] = { count: 0, errors: 0, totalMs: 0 };
  }
  metrics.toolCalls[name].count++;
  if (!event.data.success) {
    metrics.toolCalls[name].errors++;
    metrics.errors++;
  }
  const startTime = inFlight.get(event.data.toolCallId);
  if (startTime) {
    metrics.toolCalls[name].totalMs += Date.now() - startTime;
    inFlight.delete(event.data.toolCallId);
  }
});
```

---

## 5. Deployment Gate with UI Elicitation

Intercepts deployment commands and presents a structured confirmation dialog.

```js
import { execFile } from "node:child_process";
import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  hooks: {
    onPreToolUse: async (input) => {
      if (input.toolName === "bash") {
        const cmd = String(input.toolArgs?.command || "");
        if (/deploy|kubectl apply|terraform apply/i.test(cmd)) {
          if (!session.capabilities.ui?.elicitation) {
            return { permissionDecision: "ask" };
          }
          const result = await session.ui.elicitation({
            message: "Deployment detected. Please confirm.",
            requestedSchema: {
              type: "object",
              properties: {
                environment: {
                  type: "string",
                  title: "Target Environment",
                  enum: ["dev", "staging", "production"],
                  default: "dev",
                },
                confirm: {
                  type: "boolean",
                  title: "I understand this will affect live systems",
                  default: false,
                },
              },
              required: ["environment", "confirm"],
            },
          });
          if (result.action !== "accept" || !result.content?.confirm) {
            return {
              permissionDecision: "deny",
              permissionDecisionReason: "Deployment not confirmed by user.",
            };
          }
          if (result.content.environment === "production") {
            await session.log("⚠️ PRODUCTION deployment confirmed", { level: "warning" });
          }
          return { permissionDecision: "allow" };
        }
      }
    },
  },
  tools: [],
});
```

---

## 6. Architecture Boundary Enforcer

Validates import boundaries on every file write. Blocks violations before code hits CI.

```js
import { readFileSync } from "node:fs";
import { joinSession } from "@github/copilot-sdk/extension";

// Define layer rules: key can import from values, nothing else
const LAYER_RULES = {
  "src/ui/": ["src/ui/", "src/domain/", "src/shared/"],
  "src/domain/": ["src/domain/", "src/shared/"],
  "src/infra/": ["src/infra/", "src/domain/", "src/shared/"],
  "src/shared/": ["src/shared/"],
};

function checkImports(filePath, content) {
  const layer = Object.keys(LAYER_RULES).find((l) => filePath.includes(l));
  if (!layer) return null;
  const allowed = LAYER_RULES[layer];
  const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  const violations = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const target = match[1];
    if (!target.startsWith("src/")) continue;
    const targetLayer = Object.keys(LAYER_RULES).find((l) => target.includes(l));
    if (targetLayer && !allowed.includes(targetLayer)) {
      violations.push(`${layer} cannot import from ${targetLayer}: ${match[0]}`);
    }
  }
  return violations.length > 0 ? violations : null;
}

const session = await joinSession({
  hooks: {
    onPostToolUse: async (input) => {
      if (input.toolName === "edit" || input.toolName === "create") {
        const filePath = input.toolArgs?.path;
        if (!filePath || !/\.(js|ts|jsx|tsx|mjs)$/.test(filePath)) return;
        try {
          const content = readFileSync(filePath, "utf-8");
          const violations = checkImports(filePath, content);
          if (violations) {
            return {
              additionalContext:
                `⚠️ Architecture violation in ${filePath}:\n` +
                violations.map((v) => `  - ${v}`).join("\n") +
                `\nFix these import boundaries before proceeding.`,
            };
          }
        } catch {}
      }
    },
  },
  tools: [],
});
```

---

## 7. Plan File Watcher

Detects when the user manually edits `plan.md` and notifies the agent.

```js
import { existsSync, watchFile, readFileSync } from "node:fs";
import { join } from "node:path";
import { joinSession } from "@github/copilot-sdk/extension";

const agentEdits = new Set();
const recentAgentPaths = new Set();

const session = await joinSession();

const workspace = session.workspacePath;
if (workspace) {
  const planPath = join(workspace, "plan.md");
  let lastContent = existsSync(planPath) ? readFileSync(planPath, "utf-8") : null;

  session.on("tool.execution_start", (event) => {
    if (
      (event.data.toolName === "edit" || event.data.toolName === "create") &&
      String(event.data.arguments?.path || "").endsWith("plan.md")
    ) {
      agentEdits.add(event.data.toolCallId);
      recentAgentPaths.add(planPath);
    }
  });

  session.on("tool.execution_complete", (event) => {
    if (agentEdits.delete(event.data.toolCallId)) {
      setTimeout(() => {
        recentAgentPaths.delete(planPath);
        lastContent = existsSync(planPath) ? readFileSync(planPath, "utf-8") : null;
      }, 2000);
    }
  });

  watchFile(planPath, { interval: 1000 }, () => {
    if (recentAgentPaths.has(planPath) || agentEdits.size > 0) return;
    const content = existsSync(planPath) ? readFileSync(planPath, "utf-8") : null;
    if (content === lastContent) return;
    const wasCreated = lastContent === null && content !== null;
    lastContent = content;
    if (content !== null) {
      session.send({
        prompt: `The plan was ${wasCreated ? "created" : "edited"} by the user.`,
      });
    }
  });
}
```

---

## 8. Docker Health Checker Tool

A custom tool the agent can call to check Docker container status.

```js
import { execFile } from "node:child_process";
import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  tools: [
    {
      name: "check_docker_health",
      description: "Check health status of running Docker containers.",
      skipPermission: true,
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            description: "Optional container name filter (e.g., 'postgres')",
          },
        },
      },
      handler: async (args) => {
        const dockerArgs = [
          "ps",
          "--format",
          "table {{.Names}}\t{{.Status}}\t{{.Ports}}",
        ];
        if (args.filter) {
          dockerArgs.push("--filter", `name=${args.filter}`);
        }
        return new Promise((resolve) => {
          execFile("docker", dockerArgs, (err, stdout, stderr) => {
            if (err) {
              resolve({
                textResultForLlm: `Docker error: ${stderr || err.message}`,
                resultType: "failure",
              });
            } else {
              resolve(stdout || "No containers running.");
            }
          });
        });
      },
    },
  ],
});
```
