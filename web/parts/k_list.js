/* ============================================================
   日常 → 購物清單：選店家、日期，列出要買的東西；勾選＝買到了（移到「已買」，可以復原）
   DB.lists = {'2026-11-21': [list]}
   list = {id, place, pname, items:[{id, n, note}], bought:[{id, n, note, at}], t}
   ============================================================ */
const saveLists = debounce(() => IDB.put('kv', 'lists', DB.lists).catch(saveErr), 200);
const dayLists = k => (DB.lists || {})[k] || [];
const listStore = l => { const P = (DB.places || []).find(x => x.id === l.place); return P ? P.name : l.pname || ''; };
const listKey = l => Object.keys(DB.lists).find(k => DB.lists[k].includes(l)) || '';
function listsChanged() { Object.keys(DB.lists).forEach(k => { if (!DB.lists[k].length) delete DB.lists[k]; }); saveLists(); }
/* 以前買過的東西（給建議用）：同一家店的優先 */
function listHistory(place) {
  const cnt = {}, own = {}; Object.values(DB.lists || {}).forEach(L => L.forEach(l => (l.items || []).concat(l.bought || []).forEach(x => { cnt[x.n] = (cnt[x.n] || 0) + 1; if (place && l.place === place) own[x.n] = (own[x.n] || 0) + 1; })));
  return Object.keys(cnt).sort((a, b) => (own[b] || 0) - (own[a] || 0) || cnt[b] - cnt[a]);
}
function listCard(l) {
  const its = l.items || [], bt = l.bought || [], hist = listHistory(l.place).filter(n => !its.some(x => x.n === n)).slice(0, 8);
  return `<div class="slist card" data-l="${l.id}">
    <div class="slH"><span class="slIc">🛒</span><div class="grow" data-a="lStore"><b>${esc(listStore(l) || '購物清單')}</b><small>${its.length ? `還要買 ${its.length} 項` : bt.length ? '✅ 全部買齊了' : '還沒有品項'}${bt.length ? `・已買 ${bt.length}` : ''}</small></div><button class="ic" data-a="lMore" aria-label="更多">⋯</button></div>
    <div class="slItems">${its.map(x => `<div class="slR" data-i="${x.id}"><button class="slCk" data-a="lCheck" aria-label="買到了"></button><span class="slN" data-a="lEdit">${esc(x.n)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span><span class="grip" aria-label="拖曳排序"></span></div>`).join('') || '<div class="slEmpty">在下面輸入要買的東西</div>'}</div>
    <div class="slAdd"><input class="slIn" placeholder="＋ 新增品項（可以一次貼好幾行）" enterkeyhint="done"><button class="btn pri" data-a="lAdd">加入</button></div>
    ${hist.length ? `<div class="slSug"><span>常買：</span>${hist.map(n => `<button data-a="lSug" data-n="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    ${bt.length ? `<details class="slDone"><summary>✅ 已買 ${bt.length} 項</summary>${bt.map(x => `<div class="slR done" data-b="${x.id}"><span class="slCk on"></span><span class="slN">${esc(x.n)}</span><button class="btn sm" data-a="lUndo">放回清單</button></div>`).join('')}</details>` : ''}
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
function initLists() {
  const box = $('#mealBody');
  box.addEventListener('click', async e => { const card = e.target.closest('.slist'); if (!card) return; const t = e.target.closest('[data-a]'); if (!t) return; e.stopPropagation();
    const l = curList(card.dataset.l); if (!l) return; const a = t.dataset.a, row = t.closest('.slR'), x = row && row.dataset.i && l.items.find(y => y.id === row.dataset.i);
    if (a === 'lCheck' && x) { buzz(25); row.classList.add('checking'); setTimeout(() => { const i = l.items.indexOf(x); if (i < 0) return; l.items.splice(i, 1); (l.bought = l.bought || []).unshift(Object.assign({}, x, {at: Date.now()})); listsChanged(); redrawList(l); if (!l.items.length && l.bought.length) toast('🎉 清單全部買齊了'); }, 380); }
    else if (a === 'lUndo') { const b = (l.bought || []).find(y => y.id === t.closest('.slR').dataset.b); if (!b) return; buzz(10); l.bought.splice(l.bought.indexOf(b), 1); delete b.at; l.items.push(b); listsChanged(); redrawList(l); }
    else if (a === 'lAdd') { const inp = card.querySelector('.slIn'); if (addListItems(l, inp.value)) { buzz(10); redrawList(l); const n = $(`.slist[data-l="${l.id}"] .slIn`); if (n) n.focus(); } }
    else if (a === 'lSug') { buzz(10); addListItems(l, t.dataset.n); redrawList(l); }
    else if (a === 'lEdit' && x) { const v = await askText('品項（可以加數量，例如 雞蛋 ×2）', x.n + (x.note ? ' ' + x.note : '')); if (v == null) return; const s = v.trim(); if (!s) { l.items.splice(l.items.indexOf(x), 1); } else { const m = s.match(/^(.+?)\s*[x×*]\s*(\d+)$/i); x.n = (m ? m[1] : s).slice(0, 40); x.note = m ? '×' + m[2] : ''; } listsChanged(); redrawList(l); }
    else if (a === 'lStore') { buzz(10); const st = await pickShopStore(l.place); if (st === undefined) return; l.place = st && st.id || ''; l.pname = st ? st.name : ''; listsChanged(); redrawList(l); }
    else if (a === 'lMore') { buzz(10); listMore(l); } }, true);
  box.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.classList.contains('slIn')) return; e.preventDefault(); const card = e.target.closest('.slist'), l = curList(card.dataset.l); if (l && addListItems(l, e.target.value)) { buzz(10); redrawList(l); const n = $(`.slist[data-l="${l.id}"] .slIn`); if (n) n.focus(); } });
  box.addEventListener('paste', e => { if (!e.target.classList.contains('slIn')) return; const t = (e.clipboardData || window.clipboardData).getData('text'); if (!/\n/.test(t)) return; e.preventDefault(); const card = e.target.closest('.slist'), l = curList(card.dataset.l); if (l) { const n = addListItems(l, t); redrawList(l); toast(`已加入 ${n} 項`); } });
}
