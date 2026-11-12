/* ============================================================
   AI（Gemini）圖片辨識、收藏地點明細／編輯、分類管理、收藏頁
   ============================================================ */
const AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const aiHead = () => ({'Content-Type': 'application/json', 'x-goog-api-key': S.aikey});
function aiErrHint(e) { const m = String(e && (e.message || e.status) || '錯誤');
  if (/API key not valid|API_KEY_INVALID|permission/i.test(m)) return 'AI 金鑰不正確，請到「設定」重新貼上 Gemini 金鑰。';
  if (/quota|RESOURCE_EXHAUSTED|rate/i.test(m) || (e && e.code === 429)) return 'AI 免費額度暫時用完了，請稍等一分鐘再試。';
  if (/overloaded|UNAVAILABLE/i.test(m) || (e && e.code === 503)) return 'AI 伺服器忙碌中，請稍後再試。';
  return 'AI：' + m; }
async function aiListModels() { const j = await jfetch(AI_BASE + '?pageSize=200', {headers: aiHead()}, 20000); if (j.error) throw new Error(aiErrHint(j.error));
  return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')); }
function aiPick(list) { const ok = list.filter(n => /^gemini/.test(n) && /flash/.test(n) && !/(image|tts|live|audio|embed|native|lite|8b|computer|robot|learn)/.test(n));
  if (ok.includes('gemini-flash-latest')) return 'gemini-flash-latest'; const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0), pre = n => /preview|exp/.test(n) ? 1 : 0;
  ok.sort((a, b) => pre(a) - pre(b) || ver(b) - ver(a) || a.length - b.length); return ok[0] || list.find(n => /^gemini/.test(n)) || ''; }
function parseLoose(t) { t = String(t || '').trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim(); try { return JSON.parse(t); } catch (e) {}
  const i = t.lastIndexOf('}'); if (i > 0 && t[0] === '[') { try { return JSON.parse(t.slice(0, i + 1) + ']'); } catch (e) {} } throw new Error('AI 回傳的內容無法解析，請再試一次'); }
async function gemini(parts, schema) {
  if (!S.aikey) throw new Error('NOKEY');
  const body = JSON.stringify({contents: [{role: 'user', parts}], generationConfig: {responseMimeType: 'application/json', responseSchema: schema, temperature: 0}});
  const call = m => jfetch(`${AI_BASE}/${encodeURIComponent(m)}:generateContent`, {method: 'POST', headers: aiHead(), body}, 150000);
  const auto = !S.aimodel || S.aimodel === 'auto'; let model = auto ? (S.aiAuto || 'gemini-flash-latest') : S.aimodel, j = await call(model);
  if (j.error && auto && (j.error.code === 404 || /not found|not supported|no longer|deprecated/i.test(j.error.message || ''))) { const m = aiPick(await aiListModels()); if (!m) throw new Error('這把金鑰找不到可用的 Gemini 模型'); model = m; j = await call(m); }
  if (j.error) throw new Error(aiErrHint(j.error)); if (auto && S.aiAuto !== model) { S.aiAuto = model; saveS(); }
  const c = (j.candidates || [])[0]; if (!c) throw new Error('AI 沒有回傳結果' + (j.promptFeedback ? '（圖片內容被拒絕）' : ''));
  return parseLoose(((c.content && c.content.parts) || []).map(p => p.text || '').join(''));
}
const MENU_PROMPT = '這是一張餐飲店的菜單照片。請把菜單上「所有」餐點整理成 JSON 陣列，每一筆包含：category（菜單上的分類標題，例如：漢堡、吐司、蛋餅、中式餐點、飲料；沒有分類就填「其他」）、name（品名）、price（價格，只填數字）。' +
  '規則：1) 依照菜單由左到右、由上到下的順序逐項列出，不可遺漏，也不可自行編造。2) 同一品項有多種尺寸或多個價格時（例如 L / XL、厚片 / 吐司），請拆成多筆，並在品名後面加上尺寸，例如「紅茶 (L)」「紅茶 (XL)」。3) 看不清楚的價格填空字串。4) 文字一律使用菜單上的原文（繁體中文）。';
const MENU_SCHEMA = {type: 'ARRAY', items: {type: 'OBJECT', properties: {category: {type: 'STRING'}, name: {type: 'STRING'}, price: {type: 'STRING'}}, required: ['category', 'name', 'price']}};
const RECIPE_PROMPT = '這是食譜的圖片（可能有多張，是同一道食譜）。請整理成 JSON：title（食譜名稱）、servings（份數，例如「一人份」，沒有就空字串）、ingredients（食材陣列，每筆有 name 食材、amount 數量）、steps（製作步驟陣列，每個步驟一個字串，不要包含編號）、note（其他備註，沒有就空字串）。文字一律照圖片上的原文，不可遺漏或自行編造。';
const RECIPE_SCHEMA = {type: 'OBJECT', properties: {title: {type: 'STRING'}, servings: {type: 'STRING'}, ingredients: {type: 'ARRAY', items: {type: 'OBJECT', properties: {name: {type: 'STRING'}, amount: {type: 'STRING'}}, required: ['name', 'amount']}}, steps: {type: 'ARRAY', items: {type: 'STRING'}}, note: {type: 'STRING'}}, required: ['title', 'ingredients', 'steps']};
const imgPart = async blob => ({inline_data: {mime_type: blob.type || 'image/jpeg', data: await blobB64(blob)}});
function needAiKey() { ask('AI 圖片辨識需要先設定免費的 Gemini 金鑰。\n要看圖文教學嗎？（大約 1 分鐘）', '看教學').then(y => { if (y) openTutorial('ai'); }); }
const normPrice = s => { s = String(s == null ? '' : s).trim(); const m = s.replace(/[,，\s]/g, '').match(/^\$?(?:NT\$?)?(\d+(?:\.\d+)?)元?$/i); return m ? m[1] : s; };

async function aiMenu(p, done) {
  if (!S.aikey) { needAiKey(); return; } if (!(p.imgs || []).length) { toast('請先加入菜單圖片'); return; }
  let replace = true; if ((p.menu || []).length) { replace = await ask(`目前表格已有 ${p.menu.length} 個品項。\n要用這次辨識的結果「取代」原本的表格嗎？\n（選取消＝保留原本的，把新結果加在後面）`, '取代'); }
  const out = []; let fail = '';
  for (let i = 0; i < p.imgs.length; i++) { busy(`AI 正在辨識菜單… (${i + 1}/${p.imgs.length})\n品項多的菜單約需 20～60 秒`);
    try { const b = await imgBlob(p.imgs[i]); if (!b) continue; const r = await gemini([{text: MENU_PROMPT}, await imgPart(b)], MENU_SCHEMA);
      (Array.isArray(r) ? r : []).forEach(x => { if (x && (x.name || '').trim()) out.push({c: String(x.category || '其他').trim(), n: String(x.name).trim(), p: normPrice(x.price)}); }); }
    catch (e) { fail = e.message; if (e.message === 'NOKEY') break; } }
  busy(false);
  if (!out.length) { toast(fail ? '❌ ' + fail : '沒有辨識到任何品項，請換一張較清楚的圖片', 4500); return; }
  p.menu = replace ? out : (p.menu || []).concat(out); await savePlace(p); buzz(30); toast(`✅ 辨識完成，共 ${out.length} 個品項${fail ? '（部分圖片失敗：' + fail + '）' : ''}`, 3500); done && done();
}

/* ---------- 收藏地點：明細 ---------- */
function openPlace(id, toMenu) {
  const p = DB.places.find(x => x.id === id); if (!p) return; let editT = false, mq = '';
  const sh = sheet({title: p.name, full: true}); sh.tools.innerHTML = '<button class="btn sm" data-a="edit">✎ 編輯</button>';
  sh.tools.onclick = () => editPlace(p, false, del => { if (del) sh.close(); else render(); });
  const save = debounce(() => savePlace(p), 400);
  function tableHtml() {
    const rows = p.menu || []; if (!rows.length && !editT) return `<div class="empty" style="padding:1.2rem"><span class="muted">還沒有菜單表格。<br>加入菜單圖片後按「✨ AI 辨識成表格」，或手動建立。</span><div style="margin-top:.7rem"><button class="btn sm" data-a="tEdit">✎ 手動建立表格</button></div></div>`;
    if (editT) return `<table class="mtable"><thead><tr><th style="width:26%">品項</th><th>品名</th><th style="width:22%" class="p">價格</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><input data-i="${i}" data-k="c" value="${esc(r.c)}"></td><td><input data-i="${i}" data-k="n" value="${esc(r.n)}"></td><td><input data-i="${i}" data-k="p" value="${esc(r.p)}" inputmode="decimal" style="text-align:right"></td><td class="x"><button class="ic" data-a="tDel" data-i="${i}" style="color:var(--danger);width:2rem;height:2rem">✕</button></td></tr>`).join('')}</tbody></table>
      <div class="row wrap" style="margin-top:.6rem"><button class="btn sm" data-a="tAdd">＋ 新增一列</button><button class="btn sm danger" data-a="tClear">清空表格</button><span class="grow"></span><button class="btn sm pri" data-a="tEdit">完成</button></div>`;
    const q = mq.trim().toLowerCase(), list = q ? rows.filter(r => (r.c + ' ' + r.n).toLowerCase().includes(q)) : rows; let last = null;
    return `<div class="row" style="margin-bottom:.55rem"><div class="searchBox grow"><input id="mq" type="search" placeholder="搜尋品名…" value="${esc(mq)}"></div><button class="btn sm" data-a="tEdit">✎ 編輯表格</button></div>
      <table class="mtable"><thead><tr><th>品項</th><th>品名</th><th class="p">價格</th></tr></thead><tbody id="mtb">${list.map(r => { const g = r.c !== last; last = r.c; return `<tr class="${g ? 'g' : ''}"><td class="c">${g ? esc(r.c) : ''}</td><td>${esc(r.n)}</td><td class="p">${r.p !== '' && !isNaN(+r.p) ? '$' + esc(r.p) : esc(r.p)}</td></tr>`; }).join('') || '<tr><td colspan="3" class="muted" style="text-align:center">找不到符合的品項</td></tr>'}</tbody></table>`;
  }
  async function render() {
    const c = catOf(p.cat), hi = hoursIdx(p), ni = (p.imgs || []).length; sh.title(p.name);
    const thumbs = await Promise.all((p.imgs || []).map(async (im, i) => `<div class="th"><img src="${await imgURL(im)}" data-a="view" data-i="${i}" alt="菜單圖片 ${i + 1}"><button class="rm" data-a="imgDel" data-i="${i}" aria-label="移除">✕</button></div>`));
    const top = sh.body.scrollTop;
    sh.body.innerHTML = `<div class="dHero" style="--c:${c.color}"><div class="ico">${esc(c.icon)}</div><div class="grow"><h2>${esc(p.name)}</h2>
        <div style="margin:.3rem 0"><span class="tag" style="--c:${c.color}">${esc(c.name)}</span>${p.rating ? ` <span class="small muted">⭐ ${p.rating}${p.ratingN ? '（' + p.ratingN + ' 則）' : ''}</span>` : ''}</div>
        ${stateHtml(p) ? `<div class="small muted row" style="gap:.35rem">${stateHtml(p)}</div>` : ''}</div></div>
      <div class="dActs"><button class="btn olive" data-a="nav"><span>🧭</span>導航</button><button class="btn" data-a="gm"><span>🗺️</span>Google 地圖</button><button class="btn" data-a="show"><span>📍</span>在地圖上看</button>
        ${p.phone ? '<button class="btn" data-a="tel"><span>📞</span>撥打電話</button>' : ''}${p.web ? '<button class="btn" data-a="web"><span>🌐</span>網站</button>' : ''}${S.gkey ? '<button class="btn" data-a="gfill"><span>🔄</span>更新資訊</button>' : ''}</div>
      <div class="info"><div class="ln" data-a="copyAddr"><span class="k">📍</span><span class="v">${esc(p.addr || '（尚未填寫地址）')}</span></div>
        <div class="ln"><span class="k">🕒</span><span class="v hours">${(p.hours || []).length ? p.hours.map((h, i) => `<div class="${i === hi ? 'td' : ''}">${esc(h)}</div>`).join('') : '<span class="muted">（尚未填寫營業時間' + (S.gkey ? '，可按上方「更新資訊」從 Google 帶入' : '') + '）</span>'}</span></div>
        ${p.phone ? `<div class="ln"><span class="k">📞</span><span class="v">${esc(p.phone)}</span></div>` : ''}
        ${p.note ? `<div class="ln"><span class="k">📝</span><span class="v" style="white-space:pre-wrap">${esc(p.note)}</span></div>` : ''}</div>
      <div class="h3" id="menuTop"><span class="grow">📋 菜單 <span class="muted small" style="font-weight:600">${(p.menu || []).length ? p.menu.length + ' 個品項' : ''}</span></span></div>
      <div class="row wrap" style="margin-bottom:.6rem"><button class="btn pri" data-a="imgs" ${ni ? '' : 'disabled'}>🖼️ 打開菜單圖檔${ni ? '（' + ni + '）' : ''}</button><button class="btn" data-a="imgAdd">＋ 加入圖片</button><button class="btn olive" data-a="ai">✨ AI 辨識成表格</button></div>
      ${ni ? `<div class="thumbs">${thumbs.join('')}</div>` : '<div class="small muted" style="margin-bottom:.6rem">還沒有菜單圖片。按「＋ 加入圖片」從相簿選擇或拍照。</div>'}
      <div id="mtWrap">${tableHtml()}</div>`;
    sh.body.scrollTop = top;
  }
  sh.body.addEventListener('input', e => { const t = e.target; if (t.id === 'mq') { mq = t.value; const w = el('<div>' + tableHtml() + '</div>'); $('#mtb', sh.body).innerHTML = $('#mtb', w).innerHTML; return; }
    if (t.dataset.k) { p.menu[+t.dataset.i][t.dataset.k] = t.value; save(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, i = +b.dataset.i;
    if (a === 'nav') navTo(p); else if (a === 'gm') openUrl(gmUrl(p)); else if (a === 'tel') openUrl('tel:' + p.phone.replace(/[^\d+]/g, '')); else if (a === 'web') openUrl(p.web);
    else if (a === 'show') { while (sheets.length) sheets[sheets.length - 1].close(); selectPlace(p.id, true); }
    else if (a === 'copyAddr') { if (p.addr) copyText(p.addr); }
    else if (a === 'gfill') { busy('向 Google 更新資訊…'); try { await gFill(p); await savePlace(p); refreshAll(); toast('已更新營業時間等資訊'); } catch (er) { toast('❌ ' + er.message, 4000); } busy(false); render(); }
    else if (a === 'imgs') Viewer.open(p.imgs, 0, p.name); else if (a === 'view') Viewer.open(p.imgs, i, p.name);
    else if (a === 'imgAdd') { const fs = await pickImages(true); if (!fs.length) return; busy('處理圖片中…'); try { for (const f of fs) { p.imgs = p.imgs || []; p.imgs.push(await imgStore(f)); } await savePlace(p); } catch (er) { toast('❌ ' + er.message); } busy(false); await render(); refreshAll();
      if (S.aikey && !(p.menu || []).length && await ask('圖片已加入。\n要現在用 AI 辨識成表格嗎？', '開始辨識')) aiMenu(p, render); }
    else if (a === 'imgDel') { if (!await ask('要移除這張菜單圖片嗎？', '移除', true)) return; const [im] = p.imgs.splice(i, 1); await imgDel(im); await savePlace(p); render(); refreshAll(); }
    else if (a === 'ai') aiMenu(p, render);
    else if (a === 'tEdit') { editT = !editT; p.menu = (p.menu || []).filter(r => (r.c + r.n + r.p).trim()); if (editT && !p.menu.length) p.menu.push({c: '', n: '', p: ''}); await savePlace(p); $('#mtWrap', sh.body).innerHTML = tableHtml(); render(); refreshAll(); }
    else if (a === 'tAdd') { const l = p.menu[p.menu.length - 1]; p.menu.push({c: l ? l.c : '', n: '', p: ''}); $('#mtWrap', sh.body).innerHTML = tableHtml(); const ins = $$('#mtWrap input[data-k="n"]', sh.body); ins[ins.length - 1].focus(); }
    else if (a === 'tDel') { p.menu.splice(i, 1); save(); $('#mtWrap', sh.body).innerHTML = tableHtml(); }
    else if (a === 'tClear') { if (await ask('確定要清空整個菜單表格嗎？（圖片不會被刪除）', '清空', true)) { p.menu = []; editT = false; await savePlace(p); render(); refreshAll(); } } });
  render().then(() => { if (toMenu) { const t = $('#menuTop', sh.body); if (t) sh.body.scrollTop = t.offsetTop - 8; } });
}

/* ---------- 收藏地點：新增／編輯 ---------- */
function editPlace(src, isNew, done) {
  const d = JSON.parse(JSON.stringify(src));
  const sh = sheet({title: isNew ? '加入收藏' : '編輯地點', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '加入收藏' : '儲存'}</button>`});
  function catHtml() { return DB.cats.map(c => `<button data-c="${c.id}" class="${d.cat === c.id ? 'on' : ''}" style="--c:${c.color}">${esc(c.icon)} ${esc(c.name)}</button>`).join('') + '<button data-c="+">＋ 新分類</button>'; }
  function fill() { sh.body.innerHTML = `
    <div class="field"><label>店名</label><input id="eN" value="${esc(d.name)}" placeholder="例如：HEN厚食早午餐"></div>
    <div class="field"><label>放到哪個分類（旗子顏色會跟著分類）</label><div class="catPick" id="eC">${catHtml()}</div></div>
    <div class="field"><label>地址</label><input id="eA" value="${esc(d.addr)}" placeholder="地址"></div>
    <div class="field"><label>營業時間（每行一天）</label><textarea id="eH" rows="7" placeholder="星期一: 06:00 – 13:00&#10;星期二: 06:00 – 13:00&#10;…">${esc((d.hours || []).join('\n'))}</textarea>
      ${S.gkey ? '<button class="btn sm olive" data-a="g" style="margin-top:.4rem">🔄 從 Google 地圖帶入地址、營業時間、電話</button>' : '<div class="small muted" style="margin-top:.3rem">設定 Google Maps 金鑰後，可以自動從 Google 帶入營業時間。<button class="btn sm" data-a="key">看教學</button></div>'}</div>
    <div class="field"><label>電話</label><input id="eP" value="${esc(d.phone || '')}" inputmode="tel" placeholder="電話"></div>
    <div class="field"><label>備註</label><textarea id="eM" rows="2" placeholder="推薦餐點、停車資訊、公休日…">${esc(d.note || '')}</textarea></div>
    <div class="small muted">座標：${(+d.lat).toFixed(6)}, ${(+d.lon).toFixed(6)}${isNew ? '<br>💡 菜單圖片與表格，加入收藏後在「詳細資料」裡新增。' : ''}</div>`; }
  const read = () => { d.name = $('#eN', sh.body).value.trim(); d.addr = $('#eA', sh.body).value.trim(); d.hours = $('#eH', sh.body).value.split('\n').map(s => s.trim()).filter(Boolean); d.phone = $('#eP', sh.body).value.trim(); d.note = $('#eM', sh.body).value.trim(); };
  fill();
  sh.body.addEventListener('click', async e => { const cb = e.target.closest('#eC button');
    if (cb) { if (cb.dataset.c === '+') { read(); editCat(null, c => { if (c) d.cat = c.id; fill(); }); return; } buzz(8); d.cat = cb.dataset.c; $$('#eC button', sh.body).forEach(b => b.classList.toggle('on', b === cb)); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'key') openTutorial('maps');
    if (b.dataset.a === 'g') { read(); busy('向 Google 查詢…'); try { await gFill(d, !d.name); toast('已帶入 Google 資料'); } catch (er) { toast('❌ ' + er.message, 4000); } busy(false); fill(); } });
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`確定要刪除「${src.name}」嗎？\n菜單圖片與表格也會一併刪除。`, '刪除', true)) return;
      for (const im of src.imgs || []) await imgDel(im); DB.places.splice(DB.places.indexOf(src), 1); await IDB.del('places', src.id).catch(() => {}); if (M.sel === src.id) clearSel(); sh.close(); refreshAll(); toast('已刪除'); done && done(true); return; }
    read(); if (!d.name) { toast('請輸入店名'); $('#eN', sh.body).focus(); return; }
    if (isNew) { d.id = 'p' + uid(); d.t = Date.now(); d.ord = DB.places.length ? Math.max(...DB.places.map(x => x.ord || 0)) + 1 : 0; DB.places.push(d); await savePlace(d); sh.close(); clearSel(); refreshAll(); buzz(25); toast('已加入收藏 🚩'); selectPlace(d.id); }
    else { Object.assign(src, d); await savePlace(src); sh.close(); refreshAll(); if (M.sel === src.id) selectPlace(src.id); toast('已儲存'); done && done(false); } });
}

/* ---------- 分類管理（自訂名稱、圖示、顏色、拖曳排序） ---------- */
function openCats() {
  const sh = sheet({title: '管理收藏分類', full: true, foot: '<button class="btn pri" data-a="add">＋ 新增分類</button>'});
  const render = () => { sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">長按或抓住 ☰ 拖動可以調整順序；地圖上方的分類列與收藏頁會跟著變。</div><div id="catL" class="noSel">${DB.cats.map(c => `<div class="catRow" data-id="${c.id}" style="--c:${c.color}"><span class="grip"></span><span class="ico">${esc(c.icon)}</span><b class="grow">${esc(c.name)} <span class="small muted" style="font-weight:600">${placesIn(c.id).length} 間</span></b><button class="btn sm" data-a="edit">✎ 編輯</button></div>`).join('') || '<div class="empty">還沒有分類</div>'}</div>`;
    sortable($('#catL', sh.body), {item: '.catRow', handle: '.grip', scroller: sh.body, onSort(from, to) { moveItem(DB.cats, from, to); saveCats(); refreshAll(); render(); }}); };
  render();
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-a="edit"]'); if (b) editCat(DB.cats.find(c => c.id === b.closest('.catRow').dataset.id), render); });
  sh.foot.onclick = () => editCat(null, render);
}
function editCat(cat, done) {
  const isNew = !cat, d = cat ? Object.assign({}, cat) : {id: '', name: '', icon: '🍴', color: CAT_COLORS.find(c => !DB.cats.some(x => x.color.toLowerCase() === c.toLowerCase())) || CAT_COLORS[0]};
  const sh = sheet({title: isNew ? '新增分類' : '編輯分類', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`});
  sh.body.innerHTML = `<div class="row" style="justify-content:center;margin:.3rem 0 1.4rem;height:3.2rem"><div style="position:relative;width:3rem;height:3rem"><div class="pin" id="cPrev" style="position:absolute;left:.6rem;bottom:.2rem"><div class="base"></div><div class="pole"></div><div class="knob"></div><div class="flag"></div></div></div><span class="chip on" id="cChip"></span></div>
    <div class="field"><label>分類名稱</label><input id="cN" value="${esc(d.name)}" placeholder="例如：火鍋、拉麵、早午餐" maxlength="12"></div>
    <div class="field"><label>圖示</label><div class="emoGrid" id="cE">${CAT_EMOJI.map(x => `<button data-e="${x}">${x}</button>`).join('')}</div><div class="row" style="margin-top:.5rem"><span class="small muted" style="white-space:nowrap">或自己輸入：</span><input id="cI" value="${esc(d.icon)}" maxlength="4" style="width:5rem;text-align:center;font-size:1.2rem"></div></div>
    <div class="field"><label>旗子顏色</label><div class="swGrid" id="cS">${CAT_COLORS.map(c => `<button class="sw" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}<label class="sw" style="--c:conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red);background:var(--c)" title="自訂顏色"><input type="color" id="cC" value="${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#a2613a'}"></label></div></div>`;
  const upd = () => { $('#cPrev', sh.body).style.setProperty('--c', d.color); $('#cPrev .flag', sh.body).textContent = d.icon; const ch = $('#cChip', sh.body); ch.style.setProperty('--c', d.color); ch.textContent = d.icon + ' ' + (d.name || '分類名稱');
    $$('#cE button', sh.body).forEach(b => b.classList.toggle('on', b.dataset.e === d.icon)); $$('#cS .sw[data-c]', sh.body).forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === d.color.toLowerCase())); };
  upd();
  $('#cN', sh.body).oninput = e => { d.name = e.target.value.trim(); upd(); }; $('#cI', sh.body).oninput = e => { d.icon = e.target.value.trim() || '🍴'; upd(); }; $('#cC', sh.body).oninput = e => { d.color = e.target.value; upd(); };
  $('#cE', sh.body).onclick = e => { const b = e.target.closest('button'); if (!b) return; d.icon = b.dataset.e; $('#cI', sh.body).value = d.icon; buzz(8); upd(); };
  $('#cS', sh.body).onclick = e => { const b = e.target.closest('.sw[data-c]'); if (!b) return; d.color = b.dataset.c; buzz(8); upd(); };
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { const n = placesIn(cat.id).length; if (!await ask(`確定要刪除分類「${cat.name}」嗎？${n ? `\n裡面的 ${n} 間店不會被刪除，會移到「未分類」。` : ''}`, '刪除', true)) return;
      DB.places.forEach(p => { if (p.cat === cat.id) { p.cat = ''; savePlace(p); } }); DB.cats.splice(DB.cats.indexOf(cat), 1); await saveCats(); sh.close(); refreshAll(); done && done(null); return; }
    if (!d.name) { toast('請輸入分類名稱'); $('#cN', sh.body).focus(); return; }
    let out; if (isNew) { d.id = 'c' + uid(); DB.cats.push(d); out = d; } else { Object.assign(cat, d); out = cat; } await saveCats(); sh.close(); refreshAll(); done && done(out); });
}

/* ---------- 收藏分類頁 ---------- */
function renderFav() {
  const q = $('#favQ').value.trim().toLowerCase(), box = $('#favList');
  const hit = p => !q || (p.name + ' ' + (p.addr || '') + ' ' + (p.note || '') + ' ' + (p.menu || []).map(r => r.n).join(' ')).toLowerCase().includes(q);
  const secs = DB.cats.map(c => ({c, srt: true})); if (placesIn('').length) secs.push({c: UNCAT, srt: false});
  const html = secs.map(({c, srt}) => { const all = placesIn(c.id), ps = all.filter(hit); if (q && !ps.length) return '';
    return `<div class="sec ${S.fold[c.id] && !q ? 'fold' : ''}" data-cat="${c.id}" ${srt && !q ? 'data-srt' : ''} style="--c:${c.color}"><div class="secHead">${srt && !q ? '<span class="grip secGrip"></span>' : ''}<span class="ico">${esc(c.icon)}</span><b class="grow" data-a="fold">${esc(c.name)} <span class="cnt">${ps.length} 間</span></b><button class="ic chev" data-a="fold" aria-label="收合">▾</button></div>
      <div class="secList">${ps.map(p => { const st = stateHtml(p), n = (p.menu || []).length, ni = (p.imgs || []).length;
        return `<div class="pl" data-id="${p.id}"><div class="grow" data-a="open"><b>${esc(p.name)}</b>${st ? `<div class="meta">${st}</div>` : ''}<div class="meta">${esc(p.addr || '')}</div>${n || ni || p.phone ? `<div class="meta">${n ? '<span>📋 ' + n + ' 個品項</span>' : ''}${ni ? '<span>🖼️ ' + ni + ' 張菜單</span>' : ''}${p.phone ? '<span>📞 ' + esc(p.phone) + '</span>' : ''}</div>` : ''}</div><button class="ic go" data-a="nav" aria-label="導航">🧭</button><button class="ic go" data-a="map" aria-label="在地圖上看">📍</button>${q ? '' : '<span class="grip plGrip"></span>'}</div>`; }).join('') || '<div class="secEmpty">這個分類還沒有收藏的店家</div>'}</div></div>`; }).join('');
  box.innerHTML = html || `<div class="empty"><span class="big">🚩</span>${q ? '找不到符合的收藏' : '還沒有任何收藏<br><span class="small">到「地圖」頁搜尋店家，或長按地圖插旗收藏</span>'}</div>`;
}
function initFav() {
  const box = $('#favList'); $('#favQ').addEventListener('input', debounce(renderFav, 150)); $('#favCats').onclick = openCats;
  box.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'fold') { const s = b.closest('.sec'), id = s.dataset.cat; S.fold[id] = !S.fold[id]; saveS(); s.classList.toggle('fold', !!S.fold[id]); return; }
    const p = DB.places.find(x => x.id === b.closest('.pl').dataset.id); if (!p) return; if (a === 'open') openPlace(p.id); else if (a === 'nav') navTo(p); else if (a === 'map') selectPlace(p.id, true); });
  sortable(box, {item: '.sec[data-srt]', handle: '.secGrip', handleOnly: true, scroller: '.pgBody', onSort(from, to) { moveItem(DB.cats, from, to); saveCats(); refreshAll(); }});
  sortable(box, {item: '.pl', handle: '.plGrip', scope: '.sec', scroller: '.pgBody', onSort(from, to, sec) { if ($('#favQ').value.trim()) return; const cat = sec.dataset.cat, ids = placesIn(cat).map(p => p.id); moveItem(ids, from, to);
    const idx = []; DB.places.forEach((p, i) => { if (ids.includes(p.id)) idx.push(i); }); const by = new Map(DB.places.map(p => [p.id, p])); idx.forEach((i, k) => { DB.places[i] = by.get(ids[k]); });
    DB.places.forEach((p, i) => { if (p.ord !== i) { p.ord = i; savePlace(p); } }); renderFav(); }});
}
function updCounts() { $('#favSub').textContent = `共 ${DB.places.length} 間收藏 · ${DB.cats.length} 個分類`; $('#recSub').textContent = `共 ${DB.recipes.length} 道食譜`; }
