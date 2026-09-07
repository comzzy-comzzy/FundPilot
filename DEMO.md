# FundPilot demo scenarios

Run: `npm install && npm run demo`

Demo mode uses the mock Binance adapter. No API keys.

## Shared setup

| Setting | Value |
|--------|-------|
| Starting USDT (demo engine) | ~1800 (makes reserve rule observable) |
| Reserve floor | 1000 USD |
| Approval threshold | 500 USD |
| Known recipients | payroll, contractor, alice, rent, utilities |

Landing marketing UI may show a larger illustrative balance.

## Scenario 1 — Contractor 650 due today

**Input:** Pay contractor $650 due today

**Expected:**
- Status: `pending` (needs approval)
- Reasons include: amount exceeds $500 threshold
- Priority: `high` (due today)
- Does not auto-execute

**Operator path:** Approve then Execute; audit records propose/approve/execute.

## Scenario 2 — New recipient 420

**Input:** Send $420 to new vendor Acme

**Expected:**
- Status: `pending`
- Reasons include: new recipient not on allow-list

## Scenario 3 — Reserve break 1200

**Input:** Pay invoice $1200 due today

**Expected:**
- Status: `blocked`
- Reasons include: would break $1000 reserve
- Cannot execute without policy/balance change

## Bonus — Auto-allow

**Input:** Pay utilities $40

**Expected:**
- Status: `executed` immediately
- All policy checks passed

## MCP smoke

```bash
npm run mcp
```

## Operator UI

```bash
npm run operator
# open http://127.0.0.1:3847
```
