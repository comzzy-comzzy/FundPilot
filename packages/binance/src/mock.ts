import { randomUUID } from "node:crypto";
import { DEFAULT_BALANCES, type Balance } from "@fundpilot/core";
import type {
  QuoteResult,
  SendParams,
  SwapParams,
  TxRecord,
  WalletAdapter,
  WalletStatus,
} from "./types.js";

const RATES: Record<string, number> = {
  "USDT>BNB": 0.0018,
  "BNB>USDT": 555,
  "USDT>BTC": 0.000015,
  "BTC>USDT": 65000,
};

export class MockBinanceAdapter implements WalletAdapter {
  private balances: Balance[];
  private address = "demo-binance-0xFUNDPILOT";
  private history: TxRecord[] = [];

  constructor(seed: Balance[] = DEFAULT_BALANCES) {
    this.balances = seed.map((b) => ({ ...b }));
  }

  async status(): Promise<WalletStatus> {
    return {
      connected: true,
      mode: "demo",
      address: this.address,
      message: "Mock Binance adapter — no secrets required.",
    };
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async getBalances(): Promise<Balance[]> {
    return this.balances.map((b) => ({ ...b }));
  }

  private ensure(asset: string, amount: number) {
    const row = this.balances.find((b) => b.asset === asset);
    if (!row || row.free < amount) {
      throw new Error(`Insufficient ${asset}: need ${amount}, have ${row?.free ?? 0}`);
    }
    return row;
  }

  async send(params: SendParams): Promise<{ txId: string }> {
    const row = this.ensure(params.asset, params.amount);
    row.free = Number((row.free - params.amount).toFixed(8));
    const txId = `mock_${randomUUID().slice(0, 8)}`;
    this.history.unshift({
      id: txId,
      at: new Date().toISOString(),
      type: "send",
      asset: params.asset,
      amount: params.amount,
      counterparty: params.to,
      status: "filled",
    });
    return { txId };
  }

  async quote(params: SwapParams): Promise<QuoteResult> {
    const key = `${params.fromAsset}>${params.toAsset}`;
    const rate = RATES[key];
    if (!rate) throw new Error(`No mock market for ${key}`);
    return {
      fromAsset: params.fromAsset,
      toAsset: params.toAsset,
      amountIn: params.amount,
      amountOut: Number((params.amount * rate).toFixed(8)),
      rate,
    };
  }

  async swap(params: SwapParams): Promise<{ txId: string; quote: QuoteResult }> {
    const quote = await this.quote(params);
    const from = this.ensure(params.fromAsset, params.amount);
    from.free = Number((from.free - params.amount).toFixed(8));
    let to = this.balances.find((b) => b.asset === params.toAsset);
    if (!to) {
      to = { asset: params.toAsset, free: 0, locked: 0 };
      this.balances.push(to);
    }
    to.free = Number((to.free + quote.amountOut).toFixed(8));
    const txId = `swap_${randomUUID().slice(0, 8)}`;
    this.history.unshift({
      id: txId,
      at: new Date().toISOString(),
      type: "swap",
      asset: params.fromAsset,
      amount: params.amount,
      counterparty: params.toAsset,
      status: "filled",
    });
    return { txId, quote };
  }

  async txHistory(limit = 20): Promise<TxRecord[]> {
    return this.history.slice(0, limit);
  }
}
