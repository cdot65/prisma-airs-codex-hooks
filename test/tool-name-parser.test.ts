// test/tool-name-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseToolName, isMcpToolName } from "../src/tool-name-parser.js";

describe("parseToolName", () => {
  it("parses MCP tool with server and tool name", () => {
    const result = parseToolName("mcp__github__get_file_contents");
    expect(result).toEqual({ server: "github", tool: "get_file_contents" });
  });

  it("parses MCP tool with nested double underscores in tool name", () => {
    const result = parseToolName("mcp__filesystem__read__nested");
    expect(result).toEqual({ server: "filesystem", tool: "read__nested" });
  });

  it("keeps single underscores inside server names intact", () => {
    const result = parseToolName("mcp__my_server__do_thing");
    expect(result).toEqual({ server: "my_server", tool: "do_thing" });
  });

  it("returns codex server for non-MCP tools", () => {
    const result = parseToolName("Bash");
    expect(result).toEqual({ server: "codex", tool: "Bash" });
  });

  it("returns codex server for apply_patch tool", () => {
    const result = parseToolName("apply_patch");
    expect(result).toEqual({ server: "codex", tool: "apply_patch" });
  });

  it("handles empty string", () => {
    const result = parseToolName("");
    expect(result).toEqual({ server: "codex", tool: "" });
  });

  it("handles MCP prefix with no tool segment", () => {
    const result = parseToolName("mcp__server");
    expect(result).toEqual({ server: "server", tool: "server" });
  });

  it("handles bare mcp__ prefix", () => {
    const result = parseToolName("mcp__");
    expect(result).toEqual({ server: "", tool: "" });
  });
});

describe("isMcpToolName", () => {
  it("returns true for mcp__ prefixed names", () => {
    expect(isMcpToolName("mcp__github__get_file_contents")).toBe(true);
    expect(isMcpToolName("mcp__server")).toBe(true);
  });

  it("returns false for built-in tool names", () => {
    expect(isMcpToolName("Bash")).toBe(false);
    expect(isMcpToolName("apply_patch")).toBe(false);
    expect(isMcpToolName("")).toBe(false);
  });

  it("returns false for legacy Cursor MCP format", () => {
    expect(isMcpToolName("MCP:github:get_file_contents")).toBe(false);
  });
});
