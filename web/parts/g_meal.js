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
const money = v => '$' + (Math.round((+v || 0) * 100) / 100).toLocaleString('en-US');
const numP = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.]/g, '')); return isNaN(n) ? 0 : n; };
const saveMcfg = debounce(() => IDB.put('kv', 'mcfg', DB.mcfg).catch(saveErr), 200);
const saveDays = debounce(() => IDB.put('kv', 'days', DB.days).catch(saveErr), 200);
async function loadMeal() {
  DB.mcfg = await IDB.get('kv', 'mcfg').catch(() => null) || {types: MEAL_DEF_TYPES.map(([name, icon], i) => ({id: 't' + i + uid(), name, icon})), people: [{id: 'u' + uid(), name: '我', icon: '🙂'}], custom: []};
  DB.mcfg.custom = DB.mcfg.custom || []; DB.days = await IDB.get('kv', 'days').catch(() => null) || {};
}
const mType = id => DB.mcfg.types.find(t => t.id === id) || {id, name: '（已刪除的餐別）', icon: '🍴'};
const mWho = id => DB.mcfg.people.find(u => u.id === id) || {id, name: '（已刪除）', icon: '👤'};
const mealTotal = m => (m.items || []).reduce((s, x) => s + numP(x.p) * (x.q || 0), 0);
const dayTotal = k => (DB.days[k] || []).reduce((s, m) => s + mealTotal(m), 0);

const Meal = {sel: ymd(new Date()), ym: null};

/* ---------- 主畫面 ---------- */
function renderMeal() {
  const box = $('#mealBody'); if (!box) return; const sel = ymdDate(Meal.sel); if (!Meal.ym) Meal.ym = [sel.getFullYear(), sel.getMonth()];
  const [Y, Mo] = Meal.ym, first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(), today = ymd(new Date()), yNow = new Date().getFullYear();
  const yrs = []; for (let y = Math.min(yNow - 5, Y); y <= Math.max(yNow + 2, Y); y++) yrs.push(y);
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), ms = DB.days[k] || [], t = dayTotal(k), dow = (first.getDay() + d - 1) % 7;
    cells += `<button class="cd ${k === Meal.sel ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${ms.length ? '<em class="dot"></em>' : ''}</button>`; }
  const ms = DB.days[Meal.sel] || [];
  $('#mealSub').textContent = `${sel.getMonth() + 1}月${sel.getDate()}日（${MWD[sel.getDay()]}）${ms.length ? ' · ' + ms.length + ' 餐' : ''}`;
  /* 每個人今天的總金額 */
  const per = {}; ms.forEach(m => (m.items || []).forEach(x => { per[x.who] = (per[x.who] || 0) + numP(x.p) * (x.q || 0); }));
  const order = DB.mcfg.people.map(u => u.id).concat(Object.keys(per).filter(id => !DB.mcfg.people.some(u => u.id === id))).filter(id => per[id] != null);
  box.innerHTML = `<div class="cal card">
      <div class="calTop"><button class="ic" data-a="pm" aria-label="上個月">‹</button><select id="calY" aria-label="年">${yrs.map(y => `<option value="${y}" ${y === Y ? 'selected' : ''}>${y} 年</option>`).join('')}</select><select id="calM" aria-label="月">${Array.from({length: 12}, (_, i) => `<option value="${i}" ${i === Mo ? 'selected' : ''}>${i + 1} 月</option>`).join('')}</select><button class="ic" data-a="nm" aria-label="下個月">›</button></div>
      <div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div>
      <div class="calG">${cells}</div></div>
    <div class="dayHead"><b>${sel.getMonth() + 1}月${sel.getDate()}日 星期${MWD[sel.getDay()]}</b>${Meal.sel === today ? '<span class="tag">今天</span>' : ''}<span class="grow"></span>${ms.length ? `<span class="dayTot">${money(dayTotal(Meal.sel))}</span><button class="btn sm" data-a="export">📤 匯出</button>` : ''}</div>
    ${ms.map(mealCard).join('') || '<div class="empty mealEmpty"><span class="big">🍽️</span>這天還沒有安排要吃什麼<br><span class="small">按下面的「新增餐點」選餐別和店家</span></div>'}
    <button class="btn pri mealAdd" data-a="addMeal">＋ 新增餐點</button>
    ${order.length ? `<div class="perSum card"><div class="psH">👥 每個人這天的總金額</div>${order.map(id => { const u = mWho(id); return `<div class="psR"><span class="psI">${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><span>${money(per[id])}</span></div>`; }).join('')}<div class="psR tot"><b class="grow">合計</b><span>${money(dayTotal(Meal.sel))}</span></div></div>` : ''}`;
}
function mealCard(m) {
  const T = mType(m.type), P = DB.places.find(x => x.id === m.place), groups = [];
  DB.mcfg.people.map(u => u.id).concat((m.items || []).map(x => x.who)).forEach(id => { if (!groups.includes(id) && (m.items || []).some(x => x.who === id)) groups.push(id); });
  return `<div class="meal card" data-m="${m.id}">
    <div class="mlH"><div class="grow"><b>${esc(T.name)}</b><div class="mlS" data-a="store">${m.place || m.pname ? '🏪 ' + esc(P ? P.name : m.pname || '') : '<span class="muted">未選店家</span>'}</div></div>${m.place || m.pname ? `<button class="ic mlTel ${mealPhone(m) ? '' : 'none'}" data-a="tel" aria-label="打電話">📞</button>` : ''}<button class="btn sm pri" data-a="order">＋ 點餐</button><button class="ic" data-a="mMore" aria-label="更多">⋯</button></div>
    ${groups.length ? groups.map(id => { const u = mWho(id), xs = m.items.filter(x => x.who === id), st = xs.reduce((s, x) => s + numP(x.p) * (x.q || 0), 0);
      return `<div class="mlP"><div class="mlPH"><span>${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><span class="mlPT">${money(st)}</span></div>
        <table class="mlT"><tr><th class="n">品項</th><th>單價</th><th>數量</th><th>小計</th></tr>${xs.map(x => `<tr data-i="${x.id}"><td class="n" data-a="editItem">${esc(x.n)}${xTags(x)}</td><td class="r">${money(x.p)}</td><td class="qc"><span class="q"><button data-a="qm">−</button><b>${x.q}</b><button data-a="qp">＋</button></span></td><td class="r b">${money(numP(x.p) * x.q)}</td></tr>`).join('')}</table></div>`; }).join('')
      : `<div class="mlNone">還沒有點餐，按「＋ 點餐」選誰要吃什麼</div>`}
    ${groups.length ? `<div class="mlF"><span class="grow">${esc(T.name)}合計 · ${m.items.reduce((s, x) => s + (x.q || 0), 0)} 份</span><b>${money(mealTotal(m))}</b></div>` : ''}</div>`;
}
const curMeal = id => (DB.days[Meal.sel] || []).find(m => m.id === id);
function mealChanged() { const L = DB.days[Meal.sel]; if (L && !L.length) delete DB.days[Meal.sel]; saveDays(); renderMeal(); }

function initMeal() {
  const box = $('#mealBody');
  $('#mealToday').onclick = () => { const d = new Date(); Meal.sel = ymd(d); Meal.ym = [d.getFullYear(), d.getMonth()]; renderMeal(); };
  $('#mealSet').onclick = () => openMealSettings(); $('#mealFind').onclick = () => openMealSearch();
  box.addEventListener('change', e => { if (e.target.id === 'calY') Meal.ym[0] = +e.target.value; else if (e.target.id === 'calM') Meal.ym[1] = +e.target.value; else return;
    const nd = new Date(Meal.ym[0], Meal.ym[1] + 1, 0).getDate(), d = Math.min(ymdDate(Meal.sel).getDate(), nd); Meal.sel = ymd(new Date(Meal.ym[0], Meal.ym[1], d)); renderMeal(); });
  box.addEventListener('click', async e => { const b = e.target.closest('[data-a],[data-d]'); if (!b) return;
    if (b.dataset.d) { Meal.sel = b.dataset.d; renderMeal(); return; }
    const a = b.dataset.a, card = b.closest('.meal'), m = card && curMeal(card.dataset.m);
    if (a === 'pm' || a === 'nm') { const d = new Date(Meal.ym[0], Meal.ym[1] + (a === 'pm' ? -1 : 1), 1); Meal.ym = [d.getFullYear(), d.getMonth()]; const nd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); Meal.sel = ymd(new Date(d.getFullYear(), d.getMonth(), Math.min(ymdDate(Meal.sel).getDate(), nd))); renderMeal(); }
    else if (a === 'addMeal') { const t = await pickMealType(); if (!t) return; const st = await pickStore(); if (st === undefined) return;
      const nm = {id: 'm' + uid(), type: t.id, place: st ? st.id || '' : '', pname: st ? st.name : '', items: []}; (DB.days[Meal.sel] = DB.days[Meal.sel] || []).push(nm); mealChanged(); openOrder(nm); }
    else if (a === 'export') openExport(Meal.sel);
    else if (!m) return;
    else if (a === 'order') openOrder(m);
    else if (a === 'store') { const st = await pickStore(m.place); if (st === undefined) return; m.place = st ? st.id || '' : ''; m.pname = st ? st.name : ''; mealChanged(); }
    else if (a === 'mMore') mealMore(m);
    else if (a === 'tel') { let ph = mealPhone(m);
      if (!ph) { const v = ((await askText(`「${storeName(m)}」還沒有電話，輸入後會記住`, '', '例如 037-590111')) || '').trim(); if (!v) return; const P = DB.places.find(x => x.id === m.place); if (P) { P.phone = v; savePlace(P); } else m.phone = v; saveDays(); ph = v; renderMeal(); }
      openUrl('tel:' + ph.replace(/[^\d+]/g, '')); }
    else if (a === 'qm' || a === 'qp') { const x = m.items.find(i => i.id === b.closest('tr').dataset.i); if (!x) return; buzz(10);
      if (a === 'qp') x.q++; else if (x.q > 1) x.q--; else { if (!await ask(`要刪除「${x.n}」嗎？`, '刪除', true)) return; m.items.splice(m.items.indexOf(x), 1); } mealChanged(); }
    else if (a === 'editItem') { const x = m.items.find(i => i.id === b.closest('tr').dataset.i); if (x) editMealItem(m, x); } });
}
async function mealMore(m) {
  const T = mType(m.type), sh = sheet({title: T.icon + ' ' + T.name, html: `<div class="actList">
    <button data-a="type">🔁 改成其他餐別</button><button data-a="store">🏪 更換店家</button>${DB.places.some(p => p.id === m.place) ? '<button data-a="open">📋 打開店家與菜單</button>' : ''}
    <button data-a="exp">📤 匯出這一餐（文字／Excel）</button><button data-a="copy">📅 複製到其他日期</button><button data-a="del" class="dng">🗑 刪除這一餐</button></div>`});
  sh.body.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a; sh.close();
    if (a === 'type') { const t = await pickMealType(m.type); if (t) { m.type = t.id; mealChanged(); } }
    else if (a === 'store') { const st = await pickStore(m.place); if (st !== undefined) { m.place = st ? st.id || '' : ''; m.pname = st ? st.name : ''; mealChanged(); } }
    else if (a === 'open') openPlace(m.place, true);
    else if (a === 'exp') openExport(Meal.sel, m.id);
    else if (a === 'copy') { const v = await askText('複製到哪一天？（年-月-日）', ymd(new Date(ymdDate(Meal.sel).getTime() + 864e5)), '例如 2026-11-20'); if (!v) return; const k = v.trim().replace(/[/.]/g, '-'); const d = new Date(k + 'T00:00');
      if (isNaN(d)) { toast('日期格式不正確'); return; } const c = JSON.parse(JSON.stringify(m)); c.id = 'm' + uid(); c.items.forEach(x => { x.id = 'i' + uid(); }); (DB.days[ymd(d)] = DB.days[ymd(d)] || []).push(c); saveDays(); renderMeal(); toast(`已複製到 ${ymd(d)}`); }
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
  return new Promise(res => { let done = false, q = ''; const sh = sheet({title: '選擇店家', full: true, onClose() { if (!done) res(undefined); }});
    const fin = v => { done = true; sh.close(); res(v); };
    const draw = () => { const hit = p => !q || (p.name + ' ' + (p.addr || '')).toLowerCase().includes(q);
      const secs = DB.cats.concat([UNCAT]).map(c => ({c, ps: placesIn(c.id).filter(hit)})).filter(s => s.ps.length);
      $('#psL', sh.body).innerHTML = secs.map(({c, ps}) => `<div class="psSec" style="--c:${c.color}"><div class="psSH"><span>${esc(c.icon)}</span>${esc(c.name)}</div>${ps.map(p => `<button class="psP ${p.id === cur ? 'on' : ''}" data-id="${p.id}"><b>${esc(p.name)}</b><small>${(p.menu || []).length ? '📋 ' + p.menu.length + ' 個品項' : '<span class="muted">沒有菜單表格</span>'}${p.addr ? ' · ' + esc(p.addr) : ''}</small></button>`).join('')}</div>`).join('')
        || `<div class="empty">${DB.places.length ? '找不到符合的收藏店家' : '還沒有收藏店家<br><span class="small">可以先在地圖頁收藏，或用下面的「自己輸入店名」</span>'}</div>`; };
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.7rem"><input id="psQ" type="search" placeholder="搜尋收藏的店家…"></div><div class="row" style="margin-bottom:.7rem;gap:.5rem"><button class="btn sm" data-a="free">✏️ 自己輸入店名</button><button class="btn sm" data-a="none">先不選店家</button></div><div id="psL"></div>`;
    draw(); $('#psQ', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    sh.body.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.id) fin(DB.places.find(p => p.id === b.dataset.id));
      else if (b.dataset.a === 'none') fin(null);
      else if (b.dataset.a === 'free') { const v = ((await askText('店名', '', '例如：巷口早餐店')) || '').trim(); if (v) fin({id: '', name: v.slice(0, 30)}); } }); });
}

/* ---------- 點餐：選人 → 從菜單點品項 ---------- */
function menuChoices(p, rg) {
  const all = p.menu || [], regs = [...new Set(all.map(r => r.g).filter(Boolean))]; const cur = regs.includes(rg) ? rg : regs.includes(p.rgSel) ? p.rgSel : regs[0] || '';
  const inR = r => !cur || r.g === cur || (!r.g && !all.some(y => y.g === cur && (y.t || 'item') === (r.t || 'item') && baseName(y.n) === baseName(r.n)));
  const R = all.filter(inR), ogs = optGroups(R.filter(r => r.t === 'opt'));
  const out = [], idx = {}, owned = new Set();
  R.forEach(r => { const t = r.t || 'item'; if (t === 'opt') return;
    const z0 = szOf(r.n), b0 = z0 ? baseName(r.n) : r.n.replace(/\s*[（(][+＋]?[$＄]?[+＋]?\d+元?[)）]\s*$/, ''), T = splitTemp(b0, z0), z = T.z, b = T.n, k = t + '|' + r.c + '|' + b;
    if (idx[k] == null) { idx[k] = out.length; out.push({t, rc: r.c, c: t === 'add' ? '➕ ' + (r.c || '加購') : r.c || '其他', n: b, full: t === 'item' ? fullName(r.c, b) : b, v: [], og: [], temps: new Set()}); }
    const o = out[idx[k]]; if (T.t) o.temps.add(T.t); if (!o.v.some(x => x.s === z && x.p === r.p) && !(T.t && !z && o.v.some(x => x.p === r.p))) o.v.push({s: z, p: r.p}); });
  /* 每個品項只拿「系列共用」和「專屬自己」的選項群組 */
  const cn = {}; out.forEach(o => { if (o.t === 'item') (cn[o.rc] = cn[o.rc] || []).push(o.n); });
  out.forEach(o => { if (o.t !== 'item') return; o.og = groupsFor(o.rc, o.n, cn[o.rc], ogs); o.og.forEach(g => owned.add(g.c)); });
  /* 沒有歸屬到系列、但有價格的選項，當成一般品項 */
  ogs.filter(g => !owned.has(g.c)).forEach(g => g.L.forEach(r => { if (r.p) out.push({t: 'opt', rc: g.c, c: '🧩 ' + (g.owner ? g.owner + '・' + g.label : g.label), n: r.n, full: r.n, v: [{s: '', p: r.p}], og: [], temps: new Set()}); }));
  const csz = {}; out.forEach(o => o.v.forEach(v => { if (v.s) (csz[o.rc] = csz[o.rc] || new Set()).add(v.s); }));
  out.forEach(o => { if (!o.temps.size || !o.v.some(v => v.s)) return; o.v.forEach(v => { if (v.s) return; const miss = [...(csz[o.rc] || [])].filter(z => !o.v.some(y => y.s === z)); if (miss.length === 1) v.s = miss[0]; }); });
  const ct = {}; out.forEach(o => o.temps.forEach(t => (ct[o.rc] = ct[o.rc] || new Set()).add(t)));
  const fin = []; out.forEach(o => { const tp = ct[o.rc]; if (tp && tp.size > 1 && o.t === 'item' && !o.og.some(g => /溫度/.test(g.label))) o.og = o.og.concat([{label: '溫度', tag: '選一', L: [...tp].map(n => ({n, p: ''}))}]);
    const multi = o.v.length > 1, keep = o.v.filter(v => !v.s || isSizeWord(v.s, multi));
    if (keep.length) fin.push(Object.assign({}, o, {v: keep.sort((a, b) => szRank(a.s) - szRank(b.s))}));
    o.v.filter(v => v.s && !isSizeWord(v.s, multi)).forEach(v => { const n = o.n + ' (' + v.s + ')'; fin.push(Object.assign({}, o, {n, full: o.t === 'item' ? fullName(o.rc, n) : n, v: [{s: '', p: v.p}]})); }); });
  return {list: fin, regs: rgSorted(regs), cur};
}
/* 點的品項有系列選項（麵包、醬料、冰／熱）時，先選選項，加價會算進單價 */
function pickOpts(o, v) {
  return new Promise(res => { let done = false; const ch = o.og.map(g => g.multi ? [] : [-1]);
    const sh = sheet({title: o.full + (v.s ? ` (${v.s})` : ''), foot: '<div class="grow ordTot" id="poT"></div><button class="btn pri" data-a="ok" style="flex:0 0 auto">加入</button>', onClose() { if (!done) res(null); }});
    const calc = () => { let add = 0; const names = []; o.og.forEach((g, gi) => ch[gi].filter(i => i >= 0).forEach(i => { add += numP(g.L[i].p); names.push(g.L[i].n); })); return {add, names}; };
    const draw = () => { sh.body.innerHTML = o.og.map((g, gi) => `<div class="poG"><div class="lbl">${esc(g.label)}${g.tag ? ` <span class="tag">${esc(g.tag)}</span>` : ''}</div><div class="whoRow">${g.multi ? '' : `<button data-g="${gi}" data-i="-1" class="${ch[gi][0] === -1 ? 'on' : ''}">不選</button>`}${g.L.map((r, i) => `<button data-g="${gi}" data-i="${i}" class="${ch[gi].includes(i) ? 'on' : ''}">${esc(r.n)}${numP(r.p) ? ` <small>+$${numP(r.p)}</small>` : ''}</button>`).join('')}</div></div>`).join('');
      const c = calc(); $('#poT', sh.foot).innerHTML = `單價 <b>${money(numP(v.p) + c.add)}</b>${c.names.length ? ' · ' + esc(c.names.join('、')) : ''}`; };
    draw();
    sh.body.onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; const gi = +b.dataset.g, i = +b.dataset.i, g = o.og[gi]; buzz(8);
      if (g.multi) { const k = ch[gi].indexOf(i); if (k < 0) ch[gi].push(i); else ch[gi].splice(k, 1); } else ch[gi] = [i]; draw(); };
    sh.foot.onclick = e => { if (!e.target.closest('[data-a="ok"]')) return; const c = calc(); done = true; sh.close(); res({o: c.names.join('、'), add: c.add}); }; });
}
const xTags = x => `${x.s ? ` <span class="szT">${esc(x.s)}</span>` : ''}${x.o ? ` <span class="opT">${esc(x.o)}</span>` : ''}`;
const xParen = x => { const a = [x.s, x.o].filter(Boolean); return a.length ? '(' + a.join('、') + ')' : ''; };
function openOrder(m) {
  const P = DB.places.find(x => x.id === m.place), T = mType(m.type);
  let who = m.lastWho && DB.mcfg.people.some(u => u.id === m.lastWho) ? m.lastWho : (DB.mcfg.people[0] || {}).id, q = '', cat = '', rg = P ? P.rgSel : '';
  const sh = sheet({title: `${T.icon} ${T.name}${P || m.pname ? ' · ' + (P ? P.name : m.pname) : ''}`, full: true, foot: '<div class="grow ordTot" id="oTot"></div><button class="btn pri" data-a="done" style="flex:0 0 auto">完成</button>', onClose() { renderMeal(); }});
  let LIST = [];
  const cnt = (n, s) => m.items.filter(x => x.who === who && x.n === n && (x.s || '') === (s || '')).reduce((a, x) => a + x.q, 0);
  const add = (n, s, p, o) => { if (!who) { toast('請先新增要點餐的人'); return; } const pv = numP(p), x = m.items.find(i => i.who === who && i.n === n && (i.s || '') === (s || '') && (i.o || '') === (o || '') && numP(i.p) === pv);
    if (x) x.q++; else m.items.push(Object.assign({id: 'i' + uid(), who, n, s: s || '', p: pv, q: 1}, o ? {o} : {})); m.lastWho = who; buzz(12); saveDays(); draw(); };
  const draw = () => { const C = P ? menuChoices(P, rg) : {list: [], regs: [], cur: ''}; rg = C.cur;
    const cus = DB.mcfg.custom.filter(c => (m.place ? c.place === m.place : c.pname === m.pname)).map(c => ({t: 'cus', c: '⭐ 自訂品項', n: c.n, full: c.n, og: [], v: [{s: '', p: c.p}], cid: c.id}));
    const all = cus.concat(C.list), cats = [...new Set(all.map(o => o.c))], hit = o => (!q || o.n.toLowerCase().includes(q)) && (!cat || o.c === cat);
    const L = all.filter(hit); LIST = L; const mine = m.items.filter(x => x.who === who), tot = mealTotal(m);
    sh.body.innerHTML = `<div class="ordWho"><span class="lbl">誰要吃</span><div class="whoRow">${DB.mcfg.people.map(u => { const n = m.items.filter(x => x.who === u.id).reduce((a, x) => a + x.q, 0); return `<button data-who="${u.id}" class="${u.id === who ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}${n ? `<i>${n}</i>` : ''}</button>`; }).join('')}<button data-a="newWho" class="add">＋ 新增人名</button></div></div>
      ${mine.length ? `<div class="ordMine"><div class="omH">${esc(mWho(who).icon)} ${esc(mWho(who).name)} 已點 <b>${money(mine.reduce((s, x) => s + numP(x.p) * x.q, 0))}</b></div>${mine.map(x => `<div class="omR" data-i="${x.id}"><span class="grow">${esc(x.n)}${xTags(x)}</span><span class="muted">${money(x.p)}</span><span class="q"><button data-a="om">−</button><b>${x.q}</b><button data-a="op">＋</button></span></div>`).join('')}</div>` : ''}
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
    else if (b.dataset.a === 'om' || b.dataset.a === 'op') { const x = m.items.find(i => i.id === b.closest('.omR').dataset.i); if (!x) return; buzz(10); if (b.dataset.a === 'op') x.q++; else if (--x.q <= 0) m.items.splice(m.items.indexOf(x), 1); saveDays(); draw(); }
    else if (b.dataset.a === 'cusAdd') { const n = $('#cN', sh.body).value.trim(), p = numP($('#cP', sh.body).value); if (!n) { toast('請輸入品名'); return; }
      if (!DB.mcfg.custom.some(c => c.n === n && (m.place ? c.place === m.place : c.pname === m.pname))) { DB.mcfg.custom.push({id: 'k' + uid(), place: m.place || '', pname: m.pname || (P ? P.name : ''), n, p}); saveMcfg(); }
      else { const c = DB.mcfg.custom.find(c => c.n === n && (m.place ? c.place === m.place : c.pname === m.pname)); c.p = p; saveMcfg(); }
      add(n, '', p); } });
  sh.foot.addEventListener('click', e => { if (e.target.closest('[data-a="done"]')) sh.close(); });
}
function editMealItem(m, x) {
  const sh = sheet({title: '編輯品項', foot: '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button><button class="btn pri" data-a="ok">儲存</button>'});
  sh.body.innerHTML = `<div class="field"><label>品名</label><input id="eN" value="${esc(x.n)}" maxlength="40"></div>
    <div class="row" style="gap:.6rem"><div class="field grow"><label>尺寸／備註</label><input id="eS" value="${esc(x.s || '')}" maxlength="12" placeholder="例如 L、大碗、去冰"></div><div class="field" style="width:6rem"><label>單價</label><input id="eP" value="${esc(x.p)}" inputmode="decimal"></div><div class="field" style="width:5rem"><label>數量</label><input id="eQ" value="${x.q}" inputmode="numeric"></div></div>
    <div class="field"><label>選項</label><input id="eO" value="${esc(x.o || '')}" maxlength="40" placeholder="例如 漢堡、辣味、熱"></div>
    <div class="field"><label>誰要吃</label><div class="whoRow">${DB.mcfg.people.map(u => `<button data-who="${u.id}" class="${u.id === x.who ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}</button>`).join('')}</div></div>`;
  let who = x.who; sh.body.onclick = e => { const b = e.target.closest('[data-who]'); if (!b) return; who = b.dataset.who; $$('[data-who]', sh.body).forEach(k => k.classList.toggle('on', k === b)); };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`要刪除「${x.n}」嗎？`, '刪除', true)) return; m.items.splice(m.items.indexOf(x), 1); }
    else { const n = $('#eN', sh.body).value.trim(); if (!n) { toast('請輸入品名'); return; } const ov = $('#eO', sh.body).value.trim(); if (ov) x.o = ov; else delete x.o; Object.assign(x, {n, s: $('#eS', sh.body).value.trim(), p: numP($('#eP', sh.body).value), q: Math.max(1, parseInt($('#eQ', sh.body).value) || 1), who}); }
    sh.close(); mealChanged(); };
}

/* ---------- 設定：餐別、人名、自訂品項（全部可改、可拖曳排序） ---------- */
const MK = {types: {title: '餐別', unit: '個', emoji: CAT_EMOJI, ph: '例如：早餐、下午茶、宵夜', def: '🍴', used: id => Object.values(DB.days).some(L => L.some(m => m.type === id))},
  people: {title: '人名', unit: '位', emoji: PERSON_EMOJI, ph: '例如：我、老婆、小明', def: '🙂', used: id => Object.values(DB.days).some(L => L.some(m => m.items.some(x => x.who === id)))}};
function openMealSettings(after) {
  const sh = sheet({title: '⚙️ 點餐設定', full: true, onClose() { renderMeal(); after && after(); }});
  const draw = () => { const cus = {}; DB.mcfg.custom.forEach(c => { const k = c.place && DB.places.find(p => p.id === c.place) ? DB.places.find(p => p.id === c.place).name : c.pname || '未指定店家'; (cus[k] = cus[k] || []).push(c); });
    const days = Object.keys(DB.days).length;
    sh.body.innerHTML = ['types', 'people'].map(k => `<div class="msSec"><div class="msH"><b class="grow">${MK[k].title}</b><button class="btn sm" data-a="add" data-k="${k}">＋ 新增</button></div><div class="small muted" style="margin:-.2rem 0 .5rem">按住 ☰ 拖曳調整順序</div>
        <div class="msL" data-k="${k}">${DB.mcfg[k].map(t => `<div class="msR" data-id="${t.id}"><span class="grip"></span><span class="msI">${esc(t.icon)}</span><b class="grow">${esc(t.name)}</b><button class="btn sm" data-a="edit">✎ 編輯</button></div>`).join('') || '<div class="empty" style="padding:.8rem">還沒有' + MK[k].title + '</div>'}</div></div>`).join('')
      + `<div class="msSec"><div class="msH"><b class="grow">自訂品項</b></div><div class="small muted" style="margin:-.2rem 0 .5rem">點餐時自己輸入的品項，會依店家記住</div>${Object.keys(cus).map(k => `<div class="msG">🏪 ${esc(k)}</div>${cus[k].map(c => `<div class="msR" data-cid="${c.id}"><b class="grow">${esc(c.n)}</b><span class="muted">${money(c.p)}</span><button class="btn sm" data-a="cEdit">✎</button><button class="ic" data-a="cDel" style="color:var(--danger)" aria-label="刪除">🗑</button></div>`).join('')}`).join('') || '<div class="empty" style="padding:.8rem">還沒有自訂品項</div>'}</div>
      <div class="msSec"><div class="msH"><b class="grow">點餐紀錄</b></div><div class="small muted">共有 ${days} 天的紀錄。紀錄會一起放進「設定 → 匯出備份」。</div>${days ? '<button class="btn sm danger" data-a="wipeDays" style="margin-top:.6rem">清除所有點餐紀錄</button>' : ''}</div>`;
    $$('.msL', sh.body).forEach(l => sortable(l, {item: '.msR', handle: '.grip', scroller: sh.body, onSort(from, to) { moveItem(DB.mcfg[l.dataset.k], from, to); saveMcfg(); draw(); }})); };
  draw();
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
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
    <div class="field"><label>圖示</label><div class="emoGrid" id="eE">${K.emoji.map(x => `<button data-e="${x}">${x}</button>`).join('')}</div><div class="row" style="margin-top:.5rem"><span class="small muted" style="white-space:nowrap">或自己輸入：</span><input id="eI" value="${esc(d.icon)}" maxlength="8" style="width:5rem;text-align:center;font-size:1.2rem"></div></div>`;
  const upd = () => { $('#eChip', sh.body).textContent = d.icon + ' ' + (d.name || '名稱'); $$('#eE button', sh.body).forEach(b => b.classList.toggle('on', b.dataset.e === d.icon)); }; upd();
  $('#eN', sh.body).oninput = e => { d.name = e.target.value.trim(); upd(); }; $('#eI', sh.body).oninput = e => { d.icon = e.target.value.trim() || K.def; upd(); };
  $('#eE', sh.body).onclick = e => { const b = e.target.closest('button'); if (!b) return; d.icon = b.dataset.e; $('#eI', sh.body).value = d.icon; upd(); };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`確定要刪除${K.title}「${it.name}」嗎？${K.used(it.id) ? '\n已經有紀錄用到它，紀錄會保留，但會顯示成「已刪除」。' : ''}`, '刪除', true)) return; L.splice(L.indexOf(it), 1); saveMcfg(); sh.close(); done && done(null); return; }
    if (!d.name) { toast('請輸入名稱'); $('#eN', sh.body).focus(); return; }
    let out; if (isNew) { d.id = (k === 'types' ? 't' : 'u') + uid(); L.push(d); out = d; } else { Object.assign(it, d); out = it; } saveMcfg(); sh.close(); done && done(out); };
}

/* ---------- 搜尋：吃過哪家店、哪幾天、吃了什麼、多少錢 ---------- */
const mealPhone = m => { const P = DB.places.find(x => x.id === m.place); return (P ? P.phone : m.phone) || ''; };
const storeName = m => { const P = DB.places.find(x => x.id === m.place); return P ? P.name : m.pname || ''; };
const dayLabel = k => { const d = ymdDate(k); return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${MWD[d.getDay()]}）`; };
const itemTxt = x => `${x.n}${xParen(x)}×${x.q}`;
function personLines(m, amt) { const ids = []; DB.mcfg.people.map(u => u.id).concat((m.items || []).map(x => x.who)).forEach(id => { if (!ids.includes(id) && m.items.some(x => x.who === id)) ids.push(id); });
  return ids.map(id => { const xs = m.items.filter(x => x.who === id); return `${mWho(id).name}：${xs.map(itemTxt).join('、')}${amt ? `（${money(xs.reduce((s, x) => s + numP(x.p) * x.q, 0))}）` : ''}`; }); }
/* 模板二：人名一行，下面每個品項一行「品名[NT$ 單價]×數量」，人和人之間空一行 */
const ntd = v => 'NT$ ' + (Math.round((+v || 0) * 100) / 100).toLocaleString('en-US');
function personBlock(m, amt) { const ids = [], out = []; DB.mcfg.people.map(u => u.id).concat((m.items || []).map(x => x.who)).forEach(id => { if (!ids.includes(id) && m.items.some(x => x.who === id)) ids.push(id); });
  ids.forEach((id, i) => { const xs = m.items.filter(x => x.who === id); out.push(mWho(id).name + '：'); xs.forEach(x => out.push(`${x.n}${xParen(x)}[${ntd(x.p)}]×${x.q}`)); if (amt) out.push(`小計：${ntd(xs.reduce((s, x) => s + numP(x.p) * x.q, 0))}`); });
  return out; }
function openMealSearch() {
  let q = ''; const sh = sheet({title: '🔍 搜尋吃過的店家', full: true});
  sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.8rem"><input id="msQ" type="search" placeholder="輸入店名或品項，例如：鴨香飯"></div><div id="msR"></div>`;
  const draw = () => { const by = {};
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
  let sel = mid || 'all', amt = false, tpl = S.exTpl === 2 ? 2 : 1; const sh = sheet({title: '📤 匯出點餐', full: true, foot: '<button class="btn" data-a="xlsx">📊 匯出 Excel</button><button class="btn pri" data-a="copy">📋 複製文字</button>'});
  const pick = () => sel === 'all' ? ms : ms.filter(m => m.id === sel);
  const text = () => { const fm = tpl === 2 ? ntd : money; const L = pick(), out = [dayLabel(k)];
    L.forEach((m, i) => { const T = mType(m.type), nm = storeName(m); out.push((i || L.length > 1 ? '' : '') + `【${T.name}】${nm}`); out.push(...(m.items.length ? (tpl === 2 ? personBlock(m, amt) : personLines(m, amt)) : ['（沒有點餐內容）'])); if (amt) out.push(`${T.name}合計：${fm(mealTotal(m))}`); if (i < L.length - 1) out.push(''); });
    if (amt && L.length > 1) { const per = {}; L.forEach(m => m.items.forEach(x => { per[x.who] = (per[x.who] || 0) + numP(x.p) * x.q; })); out.push('', '【每人總計】', ...Object.keys(per).sort((x, y) => DB.mcfg.people.findIndex(u => u.id === x) - DB.mcfg.people.findIndex(u => u.id === y)).map(id => `${mWho(id).name}：${fm(per[id])}`), `全部合計：${fm(L.reduce((s, m) => s + mealTotal(m), 0))}`); }
    return out.join('\n'); };
  const draw = () => { sh.body.innerHTML = `<div class="lbl">要匯出哪一餐</div><div class="whoRow" style="margin-bottom:.7rem"><button data-s="all" class="${sel === 'all' ? 'on' : ''}">📅 整天全部</button>${ms.map(m => { const T = mType(m.type); return `<button data-s="${m.id}" class="${sel === m.id ? 'on' : ''}"><span>${esc(T.icon)}</span>${esc(T.name)}${storeName(m) ? '・' + esc(storeName(m).slice(0, 8)) : ''}</button>`; }).join('')}</div>
      <div class="lbl">格式</div><div class="whoRow" style="margin-bottom:.6rem"><button data-tpl="1" class="${tpl === 1 ? 'on' : ''}">模板一：一人一行</button><button data-tpl="2" class="${tpl === 2 ? 'on' : ''}">模板二：逐項含價格</button></div>
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
  const rows = [[{v: '食光地圖 點餐紀錄　' + dayLabel(k), s: 2}], [], ['日期', '餐別', '店家', '人名', '品項', '尺寸／選項', '單價', '數量', '小計'].map(v => ({v, s: 1}))];
  const per = {};
  L.forEach(m => { const T = mType(m.type), nm = storeName(m); personLines(m, false);
    const ids = []; DB.mcfg.people.map(u => u.id).concat(m.items.map(x => x.who)).forEach(id => { if (!ids.includes(id) && m.items.some(x => x.who === id)) ids.push(id); });
    ids.forEach(id => m.items.filter(x => x.who === id).forEach(x => { const st = numP(x.p) * x.q; per[id] = (per[id] || 0) + st; rows.push([k, T.name, nm, mWho(id).name, x.n, [x.s, x.o].filter(Boolean).join('、'), numP(x.p), x.q, st]); }));
    rows.push(['', '', '', '', {v: T.name + '合計', s: 1}, '', '', m.items.reduce((s, x) => s + x.q, 0), {v: mealTotal(m), s: 1}]); });
  rows.push([], [{v: '每人總計', s: 1}]); Object.keys(per).sort((x, y) => DB.mcfg.people.findIndex(u => u.id === x) - DB.mcfg.people.findIndex(u => u.id === y)).forEach(id => rows.push([mWho(id).name, per[id]])); rows.push([{v: '全部合計', s: 1}, {v: L.reduce((s, m) => s + mealTotal(m), 0), s: 1}]);
  rows.push([], [{v: '統整文字', s: 1}]); L.forEach(m => { rows.push([`【${mType(m.type).name}】${storeName(m)}`]); personLines(m, false).forEach(t => rows.push([t])); });
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
