// RAVEN — "The raven remembers." Web-first lending against memecoins/majors with in-loan
// TP/SL auto-sells, a liquidation keeper, credit memory, and receipts for everything.
// Clean reimplementation of the Magpie mechanics (no code copied — see DESIGN.md).
// Dependency-free: Node http + crypto, hand-rolled WebSocket. PAPER CUSTODY (disclosed):
// real live prices, real wallet balance reads, simulated balances — custody comes after audit.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = +(process.env.PORT || 8120);
const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const TOKEN = 'RAVEN';
const MINT = process.env.RAVEN_MINT || 'irP71XdKsT39Mmntx3STCqwMhrUsfC9bWNeB8tGpump';
const RPC = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const PRICE_URL = 'https://lite-api.jup.ag/price/v3?ids=';
const SOL_MINT = 'So11111111111111111111111111111111111111112';
// ---------- NEVERMORE — the AI credit engine (Anthropic) ----------
const AI_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const AI_MODEL = process.env.NEVERMORE_MODEL || 'claude-haiku-4-5-20251001';
const AI_MOCK = !AI_KEY && process.env.NEVERMORE_MOCK === '1'; // dev-only UI verification, no LLM
const AI_ON = !!AI_KEY || AI_MOCK;

// ---------- protocol parameters (published, deterministic) ----------
// memecoins: volatile → lower LTV, short terms. RWAs (tokenized stocks/ETFs/metals):
// meaningfully lower volatility → up to 70% LTV and 30-day terms.
const TIERS = {
  express:      { label: 'Express',      cls: 'meme', ltv: 0.30, days: 2,  feeBps: 300, liqBuffer: 1.10 },
  quick:        { label: 'Quick',        cls: 'meme', ltv: 0.25, days: 3,  feeBps: 200, liqBuffer: 1.15 },
  standard:     { label: 'Standard',     cls: 'meme', ltv: 0.20, days: 7,  feeBps: 150, liqBuffer: 1.15 },
  rwa_express:  { label: 'RWA Express',  cls: 'rwa',  ltv: 0.50, days: 7,  feeBps: 300, liqBuffer: 1.08 },
  rwa_quick:    { label: 'RWA Quick',    cls: 'rwa',  ltv: 0.60, days: 15, feeBps: 400, liqBuffer: 1.10 },
  rwa_standard: { label: 'RWA Standard', cls: 'rwa',  ltv: 0.70, days: 30, feeBps: 500, liqBuffer: 1.12 },
};
const FEE_SPLIT = { holders: 0.70, lp: 0.20, referral: 0.05, protocol: 0.05 };
const KEEPER_MS = 15000, PRICE_MS = 18000;
const CREDIT = { start: 300, repay: 40, protectExec: 20, late: -80, liquidated: -250, max: 1000, min: 0 };
const creditTier = (s) => s >= 800 ? { name: 'Unkindness', ltvBonus: 0.04, feeBpsOff: 25 }
  : s >= 600 ? { name: 'Fledged', ltvBonus: 0.02, feeBpsOff: 0 }
  : { name: 'Hatchling', ltvBonus: 0, feeBpsOff: 0 };
const DEMO_SOL = 0;                     // borrowers start with 0 SOL — loans create it
const LP_POOL_START = 10000;            // paper LP pool (SOL)

// collateral catalog — validated against live prices at boot; anything unpriced is disabled
const CATALOG = [
  // memecoins & majors
  { sym: 'BONK',    cls: 'meme', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' },
  { sym: 'WIF',     cls: 'meme', mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm' },
  { sym: 'JUP',     cls: 'meme', mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
  { sym: 'POPCAT',  cls: 'meme', mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr' },
  { sym: 'PENGU',   cls: 'meme', mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv' },
  { sym: 'TRUMP',   cls: 'meme', mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
  { sym: 'PUMP',    cls: 'meme', mint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn' },
  { sym: 'MAGPIE',  cls: 'meme', mint: '9UuLsJ3jf8ViBNeRcwXD53re5G3ypgfKK3s2EiMMpump' },  // yes, really
  { sym: 'ATLAS',   cls: 'meme', mint: '5juLvibGs9qpEsb9E8EYdDTRWyptY1dKZa7odgbUpump' },
  // tokenized stocks / ETFs / metals (Backed xStocks)
  { sym: 'AAPLx',   cls: 'rwa',  mint: 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp' },
  { sym: 'NVDAx',   cls: 'rwa',  mint: 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh' },
  { sym: 'TSLAx',   cls: 'rwa',  mint: 'XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB' },
  { sym: 'COINx',   cls: 'rwa',  mint: 'Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu' },
  { sym: 'MSTRx',   cls: 'rwa',  mint: 'XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ' },
  { sym: 'METAx',   cls: 'rwa',  mint: 'Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu' },
  { sym: 'GOOGLx',  cls: 'rwa',  mint: 'XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN' },
  { sym: 'SPYx',    cls: 'rwa',  mint: 'XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W' },
  { sym: 'GLDx',    cls: 'rwa',  mint: 'Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re' },
  { sym: 'HOODx',   cls: 'rwa',  mint: 'XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg' },
];

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const now = () => Date.now();
const isWallet = (s) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || '');

// ---------- persistence ----------
let db = null;
try { db = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); } catch (e) {}
if (!db) db = {
  accounts: {},        // wallet -> { sol, vault:{mint:amt}, credit, loansOpen:[], history, ref, refEarned, joined }
  loans: {},           // id -> loan
  seq: 1,
  receipts: [],
  fees: { total: 0, holders: 0, lp: 0, referral: 0, protocol: 0 },
  stats: { loans: 0, repaid: 0, liquidated: 0, protected: 0, borrowedSol: 0 },
  lp: { pool: LP_POOL_START, lent: 0 },
};
let DIRTY = false; const dirty = () => { DIRTY = true; };
setInterval(() => { if (DIRTY) { DIRTY = false; try { fs.writeFileSync(DATA_PATH, JSON.stringify(db)); } catch (e) {} } }, 2000);

// ---------- receipts ----------
function receipt(action, body) {
  const rc = Object.assign({ id: 'rvn-' + (db.seq++).toString(36), ts: now(), action }, body);
  db.receipts.push(rc); if (db.receipts.length > 500) db.receipts.splice(0, db.receipts.length - 500);
  cast({ type: 'receipt', receipt: rc });
  dirty();
  return rc;
}

// ---------- prices (Jupiter Price API v3, single batched call) ----------
const PRICES = {}; let PRICE_OK = false, SOLP = 0;
async function pollPrices() {
  try {
    const ids = [SOL_MINT].concat(CATALOG.map((c) => c.mint)).join(',');
    const r = await fetch(PRICE_URL + ids, { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    const j = await r.json();
    for (const [mint, v] of Object.entries(j)) {
      const p = +(v && (v.usdPrice ?? v.price));
      if (p > 0) PRICES[mint] = p;
    }
    SOLP = PRICES[SOL_MINT] || SOLP;
    PRICE_OK = SOLP > 0;
    cast({ type: 'prices', prices: pubPrices(), solUsd: SOLP });
  } catch (e) { /* keep last good */ }
}
function pubPrices() { const o = {}; for (const c of CATALOG) if (PRICES[c.mint]) o[c.sym] = PRICES[c.mint]; return o; }
function catalogPub() {
  return CATALOG.map((c) => ({ sym: c.sym, cls: c.cls, mint: c.mint, price: PRICES[c.mint] || null, enabled: !!PRICES[c.mint] }));
}

// ---------- real wallet balance read (the "your actual bag" feature) ----------
async function rpcCall(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
}
async function readBag(wallet) {
  const bag = {};
  for (const prog of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']) {
    try {
      const res = await rpcCall('getTokenAccountsByOwner', [wallet, { programId: prog }, { encoding: 'jsonParsed' }]);
      for (const a of res.value || []) {
        const info = a.account.data.parsed.info;
        const amt = +info.tokenAmount.uiAmount;
        if (amt > 0 && CATALOG.some((c) => c.mint === info.mint)) bag[info.mint] = (bag[info.mint] || 0) + amt;
      }
    } catch (e) {}
  }
  return bag;
}

// ---------- accounts ----------
function getAccount(wallet) { return db.accounts[wallet] || null; }
async function register(wallet, ref) {
  let a = db.accounts[wallet];
  if (!a) {
    a = db.accounts[wallet] = {
      sol: DEMO_SOL, vault: {}, credit: CREDIT.start, history: { repaid: 0, liquidated: 0, protected: 0 },
      ref: isWallet(ref) && ref !== wallet ? ref : null, refEarned: 0, joined: now(),
    };
    receipt('join', { wallet: short(wallet), summary: `a new raven lands. credit ${CREDIT.start} — the ledger starts remembering.` });
  }
  const bag = await readBag(wallet);      // refresh real holdings snapshot into the paper vault
  for (const [mint, amt] of Object.entries(bag)) {
    const locked = lockedOf(wallet, mint);
    a.vault[mint] = Math.max(a.vault[mint] || 0, amt) ;
    if (locked > (a.vault[mint] || 0)) a.vault[mint] = locked; // never strand a live loan
  }
  // empty nest? grant a paper demo bag (~$100 per token) so the protocol is instantly try-able
  if (Object.keys(a.vault).length === 0 && SOLP > 0) {
    a.demo = true;
    a.sol = r6(a.sol + 0.05);            // starter SOL so fees are repayable in paper mode
    for (const sym of ['BONK', 'WIF', 'JUP', 'TRUMP']) {
      const c = CATALOG.find((x) => x.sym === sym);
      if (c && PRICES[c.mint] > 0) a.vault[c.mint] = r4(100 / PRICES[c.mint]);
    }
    for (const sym of ['TSLAx', 'SPYx']) {   // a taste of the RWA side too
      const c = CATALOG.find((x) => x.sym === sym);
      if (c && PRICES[c.mint] > 0) a.vault[c.mint] = r4(150 / PRICES[c.mint]);
    }
    receipt('demo_bag', { wallet: short(wallet), summary: `${short(wallet)} arrived with an empty nest — granted a paper demo bag (~$700 across memes + tokenized stocks, plus 0.05 sol). real bags read automatically.` });
  }
  dirty();
  return a;
}
function lockedOf(wallet, mint) {
  let t = 0;
  for (const l of Object.values(db.loans)) if (l.wallet === wallet && l.status === 'open' && l.mint === mint) t += l.amount;
  return t;
}
const short = (w) => (w || '').slice(0, 4) + '…' + (w || '').slice(-4);

// ---------- quoting + loans ----------
function quote(mint, amount, tierKey, credit) {
  const t = TIERS[tierKey]; const p = PRICES[mint];
  const cat = CATALOG.find((x) => x.mint === mint);
  if (!t || !cat || t.cls !== cat.cls || !(p > 0) || !(SOLP > 0) || !(amount > 0)) return null;
  const ct = creditTier(credit ?? CREDIT.start);
  const ltv = t.ltv + ct.ltvBonus;
  const feeBps = Math.max(50, t.feeBps - ct.feeBpsOff);
  const valueSol = amount * p / SOLP;
  const principal = r6(valueSol * ltv);
  const fee = r6(principal * feeBps / 10000);
  const debt = r6(principal + fee);
  const liqPriceUsd = r6((debt * t.liqBuffer * SOLP) / amount);
  return { tier: t.label, ltv: r4(ltv), feeBps, valueSol: r6(valueSol), principal, fee, debt,
    liqPriceUsd, days: t.days, priceUsd: p, creditTier: ct.name };
}
function openLoan(wallet, mint, amount, tierKey) {
  const a = getAccount(wallet); if (!a) return { error: 'register first' };
  const c = CATALOG.find((x) => x.mint === mint); if (!c || !PRICES[mint]) return { error: 'collateral not enabled' };
  const free = (a.vault[mint] || 0) - lockedOf(wallet, mint);
  if (!(amount > 0) || amount > free + 1e-9) return { error: 'insufficient free collateral (vault holds ' + r4(free) + ' ' + c.sym + ')' };
  const q = quote(mint, amount, tierKey, a.credit); if (!q) return { error: 'cannot quote' };
  if (q.principal > db.lp.pool - db.lp.lent) return { error: 'LP pool utilization too high' };
  const id = 'loan-' + (db.seq++).toString(36);
  const loan = {
    id, wallet, mint, sym: c.sym, amount: r6(amount), tier: tierKey, status: 'open',
    principal: q.principal, fee: q.fee, debt: q.debt, ltv: q.ltv,
    openedAt: now(), dueAt: now() + q.days * 86400000, liqPriceUsd: q.liqPriceUsd,
    openPriceUsd: q.priceUsd, tp: null, sl: null,
  };
  db.loans[id] = loan;
  a.sol = r6(a.sol + q.principal);
  db.lp.lent = r6(db.lp.lent + q.principal);
  db.stats.loans++; db.stats.borrowedSol = r6(db.stats.borrowedSol + q.principal);
  receipt('borrow', { loan: id, wallet: short(wallet), sym: c.sym, amount: r4(amount), tier: q.tier,
    principal: q.principal, fee: q.fee, debt: q.debt, liqPriceUsd: q.liqPriceUsd,
    summary: `${short(wallet)} borrowed ${q.principal} sol against ${r4(amount)} ${c.sym} (${q.tier.toLowerCase()}, ltv ${(q.ltv * 100).toFixed(0)}%). liq at $${q.liqPriceUsd}. the raven remembers.` });
  return { loan, account: pubAccount(wallet) };
}
function splitFee(feeSol, wallet) {
  const a = getAccount(wallet);
  const f = db.fees;
  f.total = r6(f.total + feeSol);
  f.holders = r6(f.holders + feeSol * FEE_SPLIT.holders);
  f.lp = r6(f.lp + feeSol * FEE_SPLIT.lp);
  f.protocol = r6(f.protocol + feeSol * FEE_SPLIT.protocol);
  const refCut = feeSol * FEE_SPLIT.referral;
  if (a && a.ref && db.accounts[a.ref]) { db.accounts[a.ref].refEarned = r6(db.accounts[a.ref].refEarned + refCut); f.referral = r6(f.referral + refCut); }
  else f.protocol = r6(f.protocol + refCut);
}
function closeLoan(loan, kind, execPriceUsd, note) {
  const a = getAccount(loan.wallet);
  loan.status = kind; loan.closedAt = now(); loan.execPriceUsd = execPriceUsd || PRICES[loan.mint] || loan.openPriceUsd;
  db.lp.lent = r6(Math.max(0, db.lp.lent - loan.principal));
  if (kind === 'repaid') {
    a.sol = r6(a.sol - loan.debt);
    splitFee(loan.fee, loan.wallet);
    a.credit = Math.min(CREDIT.max, a.credit + CREDIT.repay);
    a.history.repaid++;
    db.stats.repaid++;
    receipt('repay', { loan: loan.id, wallet: short(loan.wallet), sym: loan.sym, debt: loan.debt,
      credit: a.credit, summary: `${short(loan.wallet)} repaid ${loan.debt} sol — ${r4(loan.amount)} ${loan.sym} released. credit → ${a.credit}. ${note || 'the ledger remembers the good ones too.'}` });
  } else {
    // liquidation or auto-sell: collateral sold at live price, debt repaid from proceeds
    const proceeds = r6(loan.amount * loan.execPriceUsd / SOLP);
    const surplus = r6(Math.max(0, proceeds - loan.debt));
    splitFee(loan.fee, loan.wallet);
    if (kind === 'liquidated') {
      a.sol = r6(a.sol + surplus * 0.95);            // 5% liquidation penalty on surplus
      a.credit = Math.max(CREDIT.min, a.credit + CREDIT.liquidated);
      a.history.liquidated++;
      db.stats.liquidated++;
      receipt('liquidate', { loan: loan.id, wallet: short(loan.wallet), sym: loan.sym, execPriceUsd: loan.execPriceUsd,
        proceeds, debtCleared: loan.debt, surplusReturned: r6(surplus * 0.95), credit: a.credit,
        summary: `liquidated: ${r4(loan.amount)} ${loan.sym} sold at $${loan.execPriceUsd} — debt ${loan.debt} sol cleared, ${r6(surplus * 0.95)} returned. credit → ${a.credit}. ${note || 'the raven remembers this, too.'}` });
    } else if (kind === 'sold') { // voluntary close-via-sell: collateral sold, debt cleared, surplus returned
      a.sol = r6(a.sol + surplus);
      a.credit = Math.min(CREDIT.max, a.credit + CREDIT.repay);
      a.history.repaid++;
      db.stats.repaid++;
      receipt('close_sell', { loan: loan.id, wallet: short(loan.wallet), sym: loan.sym, execPriceUsd: loan.execPriceUsd,
        proceeds, debtCleared: loan.debt, surplusReturned: surplus, credit: a.credit,
        summary: `${short(loan.wallet)} closed via sell: ${r4(loan.amount)} ${loan.sym} sold at $${loan.execPriceUsd}, debt ${loan.debt} sol cleared, ${surplus} sol returned. clean exit — credit → ${a.credit}.` });
    } else { // 'protected' — borrower's own TP/SL fired
      a.sol = r6(a.sol + surplus);
      a.credit = Math.min(CREDIT.max, a.credit + CREDIT.protectExec);
      a.history.protected++;
      db.stats.protected++;
      receipt('auto_sell', { loan: loan.id, wallet: short(loan.wallet), sym: loan.sym, execPriceUsd: loan.execPriceUsd,
        proceeds, debtCleared: loan.debt, surplusReturned: surplus, credit: a.credit,
        summary: `auto-sell: ${short(loan.wallet)}'s ${note} hit — ${r4(loan.amount)} ${loan.sym} sold at $${loan.execPriceUsd}, debt cleared, ${surplus} sol surplus returned. collateral that sells itself.` });
    }
  }
  dirty();
}

// ---------- the keeper (15s — 6× faster than the bird we replaced) ----------
function keeper() {
  if (!PRICE_OK) return;
  for (const loan of Object.values(db.loans)) {
    if (loan.status !== 'open') continue;
    const p = PRICES[loan.mint]; if (!(p > 0)) continue;
    const valueSol = loan.amount * p / SOLP;
    const t = TIERS[loan.tier];
    if (loan.sl && p <= loan.sl) { closeLoan(loan, 'protected', p, 'stop-loss $' + loan.sl); continue; }
    if (loan.tp && p >= loan.tp) { closeLoan(loan, 'protected', p, 'take-profit $' + loan.tp); continue; }
    if (valueSol <= loan.debt * t.liqBuffer) { closeLoan(loan, 'liquidated', p, 'health floor breached'); continue; }
    if (now() > loan.dueAt) { closeLoan(loan, 'liquidated', p, 'term expired'); continue; }
  }
}

// ---------- public projections ----------
function pubAccount(wallet) {
  const a = getAccount(wallet); if (!a) return null;
  const loans = Object.values(db.loans).filter((l) => l.wallet === wallet)
    .sort((x, y) => y.openedAt - x.openedAt).slice(0, 30)
    .map((l) => Object.assign({}, l, { wallet: undefined, priceUsd: PRICES[l.mint] || null,
      healthPct: l.status === 'open' && PRICES[l.mint] ? r2(100 * (l.amount * PRICES[l.mint] / SOLP) / (l.debt * TIERS[l.tier].liqBuffer)) : null }));
  const vault = {};
  for (const [mint, amt] of Object.entries(a.vault)) {
    const c = CATALOG.find((x) => x.mint === mint); if (!c) continue;
    vault[c.sym] = { total: r4(amt), locked: r4(lockedOf(wallet, mint)), free: r4(amt - lockedOf(wallet, mint)), priceUsd: PRICES[mint] || null };
  }
  return { wallet, sol: r6(a.sol), credit: a.credit, creditTier: creditTier(a.credit).name,
    history: a.history, refEarned: a.refEarned, vault, loans };
}
function stats() {
  const open = Object.values(db.loans).filter((l) => l.status === 'open');
  return {
    token: TOKEN, mint: MINT, paper: true, solUsd: r2(SOLP), priceLive: PRICE_OK,
    tiers: TIERS, feeSplit: FEE_SPLIT,
    loansOpen: open.length, loansTotal: db.stats.loans, repaid: db.stats.repaid,
    liquidated: db.stats.liquidated, protectedCount: db.stats.protected,
    borrowedSol: r2(db.stats.borrowedSol), lockedValueSol: r2(open.reduce((s, l) => s + (PRICES[l.mint] ? l.amount * PRICES[l.mint] / SOLP : 0), 0)),
    lp: { pool: r2(db.lp.pool), lent: r2(db.lp.lent), utilization: r4(db.lp.lent / db.lp.pool) },
    fees: db.fees, accounts: Object.keys(db.accounts).length,
  };
}

// ---------- NEVERMORE — AI credit engine ----------
// The model PROPOSES a loan structure; the deterministic quote() engine VALIDATES and
// computes every real number. The AI never touches funds — it reads and recommends only.
async function callClaude(system, user, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens || 700, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('anthropic http ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return (j.content || []).map((c) => c.text || '').join('').trim();
}
function bagContext(wallet) {
  const acc = pubAccount(wallet); if (!acc) return null;
  const holdings = Object.entries(acc.vault)
    .filter(([, v]) => v.free > 0 && v.priceUsd > 0)
    .map(([sym, v]) => {
      const c = CATALOG.find((x) => x.sym === sym);
      return { sym, cls: c ? c.cls : 'meme', free: v.free, priceUsd: v.priceUsd, usd: r2(v.free * v.priceUsd) };
    });
  const openLoans = acc.loans.filter((l) => l.status === 'open')
    .map((l) => ({ sym: l.sym, debtSol: l.debt, nowUsd: l.priceUsd, liqUsd: l.liqPriceUsd, health: l.healthPct, tp: l.tp, sl: l.sl }));
  return { credit: acc.credit, creditTier: acc.creditTier, solUsd: r2(SOLP), holdings, openLoans, sol: acc.sol };
}
const TIER_LINES = Object.entries(TIERS)
  .map(([k, t]) => `${k} (${t.cls}): ${(t.ltv * 100).toFixed(0)}% LTV, ${t.days}d, ${(t.feeBps / 100).toFixed(2)}% fee, liq buffer ${t.liqBuffer}`).join('\n');
async function advise(wallet) {
  if (!AI_ON) return { enabled: false };
  const ctx = bagContext(wallet);
  if (!ctx || !ctx.holdings.length) return { enabled: true, empty: true, message: 'No priceable collateral in this wallet yet.' };
  let rec;
  if (AI_MOCK) {
    const top = [...ctx.holdings].sort((a, b) => b.usd - a.usd)[0];
    rec = { pickSym: top.sym, tier: top.cls === 'rwa' ? 'rwa_standard' : 'quick', pledgeFraction: top.cls === 'rwa' ? 0.9 : 0.5,
      tpUsd: r6(top.priceUsd * 1.4), slUsd: r6(top.priceUsd * 0.82),
      headline: `Pledge half your ${top.sym} — quick tier, room to breathe`,
      reasoning: `${top.sym} is your deepest position at $${top.usd}. Pledging half keeps a reserve while the Quick tier gives you a comfortable 3-day window and a gentler ratio. Your stop sits well above the liquidation line.`,
      risk: `You're liquidated only if ${top.sym} falls sharply before the stop fires.` };
  } else {
  const system = `You are Nevermore, RAVEN's AI credit engine. RAVEN lets users borrow SOL against tokens without selling, with in-loan take-profit/stop-loss and a keeper checking every 15s. You PROPOSE a loan; deterministic rules enforce it. Tiers:\n${TIER_LINES}\nMemecoin tiers only apply to 'meme' collateral, RWA tiers only to 'rwa'. You value safety: recommend an amount of collateral to pledge (never all of it for volatile memes), a tier, and TP/SL levels that make sense vs current price and the liquidation buffer. Be sharp, confident, and concise. Return ONLY minified JSON, no prose, no markdown.`;
  const user = `Wallet context (JSON):\n${JSON.stringify(ctx)}\n\nRecommend the single best loan to open right now. Return ONLY this JSON shape:\n{"pickSym":"<symbol from holdings>","tier":"<tier key>","pledgeFraction":<0..1 of that token's free balance>,"tpUsd":<take-profit price or null>,"slUsd":<stop-loss price or null>,"headline":"<8-12 word punchy summary>","reasoning":"<2-3 sentences, plain English, why this pick/tier/amount>","risk":"<1 sentence on the liquidation risk>"}`;
  let raw = await callClaude(system, user, 700);
  const m = raw.match(/\{[\s\S]*\}/); if (m) raw = m[0];
  rec = JSON.parse(raw);
  }
  // ---- validate every number against the real engine ----
  const c = CATALOG.find((x) => x.sym === rec.pickSym);
  const h = ctx.holdings.find((x) => x.sym === rec.pickSym);
  if (!c || !h || !TIERS[rec.tier]) throw new Error('advisor picked something invalid');
  if (TIERS[rec.tier].cls !== c.cls) rec.tier = c.cls === 'rwa' ? 'rwa_standard' : 'standard';
  const frac = Math.max(0.05, Math.min(1, +rec.pledgeFraction || 0.5));
  const amount = r4(h.free * frac);
  const q = quote(c.mint, amount, rec.tier, ctx.credit);
  if (!q) throw new Error('quote failed for advised loan');
  // clamp TP/SL to sane bounds (sl above liq, below price; tp above price)
  let sl = +rec.slUsd || 0, tp = +rec.tpUsd || 0;
  if (!(sl > q.liqPriceUsd && sl < h.priceUsd)) sl = r6((q.liqPriceUsd + h.priceUsd) / 2);
  if (!(tp > h.priceUsd)) tp = r6(h.priceUsd * 1.35);
  return {
    enabled: true,
    ai: { headline: String(rec.headline || '').slice(0, 120), reasoning: String(rec.reasoning || '').slice(0, 400), risk: String(rec.risk || '').slice(0, 240) },
    rec: { sym: c.sym, mint: c.mint, tier: rec.tier, tierLabel: q.tier, amount, principal: q.principal, debt: q.debt,
      liqPriceUsd: q.liqPriceUsd, priceUsd: q.priceUsd, days: q.days, ltv: q.ltv, tp, sl },
  };
}
async function ask(wallet, question) {
  if (!AI_ON) return { enabled: false };
  if (AI_MOCK) return { enabled: true, answer: `Nevermore (demo): borrow against your lowest-volatility holding first, keep pledges to half your position on memecoins, and always arm a stop above the liquidation line. Connect the AI engine for a full answer to: "${String(question || '').slice(0, 120)}".` };
  const ctx = wallet && isWallet(wallet) ? bagContext(wallet) : null;
  const system = `You are Nevermore, RAVEN's AI lending copilot on Solana. RAVEN: borrow SOL against memecoins (to 30% LTV) & tokenized stocks (to 70% LTV, 30d), in-loan TP/SL, 15s keeper, on-chain credit score, non-custodial (no signatures). Tiers:\n${TIER_LINES}\nAnswer as a sharp, concise lending desk. Use the user's bag if provided. Never invent numbers — reason from the context. 2-5 sentences. No markdown headers.`;
  const user = (ctx ? `User's bag (JSON): ${JSON.stringify(ctx)}\n\n` : '') + `Question: ${String(question || '').slice(0, 500)}`;
  const text = await callClaude(system, user, 500);
  return { enabled: true, answer: text.slice(0, 900) };
}

// ---------- hand-rolled WebSocket ----------
const socks = new Set();
function frame(str) {
  const p = Buffer.from(str); const l = p.length; let h;
  if (l < 126) h = Buffer.from([0x81, l]);
  else if (l < 65536) { h = Buffer.alloc(4); h[0] = 0x81; h[1] = 126; h.writeUInt16BE(l, 2); }
  else { h = Buffer.alloc(10); h[0] = 0x81; h[1] = 127; h.writeBigUInt64BE(BigInt(l), 2); }
  return Buffer.concat([h, p]);
}
function cast(ev) { if (!socks.size) return; const f = frame(JSON.stringify(ev)); for (const s of socks) { try { s.write(f); } catch (e) { socks.delete(s); } } }

// ---------- http ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
const json = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(b); };
function body(req) { return new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 2e4) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch (e) { r({}); } }); }); }

const server = http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  const qs = new URLSearchParams(req.url.split('?')[1] || '');

  if (u === '/api/config') return json(res, 200, { token: TOKEN, mint: MINT, paper: true, tiers: TIERS, feeSplit: FEE_SPLIT, credit: CREDIT, keeperMs: KEEPER_MS, ai: AI_ON });
  if (u === '/api/advise') {
    const w = qs.get('wallet');
    if (!isWallet(w)) return json(res, 400, { error: 'invalid wallet' });
    try { return json(res, 200, await advise(w)); }
    catch (e) { return json(res, 200, { enabled: AI_ON, error: 'nevermore is thinking too hard — try again', detail: e.message }); }
  }
  if (req.method === 'POST' && u === '/api/ask') {
    const p = await body(req);
    try { return json(res, 200, await ask(p.wallet, p.q)); }
    catch (e) { return json(res, 200, { enabled: AI_ON, error: 'nevermore could not answer — try again', detail: e.message }); }
  }
  if (u === '/api/stats') return json(res, 200, stats());
  if (u === '/api/catalog') return json(res, 200, { catalog: catalogPub(), solUsd: r2(SOLP) });
  if (u === '/api/receipts') return json(res, 200, { receipts: db.receipts.slice(-(+qs.get('n') || 40)).reverse() });
  if (u === '/api/quote') {
    const q = quote(qs.get('mint'), +qs.get('amount'), qs.get('tier') || 'standard', +(qs.get('credit') || CREDIT.start));
    return json(res, q ? 200 : 400, q || { error: 'cannot quote' });
  }
  if (u === '/api/account') {
    const w = qs.get('wallet');
    return json(res, 200, { account: isWallet(w) ? pubAccount(w) : null });
  }
  if (req.method === 'POST' && u === '/api/register') {
    const p = await body(req);
    if (!isWallet(p.wallet)) return json(res, 400, { error: 'invalid wallet' });
    await register(p.wallet, p.ref);
    return json(res, 200, { account: pubAccount(p.wallet) });
  }
  if (req.method === 'POST' && u === '/api/borrow') {
    const p = await body(req);
    if (!isWallet(p.wallet)) return json(res, 400, { error: 'invalid wallet' });
    const r = openLoan(p.wallet, p.mint, +p.amount, p.tier);
    return json(res, r.error ? 400 : 200, r);
  }
  if (req.method === 'POST' && u === '/api/repay') {
    const p = await body(req);
    const loan = db.loans[p.loan];
    if (!loan || loan.wallet !== p.wallet || loan.status !== 'open') return json(res, 400, { error: 'no such open loan' });
    const a = getAccount(p.wallet);
    if (a.sol < loan.debt) return json(res, 400, { error: 'insufficient sol balance (' + r4(a.sol) + ' < ' + loan.debt + ')' });
    closeLoan(loan, 'repaid');
    return json(res, 200, { account: pubAccount(p.wallet) });
  }
  if (req.method === 'POST' && u === '/api/close') {
    const p = await body(req);
    const loan = db.loans[p.loan];
    if (!loan || loan.wallet !== p.wallet || loan.status !== 'open') return json(res, 400, { error: 'no such open loan' });
    const price = PRICES[loan.mint];
    if (!(price > 0) || !(loan.amount * price / SOLP >= loan.debt)) return json(res, 400, { error: 'collateral no longer covers debt — repay in SOL instead' });
    closeLoan(loan, 'sold', price);
    return json(res, 200, { account: pubAccount(p.wallet) });
  }
  if (req.method === 'POST' && u === '/api/protect') {
    const p = await body(req);
    const loan = db.loans[p.loan];
    if (!loan || loan.wallet !== p.wallet || loan.status !== 'open') return json(res, 400, { error: 'no such open loan' });
    loan.tp = p.tp > 0 ? +p.tp : null; loan.sl = p.sl > 0 ? +p.sl : null;
    receipt('protect', { loan: loan.id, wallet: short(p.wallet), sym: loan.sym, tp: loan.tp, sl: loan.sl,
      summary: `${short(p.wallet)} armed auto-protect on ${loan.sym}: tp ${loan.tp ? '$' + loan.tp : '—'} · sl ${loan.sl ? '$' + loan.sl : '—'}. the keeper watches every 15s.` });
    return json(res, 200, { loan: Object.assign({}, loan, { wallet: undefined }) });
  }

  // static
  let f = u === '/' ? '/index.html' : u === '/app' ? '/app.html' : (u === '/docs' || u === '/docs/') ? '/docs.html' : u;
  f = path.normalize(f).replace(/^([.\\/])+/, '');
  const fp = path.join(CLIENT, f);
  if (!fp.startsWith(CLIENT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(buf);
  });
});

// ---------- WS upgrade ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key']; if (!key) return socket.destroy();
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '
    + crypto.createHash('sha1').update(key + GUID).digest('base64') + '\r\n\r\n');
  socks.add(socket);
  socket.on('close', () => socks.delete(socket));
  socket.on('error', () => socks.delete(socket));
  socket.on('data', () => {});   // read-only stream; pings ignored
  try { socket.write(frame(JSON.stringify({ type: 'hello', stats: stats(), prices: pubPrices() }))); } catch (e) {}
});

// ---------- boot ----------
(async () => {
  await pollPrices();
  const live = catalogPub().filter((c) => c.enabled).map((c) => c.sym).join(', ');
  server.listen(PORT, () => console.log(`RAVEN perched on :${PORT} — collateral live: ${live || 'none yet'} · paper custody, real prices`));
  setInterval(pollPrices, PRICE_MS);
  setInterval(keeper, KEEPER_MS);
})();
