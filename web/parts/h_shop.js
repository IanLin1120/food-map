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
const SHOP_FEES = ['平台費', '外送服務費', '包材費', '小費', '運費'], SHOP_OD = ['優惠券', '整單折扣', '滿額折抵'];
const saveBills = debounce(() => IDB.put('kv', 'bills', DB.bills).catch(saveErr), 200);
const saveScfg = debounce(() => IDB.put('kv', 'scfg', DB.scfg).catch(saveErr), 200);
async function loadShop() {
  DB.bills = await IDB.get('kv', 'bills').catch(() => null) || {}; Object.values(DB.bills).forEach(L => L.forEach(b => { delete b.aiBusy; }));
  DB.scfg = await IDB.get('kv', 'scfg').catch(() => null) || {fees: SHOP_FEES.slice(), odisc: SHOP_OD.slice()};
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
      <div class="calTop"><button class="ic" data-a="pm" aria-label="上個月">‹</button><select id="sCalY" aria-label="年">${yrs.map(y => `<option value="${y}" ${y === Y ? 'selected' : ''}>${y} 年</option>`).join('')}</select><select id="sCalM" aria-label="月">${Array.from({length: 12}, (_, i) => `<option value="${i}" ${i === Mo ? 'selected' : ''}>${i + 1} 月</option>`).join('')}</select><button class="ic" data-a="nm" aria-label="下個月">›</button></div>
      <div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG">${cells}</div></div>
    <div class="dayHead"><b class="dhD">${sel.getMonth() + 1}月${sel.getDate()}日 星期${MWD[sel.getDay()]}</b><span class="grow"></span>${bs.length ? `<span class="dayTot">${money(dayTot)}</span><button class="btn sm" data-a="exportDay">📤 匯出</button>` : ''}</div>
    ${bs.map(billCard).join('') || '<div class="empty mealEmpty"><span class="big">🧾</span>這天還沒有購物明細<br><span class="small">按下面的按鈕拍照、上傳截圖或手動輸入<br>也可以在 Foodpanda、相簿裡按「分享」傳給食光帳本</span></div>'}
    <div class="row" style="gap:.5rem;margin:.2rem 0 1rem"><button class="btn pri grow" data-a="newImg" style="border-radius:var(--r-sm)">📷 上傳明細（AI 辨識）</button><button class="btn grow" data-a="newMan" style="border-radius:var(--r-sm)">✏️ 手動輸入</button></div>
    ${order.length ? `<div class="perSum card"><div class="psH">👥 每個人這天要付</div>${order.map(id => { const u = mWho(id); return `<div class="psR"><span class="psI">${esc(u.icon)}</span><b class="grow">${esc(u.name)}</b><span>${money(per[id])}</span></div>`; }).join('')}<div class="psR tot"><b class="grow">合計</b><span>${money(dayTot)}</span></div></div>` : ''}`;
}
function billCard(b) {
  const c = billCalc(b), w = billWarn(c), ids = pOrder(Object.keys(c.per)), nm = billStore(b);
  return `<div class="meal card bill" data-b="${b.id}">
    <div class="mlH"><div class="grow"><b>${esc(nm || '未選店家')}</b><div class="mlS">${b.aiBusy ? '<span class="spin"></span> AI 辨識中・' : ''}${b.time ? '🕒 ' + esc(b.time) + '・' : ''}${b.items.length} 項${(b.imgs || []).length ? '・🖼️ ' + b.imgs.length : ''}</div></div><span class="blTot">${money(c.computed)}</span><button class="btn sm pri" data-a="edit">編輯</button><button class="ic" data-a="bMore" aria-label="更多">⋯</button></div>
    ${ids.length ? `<div class="blPer">${ids.map(id => `<span><i>${esc(mWho(id).icon)}</i>${esc(mWho(id).name)} <b>${money(c.per[id])}</b></span>`).join('')}</div>` : ''}
    ${w.length ? `<div class="blWarn">⚠️ ${w.map(esc).join('・')}</div>` : c.total != null ? '<div class="blOk">✅ 金額和明細一致</div>' : ''}
    <div class="blItems">${b.items.slice(0, 6).map(x => `<div><span class="grow">${esc(x.n)}${x.q > 1 ? ' ×' + x.q : ''}</span><span class="muted">${esc(pplNames(x.ppl)) || '—'}</span><b>${money(numP(x.amt) - (c.itemDisc[x.id] || 0))}</b></div>`).join('')}${b.items.length > 6 ? `<div class="muted small">…還有 ${b.items.length - 6} 項</div>` : ''}</div></div>`;
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
  $('#shopSet').onclick = () => openShopSettings(); $('#shopFind').onclick = () => openShopSearch();
  box.addEventListener('change', e => { if (e.target.id === 'sCalY') Shop.ym[0] = +e.target.value; else if (e.target.id === 'sCalM') Shop.ym[1] = +e.target.value; else return;
    const nd = new Date(Shop.ym[0], Shop.ym[1] + 1, 0).getDate(); Shop.sel = ymd(new Date(Shop.ym[0], Shop.ym[1], Math.min(ymdDate(Shop.sel).getDate(), nd))); renderShop(); });
  box.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-d]'); if (!t) return;
    if (t.dataset.d) { Shop.sel = t.dataset.d; renderShop(); return; }
    const a = t.dataset.a, card = t.closest('.bill'), b = card && curBill(card.dataset.b);
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
  toast('🤖 AI 辨識中，完成後會自動帶入（可以先做別的事）', 3500);
  try { await receiptAI(b); buzz(40); } catch (er) { toast('❌ 明細辨識失敗：' + aiErrText(er), 5000); }
  delete b.aiBusy; shopChanged();
  const k = Object.keys(DB.bills).find(d => DB.bills[d].includes(b)); if (k && k !== Shop.sel) { const d = ymdDate(k); Shop.sel = k; Shop.ym = [d.getFullYear(), d.getMonth()]; renderShop(); }
  if (curTab === 'Shop') editBill(b);
}

/* ---------- AI 辨識明細 ---------- */
const RECEIPT_PROMPT = `你是購物明細辨識助手。圖片是台灣的購物發票明細、量販店／超市 App（例如全聯 PX Pay）的交易明細，或 Foodpanda、Uber Eats 的訂單／購物車截圖；好幾張圖時是同一筆的不同部分。
請只輸出一個 JSON 物件（不要 markdown、不要說明），格式：
{"store":"店名（有分店就寫，例如 好鄰居超市 中央店、星星漢堡 幸福店）","date":"YYYY-MM-DD","time":"HH:MM","total":實際付款或消費金額（數字）,
"items":[{"name":"品名","qty":數量,"amount":這一行的金額（數字）,"options":"規格或套餐內容，沒有就空字串"}],
"discounts":[{"name":"折扣活動名稱","amount":折扣金額（正數）,"items":[套用到的品項在 items 裡的位置，從 0 開始]}],
"orderDiscounts":[{"name":"整單折扣或優惠券名稱","amount":正數}],
"fees":[{"name":"平台費、外送服務費、包材費、小費…","amount":數字}]}
規則：
1. 品名前面的兩位數商品代碼不要寫進品名，例如「68 礦泉水1500」寫成「礦泉水1500」。品名照抄，不要自己補字。
2. 金額 0 元的贈品、印花、點數（例如「印花貼紙(促)」）不要列。
3. 「紅利抵現」「點數折抵」「福利點」「回饋」「儲值金」「愛心捐款」全部忽略，不要寫進任何欄位。
4. 「優惠活動折扣」（例如「靠得住草本抑 任買2組229元 -138」）放 discounts，依品牌、品名判斷套用在哪幾個品項（品名可能被截斷、或折扣只寫品牌名稱）；真的判斷不出來就給空陣列 []。
5. 外送平台：品項同時顯示劃線原價和折扣後價格時，amount 用折扣後的價格；如果「小計」是原價加總、下面另外列「折扣 -55」，品項 amount 就用原價，那筆 -55 放 orderDiscounts。同一筆折扣只能算一次，不可以重複扣。優惠券（例如「85 折優惠 -$45」）放 orderDiscounts。
6. 免費的費用（$0、標示「免費」、被劃掉的原價）不要列，只列實際收的金額。
7. qty 寫數字，「2x」「×2」都是 2；amount 是整行金額（數量 × 單價）。
8. 外送品項下面的小字（例如「燉飯, 阿薩姆奶茶, 冰」）寫在 options。
9. 看不到的欄位寫空字串或 null，不要編造。`;
async function receiptAI(b) {
  const parts = [{text: RECEIPT_PROMPT}]; for (const id of b.imgs) { const bl = await imgBlob(id); if (bl) parts.push(await imgPart(bl)); }
  const r = await aiRun({contents: [{role: 'user', parts}], generationConfig: {temperature: 0, maxOutputTokens: 8192}, _hiRes: true}, {prefer: 'flash', keepPartial: true});
  AILOG.add({kind: '明細辨識', place: b.pname || '', model: r.model, ms: r.ms, ok: true, n: 0});
  const t = String(r.text || ''), m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('AI 沒有回傳可以讀的結果');
  let j; try { j = JSON.parse(m[0]); } catch (er) { j = JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1')); }
  applyReceipt(b, j);
}
function applyReceipt(b, j) {
  const clean = n => String(n || '').replace(/^\s*\d{2}\s+(?=\S)/, '').replace(/\s+/g, ' ').trim();
  const its = (j.items || []).map(x => ({id: 'x' + uid(), n: clean(x.name), q: Math.max(1, numP(x.qty) || 1), amt: numP(x.amount), o: String(x.options || '').trim(), ppl: []})).filter(x => x.n && x.amt > 0);
  const idxMap = {}; let k = 0; (j.items || []).forEach((x, i) => { const n = clean(x.name); if (n && numP(x.amount) > 0) idxMap[i] = its[k++].id; });
  b.items = its;
  b.disc = (j.discounts || []).filter(d => numP(d.amount)).map(d => { const ids = (d.items || []).map(i => idxMap[i]).filter(Boolean); return {id: 'd' + uid(), n: String(d.name || '折扣').trim(), amt: Math.abs(numP(d.amount)), items: ids, auto: !!ids.length}; });
  b.disc.forEach(d => { if (!d.items.length) { const ids = guessDiscItems(d.n, b.items); if (ids.length) { d.items = ids; d.auto = true; } } });
  b.odisc = (j.orderDiscounts || []).filter(d => numP(d.amount) && !/紅利|點數|福利點|回饋|儲值/.test(d.name || '')).map(d => ({id: 'o' + uid(), n: String(d.name || '整單折扣').trim(), amt: Math.abs(numP(d.amount)), ppl: []}));
  b.fees = (j.fees || []).filter(d => numP(d.amount) > 0).map(d => ({id: 'f' + uid(), n: String(d.name || '費用').trim(), amt: numP(d.amount), ppl: []}));
  if (j.total != null && j.total !== '') b.total = numP(j.total);
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
    sh.body.innerHTML = `${b.aiBusy ? '<div class="jobBar"><span class="spin"></span><span class="grow">AI 辨識中…<small>完成後會自動帶入</small></span></div>' : ''}
      <div class="ebHead"><button class="ebF" data-a="store"><small>店家</small><b>${esc(billStore(b) || '未選店家')}</b></button><label class="ebF"><small>時間</small><input type="time" id="ebTime" value="${esc(b.time || '')}"></label><label class="ebF"><small>明細上的實付金額</small><input id="ebTotal" inputmode="decimal" placeholder="選填，用來驗算" value="${b.total == null ? '' : esc(b.total)}"></label></div>
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
    else if (a === 'img') Viewer.open(b.imgs.map((id, i) => ({id, label: `明細圖片 ${i + 1}/${b.imgs.length}`})), +t.dataset.i, billStore(b));
    else if (a === 'reAI') { if (b.items.length && !await ask('重新辨識會取代目前的品項、折扣和費用（你選的人也會清掉），確定嗎？', '重新辨識')) return; b.aiBusy = true; draw(); try { await receiptAI(b); toast('✅ 已重新辨識'); } catch (er) { toast('❌ ' + aiErrText(er), 5000); } delete b.aiBusy; draw(); }
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
      <div class="row" style="gap:.6rem"><div class="field" style="width:5rem"><label>數量</label><input id="iQ" value="${d.q}" inputmode="decimal"></div><div class="field grow"><label>這一行的金額（數量 × 單價）</label><input id="iA" value="${esc(d.amt)}" inputmode="decimal" placeholder="例如 298"></div></div>
      <div class="field"><label>規格／備註</label><input id="iO" value="${esc(d.o || '')}" maxlength="60" placeholder="例如 冰、燉飯"></div>
      <div class="field"><label>誰付（選好幾個人＝平均分攤）</label><div class="whoRow">${DB.mcfg.people.map(u => `<button data-id="${u.id}" class="${(d.ppl || []).includes(u.id) ? 'on' : ''}"><span>${esc(u.icon)}</span>${esc(u.name)}</button>`).join('')}</div></div>`;
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
    sh.body.innerHTML = `${presets.length ? `<div class="whoRow" style="margin-bottom:.7rem">${presets.map(p => `<button data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}<div class="field"><label>名稱</label><input id="aN" value="${esc(d.n)}" maxlength="60"></div><div class="field"><label>金額${key === 'fees' ? '' : '（折掉多少，填正數）'}</label><input id="aA" value="${esc(d.amt)}" inputmode="decimal"></div>`;
    sh.body.onclick = e => { const t = e.target.closest('[data-p]'); if (t) $('#aN', sh.body).value = t.dataset.p; };
    sh.foot.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return;
      if (t.dataset.a === 'del') { L.splice(L.indexOf(r), 1); sh.close(); return; }
      const n = $('#aN', sh.body).value.trim(), amt = Math.abs(numP($('#aA', sh.body).value)); if (!n || !amt) { toast('請輸入名稱和金額'); return; }
      if (isNew) L.push(Object.assign({id: key[0] + uid(), n, amt}, key === 'disc' ? {items: []} : {ppl: []})); else Object.assign(r, {n, amt}); sh.close(); }; });
}

/* ---------- 匯出（點餐模板二的格式） ---------- */
function billBlock(b) {
  const c = billCalc(b), out = [billStore(b) + (b.time ? ' ' + b.time : '')], ids = pOrder(Object.keys(c.per));
  ids.forEach(id => { out.push(mWho(id).name + '：');
    b.items.filter(x => (x.ppl || []).includes(id)).forEach(x => { const n = x.ppl.length, unit = numP(x.amt) / (x.q || 1), dsc = (c.itemDisc[x.id] || 0) / n; out.push(`${tn(x.n)}${x.o ? '(' + x.o + ')' : ''}[${ntd(unit)}]×${fq((x.q || 1) / n)}${dsc ? `(折 -${ntd(dsc)})` : ''}`); });
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
