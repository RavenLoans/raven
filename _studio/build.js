'use strict';
// RAVEN brand-kit generator. Writes one self-contained HTML per asset into _studio/out/,
// then render.js rasterizes each with headless Chrome to the Desktop as raven-*.png.
// Aesthetic mirrors the site: cool pearl-violet paper + iridescent teal→violet→magenta
// (raven oil-slick feather). Fraunces (display) + Inter + JetBrains Mono.
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,650;0,9..144,750;1,9..144,550&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">`;

const BASE = `
:root{--bg:#eef0f6;--panel:#fbfcff;--panel2:#e6e8f2;--ink:#151625;--sub:#48485f;--mut:#7a7b95;--dim:#a4a4bd;
  --teal:#12b39a;--vi:#6a4be0;--mag:#c74dea;--warn:#cf7a2c;--bad:#c93b52;
  --line:rgba(21,22,37,.12);--line2:rgba(21,22,37,.22);}
*{margin:0;padding:0;box-sizing:border-box}
html,body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:#eef0f6;overflow:hidden;-webkit-font-smoothing:antialiased}
.stage{position:relative;overflow:hidden;background:
  radial-gradient(58% 46% at 80% -6%,rgba(106,75,224,.16),transparent 60%),
  radial-gradient(50% 44% at 6% 10%,rgba(18,179,154,.12),transparent 60%),
  radial-gradient(64% 52% at 52% 116%,rgba(199,77,234,.11),transparent 66%),
  #eef0f6}
.fr{font-family:'Fraunces',serif}.mo{font-family:'JetBrains Mono',monospace}
.grad{background:linear-gradient(110deg,var(--teal) 6%,var(--vi) 52%,var(--mag) 96%);-webkit-background-clip:text;background-clip:text;color:transparent}
.tok{color:var(--vi)}
.eyebrow{font-family:'JetBrains Mono',monospace;letter-spacing:.34em;color:var(--vi);text-transform:uppercase}
.dust{position:absolute;inset:0;opacity:.6;pointer-events:none;background-image:
  radial-gradient(2px 2px at 12% 22%,rgba(106,75,224,.22),transparent),
  radial-gradient(2px 2px at 78% 12%,rgba(18,179,154,.2),transparent),
  radial-gradient(2px 2px at 34% 66%,rgba(199,77,234,.16),transparent),
  radial-gradient(2px 2px at 88% 54%,rgba(106,75,224,.18),transparent),
  radial-gradient(2px 2px at 24% 46%,rgba(21,22,37,.1),transparent),
  radial-gradient(2px 2px at 60% 82%,rgba(18,179,154,.16),transparent)}
`;

// ── The raven mark ── head-and-shoulders profile facing left: heavy wedge beak, sleek
// crown, throat hackles. The iconic corvid silhouette. fillId per instance. size in px.
function raven(size, fillId, opts = {}) {
  const s = size;
  return `<svg width="${s}" height="${s}" viewBox="0 0 120 120" style="filter:drop-shadow(0 12px 40px rgba(106,75,224,.26))">
    <defs><linearGradient id="${fillId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#12b39a"/><stop offset=".5" stop-color="#6a4be0"/><stop offset="1" stop-color="#c74dea"/></linearGradient></defs>
    <path fill="${opts.solid || 'url(#' + fillId + ')'}" d="
      M4,49
      L47,42
      C50,23 71,15 90,25
      C105,33 107,55 96,69
      C89,79 77,83 64,80
      C67,72 65,67 60,63
      L46,57
      L4,49 Z"/>
    <circle cx="75" cy="43" r="3.6" fill="#0c0a16"/>
    <circle cx="76.4" cy="41.7" r="1.1" fill="#eef0f6"/>
  </svg>`;
}
// simpler flying-raven glyph for corners/watermarks
function ravenFly(size, fillId) {
  const s = size;
  return `<svg width="${s}" height="${s}" viewBox="0 0 120 60">
    <defs><linearGradient id="${fillId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#12b39a"/><stop offset=".5" stop-color="#6a4be0"/><stop offset="1" stop-color="#c74dea"/></linearGradient></defs>
    <path fill="url(#${fillId})" d="M4,30 C24,10 44,8 58,26 C60,20 64,18 70,20 C64,24 62,28 62,30 C62,28 60,24 54,26 C40,20 22,26 4,30 Z
      M116,30 C96,10 76,8 62,26 C60,20 56,18 50,20 C56,24 58,28 58,30 C58,28 60,24 66,26 C80,20 98,26 116,30 Z"/>
  </svg>`;
}

const chip = (t, c) => `<span style="display:inline-flex;align-items:center;font-family:'JetBrains Mono';font-size:28px;font-weight:700;color:${c || 'var(--vi)'};background:var(--panel);border:1px solid var(--line2);border-radius:999px;padding:14px 30px;letter-spacing:.03em;box-shadow:0 2px 10px rgba(21,22,37,.05)">${t}</span>`;

function page(w, h, css, inner) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
  .stage{width:${w}px;height:${h}px}${css}</style></head>
  <body><div class="stage"><div class="dust"></div>${inner}</div></body></html>`;
}

const assets = {};

// 1) PFP 2000²
assets['raven-pfp'] = page(2000, 2000, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
  .name{font-family:'Fraunces';font-weight:650;font-size:250px;letter-spacing:-.02em;line-height:1}
  .tick{font-family:'JetBrains Mono';font-size:96px;font-weight:700;margin-top:8px}
  .tag{font-family:'Fraunces';font-style:italic;font-weight:550;font-size:70px;color:var(--sub)}`,
  `<div class="wrap">
     ${raven(720, 'opfp')}
     <div class="name grad">raven</div>
     <div class="tick tok">$RAVEN</div>
     <div class="tag">the raven remembers</div>
   </div>`);

// 2) BANNER 3000×1000
assets['raven-banner'] = page(3000, 1000, `
  .wrap{position:absolute;inset:0;display:flex;align-items:center;gap:90px;padding:0 130px}
  .name{font-family:'Fraunces';font-weight:650;font-size:184px;letter-spacing:-.02em;line-height:.98}
  .tag{font-size:40px;color:var(--sub);letter-spacing:.02em;margin-top:20px;line-height:1.4;max-width:1400px}
  .tag b{color:var(--ink)}
  .row{display:flex;gap:16px;margin-top:34px}
  .dom{font-family:'JetBrains Mono';font-size:32px;font-weight:700;color:var(--vi);margin-top:30px;letter-spacing:.06em}`,
  `<div class="wrap">
     ${raven(520, 'obn')}
     <div>
       <div class="name grad">raven</div>
       <div class="tag">Borrow SOL against memecoins &amp; tokenized stocks — <b>without letting go.</b></div>
       <div class="row">${chip('UP TO 70% LTV')}${chip('TP / SL ON COLLATERAL', 'var(--teal)')}${chip('NEVER A TELEGRAM BOT')}</div>
       <div class="dom">ravenloans.xyz · $RAVEN</div>
     </div>
   </div>`);

// 3) KEYART 2400×1350
assets['raven-keyart'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;align-items:center;gap:70px;padding:0 130px}
  .name{font-family:'Fraunces';font-weight:650;font-size:150px;letter-spacing:-.02em;line-height:.96}
  .name em{font-style:italic;font-weight:550}
  .sub{font-size:34px;color:var(--sub);max-width:1000px;line-height:1.55;margin-top:24px}
  .sub b{color:var(--ink)}
  .row{display:flex;gap:16px;margin-top:30px;flex-wrap:wrap}
  .dom{font-family:'JetBrains Mono';font-size:34px;font-weight:700;color:var(--vi);margin-top:36px;letter-spacing:.08em}`,
  `<div class="wrap">
     ${raven(560, 'oka')}
     <div>
       <div class="name">Borrow against<br>your bag.<br><em class="grad">Without letting go.</em></div>
       <div class="sub">Any bag that trades is a credit line — memecoins to <b>30% LTV</b>, tokenized stocks to
         <b>70% over 30 days</b>. Arm stops on collateral <b>while it's pledged</b>, and build credit the ledger never forgets.</div>
       <div class="dom">ravenloans.xyz</div>
     </div>
   </div>`);

// 4) THE LOOP 2400×1350
const loopCard = (n, t, d, hot) => `<div style="flex:1;background:var(--panel);border:2px solid ${hot ? 'rgba(18,179,154,.5)' : 'var(--line)'};border-radius:22px;padding:42px 34px;${hot ? 'box-shadow:0 0 50px rgba(18,179,154,.12)' : 'box-shadow:0 2px 12px rgba(21,22,37,.05)'}">
  <div class="mo" style="font-size:26px;letter-spacing:.2em;color:${hot ? 'var(--teal)' : 'var(--dim)'}">${n}</div>
  <div class="fr" style="font-weight:650;font-size:44px;margin:14px 0 12px;letter-spacing:-.01em">${t}</div>
  <div style="font-size:28px;color:var(--sub);line-height:1.55">${d}</div></div>`;
assets['raven-how'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 100px;gap:46px}
  .top{display:flex;align-items:center;gap:36px}
  .h{font-family:'Fraunces';font-weight:650;font-size:96px;letter-spacing:-.02em}
  .row{display:flex;gap:22px}
  .foot{font-family:'JetBrains Mono';font-size:27px;color:var(--mut);text-align:center;letter-spacing:.04em}`,
  `<div class="wrap">
     <div class="top">${raven(150, 'ohw')}<div><div class="eyebrow" style="font-size:29px;margin-bottom:10px">◆ the loop ◆</div><div class="h">Collateral that can still <span class="grad">sell itself.</span></div></div></div>
     <div class="row">
       ${loopCard('01 · PLEDGE', 'Connect', 'RAVEN reads your <b style="color:var(--vi)">real bag</b> and prices it live. No signatures, ever.')}
       ${loopCard('02 · BORROW', 'Take SOL', 'Pick a tier. Your <b style="color:var(--vi)">liquidation price</b> is quoted before you commit.')}
       ${loopCard('03 · PROTECT', 'Arm TP/SL', 'A 15-second keeper watches your stops on the collateral <b style="color:var(--vi)">while it’s pledged.</b>')}
       ${loopCard('04 · REMEMBER', 'Build credit', 'Every clean repay lifts your score — <b style="color:var(--teal)">higher LTV, lower fees.</b>', true)}
     </div>
     <div class="foot">connect · borrow · protect · repay — every action a public receipt · ravenloans.xyz</div>
   </div>`);

// 5) TWO ASSET CLASSES / TIERS 2400×1350
const tierMini = (t, ltv, sub, cls) => `<div style="background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px 22px;flex:1">
  <div class="fr" style="font-weight:650;font-size:26px">${t}</div>
  <div class="fr grad" style="font-weight:650;font-size:52px;line-height:1;margin:6px 0">${ltv}</div>
  <div style="font-size:20px;color:var(--mut);font-family:'JetBrains Mono'">${sub}</div></div>`;
assets['raven-tiers'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 110px;gap:30px}
  .h{font-family:'Fraunces';font-weight:650;font-size:88px;letter-spacing:-.02em;text-align:center}
  .cls{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:12px}
  .card{border:1px solid var(--line);border-radius:22px;padding:40px 38px}
  .card.m{background:linear-gradient(160deg,#fbfcff,#eae6fb)}
  .card.r{background:linear-gradient(160deg,#fbfcff,#e6f6f0)}
  .lab{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
  .tag{font-family:'JetBrains Mono';font-size:22px;font-weight:700;letter-spacing:.1em}
  .m .tag{color:var(--vi)} .r .tag{color:var(--teal)}
  .mx{font-family:'JetBrains Mono';font-size:24px;color:var(--mut)} .mx b{color:var(--ink)}
  .cn{font-family:'Fraunces';font-weight:650;font-size:56px;margin-bottom:22px}
  .tiers{display:flex;gap:14px}
  .foot{font-family:'JetBrains Mono';font-size:26px;color:var(--mut);text-align:center;letter-spacing:.04em}`,
  `<div class="wrap">
     <div class="eyebrow" style="font-size:28px;text-align:center">◆ two asset classes · one click to borrow ◆</div>
     <div class="h">Keep your bags <span class="grad">and</span> your stocks.</div>
     <div class="cls">
       <div class="card m"><div class="lab"><span class="tag">MEMECOINS</span><span class="mx">up to <b>30% LTV</b></span></div>
         <div class="cn">Bags → SOL</div>
         <div class="tiers">${tierMini('Express', '30%', '2d · 3%', 'm')}${tierMini('Quick', '25%', '3d · 2%', 'm')}${tierMini('Standard', '20%', '7d · 1.5%', 'm')}</div></div>
       <div class="card r"><div class="lab"><span class="tag">TOKENIZED STOCKS</span><span class="mx">up to <b>70% LTV</b></span></div>
         <div class="cn">Stocks → SOL</div>
         <div class="tiers">${tierMini('Express', '50%', '7d · 3%', 'r')}${tierMini('Quick', '60%', '15d · 4%', 'r')}${tierMini('Standard', '70%', '30d · 5%', 'r')}</div></div>
     </div>
     <div class="foot">AAPL · NVDA · TSLA · COIN · gold — the xStocks you already hold · ravenloans.xyz</div>
   </div>`);

// 6) CREDIT 2400×1350
const crCard = (rng, name, perk, hot) => `<div style="flex:1;background:var(--panel);border:2px solid ${hot ? 'rgba(106,75,224,.45)' : 'var(--line)'};border-radius:20px;padding:40px 34px;text-align:center;${hot ? 'box-shadow:0 0 46px rgba(106,75,224,.12)' : ''}">
  <div class="mo" style="font-size:24px;letter-spacing:.14em;color:var(--mut)">${rng}</div>
  <div class="fr" style="font-weight:650;font-size:48px;margin:10px 0">${name}</div>
  <div style="font-size:26px;color:var(--sub);line-height:1.5">${perk}</div></div>`;
assets['raven-credit'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 120px;gap:40px}
  .top{display:flex;align-items:center;gap:36px}
  .h{font-family:'Fraunces';font-weight:650;font-size:100px;letter-spacing:-.02em}
  .h em{font-style:italic;font-weight:550}
  .row{display:flex;gap:22px}
  .foot{font-family:'JetBrains Mono';font-size:26px;color:var(--mut);text-align:center;letter-spacing:.04em}`,
  `<div class="wrap">
     <div class="top">${raven(150, 'ocr')}<div><div class="eyebrow" style="font-size:29px;margin-bottom:10px">◆ on-chain memory ◆</div><div class="h">The raven <em class="grad">remembers.</em></div></div></div>
     <div class="row">
       ${crCard('0 – 599', 'Hatchling', 'Base terms. Everyone starts at 300.')}
       ${crCard('600 – 799', 'Fledged', '<b style="color:var(--teal)">+2% LTV</b> on every tier.')}
       ${crCard('800 – 1000', 'Unkindness', '<b style="color:var(--teal)">+4% LTV · −25bps</b> fee.', true)}
     </div>
     <div class="foot">repay +40 · protected exit +20 · liquidation −250 — credit is earned by repaying, never bought · ravenloans.xyz</div>
   </div>`);

// 7) VS THE OTHER BIRD 2400×1350
const vrow = (f, them, us) => `<tr><td class="f">${f}</td><td class="a"><span class="x">✗</span>${them}</td><td class="b"><span class="c">✓</span>${us}</td></tr>`;
assets['raven-vs'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 120px;gap:30px}
  .top{display:flex;align-items:center;gap:34px}
  .h{font-family:'Fraunces';font-weight:650;font-size:82px;letter-spacing:-.02em}
  table{width:100%;border-collapse:separate;border-spacing:0 14px}
  th{font-family:'JetBrains Mono';font-size:27px;letter-spacing:.1em;text-align:left;padding:0 32px;color:var(--mut)}
  th.b{color:var(--vi)}
  td{padding:24px 32px;font-size:30px;line-height:1.4;vertical-align:middle}
  td.f{font-family:'Fraunces';font-weight:650;font-size:31px;color:var(--ink);width:22%;background:var(--panel);border:1px solid var(--line);border-right:none;border-radius:16px 0 0 16px}
  td.a{color:#8a8aa0;width:37%;background:rgba(201,59,82,.05);border:1px solid rgba(201,59,82,.16);border-left:none;border-right:none}
  td.b{color:var(--ink);width:41%;background:rgba(18,179,154,.08);border:2px solid rgba(18,179,154,.32);border-left:none;border-radius:0 16px 16px 0}
  td.b b{color:var(--teal)}
  .x{color:var(--bad);font-weight:800;margin-right:16px} .c{color:var(--teal);font-weight:800;margin-right:16px}
  .foot{font-family:'JetBrains Mono';font-size:25px;color:var(--mut);text-align:center;letter-spacing:.03em}`,
  `<div class="wrap">
     <div class="top">${raven(128, 'ovs')}<div><div class="eyebrow" style="font-size:28px;margin-bottom:8px">◆ why not the other bird ◆</div><div class="h">Same mechanics. <span class="grad">Different spine.</span></div></div></div>
     <table>
       <tr><th></th><th>THE OTHER BIRD</th><th class="b">RAVEN</th></tr>
       ${vrow('Custody', 'Your wallet IS the bot wallet — keys in a Telegram bot', '<b>Zero keys held</b> — connect never asks for a signature')}
       ${vrow('Surface', 'Lives in a chat window', '<b>Web-first</b> — full dashboard, positions, live ledger')}
       ${vrow('Keeper', 'Ticks every ~90 seconds', '<b>Every 15 seconds</b> — 6× faster to your stop')}
       ${vrow('Proof', 'Trust the bot', '<b>Read the ledger</b> — every action is a public receipt')}
     </table>
     <div class="foot">we even accept their token as collateral. no hard feelings. 🪶 · ravenloans.xyz</div>
   </div>`);

// ── the Nevermore orb ── glowing iridescent sphere with halo + orbit rings
function orb(size, id) {
  const s = size, cx = s / 2, cy = s / 2, r = s * 0.3;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="overflow:visible">
    <defs>
      <radialGradient id="${id}h" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(106,75,224,.4)"/><stop offset="1" stop-color="rgba(106,75,224,0)"/></radialGradient>
      <radialGradient id="${id}c" cx="36%" cy="32%" r="72%"><stop offset="0" stop-color="#ffffff"/><stop offset=".42" stop-color="#8b7bff"/><stop offset="1" stop-color="#c74dea"/></radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="url(#${id}h)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.75}" ry="${r * 0.62}" fill="none" stroke="rgba(106,75,224,.4)" stroke-width="${s * 0.006}" transform="rotate(-18 ${cx} ${cy})"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.55}" ry="${r * 0.5}" fill="none" stroke="rgba(18,179,154,.35)" stroke-width="${s * 0.005}" transform="rotate(22 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}c)" style="filter:drop-shadow(0 ${s * 0.03}px ${s * 0.06}px rgba(106,75,224,.4))"/>
    <circle cx="${cx - r * 0.34}" cy="${cy - r * 0.38}" r="${r * 0.2}" fill="rgba(255,255,255,.92)"/>
    <circle cx="${cx + r * 1.75 * Math.cos(-0.31) * 0.955}" cy="${cy - r * 1.75 * Math.sin(-0.31) * 0.34}" r="${s * 0.02}" fill="#c74dea"/>
  </svg>`;
}

// 8) MEET NEVERMORE 2400×1350 — the announcement hero
assets['raven-nevermore'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;align-items:center;gap:40px;padding:0 130px}
  .name{font-family:'Fraunces';font-weight:650;font-size:176px;letter-spacing:-.03em;line-height:.94}
  .sub{font-size:37px;color:var(--sub);max-width:1080px;line-height:1.5;margin-top:28px}
  .sub b{color:var(--ink)}
  .row{display:flex;gap:16px;margin-top:34px;flex-wrap:wrap}
  .dom{font-family:'JetBrains Mono';font-size:34px;font-weight:700;color:var(--vi);margin-top:38px;letter-spacing:.06em}`,
  `<div class="wrap">
     <div style="flex:none">${orb(620, 'onm')}</div>
     <div>
       <div class="eyebrow" style="font-size:30px;margin-bottom:18px">◆ new · the ai credit engine ◆</div>
       <div class="name">Meet <span class="grad">Nevermore.</span></div>
       <div class="sub">The raven doesn’t just remember — now it <b>thinks.</b> It reads your entire bag and
         structures your <b>optimal loan in one click</b>: what to pledge, which tier, how much SOL, and exactly where to set your stops.</div>
       <div class="row">${chip('READS YOUR BAG')}${chip('STRUCTURES THE LOAN', 'var(--teal)')}${chip('SETS YOUR STOPS', 'var(--mag)')}</div>
       <div class="dom">ravenloans.xyz · $RAVEN</div>
     </div>
   </div>`);

// 9) AI PROPOSES → RULES ENFORCE 2400×1350 — the how-it-works / trust mechanic
const propRow = (k, v) => `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:20px 0;border-bottom:1px solid var(--line)">
  <span style="font-size:30px;color:var(--mut)">${k}</span><span class="mo" style="font-size:31px;font-weight:700;color:var(--sub)">${v}</span></div>`;
const enfRow = (k, v, note) => `<div style="padding:18px 0;border-bottom:1px solid var(--line)">
  <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:30px;color:var(--mut)">${k}</span><span class="mo" style="font-size:31px;font-weight:700;color:var(--teal)">${v}</span></div>
  <div style="font-size:22px;color:var(--mut);margin-top:6px">${note}</div></div>`;
assets['raven-nevermore-how'] = page(2400, 1350, `
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 110px;gap:44px}
  .h{font-family:'Fraunces';font-weight:650;font-size:92px;letter-spacing:-.02em;text-align:center}
  .cols{display:flex;gap:34px;align-items:stretch}
  .card{flex:1;background:var(--panel);border:1px solid var(--line);border-radius:26px;padding:44px 46px}
  .card.e{border:2px solid rgba(18,179,154,.42);box-shadow:0 0 50px rgba(18,179,154,.1)}
  .ch{display:flex;align-items:center;gap:22px;margin-bottom:14px}
  .ct{font-family:'Fraunces';font-weight:650;font-size:50px}
  .tick{width:52px;height:52px;border-radius:50%;background:var(--teal);color:#fff;font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
  .arw{align-self:center;font-size:80px;font-weight:800;color:var(--vi);flex:none}
  .foot{font-family:'JetBrains Mono';font-size:29px;color:var(--mut);text-align:center;letter-spacing:.03em}
  .foot b{color:var(--ink)}`,
  `<div class="wrap">
     <div><div class="eyebrow" style="font-size:29px;text-align:center;margin-bottom:14px">◆ how nevermore works ◆</div>
       <div class="h">The AI proposes. The <span class="grad">rules enforce.</span></div></div>
     <div class="cols">
       <div class="card">
         <div class="ch"><div style="flex:none">${orb(96, 'ohp')}</div><div class="ct">AI proposes</div></div>
         ${propRow('tier', 'Quick · 25%')}
         ${propRow('pledge', '50% of SPYx')}
         ${propRow('stop-loss', '$611.00')}
         ${propRow('take-profit', '$1,044')}
       </div>
       <div class="arw">→</div>
       <div class="card e">
         <div class="ch"><div class="tick">✓</div><div class="ct">The engine enforces</div></div>
         ${enfRow('tier', '→ RWA Standard', 'SPYx is an RWA — memecoin tiers rejected')}
         ${enfRow('amount', '✓ clamped to free', 'never over-pledges your balance')}
         ${enfRow('liquidation', '→ recomputed $616.81', 'from the real quote, not the AI')}
         ${enfRow('stop-loss', '→ raised above liq', '$683.04 — safe by design')}
       </div>
     </div>
     <div class="foot">it advises · it re-checks every number · <b>it can never move your funds</b> · ravenloans.xyz</div>
   </div>`);

for (const [name, html] of Object.entries(assets)) {
  fs.writeFileSync(path.join(OUT, name + '.html'), html);
  console.log('wrote', name + '.html');
}
