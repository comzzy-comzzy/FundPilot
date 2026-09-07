export type DecisionStatus =
  | "pending"
  | "approved"
  | "blocked"
  | "executed"
  | "delayed";

export type IntentAction = "pay" | "send" | "swap" | "unknown";

export interface Balance {
  asset: string;
  free: number;
  locked: number;
}

export interface PolicyConfig {
  reserveUsd: number;
  approvalThresholdUsd: number;
  flagNewRecipients: boolean;
  prioritizeDueToday: boolean;
  keepReserve: boolean;
  approvalThreshold: boolean;
  knownRecipients: string[];
  unusualMultiplier: number;
}

export interface Intent {
  raw: string;
  action: IntentAction;
  amount: number;
  asset: string;
  recipient: string;
  dueToday: boolean;
  notes: string;
}

export interface PolicyResult {
  allowed: boolean;
  needsApproval: boolean;
  status: DecisionStatus;
  reasons: string[];
  priority: "low" | "normal" | "high";
}

export interface Decision {
  id: string;
  intent: Intent;
  status: DecisionStatus;
  reasons: string[];
  priority: "low" | "normal" | "high";
  createdAt: string;
  updatedAt: string;
  execution?: {
    txId: string;
    at: string;
  };
}

export interface AuditEntry {
  id: string;
  at: string;
  decisionId?: string;
  kind: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface EngineContext {
  balances: Balance[];
  recent: Array<{ recipient: string; amount: number; at: string }>;
  avgAmountByRecipient: Record<string, number>;
}

export const DEFAULT_POLICY: PolicyConfig = {
  reserveUsd: 1000,
  approvalThresholdUsd: 500,
  flagNewRecipients: true,
  prioritizeDueToday: true,
  keepReserve: true,
  approvalThreshold: true,
  knownRecipients: ["payroll", "contractor", "alice", "rent", "utilities", "invoice-payee"],
  unusualMultiplier: 2.5,
};

export const DEFAULT_BALANCES: Balance[] = [
  { asset: "USDT", free: 1800.23, locked: 0 },
  { asset: "BNB", free: 2.5, locked: 0 },
  { asset: "BTC", free: 0.15, locked: 0 },
];
