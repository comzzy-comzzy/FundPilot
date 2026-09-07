import type { Intent, IntentAction } from "./types.js";

const AMOUNT_RE = /\$\s*([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)\s*(?:usd|usdt)/i;
const RECIPIENT_RE =
  /(?:to|pay(?:\s+to)?|send(?:\s+to)?|vendor|contractor|invoice(?:\s+to)?)\s+([A-Za-z][A-Za-z0-9_\-\s]{1,40}?)(?=\s+(?:\$|due|usdt|usd)|$)/i;

export function parseIntent(text: string): Intent {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  let action: IntentAction = "unknown";
  if (/\bswap\b/.test(lower)) action = "swap";
  else if (/\bsend\b/.test(lower)) action = "send";
  else if (/\bpay\b|\binvoice\b|\btransfer\b/.test(lower)) action = "pay";

  const amountMatch = raw.match(AMOUNT_RE);
  const amount = amountMatch
    ? parseFloat(amountMatch[1] || amountMatch[2] || "0")
    : 0;

  let recipient = "unknown";
  const named = lower.match(
    /\b(contractor|payroll|alice|rent|utilities|acme|vendor)\b/
  );
  if (named) {
    recipient = named[1];
  } else {
    const m = raw.match(RECIPIENT_RE);
    if (m) recipient = m[1].trim().toLowerCase().replace(/\s+/g, " ");
  }

  // Prefer explicit "new vendor X"
  const vendor = lower.match(/new vendor\s+([a-z0-9_\-]+)/i);
  if (vendor) recipient = vendor[1].toLowerCase();

  // "Pay invoice $X" has no named counterparty
  if (/\bpay\s+invoice\b/.test(lower) && !vendor) {
    recipient = "invoice-payee";
  }

  const dueToday = /due today|today|overdue/.test(lower);
  const asset = /\bbnb\b/.test(lower)
    ? "BNB"
    : /\bbtc\b/.test(lower)
      ? "BTC"
      : "USDT";

  return {
    raw,
    action: action === "unknown" && amount > 0 ? "pay" : action,
    amount,
    asset,
    recipient,
    dueToday,
    notes: raw,
  };
}
