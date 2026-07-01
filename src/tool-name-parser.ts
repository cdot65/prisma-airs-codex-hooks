// src/tool-name-parser.ts

/** Parsed tool name components */
export interface ParsedToolName {
  server: string;
  tool: string;
}

const MCP_PREFIX = "mcp__";

/** True when a Codex tool_name refers to an MCP tool (mcp__server__tool) */
export function isMcpToolName(raw: string): boolean {
  return raw.startsWith(MCP_PREFIX);
}

/**
 * Parse a Codex tool_name into server and tool components.
 *
 * "mcp__github__get_file_contents"  → { server: "github", tool: "get_file_contents" }
 * "mcp__filesystem__read__nested"   → { server: "filesystem", tool: "read__nested" }
 * "Bash"                            → { server: "codex", tool: "Bash" }
 */
export function parseToolName(raw: string): ParsedToolName {
  if (isMcpToolName(raw)) {
    const withoutPrefix = raw.slice(MCP_PREFIX.length);
    const separator = withoutPrefix.indexOf("__");
    if (separator === -1) {
      return { server: withoutPrefix, tool: withoutPrefix };
    }
    return {
      server: withoutPrefix.slice(0, separator),
      tool: withoutPrefix.slice(separator + 2),
    };
  }
  return { server: "codex", tool: raw };
}
