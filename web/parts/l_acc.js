/* ============================================================
   記帳：收入／支出＋分帳欠款，不定期跟別人「對帳」
   DB.acc = {recs:[rec], settles:[settle], cats:{out:[], in:[]}, accts:[], me}
   rec = {id, d:'2026-11-22', t:'18:20', type:'out'|'in', amt, cat, acct, note, tags:[], payer:人, split:[{p, amt}], items:[{n, amt, ppl}], src:{bill}, settled:{人: settleId}}
   欠款：付錢的是我 → 分到的人欠我；付錢的是別人 → 我分到的部分我欠他
   ============================================================ */
const ACC_OUT = [['早餐', '🍳'], ['午餐', '🍱'], ['晚餐', '🍽️'], ['飲料', '🧋'], ['點心', '🍰'], ['食材生鮮', '🥕'], ['日用品', '🧻'], ['購物', '🛍️'], ['交通', '🚌'], ['加油', '⛽'], ['房租', '🏠'], ['水電瓦斯', '💡'], ['電話網路', '📱'], ['醫療', '💊'], ['娛樂', '🎬'], ['旅行', '✈️'], ['學習', '📚'], ['保險', '🛡️'], ['禮物', '🎁'], ['其他', '📦']];
const ACC_IN = [['薪水', '💰'], ['獎金', '🎉'], ['利息', '🏦'], ['投資', '📈'], ['收回欠款', '↩️'], ['退款', '🔁'], ['其他收入', '💵']];
const ACC_ACCT = [['現金', '💵'], ['銀行', '🏦'], ['信用卡', '💳'], ['電子支付', '📲']];
const Acc = {ym: null, day: null};
const saveAcc = debounce(() => IDB.put('kv', 'acc', DB.acc).catch(saveErr), 200);
async function loadAcc() {
  const v = await IDB.get('kv', 'acc').catch(() => null), mk = L => L.map(([n, i], k) => ({id: 'c' + k + uid(), n, i}));
  DB.acc = Object.assign({recs: [], settles: [], cats: {out: mk(ACC_OUT), in: mk(ACC_IN)}, accts: ACC_ACCT.map(([n, i], k) => ({id: 'a' + k + uid(), n, i})), me: ''}, v || {});
}
const accMe = () => { const P = DB.mcfg.people; if (DB.acc.me && P.some(u => u.id === DB.acc.me)) return DB.acc.me; const u = P.find(x => x.name === '我') || P[0]; return u ? u.id : 'me'; };
const accCat = r => (DB.acc.cats[r.type === 'in' ? 'in' : 'out'] || []).find(c => c.id === r.cat) || {n: r.type === 'in' ? '收入' : '支出', i: r.type === 'in' ? '💵' : '📦'};
const accAcct = id => DB.acc.accts.find(a => a.id === id);
const r2 = n => Math.round(n * 100) / 100;
/* 某筆紀錄中，p 欠我多少（負數＝我欠 p） */
function accOwe(r, p) {
  if (r.type !== 'out' || !(r.split || []).length) return 0; const me = accMe(), payer = r.payer || me, sh = id => (r.split.find(s => s.p === id) || {}).amt || 0;
  if (payer === me && p !== me) return sh(p); if (payer === p) return -sh(me); return 0;
}
function accDebts() { const per = {}; DB.acc.recs.forEach(r => (r.split || []).map(s => s.p).concat(r.payer ? [r.payer] : []).forEach(p => { if (p === accMe() || (r.settled || {})[p]) return; const o = accOwe(r, p); if (o) per[p] = r2((per[p] || 0) + o); })); return per; }
const accSign = r => r.type === 'in' ? 1 : -1;
/* 我自己實際花多少（分帳時只算我的那一份）；收入算全額 */
const accMine = r => r.type === 'in' ? +r.amt || 0 : (r.split || []).length ? ((r.split.find(s => s.p === accMe()) || {}).amt || 0) : +r.amt || 0;

/* ---------- 主畫面 ---------- */
function renderAcc() {
  const box = $('#accBody'); if (!box || !DB.acc) return; const now = new Date(); if (!Acc.ym) Acc.ym = [now.getFullYear(), now.getMonth()];
  const [Y, Mo] = Acc.ym, pre = `${Y}-${String(Mo + 1).padStart(2, '0')}`, first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(), today = ymd(now);
  const mon = DB.acc.recs.filter(r => r.d && r.d.startsWith(pre)), out = mon.filter(r => r.type === 'out').reduce((s, r) => s + accMine(r), 0), inc = mon.filter(r => r.type === 'in').reduce((s, r) => s + (+r.amt || 0), 0);
  const net = {}; mon.forEach(r => { net[r.d] = (net[r.d] || 0) + accSign(r) * accMine(r); });
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), dow = (first.getDay() + d - 1) % 7, v = net[k];
    cells += `<button class="cd ${k === Acc.day ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${v ? `<em class="acN ${v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}</em>` : ''}</button>`; }
  const debts = accDebts(), dIds = pOrder(Object.keys(debts).filter(p => debts[p]));
  const L = (Acc.day ? mon.filter(r => r.d === Acc.day) : mon).slice().sort((a, b) => (b.d + (b.t || '')).localeCompare(a.d + (a.t || '')));
  const days = []; L.forEach(r => { let g = days.find(x => x.d === r.d); if (!g) days.push(g = {d: r.d, L: []}); g.L.push(r); });
  $('#accSub').textContent = `${Mo + 1}月・${mon.length} 筆`;
  box.innerHTML = `<div class="acSum card"><div class="acT out"><small>支出</small><b>${money(out)}</b></div><div class="acT in"><small>收入</small><b>${money(inc)}</b></div><div class="acT bal"><small>結餘</small><b>${money(inc - out)}</b></div></div>
    ${dIds.length ? `<div class="acDebt card"><div class="acDH"><b>🤝 還沒結清的欠款</b><button class="btn sm" data-a="settleLog">對帳紀錄</button></div>${dIds.map(p => { const u = mWho(p), v = debts[p]; return `<button class="acDR" data-settle="${p}"><span class="acDI">${esc(u.icon)}</span><span class="grow"><b>${esc(u.name)}</b><small>${v > 0 ? '欠我' : '我欠他'}</small></span><span class="acDV ${v > 0 ? 'pos' : 'neg'}">${money(Math.abs(v))}</span><span class="acDGo">對帳 ›</span></button>`; }).join('')}</div>` : ''}
    <div class="cal card">${calHead(Y, Mo)}<div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG acCal">${cells}</div></div>
    ${Acc.day ? `<div class="invDayBar"><span class="grow">📅 只看 ${dayLabel(Acc.day)}</span><button class="btn sm" data-a="allDays">看整個月</button></div>` : ''}
    ${days.map(g => { const s = g.L.reduce((t, r) => t + accSign(r) * accMine(r), 0); return `<div class="acDay"><span>${dayLabel(g.d)}</span><b class="${s > 0 ? 'pos' : 'neg'}">${s > 0 ? '+' : ''}${money(s)}</b></div>${g.L.map(accCard).join('')}`; }).join('')
      || `<div class="empty mealEmpty"><span class="big">📒</span>${Acc.day ? '這天' : '這個月'}還沒有記帳<br><span class="small">按上面的「＋ 記一筆」，或「從分帳匯入」把購物明細帶進來</span></div>`}`;
}
function accCard(r) {
  const c = accCat(r), a = accAcct(r.acct), me = accMe(), sp = (r.split || []).filter(s => s.p !== me), payer = r.payer || me;
  const chips = sp.length ? (payer === me ? sp.map(s => { const st = (r.settled || {})[s.p]; return `<span class="acChip ${st ? 'ok' : ''}">${esc(mWho(s.p).name)} 欠 ${money(s.amt)}${st ? ' ✓' : ''}</span>`; }).join('')
    : `<span class="acChip ${(r.settled || {})[payer] ? 'ok' : 'neg'}">${esc(mWho(payer).name)} 付・我欠 ${money(-accOwe(r, payer))}${(r.settled || {})[payer] ? ' ✓' : ''}</span>`) : '';
  return `<button class="acR card" data-r="${r.id}"><span class="acI">${esc(c.i)}</span><span class="acM"><b>${esc(c.n)}${r.note ? `<em>${esc(r.note)}</em>` : ''}</b><small>${[r.t, a ? a.i + ' ' + a.n : '', (r.items || []).length ? (r.items.length + ' 個品項') : '', ...(r.tags || []).map(t => '#' + t)].filter(Boolean).map(esc).join('・')}</small>${chips ? `<span class="acChips">${chips}</span>` : ''}</span>
    <span class="acV ${r.type === 'in' ? 'pos' : 'neg'}">${r.type === 'in' ? '+' : '-'}${money(r.amt).replace('$', '$')}${sp.length && r.type === 'out' ? `<small>我 ${money(accMine(r))}</small>` : ''}</span></button>`;
}
function initAcc() {
  loadAcc().catch(() => {});
  $('#accBack').onclick = () => { buzz(10); showTab('Set'); };
  $('#accNew').onclick = () => { buzz(15); accEdit(null); };
  $('#accImp').onclick = () => { buzz(10); accImportBills(); };
  $('#accFind').onclick = () => { buzz(10); accSearch(); };
  $('#accSettle').onclick = () => { buzz(10); accPickSettle(); };
  $('#accCfg').onclick = () => { buzz(10); accSettings(); };
  $('#accBody').addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-d],[data-r],[data-settle]'); if (!t) return; buzz(8);
    if (t.dataset.d) { Acc.day = Acc.day === t.dataset.d ? null : t.dataset.d; renderAcc(); return; }
    if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r); return; }
    if (t.dataset.settle) { accSettle(t.dataset.settle); return; }
    const a = t.dataset.a, [Y, Mo] = Acc.ym;
    if (a === 'pm' || a === 'nm') { const d = new Date(Y, Mo + (a === 'pm' ? -1 : 1), 1); Acc.ym = [d.getFullYear(), d.getMonth()]; Acc.day = null; renderAcc(); }
    else if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Y, Mo, a === 'ymY' ? 'y' : 'm'); if (r) { Acc.ym = r; Acc.day = null; renderAcc(); } }
    else if (a === 'allDays') { Acc.day = null; renderAcc(); }
    else if (a === 'settleLog') accSettleLog(); });
}

/* ---------- 記一筆／編輯 ---------- */
function accEdit(r0, preset) {
  return new Promise(res => {
    const isNew = !r0, me = accMe(), now = new Date();
    const r = JSON.parse(JSON.stringify(r0 || Object.assign({id: 'r' + uid(), d: Acc.day || ymd(now), t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), type: 'out', amt: 0, cat: '', acct: (DB.acc.accts[0] || {}).id || '', note: '', tags: [], payer: me, split: [], items: []}, preset || {})));
    if (!r.cat) r.cat = (DB.acc.cats[r.type][0] || {}).id;
    let expr = r.amt ? String(r.amt) : '', mode = (r.split || []).length && r.split.some((s, i, A) => Math.abs(s.amt - A[0].amt) > 0.011) ? 'custom' : 'even';
    let who = (r.split || []).map(s => s.p), custom = {}; (r.split || []).forEach(s => { custom[s.p] = s.amt; });
    const sh = sheet({title: isNew ? '📒 記一筆' : '📒 編輯記帳', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">儲存</button>`, onClose() { res(null); }});
    const calc = () => { try { const s = expr.replace(/[^\d.+\-×÷*/]/g, '').replace(/×/g, '*').replace(/÷/g, '/'); if (!s) return 0; const v = Function('"use strict";return (' + s.replace(/[+\-*/.]+$/, '') + ')')(); return isFinite(v) ? r2(v) : 0; } catch (e) { return 0; } };
    const shares = () => { const A = calc(); if (!who.length) return []; if (mode === 'custom') return who.map(p => ({p, amt: r2(+custom[p] || 0)}));
      const base = Math.floor(A / who.length * 100) / 100; let rest = r2(A - base * who.length); return who.map(p => { let v = base; if (rest > 0.001) { const add = Math.min(rest, 0.01); v = r2(v + add); rest = r2(rest - add); } return {p, amt: v}; }); };
    const draw = () => { const cats = DB.acc.cats[r.type], A = calc(), sp = shares(), sumSp = r2(sp.reduce((s, x) => s + x.amt, 0)), payer = r.payer || me, tagsAll = [...new Set(DB.acc.recs.flatMap(x => x.tags || []))].slice(0, 12);
      sh.body.innerHTML = `<div class="acType"><button data-ty="out" class="${r.type === 'out' ? 'on' : ''}">支出</button><button data-ty="in" class="${r.type === 'in' ? 'on' : ''}">收入</button></div>
        <div class="acAmt ${r.type}"><span class="acCur">NT$</span><b id="acA">${expr ? esc(expr) : '0'}</b>${/[+\-×÷]/.test(expr) ? `<small>= ${money(A)}</small>` : ''}</div>
        <div class="acKeys">${['7', '8', '9', '⌫', '4', '5', '6', '+', '1', '2', '3', '−', '00', '0', '.', 'AC'].map(k => `<button data-k="${k}" class="${/[⌫+−]|AC/.test(k) ? 'op' : ''}">${k}</button>`).join('')}</div>
        <div class="lbl">類別</div><div class="acCats">${cats.map(c => `<button data-cat="${c.id}" class="${c.id === r.cat ? 'on' : ''}"><i>${esc(c.i)}</i><span>${esc(c.n)}</span></button>`).join('')}<button data-a="addCat"><i>＋</i><span>新增</span></button></div>
        <div class="acRow3"><button class="btn" data-a="date">📅 ${r.d.slice(5).replace('-', '/')}（${MWD[ymdDate(r.d).getDay()]}）</button><button class="btn" data-a="time">🕒 ${esc(r.t || '時間')}</button><button class="btn" data-a="acct">${(() => { const a = accAcct(r.acct); return a ? esc(a.i + ' ' + a.n) : '💳 帳戶'; })()}</button></div>
        <div class="field"><label>備註</label><input id="acNote" value="${esc(r.note || '')}" placeholder="例如：全聯、和同事聚餐"></div>
        <div class="field"><label>標籤（用空白或逗號分開）</label><input id="acTags" value="${esc((r.tags || []).join(' '))}" placeholder="例如：旅行 公司"></div>
        ${tagsAll.length ? `<div class="acTagSug">${tagsAll.map(t => `<button data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>` : ''}
        ${r.type === 'out' ? `<div class="acSplit card"><div class="acSH"><b>🤝 分帳</b><small>${who.length ? '選了 ' + who.length + ' 人分' : '不分帳就不用選'}</small></div>
          <div class="lbl">誰付的錢</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-payer="${u.id}" class="${payer === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div>
          <div class="lbl">誰要分（點選）</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-who="${u.id}" class="${who.includes(u.id) ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}<button data-a="addP">＋ 新增</button></div>
          ${who.length ? `<div class="dkSeg acMode"><button data-mode="even" class="${mode === 'even' ? 'on' : ''}">平均分</button><button data-mode="custom" class="${mode === 'custom' ? 'on' : ''}">自己填金額</button></div>
            <div class="acShares">${sp.map(s => `<div class="acShR"><span>${esc(mWho(s.p).icon)} ${esc(mWho(s.p).name)}</span>${mode === 'custom' ? `<input data-cu="${s.p}" value="${custom[s.p] != null ? custom[s.p] : ''}" inputmode="decimal" placeholder="0">` : `<b>${money(s.amt)}</b>`}</div>`).join('')}</div>
            ${mode === 'custom' && Math.abs(sumSp - A) > 0.01 ? `<div class="blWarn">⚠️ 分攤合計 ${money(sumSp)}，和金額 ${money(A)} 差 ${money(A - sumSp)}</div>` : ''}
            <div class="acOwe">${sp.filter(s => s.p !== payer).map(s => `<span>${esc(mWho(s.p).name)} → ${esc(mWho(payer).name)}　<b>${money(s.amt)}</b></span>`).join('') || '<span class="muted">只有付錢的人自己，沒有欠款</span>'}</div>` : ''}</div>` : ''}
        ${(r.items || []).length ? `<div class="lbl">品項（從分帳帶入）</div><div class="acItems card">${r.items.map(x => `<div class="acIt"><span class="grow">${esc(x.n)}</span><small>${(x.ppl || []).map(p => esc(mWho(p).name)).join('、')}</small><b>${money(x.amt)}</b></div>`).join('')}</div>` : ''}`; };
    draw();
    const keep = () => { const n = $('#acNote', sh.body), t = $('#acTags', sh.body); if (n) r.note = n.value.trim(); if (t) r.tags = t.value.split(/[\s,，#]+/).map(s => s.trim()).filter(Boolean); };
    sh.body.addEventListener('input', e => { const c = e.target.dataset.cu; if (c) { custom[c] = e.target.value.replace(/[^\d.]/g, ''); } });
    sh.body.addEventListener('change', e => { if (e.target.dataset.cu) { keep(); draw(); } });
    sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); keep(); const d = t.dataset;
      if (d.k) { const k = d.k; if (k === 'AC') expr = ''; else if (k === '⌫') expr = expr.slice(0, -1); else if (k === '+' || k === '−') { if (expr && !/[+\-]$/.test(expr)) expr += k === '+' ? '+' : '-'; } else if (k === '.') { if (!/\.\d*$/.test(expr.split(/[+\-]/).pop() || '')) expr += (expr && !/[+\-]$/.test(expr) ? '' : '0') + '.'; } else if (expr.replace(/[^\d]/g, '').length < 10) expr = (expr === '0' ? '' : expr) + k; draw(); return; }
      if (d.ty) { if (r.type !== d.ty) { r.type = d.ty; r.cat = (DB.acc.cats[r.type][0] || {}).id; } draw(); return; }
      if (d.cat) { r.cat = d.cat; draw(); return; }
      if (d.tag) { if (!r.tags.includes(d.tag)) r.tags.push(d.tag); draw(); return; }
      if (d.payer) { r.payer = d.payer; if (!who.includes(d.payer) && who.length) who.push(d.payer); draw(); return; }
      if (d.who) { const i = who.indexOf(d.who); if (i >= 0) who.splice(i, 1); else who.push(d.who); who = sortIds(who); draw(); return; }
      if (d.mode) { mode = d.mode; if (mode === 'custom') shares().forEach(s => { if (custom[s.p] == null || custom[s.p] === '') custom[s.p] = s.amt; }); draw(); return; }
      const a = d.a;
      if (a === 'date') { const k = await datePick(r.d); if (k) { r.d = k; draw(); } }
      else if (a === 'time') { const v = await timePick(r.t); if (v) { r.t = v; draw(); } }
      else if (a === 'acct') { const v = await accPickAcct(r.acct); if (v !== undefined) { r.acct = v; draw(); } }
      else if (a === 'addCat') { const n = ((await askText('新類別名稱（可以在前面加一個表情符號，例如 🐶 寵物）', '')) || '').trim(); if (!n) return; const m = n.match(/^(\p{Extended_Pictographic}️?)\s*(.+)$/u); const c = {id: 'c' + uid(), n: (m ? m[2] : n).slice(0, 10), i: m ? m[1] : '🏷️'}; DB.acc.cats[r.type].push(c); r.cat = c.id; saveAcc(); draw(); }
      else if (a === 'addP') { const n = ((await askText('新增人員名字', '')) || '').trim(); if (!n) return; const u = {id: 'u' + uid(), name: n.slice(0, 10), icon: PERSON_EMOJI[DB.mcfg.people.length % PERSON_EMOJI.length]}; DB.mcfg.people.push(u); saveMcfg(); who.push(u.id); draw(); } });
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; keep();
      if (b.dataset.a === 'del') { if (!await ask('確定要刪除這筆記帳嗎？', '刪除', true)) return; DB.acc.recs = DB.acc.recs.filter(x => x.id !== r.id); saveAcc(); sh.close(); renderAcc(); toast('已刪除'); return; }
      const A = calc(); if (!(A > 0)) { toast('請輸入金額'); return; }
      r.amt = A; r.split = r.type === 'out' ? shares() : []; if (r.split.length === 1 && r.split[0].p === (r.payer || me)) r.split = [];
      if (r.type !== 'out') r.payer = me;
      if (mode === 'custom' && r.split.length && Math.abs(r.split.reduce((s, x) => s + x.amt, 0) - A) > 0.01 && !await ask('分攤金額加起來和總金額不一樣，還是要儲存嗎？', '儲存')) return;
      const i = DB.acc.recs.findIndex(x => x.id === r.id); if (i >= 0) DB.acc.recs[i] = r; else DB.acc.recs.push(r); saveAcc(); buzz(25);
      const d0 = ymdDate(r.d); Acc.ym = [d0.getFullYear(), d0.getMonth()]; sh.close(); if (curTab === 'Acc') renderAcc(); toast(isNew ? '✅ 已記帳' : '✅ 已儲存'); res(r); };
  });
}
function accPickAcct(cur) {
  return new Promise(res => { let done = false; const sh = sheet({title: '選擇帳戶', onClose() { if (!done) res(undefined); }});
    const draw = () => { sh.body.innerHTML = `<div class="actList">${DB.acc.accts.map(a => `<button data-id="${a.id}">${esc(a.i)} ${esc(a.n)}${a.id === cur ? '　✓' : ''}</button>`).join('')}<button data-a="add">＋ 新增帳戶</button></div>`; }; draw();
    sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.id) { done = true; sh.close(); res(t.dataset.id); return; }
      const n = ((await askText('帳戶名稱（例如：玉山銀行、LINE Pay）', '')) || '').trim(); if (!n) return; const a = {id: 'a' + uid(), n: n.slice(0, 12), i: /pay/i.test(n) ? '📲' : /銀行|郵局/.test(n) ? '🏦' : /卡/.test(n) ? '💳' : '👛'}; DB.acc.accts.push(a); saveAcc(); draw(); }; });
}

/* ---------- 對帳 ---------- */
function accPickSettle() {
  const d = accDebts(), ids = pOrder(Object.keys(d).filter(p => d[p])); const others = DB.mcfg.people.filter(u => u.id !== accMe() && !ids.includes(u.id));
  const sh = sheet({title: '🤝 要跟誰對帳？', html: `<div class="actList">${ids.map(p => `<button data-p="${p}">${esc(mWho(p).icon)} ${esc(mWho(p).name)}　<b class="${d[p] > 0 ? 'pos' : 'neg'}">${d[p] > 0 ? '欠我' : '我欠'} ${money(Math.abs(d[p]))}</b></button>`).join('')}${others.map(u => `<button data-p="${u.id}">${esc(u.icon)} ${esc(u.name)}　<span class="muted">沒有未結清</span></button>`).join('')}</div>`});
  sh.body.onclick = e => { const t = e.target.closest('[data-p]'); if (!t) return; buzz(10); sh.close(); accSettle(t.dataset.p); };
}
function accSettle(p) {
  const u = mWho(p), all = DB.acc.recs.filter(r => !(r.settled || {})[p] && accOwe(r, p)).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  if (!all.length) { toast(`和 ${u.name} 沒有還沒結清的帳`); return; }
  let from = all[0].d, to = ymd(new Date()), open = new Set();
  const sh = sheet({title: `🤝 和 ${u.icon} ${u.name} 對帳`, full: true, foot: '<button class="btn" data-a="copy">📋 複製明細</button><button class="btn" data-a="xlsx">📤 Excel</button><button class="btn pri" data-a="ok">✅ 結清</button>'});
  const list = () => all.filter(r => r.d >= from && r.d <= to), tot = () => r2(list().reduce((s, r) => s + accOwe(r, p), 0));
  const draw = () => { const L = list(), T = tot();
    sh.body.innerHTML = `<div class="acStH ${T >= 0 ? 'pos' : 'neg'}"><small>${from.replace(/-/g, '/')} ～ ${to.replace(/-/g, '/')}・${L.length} 筆</small><b>${T >= 0 ? `${esc(u.name)} 欠我` : `我欠 ${esc(u.name)}`}</b><strong>${money(Math.abs(T))}</strong></div>
      <div class="acRow3 two"><button class="btn" data-a="from">從 ${from.slice(5).replace('-', '/')}</button><button class="btn" data-a="to">到 ${to.slice(5).replace('-', '/')}</button></div>
      <div class="acStL card">${L.map(r => { const c = accCat(r), o = accOwe(r, p), its = (r.items || []).filter(x => (x.ppl || []).includes(p) || (r.payer === p && (x.ppl || []).includes(accMe()))); return `<div class="acStR" data-o="${r.id}"><span class="acStD">${r.d.slice(5).replace('-', '/')}</span><span class="grow"><b>${esc(c.i)} ${esc(r.note || c.n)}</b><small>總額 ${money(r.amt)}・${r.payer === p ? esc(u.name) + ' 付' : '我付'}${its.length ? '・' + its.length + ' 個品項 ' + (open.has(r.id) ? '▴' : '▾') : ''}</small>
        ${open.has(r.id) && its.length ? `<span class="acStIt">${its.map(x => `<span>${esc(x.n)}<em>${money(x.amt / ((x.ppl || []).length || 1))}</em></span>`).join('')}</span>` : ''}</span><b class="${o >= 0 ? 'pos' : 'neg'}">${o >= 0 ? '' : '-'}${money(Math.abs(o))}</b></div>`; }).join('') || '<div class="empty">這段期間沒有紀錄</div>'}</div>
      <div class="small muted" style="margin-top:.6rem">按「✅ 結清」後，這些紀錄會標記為已結清，不會再算進欠款；在「對帳紀錄」可以取消。</div>`; };
  const text = () => { const L = list(), T = tot(); return [`🤝 ${u.name} 對帳（${from.replace(/-/g, '/')}～${to.replace(/-/g, '/')}）`, ''].concat(L.map(r => { const c = accCat(r), o = accOwe(r, p); return `${r.d.slice(5).replace('-', '/')} ${r.note || c.n}　${o >= 0 ? '' : '-'}${money(Math.abs(o))}`; })).concat(['', T >= 0 ? `合計：${u.name} 欠我 ${money(T)}` : `合計：我欠 ${u.name} ${money(-T)}`]).join('\n'); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-o]'); if (!t) return; buzz(8);
    if (t.dataset.o) { const id = t.dataset.o; if (open.has(id)) open.delete(id); else open.add(id); draw(); return; }
    if (t.dataset.a === 'from') { const k = await datePick(from); if (k) { from = k; draw(); } } else if (t.dataset.a === 'to') { const k = await datePick(to); if (k) { to = k; draw(); } } });
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); const a = b.dataset.a, L = list(), T = tot();
    if (a === 'copy') copyText(text());
    else if (a === 'xlsx') { const rows = [[{v: `${u.name} 對帳 ${from}～${to}`, s: 1}], [], [{v: '日期', s: 1}, {v: '類別', s: 1}, {v: '備註', s: 1}, {v: '總額', s: 1}, {v: '誰付', s: 1}, {v: '欠款', s: 1}]].concat(L.map(r => [r.d, accCat(r).n, r.note || '', +r.amt, r.payer === p ? u.name : '我', accOwe(r, p)])).concat([[], [{v: T >= 0 ? `${u.name} 欠我` : `我欠 ${u.name}`, s: 1}, '', '', '', '', Math.abs(T)]]);
      try { const blob = await xlsxBook(rows, [12, 10, 24, 10, 8, 10], '對帳'); const pth = await saveFile(`對帳_${u.name}_${to}.xlsx`, blob); toast(IS_APP ? '已匯出到「下載」資料夾：' + pth : '已下載', 3500); } catch (err) { toast('匯出失敗：' + err.message); } }
    else if (a === 'ok') { if (!L.length) return; if (!await ask(`${T >= 0 ? `${u.name} 已經還我` : `我已經還 ${u.name}`} ${money(Math.abs(T))}，把這 ${L.length} 筆標記為已結清？`, '結清')) return;
      const st = {id: 's' + uid(), p, d: ymd(new Date()), from, to, amt: T, recs: L.map(r => r.id)}; DB.acc.settles.push(st); L.forEach(r => { r.settled = r.settled || {}; r.settled[p] = st.id; }); saveAcc(); sh.close(); renderAcc(); buzz(40); toast('✅ 已結清'); } };
}
function accSettleLog() {
  const sh = sheet({title: '📜 對帳紀錄', full: true}); const draw = () => { const L = DB.acc.settles.slice().reverse();
    sh.body.innerHTML = L.map(s => `<div class="acLog card"><span class="acDI">${esc(mWho(s.p).icon)}</span><span class="grow"><b>${esc(mWho(s.p).name)}・${s.amt >= 0 ? '他還我' : '我還他'} ${money(Math.abs(s.amt))}</b><small>${s.d} 結清・${s.from.slice(5)}～${s.to.slice(5)}・${s.recs.length} 筆</small></span><button class="btn sm" data-u="${s.id}">取消結清</button></div>`).join('') || '<div class="empty">還沒有對帳紀錄</div>'; };
  draw(); sh.body.onclick = async e => { const t = e.target.closest('[data-u]'); if (!t) return; if (!await ask('取消這次結清？這些紀錄會回到「未結清」。', '取消結清', true)) return;
    const s = DB.acc.settles.find(x => x.id === t.dataset.u); DB.acc.recs.forEach(r => { if (r.settled && r.settled[s.p] === s.id) delete r.settled[s.p]; }); DB.acc.settles = DB.acc.settles.filter(x => x !== s); saveAcc(); draw(); renderAcc(); };
}

/* ---------- 從分帳匯入 ---------- */
function accGuessCat(b) {
  const P = (DB.places || []).find(x => x.id === b.place), cn = P ? (DB.cats.find(c => c.id === P.cat) || {}).name || '' : '', L = DB.acc.cats.out, f = n => (L.find(c => c.n === n) || {}).id;
  return f(cn) || (/超市|量販|全聯|家樂福|大全聯|好市多/.test(cn + billStore(b)) ? f('食材生鮮') : '') || (/超商|便利/.test(cn) ? f('日用品') : '') || (/外送|foodpanda|uber/i.test((b.way || '') + cn) ? f('晚餐') : '') || f('購物') || (L[0] || {}).id;
}
function billToAccRec(b, k) {
  const c = billCalc(b), me = accMe(), tot = r2(c.total != null ? c.total : c.computed), per = c.per, ids = pOrder(Object.keys(per));
  let split = ids.map(p => ({p, amt: r2(per[p])})); const diff = r2(tot - split.reduce((s, x) => s + x.amt, 0)); if (split.length && Math.abs(diff) < 1) split[split.length - 1].amt = r2(split[split.length - 1].amt + diff);
  if (split.length === 1 && split[0].p === me) split = [];
  return {id: 'r' + uid(), d: k, t: b.time || '', type: 'out', amt: tot, cat: accGuessCat(b), acct: (DB.acc.accts[0] || {}).id || '', note: billStore(b) || '購物', tags: [], payer: me, split,
    items: (b.items || []).map(x => ({n: x.n, amt: r2(numP(x.amt) - (c.itemDisc[x.id] || 0)), ppl: (x.ppl || []).slice()})), src: {bill: b.id}};
}
async function billToAcc(b) {
  const k = billKey(b), old = DB.acc.recs.find(r => r.src && r.src.bill === b.id);
  if (old && !await ask('這筆明細已經匯入過記帳了，要再開啟那筆記帳嗎？', '開啟')) return;
  if (old) { showTab('Acc'); accEdit(old); return; }
  const r = await accEdit(null, billToAccRec(b, k)); if (r) { b.acc = r.id; saveBills(); }
}
function accImportBills() {
  const done = new Set(DB.acc.recs.filter(r => r.src && r.src.bill).map(r => r.src.bill)), all = [];
  Object.keys(DB.bills || {}).sort().reverse().forEach(k => DB.bills[k].forEach(b => { if (!done.has(b.id)) all.push({k, b}); }));
  if (!all.length) { toast('分帳裡的明細都已經匯入過了'); return; }
  const sel = new Set(all.filter(x => x.k.startsWith(`${Acc.ym[0]}-${String(Acc.ym[1] + 1).padStart(2, '0')}`)).map(x => x.b.id));
  const sh = sheet({title: '📥 從分帳匯入', full: true, foot: '<button class="btn" data-a="all">全選</button><button class="btn pri" data-a="ok">匯入</button>'});
  const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">勾選要匯入的購物明細。每個人分到的金額、品項都會一起帶進來，付錢的人預設是「${esc(mWho(accMe()).name)}」，匯入後可以再改。</div>` + all.map(({k, b}) => { const c = billCalc(b), ids = pOrder(Object.keys(c.per)); return `<button class="acImp card ${sel.has(b.id) ? 'on' : ''}" data-b="${b.id}"><span class="acCk"></span><span class="grow"><b>${esc(billStore(b) || '購物明細')}</b><small>${dayLabel(k)}・${(b.items || []).length} 項${ids.length ? '・' + ids.map(p => esc(mWho(p).name) + ' ' + money(c.per[p])).join('、') : ''}</small></span><b>${money(c.total != null ? c.total : c.computed)}</b></button>`; }).join('');
    sh.foot.querySelector('[data-a="ok"]').textContent = `匯入 ${sel.size} 筆`; };
  draw(); sh.body.onclick = e => { const t = e.target.closest('[data-b]'); if (!t) return; buzz(8); const id = t.dataset.b; if (sel.has(id)) sel.delete(id); else sel.add(id); draw(); };
  sh.foot.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10);
    if (b.dataset.a === 'all') { if (sel.size === all.length) sel.clear(); else all.forEach(x => sel.add(x.b.id)); draw(); return; }
    if (!sel.size) { toast('請先勾選'); return; } let n = 0; all.forEach(({k, b: bb}) => { if (!sel.has(bb.id)) return; const r = billToAccRec(bb, k); DB.acc.recs.push(r); bb.acc = r.id; n++; }); saveAcc(); saveBills(); sh.close(); renderAcc(); toast(`✅ 已匯入 ${n} 筆`); };
}

/* ---------- 搜尋、設定 ---------- */
function accSearch() {
  let q = '', only = false; const sh = sheet({title: '🔍 搜尋記帳', full: true});
  sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="aq" type="search" placeholder="備註、類別、標籤、金額、人名"></div><div class="whoRow" style="margin-bottom:.6rem"><button data-a="only">🤝 只看未結清</button></div><div id="aqS"></div><div id="aqL"></div>`;
  const draw = () => { const me = accMe(), L = DB.acc.recs.filter(r => { if (only && !(r.split || []).concat(r.payer && r.payer !== me ? [{p: r.payer}] : []).some(s => s.p !== me && !(r.settled || {})[s.p] && accOwe(r, s.p))) return false; if (!q) return true;
      const c = accCat(r), s = [c.n, r.note, ...(r.tags || []), String(r.amt), ...(r.split || []).map(x => mWho(x.p).name), ...(r.items || []).map(x => x.n)].join(' ').toLowerCase(); return s.includes(q); }).sort((a, b) => (b.d + (b.t || '')).localeCompare(a.d + (a.t || '')));
    const o = L.filter(r => r.type === 'out').reduce((s, r) => s + accMine(r), 0), i = L.filter(r => r.type === 'in').reduce((s, r) => s + (+r.amt || 0), 0);
    $('#aqS', sh.body).innerHTML = `<div class="acSum card sm"><div class="acT out"><small>支出</small><b>${money(o)}</b></div><div class="acT in"><small>收入</small><b>${money(i)}</b></div><div class="acT bal"><small>${L.length} 筆</small><b>${money(i - o)}</b></div></div>`;
    $('#aqL', sh.body).innerHTML = L.slice(0, 200).map(r => `<div class="acDay"><span>${dayLabel(r.d)}</span></div>` + accCard(r)).join('') || '<div class="empty">找不到符合的紀錄</div>'; $('[data-a="only"]', sh.body).classList.toggle('on', only); };
  draw(); $('#aq', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-a],[data-r]'); if (!t) return; buzz(8); if (t.dataset.a === 'only') { only = !only; draw(); } else if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r).then(() => draw()); } });
}
function accSettings() {
  const sh = sheet({title: '⚙️ 記帳設定', full: true}); const draw = () => sh.body.innerHTML = `<div class="lbl">我是誰（分帳時「我」是哪一個人）</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-me="${u.id}" class="${accMe() === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div>
    <div class="lbl" style="margin-top:1rem">帳戶</div><div class="acCfgL">${DB.acc.accts.map(a => `<button data-ea="${a.id}">${esc(a.i)} ${esc(a.n)}</button>`).join('')}<button data-a="addA">＋ 新增</button></div>
    <div class="lbl" style="margin-top:1rem">支出類別</div><div class="acCfgL">${DB.acc.cats.out.map(c => `<button data-ec="out:${c.id}">${esc(c.i)} ${esc(c.n)}</button>`).join('')}</div>
    <div class="lbl" style="margin-top:1rem">收入類別</div><div class="acCfgL">${DB.acc.cats.in.map(c => `<button data-ec="in:${c.id}">${esc(c.i)} ${esc(c.n)}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:.8rem">點一下可以改名或刪除；新增類別在「記一筆」的類別最後面按「＋ 新增」。人員和「日常」點餐共用同一份名單。</div>`; draw();
  sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.me) { DB.acc.me = d.me; saveAcc(); draw(); renderAcc(); return; }
    if (d.a === 'addA') { await accPickAcct(''); draw(); return; }
    let L, o; if (d.ea) { L = DB.acc.accts; o = L.find(x => x.id === d.ea); } else if (d.ec) { const [ty, id] = d.ec.split(':'); L = DB.acc.cats[ty]; o = L.find(x => x.id === id); } if (!o) return;
    const v = await askText('改名（清空＝刪除）', o.i + ' ' + o.n); if (v == null) return; const s = v.trim();
    if (!s) { if (L.length <= 1) { toast('至少要留一個'); return; } if (!await ask(`刪除「${o.n}」？已經記的帳不會刪除。`, '刪除', true)) return; L.splice(L.indexOf(o), 1); }
    else { const m = s.match(/^(\p{Extended_Pictographic}️?)\s*(.+)$/u); if (m) { o.i = m[1]; o.n = m[2].slice(0, 12); } else o.n = s.slice(0, 12); }
    saveAcc(); draw(); renderAcc(); };
}
