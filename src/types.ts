// Re-export SDK types we use directly
export type {
  ScanResponse,
  Metadata,
} from "@cdot65/prisma-airs-sdk";

/** Operational mode */
export type Mode = "observe" | "enforce" | "bypass";

/** Retry configuration */
export interface RetryConfig {
  enabled: boolean;
  max_attempts: number;
  backoff_base_ms: number;
}

/** Logging configuration */
export interface LoggingConfig {
  path: string;
  include_content: boolean;
}

/** Profile configuration */
export interface ProfileConfig {
  prompt: string;
  response: string;
  tool: string;
}

/** Per-detection-service enforcement action */
export type EnforcementAction = "block" | "mask" | "allow";

/** Per-service enforcement overrides (Phase 3) */
export interface EnforcementConfig {
  [detectionService: string]: EnforcementAction;
}

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failure_threshold: number;
  cooldown_ms: number;
}

/** Content size limits for scanning */
export interface ContentLimitsConfig {
  max_scan_bytes: number;
  truncate_bytes: number;
}

/** Behavior when AIRS is unreachable or scanning errors */
export type FailMode = "open" | "closed";

/** Top-level AIRS configuration (airs-config.json) */
export interface AirsConfig {
  endpoint: string;
  apiKeyEnvVar: string;
  profiles: ProfileConfig;
  mode: Mode;
  timeout_ms: number;
  retry: RetryConfig;
  logging: LoggingConfig;
  /** "open" (default): never block on errors; "closed": block prompt/tool on errors */
  fail_mode?: FailMode;
  /** Per-service enforcement actions (only applies in enforce mode) */
  enforcement?: EnforcementConfig;
  /** Circuit breaker settings */
  circuit_breaker?: CircuitBreakerConfig;
  /** Content size limits for scanning */
  content_limits?: ContentLimitsConfig;
}

/** Scan direction */
export type ScanDirection = "prompt" | "response" | "tool";

/** Log entry written by the structured logger */
export interface ScanLogEntry {
  timestamp: string;
  event: string;
  scan_id: string;
  direction: ScanDirection;
  verdict: "allow" | "block";
  action_taken: "allowed" | "blocked" | "observed" | "bypassed" | "error";
  latency_ms: number;
  detection_services_triggered: string[];
  error: string | null;
  content?: string;
}

/** Result from code extraction */
export interface ExtractedContent {
  naturalLanguage: string;
  codeBlocks: string[];
  languages: string[];
}

/** Internal hook result from scanner logic */
export interface HookResult {
  action: "pass" | "block";
  message?: string;
  /** true when the scan itself failed (config/API error) rather than verdicted */
  errored?: boolean;
}

/** AIRS correlation IDs derived from Codex hook input */
export interface ScanCorrelation {
  /** AIRS session_id — Codex session_id (falls back to app-user:date) */
  sessionId?: string;
  /** AIRS tr_id — turn_id:tool_use_id for tools, turn_id for prompt/stop */
  transactionId?: string;
}

// ---------------------------------------------------------------------------
// Codex Hooks API types
// See: https://developers.openai.com/codex/hooks
// ---------------------------------------------------------------------------

/** Common fields Codex sends to every hook's stdin JSON */
export interface CodexHookInput {
  session_id?: string;
  transcript_path?: string | null;
  cwd?: string;
  hook_event_name: string;
  /** Codex extension: active model slug */
  model?: string;
  /** default | acceptEdits | plan | dontAsk | bypassPermissions */
  permission_mode?: string;
  /** Codex extension: active turn id (turn-scoped events) */
  turn_id?: string;
}

/** stdin for the UserPromptSubmit hook */
export interface UserPromptSubmitInput extends CodexHookInput {
  prompt: string;
}

/** stdin for the PreToolUse hook */
export interface PreToolUseInput extends CodexHookInput {
  tool_name: string;
  tool_use_id?: string;
  tool_input: unknown;
}

/** stdin for the PostToolUse hook */
export interface CodexPostToolUseInput extends CodexHookInput {
  tool_name: string;
  tool_use_id?: string;
  tool_input: unknown;
  tool_response: unknown;
}

/** stdin for the Stop hook */
export interface StopInput extends CodexHookInput {
  stop_hook_active?: boolean;
  last_assistant_message?: string | null;
}

/** stdout to block a prompt in UserPromptSubmit */
export interface UserPromptSubmitBlockOutput {
  decision: "block";
  reason: string;
}

/**
 * stdout to deny a tool call in PreToolUse.
 * Must NOT include continue/stopReason/suppressOutput — Codex marks the
 * hook run failed and continues the tool call if those fields appear.
 */
export interface PreToolUseDenyOutput {
  hookSpecificOutput: {
    hookEventName: "PreToolUse";
    permissionDecision: "deny";
    permissionDecisionReason: string;
  };
}

/** stdout for the Stop hook — Stop requires JSON output (plain text invalid) */
export interface StopOutput {
  continue: boolean;
  stopReason?: string;
  systemMessage?: string;
}

/** Single command handler inside a Codex hooks.json matcher group */
export interface CodexHookHandler {
  type: "command";
  command: string;
  /** seconds (Codex default 600) */
  timeout?: number;
  statusMessage?: string;
}

/** Matcher group for one Codex hook event */
export interface CodexHookMatcherGroup {
  /** regex applied per-event (tool name, trigger, source); omit to match all */
  matcher?: string;
  hooks: CodexHookHandler[];
}

/** Codex hooks.json file format */
export interface CodexHooksConfig {
  hooks: {
    [eventName: string]: CodexHookMatcherGroup[];
  };
}

