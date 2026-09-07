import type { FundPilotEngine, PolicyConfig } from "@fundpilot/core";

export const TOOL_DEFS = [
  {
    name: "get_balances",
    description: "Get current wallet balances (demo or Binance adapter).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_queue",
    description: "List decision queue items with status and reasons.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "propose_payment",
    description: "Parse natural language intent, run policy firewall, enqueue decision.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Natural language payment instruction" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "approve_decision",
    description: "Operator approves a pending decision.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "set_policy",
    description: "Update policy firewall settings (partial).",
    inputSchema: {
      type: "object",
      properties: {
        reserveUsd: { type: "number" },
        approvalThresholdUsd: { type: "number" },
        flagNewRecipients: { type: "boolean" },
        prioritizeDueToday: { type: "boolean" },
        keepReserve: { type: "boolean" },
        approvalThreshold: { type: "boolean" },
        knownRecipients: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  },
  {
    name: "explain_decision",
    description: "Human-readable explanation and audit trail for a decision.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "execute_allowed",
    description: "Execute an approved decision through the wallet adapter.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_audit",
    description: "List recent audit log entries.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
      additionalProperties: false,
    },
  },
] as const;

export async function callTool(
  engine: FundPilotEngine,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_balances":
      return engine.getBalances();
    case "list_queue":
      return engine.listQueue();
    case "propose_payment":
      return engine.proposePayment(String(args.text ?? ""));
    case "approve_decision":
      return engine.approveDecision(String(args.id));
    case "set_policy":
      return engine.setPolicy(args as Partial<PolicyConfig>);
    case "explain_decision":
      return engine.explainDecision(String(args.id));
    case "execute_allowed":
      return engine.executeAllowed(String(args.id));
    case "list_audit":
      return engine.listAudit(Number(args.limit ?? 100));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
