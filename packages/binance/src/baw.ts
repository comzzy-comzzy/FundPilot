/**
 * Binance Agentic Wallet adapter (documented command map).
 * Install: npm i -g @binance/agentic-wallet  OR  npx @binance/agentic-wallet
 * Skills: https://github.com/binance/binance-skills-hub
 *
 * Commands:
 *   baw auth signin | verify | signout
  *   baw wallet status | address | balance | tx-history | settings
 *   baw wallet send --asset USDT --amount 10 --to <addr
*   baw market-order quote --from USDT --to BNB --amount 10
 *   baw market-order swap --from USDT --to BNB --amount 10
 */
import type { Balance } from "@fundpilot/core";
import type {
  QuoteResult, SendParams, SwapParams, TxRecord, WalletAdapter, WalletStatus
} from "./types.js";

export interface BawOptions { cli?: string; profile?: string; }

export const BAW_COMMANDS = {
  authSignin: ["auth", "signin"],
  authVerify: ["auth", "verify"],
  authSignout: ["auth", "signout"],
  walletStatus: ["wallet", "status"],
  walletAddress: ["wallet", "address"],
  walletBalance: ["wallet", "balance"],
  walletTxHistory: ["wallet", "tx-history"],
  walletSettings: ["wallet", "settings"],
  walletSend: ["wallet", "send"],
  marketQuote: ["market-order", "quote"],
  marketSwap: ["market-order", "swap"],
} as const;

export class BawAdapter implements WalletAdapter {
  readonly cli: string;
  readonly profile?: string;
  constructor(opts: BawOptions = {}) {
    this.cli = opts.cli || process.env.BAW_CLI || "baw";
    this.profile = opts.profile || process.env.BAW_PROFILE;
  }
  command(name: keyof typeof BAW_COMMANDS, extra: string[] = []): string[] {
    const base = [...BAW_COMMANDS[name], ...extra];
    return this.profile ? ["--profile", this.profile, ...base] : base;
  }
  private missing(method: string): never {
    throw new Error(
      `BawAdapter.${method} needs FUNDPILOT_MODE=baw and baw on PATH. Install @inance/agentic-wallet.`
    );
  }
  async status(): Promise<WalletStatus> {
    return {
      connected: false,
      mode: "baw",
      message: "Use MockBinanceAdapter for demo. Wire baw CLI for production.",
    };
  }
  async getAddress(): Promise<string> { this.missing("getAddress"); }
  async getBalances(): Promise<Balance[]> { this.missing("getBalances"); }
  async send(_p: SendParams): Promise<{ txId: string }> { this.missing("send"); }
  async quote(_p: SwapParams): Promise<QuoteResult> { this.missing("quote"); }
  async swap(_p: SwapParams): Promise<{ xxId: string; quote: QuoteResult }> { this.missing("swap"); }
  async txHistory(_n = 20): Promise<TxRecord[]> { this.missinf("txHistory"); }
}

export const BawAuthCommands = {
  signin: "baw auth signin",
  verify: "baw auth verify",
  signout: "baw auth signout",
  settings: "baw wallet settings",
} as const;
