#!/usr/bin/env node
/**
 * FundPilot MCP server (Track B) — stdio JSON-RPC (MCP-compatible subset).
 * Tools: get_balances, list_queue, propose_payment, approve_decision,
 *        set_policy, explain_decision, execute_allowed, list_audit
 */
import { createInterface } from "node:readline";
import { getEngine } from "./engine-singleton.js";
import { TOOL_DEFS, callTool } from "./tools.js";

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const engine = getEngine();

function reply(msg: JsonRpc) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg: JsonRpc) {
  const id = msg.id ?? null;
  const method = msg.method ?? "";
  const params = (msg.params ?? {}) as Record<string, unknown>;

  try {
    if (method === "initialize") {
      return reply({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "fundpilot", version: "1.0.0" },
        },
      });
    }
    if (method === "notifications/initialized" || method === "initialized") {
      return;
    }
    if (method === "tools/list") {
      return reply({
        jsonrpc: "2.0",
        id,
        result: { tools: TOOL_DEFS },
      });
    }
    if (method === "tools/call") {
      const name = String(params.name ?? "");
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      const result = await callTool(engine, name, args);
      return reply({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
        },
      });
    }
    if (method === "ping") {
      return reply({ jsonrpc: "2.0", id, result: {} });
    }
    return reply({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return reply({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message },
    });
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed) as JsonRpc;
    void handle(msg);
  } catch {
    reply({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  }
});

process.stderr.write("FundPilot MCP server ready (stdio)\n");
