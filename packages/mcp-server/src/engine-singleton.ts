import { createDemoEngine, type FundPilotEngine } from "@fundpilot/core";
import { createAdapter } from "@fundpilot/binance";

let engine: FundPilotEngine | null = null;

export function getEngine(): FundPilotEngine {
  if (!engine) {
    const wallet = createAdapter("demo");
    engine = createDemoEngine(wallet);
  }
  return engine;
}
