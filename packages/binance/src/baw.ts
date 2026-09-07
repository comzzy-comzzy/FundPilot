/**
 * Binance Agentic Wallet adapter — shells out to the baw CLI.
 * Install globally: @binance/agentic-wallet (binary: baw)
 * Docs: https://github.com/binance/binance-skills-hub
 * Always pass --json. Auth: signin -> verify. Wallet: status/address/balance.
 * Send/swap are stubbed (no real money movement).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Balance } from "@fundpilot/core";
import type {
  AuthCapableAdapter,
  AuthSigninResult,
  AuthVerifyResult,
  BawConnectionStatus,
  QuoteResult,
  SendParams,
  SwapParams,
  TxRecord,
  WalletAdapter,
  WalletStatus,
} from "./types.js";

const execFileAsync = promisify(execFile);

export interface BawOptions {
  cli?: string;
  profile?: string;
  timeoutMs?: number;
}

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

interface BawEnvelope<T = unknown> {
  success?: boolean;
  data?: T;
  error?: { code?: number; name?: string; message?: string } | string;
}

export class BawCliError extends Error {
  readonly code?: string | number;
  readonly cliMissing: boolean;
  constructor(message: string, opts?: { code?: string | number; cliMissing?: boolean }) {
    super(message);
    this.name = "BawCliError";
    this.code = opts?.code;
    this.cliMissing = Boolean(opts?.cliMissing);
  }
}

export class BawAdapter implements WalletAdapter, AuthCapableAdapter {
  readonly cli: string;
  readonly profile?: string;
  readonly timeoutMs: number;

  constructor(opts: BawOptions = {}) {
    this.cli = opts.cli || process.env.BAW_CLI || "baw";
    this.profile = opts.profile || process.env.BAW_PROFILE;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  command(name: keyof typeof BAW_COMMANDS, extra: string[] = []): string[] {
    const base = [...BAW_COMMANDS[name], ...extra, "--json"];
    return this.profile ? ["--profile", this.profile, ...base] : base;
  }

  async checkCli(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { stdout } = await execFileAsync(this.cli, ["--version"], {
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
      return { available: true, version: stdout.trim() || undefined };
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: string };
      if (err.code === "ENOENT") {
        return { available: false, error: "baw CLI not found. Install with: npm i -g @binance/agentic-wallet" };
      }
      return { available: false, error: err.stderr?.trim() || err.message || String(e) };
    }
  }

  private async runJson<T>(args: string[], timeoutMs = this.timeoutMs): Promise<T> {
    let stdout = "";
    let stderr = "";
    try {
      const result = await execFileAsync(this.cli, args, {
        timeout: timeoutMs,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      });
      stdout = result.stdout || "";
      stderr = result.stderr || "";
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
      if (err.code === "ENOENT") {
        throw new BawCliError("baw CLI not found. Install with: npm i -g @binance/agentic-wallet", { cliMissing: true, code: "ENOENT" });
      }
      stdout = err.stdout || "";
      stderr = err.stderr || "";
      const parsed = this.tryParseEnvelope(stdout || stderr);
      if (parsed) {
        if (parsed.success === false) throw this.toCliError(parsed);
        if (parsed.data !== undefined) return parsed.data as T;
      }
      if (err.killed) {
        throw new BawCliError(`baw timed out after ${timeoutMs}ms`, { code: "TIMEOUT" });
      }
      throw new BawCliError(stderr.trim() || err.message || "baw failed", { code: err.code });
    }
    const envelope = this.tryParseEnvelope(stdout);
    if (!envelope) {
      throw new BawCliError(`Could not parse baw JSON: ${(stdout || stderr).slice(0, 400)}`);
    }
    if (envelope.success === false) throw this.toCliError(envelope);
    return envelope.data as T;
  }

  private tryParseEnvelope(raw: string): BawEnvelope | null {
    const text = raw.trim();
    if (!text) return null;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(text.slice(start, end + 1)) as BawEnvelope; }
    catch { return null; }
  }

  private toCliError(envelope: BawEnvelope): BawCliError {
    const err = envelope.error;
    if (typeof err === "string") return new BawCliError(err);
    if (err && typeof err === "object") {
      return new BawCliError(err.message || err.name || "baw error", { code: err.code ?? err.name });
    }
    return new BawCliError("baw returned success=false");
  }

  async authSignin(): Promise<AuthSigninResult> {
    const data = await this.runJson<Record<string, unknown>>(this.command("authSignin"));
    if (data?.status === "ALREADY_CONNECTED") {
      return { alreadyConnected: true, status: "ALREADY_CONNECTED" };
    }
    return {
      urlForWeb: String(data?.urlForWeb ?? ""),
      qrCodeId: String(data?.qrCodeId ?? ""),
      expireAt: data?.expireAt != null ? String(data.expireAt) : undefined,
      pairingCode: String(data?.pairingCode ?? ""),
    };
  }

  async authVerify(qrCodeId: string): Promise<AuthVerifyResult> {
    if (!qrCodeId) throw new BawCliError("qrCodeId is required for auth verify");
    const data = await this.runJson<{ status?: string }>(
      this.command("authVerify", ["--qrCodeId", qrCodeId]),
      320_000
    );
    return { status: data?.status || "SUCCESS" };
  }

  async authSignout(): Promise<{ status: string }> {
    const data = await this.runJson<{ status?: string }>(this.command("authSignout"));
    return { status: data?.status || "LOGGED_OUT" };
  }

  async status(): Promise<WalletStatus> {
    const cli = await this.checkCli();
    if (!cli.available) {
      return {
        connected: false, mode: "baw", cliMissing: true, bawStatus: "UNCONNECTED",
        message: cli.error || "baw CLI missing",
      };
    }
    try {
      const data = await this.runJson<{ status?: string }>(this.command("walletStatus"));
      const bawStatus = (data?.status || "UNKNOWN") as BawConnectionStatus;
      const connected = bawStatus === "CONNECTED";
      let address: string | undefined;
      if (connected) { try { address = await this.getAddress(); } catch { /* optional */ } }
      const message =
        bawStatus === "CONNECTED" ? "Binance Agentic Wallet connected."
        : bawStatus === "CREATING" ? "Wallet is being set up — wait and refresh."
        : "Not signed in. Use Connect Binance.";
      return { connected, mode: "baw", bawStatus, address, message };
    } catch (e) {
      if (e instanceof BawCliError && e.cliMissing) {
        return { connected: false, mode: "baw", cliMissing: true, bawStatus: "UNCONNECTED", message: e.message };
      }
      return { connected: false, mode: "baw", bawStatus: "UNKNOWN", message: e instanceof Error ? e.message : String(e) };
    }
  }

  async getAddress(): Promise<string> {
    const data = await this.runJson<{
      addresses?: Array<{ address?: string; binanceChainId?: string; chainName?: string }>;
      address?: string;
    }>(this.command("walletAddress"));
    if (typeof data?.address === "string" && data.address) return data.address;
    const list = data?.addresses || [];
    const bsc = list.find((a) => a.binanceChainId === "56");
    const first = bsc || list[0];
    if (first?.address) return first.address;
    throw new BawCliError("No wallet address returned. Are you signed in?");
  }

  async getBalances(): Promise<Balance[]> {
    const data = await this.runJson<Array<{
      symbol?: string; balance?: string | number; binanceChainId?: string; price?: string; value?: string;
    }>>(this.command("walletBalance"));
    const rows = Array.isArray(data) ? data : [];
    const map = new Map<string, Balance>();
    for (const row of rows) {
      const asset = String(row.symbol || "UNKNOWN");
      const free = Number(row.balance ?? 0);
      const prev = map.get(asset);
      if (prev) prev.free = Number((prev.free + free).toFixed(8));
      else map.set(asset, { asset, free, locked: 0 });
    }
    return [...map.values()];
  }

  async send(_p: SendParams): Promise<{ txId: string }> {
    throw new BawCliError("send is not enabled in this FundPilot build (auth + balances only).");
  }

  async quote(_p: SwapParams): Promise<QuoteResult> {
    throw new BawCliError("quote/swap is not enabled in this FundPilot build (auth + balances only).");
  }

  async swap(_p: SwapParams): Promise<{ txId: string; quote: QuoteResult }> {
    throw new BawCliError("swap is not enabled in this FundPilot build (auth + balances only).");
  }

  async txHistory(limit = 20): Promise<TxRecord[]> {
    const data = await this.runJson<{
      transactions?: Array<{
        txType?: string; txHash?: string; txTime?: string; status?: string;
        txHashList?: Array<{ instructions?: { send?: Array<{
          amount?: string; addressInfo?: { address?: string };
          tokenInfo?: { symbol?: string; decimals?: number };
        }> } }>;
      }>;
    }>(this.command("walletTxHistory", ["--size", String(limit)]));
    const txs = data?.transactions || [];
    return txs.map((tx, i) => {
      const send0 = tx.txHashList?.[0]?.instructions?.send?.[0];
      const decimals = send0?.tokenInfo?.decimals ?? 18;
      const rawAmt = send0?.amount ? Number(send0.amount) : 0;
      const amount = rawAmt ? rawAmt / 10 ** decimals : 0;
      return {
        id: tx.txHash || `baw_${i}`,
        at: tx.txTime || new Date().toISOString(),
        type: tx.txType || "unknown",
        asset: send0?.tokenInfo?.symbol || "UNKNOWN",
        amount,
        counterparty: send0?.addressInfo?.address || "",
        status: tx.status || "unknown",
      };
    });
  }
}

export const BawAuthCommands = {
  signin: "baw auth signin --json",
  verify: "baw auth verify --qrCodeId <qrCodeId> --json",
  signout: "baw auth signout --json",
  status: "baw wallet status --json",
  balance: "baw wallet balance --json",
  settings: "baw wallet settings --json",
} as const;
