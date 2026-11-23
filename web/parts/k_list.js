/* ============================================================
   日常 → 購物清單：選店家、日期，列出要買的東西；勾選＝買到了（移到「已買」，可以復原）
   DB.lists = {'2026-11-21': [list]}
   list = {id, place, pname, items:[{id, n, note}], bought:[{id, n, note, at}], t}
   ============================================================ */
const saveLists = debounce(() => IDB.put('kv', 'lists', DB.lists).catch(saveErr), 200);
const dayLists = k => (DB.lists || {})[k] || [];
const listStore = l => { const P = (DB.places || []).find(x => x.id === l.place); return P ? P.name : storeAlias(l.pname || ''); };
const listKey = l => Object.keys(DB.lists).find(k => DB.lists[k].includes(l)) || '';
function listsChanged() { Object.keys(DB.lists).forEach(k => { if (!DB.lists[k].length) delete DB.lists[k]; }); saveLists(); }
/* 以前買過的東西（給建議用）：同一家店的優先 */
function listHistory(place) {
  const cnt = {}, own = {}; Object.values(DB.lists || {}).forEach(L => L.forEach(l => (l.items || []).concat(l.bought || []).forEach(x => { cnt[x.n] = (cnt[x.n] || 0) + 1; if (place && l.place === place) own[x.n] = (own[x.n] || 0) + 1; })));
  return Object.keys(cnt).sort((a, b) => (own[b] || 0) - (own[a] || 0) || cnt[b] - cnt[a]);
}
function listCard(l) {
  const its = l.items || [], bt = l.bought || [], hist = listHistory(l.place).filter(n => !its.some(x => x.n === n));
  return `<div class="slist card" data-l="${l.id}">
    <div class="slH"><span class="slIc">🛒</span><div class="grow" data-a="lStore"><b>${esc(listStore(l) || '購物清單')}</b><small>${its.length ? `還要買 ${its.length} 項` : bt.length ? '✅ 全部買齊了' : '還沒有品項'}${bt.length ? `・已買 ${bt.length}` : ''}</small></div><button class="ic" data-a="lMore" aria-label="更多">⋯</button></div>
    <div class="slItems">${its.map(x => `<div class="slR swp" data-i="${x.id}"><button class="slDel" data-a="lDel">🗑 刪除</button><div class="slRi"><button class="slCk" data-a="lCheck" aria-label="買到了"></button><span class="slN" data-a="lEdit">${esc(x.n)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span><span class="grip" aria-label="拖曳排序"></span></div></div>`).join('') || '<div class="slEmpty">在下面輸入要買的東西</div>'}</div>
    <div class="slAdd"><input class="slIn" placeholder="＋ 新增品項（可以一次貼好幾行）" enterkeyhint="done"><button class="btn pri" data-a="lAdd">加入</button></div>
    ${hist.length ? `<button class="slSugBtn" data-a="lSugs"><span>⭐ 常買</span><small>${hist.length} 項・點一下選要加的東西</small><i>›</i></button>` : ''}
    ${its.length ? '<div class="slHint">← 品項往左滑可以刪除</div>' : ''}
    ${bt.length ? `<details class="slDone"><summary>✅ 已買 ${bt.length} 項</summary>${bt.map(x => `<div class="slR done swp" data-b="${x.id}"><button class="slDel" data-a="lDel">🗑 刪除</button><div class="slRi"><span class="slCk on"></span><span class="slN">${esc(x.n)}</span><button class="btn sm" data-a="lUndo">放回清單</button></div></div>`).join('')}</details>` : ''}
  </div>`;
}
function curList(id) { for (const k of Object.keys(DB.lists || {})) { const l = DB.lists[k].find(x => x.id === id); if (l) return l; } return null; }
function redrawList(l) { const el = $(`.slist[data-l="${l.id}"]`); if (!el) { renderMeal(); return; } const open = el.querySelector('.slDone') && el.querySelector('.slDone').open; el.outerHTML = listCard(l); const n = $(`.slist[data-l="${l.id}"]`); if (open && n.querySelector('.slDone')) n.querySelector('.slDone').open = true; bindListSort(n); updMealSub(); }
function bindListSort(el) { const root = el.querySelector('.slItems'); if (!root || root.dataset.sb) return; root.dataset.sb = 1; const l = curList(el.dataset.l);
  sortable(root, {item: '.slR', handle: '.grip', scroller: $('#pgMeal .pgBody'), onSort(from, to) { moveItem(l.items, from, to); listsChanged(); redrawList(l); }}); }
function addListItems(l, txt) {
  const L = String(txt || '').split(/[\n,，、]+/).map(s => s.trim()).filter(Boolean); if (!L.length) return 0;
  L.forEach(s => { const m = s.match(/^(.+?)\s*[x×*]\s*(\d+)$/i); l.items.push({id: 'i' + uid(), n: (m ? m[1] : s).slice(0, 40), note: m ? '×' + m[2] : ''}); });
  listsChanged(); return L.length;
}
async function newList() {
  const st = await pickShopStore(); if (st === undefined) return;
  const l = {id: 'l' + uid(), place: st && st.id || '', pname: st ? st.name : '', items: [], bought: [], t: Date.now()};
  (DB.lists[Meal.sel] = DB.lists[Meal.sel] || []).push(l); listsChanged(); renderMeal(); buzz(20);
  setTimeout(() => { const el = $(`.slist[data-l="${l.id}"]`); if (el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); const i = el.querySelector('.slIn'); if (i) i.focus(); } }, 120);
}
function listText(l) { const k = listKey(l); return [`🛒 ${listStore(l) || '購物清單'}${k ? '（' + dayLabel(k) + '）' : ''}`].concat((l.items || []).map(x => '☐ ' + x.n + (x.note ? ' ' + x.note : ''))).concat((l.bought || []).length ? ['', '已買：'].concat(l.bought.map(x => '☑ ' + x.n)) : []).join('\n'); }
function listMore(l) {
  const sh = sheet({title: '🛒 ' + (listStore(l) || '購物清單'), html: `<div class="actList"><button data-a="store">🏪 更換店家</button><button data-a="date">📅 改到其他日期</button><button data-a="copy">📋 複製清單文字（貼到 LINE）</button>${(l.bought || []).length ? '<button data-a="clr">🧹 清除已買的項目</button>' : ''}<button data-a="dup">📄 複製成新的清單（今天）</button><button data-a="del" class="dng">🗑 刪除這個清單</button></div>`});
  sh.body.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return; buzz(10); const a = t.dataset.a; sh.close();
    if (a === 'store') { const st = await pickShopStore(l.place); if (st === undefined) return; l.place = st && st.id || ''; l.pname = st ? st.name : ''; listsChanged(); redrawList(l); }
    else if (a === 'date') { const from = listKey(l), k = await datePick(from || Meal.sel); if (!k || k === from) return; DB.lists[from].splice(DB.lists[from].indexOf(l), 1); (DB.lists[k] = DB.lists[k] || []).push(l); listsChanged(); const d = ymdDate(k); Meal.sel = k; Meal.ym = [d.getFullYear(), d.getMonth()]; renderMeal(); toast('已移到 ' + dayLabel(k)); }
    else if (a === 'copy') copyText(listText(l));
    else if (a === 'clr') { l.bought = []; listsChanged(); redrawList(l); }
    else if (a === 'dup') { const k = ymd(new Date()), n = {id: 'l' + uid(), place: l.place, pname: l.pname, items: (l.items || []).concat(l.bought || []).map(x => ({id: 'i' + uid(), n: x.n, note: x.note || ''})), bought: [], t: Date.now()}; (DB.lists[k] = DB.lists[k] || []).push(n); listsChanged(); const d = new Date(); Meal.sel = k; Meal.ym = [d.getFullYear(), d.getMonth()]; renderMeal(); toast('已建立今天的清單'); }
    else if (a === 'del') { if (!await ask('確定要刪除這個購物清單嗎？', '刪除', true)) return; const k = listKey(l); DB.lists[k].splice(DB.lists[k].indexOf(l), 1); listsChanged(); renderMeal(); } };
}
/* 常買：用清單選，可以一次勾很多個 */
function pickListHistory(l) {
  return new Promise(res => { let done = false; const hist = listHistory(l.place).filter(n => !(l.items || []).some(x => x.n === n)), sel = new Set(); let q = '';
    const sh = sheet({title: '⭐ 常買', full: true, foot: '<button class="btn pri" data-a="ok">加入勾選的</button>', onClose() { if (!done) res(null); }});
    const draw = () => { const V = hist.filter(n => !q || n.toLowerCase().includes(q));
      sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="lhQ" type="search" placeholder="搜尋以前買過的東西" value="${esc(q)}"></div><div class="small muted" style="margin-bottom:.5rem">同一家店買過的排在前面</div>
        <div class="lhL">${V.map(n => `<button class="lhR ${sel.has(n) ? 'on' : ''}" data-n="${esc(n)}"><span class="lhCk"></span><span class="grow">${esc(n)}</span></button>`).join('') || '<div class="empty">沒有符合的</div>'}</div>`;
      sh.foot.querySelector('[data-a=ok]').textContent = sel.size ? `加入勾選的 ${sel.size} 項` : '加入勾選的';
      const i = $('#lhQ', sh.body); i.oninput = debounce(() => { q = i.value.trim().toLowerCase(); draw(); const n = $('#lhQ', sh.body); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    draw();
    sh.body.onclick = e => { const t = e.target.closest('[data-n]'); if (!t) return; buzz(8); const n = t.dataset.n; if (sel.has(n)) sel.delete(n); else sel.add(n); t.classList.toggle('on', sel.has(n)); sh.foot.querySelector('[data-a=ok]').textContent = sel.size ? `加入勾選的 ${sel.size} 項` : '加入勾選的'; };
    sh.foot.onclick = () => { if (!sel.size) { toast('請先勾選要加的東西'); return; } buzz(10); done = true; sh.close(); res([...sel]); }; });
}
/* 品項往左滑：露出「刪除」 */
function bindListSwipe(box) {
  let st = null; const closeAll = ex => $$('.slR.swp.open', box).forEach(r => { if (r !== ex) { r.classList.remove('open'); } });
  box.addEventListener('touchstart', e => { const ri = e.target.closest('.slR.swp .slRi'); if (!ri || e.target.closest('.grip')) { if (!e.target.closest('.slDel')) closeAll(); return; } const t = e.touches[0]; st = {ri, r: ri.parentElement, x: t.clientX, y: t.clientY, dx: 0, h: null, base: 0}; closeAll(st.r); }, {passive: true});
  box.addEventListener('touchmove', e => { if (!st) return; const t = e.touches[0], dx = t.clientX - st.x, dy = t.clientY - st.y; if (st.h == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) st.h = Math.abs(dx) > Math.abs(dy);
    if (!st.h) return; st.dx = dx; st.ri.style.transition = 'none'; st.ri.style.transform = `translateX(${Math.max(-110, Math.min(0, st.base + dx))}px)`; }, {passive: true});
  box.addEventListener('touchend', () => { if (!st) return; const {ri, r, h, dx, base} = st; st = null; ri.style.transition = ''; if (!h) return;
    const open = base + dx < -44; r.classList.toggle('open', open); ri.style.transform = ''; if (open) buzz(15);
    r.dataset.sw = '1'; setTimeout(() => delete r.dataset.sw, 300); });
  box.addEventListener('click', e => { const r = e.target.closest('.slR.swp'); if (r && r.dataset.sw && !e.target.closest('.slDel')) { e.stopPropagation(); e.preventDefault(); } }, true);
}
function initLists() {
  const box = $('#mealBody'); bindListSwipe(box);
  box.addEventListener('click', async e => { const card = e.target.closest('.slist'); if (!card) return; const t = e.target.closest('[data-a]'); if (!t) return; e.stopPropagation();
    const l = curList(card.dataset.l); if (!l) return; const a = t.dataset.a, row = t.closest('.slR'), x = row && row.dataset.i && l.items.find(y => y.id === row.dataset.i);
    if (a === 'lCheck' && x) { buzz(25); row.classList.add('checking'); setTimeout(() => { const i = l.items.indexOf(x); if (i < 0) return; l.items.splice(i, 1); (l.bought = l.bought || []).unshift(Object.assign({}, x, {at: Date.now()})); listsChanged(); redrawList(l); if (!l.items.length && l.bought.length) toast('🎉 清單全部買齊了'); }, 380); }
    else if (a === 'lUndo') { const b = (l.bought || []).find(y => y.id === t.closest('.slR').dataset.b); if (!b) return; buzz(10); l.bought.splice(l.bought.indexOf(b), 1); delete b.at; l.items.push(b); listsChanged(); redrawList(l); }
    else if (a === 'lAdd') { const inp = card.querySelector('.slIn'); if (addListItems(l, inp.value)) { buzz(10); redrawList(l); const n = $(`.slist[data-l="${l.id}"] .slIn`); if (n) n.focus(); } }
    else if (a === 'lSug') { buzz(10); addListItems(l, t.dataset.n); redrawList(l); }
    else if (a === 'lSugs') { const picked = await pickListHistory(l); if (picked && picked.length) { addListItems(l, picked.join('\n')); buzz(20); redrawList(l); toast(`已加入 ${picked.length} 項`); } }
    else if (a === 'lDel') { const r = t.closest('.slR'), arr = r.dataset.i ? l.items : (l.bought || []), it = arr.find(y => y.id === (r.dataset.i || r.dataset.b)); if (!it) return; buzz(25);
      const i = arr.indexOf(it); arr.splice(i, 1); listsChanged(); redrawList(l);
      toastUndo(`已刪除「${it.n}」`, () => { arr.splice(Math.min(i, arr.length), 0, it); listsChanged(); redrawList(l); }); }
    else if (a === 'lEdit' && x) { const v = await askText('品項（可以加數量，例如 雞蛋 ×2）', x.n + (x.note ? ' ' + x.note : '')); if (v == null) return; const s = v.trim(); if (!s) { l.items.splice(l.items.indexOf(x), 1); } else { const m = s.match(/^(.+?)\s*[x×*]\s*(\d+)$/i); x.n = (m ? m[1] : s).slice(0, 40); x.note = m ? '×' + m[2] : ''; } listsChanged(); redrawList(l); }
    else if (a === 'lStore') { buzz(10); const st = await pickShopStore(l.place); if (st === undefined) return; l.place = st && st.id || ''; l.pname = st ? st.name : ''; listsChanged(); redrawList(l); }
    else if (a === 'lMore') { buzz(10); listMore(l); } }, true);
  box.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.classList.contains('slIn')) return; e.preventDefault(); const card = e.target.closest('.slist'), l = curList(card.dataset.l); if (l && addListItems(l, e.target.value)) { buzz(10); redrawList(l); const n = $(`.slist[data-l="${l.id}"] .slIn`); if (n) n.focus(); } });
  box.addEventListener('paste', e => { if (!e.target.classList.contains('slIn')) return; const t = (e.clipboardData || window.clipboardData).getData('text'); if (!/\n/.test(t)) return; e.preventDefault(); const card = e.target.closest('.slist'), l = curList(card.dataset.l); if (l) { const n = addListItems(l, t); redrawList(l); toast(`已加入 ${n} 項`); } });
}
