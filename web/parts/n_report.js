/* ===== 消費分析報告：選期間（日／週／月／半年／年），匯出精美的 PDF 或 Excel（圖表＋數據） ===== */
/* 算出一段期間的所有分析數據（和分析頁同一套算法） */
function accStatData(u, a) {
  const Rg = spRange(u, a), Pg = spRange(u, spShift(u, a, -1)), inR = (r, g) => r.d && r.d >= g.s && r.d <= g.e;
  const isOpt = r => { const f = catFind('out', r.cat); return f.s ? !!f.s.opt : f.p ? !!f.p.opt : false; };
  const outs = DB.acc.recs.filter(r => r.type === 'out' && inR(r, Rg)).sort((x, y) => (x.d + (x.t || '')).localeCompare(y.d + (y.t || ''))), ins = DB.acc.recs.filter(r => r.type === 'in' && inR(r, Rg));
  const tot = outs.reduce((t, r) => t + accMine(r), 0), inc = ins.reduce((t, r) => t + (+r.amt || 0), 0), last = DB.acc.recs.filter(r => r.type === 'out' && inR(r, Pg)).reduce((t, r) => t + accMine(r), 0);
  const optL = outs.filter(isOpt), essL = outs.filter(r => !isOpt(r)), opt = optL.reduce((t, r) => t + accMine(r), 0), ess = tot - opt;
  const grp = L => { const by = {}; L.forEach(r => { const f = catFind('out', r.cat), k = f.p ? f.p.id : '_'; const g = by[k] = by[k] || {id: k, n: f.p ? f.p.n : '其他', i: f.p ? f.p.i : '📦', v: 0, cnt: 0, subs: {}}; const v = accMine(r); g.v += v; g.cnt++; const sk = f.s ? f.s.id : '_'; const sg = g.subs[sk] = g.subs[sk] || {n: f.s ? f.s.n : g.n, v: 0, cnt: 0}; sg.v += v; sg.cnt++; });
    return Object.values(by).filter(g => g.v > 0).sort((x, y) => y.v - x.v).map((g, i) => Object.assign(g, {c: PAL[i % PAL.length], subL: Object.values(g.subs).sort((x, y) => y.v - x.v)})); };
  const B = []; const bk = (lab, s, e, tip) => { const L = outs.filter(r => r.d >= s && r.d <= e), o = L.filter(isOpt).reduce((t, r) => t + accMine(r), 0), all = L.reduce((t, r) => t + accMine(r), 0); B.push({lab, tip, e: all - o, o, v: all, inc: ins.filter(r => r.d >= s && r.d <= e).reduce((t, r) => t + (+r.amt || 0), 0)}); };
  if (u === 'w' || u === 'm') { const d0 = new Date(Rg.s + 'T00:00:00'); for (let k = 0; k < Rg.days; k++) { const d = new Date(d0); d.setDate(d0.getDate() + k); const x = ymd(d); bk(u === 'w' ? '一二三四五六日'[k] : String(k + 1), x, x, `${d.getMonth() + 1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`); } }
  else if (u === 'h' || u === 'y') { const Y = +Rg.s.slice(0, 4), m0 = +Rg.s.slice(5, 7) - 1, n = u === 'h' ? 6 : 12; for (let k = 0; k < n; k++) { const m = m0 + k; bk(`${m + 1}月`, ymd(new Date(Y, m, 1)), ymd(new Date(Y, m + 1, 0)), `${Y}年${m + 1}月`); } }
  const WD = [0, 0, 0, 0, 0, 0, 0]; outs.forEach(r => { WD[(new Date(r.d + 'T00:00:00').getDay() + 6) % 7] += accMine(r); });
  const byPy = {}; outs.forEach(r => { const n = r.payee || accCat(r).n; const o = byPy[n] = byPy[n] || {v: 0, c: 0}; o.v += accMine(r); o.c++; });
  const PY = Object.entries(byPy).sort((x, y) => y[1].v - x[1].v).slice(0, 10), big = outs.slice().sort((x, y) => accMine(y) - accMine(x)).slice(0, 10);
  const G = grp(outs), GE = grp(essL), GO = grp(optL), chg = last ? (tot - last) / last * 100 : 0, pN = {d: '前一天', w: '上週', m: '上個月', h: '上個半年', y: '去年'}[u];
  const tips = []; if (tot) { if (G[0]) tips.push(`花最多的是「${G[0].n}」${money(G[0].v)}，佔 ${(G[0].v / tot * 100).toFixed(0)}%`);
    if (last) tips.push(`比${pN}${chg > 0 ? '多' : '少'}花 ${money(Math.abs(tot - last))}（${chg > 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(0)}%）`);
    tips.push(opt ? `非必要消費 ${money(opt)}，佔 ${(opt / tot * 100).toFixed(0)}%${GO[0] ? `，最多的是「${GO[0].n}」` : ''}${opt / tot > .3 ? '；已超過三成，建議優先從這一類減少' : ''}` : '這段期間沒有非必要消費');
    if (Rg.days > 1) tips.push(`平均每天 ${money(Math.round(tot / Rg.days))}，每筆平均 ${money(Math.round(tot / outs.length))}`);
    if (u !== 'd' && u !== 'w') { const w = WD.indexOf(Math.max(...WD)); tips.push(`星期${'一二三四五六日'[w]}花最多（${money(WD[w])}）`); }
    if (inc) tips.push(`收入 ${money(inc)}，${inc >= tot ? `存下 ${money(inc - tot)}（儲蓄率 ${((inc - tot) / inc * 100).toFixed(0)}%）` : `超支 ${money(tot - inc)}`}`);
    if (opt) tips.push(`如果非必要消費少一半，可以多存 ${money(Math.round(opt / 2))}`); }
  return {u, a, Rg, Pg, pN, outs, ins, tot, inc, last, chg, opt, ess, G, GE, GO, B, WD, PY, big, tips, isOpt};
}

/* ---------- 圖表（畫在 canvas，PDF、Excel 共用；2 倍解析度） ---------- */
const RPT_F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
function rptCanvas(w, h) { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const g = c.getContext('2d'); g.scale(2, 2); g.fillStyle = '#fffdf8'; g.fillRect(0, 0, w, h); return [c, g]; }
function rptDonut(L, total, title, w = 520, h = 300) { const [c, g] = rptCanvas(w, h), cx = 150, cy = h / 2, R = 118, r0 = 72; let a = -Math.PI / 2;
  if (!total) { g.strokeStyle = '#e6dccb'; g.lineWidth = R - r0; g.beginPath(); g.arc(cx, cy, (R + r0) / 2, 0, 7); g.stroke(); }
  L.forEach(x => { const s = x.v / total * Math.PI * 2; g.beginPath(); g.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)); g.arc(cx, cy, R, a, a + s); g.arc(cx, cy, r0, a + s, a, true); g.closePath(); g.fillStyle = x.c; g.fill(); g.strokeStyle = '#fffdf8'; g.lineWidth = 2; g.stroke();
    if (s > .32) { const m = a + s / 2; g.fillStyle = '#fff'; g.font = `700 13px ${RPT_F}`; g.textAlign = 'center'; g.fillText((x.v / total * 100).toFixed(0) + '%', cx + (R + r0) / 2 * Math.cos(m), cy + (R + r0) / 2 * Math.sin(m) + 5); } a += s; });
  g.textAlign = 'center'; g.fillStyle = '#7a6550'; g.font = `600 14px ${RPT_F}`; g.fillText(title, cx, cy - 6); g.fillStyle = '#3b2b1d'; g.font = `800 19px ${RPT_F}`; g.fillText(money(Math.round(total)), cx, cy + 18);
  g.textAlign = 'left'; L.slice(0, 8).forEach((x, i) => { const y = 34 + i * 31; g.fillStyle = x.c; g.beginPath(); g.roundRect ? g.roundRect(292, y - 11, 14, 14, 3) : g.rect(292, y - 11, 14, 14); g.fill();
    g.fillStyle = '#3b2b1d'; g.font = `600 14px ${RPT_F}`; g.fillText(x.n.length > 7 ? x.n.slice(0, 7) + '…' : x.n, 314, y + 1); g.fillStyle = '#7a6550'; g.textAlign = 'right'; g.font = `700 13px ${RPT_F}`; g.fillText(`${(x.v / total * 100).toFixed(0)}%`, w - 16, y + 1); g.textAlign = 'left'; });
  if (L.length > 8) { g.fillStyle = '#9a8a76'; g.font = `500 12px ${RPT_F}`; g.fillText(`…還有 ${L.length - 8} 類`, 314, 34 + 8 * 31); }
  return c; }
function rptBars(B, w = 1000, h = 340) { const [c, g] = rptCanvas(w, h), pl = 64, pr = 16, pt = 28, pb = 44, cw = w - pl - pr, ch = h - pt - pb, mx = Math.max(1, ...B.map(x => x.v)), n = B.length, bw = cw / n;
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p) * p; }, top = nice(mx);
  g.strokeStyle = '#ece3d3'; g.fillStyle = '#9a8a76'; g.font = `500 12px ${RPT_F}`; g.textAlign = 'right';
  for (let k = 0; k <= 4; k++) { const y = pt + ch - ch * k / 4; g.beginPath(); g.moveTo(pl, y); g.lineTo(w - pr, y); g.stroke(); g.fillText(kMoney(top * k / 4), pl - 8, y + 4); }
  B.forEach((x, i) => { const bx = pl + i * bw + bw * .18, bwi = bw * .64, he = x.e / top * ch, ho = x.o / top * ch, y0 = pt + ch;
    g.fillStyle = '#6f7d3c'; g.fillRect(bx, y0 - he, bwi, he); g.fillStyle = '#c27a5a'; g.fillRect(bx, y0 - he - ho, bwi, ho);
    if (n <= 12 && x.v) { g.fillStyle = '#3b2b1d'; g.textAlign = 'center'; g.font = `700 12px ${RPT_F}`; g.fillText(kMoney(x.v), bx + bwi / 2, y0 - he - ho - 6); }
    if (n <= 12 || i === 0 || (i + 1) % 5 === 0) { g.fillStyle = '#7a6550'; g.textAlign = 'center'; g.font = `600 12px ${RPT_F}`; g.fillText(x.lab, bx + bwi / 2, y0 + 18); } });
  g.textAlign = 'left'; g.font = `600 12px ${RPT_F}`; [['#6f7d3c', '必要'], ['#c27a5a', '非必要']].forEach(([cl, t], i) => { g.fillStyle = cl; g.fillRect(pl + i * 80, h - 16, 12, 12); g.fillStyle = '#5a4a3a'; g.fillText(t, pl + 18 + i * 80, h - 6); });
  return c; }
function rptWeek(WD, w = 520, h = 240) { const [c, g] = rptCanvas(w, h), mx = Math.max(1, ...WD), pl = 20, pb = 34, ch = h - 30 - pb, bw = (w - pl * 2) / 7;
  WD.forEach((v, i) => { const he = v / mx * ch, x = pl + i * bw + bw * .2, y0 = h - pb; g.fillStyle = v === mx && v ? '#b5653a' : '#d9b48f'; g.fillRect(x, y0 - he, bw * .6, he);
    g.fillStyle = '#3b2b1d'; g.textAlign = 'center'; g.font = `700 12px ${RPT_F}`; if (v) g.fillText(kMoney(v), x + bw * .3, y0 - he - 6); g.fillStyle = '#7a6550'; g.font = `600 13px ${RPT_F}`; g.fillText('週' + '一二三四五六日'[i], x + bw * .3, y0 + 20); });
  return c; }
function rptCharts(D) { return {bars: D.B.length ? rptBars(D.B) : null, all: rptDonut(D.G, D.tot, '支出'), ess: rptDonut(D.GE, D.ess, '必要'), opt: rptDonut(D.GO, D.opt, '非必要'), week: D.u !== 'd' && D.u !== 'w' && D.tot ? rptWeek(D.WD) : null}; }

/* ---------- 選期間與格式 ---------- */
function accReportAsk() {
  const st = Object.assign({u: 'm', a: ymd(new Date())}, Acc.sp || {}); buzz(10);
  const sh = sheet({title: '📤 匯出分析報告', foot: '<div class="tplFoot new" style="grid-template-columns:1fr 1fr"><button class="btn" data-f="xlsx">📊 Excel</button><button class="btn pri" data-f="pdf">📄 PDF</button></div>'});
  const draw = () => { const R = spRange(st.u, st.a), D = accStatData(st.u, st.a);
    sh.body.innerHTML = `<div class="lbl">報告期間</div><div class="spSeg">${SPU.map(([k, n]) => `<button data-u="${k}" class="${st.u === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="spNav"><button class="btn" data-a="p-">◀</button><button class="btn spLab" data-a="pick">${R.lab}</button><button class="btn" data-a="p+">▶</button></div>
      <div class="rptPrev card"><div><small>支出</small><b class="neg">${money(Math.round(D.tot))}</b></div><div><small>收入</small><b class="pos">${money(Math.round(D.inc))}</b></div><div><small>筆數</small><b>${D.outs.length}</b></div></div>
      <div class="small muted" style="line-height:1.6">報告內容：重點摘要、各項指標、${D.B.length ? '每日／每月長條圖、' : ''}支出分類圓餅圖、必要與非必要消費分類佔比、${D.u !== 'd' && D.u !== 'w' ? '星期分布、' : ''}最大筆支出、最常消費的地方，以及這段期間的完整明細。<br>PDF 會打開列印畫面，選「另存為 PDF」即可存檔。</div>`; };
  draw();
  sh.body.onclick = async e => { const t = e.target.closest('[data-u],[data-a]'); if (!t) return; buzz(8);
    if (t.dataset.u) st.u = t.dataset.u; else if (t.dataset.a === 'p-' || t.dataset.a === 'p+') st.a = spShift(st.u, st.a, t.dataset.a === 'p-' ? -1 : 1);
    else if (t.dataset.a === 'pick') { if (st.u === 'd' || st.u === 'w') { const v = await datePick(st.a); if (v) st.a = v; } else { const d = new Date(st.a + 'T00:00:00'), r = await ymPick(d.getFullYear(), d.getMonth(), st.u === 'm' ? 'm' : 'y'); if (r) st.a = ymd(new Date(r[0], r[1], 1)); } }
    draw(); };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-f]'); if (!b) return; buzz(15); const D = accStatData(st.u, st.a);
    if (!D.outs.length && !D.ins.length && !await ask('這段期間沒有任何收支紀錄，還是要匯出嗎？', '匯出')) return;
    busy('製作報告中…'); try { if (b.dataset.f === 'pdf') await accReportPdf(D); else await accReportXlsx(D); } catch (er) { toast('❌ ' + er.message); } busy(false); };
}
const rptName = D => `消費分析_${D.Rg.lab.replace(/[（）\s]/g, '').replace(/[\/:]/g, '-')}`;

/* ---------- PDF：排版成 A4 報告，交給系統列印（可另存為 PDF） ---------- */
async function accReportPdf(D) {
  const C = rptCharts(D), img = c => c ? `<img src="${c.toDataURL('image/png')}">` : '', pct = (v, t) => t ? (v / t * 100).toFixed(1) + '%' : '—', now = new Date();
  const catT = (L, T) => L.length ? `<table><thead><tr><th>分類</th><th>子分類</th><th class="r">筆數</th><th class="r">金額</th><th class="r">佔比</th></tr></thead><tbody>${L.map(g => g.subL.map((s, j) => `<tr class="${j ? '' : 'g'}">${j ? '<td></td>' : `<td rowspan="1"><i style="background:${g.c}"></i>${esc(g.n)}</td>`}<td>${esc(s.n)}</td><td class="r">${s.cnt}</td><td class="r">${money(Math.round(s.v))}</td><td class="r">${pct(s.v, T)}</td></tr>`).join('') + `<tr class="sub"><td colspan="3">${esc(g.n)} 小計</td><td class="r">${money(Math.round(g.v))}</td><td class="r">${pct(g.v, T)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">沒有資料</p>';
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${rptName(D)}</title><style>
    @page{size:A4;margin:14mm 12mm}*{box-sizing:border-box}body{font-family:${RPT_F};color:#3b2b1d;margin:0;font-size:11.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .hero{background:linear-gradient(135deg,#6f5a3f,#b5653a);color:#fff;border-radius:12px;padding:20px 24px;display:flex;align-items:center;gap:16px}
    .hero .ic{width:58px;height:58px;border-radius:14px;overflow:hidden;background:#fff;flex:none}.hero .ic svg{width:100%;height:100%}
    .hero h1{margin:0;font-size:24px;letter-spacing:.06em}.hero p{margin:4px 0 0;opacity:.9;font-size:13px}
    .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.kpi div{background:#f6efe2;border-radius:10px;padding:10px 12px}.kpi small{display:block;color:#7a6550;font-weight:700;font-size:10.5px}.kpi b{font-size:17px}.kpi em{display:block;font-style:normal;font-size:10px;color:#7a6550;margin-top:2px}
    .neg{color:#a8472f}.pos{color:#4f6e34}h2{font-size:15px;margin:18px 0 8px;padding-left:9px;border-left:4px solid #b5653a}
    .tips{background:#fbf6ec;border:1px solid #eadfcb;border-radius:10px;padding:10px 14px 10px 28px;margin:0}.tips li{margin:3px 0;line-height:1.55}
    .chart img{width:100%;border:1px solid #eee3d1;border-radius:10px}.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.two img{width:100%;border:1px solid #eee3d1;border-radius:10px}
    table{width:100%;border-collapse:collapse;margin:4px 0 6px;font-size:10.5px}th{background:#efe4d1;color:#5a4a3a;text-align:left;padding:5px 7px;font-weight:800}td{padding:4px 7px;border-bottom:1px solid #f0e8da}.r{text-align:right}
    tr.sub td{background:#faf5ec;font-weight:800}td i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}
    .opt{color:#c27a5a;font-weight:700}.pb{break-before:page}.muted{color:#9a8a76}.foot{margin-top:16px;text-align:center;color:#9a8a76;font-size:9.5px}
    .bar{height:12px;border-radius:6px;background:#c27a5a;overflow:hidden;margin:6px 0}.bar i{display:block;height:100%;background:#6f7d3c}
    section{break-inside:avoid}</style></head><body>
    <div class="hero"><div class="ic">${APP_ICON}</div><div><h1>消費分析報告</h1><p>${esc(D.Rg.lab)}・${D.Rg.s.replace(/-/g, '/')} – ${D.Rg.e.replace(/-/g, '/')}</p></div></div>
    <div class="kpi"><div><small>支出（我的）</small><b class="neg">${money(Math.round(D.tot))}</b><em>${D.last ? `${D.chg > 0 ? '▲' : '▼'} ${Math.abs(D.chg).toFixed(0)}% vs ${D.pN}` : `${D.pN}沒有資料`}</em></div><div><small>收入</small><b class="pos">${money(Math.round(D.inc))}</b><em>結餘 ${money(Math.round(D.inc - D.tot))}</em></div><div><small>平均每天</small><b>${money(Math.round(D.tot / D.Rg.days))}</b><em>${D.Rg.days} 天</em></div><div><small>支出筆數</small><b>${D.outs.length}</b><em>每筆平均 ${money(D.outs.length ? Math.round(D.tot / D.outs.length) : 0)}</em></div></div>
    ${D.tips.length ? `<section><h2>重點摘要</h2><ul class="tips">${D.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
    ${C.bars ? `<section><h2>${D.u === 'w' ? '這週每天' : D.u === 'm' ? '每天' : '每個月'}支出（必要／非必要）</h2><div class="chart">${img(C.bars)}</div></section>` : ''}
    ${D.u === 'h' || D.u === 'y' ? `<section><h2>每月收支</h2><table><thead><tr><th>月份</th><th class="r">必要</th><th class="r">非必要</th><th class="r">支出</th><th class="r">收入</th><th class="r">結餘</th></tr></thead><tbody>${D.B.map(x => `<tr><td>${x.tip}</td><td class="r">${money(Math.round(x.e))}</td><td class="r">${money(Math.round(x.o))}</td><td class="r neg">${money(Math.round(x.v))}</td><td class="r pos">${money(Math.round(x.inc))}</td><td class="r ${x.inc - x.v < 0 ? 'neg' : 'pos'}">${money(Math.round(x.inc - x.v))}</td></tr>`).join('')}</tbody></table></section>` : ''}
    <section><h2>支出分類</h2><div class="chart" style="max-width:62%">${img(C.all)}</div>${catT(D.G, D.tot)}</section>
    <section><h2>必要／非必要消費</h2><div class="bar"><i style="width:${D.tot ? (D.ess / D.tot * 100).toFixed(1) : 100}%"></i></div><p>必要 <b>${money(Math.round(D.ess))}</b>（${pct(D.ess, D.tot)}）　非必要 <b class="opt">${money(Math.round(D.opt))}</b>（${pct(D.opt, D.tot)}）</p>
      <div class="two"><div>${img(C.ess)}</div><div>${img(C.opt)}</div></div><div class="two"><div><h2 style="font-size:13px">必要消費分類</h2>${catT(D.GE, D.ess)}</div><div><h2 style="font-size:13px">非必要消費分類</h2>${catT(D.GO, D.opt)}</div></div></section>
    ${C.week ? `<section><h2>星期分布</h2><div class="chart" style="max-width:62%">${img(C.week)}</div></section>` : ''}
    ${D.big.length ? `<section><h2>最大筆的支出</h2><table><thead><tr><th>日期</th><th>商家／說明</th><th>分類</th><th class="r">金額</th></tr></thead><tbody>${D.big.map(r => `<tr><td>${r.d.replace(/-/g, '/')}</td><td>${esc(r.payee || String(r.note || '').split('\n')[0] || accCat(r).n)}${D.isOpt(r) ? ' <span class="opt">非必要</span>' : ''}</td><td>${esc(accCat(r).n)}</td><td class="r">${money(Math.round(accMine(r)))}</td></tr>`).join('')}</tbody></table></section>` : ''}
    ${D.PY.length ? `<section><h2>最常消費的地方</h2><table><thead><tr><th>商家</th><th class="r">次數</th><th class="r">金額</th><th class="r">佔比</th></tr></thead><tbody>${D.PY.map(([n, o]) => `<tr><td>${esc(n)}</td><td class="r">${o.c}</td><td class="r">${money(Math.round(o.v))}</td><td class="r">${pct(o.v, D.tot)}</td></tr>`).join('')}</tbody></table></section>` : ''}
    <h2 class="pb">收支明細</h2><table><thead><tr><th>日期</th><th>時間</th><th>類型</th><th>分類</th><th>商家／說明</th><th>帳戶</th><th class="r">金額</th></tr></thead><tbody>${D.outs.concat(D.ins).sort((x, y) => (x.d + (x.t || '')).localeCompare(y.d + (y.t || ''))).map(r => `<tr><td>${r.d.replace(/-/g, '/')}</td><td>${esc(r.t || '')}</td><td>${r.type === 'in' ? '收入' : D.isOpt(r) ? '<span class="opt">非必要</span>' : '支出'}</td><td>${esc(accCat(r).n)}</td><td>${esc(r.payee || String(r.note || '').split('\n')[0] || '')}</td><td>${esc(acctName(r.acct) || '')}</td><td class="r ${r.type === 'in' ? 'pos' : 'neg'}">${r.type === 'in' ? '+' : '-'}${money(Math.round(r.type === 'in' ? +r.amt : accMine(r)))}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">沒有紀錄</td></tr>'}</tbody></table>
    <div class="foot">日日帳本・製作時間 ${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}・金額為「我的」支出（已扣掉別人分攤的部分）</div></body></html>`;
  if (IS_APP && NB.printHtml) { NB.printHtml(html, rptName(D)); return; }
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.append(f); f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(() => f.remove(), 60000); }, 500);
}

/* ---------- Excel：多個工作表（總覽含圖表、分類、必要／非必要、趨勢、明細、商家），有樣式、欄寬、凍結窗格 ---------- */
async function accReportXlsx(D) {
  const C = rptCharts(D), pngs = [], add = (c, col, row, w, h) => { if (!c) return; const b64 = c.toDataURL('image/png').split(',')[1], bin = Uint8Array.from(atob(b64), x => x.charCodeAt(0)); pngs.push({bin, col, row, w, h}); };
  /* 樣式編號：0 一般 1 標題 2 副標 3 表頭 4 金額 5 百分比 6 粗體 7 小計列 8 粗體金額(小計) 9 支出紅 10 收入綠 11 KPI 標籤 12 KPI 數字 13 灰字 */
  const sheets = []; const S = (name, cols, rows, opt = {}) => sheets.push({name, cols, rows, opt});
  const pc = (v, t) => t ? v / t : 0, R0 = n => Math.round(n);
  /* 總覽 */
  const ov = [[{v: '消費分析報告', s: 1}], [{v: `${D.Rg.lab}　${D.Rg.s.replace(/-/g, '/')} – ${D.Rg.e.replace(/-/g, '/')}`, s: 2}], [],
    [{v: '支出（我的）', s: 11}, {v: '收入', s: 11}, {v: '結餘', s: 11}, {v: '平均每天', s: 11}, {v: '支出筆數', s: 11}, {v: `比${D.pN}`, s: 11}],
    [{v: R0(D.tot), s: 12}, {v: R0(D.inc), s: 12}, {v: R0(D.inc - D.tot), s: 12}, {v: R0(D.tot / D.Rg.days), s: 12}, {v: D.outs.length, s: 12}, {v: D.last ? D.chg / 100 : '—', s: D.last ? 5 : 0}], [],
    [{v: '重點摘要', s: 6}], ...D.tips.map(t => [{v: '・' + t}]), []];
  const chartRow = ov.length; ov.push([{v: '圖表', s: 6}]);
  /* 圖表一張一張往下排（每列約 24px），不會超出列印範圍 */
  let r = chartRow + 1; const put = (c, w, h) => { if (!c) return; add(c, 0, r, w, h); r += Math.ceil(h / 24) + 1; };
  put(C.bars, 680, 231); put(C.all, 520, 300); put(C.ess, 520, 300); put(C.opt, 520, 300); put(C.week, 520, 240);
  S('總覽', [16, 14, 14, 14, 14, 14, 14, 14], ov);
  const catRows = (L, T, title) => [[{v: title, s: 6}], ['分類', '子分類', '筆數', '金額', '佔比'].map(v => ({v, s: 3})), ...L.flatMap(g => [...g.subL.map((s, j) => [j ? '' : {v: g.n, s: 6}, s.n, s.cnt, {v: R0(s.v), s: 4}, {v: pc(s.v, T), s: 5}]), [{v: g.n + ' 小計', s: 7}, {v: '', s: 7}, {v: g.cnt, s: 7}, {v: R0(g.v), s: 8}, {v: pc(g.v, T), s: 14}]]), [{v: '合計', s: 7}, {v: '', s: 7}, {v: L.reduce((t, g) => t + g.cnt, 0), s: 7}, {v: R0(T), s: 8}, {v: T ? 1 : 0, s: 14}], []];
  S('支出分類', [16, 18, 8, 14, 10], [[{v: '支出分類', s: 1}], [{v: D.Rg.lab, s: 2}], [], ...catRows(D.G, D.tot, '全部支出')], {bar: [4]});
  S('必要與非必要', [16, 18, 8, 14, 10], [[{v: '必要／非必要消費', s: 1}], [{v: `必要 ${money(R0(D.ess))}（${(pc(D.ess, D.tot) * 100).toFixed(1)}%）　非必要 ${money(R0(D.opt))}（${(pc(D.opt, D.tot) * 100).toFixed(1)}%）`, s: 2}], [], ...catRows(D.GE, D.ess, '✅ 必要消費'), ...catRows(D.GO, D.opt, '🎈 非必要消費')]);
  if (D.B.length) S('趨勢', [14, 12, 12, 12, 12, 12], [[{v: D.u === 'h' || D.u === 'y' ? '每月收支' : '每天支出', s: 1}], [], ['期間', '必要', '非必要', '支出', '收入', '結餘'].map(v => ({v, s: 3})), ...D.B.map(x => [x.tip, {v: R0(x.e), s: 4}, {v: R0(x.o), s: 4}, {v: R0(x.v), s: 9}, {v: R0(x.inc), s: 10}, {v: R0(x.inc - x.v), s: x.inc - x.v < 0 ? 9 : 10}]),
    [{v: '合計', s: 7}, {v: R0(D.ess), s: 8}, {v: R0(D.opt), s: 8}, {v: R0(D.tot), s: 8}, {v: R0(D.inc), s: 8}, {v: R0(D.inc - D.tot), s: 8}]], {bar: [3]});
  const all = D.outs.concat(D.ins).sort((x, y) => (x.d + (x.t || '')).localeCompare(y.d + (y.t || '')));
  S('明細', [12, 7, 9, 12, 12, 24, 16, 12, 40], [[{v: '收支明細', s: 1}], [], ['日期', '時間', '類型', '母分類', '子分類', '商家／說明', '帳戶', '金額', '備註'].map(v => ({v, s: 3})),
    ...all.map(x => { const f = catFind(x.type, x.cat); return [x.d, x.t || '', x.type === 'in' ? '收入' : D.isOpt(x) ? '非必要' : '必要', f.p ? f.p.n : '', f.s ? f.s.n : '', x.payee || '', acctName(x.acct) || '', {v: R0(x.type === 'in' ? +x.amt : -accMine(x)), s: x.type === 'in' ? 10 : 9}, String(x.note || '').replace(/\n/g, '　').slice(0, 200)]; })], {freeze: 3, filter: true});
  if (D.PY.length) S('商家排行', [24, 8, 14, 10], [[{v: '最常消費的地方', s: 1}], [], ['商家', '次數', '金額', '佔比'].map(v => ({v, s: 3})), ...D.PY.map(([n, o]) => [n, o.c, {v: R0(o.v), s: 4}, {v: pc(o.v, D.tot), s: 5}])], {bar: [2]});
  const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = i => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + i % 26);
  const sheetXml = (sh, si) => { const rows = sh.rows, last = rows.length, maxC = Math.max(1, ...rows.map(r => r.length));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" showGridLines="0"${si === 0 ? ' tabSelected="1"' : ''}>${sh.opt.freeze ? `<pane ySplit="${sh.opt.freeze}" topLeftCell="A${sh.opt.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>
      <cols>${sh.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}"${ri === 0 ? ' ht="30" customHeight="1"' : ''}>${r.map((c, ci) => { const o = c && typeof c === 'object' ? c : {v: c}, ref = col(ci) + (ri + 1), st = o.s ? ` s="${o.s}"` : '';
        return o.v === '' || o.v == null ? (o.s ? `<c r="${ref}"${st}/>` : '') : typeof o.v === 'number' ? `<c r="${ref}"${st}><v>${o.v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${X(o.v)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData>
      ${sh.opt.filter ? `<autoFilter ref="A${sh.opt.freeze}:${col(maxC - 1)}${last}"/>` : ''}
      ${(sh.opt.bar || []).map(ci => `<conditionalFormatting sqref="${col(ci)}4:${col(ci)}${last}"><cfRule type="dataBar" priority="1"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FFD9B48F"/></dataBar></cfRule></conditionalFormatting>`).join('')}
      <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>${si === 0 && pngs.length ? '<drawing r:id="rId1"/>' : ''}</worksheet>`; };
  const EMU = 9525, drawing = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pngs.map((p, i) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${p.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${p.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${p.w * EMU}" cy="${p.h * EMU}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="圖表 ${i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${p.w * EMU}" cy="${p.h * EMU}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('')}</xdr:wsDr>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0;[Red]-&quot;$&quot;#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
    <fonts count="8"><font><sz val="11"/><color rgb="FF3B2B1D"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="18"/><color rgb="FF6F5A3F"/><name val="Microsoft JhengHei"/></font><font><sz val="11"/><color rgb="FF7A6550"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FF3B2B1D"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FFA8472F"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><color rgb="FF4F6E34"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="15"/><color rgb="FF3B2B1D"/><name val="Microsoft JhengHei"/></font></fonts>
    <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFB5653A"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6EFE2"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFAF5EC"/></patternFill></fill></fills>
    <borders count="2"><border/><border><bottom style="thin"><color rgb="FFEADFCB"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="15">
    <xf fontId="0" borderId="0"/><xf fontId="1" applyFont="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" fillId="2" borderId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf fontId="0" numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf fontId="0" numFmtId="165" borderId="1" applyNumberFormat="1" applyBorder="1"/><xf fontId="4" applyFont="1"/>
    <xf fontId="4" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="4" fillId="4" numFmtId="164" borderId="1" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"/>
    <xf fontId="5" numFmtId="164" borderId="1" applyFont="1" applyNumberFormat="1" applyBorder="1"/><xf fontId="6" numFmtId="164" borderId="1" applyFont="1" applyNumberFormat="1" applyBorder="1"/>
    <xf fontId="2" fillId="3" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf><xf fontId="7" fillId="3" numFmtId="164" applyFont="1" applyFill="1" applyNumberFormat="1"><alignment horizontal="center"/></xf><xf fontId="2" applyFont="1"/><xf fontId="4" fillId="4" numFmtId="165" borderId="1" applyFont="1" applyFill="1" applyNumberFormat="1" applyBorder="1"/></cellXfs></styleSheet>`;
  const files = [
    {name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}${pngs.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : ''}</Types>`},
    {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${X(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${sheets.map((s, i) => s.opt.filter ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${X(s.name)}'!$A$${s.opt.freeze}:$${col(Math.max(...s.rows.map(r => r.length)) - 1)}$${s.rows.length}</definedName></definedNames>` : '').join('')}</workbook>`},
    {name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name: 'xl/styles.xml', data: styles},
    ...sheets.map((s, i) => ({name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s, i)}))];
  if (pngs.length) files.push({name: 'xl/worksheets/_rels/sheet1.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'},
    {name: 'xl/drawings/drawing1.xml', data: drawing}, {name: 'xl/drawings/_rels/drawing1.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pngs.map((p, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/chart${i + 1}.png"/>`).join('')}</Relationships>`},
    ...pngs.map((p, i) => ({name: `xl/media/chart${i + 1}.png`, data: p.bin})));
  const p = await saveFile(rptName(D) + '.xlsx', zipStore(files)); toast('📊 已存成 Excel：' + (String(p).split('/').pop() || ''), 3500);
}
