# SDK Quick Reference

A condensed reference for the `@github/copilot-sdk` API surface as of v1.0.24.

## Imports

```js
// Extension mode — attaches to running CLI session
import { joinSession } from "@github/copilot-sdk/extension";

// Standalone mode — spawns/connects to CLI server
import { CopilotClient, CopilotSession, defineTool, approveAll, SYSTEM_PROMPT_SECTIONS } from "@github/copilot-sdk";
```

## joinSession (Extension Mode)

```ts
function joinSession(config?: JoinSessionConfig): Promise<CopilotSession>;

interface JoinSessionConfig {
  tools?: Tool[];
  hooks?: SessionHooks;
  commands?: CommandDefinition[];
  onPermissionRequest?: PermissionHandler;
  onUserInputRequest?: UserInputHandler;
  onElicitationRequest?: ElicitationHandler;
  // Plus all fields from ResumeSessionConfig except onPermissionRequest
}
```

## Tool Definition

```ts
interface Tool<TArgs = unknown> {
  name: string;                              // REQUIRED. Globally unique.
  description?: string;                      // Shown to agent.
  parameters?: ZodSchema<TArgs> | Record<string, unknown>;  // JSON Schema or Zod.
  handler: ToolHandler<TArgs>;               // (args, invocation) => Promise<ToolResult>
  skipPermission?: boolean;                  // No user prompt if true.
  overridesBuiltInTool?: boolean;            // Explicitly replace a built-in tool.
}

type ToolResult = string | ToolResultObject;

interface ToolResultObject {
  textResultForLlm: string;
  resultType: "success" | "failure" | "rejected" | "denied" | "timeout";
  binaryResultsForLlm?: ToolBinaryResult[];
  error?: string;
  sessionLog?: string;
  toolTelemetry?: Record<string, unknown>;
}

interface ToolInvocation {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
  traceparent?: string;    // W3C Trace Context
  tracestate?: string;
}
```

## Hook Signatures

All hooks: `(input, invocation: { sessionId }) => Promise<Output | void>`

```ts
interface SessionHooks {
  onPreToolUse?: PreToolUseHandler;
  onPostToolUse?: PostToolUseHandler;
  onUserPromptSubmitted?: UserPromptSubmittedHandler;
  onSessionStart?: SessionStartHandler;
  onSessionEnd?: SessionEndHandler;
  onErrorOccurred?: ErrorOccurredHandler;
}
```

### onPreToolUse
```ts
// Input
{ toolName: string, toolArgs: unknown, timestamp: number, cwd: string }

// Output (all optional)
{
  permissionDecision?: "allow" | "deny" | "ask";
  permissionDecisionReason?: string;
  modifiedArgs?: unknown;
  additionalContext?: string;
  suppressOutput?: boolean;
}
```

### onPostToolUse
```ts
// Input
{ toolName: string, toolArgs: unknown, toolResult: ToolResultObject, timestamp: number, cwd: string }

// Output (all optional)
{
  modifiedResult?: ToolResultObject;
  additionalContext?: string;
  suppressOutput?: boolean;
}
```

### onUserPromptSubmitted
```ts
// Input
{ prompt: string, timestamp: number, cwd: string }

// Output (all optional)
{
  modifiedPrompt?: string;
  additionalContext?: string;
  suppressOutput?: boolean;
}
```

### onSessionStart
```ts
// Input
{ source: "startup" | "resume" | "new", initialPrompt?: string, timestamp: number, cwd: string }

// Output (all optional)
{
  additionalContext?: string;
  modifiedConfig?: Record<string, unknown>;
}
```

### onSessionEnd
```ts
// Input
{ reason: "complete" | "error" | "abort" | "timeout" | "user_exit", finalMessage?: string, error?: string, timestamp: number, cwd: string }

// Output (all optional)
{
  sessionSummary?: string;
  cleanupActions?: string[];
  suppressOutput?: boolean;
}
```

### onErrorOccurred
```ts
// Input
{ error: string, errorContext: "model_call" | "tool_execution" | "system" | "user_input", recoverable: boolean, timestamp: number, cwd: string }

// Output (all optional)
{
  errorHandling?: "retry" | "skip" | "abort";
  retryCount?: number;
  userNotification?: string;
  suppressOutput?: boolean;
}
```

## CopilotSession Methods

```ts
class CopilotSession {
  readonly sessionId: string;

  // Messaging
  send(options: MessageOptions): Promise<string>;
  sendAndWait(options: MessageOptions, timeout?: number): Promise<AssistantMessageEvent | undefined>;
  abort(): Promise<void>;

  // Events
  on<K extends SessionEventType>(eventType: K, handler: TypedSessionEventHandler<K>): () => void;
  on(handler: SessionEventHandler): () => void;

  // Logging
  log(message: string, options?: { level?: "info" | "warning" | "error"; ephemeral?: boolean }): Promise<void>;

  // Model
  setModel(model: string, options?: { reasoningEffort?: ReasoningEffort }): Promise<void>;

  // History
  getMessages(): Promise<SessionEvent[]>;

  // Lifecycle
  disconnect(): Promise<void>;

  // Properties
  get workspacePath(): string | undefined;
  get capabilities(): SessionCapabilities;
  get ui(): SessionUiApi;
  get rpc(): SessionRpc;

  // Registration (internal, but available)
  registerTools(tools?: Tool[]): void;
  registerHooks(hooks?: SessionHooks): void;
  registerCommands(commands?: CommandDefinition[]): void;
  registerPermissionHandler(handler?: PermissionHandler): void;
  registerUserInputHandler(handler?: UserInputHandler): void;
  registerElicitationHandler(handler?: ElicitationHandler): void;
}
```

## MessageOptions

```ts
interface MessageOptions {
  prompt: string;
  attachments?: Array<
    | { type: "file"; path: string; displayName?: string }
    | { type: "directory"; path: string; displayName?: string }
    | { type: "selection"; filePath: string; displayName: string; selection?: { start, end }; text?: string }
    | { type: "blob"; data: string; mimeType: string; displayName?: string }
  >;
  mode?: "enqueue" | "immediate";
}
```

## Permission Handler

```ts
type PermissionHandler = (
  request: PermissionRequest,
  invocation: { sessionId: string }
) => Promise<PermissionRequestResult> | PermissionRequestResult;

interface PermissionRequest {
  kind: "shell" | "write" | "mcp" | "read" | "url" | "custom-tool";
  toolCallId?: string;
  [key: string]: unknown;
}

// Return one of:
{ kind: "approved" }
{ kind: "denied-by-rules" }
{ kind: "ask-user" }
```

## UI Elicitation

```ts
interface SessionUiApi {
  elicitation(params: ElicitationParams): Promise<ElicitationResult>;
  confirm(message: string): Promise<boolean>;
  select(message: string, options: string[]): Promise<string | null>;
  input(message: string, options?: InputOptions): Promise<string | null>;
}

interface ElicitationResult {
  action: "accept" | "decline" | "cancel";
  content?: Record<string, ElicitationFieldValue>;
}
```

## Slash Commands

```ts
interface CommandDefinition {
  name: string;          // Without leading /
  description?: string;
  handler: CommandHandler;
}

interface CommandContext {
  sessionId: string;
  command: string;       // Full text: "/deploy production"
  commandName: string;   // "deploy"
  args: string;          // "production"
}
```

## System Prompt Customization (CopilotClient only)

```ts
type SystemMessageConfig =
  | { mode?: "append"; content?: string }
  | { mode: "replace"; content: string }
  | { mode: "customize"; sections?: Partial<Record<SystemPromptSection, SectionOverride>>; content?: string };

type SystemPromptSection =
  "identity" | "tone" | "tool_efficiency" | "environment_context" |
  "code_change_rules" | "guidelines" | "safety" | "tool_instructions" |
  "custom_instructions" | "last_instructions";

interface SectionOverride {
  action: "replace" | "remove" | "append" | "prepend" | SectionTransformFn;
  content?: string;
}
```

## CopilotClient (Standalone Mode)

```ts
class CopilotClient {
  constructor(options?: CopilotClientOptions);
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  createSession(config: SessionConfig): Promise<CopilotSession>;
  resumeSession(sessionId: string, config: ResumeSessionConfig): Promise<CopilotSession>;
  listSessions(filter?: SessionListFilter): Promise<SessionMetadata[]>;
  getSessionMetadata(sessionId: string): Promise<SessionMetadata | undefined>;
  deleteSession(sessionId: string): Promise<void>;
  getLastSessionId(): Promise<string | undefined>;
  listModels(): Promise<ModelInfo[]>;
  getAuthStatus(): Promise<GetAuthStatusResponse>;
  getStatus(): Promise<GetStatusResponse>;
  ping(message?: string): Promise<{ message, timestamp, protocolVersion? }>;
  getState(): ConnectionState;
  getForegroundSessionId(): Promise<string | undefined>;
  setForegroundSessionId(sessionId: string): Promise<void>;
  on<K>(eventType: K, handler): () => void;
  on(handler: SessionLifecycleHandler): () => void;
}

interface CopilotClientOptions {
  cliPath?: string;
  cliArgs?: string[];
  cwd?: string;
  port?: number;
  useStdio?: boolean;       // default: true
  isChildProcess?: boolean;
  cliUrl?: string;          // "host:port" for TCP
  logLevel?: string;
  autoStart?: boolean;      // default: true
  env?: Record<string, string | undefined>;
  githubToken?: string;
  useLoggedInUser?: boolean;
  onListModels?: () => Promise<ModelInfo[]> | ModelInfo[];
  telemetry?: TelemetryConfig;
  onGetTraceContext?: TraceContextProvider;
  sessionFs?: SessionFsConfig;
}
```

## Provider Config (BYOK)

```ts
interface ProviderConfig {
  type?: "openai" | "azure" | "anthropic";
  wireApi?: "completions" | "responses";
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  azure?: { apiVersion?: string };
}
```

## Session Event Types (Complete List)

Core: `session.start`, `session.resume`, `session.idle`, `session.error`, `session.shutdown`, `session.info`, `session.warning`

Agent: `assistant.message`, `assistant.turn_start`, `assistant.turn_end`, `assistant.streaming_delta`, `assistant.intent`, `assistant.reasoning`, `assistant.reasoning_delta`, `assistant.usage`

Tools: `tool.execution_start`, `tool.execution_complete`, `tool.execution_progress`, `tool.execution_partial_result`, `tool.user_requested`

User: `user.message`, `permission.requested`, `permission.completed`, `user_input.requested`, `user_input.completed`

Session lifecycle: `session.mode_changed`, `session.model_change`, `session.plan_changed`, `session.context_changed`, `session.tools_updated`, `session.extensions_loaded`, `session.skills_loaded`, `session.mcp_servers_loaded`, `session.custom_agents_updated`, `session.compaction_start`, `session.compaction_complete`, `session.truncation`, `session.snapshot_rewind`, `session.background_tasks_changed`, `session.workspace_file_changed`, `session.title_changed`, `session.usage_info`, `session.remote_steerable_changed`, `session.task_complete`, `session.handoff`, `capabilities.changed`, `commands.changed`, `pending_messages.modified`

Subagents: `subagent.started`, `subagent.completed`, `subagent.failed`, `subagent.selected`, `subagent.deselected`

Hooks: `hook.start`, `hook.end`

UI: `elicitation.requested`, `elicitation.completed`, `exit_plan_mode.requested`, `exit_plan_mode.completed`

Commands: `command.execute`, `command.completed`, `command.queued`

MCP: `mcp.oauth_required`, `mcp.oauth_completed`, `mcp.server_status_changed`

Skills: `skill.invoked`

External: `external_tool.requested`, `external_tool.completed`, `sampling.requested`, `sampling.completed`

System: `system.message`, `system.notification`

## SDK File Locations

- SDK package: `~/.cache/copilot/pkg/universal/<version>/copilot-sdk/`
- Type definitions: `index.d.ts`, `types.d.ts`, `session.d.ts`, `client.d.ts`, `extension.d.ts`
- Generated types: `generated/session-events.d.ts`, `generated/rpc.d.ts`
- Official docs: `docs/extensions.md`, `docs/agent-author.md`, `docs/examples.md`
