/* ============================================================
   食譜、設定、金鑰圖文教學、備份、啟動
   ============================================================ */
let curTab = 'Map';
/* 美食・日常和購物分帳已經合併成一個介面（底部：地圖、日常、分帳、發票、設定；食譜在設定裡） */
function modeUI() { document.body.classList.remove('mShop'); $('#favTitle') && ($('#favTitle').textContent = '收藏分類'); $('#mQ') && ($('#mQ').placeholder = '搜尋地點、店名、地址…'); }
function setMode() { }
function showTab(t) { if (/^Acc/.test(t) && typeof AccLock !== 'undefined' && !AccLock.open() && S.inAcc) setTimeout(() => AccLock.gate(), 0); if (t === 'AccA' && curTab !== 'AccA' && typeof Acc !== 'undefined') Acc.showAmt = false; curTab = t; $$('.page').forEach(p => p.classList.toggle('on', p.id === 'pg' + t)); $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === (t === 'Fav' ? 'Map' : t === 'Rec' ? 'Set' : t))); document.body.classList.toggle('onFav', t === 'Fav');
  if (t === 'Map') mapResize(); else if (t === 'Fav') renderFav(); else if (t === 'Rec') renderRec(); else if (t === 'Meal') renderMeal(); else if (t === 'Shop') renderShop(); else if (t === 'Inv') renderInv(); else if (t === 'Acc') renderAcc(); else if (t === 'AccA') renderAccAsset(); else if (t === 'AccM') renderAccMap(); else if (t === 'AccS') renderAccStat(); else if (t === 'AccC') renderAccCfg(); else renderSet(); updCounts(); }

/* ---------- 全部展開／收合（收藏、食譜共用） ---------- */
const FOLD = {fav: ['#favList', '#favFold', 'fold'], rec: ['#recList', '#recFold', 'rfold']};
function foldBtn(k) { const [l, b] = FOLD[k], secs = $$('.sec', $(l)), btn = $(b); if (!btn) return; btn.classList.toggle('hide', secs.length < 2);
  btn.textContent = secs.some(x => !x.classList.contains('fold')) ? '⊟ 全部收合' : '⊞ 全部展開'; }
function foldAll(k) { const [l, , key] = FOLD[k], secs = $$('.sec', $(l)); if (!secs.length) return; const close = secs.some(x => !x.classList.contains('fold'));
  S[key] = S[key] || {}; secs.forEach(x => { S[key][x.dataset.cat] = close; x.classList.toggle('fold', close); }); saveS(); foldBtn(k); }
/* ---------- 食譜 ----------
   兩種模板：
   std   一般食譜：份數 + 食材表（食材／數量）+ 步驟
   ratio 份量比例表：同一道料理不同份量（一人份、兩人份…）各自的用量，步驟可不填、之後再補 */
const rcatKey = r => DB.rcats.some(c => c.id === r.cat) ? r.cat : '';
const recMeta = r => r.type === 'ratio' ? `比例表 · ${(r.portions || []).length} 種份量 · ${(r.ing || []).length} 種食材${(r.steps || []).length ? ' · ' + r.steps.length + ' 個步驟' : ''}` : `${r.serv ? esc(r.serv) + ' · ' : ''}${(r.ing || []).length} 種食材 · ${(r.steps || []).length} 個步驟`;
async function renderRec() {
  const q = $('#recQ').value.trim().toLowerCase(), box = $('#recList');
  const hit = r => !q || (r.title + ' ' + (r.ing || []).map(i => i.n).join(' ') + ' ' + (r.note || '') + ' ' + rcatOf(r.cat).name).toLowerCase().includes(q);
  const covers = new Map(); await Promise.all(DB.recipes.filter(r => r.cover).map(async r => covers.set(r.id, await imgURL(r.cover))));
  const row = r => { const u = covers.get(r.id), c = rcatOf(rcatKey(r)); return `<div class="rrow" data-id="${r.id}"><div class="rth" ${u ? `style="background-image:url('${u}')"` : ''}>${u ? '' : esc(r.type === 'ratio' ? '⚖️' : c.icon)}</div><div class="grow"><b>${esc(r.title || '未命名食譜')}</b><small>${recMeta(r)}</small></div>${q ? '' : '<span class="grip rGrip"></span>'}</div>`; };
  const secs = DB.rcats.map(c => ({c, srt: true})); if (DB.recipes.some(r => !rcatKey(r))) secs.push({c: RUNCAT, srt: false});
  const html = secs.map(({c, srt}) => { const rs = DB.recipes.filter(r => rcatKey(r) === c.id && hit(r)); if (q && !rs.length) return '';
    return `<div class="sec rsec ${S.rfold[c.id] && !q ? 'fold' : ''}" data-cat="${c.id}" ${srt && !q ? 'data-srt' : ''} style="--c:${c.color}"><div class="secHead">${srt && !q ? '<span class="grip secGrip"></span>' : ''}<span class="ico">${esc(c.icon)}</span><b class="grow" data-a="fold">${esc(c.name)} <span class="cnt">${rs.length} 道</span></b><button class="ic chev" data-a="fold" aria-label="收合">▾</button></div>
      ${rs.length ? `<div class="secList">${rs.map(row).join('')}</div>` : ''}</div>`; }).join('');
  box.innerHTML = html || `<div class="empty"><span class="big">📖</span>${q ? '找不到符合的食譜' : '還沒有食譜<br><span class="small">按右上角「＋ 新增」，或用「✨ 圖片匯入」把食譜截圖變成表格</span>'}</div>`;
  box.dataset.q = q; foldBtn('rec');
}
function initRec() {
  const box = $('#recList'); $('#recQ').addEventListener('input', debounce(renderRec, 150)); $('#recAdd').onclick = () => newRecipe(); $('#recBack').onclick = () => { buzz(10); showTab('Set'); }; $('#recAI').onclick = aiRecipe; $('#recCats').onclick = () => openCats('recipe'); $('#recFold').onclick = () => foldAll('rec');
  box.addEventListener('click', e => { const f = e.target.closest('[data-a="fold"]'); if (f) { const s = f.closest('.sec'), id = s.dataset.cat; S.rfold[id] = !S.rfold[id]; saveS(); s.classList.toggle('fold', !!S.rfold[id]); foldBtn('rec'); return; } const b = e.target.closest('.rrow'); if (b) viewRecipe(b.dataset.id); });
  sortable(box, {item: '.rsec[data-srt]', start: '.secHead', scroller: '.pgBody', onSort(from, to) { moveItem(DB.rcats, from, to); saveRcats(); renderRec(); }});
  /* 食譜可以在資料夾內排序，也可以拖到別的資料夾 */
  sortable(box, {item: '.rrow', handle: '.rGrip', groups: '.rsec', scroller: '.pgBody', onSort(from, to, gFrom, gTo) { if (box.dataset.q) return; const cf = gFrom.dataset.cat, ct = gTo.dataset.cat, src = DB.recipes.filter(r => rcatKey(r) === cf)[from]; if (!src) return;
    src.cat = ct; DB.recipes.splice(DB.recipes.indexOf(src), 1); const T = DB.recipes.filter(r => rcatKey(r) === ct);
    if (to < T.length) DB.recipes.splice(DB.recipes.indexOf(T[to]), 0, src); else if (T.length) DB.recipes.splice(DB.recipes.indexOf(T[T.length - 1]) + 1, 0, src); else DB.recipes.push(src);
    DB.recipes.forEach((r, i) => { if (r.ord !== i || r === src) { r.ord = i; saveRecipe(r); } }); if (cf !== ct) { toast(`已移到「${rcatOf(ct).name}」`); if (S.rfold[ct]) { S.rfold[ct] = false; saveS(); } } renderRec(); }});
}
function newRecipe() {
  const sh = sheet({title: '新增食譜 · 選擇模板', html: `<div class="setC">
    <button class="setR" data-t="std" style="width:100%;text-align:left"><span style="font-size:1.6rem">📝</span><span class="t"><b>一般食譜</b><small>食材表（食材／數量）＋ 製作步驟。適合一道完整的料理。</small></span><span class="muted">›</span></button>
    <button class="setR" data-t="ratio" style="width:100%;text-align:left"><span style="font-size:1.6rem">⚖️</span><span class="t"><b>份量比例表</b><small>同一道料理，一人份、兩人份…各自的用量並排對照，例如電鍋蒸飯的米水比例。步驟可以不填、之後再補。</small></span><span class="muted">›</span></button>
    <button class="setR" data-t="scan" style="width:100%;text-align:left"><span style="font-size:1.6rem">📷</span><span class="t"><b>掃描朋友分享的食譜</b><small>掃對方給的食譜 QR Code（畫面或圖片都可以）。</small></span><span class="muted">›</span></button>
    <button class="setR" data-t="link" style="width:100%;text-align:left"><span style="font-size:1.6rem">🔗</span><span class="t"><b>貼上食譜連結</b><small>朋友從日日帳本傳來的食譜連結。</small></span><span class="muted">›</span></button></div>`});
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; sh.close(); const t = b.dataset.t;
    if (t === 'scan') { qrScanOnce('📷 掃描食譜 QR Code', x => /[#&]r=|recipe\//.test(x)).then(x => { if (x) recOpenLink(x); }); return; }
    if (t === 'link') { askText('貼上食譜連結', '', 'https://…#r=…').then(x => { if (x) recOpenLink(x); }); return; }
    editRecipe(t === 'ratio' ? {id: '', type: 'ratio', title: '', serv: '', portions: ['一人份', '兩人份'], ing: [{n: '', q: ['', '']}], steps: [], note: '', cover: '', cat: ''} : {id: '', type: 'std', title: '', serv: '', ing: [{n: '', q: ''}], steps: [''], note: '', cover: '', cat: ''}, true); });
}
const recSel = {};
function viewRecipe(id) {
  const r = DB.recipes.find(x => x.id === id); if (!r) return; const sh = sheet({title: '食譜', full: true}); sh.tools.innerHTML = '<button class="btn sm" data-a="share">📤 分享</button><button class="btn sm" data-a="dup">📄 另存</button><button class="btn sm" data-a="edit">✎ 編輯</button>';
  const render = async () => { const cov = await imgURL(r.cover), c = rcatOf(rcatKey(r)), P = r.portions || []; let tbl;
    if (r.type === 'ratio') { let sel = recSel[r.id]; if (sel == null || sel >= P.length) sel = -1;
      tbl = `<div class="mcats noSel">${P.length > 1 ? `<button class="chip ${sel < 0 ? 'on' : ''}" data-p="-1">全部對照</button>` : ''}${P.map((pn, j) => `<button class="chip ${sel === j || P.length === 1 ? 'on' : ''}" data-p="${j}">${esc(pn || '份量 ' + (j + 1))}</button>`).join('')}</div>` +
        (sel < 0 && P.length > 1 ? `<div class="rtWrap"><table class="rtable ratio"><thead><tr><th>食材</th>${P.map((pn, j) => `<th>${esc(pn || '份量 ' + (j + 1))}</th>`).join('')}</tr></thead><tbody>${(r.ing || []).map(i => `<tr><td>${esc(i.n)}</td>${P.map((_, j) => `<td>${esc((i.q || [])[j] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
          : `<table class="rtable"><thead><tr><th style="width:50%">食材</th><th>${esc(P[Math.max(0, sel)] || '數量')}</th></tr></thead><tbody>${(r.ing || []).map(i => `<tr><td>${esc(i.n)}</td><td>${esc((i.q || [])[Math.max(0, sel)] || '—')}</td></tr>`).join('')}</tbody></table>`);
    } else tbl = `<table class="rtable"><thead><tr><th style="width:50%">食材</th><th>數量</th></tr></thead><tbody>${(r.ing || []).map(i => `<tr><td>${esc(i.n)}</td><td>${esc(i.q)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">（尚未填寫食材）</td></tr>'}</tbody></table>`;
    sh.body.innerHTML = `<article class="recipe">${cov ? `<img class="cover" data-a="covView" src="${cov}" alt="">` : ''}<h2>${esc(r.title || '未命名食譜')}</h2>
      <div class="serv">${rcatKey(r) ? `<span class="tag" style="--c:${c.color}">${esc(c.icon)} ${esc(c.name)}</span> ` : ''}${r.type === 'ratio' ? '份量比例表' : '份數：' + esc(r.serv || '—')}</div>${tbl}
      <h3>步驟</h3>${(r.steps || []).length ? `<ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : `<p class="muted">（還沒有填寫步驟${r.type === 'ratio' ? '，可以按「編輯」之後再補' : ''}）</p>`}${r.note ? `<h3>備註</h3><div class="note">${esc(r.note)}</div>` : ''}</article>`; };
  render();
  sh.body.addEventListener('click', e => { if (e.target.closest('[data-a="covView"]')) { buzz(10); Viewer.open([{id: r.cover, label: ''}], 0, r.title || '食譜'); return; } const b = e.target.closest('[data-p]'); if (!b) return; recSel[r.id] = +b.dataset.p; render(); });
  sh.tools.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'share') { buzz(10); shareRecipe(r); }
    else if (b.dataset.a === 'dup') { buzz(10); dupRecipe(r).then(n => { if (!n) return; sh.close(); viewRecipe(n.id); editRecipe(n, false, () => {}); }); }
    else editRecipe(r, false, del => { if (del) sh.close(); else render(); }); });
}
/* 另存新檔：複製一份食譜（封面圖片也複製一份，兩份互不影響），改個名字，放在原本那份後面 */
async function dupRecipe(r, data) { const nm = ((await askText('新食譜的名稱', (data || r).title + '（複製）')) || '').trim(); if (!nm) return null;
  const n = JSON.parse(JSON.stringify(data || r)); n.id = 'r' + uid(); n.t = Date.now(); n.title = nm;
  if (n.cover) n.cover = (await copyImgs([n.cover]))[0] || '';
  const at = DB.recipes.indexOf(r); DB.recipes.splice(at >= 0 ? at + 1 : 0, 0, n); DB.recipes.forEach((x, i) => { x.ord = i; saveRecipe(x); });
  renderRec(); updCounts(); buzz(20); toast('📄 已另存成「' + nm + '」'); return n; }
function editRecipe(src, isNew, done) {
  const d = JSON.parse(JSON.stringify(src)); d.type = d.type === 'ratio' ? 'ratio' : 'std'; d.portions = (d.portions || []).slice(); d.steps = d.steps && d.steps.length ? d.steps : ['']; d.cat = isNew ? (d.cat || '') : rcatKey(d);
  /* 編輯時兩種模板的資料都留著（q＝一般、qs＝各份量），切換模板不會遺失已輸入的內容 */
  d.ing = (d.ing && d.ing.length ? d.ing : [{n: '', q: ''}]).map(x => Array.isArray(x.q) ? {n: x.n, q: x.q[0] || '', qs: x.q.slice()} : {n: x.n, q: x.q || '', qs: [x.q || '']});
  let newCover = null;
  const sh = sheet({title: isNew ? '新增食譜' : '編輯食譜', full: true, foot: `<div class="tplFoot ${isNew ? 'new' : ''}">${isNew ? '' : '<button class="btn danger" data-a="del">🗑 刪除</button><button class="btn" data-a="saveAs">📄 另存新檔</button>'}<button class="btn pri" data-a="ok">✓ 儲存</button></div>`});
  sh.body.innerHTML = `<div class="field"><label>模板</label><div class="seg" id="rType"><button data-v="std">📝 一般食譜</button><button data-v="ratio">⚖️ 份量比例表</button></div></div>
    <div class="field"><label>食譜名稱</label><input id="rT" value="${esc(d.title)}" placeholder="例如：電鍋蒸飯、高麗菜大阪燒"></div>
    <div class="field"><label>分類（資料夾）</label><div class="catPick" id="rC"></div></div>
    <div id="rBody"></div>
    <div class="field"><label>封面照片（可不放）</label><div class="row"><div class="thumbs" id="rCov" style="padding:0"></div><button class="btn sm" data-a="cov">選擇照片</button></div></div>
    <div class="field"><label id="rPL">製作步驟</label><div id="rP" class="noSel"></div><button class="btn sm" data-a="sAdd">＋ 新增步驟</button></div>
    <div class="field"><label>備註</label><textarea id="rN" rows="2" placeholder="小技巧、替代食材…">${esc(d.note || '')}</textarea></div>`;
  const catH = () => { $('#rC', sh.body).innerHTML = DB.rcats.map(c => `<button data-c="${c.id}" class="${d.cat === c.id ? 'on' : ''}" style="--c:${c.color}">${esc(c.icon)} ${esc(c.name)}</button>`).join('') + `<button data-c="" class="${d.cat ? '' : 'on'}" style="--c:${RUNCAT.color}">未分類</button><button data-c="+">＋ 新分類</button>`; };
  const pn = j => d.portions[j] || '份量 ' + (j + 1);
  const bodyH = () => { const R = d.type === 'ratio'; $$('#rType button', sh.body).forEach(b => b.classList.toggle('on', b.dataset.v === d.type)); $('#rPL', sh.body).textContent = R ? '製作步驟（可以不填，之後再補）' : '製作步驟';
    $('#rBody', sh.body).innerHTML = (R ? `<div class="field"><label>有哪些份量（每種份量各寫各的用量）</label><div id="rPo" class="noSel">${d.portions.map((p, j) => `<div class="erow" data-j="${j}"><span class="grip"></span><input data-k="pn" value="${esc(p)}" placeholder="例如：一人份、兩人份、4 杯米"><button class="ic del" data-a="pDel" aria-label="刪除">✕</button></div>`).join('')}</div><button class="btn sm" data-a="pAdd">＋ 新增份量</button></div>`
        : `<div class="field"><label>份數</label><input id="rS" value="${esc(d.serv)}" placeholder="例如：一人份、兩人四天份"></div>`) +
      `<div class="field"><label>${R ? '食材與各份量的用量' : '食材表（食材／數量）'}</label><div id="rI" class="noSel"></div><button class="btn sm" data-a="iAdd">＋ 新增食材</button></div>`;
    ingH();
    if (R) sortable($('#rPo', sh.body), {item: '.erow', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, t) { moveItem(d.portions, f, t); d.ing.forEach(x => { while (x.qs.length < d.portions.length) x.qs.push(''); moveItem(x.qs, f, t); }); bodyH(); }});
    sortable($('#rI', sh.body), {item: '.erow', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, t) { moveItem(d.ing, f, t); ingH(); }}); };
  const ingH = () => { const R = d.type === 'ratio';
    $('#rI', sh.body).innerHTML = d.ing.map((x, i) => R ? `<div class="erow icard" data-i="${i}"><span class="grip"></span><div class="grow"><input data-k="n" value="${esc(x.n)}" placeholder="食材（例如：白米、內鍋水、外鍋水）"><div class="pgrid">${d.portions.map((_, j) => `<label><span>${esc(pn(j))}</span><input data-k="qs" data-j="${j}" value="${esc(x.qs[j] || '')}" placeholder="用量"></label>`).join('')}</div></div><button class="ic del" data-a="iDel" aria-label="刪除">✕</button></div>`
      : `<div class="erow" data-i="${i}"><span class="grip"></span><input data-k="n" value="${esc(x.n)}" placeholder="食材"><input data-k="q" value="${esc(x.q)}" placeholder="數量" enterkeyhint="next"><button class="ic del" data-a="iDel" aria-label="刪除">✕</button></div>`).join(''); };
  const stpH = () => { $('#rP', sh.body).innerHTML = d.steps.map((x, i) => `<div class="erow" data-i="${i}"><span class="grip"></span><span class="num">${i + 1}.</span><textarea data-k="s" rows="1" placeholder="步驟 ${i + 1}">${esc(x)}</textarea><button class="ic del" data-a="sDel" aria-label="刪除">✕</button></div>`).join(''); $$('#rP textarea', sh.body).forEach(grow); };
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(42, t.scrollHeight + 2) + 'px'; };
  const covH = async () => { const u = newCover ? newCover.url : await imgURL(d.cover); $('#rCov', sh.body).innerHTML = u ? `<div class="th"><img src="${u}" alt=""><button class="rm" data-a="covDel">✕</button></div>` : ''; };
  const readTop = () => { d.title = $('#rT', sh.body).value.trim(); const s = $('#rS', sh.body); if (s) d.serv = s.value.trim(); d.note = $('#rN', sh.body).value.trim(); };
  catH(); bodyH(); stpH(); covH(); setTimeout(() => $$('#rP textarea', sh.body).forEach(grow), 300);
  sortable($('#rP', sh.body), {item: '.erow', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, t) { moveItem(d.steps, f, t); stpH(); }});
  sh.body.addEventListener('input', e => { const t = e.target, row = t.closest('.erow'); if (!row) return; const k = t.dataset.k;
    if (k === 'pn') { d.portions[+row.dataset.j] = t.value; return; } const i = +row.dataset.i;
    if (k === 's') { d.steps[i] = t.value; grow(t); } else if (k === 'qs') d.ing[i].qs[+t.dataset.j] = t.value; else if (k === 'q') { d.ing[i].q = t.value; d.ing[i].qs[0] = t.value; } else if (k === 'n') d.ing[i].n = t.value; });
  sh.body.addEventListener('change', e => { if (e.target.dataset.k === 'pn') ingH(); });
  sh.body.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.isComposing) return; const t = e.target; if (t.dataset.k === 'q' && +t.closest('.erow').dataset.i === d.ing.length - 1) { e.preventDefault(); d.ing.push({n: '', q: '', qs: []}); ingH(); $$('#rI input[data-k="n"]', sh.body).pop().focus(); } });
  sh.body.addEventListener('click', async e => {
    const tb = e.target.closest('#rType button'); if (tb) { if (tb.dataset.v === d.type) return; readTop(); d.type = tb.dataset.v;
      if (d.type === 'ratio') { if (!d.portions.length) d.portions = [d.serv || '一人份', '兩人份']; d.ing.forEach(x => { if (!x.qs.length || !x.qs[0]) x.qs[0] = x.q; }); } else { d.ing.forEach(x => { x.q = x.qs[0] || x.q; }); if (!d.serv) d.serv = d.portions[0] || ''; } bodyH(); return; }
    const cb = e.target.closest('#rC button'); if (cb) { if (cb.dataset.c === '+') { editCat(null, c => { if (c) d.cat = c.id; catH(); }, 'recipe'); return; } d.cat = cb.dataset.c; catH(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, row = b.closest('.erow'), i = row ? +row.dataset.i : -1;
    if (a === 'iAdd') { d.ing.push({n: '', q: '', qs: []}); ingH(); $$('#rI input[data-k="n"]', sh.body).pop().focus(); }
    else if (a === 'sAdd') { d.steps.push(''); stpH(); $$('#rP textarea', sh.body).pop().focus(); }
    else if (a === 'pAdd') { d.portions.push(''); bodyH(); $$('#rPo input', sh.body).pop().focus(); }
    else if (a === 'pDel') { const j = +row.dataset.j; if (d.portions.length <= 1) { toast('至少要有一種份量'); return; } d.portions.splice(j, 1); d.ing.forEach(x => x.qs.splice(j, 1)); bodyH(); }
    else if (a === 'iDel') { d.ing.splice(i, 1); if (!d.ing.length) d.ing.push({n: '', q: '', qs: []}); ingH(); } else if (a === 'sDel') { d.steps.splice(i, 1); if (!d.steps.length) d.steps.push(''); stpH(); }
    else if (a === 'cov') { const fs = await pickImages(false); if (!fs.length) return; if (newCover) URL.revokeObjectURL(newCover.url); newCover = {file: fs[0], url: URL.createObjectURL(fs[0])}; covH(); }
    else if (a === 'covDel') { if (newCover) { URL.revokeObjectURL(newCover.url); newCover = null; } d.cover = ''; covH(); } });
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`確定要刪除食譜「${src.title}」嗎？`, '刪除', true)) return; await imgDel(src.cover); DB.recipes.splice(DB.recipes.indexOf(src), 1); await IDB.del('recipes', src.id).catch(() => {}); sh.close(); renderRec(); updCounts(); toast('已刪除'); done && done(true); return; }
    readTop(); if (!d.title) { toast('請輸入食譜名稱'); $('#rT', sh.body).focus(); return; }
    const saveAs = b.dataset.a === 'saveAs'; const R = d.type === 'ratio', out = {id: d.id, type: d.type, title: d.title, note: d.note, cover: d.cover, cat: d.cat, ord: d.ord, t: d.t, steps: d.steps.map(s => s.trim()).filter(Boolean)};
    if (R) { out.portions = d.portions.map((p, j) => p.trim() || '份量 ' + (j + 1)); out.serv = ''; out.ing = d.ing.filter(x => (x.n + x.qs.join('')).trim()).map(x => ({n: x.n.trim(), q: out.portions.map((_, j) => (x.qs[j] || '').trim())})); }
    else { out.serv = d.serv; out.ing = d.ing.filter(x => (x.n + x.q).trim()).map(x => ({n: x.n.trim(), q: x.q.trim()})); }
    /* 另存新檔：用目前改好的內容存成一份新的，原本那份不動 */
    if (saveAs) { try { if (newCover) { out.cover = await imgStore(newCover.file, 1600); URL.revokeObjectURL(newCover.url); newCover = null; const n = await dupRecipe(src, Object.assign({}, out, {cover: ''})); if (n) { n.cover = out.cover; await saveRecipe(n); } else await imgDel(out.cover); if (n) { sh.close(); done && done(false); } }
        else { const n = await dupRecipe(src, out); if (n) { sh.close(); done && done(false); } } } catch (er) { toast('❌ ' + er.message); } return; }
    busy('儲存中…'); try { if (newCover) { out.cover = await imgStore(newCover.file, 1600); URL.revokeObjectURL(newCover.url); } if (!isNew && src.cover && src.cover !== out.cover) await imgDel(src.cover);
      if (isNew) { out.id = 'r' + uid(); out.t = Date.now(); DB.recipes.unshift(out); DB.recipes.forEach((r, i) => { r.ord = i; saveRecipe(r); }); } else { Object.keys(src).forEach(k => delete src[k]); Object.assign(src, out); await saveRecipe(src); } } catch (er) { busy(false); toast('❌ ' + er.message); return; }
    busy(false); sh.close(); renderRec(); updCounts(); toast('已儲存'); done && done(false); });
  if (isNew && !d.title) setTimeout(() => $('#rT', sh.body).focus(), 320);
}
async function aiRecipe() {
  if (!S.aikey) { needAiKey(); return; } const fs = await pickImages(true); if (!fs.length) return;
  busy('AI 正在讀取食譜圖片…'); try { const parts = [{text: RECIPE_PROMPT}]; for (const f of fs.slice(0, 6)) { const id = await imgStore(f, 2400); parts.push(await imgPart(await imgBlob(id))); await imgDel(id); }
    const r = await gemini(parts, RECIPE_SCHEMA); busy(false);
    editRecipe({id: '', type: 'std', title: r.title || '', serv: r.servings || '', ing: (r.ingredients || []).map(x => ({n: String(x.name || ''), q: String(x.amount || '')})), steps: (r.steps || []).map(s => String(s).replace(/^\s*\d+[.、)]\s*/, '')), note: r.note || '', cover: '', cat: ''}, true);
    toast('✅ 已辨識，請檢查內容後按「儲存」', 3500);
  } catch (e) { busy(false); toast('❌ ' + (e.message === 'NOKEY' ? '尚未設定金鑰' : e.message), 4500); }
}

/* ---------- 設定 ---------- */
/* 設定頁最上面：目前所在的功能區 */
function areaHero() {
  const shop = S.mode === 'shop', tabs = shop ? [['🗺️', '地圖'], ['⭐', '收藏'], ['🧾', '分帳'], ['🎫', '發票']] : [['🗺️', '地圖'], ['⭐', '收藏'], ['📒', '日常'], ['📖', '食譜']];
  return `<div class="areaHero ${shop ? 'shop' : 'food'}"><div class="ahIc">${shop ? '🛒' : '🍽️'}</div><div class="ahT"><small>目前所在的功能區</small><b>${shop ? '購物分帳' : '美食・日常'}</b>
    <div class="ahTabs">${tabs.map(([i, t]) => `<span>${i} ${t}</span>`).join('')}</div></div><span class="ahOn"><i></i>使用中</span></div>`;
}
function renderSet() {
  const seg = (id, opts, cur) => `<div class="seg" data-seg="${id}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const sw = (id, on) => `<button class="sw2 ${on ? 'on' : ''}" data-sw="${id}" role="switch" aria-checked="${!!on}"></button>`;
  const dark = isDark(), navs = navApps({lat: 0, lon: 0});
  $('#setBody').innerHTML = `
  <div class="setG"><h3>記帳</h3><div class="setC"><button class="recCard accCard2" data-a="acc"><span class="rcI">📒</span><span class="rcT"><b>記帳・對帳</b><small>${(() => { if (typeof AccLock !== 'undefined' && !AccLock.open()) return '🔒 已上鎖・'; const d = DB.acc ? accDebts() : {}, v = Object.values(d).reduce((s, x) => s + (x > 0 ? x : 0), 0); return v ? '別人還欠我 ' + money(v) + '・' : ''; })()}收入支出、分帳欠款，不定期跟朋友對帳</small></span><span class="rcGo">進入記帳 ›</span></button>
    <div class="accLkRow"><button class="lkBtn ${typeof AccLock !== 'undefined' && AccLock.has() && !AccLock.open() ? 'on' : ''}" data-lk data-a="accLock">${typeof AccLock !== 'undefined' ? AccLock.label() : ''}</button><small>${typeof AccLock !== 'undefined' && AccLock.has() ? '螢幕關閉或關掉 App 會自動上鎖' : '可以設定密碼或指紋保護記帳資料'}</small></div></div></div>
  <div class="setG"><h3>食譜</h3><div class="setC"><button class="recCard" data-a="rec"><span class="rcI">📖</span><span class="rcT"><b>我的食譜</b><small>${(DB.recipes || []).length ? '共 ' + DB.recipes.length + ' 道・' : ''}記錄做法和食材，可以用圖片 AI 匯入</small></span><span class="rcGo">進入食譜 ›</span></button></div></div>
  <div class="setG"><h3>使用說明</h3><div class="setC">
    <button class="setR" data-a="guideFood" style="width:100%;text-align:left"><span class="gRi">🍽️</span><div class="t"><b>地圖・日常・食譜 圖解說明</b><small>找店收藏、AI 菜單表格、記一餐分帳、購物清單、食譜</small></div><span class="muted">›</span></button>
    <button class="setR" data-a="guideShop" style="width:100%;text-align:left"><span class="gRi">🛒</span><div class="t"><b>購物分帳 圖解說明</b><small>上傳明細、購物方式、選誰付、折扣與費用、驗算匯出</small></div><span class="muted">›</span></button>
    <button class="setR" data-a="guideAcc" style="width:100%;text-align:left"><span class="gRi">💰</span><div class="t"><b>記帳 圖解說明</b><small>記一筆、常用、欠款對帳、資產、分析、備份換機</small></div><span class="chev">›</span></button>
    <button class="setR" data-a="guideInv" style="width:100%;text-align:left"><span class="gRi">🎫</span><div class="t"><b>發票 圖解說明</b><small>手機條碼、掃 QR、截圖、協助工具、折扣、拿去分帳</small></div><span class="muted">›</span></button>
    <button class="setR" data-a="welcome" style="width:100%;text-align:left"><span class="gRi">👋</span><div class="t"><b>歡迎畫面與金鑰教學</b><small>第一次打開時看到的介紹</small></div><span class="muted">›</span></button></div></div>
  <div class="setG"><h3>外觀</h3><div class="setC">
    <div class="setR"><div class="t"><b>主題</b></div>${seg('theme', [['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']], S.theme)}</div>
    <div class="setR col"><div class="t"><b>重點顏色</b><small>底色維持大地色系，只換按鈕與標題的顏色</small></div><div class="pal">${Object.keys(PALETTES).map(k => `<button data-pal="${k}" class="${S.palette === k ? 'on' : ''}"><i style="--c:${dark ? PALETTES[k].sd : PALETTES[k].sw}"></i>${PALETTES[k].name}</button>`).join('')}</div></div>
    <div class="setR"><div class="t"><b>介面大小</b></div>${seg('scale', [[90, '小'], [100, '標準'], [112, '大'], [125, '特大']], S.scale)}</div>
    <div class="setR col"><div class="t"><b>震動強度</b><small>點按鈕、拖曳排序時的震動回饋${IS_APP && !NB.vibrate2 ? '（安裝 APK v1.2.0 以上，強弱差異會更明顯）' : ''}</small></div>${seg('hapLv', [[0, '關閉'], [1, '弱'], [2, '中'], [3, '強']], S.haptic === false ? 0 : S.hapLv)}</div></div></div>
  <div class="setG"><h3>地圖與導航</h3><div class="setC">
    <div class="setR"><div class="t"><b>3D 立體地圖</b><small>以傾斜視角顯示立體建築（地圖右側也可切換）</small></div>${sw('map3d', S.map3d)}</div>
    <div class="setR"><div class="t"><b>旗子旁顯示店名</b><small>地圖放大時在旗子旁顯示名稱</small></div>${sw('labels', S.labels)}</div>
    <div class="setR"><div class="t"><b>導航軟體</b><small>按「導航」時要用哪個 App</small></div><select id="sNav"><option value="ask">每次詢問</option>${navs.map(n => `<option value="${n.id}" ${S.navApp === n.id ? 'selected' : ''}>${n.name}</option>`).join('')}</select></div>
    ${Off.card()}</div></div>
  <div class="setG"><h3>Google 地圖搜尋金鑰</h3><div class="setC">
    <div class="setR col"><div class="t"><small>填入後，搜尋地點會和 Google 地圖一樣準確，並能自動帶入營業時間、電話。${S.gkey ? '' : '<br>沒有金鑰也能用，只是搜尋改用 OpenStreetMap，地點較不齊全。'}<br>💡 行跡導航用的那把金鑰可以直接貼過來共用。</small></div>
      <div class="keyBox"><input id="sG" type="password" value="${esc(S.gkey)}" placeholder="貼上 Google Maps API 金鑰（AIza…）" autocomplete="off"><button class="btn sm" data-a="eyeG">顯示</button></div>
      <div class="row wrap"><button class="btn sm pri" data-a="tutG">📘 圖文教學</button><button class="btn sm" data-a="getG">申請金鑰 ↗</button><button class="btn sm olive" data-a="testG">測試金鑰</button></div><div class="testOut" id="outG"></div></div></div></div>
  <div class="setG"><h3>AI 圖片辨識金鑰（Gemini）</h3><div class="setC">
    <div class="setR col"><div class="t"><small>用來把菜單照片、食譜截圖轉成表格。金鑰可在 Google AI Studio 免費申請。</small></div>
      <div class="keyBox"><input id="sA" type="password" value="${esc(S.aikey)}" placeholder="貼上 Gemini API 金鑰" autocomplete="off"><button class="btn sm" data-a="eyeA">顯示</button></div>
      <div class="row wrap"><button class="btn sm pri" data-a="tutA">📘 圖文教學</button><button class="btn sm" data-a="getA">申請金鑰 ↗</button><button class="btn sm olive" data-a="testA">測試金鑰</button></div><div class="testOut" id="outA"></div></div>
    <div class="setR"><div class="t"><b>辨識模型</b><small>自動＝先用 Flash-Lite（快、每天約 500 次），額度用完自動換 Flash（較準、每天約 20 次）</small></div><select id="sM"><option value="auto" ${!S.aimodel || S.aimodel === 'auto' ? 'selected' : ''}>自動</option><option value="lite" ${S.aimodel === 'lite' ? 'selected' : ''}>Flash-Lite（快）</option><option value="flash" ${S.aimodel === 'flash' ? 'selected' : ''}>Flash（較準）</option>${S.aimodel && !['auto', 'lite', 'flash'].includes(S.aimodel) ? `<option selected>${esc(S.aimodel)}</option>` : ''}</select></div>
    ${aiUsageCard()}
    <button class="setR" data-a="mcheck" style="width:100%;text-align:left"><div class="t"><b>🩺 檢查所有菜單表格</b><small>自動找出可能辨識錯的店家（沒價格、同一格兩個價格、有新版圖片…），勾選後一次全部重新辨識</small></div><span class="muted">›</span></button></div>
  <div class="setG"><h3>分類</h3><div class="setC"><button class="setR" data-a="cats" style="width:100%;text-align:left"><div class="t"><b>管理收藏分類</b><small>自訂名稱、圖示、旗子顏色與排序（共 ${DB.cats.length} 個）</small></div><span class="muted">›</span></button>
    <button class="setR" data-a="rcats" style="width:100%;text-align:left"><div class="t"><b>管理食譜分類</b><small>煎、炒、電鍋、湯…自訂名稱、圖示與排序（共 ${DB.rcats.length} 個）</small></div><span class="muted">›</span></button></div></div>
  <div class="setG"><h3>資料備份</h3><div class="setC">
    <div class="setR col"><div class="t"><small id="dbInfo">共 ${DB.places.length} 間收藏、${DB.recipes.length} 道食譜。資料只存在這台裝置裡，換手機或重灌前請先匯出備份。</small></div>
      <div class="row wrap"><button class="btn sm pri" data-a="exp">匯出備份檔</button><button class="btn sm" data-a="imp">匯入備份檔</button><button class="btn sm danger" data-a="wipe">清除所有資料</button></div></div></div></div>
  <div class="setG"><h3>版本與更新</h3><div class="setC" id="updCard">${Upd.card()}</div></div>
  <div class="setG"><h3>關於</h3><div class="setC">
    <div class="setR"><div class="t"><b>日日帳本 v${APP_VER}</b><small>${IS_APP ? 'Android App' + (NB.version ? ' · APK v' + NB.version() : '') : '網頁版'}${window.__OTA ? '（已線上更新）' : ''} · 地圖資料 © OpenFreeMap、© OpenStreetMap 貢獻者</small></div></div></div></div>`;
}
function initSet() {
  const box = $('#setBody');
  box.addEventListener('change', e => { const t = e.target; if (t.id === 'sNav') { S.navApp = t.value; saveS(); } else if (t.id === 'sM') { S.aimodel = t.value; saveS(); }
    else if (t.id === 'sG') { S.gkey = t.value.trim(); GPC.clear(); saveS(); } else if (t.id === 'sA') { S.aikey = t.value.trim(); saveS(); } });
  box.addEventListener('input', e => { const t = e.target; if (t.id === 'sG') { S.gkey = t.value.trim(); saveS(); } else if (t.id === 'sA') { S.aikey = t.value.trim(); saveS(); } });
  box.addEventListener('click', async e => {
    const sg = e.target.closest('.seg button'); if (sg) { const k = sg.parentNode.dataset.seg; S[k] = k === 'scale' || k === 'hapLv' ? +sg.dataset.v : sg.dataset.v; if (k === 'hapLv') { S.haptic = S.hapLv > 0; buzzAt = 0; buzz(40); } saveS(); applyTheme(); renderSet(); mapResize(); return; }
    const pal = e.target.closest('[data-pal]'); if (pal) { S.palette = pal.dataset.pal; saveS(); applyTheme(); renderSet(); return; }
    const sw = e.target.closest('[data-sw]'); if (sw) { const k = sw.dataset.sw; S[k] = !S[k]; saveS(); sw.classList.toggle('on', !!S[k]); sw.setAttribute('aria-checked', !!S[k]);
      if (k === 'map3d' && M.map) M.map.easeTo({pitch: S.map3d ? 55 : 0, duration: 0}); if (k === 'labels' && M.map) M.map.fire('move'); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'eyeG' || a === 'eyeA') { const i = $(a === 'eyeG' ? '#sG' : '#sA'); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? '顯示' : '隱藏'; }
    else if (a === 'tutG') openTutorial('maps'); else if (a === 'tutA') openTutorial('ai');
    else if (a === 'getG') openUrl('https://console.cloud.google.com/google/maps-apis/credentials'); else if (a === 'getA') openUrl('https://aistudio.google.com/apikey');
    else if (a === 'testG') { $('#outG').innerHTML = '測試中…'; $('#outG').innerHTML = await testG(); } else if (a === 'testA') { $('#outA').innerHTML = '測試中…'; $('#outA').innerHTML = await testA(); renderSetKeep(); }
    else if (a === 'updChk') Upd.check(true); else if (a === 'updApk') Upd.releases(); else if (a === 'updBack') Upd.restore(); else if (a === 'updShare') Upd.share(); else if (a === 'updWeb') openUrl(GH.pages);
    else if (a === 'aiStudio') openUrl('https://aistudio.google.com/rate-limit?timeRange=last-28-days'); else if (a === 'aiLog') { const o = $('#aiLogBox'); o.classList.toggle('hide'); b.textContent = o.classList.contains('hide') ? '查看最近 AI 紀錄' : '收起紀錄'; }
    else if (a === 'mcheck') openMenuCheck();
    else if (a === 'rec') { buzz(15); showTab('Rec'); } else if (a === 'acc') { buzz(15); enterAcc(); } else if (a === 'accLock') { buzz(10); await AccLock.toggle(); renderSetKeep(); } else if (a === 'guideFood') openGuide('food'); else if (a === 'guideAcc') openGuide('acc'); else if (a === 'guideShop') openGuide('shop'); else if (a === 'guideInv') openGuide('inv');
    else if (a === 'cats') openCats('place'); else if (a === 'rcats') openCats('recipe'); else if (a.indexOf('off') === 0) Off.act(a); else if (a === 'exp') exportBackup(); else if (a === 'imp') importBackup(); else if (a === 'welcome') welcome();
    else if (a === 'wipe') { if (await ask('確定要清除「所有」收藏、菜單、食譜與設定嗎？\n這個動作無法復原，建議先匯出備份。', '全部清除', true) && await ask('再確認一次：真的要全部清除嗎？', '清除', true)) { for (const s of ['kv', 'places', 'recipes', 'imgs']) await IDB.clear(s).catch(() => {}); try { localStorage.clear(); } catch (er) {} location.reload(); } } });
}
function renderSetKeep() { const o = $('#outA') ? $('#outA').innerHTML : ''; renderSet(); if ($('#outA')) $('#outA').innerHTML = o; }
async function testG() { if (!S.gkey) return '<span class="no">請先貼上金鑰</span>';
  try { const j = await jfetch('https://places.googleapis.com/v1/places:searchText', {method: 'POST', headers: gHead('places.displayName,places.formattedAddress'), body: JSON.stringify({textQuery: '台北101', languageCode: 'zh-TW', maxResultCount: 1})}, 15000);
    if (j.error) { const h = gErrHint((j.error.message || '') + JSON.stringify(j.error.details || ''), j.error.status); return `<span class="no">✘ 無法使用</span><br>${esc(j.error.message || j.error.status)}${h ? '<br>👉 ' + esc(h) : ''}`; }
    const p = (j.places || [])[0]; return `<span class="ok">✔ 金鑰可以使用</span>${p ? '（測試搜尋：' + esc(p.displayName && p.displayName.text || '') + '）' : ''}`; } catch (e) { return '<span class="no">✘ ' + esc(e.message) + '</span>'; } }
async function testA() { if (!S.aikey) return '<span class="no">請先貼上金鑰</span>';
  try { const m = await aiModels(true); if (!m.lite && !m.flash) return '<span class="no">✘ 這把金鑰找不到可用的 Gemini 模型</span>';
    return `<span class="ok">✔ 金鑰可以使用</span><br>Flash-Lite：${esc(m.lite || '（沒有）')}<br>Flash：${esc(m.flash || '（沒有）')}`; } catch (e) { return '<span class="no">✘ ' + esc(aiErrText(e)) + '</span>'; } }
/* AI 用量（今天）：Google 不提供剩餘額度查詢，這裡是這支手機的使用次數 */
function aiUsageCard() {
  if (!S.aikey) return ''; const m = S.aiM || {}, rows = [['Flash-Lite', m.lite], ['Flash', m.flash]].filter(x => x[1]);
  const log = AILOG.list();
  return `<div class="setR col"><div class="t"><b>今天的 AI 用量</b><small>每天 ${AIQ.resetAt()} 重置（太平洋時間午夜）。Google 沒有提供查詢剩餘額度的方式，這裡是這支手機自己記錄的次數；上限是免費版的常見額度，碰到 Google 的額度錯誤時會改用 Google 回報的數字。同一個 Gemini 專案在其他地方用掉的次數不會算進來。</small></div>
    ${rows.length ? rows.map(([n, id]) => { const l = AIQ.lim(id), u = Math.min(AIQ.used(id), l), bl = AIQ.blocked(id), pct = Math.min(100, Math.round((bl ? l : u) / l * 100)); return `<div class="quota"><div class="row"><b class="grow">${n}</b><span class="small">${bl ? '<span style="color:var(--danger)">今天已用完</span>' : `已用 ${u} / ${AIQ.limKnown(id) ? '' : '約 '}${l} 次・剩 ${AIQ.left(id)}`}</span></div><div class="prog"><i style="width:${pct}%;${bl || pct > 85 ? 'background:var(--danger)' : ''}"></i></div></div>`; }).join('') : '<div class="small muted">按上方「測試金鑰」後會顯示可用的模型。</div>'}
    <div class="row wrap"><button class="btn sm" data-a="aiStudio">在 AI Studio 看正式用量 ↗</button>${log.length ? '<button class="btn sm" data-a="aiLog">查看最近 AI 紀錄</button>' : ''}</div>
    <div id="aiLogBox" class="hide aiLog">${log.map(x => `<div class="${x.ok ? '' : 'bad'}"><b>${x.ok ? '✔' : '✘'} ${esc(x.kind)}</b>${x.place ? '・' + esc(x.place) : ''}<br><span class="muted">${new Date(x.t).toLocaleString('zh-TW', {hour12: false}).slice(5, -3)}・${esc(x.model ? aiShort(x.model) : '')}・${Math.round((x.ms || 0) / 1000)} 秒${x.ok ? '・' + (x.n || 0) + ' 項' : ''}</span>${x.err ? '<br>' + esc(x.err) : ''}${x.note ? '<br>' + esc(x.note) : ''}</div>`).join('')}</div></div>`;
}

/* ---------- 金鑰圖文教學 ---------- */
const mock = (url, inner, g) => `<div class="mock"><div class="bar ${g ? 'g' : ''}"><i></i><i></i><i></i><span class="url">${url}</span></div><div class="bd">${inner}</div></div>`;
const TUT = {
  maps: {title: 'Google 地圖搜尋金鑰 · 圖文教學', key: 'gkey', steps: [
    {t: '這把金鑰是做什麼的？', h: mock('日日帳本', '<div class="inp">🔍 HEN厚食早午餐</div><div class="card2"><b>HEN厚食早午餐</b><div class="lbl">早午餐餐廳 · 距離 350 公尺</div></div><div class="card2">🕒 星期一: 06:00 – 13:00<div class="lbl">營業時間自動帶入</div></div>', 1) +
      '<p>填入 <b>Google Maps 金鑰</b>後，搜尋地點就會和 Google 地圖一樣準確，加入收藏時還會<b>自動帶入地址、營業時間、電話</b>。</p><div class="callout">💡 如果你已經在<b>行跡導航</b>設定過 Google 金鑰，直接把同一把金鑰貼過來就可以了，不用重新申請——請直接跳到最後一步。</div><div class="callout warn">Google 會要求綁定信用卡做身分驗證，並提供每月免費用量；一般個人使用通常不會超過。實際收費方式請以 Google 官方說明為準。</div>'},
    {t: '建立一個專案', url: 'https://console.cloud.google.com/projectcreate', btn: '開啟 Google Cloud Console', h: mock('console.cloud.google.com/projectcreate', '<b>新增專案</b><div class="lbl">專案名稱</div><div class="inp">MyFoodMap</div><div class="lbl">位置</div><div class="inp">無機構</div><span class="b hl">建立<span class="tap">👆</span></span><span class="b o">取消</span>') +
      '<p>按下方按鈕開啟 Google Cloud Console，用你的 Google 帳號登入。</p><ul><li>「專案名稱」隨意取，例如 <b>MyFoodMap</b></li><li>按「<b>建立</b>」，等右上角通知顯示完成</li></ul>'},
    {t: '設定帳單帳戶', url: 'https://console.cloud.google.com/billing', btn: '開啟「帳單」頁面', h: mock('console.cloud.google.com/billing', '<b>帳單</b><div class="card2">這個專案沒有帳單帳戶<br><span class="b hl">連結帳單帳戶<span class="tap">👆</span></span></div><div class="lbl">依畫面指示填寫國家、付款資料（信用卡）</div>') +
      '<p>Google 地圖平台必須先有帳單帳戶才能使用。</p><ul><li>按「<b>連結帳單帳戶</b>」或「建立帳單帳戶」</li><li>依畫面填寫付款資料完成驗證</li></ul><div class="callout">建議在「預算與快訊」設定一個小額預算提醒，用量異常時會寄信通知你。</div>'},
    {t: '啟用 Places API (New)', url: 'https://console.cloud.google.com/apis/library/places.googleapis.com', btn: '開啟 Places API (New) 頁面', h: mock('console.cloud.google.com/apis/library/places.googleapis.com', '<div class="row" style="gap:.6rem"><span style="font-size:1.8rem">📍</span><div><b>Places API (New)</b><div class="lbl" style="margin:0">Google Enterprise API</div></div></div><span class="b hl">啟用<span class="tap">👆</span></span><span class="b o">試用這個 API</span>') +
      '<p>確認畫面上方選到的是剛剛建立的專案，然後按「<b>啟用</b>」。</p><div class="callout warn">請認明名稱是 <b>Places API (New)</b>，不是舊版的「Places API」。</div>'},
    {t: '建立 API 金鑰', url: 'https://console.cloud.google.com/apis/credentials', btn: '開啟「憑證」頁面', h: mock('console.cloud.google.com/apis/credentials', '<b>憑證</b><div><span class="b hl">＋ 建立憑證<span class="tap">👆</span></span></div><div class="card2">▸ <b>API 金鑰</b> ← 選這個<div class="lbl" style="margin:0">▸ OAuth 用戶端 ID　▸ 服務帳戶</div></div><div class="lbl">已建立的 API 金鑰</div><div class="key">AIzaSyD••••••••••••••••••••••••••• 📋</div>') +
      '<ul><li>按上方「<b>＋ 建立憑證</b>」→ 選「<b>API 金鑰</b>」</li><li>畫面會出現一串以 <b>AIza</b> 開頭的文字，按 📋 <b>複製</b>起來</li></ul>'},
    {t: '（建議）限制金鑰用途', url: 'https://console.cloud.google.com/apis/credentials', btn: '開啟「憑證」頁面', h: mock('console.cloud.google.com/apis/credentials/key', '<b>應用程式限制</b><div class="chk on"><i></i>無</div><b>API 限制</b><div class="chk on"><i></i>限制金鑰</div><div class="card2 hl"><div class="chk on"><i></i>Places API (New)</div></div><span class="b">儲存</span>') +
      '<p>點一下剛建立的金鑰名稱進入設定：</p><ul><li>「應用程式限制」選「<b>無</b>」</li><li>「API 限制」選「<b>限制金鑰</b>」，只勾選 <b>Places API (New)</b></li><li>按「儲存」</li></ul><div class="callout">這樣即使金鑰外流，也只能拿來做地點搜尋。與行跡導航共用金鑰的話，記得保留那邊需要的 API。</div>'},
    {t: '把金鑰貼到這裡', paste: true, h: '<p>把剛剛複製的金鑰貼到下面，按「測試金鑰」確認可以使用。</p>'}]},
  ai: {title: 'AI 圖片辨識金鑰 · 圖文教學', key: 'aikey', steps: [
    {t: '這把金鑰是做什麼的？', h: mock('日日帳本', '<div class="row" style="gap:.5rem;align-items:stretch"><div class="card2" style="flex:1;text-align:center;margin:0">🖼️<div class="lbl" style="margin:0">菜單照片</div></div><div style="align-self:center">➜ ✨ ➜</div><div class="card2" style="flex:1.4;margin:0;font-size:.72rem"><b>品項｜品名｜價格</b><br>漢堡｜熱狗蛋｜$40<br>吐司｜玉米蛋｜$35</div></div>', 1) +
      '<p><b>Gemini 金鑰</b>讓 App 可以用 Google 的 AI 把<b>菜單照片</b>轉成「品項／品名／價格」表格，也能把<b>食譜截圖</b>轉成食材表與步驟。</p><div class="callout">Google AI Studio 提供免費額度，申請不需要信用卡，個人使用通常很夠用。免費額度與規則以 Google 官方說明為準。</div><div class="callout warn">辨識時，圖片會傳送到 Google 的 AI 服務處理。</div>'},
    {t: '開啟 Google AI Studio', url: 'https://aistudio.google.com/apikey', btn: '開啟 Google AI Studio', h: mock('aistudio.google.com/apikey', '<b>API keys</b><div class="lbl">用 Google 帳號登入，第一次使用請勾選同意條款</div><span class="b hl">🔑 Create API key<span class="tap">👆</span></span><div class="ln" style="width:70%"></div><div class="ln" style="width:45%"></div>') +
      '<p>按下方按鈕開啟 Google AI Studio 並登入 Google 帳號。</p><ul><li>按右上角「<b>Create API key</b>（建立 API 金鑰）」</li><li>如果詢問專案，選剛才建立的專案，或讓它自動建立新專案</li></ul>'},
    {t: '複製金鑰', url: 'https://aistudio.google.com/apikey', btn: '開啟 Google AI Studio', h: mock('aistudio.google.com/apikey', '<b>API key created</b><div class="key">AIzaSyB••••••••••••••••••••••••</div><span class="b hl">Copy<span class="tap">👆</span></span>') +
      '<p>金鑰建立後會顯示一串以 <b>AIza</b> 開頭的文字，按「<b>Copy</b>」複製。</p><div class="callout warn">金鑰等同密碼，請不要分享給別人或貼到公開的地方。</div>'},
    {t: '把金鑰貼到這裡', paste: true, h: '<p>把剛剛複製的金鑰貼到下面，按「測試金鑰」確認可以使用。</p>'}]}
};
function openTutorial(kind) {
  const T = TUT[kind]; let i = 0, dir = 1; const sh = sheet({title: T.title, full: true, foot: '<button class="btn" data-a="prev">‹ 上一步</button><button class="btn pri" data-a="next">下一步 ›</button>', onClose() { if (curTab === 'Set') renderSet(); }});
  const render = () => { const s = T.steps[i], last = i === T.steps.length - 1;
    sh.body.innerHTML = `<div class="tut ${dir < 0 ? 'back' : 'fwd'}"><div class="tutDots">${T.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div class="tutStep">步驟 ${i + 1} / ${T.steps.length}</div><h2>${s.t}</h2>${s.h}
      ${s.paste ? `<div class="keyBox"><input id="tK" value="${esc(S[T.key])}" placeholder="在這裡貼上金鑰（AIza…）" autocomplete="off"><button class="btn sm" data-a="paste">貼上</button></div><div style="margin:.7rem 0"><button class="btn olive block" data-a="test">測試金鑰</button></div><div class="testOut" id="tOut"></div>` : ''}
      ${s.url ? `<button class="btn pri block" data-a="go" style="margin-top:.8rem">${s.btn} ↗</button><div class="small muted" style="text-align:center;margin-top:.4rem">會用瀏覽器開啟，完成後回到這裡按「下一步」</div>` : ''}</div>`;
    sh.body.scrollTop = 0; $('[data-a="prev"]', sh.foot).disabled = i === 0; $('[data-a="next"]', sh.foot).textContent = last ? '完成' : '下一步 ›'; };
  render();
  sh.foot.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(8); if (b.dataset.a === 'prev') { if (i > 0) i--; dir = -1; render(); } else if (i < T.steps.length - 1) { i++; dir = 1; render(); } else sh.close(); });
  sh.body.addEventListener('input', e => { if (e.target.id === 'tK') { S[T.key] = e.target.value.trim(); if (kind === 'maps') GPC.clear(); saveS(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'go') openUrl(T.steps[i].url);
    else if (a === 'paste') { try { const t = (IS_APP && NB.paste ? NB.paste() : await navigator.clipboard.readText()).trim(); if (!t) throw 0; if (t) { $('#tK', sh.body).value = t; S[T.key] = t; saveS(); } } catch (er) { toast('請長按輸入框選「貼上」'); $('#tK', sh.body).focus(); } }
    else if (a === 'test') { const o = $('#tOut', sh.body); o.innerHTML = '測試中…'; o.innerHTML = kind === 'maps' ? await testG() : await testA(); } });
}
function welcome() {
  const sh = sheet({title: '歡迎使用 日日帳本', full: true, foot: '<button class="btn pri" data-a="go">開始使用</button>', onClose() { if (!S.onboard) { S.onboard = true; saveS(); } }});
  sh.body.innerHTML = `<div class="gHero" style="margin-top:.2rem"><div class="gIcon">${APP_ICON}</div><h2 style="font-size:1.35rem;font-weight:800;margin:.2rem 0 0">日日帳本</h2><span class="muted small">吃什麼、買什麼、誰付多少，每天都記在這一本</span></div>
    <div class="h3">📘 圖解使用說明（第一次用請先看）</div>
    <div class="gPick"><button data-g="food"><i>🍽️</i><b>地圖・日常・食譜</b><small>找店收藏、AI 菜單表格、記一餐誰付多少、購物清單、食譜</small><span>看說明 ›</span></button>
      <button data-g="shop"><i>🛒</i><b>購物分帳</b><small>全聯、超商、Foodpanda 明細拍照，AI 讀出品項折扣，自動分帳</small><span>看說明 ›</span></button>
      <button data-g="inv" class="wide"><i>🎫</i><b>發票</b><small>手機條碼、掃發票 QR Code、匯入發票大師、協助工具讀取，一鍵拿去分帳</small><span>看說明 ›</span></button></div>
    <div class="h3">🔑 建議先完成的設定</div>
    <div class="row wrap" style="gap:.5rem"><button class="btn olive grow" data-t="ai">AI 辨識金鑰教學</button><button class="btn grow" data-t="maps">Google 搜尋金鑰教學</button></div>
    <div class="small muted" style="margin-top:.6rem">不設定也可以先使用；之後隨時能到「設定」頁完成，或在「設定 → 使用說明」再看一次。</div>`;
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-g],[data-t]'); if (!b) return; if (b.dataset.g) openGuide(b.dataset.g); else openTutorial(b.dataset.t); }); sh.foot.onclick = () => sh.close();
}

/* ---------- 備份 ---------- */
async function saveFile(name, blob) {
  if (IS_APP && NB.saveBegin) { if (!NB.saveBegin(name, blob.type || 'application/octet-stream')) throw new Error('無法建立檔案'); const CH = 3 * 256 * 1024;
    for (let o = 0; o < blob.size; o += CH) { if (!NB.saveChunk(await blobB64(blob.slice(o, o + CH)))) throw new Error('寫入檔案失敗'); } const p = NB.saveEnd(); if (!p) throw new Error('儲存檔案失敗'); return p; }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); return name;
}
/* 整個日日帳本打包成一個 JSON（含所有圖片）：本機匯出、雲端備份共用 */
/* 備份內容：收藏地點、菜單、點餐、分帳、發票、記帳（常用紀錄、帳戶、對帳、商家）、資產、購物清單、食譜、所有分類與設定、所有圖片；
   自己輸入的 Google Maps／AI 金鑰也一起備份（傳給別人時可以不帶）。只有雲端登入狀態和記帳密碼不備份（綁在這支手機）。 */
const BACKUP_WHAT = '收藏地點與菜單、點餐、分帳、發票、記帳（常用紀錄、帳戶、對帳、商家）、資產、購物清單、食譜、分類、所有設定、API 金鑰和所有圖片';
async function makeBackupBlob(opt = {}) {
  const Sx = Object.assign({}, S); delete Sx.gkey; delete Sx.aikey; delete Sx.pc; delete Sx.gd;
  const apik = opt.noKeys ? null : {gkey: S.gkey || '', aikey: S.aikey || ''}, cs = await IDB.get('kv', 'cats_shop').catch(() => null);
  const parts = [`{"app":"shiguang-foodmap","v":1,"t":${Date.now()},"S":${JSON.stringify(Sx)},"cats":${JSON.stringify(DB.side.food.cats)},"shared1":1,"bills":${JSON.stringify(DB.bills || {})},"scfg":${JSON.stringify(DB.scfg || null)},"invs":${JSON.stringify(DB.invs || {})},"lists":${JSON.stringify(DB.lists || {})},"acc":${JSON.stringify(DB.acc || null)},"rcats":${JSON.stringify(DB.rcats)},"places":${JSON.stringify(DB.side.food.places)},"recipes":${JSON.stringify(DB.recipes)},"mcfg":${JSON.stringify(DB.mcfg || null)},"days":${JSON.stringify(DB.days || {})},"keys":${JSON.stringify(apik)},"cats_shop":${JSON.stringify(cs || null)},"imgs":{`];
  const keys = await IDB.keys('imgs'); let n = 0; for (const k of keys) { const r = await IDB.get('imgs', k); if (!r) continue; parts.push((n++ ? ',' : '') + JSON.stringify(k) + ':' + JSON.stringify({type: r.type, w: r.w, h: r.h, d: await blobB64(new Blob([r.buf]))})); }
  parts.push('}}'); return new Blob(parts, {type: 'application/json'});
}
const backupName = () => { const d = new Date(); return `日日帳本備份_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.json`; };
async function exportBackup() {
  busy('整理備份資料…'); try { const blob = await makeBackupBlob(), nm = backupName();
    const p = await saveFile(nm, blob); busy(false); toast(IS_APP ? '已匯出到「下載」資料夾：' + p : '已下載備份檔 ' + nm, 4000);
  } catch (e) { busy(false); toast('❌ 匯出失敗：' + e.message, 4000); }
}
/* 用備份取代目前的資料（本機匯入、雲端還原共用） */
async function applyBackup(j, keepCloud) {
  if (!/^shiguang/.test(j.app || '') || !Array.isArray(j.places)) throw new Error('這不是日日帳本的備份檔');
  for (const s of ['places', 'recipes', 'imgs']) await IDB.clear(s);
  const b64buf = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  for (const k in j.imgs || {}) { const r = j.imgs[k]; await IDB.put('imgs', k, {buf: b64buf(r.d), type: r.type || 'image/jpeg', w: r.w, h: r.h}); }
  for (const p of j.places) await IDB.put('places', p.id, p); for (const r of j.recipes || []) await IDB.put('recipes', r.id, r);
  await IDB.put('kv', 'cats', j.cats || []); if (j.rcats) await IDB.put('kv', 'rcats', j.rcats); if (j.mcfg) await IDB.put('kv', 'mcfg', j.mcfg); await IDB.put('kv', 'days', j.days || {}); if (j.cats_shop) await IDB.put('kv', 'cats_shop', j.cats_shop); await IDB.put('kv', 'bills', j.bills || {}); if (j.scfg) await IDB.put('kv', 'scfg', j.scfg); if (j.shared1) await IDB.put('kv', 'shared1', 1); else await IDB.del('kv', 'shared1').catch(() => {}); if (j.invs) await IDB.put('kv', 'invs', j.invs); if (j.lists) await IDB.put('kv', 'lists', j.lists); if (j.acc) await IDB.put('kv', 'acc', j.acc);
  const K = j.keys || {}; await IDB.put('kv', 'S', Object.assign({}, S_DEF, j.S || {}, {gkey: S.gkey || K.gkey || '', aikey: S.aikey || K.aikey || '', pc: S.pc, gd: S.gd, onboard: true}));
}
function importBackup() { const f = $('#jsonPick'); f.value = ''; f.onchange = async () => { const file = f.files[0]; if (!file) return;
  try { busy('讀取備份檔…'); const j = JSON.parse(await file.text()); busy(false); if (!/^shiguang/.test(j.app || '') || !Array.isArray(j.places)) throw new Error('這不是日日帳本的備份檔');
    if (!await ask(`備份檔內有 ${j.places.length} 間收藏、${(j.recipes || []).length} 道食譜${j.acc ? '、' + (j.acc.recs || []).length + ' 筆記帳' : ''}。\n匯入後會「取代」目前這台裝置上的所有資料，確定嗎？`, '匯入並取代', true)) return; busy('匯入中…');
    await applyBackup(j); location.reload();
  } catch (e) { busy(false); toast('❌ 匯入失敗：' + (e instanceof SyntaxError ? '檔案格式不正確' : e.message), 4500); } }; f.click(); }


/* ============================================================
   分享食譜：圖片、QR Code、連結（QR 的內容就是連結：一般手機相機掃會打開網頁版看食譜，用日日帳本掃可以直接加入）
   食譜內容壓縮後放在網址的 #r= 後面，不經過任何伺服器；封面照片只放在「圖片」分享
   ============================================================ */
const recText = r => { const P = r.portions || []; return `${r.title}\n${r.type === 'ratio' ? '' : '份數：' + (r.serv || '') + '\n'}\n【食材】\n${r.type === 'ratio' ? '食材｜' + P.join('｜') + '\n' + (r.ing || []).map(i => i.n + '｜' + P.map((_, j) => (i.q || [])[j] || '—').join('｜')).join('\n') : (r.ing || []).map(i => `${i.n}　${i.q}`).join('\n')}${(r.steps || []).length ? '\n\n【步驟】\n' + r.steps.map((x, i) => `${i + 1}. ${x}`).join('\n') : ''}${r.note ? '\n\n【備註】\n' + r.note : ''}`; };
const recPack = r => { const o = {t: r.title || '', i: (r.ing || []).map(x => [x.n || '', x.q == null ? '' : x.q]), st: (r.steps || []).filter(Boolean)}; if (r.type === 'ratio') { o.y = 'ratio'; o.p = r.portions || []; } if (r.serv) o.s = r.serv; if (r.note) o.n = r.note; return o; };
const recUnpack = o => ({id: '', type: o.y === 'ratio' ? 'ratio' : 'std', title: String(o.t || '分享的食譜'), serv: o.s || '', portions: o.y === 'ratio' ? (o.p || []) : undefined, ing: (o.i || []).map(([n, q]) => ({n, q})), steps: o.st || [], note: o.n || '', cover: '', cat: ''});
async function b64uZip(str) { const st = new Blob([new TextEncoder().encode(str)]).stream().pipeThrough(new CompressionStream('deflate-raw')), u = new Uint8Array(await new Response(st).arrayBuffer()); let b = ''; for (let i = 0; i < u.length; i++) b += String.fromCharCode(u[i]); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function b64uUnzip(t) { const b = atob(t.replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const st = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new TextDecoder().decode(await new Response(st).arrayBuffer()); }
const recLink = async r => GH.pages + '#r=' + await b64uZip(JSON.stringify(recPack(r)));
async function recOpenLink(u) { const m = String(u || '').match(/[#&?]r=([A-Za-z0-9_-]+)/) || String(u || '').match(/recipe\/([A-Za-z0-9_-]+)/); if (!m) { toast('這不是日日帳本的食譜連結'); return; }
  let r; try { r = recUnpack(JSON.parse(await b64uUnzip(m[1]))); } catch (e) { toast('食譜連結不完整，請對方重新傳一次'); return; } recImport(r, m[1]); }
/* 收到別人分享的食譜：先預覽，按「加入我的食譜」才存 */
function recImport(r, code) { buzz(20);
  const sh = sheet({title: '📖 朋友分享的食譜', full: true, foot: `${!IS_APP && code ? `<button class="btn" data-a="app">📱 用 App 打開</button>` : ''}<button class="btn pri" data-a="add">📥 加入我的食譜</button>`});
  const P = r.portions || [];
  sh.body.innerHTML = `<article class="recipe"><h2>${esc(r.title)}</h2><div class="serv">${r.type === 'ratio' ? '份量比例表' : '份數：' + esc(r.serv || '—')}</div>
    ${r.type === 'ratio' ? `<div class="rtWrap"><table class="rtable ratio"><thead><tr><th>食材</th>${P.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${r.ing.map(i => `<tr><td>${esc(i.n)}</td>${P.map((_, j) => `<td>${esc((i.q || [])[j] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<table class="rtable"><thead><tr><th style="width:50%">食材</th><th>數量</th></tr></thead><tbody>${r.ing.map(i => `<tr><td>${esc(i.n)}</td><td>${esc(i.q)}</td></tr>`).join('')}</tbody></table>`}
    <h3>步驟</h3>${r.steps.length ? `<ol>${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<p class="muted">（沒有步驟）</p>'}${r.note ? `<h3>備註</h3><div class="note">${esc(r.note)}</div>` : ''}</article>`;
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10);
    if (b.dataset.a === 'app') { location.href = `intent://recipe/${code}#Intent;scheme=ririzb;package=com.ian.foodmap;end`; return; }
    const same = DB.recipes.find(x => x.title === r.title); if (same && !await ask(`已經有一道「${r.title}」了，還是要再加一份嗎？`, '加入')) return;
    const n = Object.assign({}, r, {id: 'r' + uid(), ord: DB.recipes.length, t: Date.now()}); if (n.type !== 'ratio') delete n.portions; DB.recipes.push(n); await saveRecipe(n);
    sh.close(); if (location.hash.includes('r=')) history.replaceState(null, '', location.pathname); toast(`✅ 已加入「${n.title}」`); showTab('Rec'); renderRec(); setTimeout(() => viewRecipe(n.id), 250); }; }
/* 分享方式選單 */
function shareRecipe(r) {
  const sh = sheet({title: `📤 分享「${r.title || '食譜'}」`}); sh.body.innerHTML = `<div class="shareCh">
    <button class="card" data-s="img"><i>🖼️</i><b>圖片</b><small>整份食譜做成一張圖</small></button><button class="card" data-s="qr"><i>🔳</i><b>QR Code</b><small>給朋友掃，或存成圖片</small></button>
    <button class="card" data-s="link"><i>🔗</i><b>傳送連結</b><small>LINE、訊息都能傳</small></button><button class="card" data-s="txt"><i>📋</i><b>複製文字</b><small>貼到任何地方</small></button></div>
    <div class="small muted" style="margin-top:.7rem">QR Code 和連結裡就是食譜內容，不會上傳到任何地方；封面照片只會放在「圖片」裡。朋友用日日帳本掃描或打開連結，就能直接加入他的食譜。</div>`;
  sh.body.onclick = async e => { const b = e.target.closest('[data-s]'); if (!b) return; buzz(10); const k = b.dataset.s; sh.close();
    if (k === 'txt') { copyText(recText(r)); return; }
    if (k === 'img') { recShareImg(r); return; }
    const url = await recLink(r), txt = `🍳 ${r.title}（日日帳本食譜）\n${url}`;
    if (k === 'link') { if (IS_APP && NB.share) NB.share(txt); else if (navigator.share) navigator.share({title: r.title, text: txt}).catch(() => {}); else copyText(url); return; }
    recShareQr(r, url, txt); }; }
/* 共用的「預覽圖片＋分享／存相簿」畫面 */
function recImgSheet(title, png, name, txt, extra) {
  const sh = sheet({title, full: true, foot: `<div class="qrFoot ${extra ? '' : 'two'}"><button class="btn pri" data-q="share">📤 分享圖片</button><button class="btn" data-q="save">💾 存到相簿</button>${extra ? `<button class="btn" data-q="copy">🔗 複製連結</button>` : ''}</div>`});
  sh.body.innerHTML = `<div class="qrCardW"><img src="${png}" alt=""></div>`;
  sh.foot.onclick = async e => { const b = e.target.closest('[data-q]'); if (!b) return; buzz(10); const q = b.dataset.q, b64 = png.split(',')[1];
    if (q === 'copy') { copyText(extra); return; }
    if (IS_APP && NB.shareImg) { const ok = NB.shareImg(b64, name, q === 'share' ? txt : '', q === 'share'); if (q === 'save') toast(ok ? '💾 已存到相簿（圖片／日日帳本）' : '存檔失敗'); return; }
    const blob = await (await fetch(png)).blob(), file = new File([blob], name, {type: 'image/png'});
    if (q === 'share' && navigator.canShare && navigator.canShare({files: [file]})) { navigator.share({files: [file], text: txt}).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = png; a.download = name; a.click(); }; }
async function recShareImg(r) { busy('產生圖片…'); try {
    let cov = ''; if (r.cover) { const bl = await imgBlob(r.cover); if (bl) cov = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(bl); }); }
    const P = r.portions || [], E = esc, tb = r.type === 'ratio' ? `<table><tr><th>食材</th>${P.map(x => `<th>${E(x)}</th>`).join('')}</tr>${(r.ing || []).map(i => `<tr><td>${E(i.n)}</td>${P.map((_, j) => `<td>${E((i.q || [])[j] || '—')}</td>`).join('')}</tr>`).join('')}</table>`
      : `<table><tr><th>食材</th><th>數量</th></tr>${(r.ing || []).map(i => `<tr><td>${E(i.n)}</td><td>${E(i.q)}</td></tr>`).join('')}</table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f6eddc;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;color:#3b2b1d}
      .c{margin:0 34px;background:#fffaf0;border:1px solid #e3d3b8;border-radius:8px;overflow:hidden}.cv{width:100%;max-height:520px;object-fit:cover;display:block}.in{padding:26px 30px 24px}
      h1{font-size:40px;margin:0 0 6px}.m{color:#8a7560;font-size:19px;margin-bottom:18px}h2{font-size:23px;color:#5a7a3a;margin:22px 0 10px;border-bottom:2px solid #e8dcc6;padding-bottom:6px}
      table{width:100%;border-collapse:collapse;font-size:20px}th{text-align:left;background:#efe4cf;padding:8px 12px}td{padding:8px 12px;border-bottom:1px solid #eee3d1}
      ol{margin:0;padding-left:30px;font-size:20px;line-height:1.65}li{margin:4px 0}.n{background:#f6efe2;border-radius:6px;padding:12px 14px;font-size:19px;white-space:pre-wrap}
      .f{text-align:center;color:#8a7560;font-size:17px;padding:16px 0 4px}</style></head><body><div class="c">${cov ? `<img class="cv" src="${cov}">` : ''}<div class="in"><h1>${E(r.title || '食譜')}</h1>
      <div class="m">${r.type === 'ratio' ? '份量比例表' : '份數：' + E(r.serv || '—')}</div><h2>🥕 食材</h2>${tb}${(r.steps || []).length ? `<h2>👩‍🍳 步驟</h2><ol>${r.steps.map(x => `<li>${E(x)}</li>`).join('')}</ol>` : ''}${r.note ? `<h2>📝 備註</h2><div class="n">${E(r.note)}</div>` : ''}</div></div><div class="f">— 日日帳本・我的食譜 —</div></body></html>`;
    const [c] = await renderPages(html, false), png = c.toDataURL('image/png'); busy(false);
    recImgSheet('🖼️ 食譜圖片', png, `食譜_${(r.title || '').replace(/[\\/:*?"<>|\s]+/g, '_')}.png`, `🍳 ${r.title}`); } catch (e) { busy(false); toast('❌ 產生圖片失敗：' + e.message, 3500); } }
async function recShareQr(r, url, txt) {
  let q; try { q = qrcode(0, 'L'); q.addData(url); q.make(); } catch (e) { toast('這份食譜太長，QR Code 放不下，請改用「傳送連結」或「圖片」', 4500); return; }
  const n = q.getModuleCount(), W = 1080, H = 1420, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  g.fillStyle = '#f6eddc'; g.fillRect(0, 0, W, H); g.fillStyle = '#fffaf0'; g.strokeStyle = '#e3d3b8'; g.lineWidth = 3; g.fillRect(70, 70, W - 140, H - 140); g.strokeRect(70, 70, W - 140, H - 140);
  g.textAlign = 'center'; g.fillStyle = '#3b2b1d'; g.font = `900 64px ${F}`; let t = r.title || '食譜'; while (g.measureText(t).width > W - 220 && t.length > 2) t = t.slice(0, -2) + '…'; g.fillText(t, W / 2, 190);
  g.fillStyle = '#8a7560'; g.font = `500 34px ${F}`; g.fillText(`${(r.ing || []).length} 種食材・${(r.steps || []).length} 個步驟`, W / 2, 250);
  const side = 760, cell = Math.floor(side / (n + 2)), qs = cell * n, x0 = (W - qs) / 2, y0 = 300 + (side - qs) / 2; g.fillStyle = '#fff'; g.fillRect(x0 - cell, y0 - cell, qs + cell * 2, qs + cell * 2);
  g.fillStyle = '#2b1f15'; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) g.fillRect(x0 + x * cell, y0 + y * cell, cell + .5, cell + .5);
  g.fillStyle = '#5a7a3a'; g.font = `800 40px ${F}`; g.fillText('📷 用日日帳本掃描，直接加入食譜', W / 2, 1160);
  g.fillStyle = '#8a7560'; g.font = `500 30px ${F}`; g.fillText('食譜 → ＋ 新增 → 掃描朋友分享的食譜', W / 2, 1215); g.fillText('一般相機掃描會打開網頁版食譜', W / 2, 1262);
  recImgSheet('🔳 食譜 QR Code', cv.toDataURL('image/png'), `食譜QR_${(r.title || '').replace(/[\\/:*?"<>|\s]+/g, '_')}.png`, txt, url); }
