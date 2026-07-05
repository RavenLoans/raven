# RAVEN — Design Doc

**"The raven remembers."** A permissionless Solana lending protocol: borrow SOL against memecoins, xStocks, and majors — with in-loan take-profit/stop auto-sells and an on-chain memory (credit score) that rewards good borrowers. Web-first reimplementation-and-improvement of Magpie Capital (github.com/magpiecapital — studied in `_reference/magpie/`, code unlicensed → clean reimplementation, NOVA pattern, no code copied).

## Magpie mechanics (extracted from source, kept faithful)

| Mechanic | Value |
|---|---|
| Loan tiers | **Express** 30% LTV · 2 days · 300 bps fee · **Quick** 25% · 3d · 200 bps · **Standard** 20% · 7d · 150 bps |
| Fee formula | fee accrues in SOL: `debt = principal × (1 + feeBps/10000)`; extending re-applies tier fee |
| Fee split | LP pool gets the lion's share · token holders get a large cut (their site: 70% of every loan fee) · referrals 5% |
| Liquidation keeper | off-chain watcher, ~90s tick; fixed liq price computed at loan open |
| Auto-protect | borrower sets TP/SL on collateral *while it's locked in-loan*; keeper executes sells, proceeds repay debt first, surplus to borrower |
| Credit | reputation/credit score from repayment history; better history → better terms (their v3/oracle direction) |
| Collateral | screened token catalog (memecoins, xStocks, majors) w/ risk engine + per-token enable flags |
| Agent API | x402 pay-per-call borrow API (their repo MIT) |

## RAVEN improvements (the pitch)

1. **Web-first, custody-honest.** Magpie is a custodial Telegram bot ("your Magpie wallet IS the bot wallet"). RAVEN ships the full engine in the browser with **paper custody at launch** — real live prices, real liquidation engine, simulated balances — and real custody explicitly gated behind an audit (roadmap). Marketing line: *"your keys never live in a Telegram bot."*
2. **The Ledger of the Raven** — every loan, auto-sell, liquidation, and fee split is a public receipt (ATLAS transparency muscle). Protocol wallets linked on-site.
3. **Credit = memory, front and center.** Score visible per wallet, terms improve with history: score unlocks +LTV bps and fee discounts (deterministic table, published).
4. **Holder fee-share ledger** — 70% of fees accrue to $RAVEN holders pro-rata, visible per-wallet on-site (distribution mechanics = STARFALL payout pattern later).
5. **x402 agent-borrow API** — adapted from their MIT repo; agents can quote/borrow programmatically (paper mode).

## Our parameters (published, transparent)

- Liquidation: liq price fixed at open = price where collateral value = debt × **1.15** (Standard/Quick) or × **1.10** (Express). Keeper tick 15s (beat their 90s).
- Credit score 0–1000, starts 300: +40 per clean repay (scaled by size), −250 liquidation, −80 late. Tiers: 600+ = "Fledged" (+2% LTV), 800+ = "Unkindness" (+4% LTV, −25 bps fee).
- Fee split: 70% holders · 20% LP · 5% referral · 5% protocol.
- Paper mode: every wallet starts with 0; deposit = paste any Solana wallet, we read their REAL token balances (RPC) and let them open paper loans against real holdings at real prices — "try the protocol against your actual bag, risk-free." (Killer demo feature — no custody, real personal numbers.)
- Prices: Jupiter Price API (lite-api.jup.ag/price/v3) — works for any mint; majors cross-checked vs Pyth Hermes.

## Stack

- `raven/server/index.js` — dependency-free Node (http + hand-rolled WS): price poller, loan engine, liquidation+auto-protect keeper (15s), credit ledger, fee-split ledger, receipts, catalog (curated mint list), /api/* + WS push. Port **8120**. DATA_PATH for Railway volume.
- `raven/client/` — index.html (landing) + app.html (dashboard): borrow flow (pick token → amount → tier → live liq price preview), positions w/ TP/SL arming, LP page, credit page, receipts tape, holder fee ledger.
- Aesthetic: **raven-feather iridescence** — near-black `#08080d`, oil-slick gradient accents (teal `#4de3c0` → violet `#8b7bff` → magenta `#e07bff`), bone-white text `#efeef5`. Fonts: Syne (display) + Inter (UI) + JetBrains Mono (data). Feather/beak mark.
- Studio + X kit + demo later, after core ships.

## Status / next

- [x] Recon (magpie repos cloned to _reference/magpie/, params extracted)
- [ ] Server engine (catalog, prices, tiers, loans, keeper, credit, fees, receipts)
- [ ] Client dashboard + landing
- [ ] Studio brand kit, X kit, demo.mp4
- [ ] Deploy (Railway) + domain (ravenloans.xyz? user picks) + launch $RAVEN
