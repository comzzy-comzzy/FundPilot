import type { Decision, DecisionStatus, Intent, PolicyResult } from "./types.js";
import { randomUUID } from "node:crypto";

export class DecisionQueue {
  private items = new Map<string, Decision>();

  propose(intent: Intent, policy: PolicyResult): Decision {
    const now = new Date().toISOString();
    const decision: Decision = {
      id: randomUUID(),
      intent,
      status: policy.status,
      reasons: [...policy.reasons],
      priority: policy.priority,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(decision.id, decision);
    return decision;
  }

  get(id: string): Decision | undefined {
    return this.items.get(id);
  }

  list(): Decision[] {
    return [...this.items.values()].sort((a, b) => {
      const pri = { high: 0, normal: 1, low: 2 } as const;
      if (pri[a.priority] !== pri[b.priority])
        return pri[a.priority] - pri[b.priority];
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  setStatus(id: string, status: DecisionStatus, extraReasons: string[] = []): Decision {
    const d = this.items.get(id);
    if (!d) throw new Error(`Decision not found: ${id}`);
    d.status = status;
    d.updatedAt = new Date().toISOString();
    if (extraReasons.length) d.reasons = [...d.reasons, ...extraReasons];
    return d;
  }

  markExecuted(id: string, txId: string): Decision {
    const d = this.setStatus(id, "executed", [`Executed with tx ${txId}.`]);
    d.execution = { txId, at: new Date().toISOString() };
    return d;
  }
}
