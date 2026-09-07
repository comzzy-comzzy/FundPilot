import type {
  EngineContext,
  Intent,
  PolicyConfig,
  PolicyResult,
  DecisionStatus,
} from "./types.js";

function usdBalance(ctx: EngineContext): number {
  const usdt = ctx.balances.find((b) => b.asset === "USDT");
  return usdt?.free ?? 0;
}

export class PolicyEngine {
  constructor(private policy: PolicyConfig) {}

  getPolicy(): PolicyConfig {
    return { ...this.policy, knownRecipients: [...this.policy.knownRecipients] };
  }

  setPolicy(partial: Partial<PolicyConfig>): PolicyConfig {
    this.policy = {
      ...this.policy,
      ...partial,
      knownRecipients: partial.knownRecipients
        ? [...partial.knownRecipients]
        : [...this.policy.knownRecipients],
    };
    return this.getPolicy();
  }

  evaluate(intent: Intent, ctx: EngineContext): PolicyResult {
    const reasons: string[] = [];
    let needsApproval = false;
    let blocked = false;
    let delayed = false;
    let priority: PolicyResult["priority"] = "normal";

    if (!intent.amount || intent.amount <= 0) {
      return {
        allowed: false,
        needsApproval: false,
        status: "blocked",
        reasons: ["Could not parse a positive amount from the instruction."],
        priority: "low",
      };
    }

    const bal = usdBalance(ctx);
    const post = bal - intent.amount;

    if (this.policy.keepReserve && post < this.policy.reserveUsd) {
      blocked = true;
      reasons.push(
        `Would break $${this.policy.reserveUsd} reserve (balance $${bal.toFixed(2)} → $${post.toFixed(2)}).`
      );
    }

    if (
      this.policy.approvalThreshold &&
      intent.amount > this.policy.approvalThresholdUsd
    ) {
      needsApproval = true;
      reasons.push(
        `Amount $${intent.amount} exceeds $${this.policy.approvalThresholdUsd} approval threshold.`
      );
    }

    const recipientKey = intent.recipient.toLowerCase();
    const known = this.policy.knownRecipients.map((r) => r.toLowerCase());
    if (this.policy.flagNewRecipients && !known.includes(recipientKey)) {
      needsApproval = true;
      reasons.push(`New recipient "${intent.recipient}" is not on the allow-list.`);
    }

    // Duplicate detection
    const dup = ctx.recent.find(
      (r) =>
        r.recipient.toLowerCase() === recipientKey &&
        Math.abs(r.amount - intent.amount) < 0.01
    );
    if (dup) {
      needsApproval = true;
      reasons.push(
        `Possible duplicate: same recipient and amount as a recent transfer (${dup.at}).`
      );
    }

    // Unusual amount vs history
    const avg = ctx.avgAmountByRecipient[recipientKey];
    if (
      avg &&
      intent.amount > avg * this.policy.unusualMultiplier
    ) {
      needsApproval = true;
      reasons.push(
        `Unusual amount: $${intent.amount} is >${this.policy.unusualMultiplier}× typical $${avg.toFixed(2)} for ${intent.recipient}.`
      );
    }

    if (this.policy.prioritizeDueToday && intent.dueToday) {
      priority = "high";
      reasons.push("Marked high priority because it is due today.");
    }

    if (!blocked && !needsApproval) {
      reasons.push("All active policy checks passed. Execution allowed.");
    }

    let status: DecisionStatus;
    if (blocked) status = "blocked";
    else if (needsApproval) status = "pending";
    else if (delayed) status = "delayed";
    else status = "approved"; // auto-approved path

    return {
      allowed: !blocked && !needsApproval,
      needsApproval: needsApproval && !blocked,
      status,
      reasons,
      priority,
    };
  }
}
