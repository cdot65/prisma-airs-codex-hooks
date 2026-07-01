import type { ScanResponse } from "@cdot65/prisma-airs-sdk";
import type { AirsConfig, HookResult, ScanCorrelation, ScanDirection, ScanLogEntry } from "./types.js";
import {
  scanPromptContent,
  scanResponseContent,
  scanToolEventContent,
  AISecSDKException,
} from "./airs-client.js";
import { parseToolName } from "./tool-name-parser.js";
import { extractCode, joinCodeBlocks } from "./code-extractor.js";
import { Logger } from "./logger.js";
import { getEnforcementAction, maskContent, DEFAULT_ENFORCEMENT } from "./dlp-masking.js";

// ---------------------------------------------------------------------------
// Human-readable detection labels for UX messages
// ---------------------------------------------------------------------------
const DETECTION_LABELS: Record<string, string> = {
  prompt_injection: "Prompt Injection",
  dlp: "Data Loss Prevention (DLP)",
  toxicity: "Toxic Content",
  url_categorization: "Suspicious URL",
  malicious_code: "Malicious Code",
  custom_topic: "Topic Policy Violation",
};

function friendlyDetectionName(key: string): string {
  return DETECTION_LABELS[key] ?? key;
}

// ---------------------------------------------------------------------------
// Detection extraction from SDK ScanResponse
// ---------------------------------------------------------------------------

interface DetectionInfo {
  services: string[];
  findings: { detection_service: string; verdict: string; detail: string }[];
}

function extractDetections(result: ScanResponse): DetectionInfo {
  const services: string[] = [];
  const findings: { detection_service: string; verdict: string; detail: string }[] = [];
  const pd = result.prompt_detected;
  if (pd) {
    if (pd.injection) {
      services.push("prompt_injection");
      findings.push({ detection_service: "prompt_injection", verdict: "malicious", detail: "Prompt injection detected" });
    }
    if (pd.dlp) {
      services.push("dlp");
      findings.push({ detection_service: "dlp", verdict: "detected", detail: "Sensitive data detected in prompt" });
    }
    if (pd.toxic_content) {
      services.push("toxicity");
      findings.push({ detection_service: "toxicity", verdict: "toxic", detail: "Toxic content detected" });
    }
    if (pd.url_cats) {
      services.push("url_categorization");
      findings.push({ detection_service: "url_categorization", verdict: "suspicious", detail: "Suspicious URL detected" });
    }
    if (pd.malicious_code) {
      services.push("malicious_code");
      findings.push({ detection_service: "malicious_code", verdict: "malicious", detail: "Malicious code detected" });
    }
    if (pd.topic_violation) {
      services.push("custom_topic");
      findings.push({ detection_service: "custom_topic", verdict: "violation", detail: "Topic policy violation" });
    }
  }
  const rd = result.response_detected;
  if (rd) {
    if (rd.malicious_code) {
      services.push("malicious_code");
      findings.push({ detection_service: "malicious_code", verdict: "malicious", detail: "Malicious code detected in response" });
    }
    if (rd.dlp) {
      services.push("dlp");
      findings.push({ detection_service: "dlp", verdict: "detected", detail: "Sensitive data detected in response" });
    }
    if (rd.toxic_content) {
      services.push("toxicity");
      findings.push({ detection_service: "toxicity", verdict: "toxic", detail: "Toxic content in response" });
    }
    if (rd.url_cats) {
      services.push("url_categorization");
      findings.push({ detection_service: "url_categorization", verdict: "suspicious", detail: "Suspicious URL in response" });
    }
  }
  return { services, findings };
}

// ---------------------------------------------------------------------------
// Resolve the developer's identity
// git config user.email, falling back to the OS user.
// ---------------------------------------------------------------------------

function getAppUser(): string {
  try {
    const { execSync } = require("node:child_process");
    return execSync("git config user.email", { encoding: "utf-8" }).trim();
  } catch {
    return process.env.USER ?? process.env.USERNAME ?? "unknown";
  }
}

// ---------------------------------------------------------------------------
// Build UX-friendly block messages
// ---------------------------------------------------------------------------

function buildPromptBlockMessage(
  detections: string[],
  category: string,
  profileName: string,
  scanId: string,
): string {
  const detectionList = detections.map(friendlyDetectionName).join(", ");
  return [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  Prisma AIRS — Prompt Blocked",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `  What happened:  Your prompt was flagged by the ${detectionList} security check.`,
    `  Category:       ${category}`,
    `  Profile:        ${profileName}`,
    "",
    "  What to do:",
    "    - Review your prompt for sensitive data, injection patterns, or policy violations.",
    "    - Modify the prompt and try again.",
    "    - If you believe this is a false positive, contact your security team",
    `      and reference Scan ID: ${scanId}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ].join("\n");
}

function buildResponseBlockMessage(
  detections: string[],
  category: string,
  profileName: string,
  scanId: string,
): string {
  const detectionList = detections.map(friendlyDetectionName).join(", ");
  return [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  Prisma AIRS — Response Flagged (observe-only)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `  What happened:  The AI response was flagged by the ${detectionList} security check.`,
    `  Category:       ${category}`,
    `  Profile:        ${profileName}`,
    "",
    "  Note: Codex's Stop hook fires after the response streamed.",
    "  The response has already been displayed and cannot be retracted.",
    "",
    "  What to do:",
    "    - Do NOT use the flagged content (it may contain sensitive data or unsafe code).",
    "    - If you believe this is a false positive, contact your security team",
    `      and reference Scan ID: ${scanId}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ].join("\n");
}

function buildToolBlockMessage(
  toolName: string,
  detections: string[],
  category: string,
  profileName: string,
  scanId: string,
): string {
  const detectionList = detections.map(friendlyDetectionName).join(", ");
  return [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  Prisma AIRS — MCP Tool Call Blocked",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `  Tool:       ${toolName}`,
    `  What happened:  The tool input was flagged by the ${detectionList} security check.`,
    `  Category:       ${category}`,
    `  Profile:        ${profileName}`,
    "",
    "  What to do:",
    "    - The tool input may contain injection patterns or malicious parameters.",
    "    - If you believe this is a false positive, contact your security team",
    `      and reference Scan ID: ${scanId}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ].join("\n");
}

function buildMaskedMessage(maskedServices: string[]): string {
  const names = maskedServices.map(friendlyDetectionName).join(", ");
  return [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  Prisma AIRS — Sensitive Data Masked",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    `  ${names} detected sensitive data in your content.`,
    "  The flagged patterns have been masked with asterisks.",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Scan-error handling — fail_mode decides whether an errored scan blocks.
// blockable=false (Stop/response direction) always fails open: the content
// was already displayed, so blocking is meaningless.
// ---------------------------------------------------------------------------

function scanErrorResult(
  config: AirsConfig,
  direction: ScanDirection,
  err: unknown,
  logger: Logger,
  blockable: boolean,
): HookResult {
  const isAuth = err instanceof AISecSDKException && err.message.includes("401");
  const failClosed = blockable && config.fail_mode === "closed";

  const message = isAuth
    ? "AIRS authentication failed. Check your API key."
    : failClosed
      ? `AIRS scan failed — blocking ${direction} (fail-closed)`
      : `AIRS scan failed — allowing ${direction} (fail-open)`;

  logger.logScan({
    event: "scan_error",
    scan_id: "",
    direction,
    verdict: failClosed ? "block" : "allow",
    action_taken: "error",
    latency_ms: 0,
    detection_services_triggered: [],
    error: message,
  });

  if (failClosed) {
    return { action: "block", message, errored: true };
  }
  if (isAuth) {
    return { action: "pass", message: `Warning: ${message}`, errored: true };
  }
  return { action: "pass", errored: true };
}

// ---------------------------------------------------------------------------
// scanPrompt — called by the UserPromptSubmit hook
// ---------------------------------------------------------------------------

export async function scanPrompt(
  config: AirsConfig,
  prompt: string,
  logger: Logger,
  correlation?: ScanCorrelation,
): Promise<HookResult> {
  if (config.mode === "bypass") {
    logger.logEvent("scan_bypassed", { direction: "prompt" });
    return { action: "pass" };
  }

  if (!prompt.trim()) {
    return { action: "pass" };
  }

  const appUser = getAppUser();

  try {
    const { result, latencyMs } = await scanPromptContent(config, prompt, appUser, logger, correlation);

    const verdict = result.action === "block" ? "block" : "allow";
    const { services: detections, findings } = extractDetections(result);

    const actionTaken =
      config.mode === "observe"
        ? "observed"
        : verdict === "block"
          ? "blocked"
          : "allowed";

    logger.logScan({
      event: "scan_complete",
      scan_id: result.scan_id ?? "",
      direction: "prompt" as ScanDirection,
      verdict: verdict as "allow" | "block",
      action_taken: actionTaken,
      latency_ms: latencyMs,
      detection_services_triggered: detections,
      error: null,
    });

    if (config.mode === "enforce" && verdict === "block") {
      // Check per-service enforcement — some services may be set to "mask" or "allow"
      const enforcement = config.enforcement ?? DEFAULT_ENFORCEMENT;
      const enforcementAction = getEnforcementAction(findings, enforcement);

      if (enforcementAction === "allow") {
        return { action: "pass" };
      }

      if (enforcementAction === "mask") {
        // DLP masking: we can't mask prompt content that's already been sent,
        // but we log it and warn the user
        const maskedServices = findings
          .filter((f) => (enforcement[f.detection_service] ?? "block") === "mask")
          .map((f) => f.detection_service);
        logger.logEvent("dlp_mask_applied", { direction: "prompt", services: maskedServices });
        return { action: "pass", message: buildMaskedMessage(maskedServices) };
      }

      return {
        action: "block",
        message: buildPromptBlockMessage(
          detections,
          result.category ?? "policy violation",
          config.profiles.prompt,
          result.scan_id ?? "unknown",
        ),
      };
    }

    return { action: "pass" };
  } catch (err) {
    return scanErrorResult(config, "prompt", err, logger, true);
  }
}

// ---------------------------------------------------------------------------
// scanResponse — called by the Stop hook (post-stream)
// ---------------------------------------------------------------------------

export async function scanResponse(
  config: AirsConfig,
  responseText: string,
  logger: Logger,
  correlation?: ScanCorrelation,
): Promise<HookResult> {
  if (config.mode === "bypass") {
    logger.logEvent("scan_bypassed", { direction: "response" });
    return { action: "pass" };
  }

  if (!responseText.trim()) {
    return { action: "pass" };
  }

  const appUser = getAppUser();
  const extracted = extractCode(responseText);
  const codeResponse =
    extracted.codeBlocks.length > 0
      ? joinCodeBlocks(extracted.codeBlocks)
      : undefined;

  const nlText = codeResponse ? extracted.naturalLanguage : responseText;

  try {
    const { result, latencyMs } = await scanResponseContent(
      config, nlText, codeResponse, appUser, logger, correlation,
    );

    const verdict = result.action === "block" ? "block" : "allow";
    const { services: detections, findings } = extractDetections(result);

    const actionTaken =
      config.mode === "observe"
        ? "observed"
        : verdict === "block"
          ? "blocked"
          : "allowed";

    logger.logScan({
      event: "scan_complete",
      scan_id: result.scan_id ?? "",
      direction: "response",
      verdict: verdict as "allow" | "block",
      action_taken: actionTaken,
      latency_ms: latencyMs,
      detection_services_triggered: detections,
      error: null,
    });

    if (config.mode === "enforce" && verdict === "block") {
      const enforcement = config.enforcement ?? DEFAULT_ENFORCEMENT;
      const enforcementAction = getEnforcementAction(findings, enforcement);

      if (enforcementAction === "allow") {
        return { action: "pass" };
      }

      if (enforcementAction === "mask") {
        const maskedServices = findings
          .filter((f) => (enforcement[f.detection_service] ?? "block") === "mask")
          .map((f) => f.detection_service);
        logger.logEvent("dlp_mask_applied", { direction: "response", services: maskedServices });
        return { action: "pass", message: buildMaskedMessage(maskedServices) };
      }

      return {
        action: "block",
        message: buildResponseBlockMessage(
          detections,
          result.category ?? "policy violation",
          config.profiles.response,
          result.scan_id ?? "unknown",
        ),
      };
    }

    return { action: "pass" };
  } catch (err) {
    return scanErrorResult(config, "response", err, logger, false);
  }
}

// ---------------------------------------------------------------------------
// scanToolEvent — called by the PreToolUse and PostToolUse hooks
// ---------------------------------------------------------------------------

export async function scanToolEvent(
  config: AirsConfig,
  toolName: string,
  input: string | undefined,
  output: string | undefined,
  logger: Logger,
  correlation?: ScanCorrelation,
): Promise<HookResult> {
  if (config.mode === "bypass") {
    logger.logEvent("scan_bypassed", { direction: "tool" });
    return { action: "pass" };
  }

  if (!input?.trim() && !output?.trim()) {
    return { action: "pass" };
  }

  const appUser = getAppUser();
  const parsed = parseToolName(toolName);

  try {
    const { result, latencyMs } = await scanToolEventContent(
      config, parsed.server, parsed.tool, input, output, appUser, logger, correlation,
    );

    const verdict = result.action === "block" ? "block" : "allow";
    const { services: detections, findings } = extractDetections(result);

    const actionTaken =
      config.mode === "observe"
        ? "observed"
        : verdict === "block"
          ? "blocked"
          : "allowed";

    logger.logScan({
      event: "scan_complete",
      scan_id: result.scan_id ?? "",
      direction: "tool" as ScanDirection,
      verdict: verdict as "allow" | "block",
      action_taken: actionTaken,
      latency_ms: latencyMs,
      detection_services_triggered: detections,
      error: null,
    });

    if (config.mode === "enforce" && verdict === "block") {
      const enforcement = config.enforcement ?? DEFAULT_ENFORCEMENT;
      const enforcementAction = getEnforcementAction(findings, enforcement);

      if (enforcementAction === "allow") {
        return { action: "pass" };
      }

      if (enforcementAction === "mask") {
        const maskedServices = findings
          .filter((f) => (enforcement[f.detection_service] ?? "block") === "mask")
          .map((f) => f.detection_service);
        logger.logEvent("dlp_mask_applied", { direction: "tool", services: maskedServices });
        return { action: "pass", message: buildMaskedMessage(maskedServices) };
      }

      return {
        action: "block",
        message: buildToolBlockMessage(
          toolName,
          detections,
          result.category ?? "policy violation",
          config.profiles.tool,
          result.scan_id ?? "unknown",
        ),
      };
    }

    return { action: "pass" };
  } catch (err) {
    return scanErrorResult(config, "tool", err, logger, true);
  }
}
