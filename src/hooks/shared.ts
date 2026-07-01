/** Shared helpers for Codex hook entry points */
import type { CodexHookInput, ScanCorrelation } from "../types.js";

/** Read all of stdin as a string */
export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

/** Normalize an unknown value to a string */
export function normalize(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw === null || raw === undefined) return "";
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

/**
 * Derive AIRS correlation IDs from Codex hook input.
 * transaction_id prefers turn_id:tool_use_id for tools, then turn_id,
 * then tool_use_id, then session_id — mirroring the AIRS correlation scheme.
 */
export function buildCorrelation(
  input: CodexHookInput & { tool_use_id?: string },
): ScanCorrelation {
  const { session_id, turn_id } = input;
  const toolUseId = input.tool_use_id;

  let transactionId: string | undefined;
  if (turn_id && toolUseId) transactionId = `${turn_id}:${toolUseId}`;
  else if (turn_id) transactionId = turn_id;
  else if (toolUseId) transactionId = toolUseId;
  else transactionId = session_id;

  return { sessionId: session_id, transactionId };
}
