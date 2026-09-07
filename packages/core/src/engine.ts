import { AuditLog } from "./audit.js";
import { parseIntent } from "./intent.js";
import { PolicyEngine } from "./policy.js";
import { DecisionQueue } from "./queue.js";
import {
  DEFAULT_BALANCES,
  DEFAULT_POLICY,
  type Balance,
  type Decision,
  type EngineContext,
  type PolicyConfig,
} from "./types.js";

export interface WalletPort {
  getBalances(): Promise<Balance[]>;
  send(params: {
    asset: string;
    amount: number;
    to: string;
  }): Promise<{ txId: string }>;
}

export class FundPilotEngine {
  readonly policy: PolicyEngine;
  readonly queue = new DecisionQueue();
  readonly audit = new AuditLog();
  private recent: EngineContext["recent"] = [];
  private avgAmountByRecipient: Record<string, number> = {
    contractor: 400,
    payroll: 3200,
    rent: 1800,
    utilities: 85,
    alice: 50,
  };

  constructor(
    private wallet: WalletPort,
    policy: PolicyConfig = DEFAULT_POLICY
  ) {
    this.policy = new PolicyEngine(policy);
  }

  private async context(): Promise<EngineContext> {
    const balances = await this.wallet.getBalances();
    return {
      balances,
      recent: this.recent,
      avgAmountByRecipient: this.avgAmountByRecipient,
    };
  }

  async getBalances(): Promise<Balance[]> {
    return this.wallet.getBalances();
  }

  getPolicy(): PolicyConfig {
    return this.policy.getPolicy();
  }

  setPolicy(partial: Partial<PolicyConfig>): PolicyConfig {
    const next = this.policy.setPolicy(partial);
    this.audit.append(
      "policy",
      `Policy updated: ${JSON.stringify(partial)}`
    );
    return next;
  }

  async proposePayment(text: string): Promise<Decision> {
    const intent = parseIntent(text);
    const ctx = await this.context();
    const result = this.policy.evaluate(intent, ctx);
    const decision = this.queue.propose(intent, result);

    this.audit.append(
      "propose",
      `Proposed "${intent.raw}" → status=${decision.status}. ${result.reasons.join(" ")}`,
      decision.id,
      { intent, result }
    );

    if (result.allowed && decision.status === "approved") {
      // Auto-execute allowed decisions
      return this.executeAllowed(decision.id);
    }
    return decision;
  }

  approveDecision(id: string): Decision {
    const d = this.queue.get(id);
    if (!d) throw new Error(`Decision not found: ${id}`);
    if (d.status === "blocked") {
      throw new Error("Blocked decisions cannot be approved without policy change.");
    }
    if (d.status === "executed") return d;
    const updated = this.queue.setStatus(id, "approved", [
      "Operator approved this decision.",
    ]);
    this.audit.append(
      "approve",
      `Approved decision ${id}: ${d.intent.raw}`,
      id
    );
    return updated;
  }

  async executeAllowed(id: string): Promise<Decision> {
    const d = this.queue.get(id);
    if (!d) throw new Error(`Decision not found: ${id}`);
    if (d.status !== "approved") {
      throw new Error(
        `Decision ${id} is ${d.status}; only approved decisions can execute.`
      );
    }
    // Re-check reserve at execution time
    const ctx = await this.context();
    const recheck = this.policy.evaluate(d.intent, ctx);
    if (recheck.status === "blocked") {
      const blocked = this.queue.setStatus(id, "blocked", recheck.reasons);
      this.audit.append(
        "block",
        `Execution blocked on re-check: ${recheck.reasons.join(" ")}`,
        id
      );
      return blocked;
    }

    const tx = await this.wallet.send({
      asset: d.intent.asset,
      amount: d.intent.amount,
      to: d.intent.recipient,
    });
    this.recent.push({
      recipient: d.intent.recipient,
      amount: d.intent.amount,
      at: new Date().toISOString(),
    });
    const executed = this.queue.markExecuted(id, tx.txId);
    this.audit.append(
      "execute",
      `Executed ${d.intent.action} $${d.intent.amount} ${d.intent.asset} → ${d.intent.recipient} (tx ${tx.txId}).`,
      id,
      { txId: tx.txId }
    );
    return executed;
  }

  listQueue(): Decision[] {
    return this.queue.list();
  }

  explainDecision(id: string) {
    const d = this.queue.get(id);
    if (!d) throw new Error(`Decision not found: ${id}`);
    return {
      decision: d,
      audit: this.audit.explain(id),
      summary: d.reasons.join(" "),
    };
  }

  listAudit(limit = 100) {
    return this.audit.list(limit);
  }
}

export function createDemoEngine(wallet: WalletPort): FundPilotEngine {
  return new FundPilotEngine(wallet, {
    ...DEFAULT_POLICY,
    reserveUsd: Number(process.env.FUNDPILOT_RESERVE_USD || 1000),
    approvalThresholdUsd: Number(
      process.env.FUNDPILOT_APPROVAL_THRESHOLD_USD || 500
    ),
  });
}

export { DEFAULT_BALANCES };
