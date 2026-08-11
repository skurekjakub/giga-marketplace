#!/usr/bin/env node

/**
 * Scaffold a new Copilot CLI extension.
 *
 * Usage:
 *   node scaffold.mjs <name> [--scope project|user] [--preset hooks|tools|full|metrics|gate]
 *
 * Examples:
 *   node scaffold.mjs my-ext                     # minimal extension in .github/extensions/
 *   node scaffold.mjs my-ext --scope user         # in ~/.copilot/extensions/
 *   node scaffold.mjs my-ext --preset full        # tools + hooks + events
 *   node scaffold.mjs my-ext --preset metrics     # session metrics tracker
 *   node scaffold.mjs my-ext --preset gate        # deployment gate with UI
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const scope = args.includes("--scope") ? args[args.indexOf("--scope") + 1] : "project";
const preset = args.includes("--preset") ? args[args.indexOf("--preset") + 1] : "minimal";

if (!name) {
  console.error("Usage: node scaffold.mjs <name> [--scope project|user] [--preset hooks|tools|full|metrics|gate]");
  process.exit(1);
}

const base =
  scope === "user"
    ? join(homedir(), ".copilot", "extensions", name)
    : join(process.cwd(), ".github", "extensions", name);

if (existsSync(base)) {
  console.error(`Extension already exists: ${base}`);
  process.exit(1);
}

const PRESETS = {
  minimal: `import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession();

// Extension "${name}" is ready.
// Add tools, hooks, commands, or event listeners below.
`,

  hooks: `import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  hooks: {
    onUserPromptSubmitted: async (input) => {
      // Modify or augment every user prompt
      return {
        additionalContext: "Custom context injected by ${name}.",
      };
    },
    onPreToolUse: async (input) => {
      // Gate or modify tool calls before execution
      // return { permissionDecision: "deny", permissionDecisionReason: "..." };
    },
    onPostToolUse: async (input) => {
      // React to tool results
    },
    onErrorOccurred: async (input) => {
      if (input.recoverable) {
        return { errorHandling: "retry", retryCount: 1 };
      }
    },
  },
});
`,

  tools: `import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  tools: [
    {
      name: "${name.replace(/-/g, "_")}_example",
      description: "An example tool from the ${name} extension.",
      skipPermission: true,
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "Input to process" },
        },
        required: ["input"],
      },
      handler: async (args) => {
        // Implement your tool logic here
        return \`Processed: \${args.input}\`;
      },
    },
  ],
});
`,

  full: `import { joinSession } from "@github/copilot-sdk/extension";

const session = await joinSession({
  hooks: {
    onUserPromptSubmitted: async (input) => {
      return {
        additionalContext: "Context from ${name}.",
      };
    },
    onPreToolUse: async (input) => {
      // Gate dangerous operations
      if (input.toolName === "bash") {
        const cmd = String(input.toolArgs?.command || "");
        // Add your rules here
      }
    },
    onPostToolUse: async (input) => {
      // Post-processing
    },
    onErrorOccurred: async (input) => {
      if (input.recoverable) {
        return { errorHandling: "retry", retryCount: 2 };
      }
    },
  },
  tools: [
    {
      name: "${name.replace(/-/g, "_")}_tool",
      description: "Custom tool from ${name}.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Query input" },
        },
        required: ["query"],
      },
      handler: async (args) => {
        return \`Result for: \${args.query}\`;
      },
    },
  ],
  commands: [
    {
      name: "${name}",
      description: "Run the ${name} command.",
      handler: async (context) => {
        await session.send({ prompt: \`Running /${name} with args: \${context.args}\` });
      },
    },
  ],
});

// Event subscriptions
session.on("tool.execution_complete", (event) => {
  // React to tool completions
});

session.on("session.idle", () => {
  // Agent finished a turn
});
`,

  metrics: `import { joinSession } from "@github/copilot-sdk/extension";

const metrics = { toolCalls: {}, errors: 0, startTime: Date.now() };

const session = await joinSession({
  hooks: {
    onSessionEnd: async () => {
      const elapsed = ((Date.now() - metrics.startTime) / 1000).toFixed(1);
      const summary = Object.entries(metrics.toolCalls)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => \`  \${name}: \${count}\`)
        .join("\\n");
      return {
        sessionSummary: \`Session: \${elapsed}s, \${metrics.errors} errors.\\nTools:\\n\${summary}\`,
      };
    },
  },
});

session.on("tool.execution_complete", (event) => {
  const name = event.data.toolName;
  metrics.toolCalls[name] = (metrics.toolCalls[name] || 0) + 1;
  if (!event.data.success) metrics.errors++;
});
`,

  gate: `import { joinSession } from "@github/copilot-sdk/extension";

const DANGEROUS_PATTERNS = [
  /rm\\s+-rf\\s+\\//i,
  /deploy/i,
  /kubectl\\s+apply/i,
  /terraform\\s+apply/i,
  /docker\\s+push/i,
];

const session = await joinSession({
  hooks: {
    onPreToolUse: async (input) => {
      if (input.toolName !== "bash") return;
      const cmd = String(input.toolArgs?.command || "");
      const matched = DANGEROUS_PATTERNS.find((p) => p.test(cmd));
      if (!matched) return;

      if (session.capabilities.ui?.elicitation) {
        const result = await session.ui.elicitation({
          message: \`Potentially dangerous command detected: \${cmd.slice(0, 100)}\`,
          requestedSchema: {
            type: "object",
            properties: {
              confirm: {
                type: "boolean",
                title: "Allow this command?",
                default: false,
              },
            },
            required: ["confirm"],
          },
        });
        if (result.action === "accept" && result.content?.confirm) {
          return { permissionDecision: "allow" };
        }
      }
      return {
        permissionDecision: "deny",
        permissionDecisionReason: "Blocked by ${name} safety gate.",
      };
    },
  },
});
`,
};

const code = PRESETS[preset];
if (!code) {
  console.error(`Unknown preset: ${preset}. Choose from: ${Object.keys(PRESETS).join(", ")}`);
  process.exit(1);
}

mkdirSync(base, { recursive: true });
writeFileSync(join(base, "extension.mjs"), code, "utf-8");
console.log(`Created ${join(base, "extension.mjs")}`);
console.log(`Preset: ${preset}`);
console.log(`\nReload extensions: copilot (the CLI reloads automatically on next session)`);
