/* ============================================================
   點餐：月曆 + 每天吃什麼（餐別 → 店家 → 誰吃什麼、單價、數量、小計）
   DB.mcfg = {types:[{id,name,icon}], people:[{id,name,icon}], custom:[{id,place,pname,n,p}]}
   DB.days = {'2026-11-18': [{id, type, place, pname, items:[{id, who, n, s, p, q}]}]}
   ============================================================ */
const MEAL_DEF_TYPES = [['早餐', '🍳'], ['午餐', '🍱'], ['晚餐', '🍽️'], ['宵夜', '🌙'], ['點心', '🍰'], ['飲料', '🧋']];
const PERSON_EMOJI = '🙂 😀 😎 🤓 🥰 😺 🐶 🐻 🐼 🐰 👨 👩 👦 👧 👴 👵 🧑 👶 🧔 👱 🧑‍💼 🧑‍🍳 👨‍👩‍👧 ⭐ ❤️ 💙 💚 💛'.split(' ');
const MWD = ['日', '一', '二', '三', '四', '五', '六'];
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const ymdDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const money = v => { const n = Math.round((+v || 0) * 100) / 100; return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US'); };
const numP = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };
const saveMcfg = debounce(() => IDB.put('kv', 'mcfg', DB.mcfg).catch(saveErr), 200);
const saveDays = debounce(() => IDB.put('kv', 'days', DB.days).catch(saveErr), 200);
async function loadMeal() {
  DB.mcfg = await IDB.get('kv', 'mcfg').catch(() => null) || {types: MEAL_DEF_TYPES.map(([name, icon], i) => ({id: 't' + i + uid(), name, icon})), people: [{id: 'u' + uid(), name: '我', icon: '🙂'}], custom: []};
  DB.mcfg.custom = DB.mcfg.custom || []; DB.days = await IDB.get('kv', 'days').catch(() => null) || {}; DB.lists = await IDB.get('kv', 'lists').catch(() => null) || {};
}
const mType = id => DB.mcfg.types.find(t => t.id === id) || {id, name: '（已刪除的餐別）', icon: '🍴'};
const FP = () => DB.side ? DB.side.food.places : DB.places;
const mWho = id => DB.mcfg.people.find(u => u.id === id) || {id, name: '（已刪除）', icon: '👤'};
/* 一起吃：x.who = '*'、x.share = [人id…]，金額平均分攤 */
const SHARE = '*';
const isShare = x => x.who === SHARE && Array.isArray(x.share) && x.share.length > 1;
const pOrd = id => { const i = DB.mcfg.people.findIndex(u => u.id === id); return i < 0 ? 999 : i; };
const sortIds = ids => [...new Set(ids)].sort((a, b) => pOrd(a) - pOrd(b));
const wkey = x => isShare(x) ? 'S:' + sortIds(x.share).join(',') : x.who;
const keyIds = k => String(k || '').startsWith('S:') ? k.slice(2).split(',') : [k];
const shareNames = ids => ids.map(id => mWho(id).name).join('、');
const xAmt = x => numP(x.p) * (x.q || 0);
function perOf(m) { const per = {}; (m.items || []).forEach(x => { const t = xAmt(x); if (isShare(x)) x.share.forEach(id => { per[id] = (per[id] || 0) + t / x.share.length; }); else per[x.who] = (per[x.who] || 0) + t; }); return per; }
function shareOf(m) { const per = {}; (m.items || []).filter(isShare).forEach(x => x.share.forEach(id => { per[id] = (per[id] || 0) + xAmt(x) / x.share.length; })); return per; }
const ownIds = m => sortIds((m.items || []).filter(x => !isShare(x)).map(x => x.who));
const allIds = m => sortIds((m.items || []).flatMap(x => isShare(x) ? x.share : [x.who]));
function shareSets(m) { const L = []; (m.items || []).filter(isShare).forEach(x => { const k = wkey(x); let g = L.find(y => y.key === k); if (!g) L.push(g = {key: k, ids: keyIds(k), xs: []}); g.xs.push(x); }); return L; }
const mealTotal = m => (m.items || []).reduce((s, x) => s + numP(x.p) * (x.q || 0), 0);
const dayTotal = k => (DB.days[k] || []).reduce((s, m) => s + mealTotal(m), 0);

const Meal = {sel: ymd(new Date()), ym: null};

/* ---------- 主畫面 ---------- */
/* 舊版點餐的選項可能跟品項本身的份量矛盾（例如「特製涼麵 (特大量)」卻記著「一般量」）：份量以品項為準，把矛盾的份量選項拿掉 */
function itemSize(x) { if (x.s) return x.s; const m = String(x.n || '').match(/[（(]([^()（）]+)[)）]\s*$/); return m && isSizeWord(m[1].trim()) ? m[1].trim() : ''; }
function fixOptSize(x) { const z = itemSize(x); if (!z || !x.o) return false; const sz = w => isSizeWord(w) || /^(麵|飯|份)?量?加大$|^加大/.test(w);
  const a = String(x.o).split(/[，,]/).map(w => w.trim()).filter(Boolean), b = a.filter(w => !sz(w) || w === z); if (b.length === a.length) return false; if (b.length) x.o = b.join('，'); else delete x.o; return true; }
function fixAllOptSize() { if (fixAllOptSize.done) return; fixAllOptSize.done = 1; let n = 0; Object.values(DB.days || {}).forEach(L => (L || []).forEach(m => (m.items || []).forEach(x => { if (fixOptSize(x)) n++; }))); if (n) saveDays(); }
function renderMeal() { fixAllOptSize();
  const box = $('#mealBody'); if (!box) return; const sel = ymdDate(Meal.sel); if (!Meal.ym) Meal.ym = [sel.getFullYear(), sel.getMonth()];
  const [Y, Mo] = Meal.ym, first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(), today = ymd(new Date()), yNow = new Date().getFullYear();
  const yrs = []; for (let y = Math.min(yNow - 5, Y); y <= Math.max(yNow + 2, Y); y++) yrs.push(y);
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), ms = DB.days[k] || [], t = dayTotal(k), dow = (first.getDay() + d - 1) % 7;
    cells += `<button class="cd ${k === Meal.sel ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${ms.length || dayLists(k).length ? `<span class="dots">${ms.length ? '<em class="dot"></em>' : ''}${dayLists(k).length ? '<em class="dot ls"></em>' : ''}</span>` : ''}</button>`; }
  const ms = DB.days[Meal.sel] || [];
  updMealSub();
  /* 每個人今天的總金額 */
  const per = {}; ms.forEach(m => { const pm = perOf(m); Object.keys(pm).forEach(id => { per[id] = (per[id] || 0) + pm[id]; }); });
  const order = DB.mcfg.people.map(u => u.id).concat(Object.keys(per).filter(id => !DB.mcfg.people.some(u => u.id === id))).filter(id => per[id] != null);
  box.innerHTML = `<div class="cal card">
      ${calHead(Y, Mo)}
      <div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div>
      <div class="calG">${cells}</div></div>
    <div class="dayHead"><b class="dhD">${sel.getMonth() + 1}月${sel.getDate()}日 星期${MWD[sel.getDay()]}</b><span class="grow"></span>${ms.length ? `<span class="dayTot">${money(dayTotal(Meal.sel))}</span><button class="btn sm" data-a="export">📤 匯出</button>` : ''}</div>
    ${ms.length ? `<div class="secT">🍱 餐點（${ms.length}）</div>` : ''}${ms.map(mealCard).join('')}
    ${dayLists(Meal.sel).length ? `<div class="secT">🛒 購物清單（${dayLists(Meal.sel).length}）</div>${dayLists(Meal.sel).map(listCard).join('')}` : ''}
    ${!ms.length && !dayLists(Meal.sel).length ? '<div class="empty mealEmpty"><span class="big">📒</span>這天還沒有安排<br><span class="small">按上面的「🍱 記一餐」記錄吃什麼、誰付多少，<br>或「🛒 購物清單」列出要買的東西</span></div>' : ''}
    ${order.length ? `<div class="perSum card"><div class="psH">👥 每個人這天的總金額</div>${order.map(id => { const u = mWho(id); return `<div class="psR"><span class="psI">${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><span>${money(per[id])}</span></div>`; }).join('')}<div class="psR tot"><b class="grow">合計</b><span>${money(dayTotal(Meal.sel))}</span></div></div>` : ''}`;
  $$('.slist', box).forEach(bindListSort);
}
function updMealSub() { const sel = ymdDate(Meal.sel), ms = DB.days[Meal.sel] || [], ls = dayLists(Meal.sel), left = ls.reduce((t, l) => t + (l.items || []).length, 0);
  $('#mealSub').textContent = `${sel.getMonth() + 1}月${sel.getDate()}日（${MWD[sel.getDay()]}）${ms.length ? ' · ' + ms.length + ' 餐' : ''}${ls.length ? ` · 🛒 ${left ? '待買 ' + left : '已買齊'}` : ''}`; }
function mealCard(m) {
  const T = mType(m.type), P = FP().find(x => x.id === m.place), groups = ownIds(m), shs = shareSets(m), per = perOf(m), sha = shareOf(m), any = (m.items || []).length;
  const tbl = xs => `<table class="mlT"><tr><th class="n">品項</th><th>單價</th><th>數量</th><th>小計</th></tr>${xs.map(x => `<tr data-i="${x.id}"><td class="n" data-a="editItem">${esc(x.n)}${xTags(x)}</td><td class="r">${money(x.p)}</td><td class="qc"><span class="q"><button data-a="qm">−</button><b>${x.q}</b><button data-a="qp">＋</button></span></td><td class="r b">${money(xAmt(x))}</td></tr>`).join('')}</table>`;
  return `<div class="meal card" data-m="${m.id}">
    <div class="mlH"><div class="grow"><b>${esc(T.name)}</b><div class="mlS" data-a="store">${m.place || m.pname ? '🏪 ' + esc(P ? P.name : m.pname || '') : '<span class="muted">未選店家</span>'}</div></div>${m.place || m.pname ? `<button class="ic mlTel ${mealPhone(m) ? '' : 'none'}" data-a="tel" aria-label="打電話">📞</button>` : ''}<button class="btn sm pri" data-a="order">＋ 點餐</button><button class="ic" data-a="mMore" aria-label="更多">⋯</button></div>
    ${any ? groups.map(id => { const u = mWho(id), xs = m.items.filter(x => !isShare(x) && x.who === id);
      return `<div class="mlP"><div class="mlPH"><span>${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><span class="mlPT">${money(per[id])}${sha[id] ? `<small>含一起吃 ${money(sha[id])}</small>` : ''}</span></div>${tbl(xs)}</div>`; }).join('')
      + shs.map(g => { const st = g.xs.reduce((a, x) => a + xAmt(x), 0);
        return `<div class="mlP share"><div class="mlPH"><span>👥</span><b class="grow">一起吃・${esc(shareNames(g.ids))}</b><span class="mlPT">${money(st)}<small>每人 ${money(st / g.ids.length)}</small></span></div>${tbl(g.xs)}${g.ids.filter(id => !groups.includes(id)).length ? `<div class="mlShN">${g.ids.filter(id => !groups.includes(id)).map(id => `${esc(mWho(id).name)} 這餐 ${money(per[id])}`).join('・')}</div>` : ''}</div>`; }).join('')
      : `<div class="mlNone">還沒有點餐，按「＋ 點餐」選誰要吃什麼</div>`}
    ${any ? `<div class="mlF"><span class="grow">${esc(T.name)}合計 · ${m.items.reduce((s, x) => s + (x.q || 0), 0)} 份</span><b>${money(mealTotal(m))}</b></div>` : ''}</div>`;
}
const curMeal = id => (DB.days[Meal.sel] || []).find(m => m.id === id);
function mealChanged() { const L = DB.days[Meal.sel]; if (L && !L.length) delete DB.days[Meal.sel]; saveDays(); renderMeal(); }

function initMeal() {
  const box = $('#mealBody');
  $('#mealToday').onclick = () => { const d = new Date(); Meal.sel = ymd(d); Meal.ym = [d.getFullYear(), d.getMonth()]; renderMeal(); };
  $('#mealSet').onclick = () => openMealSettings(); $('#mealFind').onclick = () => openMealSearch();
  $('#mealAddBtn').onclick = () => { buzz(15); box.dispatchEvent(new CustomEvent('fm:addMeal')); }; $('#listAddBtn').onclick = () => { buzz(15); newList(); };
  box.addEventListener('fm:addMeal', async () => { const t = await pickMealType(); if (!t) return; const st = await pickStore(); if (st === undefined) return;
    const nm = {id: 'm' + uid(), type: t.id, place: st ? st.id || '' : '', pname: st ? st.name : '', items: []}; (DB.days[Meal.sel] = DB.days[Meal.sel] || []).push(nm); mealChanged(); openOrder(nm, {dropEmpty: true}); });
  initLists();
  box.addEventListener('change', e => { if (e.target.id === 'calY') Meal.ym[0] = +e.target.value; else if (e.target.id === 'calM') Meal.ym[1] = +e.target.value; else return;
    const nd = new Date(Meal.ym[0], Meal.ym[1] + 1, 0).getDate(), d = Math.min(ymdDate(Meal.sel).getDate(), nd); Meal.sel = ymd(new Date(Meal.ym[0], Meal.ym[1], d)); renderMeal(); });
  box.addEventListener('click', async e => { const b = e.target.closest('[data-a],[data-d]'); if (!b) return;
    if (b.dataset.d) { Meal.sel = b.dataset.d; renderMeal(); return; }
    const a = b.dataset.a, card = b.closest('.meal'), m = card && curMeal(card.dataset.m);
    if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Meal.ym[0], Meal.ym[1], a === 'ymY' ? 'y' : 'm'); if (!r) return; Meal.ym = r; const nd = new Date(r[0], r[1] + 1, 0).getDate(); Meal.sel = ymd(new Date(r[0], r[1], Math.min(ymdDate(Meal.sel).getDate(), nd))); renderMeal(); return; }
    if (a === 'pm' || a === 'nm') { const d = new Date(Meal.ym[0], Meal.ym[1] + (a === 'pm' ? -1 : 1), 1); Meal.ym = [d.getFullYear(), d.getMonth()]; const nd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); Meal.sel = ymd(new Date(d.getFullYear(), d.getMonth(), Math.min(ymdDate(Meal.sel).getDate(), nd))); renderMeal(); }
    else if (a === 'addMeal') { const t = await pickMealType(); if (!t) return; const st = await pickStore(); if (st === undefined) return;
      const nm = {id: 'm' + uid(), type: t.id, place: st ? st.id || '' : '', pname: st ? st.name : '', items: []}; (DB.days[Meal.sel] = DB.days[Meal.sel] || []).push(nm); mealChanged(); openOrder(nm); }
    else if (a === 'export') openExport(Meal.sel);
    else if (!m) return;
    else if (a === 'order') openOrder(m);
    else if (a === 'store') { const st = await pickStore(m.place); if (st === undefined) return; m.place = st ? st.id || '' : ''; m.pname = st ? st.name : ''; mealChanged(); }
    else if (a === 'mMore') mealMore(m);
    else if (a === 'tel') { let ph = mealPhone(m);
      if (!ph) { const v = ((await askText(`「${storeName(m)}」還沒有電話，輸入後會記住`, '', '例如 037-590111')) || '').trim(); if (!v) return; const P = FP().find(x => x.id === m.place); if (P) { P.phone = v; savePlace(P); } else m.phone = v; saveDays(); ph = v; renderMeal(); }
      openUrl('tel:' + ph.replace(/[^\d+]/g, '')); }
    else if (a === 'qm' || a === 'qp') { const x = m.items.find(i => i.id === b.closest('tr').dataset.i); if (!x) return; buzz(10);
      if (a === 'qp') x.q++; else if (x.q > 1) x.q--; else { if (!await ask(`要刪除「${x.n}」嗎？`, '刪除', true)) return; m.items.splice(m.items.indexOf(x), 1); } mealChanged(); }
    else if (a === 'editItem') { const x = m.items.find(i => i.id === b.closest('tr').dataset.i); if (x) editMealItem(m, x); } });
}
/* 點餐 → 購物分帳：一起吃的品項分給那幾個人，自己的品項給自己 */
async function mealToBill(m, k) {
  const T = mType(m.type), L = DB.bills[k] = DB.bills[k] || [], old = L.find(b => b.meal === m.id);
  const items = (m.items || []).filter(x => xAmt(x) || x.n).map(x => ({id: 'i' + uid(), n: x.n + xParen(x), p: numP(x.p), q: x.q || 1, amt: Math.round(xAmt(x) * 100) / 100, ppl: isShare(x) ? sortIds(x.share) : x.who && x.who !== SHARE ? [x.who] : []}));
  if (!items.length) { toast('這一餐還沒有點任何東西'); return; }
  const P = FP().find(p => p.id === m.place), b = old || {id: 'b' + uid(), t: Date.now()};
  Object.assign(b, {place: m.place || '', pname: P ? '' : (m.pname || T.name), way: b.way || '', time: b.time || '', items, fees: b.fees || [], disc: [], odisc: b.odisc || [], total: Math.round(mealTotal(m) * 100) / 100 - (b.odisc || []).reduce((s, d) => s + numP(d.amt), 0) + (b.fees || []).reduce((s, d) => s + numP(d.amt), 0), meal: m.id, note: T.name});
  if (!old) L.push(b); saveBills(); buzz(30); toast(old ? '這一餐已經轉過了，不會重複匯入；已用目前的點餐內容更新那筆明細' : `✅ 已轉到分帳（${T.name}）`, 2500); gotoBill(k, b.id);
}
async function mealMore(m) {
  const T = mType(m.type), sh = sheet({title: T.icon + ' ' + T.name, html: `<div class="actList">
    <button data-a="type">🔁 改成其他餐別</button><button data-a="store">🏪 更換店家</button>${FP().some(p => p.id === m.place) ? '<button data-a="open">📋 打開店家與菜單</button>' : ''}
    <button data-a="toBill">🧾 轉到購物分帳（每個人的品項、金額一起帶過去）</button><button data-a="exp">📤 匯出這一餐（文字／Excel）</button><button data-a="copy">📅 複製到其他日期</button><button data-a="del" class="dng">🗑 刪除這一餐</button></div>`});
  sh.body.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; sh.close();
    if (a === 'type') { const t = await pickMealType(m.type); if (t) { m.type = t.id; mealChanged(); } }
    else if (a === 'store') { const st = await pickStore(m.place); if (st !== undefined) { m.place = st ? st.id || '' : ''; m.pname = st ? st.name : ''; mealChanged(); } }
    else if (a === 'open') openPlace(m.place, true);
    else if (a === 'exp') openExport(Meal.sel, m.id);
    else if (a === 'copy') { const v = await askText('複製到哪一天？（年-月-日）', ymd(new Date(ymdDate(Meal.sel).getTime() + 864e5)), '例如 2026-11-20'); if (!v) return; const k = v.trim().replace(/[/.]/g, '-'); const d = new Date(k + 'T00:00');
      if (isNaN(d)) { toast('日期格式不正確'); return; } const c = JSON.parse(JSON.stringify(m)); c.id = 'm' + uid(); c.items.forEach(x => { x.id = 'i' + uid(); }); (DB.days[ymd(d)] = DB.days[ymd(d)] || []).push(c); saveDays(); renderMeal(); toast(`已複製到 ${ymd(d)}`); }
    else if (a === 'toBill') mealToBill(m, Meal.sel);
    else if (a === 'del') { if (!await ask(`確定要刪除這一餐（${T.name}${m.pname ? '・' + m.pname : ''}）嗎？`, '刪除', true)) return; const L = DB.days[Meal.sel]; L.splice(L.indexOf(m), 1); mealChanged(); } };
}

/* ---------- 選餐別、選店家 ---------- */
function pickMealType(cur) {
  return new Promise(res => { let done = false; const sh = sheet({title: '選擇餐別', foot: '<button class="btn" data-a="cfg">⚙️ 管理餐別</button>', onClose() { if (!done) res(null); }});
    const draw = () => { sh.body.innerHTML = `<div class="typeGrid">${DB.mcfg.types.map(t => `<button data-id="${t.id}" class="${t.id === cur ? 'on' : ''}"><span>${esc(t.icon)}</span>${esc(t.name)}</button>`).join('')}<button data-a="new" class="add"><span>＋</span>新增餐別</button></div>`; };
    draw();
    sh.body.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'new') { editMealCfg('types', null, t => { draw(); if (t) { done = true; sh.close(); res(t); } }); return; } done = true; sh.close(); res(DB.mcfg.types.find(t => t.id === b.dataset.id)); };
    sh.foot.onclick = () => openMealSettings(draw); });
}
/* 回傳 place 物件、{name} 自填店名、null 不指定；undefined = 取消 */
function pickStore(cur) {
  return new Promise(res => { let done = false, q = '', only = ''; const sh = sheet({title: '選擇店家', full: true, onClose() { if (!done) res(undefined); }});
    const fin = v => { done = true; sh.close(); res(v); };
    const curP = FP().find(p => p.id === cur), open = new Set(); if (curP) open.add(curP.cat || '');
    const draw = () => { const hit = p => !q || (p.name + ' ' + (p.addr || '')).toLowerCase().includes(q), cats = DB.cats.concat([UNCAT]);
      const all = cats.map(c => ({c, ps: placesIn(c.id).filter(hit)})).filter(x => x.ps.length), secs = all.filter(x => !only || (x.c.id || '_') === only);
      const anyOpen = secs.some(x => open.has(x.c.id || ''));
      $('#psBar', sh.body).innerHTML = `<div class="psChips">${[['', '🗺️ 全部', FP().filter(hit).length]].concat(all.map(x => [x.c.id || '_', `${x.c.icon} ${x.c.name}`, x.ps.length, x.c.color])).map(([k, t, n, col]) => `<button class="chip ${only === k ? 'on' : ''}" data-only="${k}" ${col ? `style="--c:${col}"` : ''}>${esc(t)} <span class="n">${n}</span></button>`).join('')}</div>
        ${secs.length > 1 && !q ? `<div class="psTools"><span class="psHint">點分類展開店家</span><button class="btn sm" data-a="foldAll">${anyOpen ? '⊟ 全部收合' : '⊞ 全部展開'}</button></div>` : ''}`;
      $('#psL', sh.body).innerHTML = secs.map(({c, ps}) => { const on = q || only || open.has(c.id || ''); return `<div class="psSec ${on ? 'open' : ''}" style="--c:${c.color}"><button class="psSH" data-cat="${c.id || ''}"><span>${esc(c.icon)}</span><b>${esc(c.name)}</b><em>${ps.length}</em><i class="psCv">▾</i></button>${on ? `<div class="psPL">${ps.map(p => `<button class="psP ${p.id === cur ? 'on' : ''}" data-id="${p.id}"><b>${esc(p.name)}</b><small>${(p.menu || []).length ? '📋 ' + p.menu.length + ' 個品項' : '<span class="muted">沒有菜單表格</span>'}${p.addr ? '・' + esc(p.addr) : ''}</small></button>`).join('')}</div>` : ''}</div>`; }).join('')
        || `<div class="empty">${FP().length ? '找不到符合的收藏店家' : '還沒有收藏店家<br><span class="small">可以先在地圖頁收藏，或用上面的「自己輸入店名」</span>'}</div>`; };
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.7rem"><input id="psQ" type="search" placeholder="搜尋收藏的店家…"></div><div class="row" style="margin-bottom:.7rem;gap:.5rem"><button class="btn sm" data-a="free">✏️ 自己輸入店名</button><button class="btn sm" data-a="none">先不選店家</button></div><div id="psBar"></div><div id="psL"></div>`;
    draw(); $('#psQ', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    sh.body.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; buzz(8);
      if (b.dataset.only != null) { only = b.dataset.only; draw(); return; }
      if (b.dataset.a === 'foldAll') { const ks = [...$$('.psSH', sh.body)].map(x => x.dataset.cat), any = ks.some(k => open.has(k)); ks.forEach(k => any ? open.delete(k) : open.add(k)); draw(); return; }
      if (b.dataset.cat != null) { if (only || q) return; const k = b.dataset.cat; if (open.has(k)) open.delete(k); else open.add(k); draw(); if (open.has(k)) { const el = $(`.psSH[data-cat="${k}"]`, sh.body); if (el) el.scrollIntoView({behavior: 'smooth', block: 'nearest'}); } return; }
      if (b.dataset.id) fin(FP().find(p => p.id === b.dataset.id));
      else if (b.dataset.a === 'none') fin(null);
      else if (b.dataset.a === 'free') { const v = ((await askText('店名', '', '例如：巷口早餐店')) || '').trim(); if (v) fin({id: '', name: v.slice(0, 30)}); } }); });
}

/* ---------- 點餐：選人 → 從菜單點品項 ---------- */
function menuChoices(p, rg) {
  const all = p.menu || [], regs = [...new Set(all.map(r => r.g).filter(Boolean))]; const cur = regs.includes(rg) ? rg : regs.includes(p.rgSel) ? p.rgSel : regs[0] || '';
  const inR = r => !cur || r.g === cur || (!r.g && !all.some(y => y.g === cur && (y.t || 'item') === (r.t || 'item') && baseName(y.n) === baseName(r.n)));
  const R = all.filter(inR), ogs = optGroups(R.filter(r => r.t === 'opt')), isCol = colLabels(R.filter(r => (r.t || 'item') !== 'opt' && r.t !== 'note'));
  const out = [], idx = {}, owned = new Set();
  R.forEach(r => { const t = r.t || 'item'; if (t === 'opt' || t === 'note') return;
    const T = labelOf(r.n), z = T.z, b = T.n, k = t + '|' + r.c + '|' + b;
    if (idx[k] == null) { idx[k] = out.length; out.push({t, rc: r.c, c: t === 'add' ? '➕ ' + (r.c || '加購') : r.c || '其他', n: b, full: t === 'item' ? fullName(r.c, b) : b, v: [], og: [], temps: new Set()}); }
    const o = out[idx[k]]; if (T.t) o.temps.add(T.t); if (!o.v.some(x => x.s === z && x.p === r.p) && !(T.t && !z && o.v.some(x => x.p === r.p))) o.v.push({s: z, p: r.p}); });
  /* 同一個品名出現在好幾個系列（好呷系列、帕瑪森系列都有「德式香腸」）：紀錄的品名加上系列，才分得出來 */
  const nm = {}; out.forEach(o => { if (o.t === 'item') (nm[o.n] = nm[o.n] || new Set()).add(o.rc); });
  out.forEach(o => { if (o.t === 'item' && nm[o.n].size > 1 && o.full === o.n) { const core = String(o.rc || '').replace(/[（(].*?[)）]/g, '').replace(/(系列|類|區|專區)$/, '').trim(); if (core && !o.full.includes(core)) o.full = core + o.full; } });
  /* 每個品項只拿「系列共用」和「專屬自己」的選項群組 */
  const cn = {}; out.forEach(o => { if (o.t === 'item') (cn[o.rc] = cn[o.rc] || []).push(o.n); });
  out.forEach(o => { if (o.t !== 'item') return; const seen = new Set(); o.og = groupsFor(o.rc, o.n, cn[o.rc], ogs).filter(g => { const k = (/溫度/.test(g.label) ? '溫度' : g.label) + '|' + g.L.map(r => r.n + r.p).join(','); if (seen.has(k)) return false; seen.add(k); return true; }); o.og.forEach(g => owned.add(g.c)); });
  /* 整個分類裡有一欄完全沒價格（例如「法式麵包｜可頌」只有法式麵包有價格）＝同價可選 → 一個價格＋「選擇」選項 */
  const labs = {}; out.forEach(o => o.v.forEach(v => { if (v.s && isCol(o.rc, v.s)) { const L = labs[o.rc] = labs[o.rc] || {}; L[v.s] = L[v.s] || (v.p !== '' && v.p != null); } }));
  out.forEach(o => { const L = labs[o.rc]; if (!L) return; const all = Object.keys(L), empty = all.filter(z => !L[z]); if (!empty.length || empty.length === all.length) return;
    const pv = o.v.filter(v => v.p !== '' && v.p != null); if (!pv.length) return; o.v = [{s: '', p: pv[0].p}]; o.og = o.og.concat([{label: '選擇', tag: '選一', L: all.map(n => ({n, p: ''}))}]); });
  /* 品名裡的「(辣/原)」→ 點餐時選口味 */
  out.forEach(o => { if (o.t !== 'item') return; const m = o.n.match(/\s*[（(]([^()（）]+[\/／][^()（）]+)[)）]\s*$/); if (!m) return; const base = o.n.slice(0, m.index).trim();
    o.full = fullName(o.rc, base); o.og = o.og.concat([{label: '口味', tag: '選一', L: m[1].split(/[\/／]/).map(n => ({n: n.trim(), p: ''})).filter(x => x.n)}]); });
  /* 沒有歸屬到系列、但有價格的選項，當成一般品項 */
  ogs.filter(g => !owned.has(g.c)).forEach(g => g.L.forEach(r => { if (r.p) out.push({t: 'opt', rc: g.c, c: '🧩 ' + (g.owner ? g.owner + '・' + g.label : g.label), n: r.n, full: r.n, v: [{s: '', p: r.p}], og: [], temps: new Set()}); }));
  const csz = {}; out.forEach(o => o.v.forEach(v => { if (v.s && isCol(o.rc, v.s)) (csz[o.rc] = csz[o.rc] || new Set()).add(v.s); }));
  /* 有分欄的品項裡沒標尺寸的價格：放進剛好缺的那一欄，否則叫「一般」 */
  out.forEach(o => { if (!o.v.some(v => v.s && isCol(o.rc, v.s))) return; o.v.forEach(v => { if (v.s) return; const miss = [...(csz[o.rc] || [])].filter(z => !o.v.some(y => y.s === z)); v.s = miss.length === 1 ? miss[0] : '一般'; }); });
  const ct = {}; out.forEach(o => o.temps.forEach(t => (ct[o.rc] = ct[o.rc] || new Set()).add(t)));
  /* 飲料：每一杯都可以選溫度（去冰、溫、熱）和甜度（正常糖、微糖、無糖）；不選就是店家預設 */
  const DRINK_C = /飲|茶|咖啡|拿鐵|果汁|奶昔|冰沙|可可|鮮奶|豆漿|汽水|氣泡|調飲|特調/, DRINK_N = /茶|咖啡|拿鐵|美式|果汁|奶昔|冰沙|可可|鮮奶|豆漿|歐蕾|多多|養樂多|汽水|可樂|氣泡|檸檬|冬瓜|烏龍|紅茶|綠茶|青茶|奶茶|牛奶|豆奶|梅|蜜|飲/, NOT_D = /吐司|麵包|蛋糕|餅|麵|飯|鍋|湯|堡|捲|派|酥|布丁|凍|雞|豬|牛排|魚|蝦|丸|粥|塔|鬆|蛋$/;
  out.forEach(o => { if (o.t !== 'item') return; const isD = DRINK_C.test(o.rc || '') ? !/湯|麵|飯|鍋/.test(o.n) : (DRINK_N.test(o.n) && !NOT_D.test(o.n)); if (!isD) return;
    if (!o.og.some(g => /溫度|冰|熱/.test(g.label))) o.og = o.og.concat([{label: '溫度', tag: '選一', L: ['去冰', '溫', '熱'].map(n => ({n, p: ''})), drink: 1}]);
    if (!o.og.some(g => /糖|甜/.test(g.label))) o.og = o.og.concat([{label: '甜度', tag: '選一', L: ['正常糖', '微糖', '無糖'].map(n => ({n, p: ''})), drink: 1}]); });
  const fin = []; out.forEach(o => { const tp = ct[o.rc]; if (tp && tp.size > 1 && o.t === 'item' && !o.og.some(g => /溫度/.test(g.label))) o.og = o.og.concat([{label: '溫度', tag: '選一', L: [...tp].map(n => ({n, p: ''}))}]);
    const keep = o.v.filter(v => !v.s || v.s === '一般' || isCol(o.rc, v.s));
    if (keep.length) fin.push(Object.assign({}, o, {v: keep.sort((a, b) => szRank(a.s) - szRank(b.s))}));
    o.v.filter(v => v.s && v.s !== '一般' && !isCol(o.rc, v.s)).forEach(v => { const n = o.n + ' (' + v.s + ')'; fin.push(Object.assign({}, o, {n, full: o.t === 'item' ? fullName(o.rc, n) : n, v: [{s: '', p: v.p}]})); }); });
  return {list: fin, regs: rgSorted(regs), cur};
}
/* 點的品項有系列選項（麵包、醬料、冰／熱）時，先選選項，加價會算進單價 */
function pickOpts(o, v) {
  return new Promise(res => { let done = false; const ch = o.og.map(g => g.multi ? [] : [-1]);
    const sh = sheet({title: o.full + (v.s ? ` (${v.s})` : ''), foot: '<div class="grow ordTot" id="poT"></div><button class="btn pri" data-a="ok" style="flex:0 0 auto">加入</button>', onClose() { if (!done) res(null); }});
    const calc = () => { let add = 0; const names = []; o.og.forEach((g, gi) => ch[gi].filter(i => i >= 0).forEach(i => { add += numP(g.L[i].p); names.push(g.L[i].n); })); return {add, names}; };
    const draw = () => { sh.body.innerHTML = o.og.map((g, gi) => `<div class="poG"><div class="lbl">${esc(g.label)}${g.tag ? ` <span class="tag">${esc(g.tag)}</span>` : ''}</div><div class="whoRow">${g.multi ? '' : `<button data-g="${gi}" data-i="-1" class="${ch[gi][0] === -1 ? 'on' : ''}">不選</button>`}${g.L.map((r, i) => `<button data-g="${gi}" data-i="${i}" class="${ch[gi].includes(i) ? 'on' : ''}">${esc(r.n)}${numP(r.p) ? ` <small>+$${numP(r.p)}</small>` : ''}</button>`).join('')}</div></div>`).join('');
      const c = calc(); $('#poT', sh.foot).innerHTML = `單價 <b>${money(numP(v.p) + c.add)}</b>${c.names.length ? ' · ' + esc(c.names.join('，')) : ''}`; };
    draw();
    sh.body.onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; const gi = +b.dataset.g, i = +b.dataset.i, g = o.og[gi]; buzz(8);
      if (g.multi) { const k = ch[gi].indexOf(i); if (k < 0) ch[gi].push(i); else ch[gi].splice(k, 1); } else ch[gi] = [i]; draw(); };
    sh.foot.onclick = e => { if (!e.target.closest('[data-a="ok"]')) return; const c = calc(); done = true; sh.close(); res({o: c.names.join('，'), add: c.add}); }; });
}
const xTags = x => `${x.s ? ` <span class="szT">${esc(x.s)}</span>` : ''}${x.o ? ` <span class="opT">${esc(x.o)}</span>` : ''}`;
const xParen = x => { const a = [x.s, x.o].filter(Boolean); return a.length ? '(' + a.join('，') + ')' : ''; };
function openOrder(m, opt = {}) {
  const P = FP().find(x => x.id === m.place), T = mType(m.type);
  let who = m.lastWho && keyIds(m.lastWho).every(id => DB.mcfg.people.some(u => u.id === id)) ? m.lastWho : (DB.mcfg.people[0] || {}).id, q = '', cat = '', rg = P ? P.rgSel : '';
  const sh = sheet({title: `${T.icon} ${T.name}${P || m.pname ? ' · ' + (P ? P.name : m.pname) : ''}`, full: true, foot: '<div class="grow ordTot" id="oTot"></div><button class="btn pri" data-a="done" style="flex:0 0 auto">完成</button>', onClose() {
    /* 新增後沒點任何東西就返回：不要留下空的一餐 */
    if (opt.dropEmpty && !(m.items || []).length && !(m.imgs || []).length) { Object.keys(DB.days).forEach(k => { const i = (DB.days[k] || []).indexOf(m); if (i >= 0) DB.days[k].splice(i, 1); if (DB.days[k] && !DB.days[k].length) delete DB.days[k]; }); mealChanged(); }
    renderMeal(); }});
  let LIST = [];
  const cnt = (n, s) => m.items.filter(x => wkey(x) === who && x.n === n && (x.s || '') === (s || '')).reduce((a, x) => a + x.q, 0);
  const add = (n, s, p, o) => { if (!who) { toast('請先新增要點餐的人'); return; } const pv = numP(p), x = m.items.find(i => wkey(i) === who && i.n === n && (i.s || '') === (s || '') && (i.o || '') === (o || '') && numP(i.p) === pv);
    const sh0 = who.startsWith('S:') ? {who: SHARE, share: keyIds(who)} : {who};
    if (x) x.q++; else { const it = Object.assign({id: 'i' + uid(), n, s: s || '', p: pv, q: 1}, sh0, o ? {o} : {}); fixOptSize(it); m.items.push(it); } m.lastWho = who; buzz(12); saveDays(); draw(); };
  const draw = () => { const C = P ? menuChoices(P, rg) : {list: [], regs: [], cur: ''}; rg = C.cur;
    const cus = DB.mcfg.custom.filter(c => (m.place ? c.place === m.place : c.pname === m.pname)).map(c => ({t: 'cus', c: '⭐ 自訂品項', n: c.n, full: c.n, og: [], v: [{s: '', p: c.p}], cid: c.id}));
    const all = cus.concat(C.list), cats = [...new Set(all.map(o => o.c))], hit = o => (!q || o.n.toLowerCase().includes(q)) && (!cat || o.c === cat);
    const L = all.filter(hit); LIST = L; const mine = m.items.filter(x => wkey(x) === who), tot = mealTotal(m), isS = who.startsWith('S:'), sIds = keyIds(who), mt = mine.reduce((s, x) => s + xAmt(x), 0);
    const sets = shareSets(m).map(g => g.key); if (isS && !sets.includes(who)) sets.push(who);
    sh.body.innerHTML = `<div class="ordWho"><span class="lbl">誰要吃</span><div class="whoRow pplGrid">${DB.mcfg.people.map(u => { const n = m.items.filter(x => !isShare(x) && x.who === u.id).reduce((a, x) => a + x.q, 0); return `<button data-who="${u.id}" class="${u.id === who ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}<button data-a="newWho" class="add">＋ 新增人名</button></div>
      <div class="whoRow shareRow">${sets.map(k => { const n = m.items.filter(x => wkey(x) === k).reduce((a, x) => a + x.q, 0); return `<button data-who="${esc(k)}" class="share ${k === who ? 'on' : ''}"><span>👥</span>${esc(shareNames(keyIds(k)))}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}<button data-a="share" class="add">👥 一起吃（分攤）</button></div></div>
      ${isS ? `<div class="shareHint">現在點的品項由 <b>${esc(shareNames(sIds))}</b> ${sIds.length} 人一起吃，金額平均分攤</div>` : ''}
      ${mine.length ? `<div class="ordMine"><div class="omH">${isS ? `👥 一起吃・${esc(shareNames(sIds))} 已點 <b>${money(mt)}</b>（每人 ${money(mt / sIds.length)}）` : `${esc(mWho(who).icon)} ${esc(mWho(who).name)} 已點 <b>${money(mt)}</b>`}</div>${mine.map(x => `<div class="omR" data-i="${x.id}"><span class="grow">${esc(x.n)}${xTags(x)}</span><span class="muted">${money(x.p)}</span><span class="q"><button data-a="om">−</button><b>${x.q}</b><button data-a="op">＋</button></span></div>`).join('')}</div>` : ''}
      ${C.regs.length > 1 ? `<div class="regBar"><span>📍 區域</span><div class="seg">${C.regs.map(r => `<button data-rg="${esc(r)}" class="${r === rg ? 'on' : ''}">${esc(r)}</button>`).join('')}</div></div>` : ''}
      ${all.length ? `<div class="searchBox" style="margin:.2rem 0 .5rem"><input id="oQ" type="search" placeholder="搜尋品項…" value="${esc(q)}"></div>${cats.length > 1 ? `<div class="chipRow ordCats"><button class="chip ${cat ? '' : 'on'}" data-cat="">全部</button>${cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}` : ''}
      <div class="ordList">${L.length ? (() => { let lc = ''; return L.map(o => { const h = o.c !== lc ? `<div class="olC">${esc(o.c)}</div>` : ''; lc = o.c;
          const oi = L.indexOf(o); return h + `<div class="olR"><div class="grow olN">${esc(o.n)}${o.og && o.og.length ? `<small class="olO">可選：${esc(o.og.map(g => g.label).join('、'))}</small>` : ''}</div><div class="olV">${o.v.map((v, vi) => { const k = cnt(o.full || o.n, v.s); return `<button data-oi="${oi}" data-vi="${vi}" class="${k ? 'on' : ''}">${v.s ? `<small>${esc(v.s)}</small>` : ''}${o.t === 'add' ? '+' : ''}${numP(v.p) || v.p === '0' ? money(v.p) : esc(v.p || '價格?')}${k ? `<i>${k}</i>` : ''}</button>`; }).join('')}</div></div>`; }).join(''); })()
        : `<div class="empty" style="padding:1.2rem">${!P ? (m.pname ? '這家店不在收藏裡，可以用下面的「自訂品項」輸入' : '還沒有選店家，可以用下面的「自訂品項」輸入') : !(P.menu || []).length ? '這家店還沒有菜單表格<br><span class="small">到收藏打開店家，用「AI 辨識成表格」建立菜單；或用下面的「自訂品項」</span>' : '找不到符合的品項'}</div>`}</div>
      <div class="ordCus"><div class="lbl">自訂品項（菜單沒有的，會記住下次可以直接點）</div><div class="row" style="gap:.4rem"><input id="cN" placeholder="品名" maxlength="30" class="grow"><input id="cP" placeholder="單價" inputmode="decimal" style="width:5.5rem"><button class="btn sm pri" data-a="cusAdd">加入</button></div></div>`;
    $('#oTot', sh.foot).innerHTML = `這餐 ${m.items.reduce((s, x) => s + x.q, 0)} 份 · <b>${money(tot)}</b>`;
    const qi = $('#oQ', sh.body); if (qi) qi.oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = $('#oQ', sh.body); n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} }, 250); };
  draw();
  sh.body.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.who) { who = b.dataset.who; draw(); }
    else if (b.dataset.rg != null) { rg = b.dataset.rg; draw(); }
    else if (b.dataset.cat != null) { cat = b.dataset.cat; draw(); }
    else if (b.dataset.oi != null) { const o = LIST[+b.dataset.oi], v = o && o.v[+b.dataset.vi]; if (!v) return;
      if (o.og && o.og.length) { const r = await pickOpts(o, v); if (!r) return; add(o.full || o.n, v.s, numP(v.p) + r.add, r.o); } else add(o.full || o.n, v.s, v.p); }
    else if (b.dataset.a === 'newWho') editMealCfg('people', null, u => { if (u) who = u.id; draw(); });
    else if (b.dataset.a === 'share') { const ids = await pickShare(who.startsWith('S:') ? keyIds(who) : [who].filter(Boolean)); if (ids) { who = 'S:' + sortIds(ids).join(','); draw(); } }
    else if (b.dataset.a === 'om' || b.dataset.a === 'op') { const x = m.items.find(i => i.id === b.closest('.omR').dataset.i); if (!x) return; buzz(10); if (b.dataset.a === 'op') x.q++; else if (--x.q <= 0) m.items.splice(m.items.indexOf(x), 1); saveDays(); draw(); }
    else if (b.dataset.a === 'cusAdd') { const n = $('#cN', sh.body).value.trim(), p = numP($('#cP', sh.body).value); if (!n) { toast('請輸入品名'); return; }
      if (!DB.mcfg.custom.some(c => c.n === n && (m.place ? c.place === m.place : c.pname === m.pname))) { DB.mcfg.custom.push({id: 'k' + uid(), place: m.place || '', pname: m.pname || (P ? P.name : ''), n, p}); saveMcfg(); }
      else { const c = DB.mcfg.custom.find(c => c.n === n && (m.place ? c.place === m.place : c.pname === m.pname)); c.p = p; saveMcfg(); }
      add(n, '', p); } });
  sh.foot.addEventListener('click', e => { if (e.target.closest('[data-a="done"]')) sh.close(); });
}
/* 選誰跟誰一起吃（至少 2 人） */
function pickShare(cur) {
  return new Promise(res => { let done = false; const sel = new Set(cur || []);
    const sh = sheet({title: '👥 一起吃：選要分攤的人', foot: '<div class="grow ordTot" id="psT"></div><button class="btn pri" data-a="ok" style="flex:0 0 auto">確定</button>', onClose() { if (!done) res(null); }});
    const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">選 2 個人以上，之後點的品項金額會平均分給這些人</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-id="${u.id}" class="${sel.has(u.id) ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}</button>`).join('')}</div>`;
      $('#psT', sh.foot).innerHTML = sel.size ? `${sel.size} 人：${esc(shareNames(sortIds([...sel])))}` : '還沒選人'; };
    draw(); sh.body.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; buzz(8); if (sel.has(b.dataset.id)) sel.delete(b.dataset.id); else sel.add(b.dataset.id); draw(); };
    sh.foot.onclick = e => { if (!e.target.closest('[data-a="ok"]')) return; if (sel.size < 2) { toast('一起吃要選 2 個人以上'); return; } done = true; sh.close(); res(sortIds([...sel])); }; });
}
function editMealItem(m, x) {
  const sh = sheet({title: '編輯品項', foot: '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button><button class="btn pri" data-a="ok">儲存</button>'});
  sh.body.innerHTML = `<div class="field"><label>品名</label><input id="eN" value="${esc(x.n)}" maxlength="40"></div>
    <div class="row" style="gap:.6rem"><div class="field grow"><label>尺寸／備註</label><input id="eS" value="${esc(x.s || '')}" maxlength="12" placeholder="例如 L、大碗、去冰"></div><div class="field" style="width:6rem"><label>單價</label><input id="eP" value="${esc(x.p)}" inputmode="decimal"></div><div class="field" style="width:5rem"><label>數量</label><input id="eQ" value="${x.q}" inputmode="numeric"></div></div>
    <div class="field"><label>選項</label><input id="eO" value="${esc(x.o || '')}" maxlength="40" placeholder="例如 漢堡、辣味、熱"></div>
    <div class="field"><label>誰要吃（選 2 人以上＝一起吃，金額平均分攤）</label><div class="whoRow pplGrid">${DB.mcfg.people.map(u => `<button data-who="${u.id}" class="${(isShare(x) ? x.share.includes(u.id) : u.id === x.who) ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}</button>`).join('')}</div></div>`;
  const ws = new Set(isShare(x) ? x.share : [x.who]); sh.body.onclick = e => { const b = e.target.closest('[data-who]'); if (!b) return; buzz(8); const id = b.dataset.who; if (ws.has(id)) { if (ws.size > 1) ws.delete(id); } else ws.add(id); $$('[data-who]', sh.body).forEach(k => k.classList.toggle('on', ws.has(k.dataset.who))); };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`要刪除「${x.n}」嗎？`, '刪除', true)) return; m.items.splice(m.items.indexOf(x), 1); }
    else { const n = $('#eN', sh.body).value.trim(); if (!n) { toast('請輸入品名'); return; } const ov = $('#eO', sh.body).value.trim(); if (ov) x.o = ov; else delete x.o; Object.assign(x, {n, s: $('#eS', sh.body).value.trim(), p: numP($('#eP', sh.body).value), q: Math.max(1, parseInt($('#eQ', sh.body).value) || 1)}); const ids = sortIds([...ws]); if (ids.length > 1) { x.who = SHARE; x.share = ids; } else { x.who = ids[0]; delete x.share; } }
    sh.close(); mealChanged(); };
}

/* ---------- 設定：餐別、人名、自訂品項（全部可改、可拖曳排序） ---------- */
const MK = {types: {title: '餐別', unit: '個', emoji: CAT_EMOJI, ph: '例如：早餐、下午茶、宵夜', def: '🍴', used: id => Object.values(DB.days).some(L => L.some(m => m.type === id))},
  people: {title: '人名', unit: '位', emoji: PERSON_EMOJI, ph: '例如：我、老婆、小明', def: '🙂', used: id => Object.values(DB.days).some(L => L.some(m => m.items.some(x => x.who === id || (isShare(x) && x.share.includes(id)))))}};
function openMealSettings(after) {
  const sh = sheet({title: '⚙️ 日常設定', full: true, onClose() { renderMeal(); after && after(); }});
  const draw = () => { const cus = {}; DB.mcfg.custom.forEach(c => { const k = c.place && FP().find(p => p.id === c.place) ? FP().find(p => p.id === c.place).name : c.pname || '未指定店家'; (cus[k] = cus[k] || []).push(c); });
    const days = Object.keys(DB.days).length;
    sh.body.innerHTML = ['types', 'people'].map(k => `<div class="msSec"><div class="msH"><b class="grow">${MK[k].title}</b><button class="btn sm" data-a="add" data-k="${k}">＋ 新增</button></div><div class="small muted" style="margin:-.2rem 0 .5rem">按住 ☰ 拖曳調整順序</div>
        <div class="msL" data-k="${k}">${DB.mcfg[k].map(t => `<div class="msR" data-id="${t.id}"><span class="grip"></span><span class="msI">${esc(t.icon)}</span><b class="grow">${esc(t.name)}</b><button class="btn sm" data-a="edit">✎ 編輯</button></div>`).join('') || '<div class="empty" style="padding:.8rem">還沒有' + MK[k].title + '</div>'}</div></div>`).join('')
      + (DB.acc ? `<div class="msSec"><div class="msH"><b class="grow">🔗 同一個人，不同綽號</b></div><div class="small muted" style="margin:-.2rem 0 .5rem">例如這裡叫「便當哥」、記帳叫「因因」：從分帳匯入記帳時會自動對到同一個人</div>
        ${(() => { const L = Object.keys(accSame()).filter(k => mealWho(k)); return L.length ? `<div class="sameL">${L.map(k => { const a = mealWho(k), m = aWho(k); return `<div class="sameR"><span>${esc(a.icon)} ${esc(a.name)}<small>日常</small></span><b>＝</b><span>${esc(m.icon)} ${esc(m.name)}<small>記帳</small></span><button class="ic" data-a="mUnlink" data-k="${esc(k)}" aria-label="取消">✕</button></div>`; }).join('')}</div>` : ''; })()}
        <button class="btn block" data-a="mLink">🔗 設定同一個人</button></div>` : '')
      + `<div class="msSec"><div class="msH"><b class="grow">自訂品項</b></div><div class="small muted" style="margin:-.2rem 0 .5rem">點餐時自己輸入的品項，會依店家記住</div>${Object.keys(cus).map(k => `<div class="msG">🏪 ${esc(k)}</div>${cus[k].map(c => `<div class="msR" data-cid="${c.id}"><b class="grow">${esc(c.n)}</b><span class="muted">${money(c.p)}</span><button class="btn sm" data-a="cEdit">✎</button><button class="ic" data-a="cDel" style="color:var(--danger)" aria-label="刪除">🗑</button></div>`).join('')}`).join('') || '<div class="empty" style="padding:.8rem">還沒有自訂品項</div>'}</div>
      <div class="msSec"><div class="msH"><b class="grow">點餐紀錄</b></div><div class="small muted">共有 ${days} 天的紀錄。紀錄會一起放進「設定 → 匯出備份」。</div>${days ? '<button class="btn sm danger" data-a="wipeDays" style="margin-top:.6rem">清除所有點餐紀錄</button>' : ''}</div>`;
    $$('.msL', sh.body).forEach(l => sortable(l, {item: '.msR', handle: '.grip', scroller: sh.body, onSort(from, to) { moveItem(DB.mcfg[l.dataset.k], from, to); saveMcfg(); draw(); }})); };
  draw();
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'mLink') { buzz(10); if (!await AccLock.need()) return; if (await accLinkAskMeal()) draw(); return; }
    if (a === 'mUnlink') { const k = b.dataset.k, u = mealWho(k); if (!await ask(`取消「${u ? u.name : ''}」＝「${aWho(k).name}」？\n之後從分帳匯入記帳時就會分開算。`, '取消連結', true)) return; buzz(15); accUnlink(k); draw(); return; }
    if (a === 'add') editMealCfg(b.dataset.k, null, draw);
    else if (a === 'edit') { const k = b.closest('.msL').dataset.k; editMealCfg(k, DB.mcfg[k].find(t => t.id === b.closest('.msR').dataset.id), draw); }
    else if (a === 'cEdit' || a === 'cDel') { const c = DB.mcfg.custom.find(x => x.id === b.closest('.msR').dataset.cid); if (!c) return;
      if (a === 'cDel') { if (!await ask(`要刪除自訂品項「${c.n}」嗎？\n（已經點過的紀錄不會被刪除）`, '刪除', true)) return; DB.mcfg.custom.splice(DB.mcfg.custom.indexOf(c), 1); }
      else { const n = ((await askText('品名', c.n)) || '').trim(); if (!n) return; const p = await askText('單價', String(c.p)); if (p == null) return; c.n = n; c.p = numP(p); }
      saveMcfg(); draw(); }
    else if (a === 'wipeDays') { if (!await ask('確定要清除「所有日期」的點餐紀錄嗎？這個動作無法復原。', '全部清除', true)) return; DB.days = {}; saveDays(); draw(); } });
}
function editMealCfg(k, it, done) {
  const K = MK[k], L = DB.mcfg[k], isNew = !it, d = it ? Object.assign({}, it) : {id: '', name: '', icon: K.def};
  const sh = sheet({title: (isNew ? '新增' : '編輯') + K.title, full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`});
  sh.body.innerHTML = `<div class="row" style="justify-content:center;margin:.3rem 0 1.2rem"><span class="chip on" id="eChip"></span></div>
    <div class="field"><label>名稱</label><input id="eN" value="${esc(d.name)}" placeholder="${K.ph}" maxlength="12"></div>
    <div class="field"><label>圖示</label><div class="${K.emoji === CAT_EMOJI ? 'emoGs' : 'emoGrid'}" id="eE">${K.emoji === CAT_EMOJI ? emoGroupsHtml(CAT_EMOJI_G) : K.emoji.map(x => `<button data-e="${x}">${x}</button>`).join('')}</div><div class="row" style="margin-top:.5rem"><span class="small muted" style="white-space:nowrap">或自己輸入：</span><input id="eI" value="${esc(d.icon)}" maxlength="8" style="width:5rem;text-align:center;font-size:1.2rem"></div></div>`;
  const upd = () => { $('#eChip', sh.body).textContent = d.icon + ' ' + (d.name || '名稱'); $$('#eE button', sh.body).forEach(b => b.classList.toggle('on', b.dataset.e === d.icon)); }; upd();
  $('#eN', sh.body).oninput = e => { d.name = e.target.value.trim(); upd(); }; $('#eI', sh.body).oninput = e => { d.icon = e.target.value.trim() || K.def; upd(); };
  $('#eE', sh.body).onclick = e => { const b = e.target.closest('button'); if (!b) return; d.icon = b.dataset.e; $('#eI', sh.body).value = d.icon; upd(); };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`確定要刪除${K.title}「${it.name}」嗎？${K.used(it.id) ? '\n已經有紀錄用到它，紀錄會保留，但會顯示成「已刪除」。' : ''}`, '刪除', true)) return; L.splice(L.indexOf(it), 1); saveMcfg(); sh.close(); done && done(null); return; }
    if (!d.name) { toast('請輸入名稱'); $('#eN', sh.body).focus(); return; }
    let out; if (isNew) { d.id = (k === 'types' ? 't' : 'u') + uid(); L.push(d); out = d; } else { Object.assign(it, d); out = it; } saveMcfg(); sh.close(); done && done(out); };
}

/* 月曆頁首：◀ 〔2026 年 ▾〕〔11 月 ▾〕 ▶ （點餐、分帳、日期選擇共用） */
const TRI_L = '<svg viewBox="0 0 12 14" aria-hidden="true"><path d="M9.5 1.8v10.4a.8.8 0 0 1-1.25.66L1.9 7.66a.8.8 0 0 1 0-1.32l6.35-5.2A.8.8 0 0 1 9.5 1.8z" fill="currentColor"/></svg>';
const TRI_R = '<svg viewBox="0 0 12 14" aria-hidden="true"><path d="M2.5 1.8v10.4a.8.8 0 0 0 1.25.66l6.35-5.2a.8.8 0 0 0 0-1.32L3.75 1.14A.8.8 0 0 0 2.5 1.8z" fill="currentColor"/></svg>';
const TRI_D = '<svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1.8 1.2h8.4a.7.7 0 0 1 .55 1.13L6.55 7.1a.7.7 0 0 1-1.1 0L1.25 2.33A.7.7 0 0 1 1.8 1.2z" fill="currentColor"/></svg>';
const calHead = (Y, Mo) => `<div class="calTop"><button class="calNav" data-a="pm" aria-label="上個月">${TRI_L}</button><button class="calYM" data-a="ymY" aria-label="選擇年份"><span class="v"><b>${Y}</b><em>年</em></span><i class="dd">${TRI_D}</i></button><button class="calYM" data-a="ymM" aria-label="選擇月份"><span class="v"><b>${Mo + 1}</b><em>月</em></span><i class="dd">${TRI_D}</i></button><button class="calNav" data-a="nm" aria-label="下個月">${TRI_R}</button></div>`;
/* 年／月選擇器（點餐、分帳共用）：kind = 'y' 選年、'm' 選月 */
function ymPick(Y, M, kind) {
  return new Promise(res => { const now = new Date(), isY = kind === 'y'; let base = Y - 4, done = false;
    const sh = sheet({title: isY ? '選擇年份' : `選擇月份（${Y} 年）`, onClose() { if (!done) res(null); }});
    const fin = v => { done = true; sh.close(); res(v); };
    const draw = () => { sh.body.innerHTML = isY
      ? `<div class="ymP"><div class="ymY"><button class="calNav" data-p="-12" aria-label="更早">${TRI_L}</button><b>${base} – ${base + 11}</b><button class="calNav" data-p="12" aria-label="更晚">${TRI_R}</button></div>
        <div class="ymG">${Array.from({length: 12}, (_, i) => base + i).map(y => `<button data-y="${y}" class="${y === Y ? 'on' : ''} ${y === now.getFullYear() ? 'tdy' : ''}"><b>${y}</b></button>`).join('')}</div>
        <button class="btn block ymNow" data-now="1">📅 回到今年</button></div>`
      : `<div class="ymP"><div class="ymG">${Array.from({length: 12}, (_, i) => `<button data-m="${i}" class="${i === M ? 'on' : ''} ${Y === now.getFullYear() && i === now.getMonth() ? 'tdy' : ''}"><b>${i + 1}</b><small>月</small></button>`).join('')}</div>
        <button class="btn block ymNow" data-now="1">📅 回到這個月</button></div>`; };
    draw(); sh.body.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.p) { base += +t.dataset.p; draw(); return; }
      if (t.dataset.now) fin(isY ? [now.getFullYear(), M] : [now.getFullYear(), now.getMonth()]);
      else if (t.dataset.y) fin([+t.dataset.y, M]); else if (t.dataset.m) fin([Y, +t.dataset.m]); }); });
}
/* ---------- 搜尋：吃過哪家店、哪幾天、吃了什麼、多少錢 ---------- */
const mealPhone = m => { const P = FP().find(x => x.id === m.place); return (P ? P.phone : m.phone) || ''; };
const storeName = m => { const P = FP().find(x => x.id === m.place); return P ? P.name : m.pname || ''; };
const dayLabel = k => { const d = ymdDate(k); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${MWD[d.getDay()]})`; };
/* 匯出用：括號一律半形、括號前不留空白「招牌牛肉麵 (中辣)」→「招牌牛肉麵(中辣)」 */
const tn = n => String(n || '').replace(/\s*[（(]\s*/g, '(').replace(/\s*[）)]/g, ')');
const itemTxt = x => `${tn(x.n)}${xParen(x)}×${x.q}`;
/* 模板三：每個品項的總數（不分人），方便跟店家點餐 */
function itemTotals(m, amt, fm) { const agg = []; (m.items || []).forEach(x => { const t = tn(x.n) + xParen(x), k = t + (amt ? '|' + numP(x.p) : ''); let a = agg.find(y => y.k === k); if (!a) agg.push(a = {k, t, p: numP(x.p), q: 0}); a.q += x.q || 0; });
  const out = agg.map(a => amt ? `${a.t}[${fm(a.p)}]×${a.q}` : `${a.t}×${a.q}`); out.push(`共 ${agg.reduce((s, a) => s + a.q, 0)} 份`); return out; }
/* 模板一：一人一行；一起吃的放最下面；加金額時每個人的總額＝自己的＋一起吃的分攤 */
function personLines(m, amt, fm) { fm = fm || money; const per = perOf(m), sha = shareOf(m), own = ownIds(m), out = [];
  (amt ? allIds(m) : own).forEach(id => { const xs = m.items.filter(x => !isShare(x) && x.who === id); out.push(xs.length ? `${mWho(id).name}：${xs.map(itemTxt).join('、')}${amt ? `（${fm(per[id])}${sha[id] ? '，含一起吃 ' + fm(sha[id]) : ''}）` : ''}` : `${mWho(id).name}：一起吃分攤 ${fm(per[id])}`); });
  shareSets(m).forEach(g => { const st = g.xs.reduce((a, x) => a + xAmt(x), 0); out.push(`一起吃(${shareNames(g.ids)})：${g.xs.map(itemTxt).join('、')}${amt ? `（共 ${fm(st)}，每人 ${fm(st / g.ids.length)}）` : ''}`); });
  return out; }
/* 模板二：人名一行，下面每個品項一行「品名[NT$ 單價]×數量」，人和人之間空一行 */
const ntd = v => { const n = Math.round((+v || 0) * 100) / 100; return (n < 0 ? '-NT$ ' : 'NT$ ') + Math.abs(n).toLocaleString('en-US'); };
/* 模板二：每個人列自己點的＋一起吃的（數量＝份數÷一起吃的人數，例如 ×0.5），沒有一起吃的人不列分攤的品項 */
const fq = v => String(Math.round(v * 100) / 100);
function personBlock(m, amt) { const per = perOf(m), out = [];
  allIds(m).forEach(id => { const xs = m.items.filter(x => !isShare(x) && x.who === id), ss = m.items.filter(x => isShare(x) && x.share.includes(id)); out.push(mWho(id).name + '：');
    xs.forEach(x => out.push(`${tn(x.n)}${xParen(x)}[${ntd(x.p)}]×${x.q}`)); ss.forEach(x => out.push(`${tn(x.n)}${xParen(x)}[${ntd(x.p)}]×${fq(x.q / x.share.length)}`));
    if (amt) out.push(`小計：${ntd(per[id])}`); });
  return out; }
function openMealSearch() {
  let q = '', tab = 'meal'; const sh = sheet({title: '🔍 搜尋日常紀錄', full: true});
  sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="msQ" type="search" placeholder="店名或品項，例如：鴨香飯、雞蛋"></div><div class="dkSeg" style="grid-template-columns:1fr 1fr"><button data-t="meal" class="on">🍱 餐點</button><button data-t="list">🛒 購物清單</button></div><div id="msR"></div>`;
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (!t) return; buzz(8); tab = t.dataset.t; $$('[data-t]', sh.body).forEach(b => b.classList.toggle('on', b === t)); draw(); });
  const draw = () => { const by = {};
    if (tab === 'list') { const R = []; Object.keys(DB.lists).sort().reverse().forEach(k => DB.lists[k].forEach(l => { const nm = listStore(l) || '購物清單', all = (l.items || []).concat(l.bought || []), hits = q ? all.filter(x => x.n.toLowerCase().includes(q)) : all; if (q && !nm.toLowerCase().includes(q) && !hits.length) return; R.push({k, l, nm, hits}); }));
      $('#msR', sh.body).innerHTML = R.length ? R.map(r => `<button class="srD" data-k="${r.k}"><div class="row"><b class="grow">${dayLabel(r.k)} 🛒 ${esc(r.nm)}</b><span class="srA">${(r.l.items || []).length ? '待買 ' + r.l.items.length : '已買齊'}</span></div><div class="srL">${esc((q ? r.hits : (r.l.items || []).concat(r.l.bought || [])).slice(0, 8).map(x => ((r.l.bought || []).includes(x) ? '☑ ' : '☐ ') + x.n).join('　'))}</div></button>`).join('') : `<div class="empty">${Object.keys(DB.lists).length ? '找不到符合的清單或品項' : '還沒有購物清單'}</div>`; return; }
    Object.keys(DB.days).sort().reverse().forEach(k => DB.days[k].forEach(m => { const nm = storeName(m) || '未選店家', hit = !q || nm.toLowerCase().includes(q) || m.items.some(x => x.n.toLowerCase().includes(q)); if (!hit) return;
      const key = m.place || 'n:' + nm; (by[key] = by[key] || {nm, place: m.place, rows: []}).rows.push({k, m}); }));
    const G = Object.values(by);
    $('#msR', sh.body).innerHTML = G.length ? `<div class="small muted" style="margin-bottom:.6rem">${q ? '找到' : '吃過'} ${G.length} 家店</div>` + G.map(g => { const tot = g.rows.reduce((s, r) => s + mealTotal(r.m), 0);
      return `<div class="srS"><div class="srH"><b class="grow">🏪 ${esc(g.nm)}</b><span class="muted">${new Set(g.rows.map(r => r.k)).size} 天 · ${money(tot)}</span></div>${g.rows.map(r => { const T = mType(r.m.type);
        return `<button class="srD" data-k="${r.k}"><div class="row"><b class="grow">${dayLabel(r.k)} ${esc(T.icon)} ${esc(T.name)}</b><span class="srA">${money(mealTotal(r.m))}</span></div>${r.m.items.length ? personLines(r.m, true).map(t => `<div class="srL">${esc(t)}</div>`).join('') : '<div class="srL muted">（沒有點餐內容）</div>'}</button>`; }).join('')}</div>`; }).join('')
      : `<div class="empty">${Object.keys(DB.days).length ? '找不到符合的店家或品項' : '還沒有任何點餐紀錄'}</div>`; };
  draw(); $('#msQ', sh.body).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 200);
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; const d = ymdDate(b.dataset.k); Meal.sel = b.dataset.k; Meal.ym = [d.getFullYear(), d.getMonth()]; sh.close(); renderMeal(); $('#pgMeal .pgBody').scrollTop = 0; });
}

/* ---------- 匯出：統整文字（可複製）或 Excel，選一餐或整天 ---------- */
function openExport(k, mid) {
  const ms = DB.days[k] || []; if (!ms.length) { toast('這天沒有點餐紀錄'); return; }
  let sel = mid || 'all', amt = false, tpl = [1, 2, 3].includes(S.exTpl) ? S.exTpl : 1; const sh = sheet({title: '📤 匯出點餐', full: true, foot: '<button class="btn" data-a="xlsx">📊 匯出 Excel</button><button class="btn pri" data-a="copy">📋 複製文字</button>'});
  const pick = () => sel === 'all' ? ms : ms.filter(m => m.id === sel);
  const text = () => { const fm = tpl === 1 ? money : ntd; const L = pick(), out = [dayLabel(k)];
    L.forEach((m, i) => { const T = mType(m.type), nm = storeName(m); out.push(nm ? `${T.name}：${nm}` : T.name); out.push(...(m.items.length ? (tpl === 3 ? itemTotals(m, amt, fm) : tpl === 2 ? personBlock(m, amt) : personLines(m, amt, fm)) : ['(沒有點餐內容)'])); if (amt) out.push(`${T.name}合計：${fm(mealTotal(m))}`); if (i < L.length - 1) out.push(''); });
    if (amt && L.length > 1) { const per = {}; L.forEach(m => { const pm = perOf(m); Object.keys(pm).forEach(id => { per[id] = (per[id] || 0) + pm[id]; }); }); if (tpl !== 3) out.push('', '每人總計：', ...Object.keys(per).sort((x, y) => DB.mcfg.people.findIndex(u => u.id === x) - DB.mcfg.people.findIndex(u => u.id === y)).map(id => `${mWho(id).name}：${fm(per[id])}`)); else out.push(''); out.push(`全部合計：${fm(L.reduce((s, m) => s + mealTotal(m), 0))}`); }
    return out.join('\n').replace(/（/g, '(').replace(/）/g, ')'); };
  const draw = () => { sh.body.innerHTML = `<div class="lbl">要匯出哪一餐</div><div class="whoRow" style="margin-bottom:.7rem"><button data-s="all" class="${sel === 'all' ? 'on' : ''}">📅 整天全部</button>${ms.map(m => { const T = mType(m.type); return `<button data-s="${m.id}" class="${sel === m.id ? 'on' : ''}"><span>${esc(T.icon)}</span>${esc(T.name)}${storeName(m) ? '・' + esc(storeName(m).slice(0, 8)) : ''}</button>`; }).join('')}</div>
      <div class="lbl">格式</div><div class="tplRow">${[['模板一', '一人一行'], ['模板二', '逐項含價格'], ['模板三', '品項總數']].map(([a, b], i) => `<button data-tpl="${i + 1}" class="${tpl === i + 1 ? 'on' : ''}"><b>${a}</b><small>${b}</small></button>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="exAmt" ${amt ? 'checked' : ''}> 加上金額（每人小計、合計）</label>
      <div class="lbl" style="margin-top:.7rem">統整文字（可以直接複製貼到 LINE）</div><textarea id="exT" class="exT" rows="12">${esc(text())}</textarea>`;
    $('#exAmt', sh.body).onchange = e => { amt = e.target.checked; draw(); }; };
  draw();
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-s],[data-tpl]'); if (!b) return; if (b.dataset.tpl) { tpl = +b.dataset.tpl; S.exTpl = tpl; saveS(); } else sel = b.dataset.s; draw(); });
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'copy') copyText($('#exT', sh.body).value);
    else { try { const L = pick(), d = ymdDate(k), nm = `點餐_${k.replace(/-/g, '')}${sel === 'all' ? '' : '_' + mType(L[0].type).name}.xlsx`; const p = await saveFile(nm, mealXlsx(k, L)); toast(IS_APP ? '已匯出到「下載」資料夾：' + p : '已下載 ' + nm, 4000); void d; } catch (er) { toast('❌ 匯出失敗：' + er.message, 4000); } } });
}
/* 產生 .xlsx（不用外部程式庫：手寫 OOXML + 不壓縮的 zip） */
function mealXlsx(k, L) {
  const rows = [[{v: '日日帳本 點餐紀錄　' + dayLabel(k), s: 2}], [], ['日期', '餐別', '店家', '人名', '品項', '尺寸／選項', '單價', '數量', '小計'].map(v => ({v, s: 1}))];
  const per = {};
  L.forEach(m => { const T = mType(m.type), nm = storeName(m); personLines(m, false);
    ownIds(m).forEach(id => m.items.filter(x => !isShare(x) && x.who === id).forEach(x => rows.push([k, T.name, nm, mWho(id).name, x.n, [x.s, x.o].filter(Boolean).join('、'), numP(x.p), x.q, xAmt(x)])));
    shareSets(m).forEach(g => g.xs.forEach(x => rows.push([k, T.name, nm, `${shareNames(g.ids)}（一起吃，每人 ${Math.round(xAmt(x) / g.ids.length * 100) / 100}）`, x.n, [x.s, x.o].filter(Boolean).join('、'), numP(x.p), x.q, xAmt(x)])));
    const pm = perOf(m); Object.keys(pm).forEach(id => { per[id] = (per[id] || 0) + pm[id]; });
    rows.push(['', '', '', '', {v: T.name + '合計', s: 1}, '', '', m.items.reduce((s, x) => s + x.q, 0), {v: mealTotal(m), s: 1}]); });
  rows.push([], [{v: '每人總計', s: 1}]); Object.keys(per).sort((x, y) => DB.mcfg.people.findIndex(u => u.id === x) - DB.mcfg.people.findIndex(u => u.id === y)).forEach(id => rows.push([mWho(id).name, per[id]])); rows.push([{v: '全部合計', s: 1}, {v: L.reduce((s, m) => s + mealTotal(m), 0), s: 1}]);
  rows.push([], [{v: '統整文字', s: 1}]); L.forEach(m => { rows.push([storeName(m) ? `${mType(m.type).name}：${storeName(m)}` : mType(m.type).name]); personLines(m, false).forEach(t => rows.push([t.replace(/（/g, '(').replace(/）/g, ')')])); });
  const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = i => String.fromCharCode(65 + i);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="8" customWidth="1"/><col min="3" max="3" width="22" customWidth="1"/><col min="4" max="4" width="10" customWidth="1"/><col min="5" max="5" width="22" customWidth="1"/><col min="6" max="9" width="8" customWidth="1"/></cols><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((c, j) => { const o = c && typeof c === 'object' ? c : {v: c}, ref = col(j) + (i + 1), st = o.s ? ` s="${o.s}"` : '';
      return o.v === '' || o.v == null ? '' : typeof o.v === 'number' ? `<c r="${ref}"${st}><v>${o.v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${X(o.v)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return zipStore([
    {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="點餐" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="14"/><name val="Microsoft JhengHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEBDFC8"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
    {name: 'xl/worksheets/sheet1.xml', data: sheetXml}]);
}
function crc32(u) { const t = crc32.t || (crc32.t = Array.from({length: 256}, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; })); let c = -1; for (let i = 0; i < u.length; i++) c = (c >>> 8) ^ t[(c ^ u[i]) & 255]; return (c ^ -1) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  files.forEach(f => { const nm = enc.encode(f.name), d = enc.encode(f.data), crc = crc32(d), h = new DataView(new ArrayBuffer(30)), c = new DataView(new ArrayBuffer(46));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, d.length, 4], [22, d.length, 4], [26, nm.length, 2], [28, 0, 2]].forEach(([o, v, n]) => n === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, d.length, 4], [24, d.length, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, n]) => n === 4 ? c.setUint32(o, v, true) : c.setUint16(o, v, true));
    parts.push(h.buffer, nm, d); cen.push(c.buffer, nm); off += 30 + nm.length + d.length; });
  const cs = cen.reduce((s, b) => s + b.byteLength, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, e.buffer], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
