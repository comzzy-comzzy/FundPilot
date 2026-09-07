import { randomUUID } from "node:crypto";
import type { AuditEntry } from "./types.js";

export class AuditLog {
  private entries: AuditEntry[] = [];

  append(
    kind: string,
    message: string,
    decisionId?: string,
    meta?: Record<string, unknown>
  ): AuditEntry {
    const entry: AuditEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      decisionId,
      kind,
      message,
      meta,
    };
    this.entries.push(entry);
    return entry;
  }

  list(limit = 100): AuditEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  explain(decisionId: string): AuditEntry[] {
    return this.entries.filter((e) => e.decisionId === decisionId);
  }
}
