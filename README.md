# FundPilot

**Your money. Your rules. One operator.**

FundPilot is an autonomous financial operations layer for the Binance Agent OS hackathon. It sits between what you want done with your money and the action that follows: it understands intent, applies your rules, executes what is allowed, and asks when judgment is needed.

This is not a chatbot, a payment bot, or autopilot. It is a queue of financial decisions with a policy firewall.

## Product

- **Understand** the instruction, balances, and what is actually due
- **Check rules** — limits, new payees, duplicates, reserve floor, unusual activity
- **Act or ask** — allowed work runs; everything else waits in the queue
- **Record why** every allow, block, delay, or request is explained

Binance is the core financial infrastructure. On-chain wallets are used only when that is the right tool.

## Local preview

This folder is a static site. From `web/`:

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080

## Stack

- `index.html` — landing page
- `styles.css` — layout and 3D phone carousel
- `app.js` — carousel, demo modal, mobile menu
- `assets/` — logo and reference images
