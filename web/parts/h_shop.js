/* ============================================================
   購物分帳：量販店／超商／外送的明細 → 誰買的、誰一起分 → 每個人要付多少
   DB.bills = {'2026-11-08': [bill]}
   bill = {id, place, pname, time, total(明細上的實付金額), imgs:[圖片id],
           items:[{id, n, q, amt(這一行金額), o(規格), ppl:[人id…]}],
           disc:[{id, n, amt, items:[品項id…], auto}],   ← 品項折扣（平均分到勾選的品項）
           odisc:[{id, n, amt, ppl:[人id…]}],             ← 整單折扣、優惠券（選誰均攤）
           fees:[{id, n, amt, ppl:[人id…]}]}              ← 平台費、外送費、包材費（選誰均攤）
   DB.scfg = {fees:['平台費',…], odisc:['優惠券',…]}
   ============================================================ */
const SHOP_FEES = ['平台費', '外送服務費', '包材費', '小費', '運費'], SHOP_OD = ['福利扣點', '優惠券', '整單折扣', '滿額折抵'];
const saveBills = debounce(() => IDB.put('kv', 'bills', DB.bills).catch(saveErr), 200);
const saveScfg = debounce(() => IDB.put('kv', 'scfg', DB.scfg).catch(saveErr), 200);
async function loadShop() {
  DB.bills = await IDB.get('kv', 'bills').catch(() => null) || {}; Object.values(DB.bills).forEach(L => L.forEach(b => { delete b.aiBusy; delete b.aiMsg; if (b.src === 'ai') (b.items || []).forEach(x => { x.n = rcName(x.n); }); }));
  DB.scfg = await IDB.get('kv', 'scfg').catch(() => null) || {fees: SHOP_FEES.slice(), odisc: SHOP_OD.slice()};
  let fx = 0; Object.values(DB.bills).forEach(L => L.forEach(b => { if ((b.odisc || []).some(d => /福利|點數|扣點/.test(d.n)) && ptFix(b, 0, true)) fx++; })); if (fx) IDB.put('kv', 'bills', DB.bills).catch(() => {});
  if (!DB.scfg.v2) { if (!DB.scfg.odisc.includes('福利扣點')) DB.scfg.odisc.unshift('福利扣點'); DB.scfg.v2 = 1; IDB.put('kv', 'scfg', DB.scfg).catch(() => {}); }
}
const Shop = {sel: ymd(new Date()), ym: null};
const shopPlaces = () => DB.side ? DB.side.shop.places : [];
const billStore = b => { const P = shopPlaces().find(x => x.id === b.place); return P ? P.name : b.pname || ''; };
const pplNames = ids => (ids || []).map(id => mWho(id).name).join('、');
const pOrder = ids => [...new Set(ids || [])].sort((a, b) => pOrd(a) - pOrd(b));

/* ---------- 計算 ---------- */
function billCalc(b) {
  const items = b.items || [], itemDisc = {}, per = {}, add = (id, v) => { per[id] = (per[id] || 0) + v; };
  (b.disc || []).forEach(d => { const ids = (d.items || []).filter(id => items.some(x => x.id === id)); if (!ids.length) return; ids.forEach(id => { itemDisc[id] = (itemDisc[id] || 0) + numP(d.amt) / ids.length; }); });
  let unassigned = 0;
  items.forEach(x => { const net = numP(x.amt) - (itemDisc[x.id] || 0), ids = x.ppl || []; if (!ids.length) unassigned += net; else ids.forEach(id => add(id, net / ids.length)); });
  (b.odisc || []).forEach(d => { const ids = d.ppl || []; if (!ids.length) unassigned -= numP(d.amt); else ids.forEach(id => add(id, -numP(d.amt) / ids.length)); });
  (b.fees || []).forEach(d => { const ids = d.ppl || []; if (!ids.length) unassigned += numP(d.amt); else ids.forEach(id => add(id, numP(d.amt) / ids.length)); });
  const S1 = L => (L || []).reduce((s, x) => s + numP(x.amt), 0), sumItems = S1(items), sumDisc = S1(b.disc), sumOd = S1(b.odisc), sumFee = S1(b.fees);
  const computed = sumItems - sumDisc - sumOd + sumFee, total = b.total === '' || b.total == null ? null : numP(b.total);
  return {per, itemDisc, unassigned, computed, sumItems, sumDisc, sumOd, sumFee, total, diff: total == null ? 0 : Math.round((computed - total) * 100) / 100,
    noWho: items.filter(x => !(x.ppl || []).length).length, unlinked: (b.disc || []).filter(d => !(d.items || []).length).length,
    noShare: (b.odisc || []).concat(b.fees || []).filter(d => !(d.ppl || []).length).length};
}
const dayBills = k => DB.bills[k] || [];
const billWarn = c => [c.noWho ? `${c.noWho} 項還沒選誰買的` : '', c.unlinked ? `${c.unlinked} 個折扣還沒勾品項` : '', c.noShare ? `${c.noShare} 筆費用／折扣還沒選誰分攤` : '', c.diff ? `和明細金額差 ${money(Math.abs(c.diff))}` : ''].filter(Boolean);

/* ---------- 主畫面：月曆＋這天的明細 ---------- */
function renderShop() {
  const box = $('#shopBody'); if (!box) return; const sel = ymdDate(Shop.sel); if (!Shop.ym) Shop.ym = [sel.getFullYear(), sel.getMonth()];
  const [Y, Mo] = Shop.ym, first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(), today = ymd(new Date()), yNow = new Date().getFullYear();
  const yrs = []; for (let y = Math.min(yNow - 5, Y); y <= Math.max(yNow + 2, Y); y++) yrs.push(y);
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), dow = (first.getDay() + d - 1) % 7; cells += `<button class="cd ${k === Shop.sel ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${dayBills(k).length ? '<em class="dot"></em>' : ''}</button>`; }
  const bs = dayBills(Shop.sel), per = {}; let dayTot = 0;
  bs.forEach(b => { const c = billCalc(b); dayTot += c.computed; Object.keys(c.per).forEach(id => { per[id] = (per[id] || 0) + c.per[id]; }); });
  $('#shopSub').textContent = `${sel.getMonth() + 1}月${sel.getDate()}日（${MWD[sel.getDay()]}）${bs.length ? ' · ' + bs.length + ' 筆' : ''}`;
  const order = pOrder(Object.keys(per));
  box.innerHTML = `<div class="cal card">
      ${calHead(Y, Mo)}
      <div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG">${cells}</div></div>
    <div class="dayHead"><b class="dhD">${sel.getMonth() + 1}月${sel.getDate()}日 星期${MWD[sel.getDay()]}</b><span class="grow"></span>${bs.length ? `<span class="dayTot">${money(dayTot)}</span><button class="btn sm" data-a="exportDay">📤 匯出</button>` : ''}</div>
    ${bs.map(billCard).join('') || '<div class="empty mealEmpty"><span class="big">🧾</span>這天還沒有購物明細<br><span class="small">按上面的「上傳明細」拍照或選截圖，或「手動輸入」<br>也可以在 Foodpanda、相簿裡按「分享」傳給食光帳本</span></div>'}
    
    ${order.length ? `<div class="perSum card"><div class="psH">👥 每個人這天要付</div>${order.map(id => { const u = mWho(id); return `<div class="psR"><span class="psI">${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><span>${money(per[id])}</span></div>`; }).join('')}<div class="psR tot"><b class="grow">合計</b><span>${money(dayTot)}</span></div></div>` : ''}`;
}
function billCard(b) {
  const c = billCalc(b), w = billWarn(c), ids = pOrder(Object.keys(c.per)), nm = billStore(b);
  return `<div class="meal card bill" data-b="${b.id}">
    <div class="blH"><div class="blT"><b>${esc(nm || '未選店家')}</b><button class="ic" data-a="bMore" aria-label="更多">⋯</button></div><div class="blB"><div class="mlS grow">${b.aiBusy ? `<span class="spin"></span> <span class="rcMsg" data-b="${b.id}">${esc(b.aiMsg || 'AI 辨識中')}</span>・` : ''}${b.time ? '🕒 ' + esc(b.time) + '・' : ''}${b.items.length} 項${(b.imgs || []).length ? '・🖼️ ' + b.imgs.length : ''}</div><span class="blTot">${money(c.computed)}</span><button class="btn sm pri" data-a="edit">編輯</button></div></div>
    ${ids.length ? `<div class="blPer">${ids.map(id => `<span><i>${esc(mWho(id).icon)}</i>${esc(mWho(id).name)} <b>${money(c.per[id])}</b></span>`).join('')}</div>` : ''}
    ${w.length ? `<div class="blWarn">⚠️ ${w.map(esc).join('・')}</div>` : c.total != null ? '<div class="blOk">✅ 金額和明細一致</div>' : ''}
    ${b.items.length ? `<div class="blItems">${b.items.slice(0, 6).map(x => `<div><span class="grow">${esc(x.n)}${x.q > 1 ? ' ×' + x.q : ''}</span><span class="muted">${esc(pplNames(x.ppl)) || '—'}</span><b>${money(numP(x.amt) - (c.itemDisc[x.id] || 0))}</b></div>`).join('')}${b.items.length > 6 ? `<div class="muted small">…還有 ${b.items.length - 6} 項</div>` : ''}</div>` : ''}</div>`;
}
const billKey = b => Object.keys(DB.bills).find(k => DB.bills[k].includes(b)) || '';
/* 日期選擇器：和月曆同樣的外觀，點一天就選好 */
function datePick(k0) {
  return new Promise(res => { let done = false, sel = k0, d0 = ymdDate(k0), Y = d0.getFullYear(), Mo = d0.getMonth();
    const sh = sheet({title: '選擇日期', onClose() { if (!done) res(null); }}), today = ymd(new Date());
    const draw = () => { const first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(); let cells = '';
      for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
      for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), dow = (first.getDay() + d - 1) % 7; cells += `<button class="cd ${k === sel ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${dayBills(k).length ? '<em class="dot"></em>' : ''}</button>`; }
      sh.body.innerHTML = `<div class="cal dpCal">${calHead(Y, Mo)}<div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG">${cells}</div></div><button class="btn block ymNow" data-a="today">📅 今天</button>`; };
    draw(); sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-d]'); if (!t) return; buzz(8);
      const fin = v => { done = true; sh.close(); res(v); };
      if (t.dataset.d) { fin(t.dataset.d); return; } const a = t.dataset.a;
      if (a === 'today') fin(today);
      else if (a === 'pm' || a === 'nm') { const d = new Date(Y, Mo + (a === 'pm' ? -1 : 1), 1); Y = d.getFullYear(); Mo = d.getMonth(); draw(); }
      else if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Y, Mo, a === 'ymY' ? 'y' : 'm'); if (r) { [Y, Mo] = r; draw(); } } }); });
}
const curBill = id => dayBills(Shop.sel).find(b => b.id === id);
function shopChanged() { Object.keys(DB.bills).forEach(k => { if (!DB.bills[k].length) delete DB.bills[k]; }); saveBills(); if (curTab === 'Shop') renderShop(); document.dispatchEvent(new Event('fm:shop')); }
function gotoBill(k, id) { if (S.mode !== 'shop') setMode('shop', true); const d = ymdDate(k); Shop.sel = k; Shop.ym = [d.getFullYear(), d.getMonth()]; showTab('Shop'); const b = curBill(id); if (b) editBill(b); }
function shopPlaceHtml(p) {
  const L = []; Object.keys(DB.bills).sort().reverse().forEach(k => DB.bills[k].forEach(b => { if (b.place === p.id) L.push({k, b}); }));
  const tot = L.reduce((s, r) => s + billCalc(r.b).computed, 0);
  return `<div class="h3"><span class="grow">🧾 購物紀錄 <span class="muted small" style="font-weight:600">${L.length ? L.length + ' 筆・' + money(tot) : ''}</span></span></div>
    <div class="mBtns"><button class="btn pri" data-a="sbNew">＋ 新增這家店的明細</button></div>
    ${L.length ? L.slice(0, 30).map(r => `<button class="srD" data-a="sbGo" data-k="${r.k}" data-id="${r.b.id}"><div class="row"><b class="grow">${dayLabel(r.k)}${r.b.time ? ' ' + esc(r.b.time) : ''}</b><span class="srA">${money(billCalc(r.b).computed)}</span></div><div class="srL">${esc(r.b.items.slice(0, 4).map(x => x.n).join('、'))}${r.b.items.length > 4 ? '…' : ''}</div></button>`).join('') : '<div class="empty" style="padding:1rem">這家店還沒有購物紀錄</div>'}`;
}

function initShop() {
  const box = $('#shopBody');
  $('#shopToday').onclick = () => { const d = new Date(); Shop.sel = ymd(d); Shop.ym = [d.getFullYear(), d.getMonth()]; renderShop(); };
  $('#shopNewImg').onclick = () => newBillImg(); $('#shopNewMan').onclick = () => newBillManual();
  $('#shopSet').onclick = () => openShopSettings(); $('#shopFind').onclick = () => openShopSearch();
  box.addEventListener('change', e => { if (e.target.id === 'sCalY') Shop.ym[0] = +e.target.value; else if (e.target.id === 'sCalM') Shop.ym[1] = +e.target.value; else return;
    const nd = new Date(Shop.ym[0], Shop.ym[1] + 1, 0).getDate(); Shop.sel = ymd(new Date(Shop.ym[0], Shop.ym[1], Math.min(ymdDate(Shop.sel).getDate(), nd))); renderShop(); });
  box.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-d]'); if (!t) return;
    if (t.dataset.d) { Shop.sel = t.dataset.d; renderShop(); return; }
    const a = t.dataset.a, card = t.closest('.bill'), b = card && curBill(card.dataset.b);
    if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Shop.ym[0], Shop.ym[1], a === 'ymY' ? 'y' : 'm'); if (!r) return; Shop.ym = r; const nd = new Date(r[0], r[1] + 1, 0).getDate(); Shop.sel = ymd(new Date(r[0], r[1], Math.min(ymdDate(Shop.sel).getDate(), nd))); renderShop(); return; }
    if (a === 'pm' || a === 'nm') { const d = new Date(Shop.ym[0], Shop.ym[1] + (a === 'pm' ? -1 : 1), 1); Shop.ym = [d.getFullYear(), d.getMonth()]; const nd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); Shop.sel = ymd(new Date(d.getFullYear(), d.getMonth(), Math.min(ymdDate(Shop.sel).getDate(), nd))); renderShop(); }
    else if (a === 'newImg') newBillImg(); else if (a === 'newMan') newBillManual();
    else if (a === 'exportDay') openShopExport(Shop.sel);
    else if (b && a === 'edit') editBill(b); else if (b && a === 'bMore') billMore(b); });
  box.addEventListener('click', e => { const card = e.target.closest('.bill'); if (card && !e.target.closest('button')) { const b = curBill(card.dataset.b); if (b) editBill(b); } });
}
function billMore(b) {
  const sh = sheet({title: '🧾 ' + (billStore(b) || '購物明細'), html: `<div class="actList"><button data-a="exp">📤 匯出這筆（文字／Excel）</button>${(b.imgs || []).length ? '<button data-a="imgs">🖼️ 看明細圖片</button>' : ''}${shopPlaces().some(p => p.id === b.place) ? '<button data-a="open">🏪 打開店家</button>' : ''}<button data-a="move">📅 改到其他日期</button><button data-a="del" class="dng">🗑 刪除這筆</button></div>`});
  sh.body.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a; sh.close();
    if (a === 'exp') openShopExport(Shop.sel, b.id);
    else if (a === 'imgs') Viewer.open(b.imgs.map((id, i) => ({id, label: `明細圖片 ${i + 1}/${b.imgs.length}`})), 0, billStore(b));
    else if (a === 'open') openPlace(b.place);
    else if (a === 'move') { const v = await askText('改到哪一天？（年-月-日）', Shop.sel); if (!v) return; const k = v.trim().replace(/[/.]/g, '-'), d = new Date(k + 'T00:00'); if (isNaN(d)) { toast('日期格式不正確'); return; }
      const L = dayBills(Shop.sel); L.splice(L.indexOf(b), 1); (DB.bills[ymd(d)] = DB.bills[ymd(d)] || []).push(b); shopChanged(); toast('已移到 ' + ymd(d)); }
    else if (a === 'del') { if (!await ask('確定要刪除這筆購物明細嗎？', '刪除', true)) return; const L = dayBills(Shop.sel); L.splice(L.indexOf(b), 1); for (const id of b.imgs || []) await imgDel(id); shopChanged(); } };
}

/* ---------- 新增：手動或上傳圖片 ---------- */
function newBill(p) { if (S.mode !== 'shop') setMode('shop', true); showTab('Shop'); const sh = sheet({title: '新增「' + p.name + '」的明細', html: `<div class="actList"><button data-a="img">📷 上傳明細照片／截圖（AI 辨識）</button><button data-a="man">✏️ 手動輸入</button></div>`});
  sh.body.onclick = e => { const t = e.target.closest('[data-a]'); if (!t) return; sh.close(); if (t.dataset.a === 'img') newBillImg(p); else newBillManual(p); }; }
async function newBillManual(p) {
  if (!p) { const st = await pickShopStore(); if (st === undefined) return; p = st; }
  const b = {id: 'b' + uid(), place: p && p.id || '', pname: p ? p.name : '', time: '', total: '', imgs: [], items: [], disc: [], odisc: [], fees: [], src: 'manual'};
  (DB.bills[Shop.sel] = DB.bills[Shop.sel] || []).push(b); shopChanged(); editBill(b);
}
async function newBillImg(p) { const fs = await pickImages(true); if (!fs.length) return; shopFromBlobs(fs, p); }
async function shopFromBlobs(fs, p) {
  if (!S.aikey) { needAiKey(); return; }
  busy('存入圖片中…'); const imgs = []; try { for (const f of fs) imgs.push(await imgStore(f, 2600)); } catch (er) { busy(false); toast('❌ ' + er.message, 4000); return; } busy(false);
  const b = {id: 'b' + uid(), place: p && p.id || '', pname: p ? p.name : '', time: '', total: '', imgs, items: [], disc: [], odisc: [], fees: [], src: 'ai', aiBusy: true};
  (DB.bills[Shop.sel] = DB.bills[Shop.sel] || []).push(b); shopChanged();
  toast('🤖 AI 辨識中，通常 10～30 秒，完成後會自動帶入', 3000);
  try { const j = await runReceipt(b); buzz(40); toast(`✅ 讀到 ${b.items.length} 項${j.store ? '・' + j.store : ''}，請確認每一項是誰付的`, 3500); } catch (er) { toast('❌ 明細辨識失敗：' + aiErrText(er), 6000); }
  shopChanged();
  const k = Object.keys(DB.bills).find(d => DB.bills[d].includes(b)); if (k && k !== Shop.sel) { const d = ymdDate(k); Shop.sel = k; Shop.ym = [d.getFullYear(), d.getMonth()]; renderShop(); }
  if (curTab === 'Shop') editBill(b);
}

/* ---------- AI 辨識明細 ---------- */
async function runReceipt(b) {
  b.aiBusy = true; const t0 = Date.now(); let base = '準備中…';
  const tick = () => { b.aiMsg = `${base}（${Math.round((Date.now() - t0) / 1000)} 秒）`; $$(`.rcMsg[data-b="${b.id}"]`).forEach(e => { e.textContent = b.aiMsg; }); };
  tick(); document.dispatchEvent(new Event('fm:shop')); const iv = setInterval(tick, 1000);
  try { const j = await receiptAI(b, t => { base = t; tick(); }); applyReceipt(b, j); return j; }
  finally { clearInterval(iv); delete b.aiBusy; delete b.aiMsg; }
}
/* ============================================================
   明細辨識（獨立流程，不和菜單辨識共用；用精簡的文字行格式串流回傳，最快）
   1. 圖片前處理：轉成灰階 JPEG、寬度 1000px；長截圖在「空白行」切成好幾段，避免字被縮到看不清楚
   2. 一次請求、不串流，要求 Gemini 直接回傳固定格式的 JSON（responseSchema），關閉思考 → 快
   3. Flash 不行自動換 Flash-Lite；額度、忙線、逾時各自處理
   4. 回來的結果用程式再清一次：去掉商品代碼、截斷的括號、0 元贈品、紅利
   ============================================================ */
const RC_PROMPT = `讀取這筆台灣購物明細（全聯／量販店 App 交易明細、發票收據、Foodpanda／Uber Eats 訂單）。圖片依序是同一筆明細的連續片段，片段之間不要重複。
只輸出下面格式的文字行，一行一筆，不要說明、不要 markdown：
店|店名（有分店就寫；Foodpanda 寫「訂購於」後面的餐廳名稱）
日期|YYYY-MM-DD
時間|HH:MM（24 小時制）
總額|消費金額或訂單總額（數字，還沒扣福利扣點）
福利扣點|數字
品|品名|數量|這一行的總金額|規格或品項下面的小字
折|折扣活動名稱|折扣金額（正數）|套用到第幾個「品」（從 1 開始，多個用逗號）
整單|整筆訂單的折扣或優惠券名稱|金額（正數）
費|平台費、外送服務費、包材費、小費、運費等|金額
規則：
1. 看不清楚或不確定的欄位直接留空白，馬上處理下一行，不要猶豫、不要猜。
2. 品名照圖片上的字抄，被截斷就照截斷抄；品名前面的兩位數商品代碼不要寫（「68 礦泉水1500」→「礦泉水1500」）。
3. 金額 0 元的贈品／印花、紅利抵現、付款方式（信用卡、現金）、找零、發票、載具都不要寫。
4. 「折」的套用品項依品牌、品名判斷，判斷不出來就留空白。
5. 外送：品項有劃線原價和折扣後價格時用折扣後價格；如果「小計」是原價加總、下面另外列折扣，品項用原價、那筆折扣寫成「整單」。免費（$0）的費用不寫。
6. 照明細上的順序輸出。`;
/* 圖片前處理：寬 1000、灰階、長圖在空白行切段（每段最高 1400px） */
async function rcPrep(blobs) {
  const out = [], W = 1000, H = 1400;
  for (const bl of blobs) {
    let bm; try { bm = await createImageBitmap(bl); } catch (e) { out.push(await imgPart(bl)); continue; }
    const sc = Math.min(1, W / bm.width), w = Math.round(bm.width * sc), h = Math.round(bm.height * sc);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', {willReadFrequently: true});
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.filter = 'grayscale(1) contrast(1.15)'; g.drawImage(bm, 0, 0, w, h); g.filter = 'none'; bm.close && bm.close();
    /* 找切點：在 [目標-260, 目標] 之間找「最像空白」的一行（像素變化最小） */
    const cuts = [0]; let y = 0;
    while (h - y > H) { const lo = y + H - 260, hi = y + H, d = g.getImageData(0, lo, w, hi - lo).data; let best = hi, bv = Infinity;
      for (let r = 0; r < hi - lo; r += 2) { let s = 0, s2 = 0, n = 0; for (let x = 0; x < w; x += 6) { const v = d[(r * w + x) * 4]; s += v; s2 += v * v; n++; } const va = s2 / n - (s / n) * (s / n); if (va < bv - 0.5) { bv = va; best = lo + r; } }
      cuts.push(best); y = best; }
    cuts.push(h);
    for (let i = 0; i < cuts.length - 1; i++) { const ph = cuts[i + 1] - cuts[i]; if (ph < 8) continue; const c2 = document.createElement('canvas'); c2.width = w; c2.height = ph; c2.getContext('2d').drawImage(cv, 0, cuts[i], w, ph, 0, 0, w, ph);
      const jb = await new Promise(r => c2.toBlob(r, 'image/jpeg', 0.86)); out.push(await imgPart(jb)); }
  }
  return out;
}
/* 思考設定：不同世代參數不同，被拒絕就換下一種 */
/* 串流請求：邊收邊解析，已經讀到的品項會即時顯示；太久沒有新資料就用已經收到的部分 */
async function rcStream(m, parts, think, onText) {
  const gc = {temperature: 0, maxOutputTokens: 4096}; if (think) gc.thinkingConfig = think;
  const body = JSON.stringify({contents: [{role: 'user', parts}], generationConfig: gc}), url = `${AI_BASE}/${encodeURIComponent(m)}`;
  const ctl = new AbortController(); let tm, text = '';
  const arm = ms => { clearTimeout(tm); tm = setTimeout(() => ctl.abort(), ms); }; arm(50000);
  const pick = c => ((c && c.content && c.content.parts) || []).map(p => p.thought ? '' : p.text || '').join('');
  try {
    let r;
    try { r = await fetch(url + ':streamGenerateContent?alt=sse', {method: 'POST', headers: aiHead(), body, signal: ctl.signal}); }
    catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('連線逾時'), {idle: true});
      if (IS_APP && NB.http) { clearTimeout(tm); const j = await jfetch(url + ':generateContent', {method: 'POST', headers: aiHead(), body}, 90000); if (j.error) throw aiErr(j); text = pick((j.candidates || [])[0]); onText(text); return text; }
      throw new Error('網路連線失敗，請確認網路'); }
    if (!r.ok) { const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {} if (Array.isArray(j)) j = j[0]; throw aiErr(j, r.status); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) { const {value, done} = await rd.read(); if (done) break; buf += dec.decode(value, {stream: true}); arm(25000);
      let i; while ((i = buf.indexOf('\n\n')) >= 0 || (i = buf.indexOf('\r\n\r\n')) >= 0) { const ev = buf.slice(0, i); buf = buf.slice(i + (buf[i] === '\r' ? 4 : 2));
        const data = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join(''); if (!data) continue; let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.error) throw aiErr(j); if (j.promptFeedback && j.promptFeedback.blockReason) throw Object.assign(new Error('AI 拒絕處理這張圖片（' + j.promptFeedback.blockReason + '）'), {fatalImg: true});
        const add = pick((j.candidates || [])[0]); if (add) { text += add; onText(text); } } }
    return text;
  } catch (e) { if (e.name === 'AbortError') { if (text) return text; throw Object.assign(new Error('AI 太久沒有回應'), {idle: true}); } throw e; }
  finally { clearTimeout(tm); }
}
/* 把文字行轉成資料（欄位空白就略過，不會整筆失敗） */
function rcParse(t) {
  const j = {store: '', date: '', time: '', total: 0, points: 0, items: [], discounts: [], orderDiscounts: [], fees: []};
  String(t || '').replace(/```\w*/g, '').split(/\r?\n/).forEach(line => {
    const f = line.split(/[|｜]/).map(x => x.trim()); if (f.length < 2) return; const k = f[0].replace(/^[-*•\s]+/, ''), num = v => { const n = parseFloat(String(v || '').replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; };
    if (k === '店') j.store = f[1]; else if (k === '日期') { const m = f[1].match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (m) j.date = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; }
    else if (k === '時間') { const m = f[1].match(/(\d{1,2}):(\d{2})/); if (m) j.time = m[1].padStart(2, '0') + ':' + m[2]; }
    else if (k === '總額') j.total = num(f[1]); else if (k === '福利扣點') j.points = Math.abs(num(f[1]));
    else if (k === '品') { const amt = num(f[3]); j.items.push({name: f[1] || (amt > 0 ? '（看不清楚的品項）' : ''), qty: num(f[2]) || 1, amount: amt, options: f[4] || ''}); }
    else if (k === '折') { if (num(f[2])) j.discounts.push({name: f[1] || '折扣', amount: Math.abs(num(f[2])), itemIndex: String(f[3] || '').split(/[,，、\s]+/).map(x => parseInt(x, 10) - 1).filter(x => x >= 0)}); }
    else if (k === '整單') { if (num(f[2])) j.orderDiscounts.push({name: f[1] || '整單折扣', amount: Math.abs(num(f[2]))}); }
    else if (k === '費') { if (num(f[2]) > 0) j.fees.push({name: f[1] || '費用', amount: num(f[2])}); } });
  return j;
}
async function receiptAI(b, onMsg) {
  if (!S.aikey) throw new Error('NOKEY'); const say = t => { if (onMsg) onMsg(t); };
  say('準備圖片…'); const blobs = []; for (const id of b.imgs) { const bl = await imgBlob(id); if (bl) blobs.push(bl); } if (!blobs.length) throw new Error('找不到明細圖片');
  const imgs = await rcPrep(blobs), parts = [{text: RC_PROMPT}, ...imgs];
  const order = await aiOrder(), t0 = Date.now(), errs = []; let last = null, best = null;
  const TH = [{thinkingLevel: 'minimal'}, {thinkingBudget: 0}, null];
  S.rcTh = S.rcTh || {};
  for (const m of order) {
    if (AIQ.blocked(m)) continue;
    let ti = S.rcTh[m] != null ? S.rcTh[m] : (/gemini-2\./.test(m) ? 1 : 0), tries = 0;
    while (ti < TH.length && tries < 3) {
      say(`${aiShort(m)} 讀取 ${imgs.length} 張圖中…`);
      try { const text = await rcStream(m, parts, TH[ti], t => { const n = (t.match(/^\s*品[|｜]/gm) || []).length; if (n) say(`${aiShort(m)} 已讀到 ${n} 項…`); });
        AIQ.inc(m); if (S.rcTh[m] !== ti) { S.rcTh[m] = ti; saveS(); }
        const j = rcParse(text); if (j.items.length) { AILOG.add({kind: '明細辨識', place: j.store || b.pname || '', model: m, ms: Date.now() - t0, ok: true, n: j.items.length}); return j; }
        best = best || j; last = new Error('AI 沒有讀到任何品項'); errs.push(aiShort(m) + '：沒有品項'); break; }
      catch (e) { e.model = e.model || m; last = e; errs.push(aiShort(m) + '#' + ti + '：' + (e.raw || e.message));
        if (e.fatal || e.fatalImg) throw e;
        if (e.code === 400) { ti++; continue; }
        if (e.code === 429 && e.perDay) { AIQ.block(m, e.limit); break; }
        if (e.code === 429) { if (tries++ >= 1) break; const w = Math.min(60000, e.retryMs || 20000); say(`Google 限制每分鐘次數，${Math.ceil(w / 1000)} 秒後自動繼續…`); await sleep(w); continue; }
        if (e.gone) { S.aiM = null; saveS(); break; }
        if (e.idle || e.busy || /連線/.test(e.message)) { if (tries++ < 1) { say('連線不穩，重試中…'); await sleep(1500); continue; } break; }
        break; }
    }
  }
  AILOG.add({kind: '明細辨識', place: b.pname || '', model: last && last.model, ms: Date.now() - t0, ok: false, n: 0, err: errs.slice(-4).join('｜')});
  if (last && last.code === 400) last = Object.assign(new Error('Google 不接受這次的請求（' + (last.raw || '400') + '）'), {model: last.model});
  throw last || new Error('AI 沒有回應');
}
/* 品名清理：商品代碼、多餘空白、沒有收尾的括號 */
const RC_UNIT = '入包盒瓶罐組片條顆粒個件支卷抽克斤公升毫克兩串粒顆';
function rcName(n) {
  let s = String(n || '').replace(/[\u3000\s]+/g, ' ').trim();
  let m = s.match(/^(\d{2})\s+(\S.*)$/); if (m && !RC_UNIT.includes(m[2][0])) s = m[2];
  else { m = s.match(/^(\d{2})([\u4e00-\u9fff].*)$/); if (m && !RC_UNIT.includes(m[2][0]) && m[2].length >= 2) s = m[2]; }
  s = s.replace(/^[*＊#＃\-－.。、]+\s*/, '');
  const o = (s.match(/[（(]/g) || []).length, c = (s.match(/[）)]/g) || []).length; if (o > c) s = s.replace(/\s*[（(]\s*$/, '');
  return s.trim();
}
function applyReceipt(b, j) {
  const clean = rcName;
  const its = [], idxMap = {}; (j.items || []).forEach((x, i) => { const n = clean(x.name), amt = numP(x.amount); if (!n || !(amt > 0) || /紅利|點數折抵|印花|福利扣點|福利點|儲值|找零/.test(n)) return; const it = {id: 'x' + uid(), n, q: Math.max(1, numP(x.qty) || 1), amt, o: String(x.options || '').trim(), ppl: []}; its.push(it); idxMap[i] = it.id; });
  b.items = its;
  b.disc = (j.discounts || []).filter(d => numP(d.amount)).map(d => { const ids = (d.itemIndex || d.items || []).map(i => idxMap[i]).filter(Boolean); return {id: 'd' + uid(), n: String(d.name || '折扣').trim(), amt: Math.abs(numP(d.amount)), items: ids, auto: !!ids.length}; });
  b.disc.forEach(d => { if (!d.items.length) { const ids = guessDiscItems(d.n, b.items); if (ids.length) { d.items = ids; d.auto = true; } } });
  let pts = Math.abs(numP(j.points)) || 0; (j.orderDiscounts || []).forEach(d => { if (/福利|扣點/.test(d.name || '') && !pts) pts = Math.abs(numP(d.amount)); });
  b.odisc = (j.orderDiscounts || []).filter(d => numP(d.amount) && !/紅利|福利|扣點|回饋|儲值/.test(d.name || '')).map(d => ({id: 'o' + uid(), n: String(d.name || '整單折扣').trim(), amt: Math.abs(numP(d.amount)), ppl: []}));
  b.fees = (j.fees || []).filter(d => numP(d.amount) > 0).map(d => ({id: 'f' + uid(), n: String(d.name || '費用').trim(), amt: numP(d.amount), ppl: []}));
  if (pts > 0) b.odisc.unshift({id: 'o' + uid(), n: '福利扣點', amt: pts, ppl: []});
  if (j.total != null && j.total !== '' && numP(j.total) > 0) b.total = Math.round((numP(j.total) - pts) * 100) / 100;
  if (/^\d{1,2}:\d{2}/.test(j.time || '')) b.time = String(j.time).slice(0, 5);
  if (j.store && !b.place) { const st = matchShopStore(String(j.store)); if (st) { b.place = st.id; b.pname = st.name; } else b.pname = String(j.store).trim(); }
  /* 明細上的日期 → 放到那一天 */
  if (/^\d{4}-\d{2}-\d{2}$/.test(j.date || '') && !isNaN(new Date(j.date + 'T00:00'))) { const from = Object.keys(DB.bills).find(d => DB.bills[d].includes(b)); if (from && from !== j.date) { DB.bills[from].splice(DB.bills[from].indexOf(b), 1); (DB.bills[j.date] = DB.bills[j.date] || []).push(b); } }
  /* 預設全部給上次常用的人（只有一個人時） */
  if (DB.mcfg.people.length === 1) { const id = DB.mcfg.people[0].id; b.items.forEach(x => { x.ppl = [id]; }); b.odisc.concat(b.fees).forEach(d => { d.ppl = [id]; }); }
}
/* 折扣名稱對不到品項時：用相同的字（至少 2 個字）找最像的品項 */
function guessDiscItems(name, items) {
  const s = String(name || '').replace(/任買|卡友|全系列|特價|優惠|促銷|折抵|折扣|買\d*送\d*|\d+[元組盒包杯瓶入件個袋]|\$?\d+|[折元組盒包杯瓶入件個袋\s\-－:：、,，.。]/g, ' ');
  const toks = []; s.split(/\s+/).filter(t => t.length >= 2).forEach(t => { for (let L = Math.min(t.length, 6); L >= 2; L--) for (let i = 0; i + L <= t.length; i++) toks.push(t.slice(i, i + L)); });
  let best = 0, ids = []; items.forEach(x => { const n = x.n; let sc = 0; toks.forEach(t => { if (n.includes(t)) sc = Math.max(sc, t.length); }); if (sc > best) { best = sc; ids = [x.id]; } else if (sc && sc === best) ids.push(x.id); });
  return best >= 2 ? ids : [];
}
function matchShopStore(name) {
  const L = shopPlaces(); let best = null, sc = 0; const n = name.replace(/\s+/g, '');
  L.forEach(p => { const pn = p.name.replace(/\s+/g, ''); const k = pn.includes(n) || n.includes(pn) ? 99 : lcsStr(n, pn).length; if (k > sc) { sc = k; best = p; } });
  return sc >= 3 ? best : null;
}

/* ---------- 選店家、選人 ---------- */
function pickShopStore(cur) {
  return new Promise(res => { let done = false, q = ''; const sh = sheet({title: '選擇店家', full: true, onClose() { if (!done) res(undefined); }}); const fin = v => { done = true; sh.close(); res(v); };
    const draw = () => { const hit = p => !q || (p.name + ' ' + (p.addr || '')).toLowerCase().includes(q), cats = DB.side.shop.cats.concat([UNCAT]);
      const secs = cats.map(c => ({c, ps: shopPlaces().filter(p => (c.id ? p.cat === c.id : !cats.some(x => x.id && x.id === p.cat)) && hit(p))})).filter(s => s.ps.length);
      $('#psL', sh.body).innerHTML = secs.map(({c, ps}) => `<div class="psSec" style="--c:${c.color}"><div class="psSH"><span>${esc(c.icon)}</span>${esc(c.name)}</div>${ps.map(p => `<button class="psP ${p.id === cur ? 'on' : ''}" data-id="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.addr || '')}</small></button>`).join('')}</div>`).join('')
        || `<div class="empty">${shopPlaces().length ? '找不到符合的店家' : '還沒有收藏店家<br><span class="small">可以到地圖頁搜尋全聯、全家…加入「我的店家」，或用上面的「自己輸入店名」</span>'}</div>`; };
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.7rem"><input id="psQ" type="search" placeholder="搜尋我的店家…"></div><div class="row" style="margin-bottom:.7rem;gap:.5rem"><button class="btn sm" data-a="free">✏️ 自己輸入店名</button><button class="btn sm" data-a="none">先不選店家</button></div><div id="psL"></div>`;
    draw(); $('#psQ', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.id) fin(shopPlaces().find(p => p.id === t.dataset.id)); else if (t.dataset.a === 'none') fin(null);
      else if (t.dataset.a === 'free') { const v = ((await askText('店名', '', '例如：好鄰居超市 中央店')) || '').trim(); if (v) fin({id: '', name: v.slice(0, 40)}); } }); });
}
function pickPeople(cur, title, allowNone) {
  return new Promise(res => { let done = false; const sel = new Set(cur || []);
    const sh = sheet({title: title || '選擇人', foot: '<div class="grow ordTot" id="ppT"></div><button class="btn pri" data-a="ok" style="flex:0 0 auto">確定</button>', onClose() { if (!done) res(null); }});
    const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">選 1 個人＝這個人付；選好幾個人＝平均分攤</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-id="${u.id}" class="${sel.has(u.id) ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}</button>`).join('')}<button data-a="all" class="add">全部的人</button><button data-a="newWho" class="add">＋ 新增人名</button></div>`;
      $('#ppT', sh.foot).innerHTML = sel.size ? `${sel.size} 人：${esc(pplNames(pOrder([...sel])))}` : '還沒選人'; };
    draw(); sh.body.onclick = e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.a === 'all') { DB.mcfg.people.forEach(u => sel.add(u.id)); draw(); return; }
      if (t.dataset.a === 'newWho') { editMealCfg('people', null, u => { if (u) sel.add(u.id); draw(); }); return; }
      if (sel.has(t.dataset.id)) sel.delete(t.dataset.id); else sel.add(t.dataset.id); draw(); };
    sh.foot.onclick = e => { if (!e.target.closest('[data-a="ok"]')) return; if (!sel.size && !allowNone) { toast('請至少選 1 個人'); return; } done = true; sh.close(); res(pOrder([...sel])); }; });
}

/* ---------- 編輯一筆明細 ---------- */
function editBill(b) {
  let qs = null; const sh = sheet({title: '🧾 ' + (billStore(b) || '購物明細'), full: true, foot: '<div class="grow ordTot" id="ebT"></div><button class="btn pri" data-a="done" style="flex:0 0 auto">完成</button>', onClose() { shopChanged(); }});
  const chips = ids => (ids || []).length ? `<span class="pplC">${ids.map(id => `<i>${esc(mWho(id).icon)}${esc(mWho(id).name)}</i>`).join('')}</span>` : '<span class="pplC none">選誰付</span>';
  const draw = () => { const c = billCalc(b), ids = pOrder(Object.keys(c.per)), top = sh.body.scrollTop;
    sh.body.innerHTML = `${b.aiBusy ? `<div class="jobBar"><span class="spin"></span><span class="grow">AI 辨識中…<small class="rcMsg" data-b="${b.id}">${esc(b.aiMsg || '')}</small></span></div>` : ''}
      <div class="ebHead"><button class="ebF" data-a="store"><small>店家</small><b>${esc(billStore(b) || '未選店家')}</b></button><div class="ebF ebDate"><small>日期</small><div class="edRow"><button class="edGo" data-a="goDay"><b>${dayLabel(billKey(b) || Shop.sel)}</b><span>到月曆 ›</span></button><button class="edPick" data-a="pickDate">更改 ${TRI_D}</button></div></div><label class="ebF"><small>時間</small><input type="time" id="ebTime" value="${esc(b.time || '')}"></label><label class="ebF"><small>明細上的實付金額</small><input id="ebTotal" inputmode="decimal" placeholder="選填，用來驗算" value="${b.total == null ? '' : esc(b.total)}"></label></div>
      ${(b.imgs || []).length ? `<div class="ebImgs">${b.imgs.map((id, i) => `<button class="ebImg" data-a="img" data-i="${i}"><img data-img="${id}" alt=""></button>`).join('')}<button class="btn sm" data-a="reAI" ${b.aiBusy ? 'disabled' : ''}>🔄 重新辨識</button></div>` : ''}
      <div class="ebSec"><div class="msH"><b class="grow">🛍️ 品項（${b.items.length}）</b><button class="btn sm" data-a="addItem">＋ 品項</button></div>
        ${b.items.length ? `<div class="ebQuick"><span>還沒選人的全部給：</span>${DB.mcfg.people.map(u => `<button data-a="qAll" data-id="${u.id}">${esc(u.icon)}${esc(u.name)}</button>`).join('')}<button data-a="qShare">👥 大家一起分</button></div>` : ''}
        ${b.items.map(x => { const dsc = c.itemDisc[x.id] || 0; return `<div class="ebR ${(x.ppl || []).length ? '' : 'warn'}" data-x="${x.id}"><div class="grow" data-a="editItem"><b>${esc(x.n)}</b>${x.o ? `<small>${esc(x.o)}</small>` : ''}<small>${x.q > 1 ? `${x.q} × ${money(numP(x.amt) / x.q)} = ` : ''}${money(x.amt)}${dsc ? ` <span class="dscT">折 -${money(dsc)}</span> → <b>${money(numP(x.amt) - dsc)}</b>` : ''}</small></div><button class="ebW" data-a="who">${chips(x.ppl)}</button></div>`; }).join('') || '<div class="empty" style="padding:.8rem">還沒有品項，按「＋ 品項」手動輸入</div>'}</div>
      <div class="ebSec"><div class="msH"><b class="grow">🏷️ 品項折扣（${(b.disc || []).length}）</b><button class="btn sm" data-a="addDisc">＋ 折扣</button></div><div class="small muted" style="margin:-.2rem 0 .4rem">例如「任買2組229元 -138」：勾選套用的品項，折扣會平均分到那些品項</div>
        ${(b.disc || []).map(d => `<div class="ebR ${(d.items || []).length ? '' : 'warn'}" data-d="${d.id}"><div class="grow" data-a="editDisc"><b>${esc(d.n)}</b><small class="dscT">-${money(d.amt)}</small>${d.auto ? '<small class="muted">AI 自動配對，請確認</small>' : ''}</div><button class="ebW" data-a="discItems">${(d.items || []).length ? `<span class="pplC">${d.items.map(id => { const x = b.items.find(y => y.id === id); return x ? `<i>${esc(x.n.slice(0, 8))}</i>` : ''; }).join('')}</span>` : '<span class="pplC none">勾選品項</span>'}</button></div>`).join('')}</div>
      <div class="ebSec"><div class="msH"><b class="grow">🎟️ 整單折扣・優惠券（${(b.odisc || []).length}）</b><button class="btn sm" data-a="addOd">＋</button></div>
        ${(b.odisc || []).map(d => `<div class="ebR ${(d.ppl || []).length ? '' : 'warn'}" data-o="${d.id}"><div class="grow" data-a="editOd"><b>${esc(d.n)}</b><small class="dscT">-${money(d.amt)}${(d.ppl || []).length > 1 ? `（每人 -${money(d.amt / d.ppl.length)}）` : ''}</small></div><button class="ebW" data-a="odWho">${chips(d.ppl)}</button></div>`).join('')}</div>
      <div class="ebSec"><div class="msH"><b class="grow">🛵 費用（平台費、外送費、包材費…）（${(b.fees || []).length}）</b><button class="btn sm" data-a="addFee">＋</button></div>
        ${(b.fees || []).map(d => `<div class="ebR ${(d.ppl || []).length ? '' : 'warn'}" data-f="${d.id}"><div class="grow" data-a="editFee"><b>${esc(d.n)}</b><small>${money(d.amt)}${(d.ppl || []).length > 1 ? `（每人 ${money(d.amt / d.ppl.length)}）` : ''}</small></div><button class="ebW" data-a="feeWho">${chips(d.ppl)}</button></div>`).join('')}</div>
      <div class="ebSum card"><div class="psR"><span class="grow">品項合計</span><span>${money(c.sumItems)}</span></div>${c.sumDisc ? `<div class="psR"><span class="grow">品項折扣</span><span class="dscT">-${money(c.sumDisc)}</span></div>` : ''}${c.sumOd ? `<div class="psR"><span class="grow">整單折扣</span><span class="dscT">-${money(c.sumOd)}</span></div>` : ''}${c.sumFee ? `<div class="psR"><span class="grow">費用</span><span>+${money(c.sumFee)}</span></div>` : ''}
        <div class="psR tot"><b class="grow">應付合計</b><span>${money(c.computed)}</span></div>
        ${c.total != null ? `<div class="psR ${c.diff ? 'bad' : 'good'}"><span class="grow">${c.diff ? '⚠️ 和明細上的實付金額不同' : '✅ 和明細上的實付金額一致'}</span><span>${money(c.total)}${c.diff ? `（差 ${money(c.diff)}）` : ''}</span></div>` : ''}
        ${ids.map(id => `<div class="psR"><span class="psI">${esc(mWho(id).icon)}</span><b class="grow">${esc(mWho(id).name)}</b><span>${money(c.per[id])}</span></div>`).join('')}
        ${c.unassigned ? `<div class="psR bad"><span class="grow">還沒分配的金額</span><span>${money(c.unassigned)}</span></div>` : ''}</div>`;
    $$('img[data-img]', sh.body).forEach(async im => { im.src = await imgURL(im.dataset.img); });
    $('#ebT', sh.foot).innerHTML = billWarn(c).length ? `<span style="color:var(--danger)">⚠️ ${esc(billWarn(c)[0])}</span>` : `應付 <b>${money(c.computed)}</b>`;
    sh.body.scrollTop = top; };
  draw(); const job = () => { if (!b.aiBusy) { document.removeEventListener('fm:shop', job); } if (!sh.closed) draw(); }; document.addEventListener('fm:shop', job);
  sh.body.addEventListener('change', e => { if (e.target.id === 'ebTime') { b.time = e.target.value; saveBills(); } else if (e.target.id === 'ebTotal') { b.total = e.target.value.trim() === '' ? '' : numP(e.target.value); saveBills(); draw(); } });
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a, row = t.closest('.ebR');
    const X = row && row.dataset.x && b.items.find(x => x.id === row.dataset.x), D = row && row.dataset.d && b.disc.find(d => d.id === row.dataset.d), O = row && row.dataset.o && b.odisc.find(d => d.id === row.dataset.o), F = row && row.dataset.f && b.fees.find(d => d.id === row.dataset.f);
    if (a === 'store') { const st = await pickShopStore(b.place); if (st === undefined) return; b.place = st ? st.id || '' : ''; b.pname = st ? st.name : ''; $('.shTitle', sh.el).textContent = '🧾 ' + (billStore(b) || '購物明細'); draw(); }
    else if (a === 'goDay') { const k = billKey(b); if (!k) return; while (sheets.length) sheets[sheets.length - 1].close(); const d = ymdDate(k); Shop.sel = k; Shop.ym = [d.getFullYear(), d.getMonth()]; showTab('Shop'); buzz(15);
      setTimeout(() => { const el = $(`.bill[data-b="${b.id}"]`); if (el) el.scrollIntoView({behavior: 'smooth', block: 'center'}); }, 80); }
    else if (a === 'pickDate') { const from = billKey(b), k = await datePick(from || Shop.sel); if (!k || k === from) return; if (from) DB.bills[from].splice(DB.bills[from].indexOf(b), 1); (DB.bills[k] = DB.bills[k] || []).push(b); shopChanged(); draw(); toast('已改到 ' + dayLabel(k)); }
    else if (a === 'img') Viewer.open(b.imgs.map((id, i) => ({id, label: `明細圖片 ${i + 1}/${b.imgs.length}`})), +t.dataset.i, billStore(b));
    else if (a === 'reAI') { if (b.items.length && !await ask('重新辨識會取代目前的品項、折扣和費用（你選的人也會清掉），確定嗎？', '重新辨識')) return; b.aiBusy = true; draw(); try { await runReceipt(b); toast('✅ 已重新辨識'); } catch (er) { toast('❌ ' + aiErrText(er), 6000); } draw(); shopChanged(); }
    else if (a === 'qAll' || a === 'qShare') { const ids = a === 'qAll' ? [t.dataset.id] : null; let L = ids; if (!L) { L = await pickPeople(DB.mcfg.people.map(u => u.id), '👥 這些品項由誰一起分？'); if (!L) return; } b.items.forEach(x => { if (!(x.ppl || []).length) x.ppl = L.slice(); }); buzz(15); draw(); }
    else if (a === 'who' && X) { const L = await pickPeople(X.ppl, `「${X.n}」誰付？`); if (L) { X.ppl = L; draw(); } }
    else if (a === 'odWho' && O) { const L = await pickPeople(O.ppl, `「${O.n}」由誰均攤？`); if (L) { O.ppl = L; draw(); } }
    else if (a === 'feeWho' && F) { const L = await pickPeople(F.ppl, `「${F.n}」由誰均攤？`); if (L) { F.ppl = L; draw(); } }
    else if (a === 'discItems' && D) { const L = await pickItems(b, D); if (L) { D.items = L; D.auto = false; draw(); } }
    else if (a === 'addItem' || (a === 'editItem' && X)) { await editBillItem(b, X); draw(); }
    else if (a === 'addDisc' || (a === 'editDisc' && D)) { await editAmtRow(b, 'disc', D); draw(); }
    else if (a === 'addOd' || (a === 'editOd' && O)) { await editAmtRow(b, 'odisc', O); draw(); }
    else if (a === 'addFee' || (a === 'editFee' && F)) { await editAmtRow(b, 'fees', F); draw(); } });
  sh.foot.addEventListener('click', e => { if (e.target.closest('[data-a="done"]')) sh.close(); });
}
function pickItems(b, d) {
  return new Promise(res => { let done = false; const sel = new Set(d.items || []);
    const sh = sheet({title: `「${d.n}」套用到哪些品項？`, full: true, foot: '<div class="grow ordTot" id="piT"></div><button class="btn pri" data-a="ok" style="flex:0 0 auto">確定</button>', onClose() { if (!done) res(null); }});
    const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">折扣 -${money(d.amt)} 會平均分到勾選的品項</div>${b.items.map(x => `<label class="mcR"><input type="checkbox" data-id="${x.id}" ${sel.has(x.id) ? 'checked' : ''}><div class="grow"><b>${esc(x.n)}</b><small>${x.q > 1 ? '×' + x.q + '・' : ''}${money(x.amt)}</small></div></label>`).join('')}`;
      $('#piT', sh.foot).innerHTML = sel.size ? `勾選 ${sel.size} 項，每項折 ${money(d.amt / sel.size)}` : '還沒勾選'; };
    draw(); sh.body.onchange = e => { const c = e.target.closest('[data-id]'); if (!c) return; if (c.checked) sel.add(c.dataset.id); else sel.delete(c.dataset.id); $('#piT', sh.foot).innerHTML = sel.size ? `勾選 ${sel.size} 項，每項折 ${money(d.amt / sel.size)}` : '還沒勾選'; };
    sh.foot.onclick = e => { if (!e.target.closest('[data-a="ok"]')) return; done = true; sh.close(); res(b.items.filter(x => sel.has(x.id)).map(x => x.id)); }; });
}
function editBillItem(b, x) {
  return new Promise(res => { const isNew = !x, d = x ? Object.assign({}, x) : {n: '', q: 1, amt: '', o: '', ppl: []};
    const sh = sheet({title: isNew ? '新增品項' : '編輯品項', foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`, onClose() { res(); }});
    sh.body.innerHTML = `<div class="field"><label>品名</label><input id="iN" value="${esc(d.n)}" maxlength="60"></div>
      <div class="iGrid"><div class="field"><label>單價</label><input id="iU" value="${d.amt !== '' && d.q ? esc(Math.round(numP(d.amt) / d.q * 100) / 100) : ''}" inputmode="decimal" placeholder="149"></div><div class="field"><label>數量</label><input id="iQ" value="${d.q}" inputmode="decimal"></div><div class="field"><label>總額</label><input id="iA" value="${esc(d.amt)}" inputmode="decimal" placeholder="298"></div></div>
      <div class="field"><label>規格／備註</label><input id="iO" value="${esc(d.o || '')}" maxlength="60" placeholder="例如 冰、燉飯"></div>
      <div class="field"><label>誰付（選好幾個人＝平均分攤）</label><div class="whoRow">${DB.mcfg.people.map(u => `<button data-id="${u.id}" class="${(d.ppl || []).includes(u.id) ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}</button>`).join('')}</div></div>`;
    const r2 = v => Math.round(v * 100) / 100, iU = $('#iU', sh.body), iQ = $('#iQ', sh.body), iA = $('#iA', sh.body);
    sh.body.addEventListener('input', e => { const q = numP(iQ.value) || 1; if (e.target === iU || e.target === iQ) { if (iU.value.trim() !== '') iA.value = r2(numP(iU.value) * q); } else if (e.target === iA) { if (iA.value.trim() !== '') iU.value = r2(numP(iA.value) / q); } });
    const ws = new Set(d.ppl || []); sh.body.onclick = e => { const t = e.target.closest('[data-id]'); if (!t) return; buzz(8); if (ws.has(t.dataset.id)) ws.delete(t.dataset.id); else ws.add(t.dataset.id); t.classList.toggle('on', ws.has(t.dataset.id)); };
    sh.foot.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return;
      if (t.dataset.a === 'del') { if (!await ask(`要刪除「${x.n}」嗎？`, '刪除', true)) return; b.items.splice(b.items.indexOf(x), 1); b.disc.forEach(dd => { dd.items = (dd.items || []).filter(id => id !== x.id); }); sh.close(); return; }
      const n = $('#iN', sh.body).value.trim(); if (!n) { toast('請輸入品名'); return; }
      const o = {n, q: Math.max(1, numP($('#iQ', sh.body).value) || 1), amt: numP($('#iA', sh.body).value), o: $('#iO', sh.body).value.trim(), ppl: pOrder([...ws])};
      if (isNew) b.items.push(Object.assign({id: 'x' + uid()}, o)); else Object.assign(x, o); sh.close(); }; });
}
function editAmtRow(b, key, r) {
  const L = b[key] = b[key] || [], isNew = !r, presets = key === 'fees' ? DB.scfg.fees : key === 'odisc' ? DB.scfg.odisc : [], title = {disc: '品項折扣', odisc: '整單折扣・優惠券', fees: '費用'}[key];
  return new Promise(res => { const d = r ? Object.assign({}, r) : {n: presets[0] || '', amt: ''};
    const sh = sheet({title: (isNew ? '新增' : '編輯') + title, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`, onClose() { res(); }});
    const canP = key !== 'disc', draw = () => { const nv = $('#aN', sh.body) ? $('#aN', sh.body).value : d.n, av = $('#aA', sh.body) ? $('#aA', sh.body).value : d.amt;
      sh.body.innerHTML = `${canP ? `<div class="lbl">常用名稱<span class="muted small">（長按可刪除）</span></div><div class="whoRow presetRow" style="margin-bottom:.7rem">${presets.map((p, i) => `<button data-p="${esc(p)}" data-i="${i}" class="${p === nv ? 'on' : ''}">${esc(p)}</button>`).join('')}<button class="add" data-a="addP">＋ 自訂名稱</button></div>` : ''}<div class="field"><label>名稱</label><input id="aN" value="${esc(nv)}" maxlength="60"></div>${canP ? `<label class="row small" style="gap:.4rem;margin:-.3rem 0 .7rem;color:var(--text-2)"><input type="checkbox" id="aKeep" style="width:auto" checked>沒有在常用名稱裡的，自動加進去</label>` : ''}<div class="field"><label>金額${key === 'fees' ? '' : '（折掉多少，填正數）'}</label><input id="aA" value="${esc(av)}" inputmode="decimal"></div>`; };
    draw();
    sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-p],[data-a="addP"]'); if (!t) return; buzz(8);
      if (t.dataset.a === 'addP') { const v = ((await askText('自訂名稱', '', '例如：福利扣點、會員折扣')) || '').trim(); if (!v) return; if (!presets.includes(v)) { presets.push(v); saveScfg(); } $('#aN', sh.body).value = v; draw(); return; }
      $('#aN', sh.body).value = t.dataset.p; draw(); });
    let lpT = null; sh.body.addEventListener('pointerdown', e => { const t = e.target.closest('[data-p]'); if (!t) return; lpT = setTimeout(async () => { lpT = null; buzz(30); if (!await ask(`從常用名稱刪除「${t.dataset.p}」？`, '刪除', true)) return; presets.splice(+t.dataset.i, 1); saveScfg(); draw(); }, 600); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => sh.body.addEventListener(ev, () => { clearTimeout(lpT); }));
    sh.foot.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return;
      if (t.dataset.a === 'del') { L.splice(L.indexOf(r), 1); sh.close(); return; }
      const n = $('#aN', sh.body).value.trim(), amt = Math.abs(numP($('#aA', sh.body).value)); if (!n || !amt) { toast('請輸入名稱和金額'); return; }
      if (canP && $('#aKeep', sh.body) && $('#aKeep', sh.body).checked && !presets.includes(n)) { presets.push(n); saveScfg(); }
      if (isNew) L.push(Object.assign({id: key[0] + uid(), n, amt}, key === 'disc' ? {items: []} : {ppl: []})); else Object.assign(r, {n, amt});
      if (key === 'odisc' && /福利|點數|扣點/.test(n)) ptFix(b, isNew ? 0 : numP(d.amt));
      sh.close(); }; });
}

/* 福利扣點：明細上的「消費金額」通常還沒扣點數 → 差額剛好等於扣點時，自動把實付金額改成扣完的 */
function ptFix(b, oldAmt, quiet) {
  if (b.total === '' || b.total == null) return; const c = billCalc(b), pts = (b.odisc || []).filter(d => /福利|點數|扣點/.test(d.n)).reduce((s, d) => s + numP(d.amt), 0);
  const delta = Math.round((numP(b.total) - c.computed) * 100) / 100;
  if (delta && (Math.abs(delta - pts) < 0.01 || Math.abs(delta - (pts - oldAmt)) < 0.01)) { b.total = Math.round(c.computed * 100) / 100; if (!quiet) toast('已把實付金額改成扣完福利扣點的 ' + money(b.total)); return true; }
}
/* ---------- 匯出（點餐模板二的格式） ---------- */
function billBlock(b) {
  const c = billCalc(b), out = [billStore(b) + (b.time ? ' ' + b.time : '')], ids = pOrder(Object.keys(c.per));
  ids.forEach(id => { out.push(mWho(id).name + '：');
    b.items.filter(x => (x.ppl || []).includes(id)).forEach(x => { const n = x.ppl.length, unit = (numP(x.amt) - (c.itemDisc[x.id] || 0)) / (x.q || 1); out.push(`${tn(x.n)}${x.o ? '(' + x.o + ')' : ''}[${ntd(unit)}]×${fq((x.q || 1) / n)}`); });
    (b.odisc || []).filter(d => (d.ppl || []).includes(id)).forEach(d => out.push(`${d.n}：-${ntd(d.amt / d.ppl.length)}`));
    (b.fees || []).filter(d => (d.ppl || []).includes(id)).forEach(d => out.push(`${d.n}：${ntd(d.amt / d.ppl.length)}`));
    out.push(`小計：${ntd(c.per[id])}`); });
  if (c.unassigned) out.push(`(還沒分配：${ntd(c.unassigned)})`);
  out.push(`合計：${ntd(c.computed)}`); return out;
}
function openShopExport(k, bid) {
  const bs = dayBills(k); if (!bs.length) { toast('這天沒有購物明細'); return; } let sel = bid || 'all';
  const sh = sheet({title: '📤 匯出購物分帳', full: true, foot: '<button class="btn" data-a="xlsx">📊 匯出 Excel</button><button class="btn pri" data-a="copy">📋 複製文字</button>'});
  const pick = () => sel === 'all' ? bs : bs.filter(b => b.id === sel);
  const text = () => { const L = pick(), out = [dayLabel(k)]; L.forEach((b, i) => { out.push(...billBlock(b)); if (i < L.length - 1) out.push(''); });
    if (L.length > 1) { const per = {}; L.forEach(b => { const c = billCalc(b); Object.keys(c.per).forEach(id => { per[id] = (per[id] || 0) + c.per[id]; }); }); out.push('', '每人總計：', ...pOrder(Object.keys(per)).map(id => `${mWho(id).name}：${ntd(per[id])}`), `全部合計：${ntd(L.reduce((s, b) => s + billCalc(b).computed, 0))}`); }
    return out.join('\n').replace(/（/g, '(').replace(/）/g, ')'); };
  const draw = () => { sh.body.innerHTML = `<div class="lbl">要匯出哪一筆</div><div class="whoRow" style="margin-bottom:.7rem"><button data-s="all" class="${sel === 'all' ? 'on' : ''}">📅 整天全部</button>${bs.map(b => `<button data-s="${b.id}" class="${sel === b.id ? 'on' : ''}">🧾 ${esc((billStore(b) || '明細').slice(0, 10))}${b.time ? ' ' + esc(b.time) : ''}</button>`).join('')}</div>
      <div class="lbl">統整文字（可以直接複製貼到 LINE）</div><textarea id="exT" class="exT" rows="14">${esc(text())}</textarea>`; };
  draw(); sh.body.addEventListener('click', e => { const t = e.target.closest('[data-s]'); if (t) { sel = t.dataset.s; draw(); } });
  sh.foot.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return;
    if (t.dataset.a === 'copy') copyText($('#exT', sh.body).value);
    else { try { const L = pick(), nm = `購物分帳_${k.replace(/-/g, '')}${sel === 'all' ? '' : '_' + (billStore(L[0]) || '明細').replace(/[\\/:*?"<>|\s]+/g, '')}.xlsx`; const p = await saveFile(nm, shopXlsx(k, L)); toast(IS_APP ? '已匯出到「下載」資料夾：' + p : '已下載 ' + nm, 4000); } catch (er) { toast('❌ 匯出失敗：' + er.message, 4000); } } });
}
function shopXlsx(k, L) {
  const rows = [[{v: '食光帳本 購物分帳　' + dayLabel(k), s: 2}], [], ['日期', '店家', '品項', '規格', '數量', '金額', '折扣', '實付', '誰付'].map(v => ({v, s: 1}))], per = {};
  L.forEach(b => { const c = billCalc(b), nm = billStore(b);
    b.items.forEach(x => { const dsc = c.itemDisc[x.id] || 0; rows.push([k, nm, x.n, x.o || '', x.q || 1, numP(x.amt), dsc ? -Math.round(dsc * 100) / 100 : '', Math.round((numP(x.amt) - dsc) * 100) / 100, pplNames(x.ppl) + ((x.ppl || []).length > 1 ? '（平均分攤）' : '') || '未指定']); });
    (b.odisc || []).forEach(d => rows.push([k, nm, d.n, '整單折扣', '', '', -numP(d.amt), -numP(d.amt), pplNames(d.ppl) || '未指定']));
    (b.fees || []).forEach(d => rows.push([k, nm, d.n, '費用', '', numP(d.amt), '', numP(d.amt), pplNames(d.ppl) || '未指定']));
    rows.push(['', nm, {v: '合計', s: 1}, '', '', '', '', {v: Math.round(c.computed * 100) / 100, s: 1}, '']);
    Object.keys(c.per).forEach(id => { per[id] = (per[id] || 0) + c.per[id]; }); });
  rows.push([], [{v: '每人要付', s: 1}]); pOrder(Object.keys(per)).forEach(id => rows.push([mWho(id).name, Math.round(per[id] * 100) / 100]));
  rows.push([], [{v: '統整文字', s: 1}]); L.forEach(b => billBlock(b).forEach(t => rows.push([t])));
  return xlsxBook(rows, [12, 20, 26, 14, 7, 9, 9, 9, 18], '購物分帳');
}
/* 通用 .xlsx 產生（手寫 OOXML + 不壓縮 zip） */
function xlsxBook(rows, widths, name) {
  const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'), col = i => String.fromCharCode(65 + i);
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((c, j) => { const o = c && typeof c === 'object' ? c : {v: c}, ref = col(j) + (i + 1), st = o.s ? ` s="${o.s}"` : '';
    return o.v === '' || o.v == null ? '' : typeof o.v === 'number' ? `<c r="${ref}"${st}><v>${o.v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${X(o.v)}</t></is></c>`; }).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return zipStore([
    {name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${X(name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="14"/><name val="Microsoft JhengHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEBDFC8"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
    {name: 'xl/worksheets/sheet1.xml', data: sheetXml}]);
}

/* ---------- 搜尋 ---------- */
function openShopSearch() {
  let q = ''; const sh = sheet({title: '🔍 搜尋購物紀錄', full: true});
  sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.8rem"><input id="ssQ" type="search" placeholder="輸入店名或商品，例如：全聯、衛生紙"></div><div id="ssR"></div>`;
  const draw = () => { const by = {};
    Object.keys(DB.bills).sort().reverse().forEach(k => DB.bills[k].forEach(b => { const nm = billStore(b) || '未選店家', hitItems = q ? b.items.filter(x => x.n.toLowerCase().includes(q)) : []; if (q && !nm.toLowerCase().includes(q) && !hitItems.length) return;
      const key = b.place || 'n:' + nm; (by[key] = by[key] || {nm, rows: []}).rows.push({k, b, hitItems}); }));
    const G = Object.values(by);
    $('#ssR', sh.body).innerHTML = G.length ? G.map(g => `<div class="srS"><div class="srH"><b class="grow">🏪 ${esc(g.nm)}</b><span class="muted">${g.rows.length} 筆 · ${money(g.rows.reduce((s, r) => s + billCalc(r.b).computed, 0))}</span></div>${g.rows.map(r => { const c = billCalc(r.b), ids = pOrder(Object.keys(c.per));
        return `<button class="srD" data-k="${r.k}" data-id="${r.b.id}"><div class="row"><b class="grow">${dayLabel(r.k)}${r.b.time ? ' ' + esc(r.b.time) : ''}</b><span class="srA">${money(c.computed)}</span></div>${(r.hitItems.length ? r.hitItems : r.b.items.slice(0, 3)).map(x => `<div class="srL">${esc(x.n)}${x.q > 1 ? '×' + x.q : ''} ${money(x.amt)}${(x.ppl || []).length ? '・' + esc(pplNames(x.ppl)) : ''}</div>`).join('')}${ids.length ? `<div class="srL muted">${ids.map(id => esc(mWho(id).name) + ' ' + money(c.per[id])).join('・')}</div>` : ''}</button>`; }).join('')}</div>`).join('')
      : `<div class="empty">${Object.keys(DB.bills).length ? '找不到符合的店家或商品' : '還沒有任何購物紀錄'}</div>`; };
  draw(); $('#ssQ', sh.body).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 200);
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-k]'); if (!t) return; sh.close(); gotoBill(t.dataset.k, t.dataset.id); });
}

/* ---------- 設定 ---------- */
function openShopSettings() {
  const sh = sheet({title: '⚙️ 分帳設定', full: true, onClose() { renderShop(); }});
  const list = (key, title, tip) => `<div class="msSec"><div class="msH"><b class="grow">${title}</b><button class="btn sm" data-a="add" data-k="${key}">＋ 新增</button></div><div class="small muted" style="margin:-.2rem 0 .5rem">${tip}</div><div class="msL" data-k="${key}">${DB.scfg[key].map((n, i) => `<div class="msR" data-i="${i}"><span class="grip"></span><b class="grow">${esc(n)}</b><button class="btn sm" data-a="ren">✎</button><button class="ic" data-a="del" style="color:var(--danger)" aria-label="刪除">🗑</button></div>`).join('')}</div></div>`;
  const draw = () => { const n = Object.values(DB.bills).reduce((s, L) => s + L.length, 0);
    sh.body.innerHTML = `<div class="msSec"><div class="msH"><b class="grow">人名</b><button class="btn sm" data-a="addP">＋ 新增</button></div><div class="small muted" style="margin:-.2rem 0 .5rem">和點餐共用同一份人名，按住 ☰ 拖曳排序</div>
        <div class="msL" data-k="people">${DB.mcfg.people.map(u => `<div class="msR" data-id="${u.id}"><span class="grip"></span><span class="msI">${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><button class="btn sm" data-a="editP">✎ 編輯</button></div>`).join('')}</div></div>
      ${list('fees', '費用名稱', '新增費用時可以一鍵選，例如平台費、外送服務費、包材費')}${list('odisc', '整單折扣名稱', '例如優惠券、整單折扣')}
      <div class="msSec"><div class="msH"><b class="grow">購物紀錄</b></div><div class="small muted">共有 ${n} 筆明細。紀錄會一起放進「設定 → 匯出備份」。</div>${n ? '<button class="btn sm danger" data-a="wipe" style="margin-top:.6rem">清除所有購物紀錄</button>' : ''}</div>`;
    $$('.msL', sh.body).forEach(l => sortable(l, {item: '.msR', handle: '.grip', scroller: sh.body, onSort(from, to) { const k = l.dataset.k; moveItem(k === 'people' ? DB.mcfg.people : DB.scfg[k], from, to); k === 'people' ? saveMcfg() : saveScfg(); draw(); }})); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a, row = t.closest('.msR'), k = (t.closest('.msL') || t).dataset.k;
    if (a === 'addP') editMealCfg('people', null, draw); else if (a === 'editP') editMealCfg('people', DB.mcfg.people.find(u => u.id === row.dataset.id), draw);
    else if (a === 'add') { const v = ((await askText('名稱', '')) || '').trim(); if (v) { DB.scfg[k].push(v); saveScfg(); draw(); } }
    else if (a === 'ren') { const i = +row.dataset.i, v = ((await askText('名稱', DB.scfg[k][i])) || '').trim(); if (v) { DB.scfg[k][i] = v; saveScfg(); draw(); } }
    else if (a === 'del') { DB.scfg[k].splice(+row.dataset.i, 1); saveScfg(); draw(); }
    else if (a === 'wipe') { if (!await ask('確定要清除「所有」購物紀錄嗎？這個動作無法復原。', '全部清除', true)) return; DB.bills = {}; saveBills(); draw(); } });
}
