import { MockBinanceAdapter } from "./mock.js";
import { BawAdapter, type BawOptions } from "./baw.js";
import type { WalletAdapter } from "./types.js";

export * from "./types.js";
export * from "./mock.js";
export * from "./baw.js";

export function createAdapter(
  mode: "demo" | "baw" = (process.env.FUNDPILOT_MODE as "demo" | "baw") || "demo",
  opts?: BawOptions
): WalletAdapter {
  if (mode === "baw") return new BawAdapter(opts);
  return new MockBinanceAdapter();
}
