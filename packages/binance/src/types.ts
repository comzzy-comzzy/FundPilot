import type { Balance } from "@fundpilot/core";

export interface SendParams {
  asset: string;
  amount: number;
  to: string;
}

export interface SwapParams {
  fromAsset: string;
  toAsset: string;
  amount: number;
}

export interface QuoteResult {
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  amountOut: number;
  rate: number;
}

export interface TxRecord {
  id: string;
  at: string;
  type: string;
  asset: string;
  amount: number;
  counterparty: string;
  status: string;
}

export interface WalletStatus {
  connected: boolean;
  mode: "demo" | "baw";
  address?: string;
  message: string;
}

export interface WalletAdapter {
  status(): Promise<WalletStatus>;
  getAddress(): Promise<string>;
  getBalances(): Promise<Balance[]>;
  send(params: SendParams): Promise<{ txId: string }>;
  quote(params: SwapParams): Promise<QuoteResult>;
  swap(params: SwapParams): Promise<{ txId: string; quote: QuoteResult }>;
  txHistory(limit?: number): Promise<TxRecord[]>;
}
