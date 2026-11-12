/* ============================================================
   食譜、設定、金鑰圖文教學、備份、啟動
   ============================================================ */
let curTab = 'Map';
function showTab(t) { curTab = t; $$('.page').forEach(p => p.classList.toggle('on', p.id === 'pg' + t)); $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'Map') mapResize(); else if (t === 'Fav') renderFav(); else if (t === 'Rec') renderRec(); else renderSet(); updCounts(); }

/* ---------- 食譜 ---------- */
async function renderRec() {
  const q = $('#recQ').value.trim().toLowerCase(), box = $('#recList');
  const list = DB.recipes.filter(r => !q || (r.title + ' ' + (r.ing || []).map(i => i.n).join(' ') + ' ' + (r.note || '')).toLowerCase().includes(q));
  const covers = await Promise.all(list.map(r => imgURL(r.cover)));
  box.innerHTML = list.map((r, i) => `<button class="rc" data-id="${r.id}"><div class="cov" ${covers[i] ? `style="background-image:url('${covers[i]}')"` : ''}>${covers[i] ? '' : '🍲'}</div><div class="inf"><b>${esc(r.title || '未命名食譜')}</b><small>${esc(r.serv || '')}${r.serv ? ' · ' : ''}${(r.ing || []).length} 種食材 · ${(r.steps || []).length} 個步驟</small></div></button>`).join('');
  if (!list.length) box.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="big">📖</span>${q ? '找不到符合的食譜' : '還沒有食譜<br><span class="small">按右上角「＋ 新增」，或用「✨ 圖片匯入」把食譜截圖變成表格</span>'}</div>`;
  box.dataset.q = q;
}
function initRec() {
  $('#recQ').addEventListener('input', debounce(renderRec, 150)); $('#recAdd').onclick = () => editRecipe({id: '', title: '', serv: '', ing: [{n: '', q: ''}], steps: [''], note: '', cover: ''}, true);
  $('#recAI').onclick = aiRecipe;
  $('#recList').addEventListener('click', e => { const b = e.target.closest('.rc'); if (b) viewRecipe(b.dataset.id); });
  sortable($('#recList'), {item: '.rc', axis: 'grid', scroller: '.pgBody', onSort(from, to) { if ($('#recList').dataset.q) return; moveItem(DB.recipes, from, to); DB.recipes.forEach((r, i) => { if (r.ord !== i) { r.ord = i; saveRecipe(r); } }); renderRec(); }});
}
function viewRecipe(id) {
  const r = DB.recipes.find(x => x.id === id); if (!r) return; const sh = sheet({title: '食譜', full: true}); sh.tools.innerHTML = '<button class="btn sm" data-a="copy">複製文字</button><button class="btn sm" data-a="edit">✎ 編輯</button>';
  const render = async () => { const cov = await imgURL(r.cover);
    sh.body.innerHTML = `<article class="recipe">${cov ? `<img class="cover" src="${cov}" alt="">` : ''}<h2>${esc(r.title || '未命名食譜')}</h2><div class="serv">份數：${esc(r.serv || '—')}</div>
      <table class="rtable"><thead><tr><th style="width:50%">食材</th><th>數量</th></tr></thead><tbody>${(r.ing || []).map(i => `<tr><td>${esc(i.n)}</td><td>${esc(i.q)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">（尚未填寫食材）</td></tr>'}</tbody></table>
      <h3>步驟</h3>${(r.steps || []).length ? `<ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '<p class="muted">（尚未填寫步驟）</p>'}${r.note ? `<h3>備註</h3><div class="note">${esc(r.note)}</div>` : ''}</article>`; };
  render();
  sh.tools.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'copy') copyText(`${r.title}\n份數：${r.serv || ''}\n\n【食材】\n${(r.ing || []).map(i => `${i.n}　${i.q}`).join('\n')}\n\n【步驟】\n${(r.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}${r.note ? '\n\n【備註】\n' + r.note : ''}`);
    else editRecipe(r, false, del => { if (del) sh.close(); else render(); }); });
}
function editRecipe(src, isNew, done) {
  const d = JSON.parse(JSON.stringify(src)); d.ing = d.ing && d.ing.length ? d.ing : [{n: '', q: ''}]; d.steps = d.steps && d.steps.length ? d.steps : ['']; let newCover = null;
  const sh = sheet({title: isNew ? '新增食譜' : '編輯食譜', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">儲存</button>`});
  sh.body.innerHTML = `<div class="field"><label>食譜名稱</label><input id="rT" value="${esc(d.title)}" placeholder="例如：高麗菜大阪燒"></div>
    <div class="field"><label>份數</label><input id="rS" value="${esc(d.serv)}" placeholder="例如：一人份、兩人四天份"></div>
    <div class="field"><label>封面照片（可不放）</label><div class="row"><div class="thumbs" id="rCov" style="padding:0"></div><button class="btn sm" data-a="cov">選擇照片</button></div></div>
    <div class="field"><label>食材表（食材／數量）</label><div id="rI" class="noSel"></div><button class="btn sm" data-a="iAdd">＋ 新增食材</button></div>
    <div class="field"><label>製作步驟</label><div id="rP" class="noSel"></div><button class="btn sm" data-a="sAdd">＋ 新增步驟</button></div>
    <div class="field"><label>備註</label><textarea id="rN" rows="2" placeholder="小技巧、替代食材…">${esc(d.note || '')}</textarea></div>`;
  const ingH = () => { $('#rI', sh.body).innerHTML = d.ing.map((x, i) => `<div class="erow" data-i="${i}"><span class="grip"></span><input data-k="n" value="${esc(x.n)}" placeholder="食材"><input data-k="q" value="${esc(x.q)}" placeholder="數量" enterkeyhint="next"><button class="ic del" data-a="iDel" aria-label="刪除">✕</button></div>`).join(''); };
  const stpH = () => { $('#rP', sh.body).innerHTML = d.steps.map((x, i) => `<div class="erow" data-i="${i}"><span class="grip"></span><span class="num">${i + 1}.</span><textarea data-k="s" rows="1" placeholder="步驟 ${i + 1}">${esc(x)}</textarea><button class="ic del" data-a="sDel" aria-label="刪除">✕</button></div>`).join(''); $$('#rP textarea', sh.body).forEach(grow); };
  const grow = t => { t.style.height = 'auto'; t.style.height = Math.max(42, t.scrollHeight + 2) + 'px'; };
  const covH = async () => { const u = newCover ? newCover.url : await imgURL(d.cover); $('#rCov', sh.body).innerHTML = u ? `<div class="th"><img src="${u}" alt=""><button class="rm" data-a="covDel">✕</button></div>` : ''; };
  ingH(); stpH(); covH(); setTimeout(() => $$('#rP textarea', sh.body).forEach(grow), 300);
  sortable($('#rI', sh.body), {item: '.erow', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, t) { moveItem(d.ing, f, t); ingH(); }});
  sortable($('#rP', sh.body), {item: '.erow', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, t) { moveItem(d.steps, f, t); stpH(); }});
  sh.body.addEventListener('input', e => { const t = e.target, row = t.closest('.erow'); if (!row) return; const i = +row.dataset.i; if (t.dataset.k === 's') { d.steps[i] = t.value; grow(t); } else if (t.dataset.k) d.ing[i][t.dataset.k] = t.value; });
  sh.body.addEventListener('keydown', e => { if (e.key !== 'Enter' || e.isComposing) return; const t = e.target; if (t.dataset.k === 'q' && +t.closest('.erow').dataset.i === d.ing.length - 1) { e.preventDefault(); d.ing.push({n: '', q: ''}); ingH(); $$('#rI input[data-k="n"]', sh.body).pop().focus(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, row = b.closest('.erow'), i = row ? +row.dataset.i : -1;
    if (a === 'iAdd') { d.ing.push({n: '', q: ''}); ingH(); $$('#rI input[data-k="n"]', sh.body).pop().focus(); }
    else if (a === 'sAdd') { d.steps.push(''); stpH(); $$('#rP textarea', sh.body).pop().focus(); }
    else if (a === 'iDel') { d.ing.splice(i, 1); if (!d.ing.length) d.ing.push({n: '', q: ''}); ingH(); } else if (a === 'sDel') { d.steps.splice(i, 1); if (!d.steps.length) d.steps.push(''); stpH(); }
    else if (a === 'cov') { const fs = await pickImages(false); if (!fs.length) return; if (newCover) URL.revokeObjectURL(newCover.url); newCover = {file: fs[0], url: URL.createObjectURL(fs[0])}; covH(); }
    else if (a === 'covDel') { if (newCover) { URL.revokeObjectURL(newCover.url); newCover = null; } d.cover = ''; covH(); } });
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`確定要刪除食譜「${src.title}」嗎？`, '刪除', true)) return; await imgDel(src.cover); DB.recipes.splice(DB.recipes.indexOf(src), 1); await IDB.del('recipes', src.id).catch(() => {}); sh.close(); renderRec(); updCounts(); toast('已刪除'); done && done(true); return; }
    d.title = $('#rT', sh.body).value.trim(); d.serv = $('#rS', sh.body).value.trim(); d.note = $('#rN', sh.body).value.trim(); d.ing = d.ing.filter(x => (x.n + x.q).trim()); d.steps = d.steps.map(s => s.trim()).filter(Boolean);
    if (!d.title) { toast('請輸入食譜名稱'); $('#rT', sh.body).focus(); return; }
    busy('儲存中…'); try { if (newCover) { d.cover = await imgStore(newCover.file, 1600); URL.revokeObjectURL(newCover.url); } if (!isNew && src.cover && src.cover !== d.cover) await imgDel(src.cover);
      if (isNew) { d.id = 'r' + uid(); d.t = Date.now(); d.ord = -1; DB.recipes.unshift(d); DB.recipes.forEach((r, i) => { r.ord = i; saveRecipe(r); }); } else { Object.assign(src, d); await saveRecipe(src); } } catch (er) { busy(false); toast('❌ ' + er.message); return; }
    busy(false); sh.close(); renderRec(); updCounts(); toast('已儲存'); done && done(false); });
  if (isNew && !d.title) setTimeout(() => $('#rT', sh.body).focus(), 320);
}
async function aiRecipe() {
  if (!S.aikey) { needAiKey(); return; } const fs = await pickImages(true); if (!fs.length) return;
  busy('AI 正在讀取食譜圖片…'); try { const parts = [{text: RECIPE_PROMPT}]; for (const f of fs.slice(0, 6)) { const id = await imgStore(f, 2400); parts.push(await imgPart(await imgBlob(id))); await imgDel(id); }
    const r = await gemini(parts, RECIPE_SCHEMA); busy(false);
    editRecipe({id: '', title: r.title || '', serv: r.servings || '', ing: (r.ingredients || []).map(x => ({n: String(x.name || ''), q: String(x.amount || '')})), steps: (r.steps || []).map(s => String(s).replace(/^\s*\d+[.、)]\s*/, '')), note: r.note || '', cover: ''}, true);
    toast('✅ 已辨識，請檢查內容後按「儲存」', 3500);
  } catch (e) { busy(false); toast('❌ ' + e.message, 4500); }
}

/* ---------- 設定 ---------- */
function renderSet() {
  const seg = (id, opts, cur) => `<div class="seg" data-seg="${id}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const sw = (id, on) => `<button class="sw2 ${on ? 'on' : ''}" data-sw="${id}" role="switch" aria-checked="${!!on}"></button>`;
  const dark = isDark(), navs = navApps({lat: 0, lon: 0});
  $('#setBody').innerHTML = `
  <div class="setG"><h3>外觀</h3><div class="setC">
    <div class="setR"><div class="t"><b>主題</b></div>${seg('theme', [['auto', '跟隨系統'], ['light', '淺色'], ['dark', '深色']], S.theme)}</div>
    <div class="setR col"><div class="t"><b>重點顏色</b><small>底色維持大地色系，只換按鈕與標題的顏色</small></div><div class="pal">${Object.keys(PALETTES).map(k => `<button data-pal="${k}" class="${S.palette === k ? 'on' : ''}"><i style="--c:${dark ? PALETTES[k].sd : PALETTES[k].sw}"></i>${PALETTES[k].name}</button>`).join('')}</div></div>
    <div class="setR"><div class="t"><b>介面大小</b></div>${seg('scale', [[90, '小'], [100, '標準'], [112, '大'], [125, '特大']], S.scale)}</div>
    <div class="setR"><div class="t"><b>震動回饋</b><small>拖曳排序、點選時輕微震動</small></div>${sw('haptic', S.haptic)}</div></div></div>
  <div class="setG"><h3>地圖與導航</h3><div class="setC">
    <div class="setR"><div class="t"><b>3D 立體地圖</b><small>以傾斜視角顯示立體建築（地圖右側也可切換）</small></div>${sw('map3d', S.map3d)}</div>
    <div class="setR"><div class="t"><b>旗子旁顯示店名</b><small>地圖放大時在旗子旁顯示名稱</small></div>${sw('labels', S.labels)}</div>
    <div class="setR"><div class="t"><b>導航軟體</b><small>按「導航」時要用哪個 App</small></div><select id="sNav"><option value="ask">每次詢問</option>${navs.map(n => `<option value="${n.id}" ${S.navApp === n.id ? 'selected' : ''}>${n.name}</option>`).join('')}</select></div></div></div>
  <div class="setG"><h3>Google 地圖搜尋金鑰</h3><div class="setC">
    <div class="setR col"><div class="t"><small>填入後，搜尋店家會和 Google 地圖一樣準確，並能自動帶入營業時間、電話。${S.gkey ? '' : '<br>沒有金鑰也能用，只是搜尋改用 OpenStreetMap，店家較不齊全。'}<br>💡 行跡導航用的那把金鑰可以直接貼過來共用。</small></div>
      <div class="keyBox"><input id="sG" type="password" value="${esc(S.gkey)}" placeholder="貼上 Google Maps API 金鑰（AIza…）" autocomplete="off"><button class="btn sm" data-a="eyeG">顯示</button></div>
      <div class="row wrap"><button class="btn sm pri" data-a="tutG">📘 圖文教學</button><button class="btn sm" data-a="getG">申請金鑰 ↗</button><button class="btn sm olive" data-a="testG">測試金鑰</button></div><div class="testOut" id="outG"></div></div></div></div>
  <div class="setG"><h3>AI 圖片辨識金鑰（Gemini）</h3><div class="setC">
    <div class="setR col"><div class="t"><small>用來把菜單照片、食譜截圖轉成表格。金鑰可在 Google AI Studio 免費申請。</small></div>
      <div class="keyBox"><input id="sA" type="password" value="${esc(S.aikey)}" placeholder="貼上 Gemini API 金鑰" autocomplete="off"><button class="btn sm" data-a="eyeA">顯示</button></div>
      <div class="row wrap"><button class="btn sm pri" data-a="tutA">📘 圖文教學</button><button class="btn sm" data-a="getA">申請金鑰 ↗</button><button class="btn sm olive" data-a="testA">測試金鑰</button></div><div class="testOut" id="outA"></div></div>
    <div class="setR"><div class="t"><b>AI 模型</b><small>一般保持「自動」即可${S.aiAuto ? '（目前：' + esc(S.aiAuto) + '）' : ''}</small></div><select id="sM"><option value="auto">自動選擇</option>${S.aimodel && S.aimodel !== 'auto' ? `<option selected>${esc(S.aimodel)}</option>` : ''}</select></div></div></div>
  <div class="setG"><h3>收藏分類</h3><div class="setC"><button class="setR" data-a="cats" style="width:100%;text-align:left"><div class="t"><b>管理收藏分類</b><small>自訂名稱、圖示、旗子顏色與排序（共 ${DB.cats.length} 個）</small></div><span class="muted">›</span></button></div></div>
  <div class="setG"><h3>資料備份</h3><div class="setC">
    <div class="setR col"><div class="t"><small id="dbInfo">共 ${DB.places.length} 間收藏、${DB.recipes.length} 道食譜。資料只存在這台裝置裡，換手機或重灌前請先匯出備份。</small></div>
      <div class="row wrap"><button class="btn sm pri" data-a="exp">匯出備份檔</button><button class="btn sm" data-a="imp">匯入備份檔</button><button class="btn sm danger" data-a="wipe">清除所有資料</button></div></div></div></div>
  <div class="setG"><h3>版本與更新</h3><div class="setC" id="updCard">${Upd.card()}</div></div>
  <div class="setG"><h3>關於</h3><div class="setC">
    <button class="setR" data-a="welcome" style="width:100%;text-align:left"><div class="t"><b>使用說明</b><small>再看一次功能介紹</small></div><span class="muted">›</span></button>
    <div class="setR"><div class="t"><b>食光地圖 v${APP_VER}</b><small>${IS_APP ? 'Android App' + (NB.version ? ' · APK v' + NB.version() : '') : '網頁版'}${window.__OTA ? '（已線上更新）' : ''} · 地圖資料 © OpenFreeMap、© OpenStreetMap 貢獻者</small></div></div></div></div>`;
}
function initSet() {
  const box = $('#setBody');
  box.addEventListener('change', e => { const t = e.target; if (t.id === 'sNav') { S.navApp = t.value; saveS(); } else if (t.id === 'sM') { S.aimodel = t.value; saveS(); }
    else if (t.id === 'sG') { S.gkey = t.value.trim(); GPC.clear(); saveS(); } else if (t.id === 'sA') { S.aikey = t.value.trim(); saveS(); } });
  box.addEventListener('input', e => { const t = e.target; if (t.id === 'sG') { S.gkey = t.value.trim(); saveS(); } else if (t.id === 'sA') { S.aikey = t.value.trim(); saveS(); } });
  box.addEventListener('focusin', async e => { if (e.target.id !== 'sM' || e.target.dataset.l || !S.aikey) return; e.target.dataset.l = 1; try { const l = (await aiListModels()).filter(n => /^gemini/.test(n)); const cur = S.aimodel;
    e.target.innerHTML = '<option value="auto">自動選擇</option>' + l.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join(''); } catch (er) {} });
  box.addEventListener('click', async e => {
    const sg = e.target.closest('.seg button'); if (sg) { const k = sg.parentNode.dataset.seg; S[k] = k === 'scale' ? +sg.dataset.v : sg.dataset.v; buzz(8); saveS(); applyTheme(); renderSet(); mapResize(); return; }
    const pal = e.target.closest('[data-pal]'); if (pal) { S.palette = pal.dataset.pal; buzz(8); saveS(); applyTheme(); renderSet(); return; }
    const sw = e.target.closest('[data-sw]'); if (sw) { const k = sw.dataset.sw; S[k] = !S[k]; saveS(); if (S[k]) buzz(15); sw.classList.toggle('on', !!S[k]); sw.setAttribute('aria-checked', !!S[k]);
      if (k === 'map3d' && M.map) M.map.easeTo({pitch: S.map3d ? 55 : 0, duration: 0}); if (k === 'labels' && M.map) M.map.fire('move'); return; }
    const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'eyeG' || a === 'eyeA') { const i = $(a === 'eyeG' ? '#sG' : '#sA'); i.type = i.type === 'password' ? 'text' : 'password'; b.textContent = i.type === 'password' ? '顯示' : '隱藏'; }
    else if (a === 'tutG') openTutorial('maps'); else if (a === 'tutA') openTutorial('ai');
    else if (a === 'getG') openUrl('https://console.cloud.google.com/google/maps-apis/credentials'); else if (a === 'getA') openUrl('https://aistudio.google.com/apikey');
    else if (a === 'testG') { $('#outG').innerHTML = '測試中…'; $('#outG').innerHTML = await testG(); } else if (a === 'testA') { $('#outA').innerHTML = '測試中…'; $('#outA').innerHTML = await testA(); renderSetKeep(); }
    else if (a === 'updChk') Upd.check(true); else if (a === 'updApk') Upd.releases(); else if (a === 'updBack') Upd.restore(); else if (a === 'updShare') Upd.share(); else if (a === 'updWeb') openUrl(GH.pages);
    else if (a === 'cats') openCats(); else if (a === 'exp') exportBackup(); else if (a === 'imp') importBackup(); else if (a === 'welcome') welcome();
    else if (a === 'wipe') { if (await ask('確定要清除「所有」收藏、菜單、食譜與設定嗎？\n這個動作無法復原，建議先匯出備份。', '全部清除', true) && await ask('再確認一次：真的要全部清除嗎？', '清除', true)) { for (const s of ['kv', 'places', 'recipes', 'imgs']) await IDB.clear(s).catch(() => {}); try { localStorage.clear(); } catch (er) {} location.reload(); } } });
}
function renderSetKeep() { const o = $('#outA') ? $('#outA').innerHTML : ''; renderSet(); if ($('#outA')) $('#outA').innerHTML = o; }
async function testG() { if (!S.gkey) return '<span class="no">請先貼上金鑰</span>';
  try { const j = await jfetch('https://places.googleapis.com/v1/places:searchText', {method: 'POST', headers: gHead('places.displayName,places.formattedAddress'), body: JSON.stringify({textQuery: '台北101', languageCode: 'zh-TW', maxResultCount: 1})}, 15000);
    if (j.error) { const h = gErrHint((j.error.message || '') + JSON.stringify(j.error.details || ''), j.error.status); return `<span class="no">✘ 無法使用</span><br>${esc(j.error.message || j.error.status)}${h ? '<br>👉 ' + esc(h) : ''}`; }
    const p = (j.places || [])[0]; return `<span class="ok">✔ 金鑰可以使用</span>${p ? '（測試搜尋：' + esc(p.displayName && p.displayName.text || '') + '）' : ''}`; } catch (e) { return '<span class="no">✘ ' + esc(e.message) + '</span>'; } }
async function testA() { if (!S.aikey) return '<span class="no">請先貼上金鑰</span>';
  try { const l = await aiListModels(), m = aiPick(l); if (!m) return '<span class="no">✘ 這把金鑰找不到可用的 Gemini 模型</span>'; if (!S.aimodel || S.aimodel === 'auto') { S.aiAuto = m; saveS(); }
    return `<span class="ok">✔ 金鑰可以使用</span>（將使用模型：${esc(S.aimodel && S.aimodel !== 'auto' ? S.aimodel : m)}）`; } catch (e) { return '<span class="no">✘ ' + esc(e.message) + '</span>'; } }

/* ---------- 金鑰圖文教學 ---------- */
const mock = (url, inner, g) => `<div class="mock"><div class="bar ${g ? 'g' : ''}"><i></i><i></i><i></i><span class="url">${url}</span></div><div class="bd">${inner}</div></div>`;
const TUT = {
  maps: {title: 'Google 地圖搜尋金鑰 · 圖文教學', key: 'gkey', steps: [
    {t: '這把金鑰是做什麼的？', h: mock('食光地圖', '<div class="inp">🔍 HEN厚食早午餐</div><div class="card2"><b>HEN厚食早午餐</b><div class="lbl">早午餐餐廳 · 距離 350 公尺</div></div><div class="card2">🕒 星期一: 06:00 – 13:00<div class="lbl">營業時間自動帶入</div></div>', 1) +
      '<p>填入 <b>Google Maps 金鑰</b>後，搜尋店家就會和 Google 地圖一樣準確，加入收藏時還會<b>自動帶入地址、營業時間、電話</b>。</p><div class="callout">💡 如果你已經在<b>行跡導航</b>設定過 Google 金鑰，直接把同一把金鑰貼過來就可以了，不用重新申請——請直接跳到最後一步。</div><div class="callout warn">Google 會要求綁定信用卡做身分驗證，並提供每月免費用量；一般個人使用通常不會超過。實際收費方式請以 Google 官方說明為準。</div>'},
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
    {t: '這把金鑰是做什麼的？', h: mock('食光地圖', '<div class="row" style="gap:.5rem;align-items:stretch"><div class="card2" style="flex:1;text-align:center;margin:0">🖼️<div class="lbl" style="margin:0">菜單照片</div></div><div style="align-self:center">➜ ✨ ➜</div><div class="card2" style="flex:1.4;margin:0;font-size:.72rem"><b>品項｜品名｜價格</b><br>漢堡｜熱狗蛋｜$40<br>吐司｜玉米蛋｜$35</div></div>', 1) +
      '<p><b>Gemini 金鑰</b>讓 App 可以用 Google 的 AI 把<b>菜單照片</b>轉成「品項／品名／價格」表格，也能把<b>食譜截圖</b>轉成食材表與步驟。</p><div class="callout">Google AI Studio 提供免費額度，申請不需要信用卡，個人使用通常很夠用。免費額度與規則以 Google 官方說明為準。</div><div class="callout warn">辨識時，圖片會傳送到 Google 的 AI 服務處理。</div>'},
    {t: '開啟 Google AI Studio', url: 'https://aistudio.google.com/apikey', btn: '開啟 Google AI Studio', h: mock('aistudio.google.com/apikey', '<b>API keys</b><div class="lbl">用 Google 帳號登入，第一次使用請勾選同意條款</div><span class="b hl">🔑 Create API key<span class="tap">👆</span></span><div class="ln" style="width:70%"></div><div class="ln" style="width:45%"></div>') +
      '<p>按下方按鈕開啟 Google AI Studio 並登入 Google 帳號。</p><ul><li>按右上角「<b>Create API key</b>（建立 API 金鑰）」</li><li>如果詢問專案，選剛才建立的專案，或讓它自動建立新專案</li></ul>'},
    {t: '複製金鑰', url: 'https://aistudio.google.com/apikey', btn: '開啟 Google AI Studio', h: mock('aistudio.google.com/apikey', '<b>API key created</b><div class="key">AIzaSyB••••••••••••••••••••••••</div><span class="b hl">Copy<span class="tap">👆</span></span>') +
      '<p>金鑰建立後會顯示一串以 <b>AIza</b> 開頭的文字，按「<b>Copy</b>」複製。</p><div class="callout warn">金鑰等同密碼，請不要分享給別人或貼到公開的地方。</div>'},
    {t: '把金鑰貼到這裡', paste: true, h: '<p>把剛剛複製的金鑰貼到下面，按「測試金鑰」確認可以使用。</p>'}]}
};
function openTutorial(kind) {
  const T = TUT[kind]; let i = 0; const sh = sheet({title: T.title, full: true, foot: '<button class="btn" data-a="prev">‹ 上一步</button><button class="btn pri" data-a="next">下一步 ›</button>', onClose() { if (curTab === 'Set') renderSet(); }});
  const render = () => { const s = T.steps[i], last = i === T.steps.length - 1;
    sh.body.innerHTML = `<div class="tut"><div class="tutDots">${T.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div class="tutStep">步驟 ${i + 1} / ${T.steps.length}</div><h2>${s.t}</h2>${s.h}
      ${s.paste ? `<div class="keyBox"><input id="tK" value="${esc(S[T.key])}" placeholder="在這裡貼上金鑰（AIza…）" autocomplete="off"><button class="btn sm" data-a="paste">貼上</button></div><div style="margin:.7rem 0"><button class="btn olive block" data-a="test">測試金鑰</button></div><div class="testOut" id="tOut"></div>` : ''}
      ${s.url ? `<button class="btn pri block" data-a="go" style="margin-top:.8rem">${s.btn} ↗</button><div class="small muted" style="text-align:center;margin-top:.4rem">會用瀏覽器開啟，完成後回到這裡按「下一步」</div>` : ''}</div>`;
    sh.body.scrollTop = 0; $('[data-a="prev"]', sh.foot).disabled = i === 0; $('[data-a="next"]', sh.foot).textContent = last ? '完成' : '下一步 ›'; };
  render();
  sh.foot.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'prev') { if (i > 0) i--; render(); } else if (i < T.steps.length - 1) { i++; render(); } else sh.close(); });
  sh.body.addEventListener('input', e => { if (e.target.id === 'tK') { S[T.key] = e.target.value.trim(); if (kind === 'maps') GPC.clear(); saveS(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'go') openUrl(T.steps[i].url);
    else if (a === 'paste') { try { const t = (IS_APP && NB.paste ? NB.paste() : await navigator.clipboard.readText()).trim(); if (!t) throw 0; if (t) { $('#tK', sh.body).value = t; S[T.key] = t; saveS(); } } catch (er) { toast('請長按輸入框選「貼上」'); $('#tK', sh.body).focus(); } }
    else if (a === 'test') { const o = $('#tOut', sh.body); o.innerHTML = '測試中…'; o.innerHTML = kind === 'maps' ? await testG() : await testA(); } });
}
function welcome() {
  const sh = sheet({title: '歡迎使用 食光地圖', full: true, foot: '<button class="btn pri" data-a="go">開始使用</button>', onClose() { if (!S.onboard) { S.onboard = true; saveS(); } }});
  sh.body.innerHTML = `<div style="text-align:center;margin:.2rem 0 1rem"><div style="font-size:3.2rem">🚩🍜</div><h2 style="font-size:1.4rem;font-weight:800">把愛店插上旗子，把拿手菜寫成食譜</h2></div>
    <div class="setC">
      <div class="setR"><span style="font-size:1.5rem">🗺️</span><div class="t"><b>地圖</b><small>搜尋店家或長按地圖插旗收藏；上方分類列可切換、長按拖動排序。右側可切換 2D／3D。</small></div></div>
      <div class="setR"><span style="font-size:1.5rem">🔖</span><div class="t"><b>收藏</b><small>依分類查看所有店家的地址、營業時間、菜單；抓住 ☰ 或長按可拖動排序。</small></div></div>
      <div class="setR"><span style="font-size:1.5rem">📋</span><div class="t"><b>菜單</b><small>在店家的「詳細資料」加入菜單照片，按「✨ AI 辨識成表格」自動整理成品項／品名／價格。</small></div></div>
      <div class="setR"><span style="font-size:1.5rem">📖</span><div class="t"><b>食譜</b><small>用食材表格與步驟記錄食譜，也能從截圖匯入。已先放入兩道範例。</small></div></div>
      <div class="setR"><span style="font-size:1.5rem">🧭</span><div class="t"><b>導航</b><small>每間店都能一鍵導航，可選 Google 地圖、行跡導航、Waze 等。</small></div></div></div>
    <div class="h3">建議先完成兩個設定</div>
    <div class="row wrap"><button class="btn olive" data-a="maps">📘 Google 搜尋金鑰教學</button><button class="btn olive" data-a="ai">📘 AI 辨識金鑰教學</button></div>
    <div class="small muted" style="margin-top:.6rem">不設定也可以先使用；之後隨時能到「設定」頁完成。</div>`;
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) openTutorial(b.dataset.a); }); sh.foot.onclick = () => sh.close();
}

/* ---------- 備份 ---------- */
async function saveFile(name, blob) {
  if (IS_APP && NB.saveBegin) { if (!NB.saveBegin(name, blob.type || 'application/octet-stream')) throw new Error('無法建立檔案'); const CH = 3 * 256 * 1024;
    for (let o = 0; o < blob.size; o += CH) { if (!NB.saveChunk(await blobB64(blob.slice(o, o + CH)))) throw new Error('寫入檔案失敗'); } const p = NB.saveEnd(); if (!p) throw new Error('儲存檔案失敗'); return p; }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); return name;
}
async function exportBackup() {
  busy('整理備份資料…'); try { const Sx = Object.assign({}, S); delete Sx.gkey; delete Sx.aikey;
    const parts = [`{"app":"shiguang-foodmap","v":1,"t":${Date.now()},"S":${JSON.stringify(Sx)},"cats":${JSON.stringify(DB.cats)},"places":${JSON.stringify(DB.places)},"recipes":${JSON.stringify(DB.recipes)},"imgs":{`];
    const keys = await IDB.keys('imgs'); let n = 0; for (const k of keys) { const r = await IDB.get('imgs', k); if (!r) continue; parts.push((n++ ? ',' : '') + JSON.stringify(k) + ':' + JSON.stringify({type: r.type, w: r.w, h: r.h, d: await blobB64(new Blob([r.buf]))})); }
    parts.push('}}'); const d = new Date(), nm = `食光地圖備份_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    const p = await saveFile(nm, new Blob(parts, {type: 'application/json'})); busy(false); toast(IS_APP ? '已匯出到「下載」資料夾：' + p : '已下載備份檔 ' + nm, 4000);
  } catch (e) { busy(false); toast('❌ 匯出失敗：' + e.message, 4000); }
}
function importBackup() { const f = $('#jsonPick'); f.value = ''; f.onchange = async () => { const file = f.files[0]; if (!file) return;
  try { busy('讀取備份檔…'); const j = JSON.parse(await file.text()); busy(false); if (j.app !== 'shiguang-foodmap' || !Array.isArray(j.places)) throw new Error('這不是食光地圖的備份檔');
    if (!await ask(`備份檔內有 ${j.places.length} 間收藏、${(j.recipes || []).length} 道食譜。\n匯入後會「取代」目前這台裝置上的所有資料，確定嗎？`, '匯入並取代', true)) return; busy('匯入中…');
    for (const s of ['places', 'recipes', 'imgs']) await IDB.clear(s);
    const b64buf = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
    for (const k in j.imgs || {}) { const r = j.imgs[k]; await IDB.put('imgs', k, {buf: b64buf(r.d), type: r.type || 'image/jpeg', w: r.w, h: r.h}); }
    for (const p of j.places) await IDB.put('places', p.id, p); for (const r of j.recipes || []) await IDB.put('recipes', r.id, r);
    await IDB.put('kv', 'cats', j.cats || []); await IDB.put('kv', 'S', Object.assign({}, S_DEF, j.S || {}, {gkey: S.gkey, aikey: S.aikey, onboard: true})); location.reload();
  } catch (e) { busy(false); toast('❌ 匯入失敗：' + (e instanceof SyntaxError ? '檔案格式不正確' : e.message), 4500); } }; f.click(); }

