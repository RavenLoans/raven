# RAVEN 🪶

**Borrow SOL against your bag — without letting go.**

RAVEN is a web-first lending protocol on Solana. Pledge what you already hold — memecoins
(up to 30% LTV) or tokenized stocks (up to 70% LTV, 30-day terms) — and take SOL without
selling. Arm take-profits and stops on that collateral *while it's pledged*, and build an
on-chain credit score with every clean repay.

**Live:** [ravenloans.xyz](https://ravenloans.xyz) · **X:** [@RavenLoans](https://x.com/RavenLoans)

---

## What makes it different

- **Collateral that can still sell itself.** Set a take-profit or stop-loss on your pledged
  collateral. A 15-second keeper watches every open loan and executes — selling, clearing the
  debt, and returning your surplus.
- **The raven remembers.** An on-chain credit score (Hatchling → Fledged → Unkindness) that
  rises with clean repays and unlocks higher LTV and lower fees. Earned by repaying, never
  bought by holding.
- **Non-custodial by design.** Connecting a wallet reads your public address only — RAVEN
  never requests a signature and cannot move your funds.
- **Two asset classes.** Memecoins/majors *and* tokenized stocks (Backed xStocks — AAPL,
  NVDA, TSLA, COIN, gold, and more), each with its own volatility-tuned tiers.
- **Receipts for everything.** Every borrow, repay, auto-sell, liquidation, and fee split is a
  public, append-only receipt, streamed live.

## Tiers

| Class | Tier | Max LTV | Term | Fee |
|---|---|---|---|---|
| Memecoin | Express / Quick / Standard | 30% / 25% / 20% | 2d / 3d / 7d | 3% / 2% / 1.5% |
| RWA | Express / Quick / Standard | 50% / 60% / 70% | 7d / 15d / 30d | 3% / 4% / 5% |

Fees split **70% to $RAVEN holders · 20% LP · 5% referral · 5% protocol.**

## Architecture

Dependency-free Node backend + a browser client. No framework, no database server — a tight
event loop:

- **Price poller** — one batched Jupiter Price API call values the full catalog + SOL every 18s.
- **Loan engine** — quoting, borrow/repay/close, the credit ledger, the fee-split ledger, and
  an append-only receipt log.
- **The keeper** — a 15-second tick that resolves take-profit, stop-loss, health-floor, and
  term-expiry conditions on every open loan.
- **Live feed** — a hand-rolled WebSocket pushes receipts and price updates to clients.

```
server/        dependency-free Node http + WebSocket engine
client/        landing (index.html), dashboard (app.html), docs (docs.html)
_studio/       brand-kit generator (build.js) + rasterizer (render.js)
```

## Run

```bash
node server/index.js     # http://localhost:8120
```

| Env | Purpose |
|---|---|
| `PORT` | listen port (default 8120) |
| `DATA_PATH` | ledger file path (set to a mounted volume in prod) |
| `RAVEN_MINT` | $RAVEN token mint — arms the CA on the site |
| `RPC_URL` | Solana RPC for wallet balance reads |

Full technical documentation is served at [`/docs`](https://ravenloans.xyz/docs).

## Status & honesty

RAVEN reads live prices and real wallet balances from mainnet; loan balances and settlement
are **simulated** until the on-chain program is audited. Real custody ships only after that
audit. $RAVEN is a memecoin with no promise of value, yield, or profit. Tokenized stocks are
Backed xStocks priced via Jupiter and are not issued or endorsed by RAVEN. Nothing here is
financial advice.

## Lineage

RAVEN is an independent, clean-room implementation of the "borrow-against-your-bag with
in-loan auto-sells and on-chain credit" lending model. No third-party code was copied.

## License

MIT — see [LICENSE](LICENSE).
