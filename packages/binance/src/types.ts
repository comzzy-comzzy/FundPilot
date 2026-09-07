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

export type BawConnectionStatus = "UNCONNECTED" | "CREATING" | "CONNECTED" | "UNKNOWN";

export interface WalletStatus {
  connected: boolean;
  mode: "demo" | "baw";
  address?: string;
  message: string;
  /** Raw BAW wallet status when mode=baw */
  bawStatus?: BawConnectionStatus;
  /** True when the baw binary is missing from PATH */
  cliMissing?: boolean;
}

export interface AuthSigninResult {
  alreadyConnected?: boolean;
  urlForWeb?: string;
  qrCodeId?: string;
  expireAt?: string;
  pairingCode?: string;
  status?: string;
}

export interface AuthVerifyResult {
  status: string;
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

/** Optional auth surface for BAW (demo mock does not implement these). */
export interface AuthCapableAdapter {
  authSignin(): Promise<AuthSigninResult>;
  authVerify(qrCodeId: string): Promise<AuthVerifyResult>;
  authSignout(): Promise<{ status: string }>;
  checkCli(): Promise<{ available: boolean; version?: string; error?: string }>;
}

export function isAuthCapable(adapter: WalletAdapter): adapter is WalletAdapter & AuthCapableAdapter {
  const a = adapter as unknown as AuthCapableAdapter;
  return typeof a.authSignin === "function" && typeof a.authVerify === "function";
}
