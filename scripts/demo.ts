import { createDemoEngine } from "../packages/core/src/index.ts";
import { MockBinanceAdapter } from "../packages/binance/src/mock.ts";

function hr(title: string) {
  console.log("\n" + "=".repeat(64));
  console.log(title);
  console.log("=".repeat(64));
}

function line(label: string, value: string) {
  console.log("  " + label.padEnd(14) + " " + value);
}

async function main() {
  hr("FundPilot demo");
  const wallet = new MockBinanceAdapter();
  const engine = createDemoEngine(wallet);

  const before = await engine.getBalances();
  console.log("\nStarting balances:");
  for (const b of before) line(b.asset, String(b.free));

  const policy = engine.getPolicy();
  console.log("\nPolicies:");
  line("Reserve", "$" + policy.reserveUsd);
  line("Threshold", "$" + policy.approvalThresholdUsd);

  const prompts = ["Pay utilities $40","Pay contractor $650 due today","Send $420 to new vendor Acme","Pay invoice $1200 due today"];

  hr("Scenario 0 - Auto-allow");
  const s0 = await engine.proposePayment(prompts[0]);
  line("Status", s0.status);
  line("Why", s0.reasons.join(" | "));

  hr("Scenario 1 - Over threshold");
  const s1 = await engine.proposePayment(prompts[1]);
  line("Status", s1.status);
  line("Priority", s1.priority);
  line("Why", s1.reasons.join(" | "));

  hr("Scenario 2 - New recipient");
  const s2 = await engine.proposePayment(prompts[2]);
  line("Status", s2.status);
  line("Why", s2.reasons.join(" | "));

  hr("Scenario 3 - Reserve break");
  const s3 = await engine.proposePayment(prompts[3]);
  line("Status", s3.status);
  line("Why", s3.reasons.join(" | "));

  hr("Queue snapshot");
  for (const d of engine.listQueue()) {
    console.log("  [" + d.status.padEnd(9) + "] " + d.intent.amount + " -> " + d.intent.recipient);
  }

  hr("Approve + execute");
  engine.approveDecision(s1.id);
  const executed = await engine.executeAllowed(s1.id);
  line("Executed", executed.status);
  line("Tx", executed.execution?.txId || "n/a");

  console.log("\nBalances after:");
  for (const b of await engine.getBalances()) line(b.asset, String(b.free));

  hr("Audit (latest)");
  for (const a of engine.listAudit(8)) console.log("  - [" + a.kind + "] " + a.message);

  hr("Demo complete");
  console.log("Expected: utilities executed; contractor executed after approve;");
  console.log("          Acme pending; invoice blocked (reserve).\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
