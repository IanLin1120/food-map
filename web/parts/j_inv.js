/* ============================================================
   發票區（購物分帳功能區）
   來源：① 掃描紙本電子發票的 QR Code（離線解析品項）
        ② 匯入財政部「載具消費明細」CSV
        ③ App 內開財政部電子發票平台，自己登入後讀取頁面上的發票（實驗性）
   ※ 直接用手機條碼連動載具、把紙本發票存進載具，需要財政部核發的 API 帳號（只發給營業人／組織），個人 App 做不到
   DB.invs = {'AB12345678': inv}
   inv = {no, date:'YYYY-MM-DD', time, sellerId, seller, total, items:[{n, q, p, amt}], src:'qr'|'csv'|'web', bill:{k,id}, add}
   ============================================================ */
const saveInvs = debounce(() => IDB.put('kv', 'invs', DB.invs).catch(saveErr), 200);
async function loadInv() { DB.invs = await IDB.get('kv', 'invs').catch(() => null) || {}; }
const Inv = {ym: null, q: '', day: ''};
const invList = () => Object.values(DB.invs || {});
const invSeller = v => storeAlias(v.seller || (DB.scfg.sellers || {})[v.sellerId] || '') || (v.sellerId ? '統編 ' + v.sellerId : '未知店家');
const invNoFmt = n => String(n || '').replace(/^([A-Z]{2})(\d{8})$/, '$1-$2');
const invBill = v => { if (!v.bill) return null; const L = DB.bills[v.bill.k] || []; const b = L.find(x => x.id === v.bill.id); if (b) return b; for (const k of Object.keys(DB.bills)) { const f = DB.bills[k].find(x => x.id === v.bill.id); if (f) { v.bill.k = k; return f; } } return null; };

/* ---------- 合併一張發票（同號碼會補齊缺的資料） ---------- */
function invPut(v) {
  if (!v || !/^[A-Z]{2}\d{8}$/.test(v.no)) return false; const o = DB.invs[v.no];
  if (!o) {
    /* 號碼不同但同一天、同金額，而且其中一張是截圖 AI 讀的（號碼可能認錯）→ 當成同一張，號碼以比較可靠的來源為準 */
    const tm = x => String(x.time || '').slice(0, 5), dup = v.date && +v.total ? invList().find(x => x.date === v.date && +x.total === +v.total && ((x.src === 'shot') !== (v.src === 'shot') || (tm(x) && tm(x) === tm(v)))) : null;
    if (dup) { const keep = v.src === 'shot' ? dup.no : v.no; if (keep !== dup.no) { const old = dup.no; delete DB.invs[old]; dup.no = keep; DB.invs[keep] = dup; Object.values(DB.bills || {}).forEach(L => L.forEach(b => { if (b.inv === old) b.inv = keep; })); saveBills(); }
      const src = v.src === 'shot' ? dup.src : v.src; v = Object.assign({}, v, {no: keep}); invPut(v); DB.invs[keep].src = src; return 'dup'; }
    DB.invs[v.no] = Object.assign({items: [], add: Date.now()}, v); return 'new'; }
  ['date', 'time', 'sellerId', 'seller', 'total'].forEach(k => { if ((o[k] == null || o[k] === '') && v[k] != null && v[k] !== '') o[k] = v[k]; });
  if (v.items && v.items.length && (!o.items || !o.items.length || v.src === 'qr' && o.src !== 'qr' && v.items.length >= o.items.length || v.src !== 'shot' && o.src === 'shot')) o.items = v.items;
  if (v.seller && (!o.seller || v.seller.length > o.seller.length && v.seller.startsWith(o.seller.replace(/…$/, '')))) o.seller = v.seller; return 'upd';
}
function invChanged() { saveInvs(); if (curTab === 'Inv') renderInv(); }

/* ---------- 頁面 ---------- */
function renderInv() {
  const box = $('#invBody'); if (!box) return; const now = new Date(); if (!Inv.ym) Inv.ym = [now.getFullYear(), now.getMonth()];
  const [Y, Mo] = Inv.ym, pre = `${Y}-${String(Mo + 1).padStart(2, '0')}`;
  const M = invList().filter(v => (v.date || '').startsWith(pre)).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  if (Inv.day && !Inv.day.startsWith(pre)) Inv.day = ''; const L = Inv.day ? M.filter(v => v.date === Inv.day) : M, cnt = {}; M.forEach(v => { cnt[v.date] = (cnt[v.date] || 0) + 1; });
  const first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(), today = ymd(new Date()); let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), dow = (first.getDay() + d - 1) % 7; cells += `<button class="cd ${k === Inv.day ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${cnt[k] ? `<em class="cdC">${cnt[k]}</em>` : ''}</button>`; }
  const tot = L.reduce((s, v) => s + numP(v.total), 0), done = L.filter(v => invBill(v)).length;
  $('#invSub').textContent = `${Y}年${Mo + 1}月・${M.length} 張`;
  const car = DB.scfg.carrier || '';
  const byDay = {}; L.forEach(v => { (byDay[v.date] = byDay[v.date] || []).push(v); });
  box.innerHTML = `${car ? `<button class="carCard card" data-a="carBig"><div class="carT"><b>📱 我的手機條碼</b><span>點一下放大給店員掃</span></div>${code39(car, 46)}<div class="carN">${esc(car)}</div></button>`
      : `<button class="carCard card empty" data-a="carSet"><b>📱 設定我的手機條碼</b><span>結帳時直接打開給店員掃，存進你的載具</span></button>`}
    <div class="cal card invCal">${calHead(Y, Mo)}<div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG">${cells}</div></div>
    ${Inv.day ? `<div class="invDayBar"><b>${dayLabel(Inv.day)} 的發票（${L.length} 張）</b><button class="btn sm" data-a="allMonth">顯示整個月</button></div>` : ''}
    <div class="invSum"><span>${Inv.day ? '這天張數' : '本月張數'}<b>${L.length}</b></span><span>已分帳<b>${done}</b></span><span>${Inv.day ? '這天合計' : '本月合計'}<b>${money(tot)}</b></span></div>
    ${L.length ? Object.keys(byDay).map(k => `<div class="invDay">${dayLabel(k)}</div>${byDay[k].map(invCard).join('')}`).join('')
      : Inv.day ? '<div class="empty" style="padding:1.2rem">這天沒有匯入的發票</div>' : `<div class="empty mealEmpty"><span class="big">🧾</span>這個月還沒有發票<br><span class="small">「📷 掃描」紙本發票的 QR Code、「🖼️ 截圖」匯入發票大師的畫面，<br>或用「🤖 協助工具」直接讀取發票 App</span></div>`}`;
}
function invCard(v) {
  const b = invBill(v);
  return `<button class="invC card" data-no="${v.no}"><div class="invL"><b>${esc(invSeller(v))}</b><small>${v.way ? wayIcon(v.way) + ' ' + esc(v.way) + '・' : ''}${invNoFmt(v.no)}${v.time ? '・' + esc(v.time) : ''}・${(v.items || []).length ? (v.items || []).length + ' 項' : '<span class="warnT">沒有明細</span>'}</small></div>
    <div class="invR"><b>${money(v.total)}</b>${b ? '<span class="chip ok">✓ 已分帳</span>' : '<span class="chip">未分帳</span>'}</div></button>`;
}
function initInv() {
  const box = $('#invBody');
  $('#invScan').onclick = () => openInvScan(); $('#invShot').onclick = () => $('#invShotPick').click(); $('#invAcc').onclick = () => openInvAcc();
  $('#invToday').onclick = () => { buzz(10); const d = new Date(); Inv.ym = [d.getFullYear(), d.getMonth()]; Inv.day = ymd(d); renderInv(); const c = $('#invBody .invCal'); c && c.scrollIntoView({block: 'start', behavior: 'smooth'}); };
  $('#invMore').onclick = () => { const sh = sheet({title: '📥 其他匯入方式', html: `<div class="actList"><button data-a="csv">📄 匯入財政部「載具消費明細」CSV</button><button data-a="web">🌐 App 內打開財政部網站讀取（實驗性）</button></div>`});
    sh.body.onclick = e => { const t = e.target.closest('[data-a]'); if (!t) return; sh.close(); if (t.dataset.a === 'csv') $('#csvPick').click(); else openInvWeb(); }; };
  $('#invShotPick').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) invShots(fs); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(invPullAcc, 300); }); setTimeout(invPullAcc, 1500);
  $('#invFind').onclick = () => openInvSearch(); $('#invSet').onclick = () => openInvSettings();
  $('#csvPick').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importInvCsv(f); };
  box.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-no],[data-d]'); if (!t) return; buzz(8);
    if (t.dataset.d) { Inv.day = Inv.day === t.dataset.d ? '' : t.dataset.d; renderInv(); return; }
    if (t.dataset.no) { openInvDetail(t.dataset.no); return; } const a = t.dataset.a; if (a === 'allMonth') { Inv.day = ''; renderInv(); return; }
    if (a === 'pm' || a === 'nm') { const d = new Date(Inv.ym[0], Inv.ym[1] + (a === 'pm' ? -1 : 1), 1); Inv.ym = [d.getFullYear(), d.getMonth()]; renderInv(); }
    else if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Inv.ym[0], Inv.ym[1], a === 'ymY' ? 'y' : 'm'); if (r) { Inv.ym = r; renderInv(); } }
    else if (a === 'carSet') editCarrier(); else if (a === 'carBig') showCarrier(); });
  window.__invWeb = j => { try { invFromWeb(typeof j === 'string' ? JSON.parse(j) : j); } catch (er) { toast('❌ 讀取失敗：' + er.message, 4000); } };
}

/* ---------- 手機條碼（Code 39） ---------- */
const C39 = {'0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn',
  N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'};
function code39(txt, h) {
  const s = '*' + String(txt).toUpperCase() + '*', N = 2, W = 5; let x = 10, bars = '';
  for (const ch of s) { const p = C39[ch]; if (!p) continue; for (let i = 0; i < 9; i++) { const w = p[i] === 'w' ? W : N; if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}"/>`; x += w; } x += N; }
  return `<svg class="c39" viewBox="0 0 ${x + 8} ${h}" preserveAspectRatio="none" aria-label="${esc(txt)}">${bars}</svg>`;
}
const carOk = v => /^\/[0-9A-Z.+\-]{7}$/.test(v);
async function editCarrier() {
  const v = ((await askText('手機條碼（斜線開頭共 8 碼，例如 /ABC+123）', DB.scfg.carrier || '/', '/ABC+123')) || '').trim().toUpperCase();
  if (!v || v === '/') return; if (!carOk(v)) { toast('格式不對：要「/」開頭再加 7 個英數字或 + - .'); return; }
  DB.scfg.carrier = v; saveScfg(); toast('已設定手機條碼'); if (curTab === 'Inv') renderInv();
}
function showCarrier() {
  const car = DB.scfg.carrier; if (!car) return; buzz(15);
  const sh = sheet({title: '📱 我的手機條碼', foot: '<button class="btn" data-a="edit">✎ 修改</button><button class="btn pri" data-a="ok">完成</button>'});
  sh.body.innerHTML = `<div class="carBig">${code39(car, 120)}<div class="carN big">${esc(car)}</div><div class="small muted" style="margin-top:.6rem">請店員用掃描器掃這個條碼，發票就會存進你的手機載具<br>螢幕亮度調高會比較好掃</div></div>`;
  sh.foot.onclick = e => { const t = e.target.closest('[data-a]'); if (!t) return; sh.close(); if (t.dataset.a === 'edit') editCarrier(); };
}

/* ---------- 掃描紙本電子發票 QR Code ----------
   左邊 QR：發票號碼(10) 日期民國(7) 隨機碼(4) 銷售額(8,16進位) 總計(8,16進位) 買方統編(8) 賣方統編(8) 加密驗證(24)
            :營業人自行使用區(10) :這個 QR 的品項數 :總品項數 :編碼(0=Big5 1=UTF-8 2=Base64) :品名:數量:單價…
   右邊 QR：以 ** 開頭，接著剩下的 品名:數量:單價… */
function qrText(code) {
  const bytes = code.binaryData && code.binaryData.length ? new Uint8Array(code.binaryData) : null;
  if (!bytes) return code.data || ''; const tryDec = enc => { try { return new TextDecoder(enc, {fatal: true}).decode(bytes); } catch (e) { return null; } };
  return tryDec('utf-8') || tryDec('big5') || code.data || '';
}
function parseInvQR(left, right) {
  const L = String(left || ''); if (!/^[A-Z]{2}\d{8}\d{7}/.test(L)) return null;
  const no = L.slice(0, 10), roc = L.slice(10, 17), y = +roc.slice(0, 3) + 1911, m = roc.slice(3, 5), d = roc.slice(5, 7);
  const total = parseInt(L.slice(29, 37), 16), sellerId = L.slice(45, 53);
  const rest = L.slice(77), f = rest.split(':'); /* f[0]='' f[1]=自用區 f[2]=本QR品項數 f[3]=總品項數 f[4]=編碼 */
  const enc = (f[4] || '1').trim(); let parts = f.slice(5);
  if (right) { const r = String(right).replace(/^\*+/, '').replace(/^:/, ''); if (r) parts = parts.concat(r.split(':')); }
  const items = [];
  for (let i = 0; i + 2 < parts.length + 0.5 && i < parts.length; i += 3) {
    let n = (parts[i] || '').trim(); const q = parseFloat(parts[i + 1]), p = parseFloat(parts[i + 2]);
    if (!n && isNaN(q)) continue; if (enc === '2') { try { n = new TextDecoder('utf-8').decode(Uint8Array.from(atob(n), c => c.charCodeAt(0))); } catch (e) {} }
    if (!n || isNaN(q) || isNaN(p)) continue; items.push({n, q: q || 1, p, amt: Math.round(q * p * 100) / 100});
  }
  return {no, way: '實體店購物', date: `${y}-${m}-${d}`, sellerId: /^\d{8}$/.test(sellerId) ? sellerId : '', total: isNaN(total) ? 0 : total, items, src: 'qr', need: +(f[3] || 0)};
}
/* 一張畫面讀兩個 QR：jsQR 一次只能讀一個，兩個並排時整張可能讀不到 → 依序試整張、左半、右半…，
   讀到一個就把它塗白，再從整張重新找下一個 */
const QZ = [[0, 1], [0, .5], [.5, 1], [0, .62], [.38, 1]];
function qrMulti(g, z) {
  const out = [], [X, Y, W, H] = z;
  for (let n = 0; n < 2; n++) { let hit = null;
    for (const [a, b] of QZ) { const x = X + Math.round(W * a), w = Math.round(W * (b - a)), d = g.getImageData(x, Y, w, H), c = jsQR(d.data, d.width, d.height, {inversionAttempts: 'dontInvert'}); if (c) { hit = {c, x}; break; } }
    if (!hit) break; out.push(qrText(hit.c));
    const L = hit.c.location, xs = [L.topLeftCorner.x, L.topRightCorner.x, L.bottomLeftCorner.x, L.bottomRightCorner.x], ys = [L.topLeftCorner.y, L.topRightCorner.y, L.bottomLeftCorner.y, L.bottomRightCorner.y];
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = (x1 - x0) * 0.15; g.fillStyle = '#fff'; g.fillRect(hit.x + x0 - pad, Y + y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2); }
  return out;
}
function openInvScan() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('這台手機不支援相機掃描'); return; }
  let stream = null, stop = false, left = null, right = null, leftAt = 0, got = [];
  const sh = sheet({title: '📷 掃描發票 QR Code', full: true, onClose() { stop = true; if (stream) stream.getTracks().forEach(t => t.stop()); }});
  sh.body.innerHTML = `<div class="scanBox"><video id="scV" playsinline muted></video><div class="scFrame"><i></i><i></i></div><div class="scTip" id="scTip">把發票左右兩個 QR Code 一起放進框裡</div></div>
    <div class="scState"><span id="scL" class="chip">左邊 QR</span><span id="scR" class="chip">右邊 QR</span></div><div id="scGot" class="scGot"></div>`;
  const v = $('#scV', sh.body), cv = document.createElement('canvas'), g = cv.getContext('2d', {willReadFrequently: true});
  const mark = () => { $('#scL', sh.body).classList.toggle('ok', !!left); $('#scR', sh.body).classList.toggle('ok', !!right); };
  const finish = () => { const inv = parseInvQR(left, right); left = right = null; leftAt = 0; mark(); if (!inv) return;
    if (got.includes(inv.no)) return; got.push(inv.no); buzz(60);
    const r = invPut(inv); invChanged(); lookupSeller(inv.sellerId);
    $('#scGot', sh.body).insertAdjacentHTML('afterbegin', `<button class="invC card" data-no="${inv.no}"><div class="invL"><b>${r === 'new' ? '✅ 已存入' : '🔄 已更新'}　${invNoFmt(inv.no)}</b><small>${dayLabel(inv.date)}・${inv.items.length} 項${inv.need && inv.items.length < inv.need ? `（共 ${inv.need} 項，右邊 QR 沒掃到的會少）` : ''}</small></div><div class="invR"><b>${money(inv.total)}</b><span class="chip">查看 ›</span></div></button>`);
    $('#scTip', sh.body).textContent = '已存入！可以繼續掃下一張'; };
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-no]'); if (t) openInvDetail(t.dataset.no); });
  const take = txt => { if (/^[A-Z]{2}\d{8}\d{7}/.test(txt)) { if (!left || left !== txt) { left = txt; leftAt = Date.now(); } } else if (/^\*\*/.test(txt)) right = txt; mark(); };
  const tick = () => { if (stop) return;
    if (v.readyState >= 2 && v.videoWidth) { const vw = v.videoWidth, vh = v.videoHeight, sc = Math.min(1, 960 / vw); cv.width = Math.round(vw * sc); cv.height = Math.round(vh * sc); g.drawImage(v, 0, 0, cv.width, cv.height);
      try { qrMulti(g, [0, 0, cv.width, cv.height]).forEach(take); } catch (e) {}
      if (left) { const p = parseInvQR(left, right); const need = p && p.need, have = p ? p.items.length : 0; if (right || (need && have >= need) || need === 0 || Date.now() - leftAt > 2500) finish(); } }
    requestAnimationFrame(tick); };
  navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1920}, height: {ideal: 1080}}, audio: false})
    .then(s => { stream = s; if (stop) { s.getTracks().forEach(t => t.stop()); return; } v.srcObject = s; v.play().catch(() => {}); tick(); })
    .catch(er => { $('#scTip', sh.body).textContent = '❌ 打不開相機：' + (er.name === 'NotAllowedError' ? '請允許日日帳本使用相機' : er.message); });
}

/* ---------- 統編查店名（經濟部商工登記公示資料，查不到就顯示統編，可以自己改） ---------- */
const GCIS = [['5F64D864-61CB-4D0D-8AD9-492047CC1EA6', 'Business_Accounting_NO', 'Company_Name'], ['FCB90AB1-E382-45CE-8D4F-394861851E28', 'Branch_Office_Business_Accounting_NO', 'Branch_Office_Name'], ['7E6AFA72-AD6A-46D3-8681-ED77951D912D', 'President_No', 'Business_Name']];
const sellerAsk = {};
async function lookupSeller(id) {
  if (!/^\d{8}$/.test(id || '') || (DB.scfg.sellers || {})[id] || sellerAsk[id]) return; sellerAsk[id] = 1;
  for (const [api, key, field] of GCIS) {
    try { const url = `https://data.gcis.nat.gov.tw/od/data/api/${api}?$format=json&$filter=${key}%20eq%20${id}&$skip=0&$top=1`;
      const j = await jfetch(url, {method: 'GET'}, 12000), r = Array.isArray(j) ? j[0] : null, nm = r && (r[field] || r.Company_Name || r.Business_Name);
      if (nm) { DB.scfg.sellers = DB.scfg.sellers || {}; DB.scfg.sellers[id] = String(nm).trim(); saveScfg(); invChanged(); return; } } catch (e) {}
  }
}

/* ---------- 匯入財政部載具消費明細 CSV ----------
   M|載具名稱|載具號碼|發票日期|商店統編|商店店名|發票號碼|總金額|發票狀態|
   D|發票號碼|小計|品項名稱|        （各版本欄位略有不同，用規則判斷） */
async function importInvCsv(file) {
  const buf = new Uint8Array(await file.arrayBuffer()); let t;
  try { t = new TextDecoder('utf-8', {fatal: true}).decode(buf); } catch (e) { t = new TextDecoder('big5').decode(buf); }
  const res = parseInvCsv(t); if (!res.length) { toast('❌ 這個檔案裡找不到發票（請用財政部電子發票平台下載的「載具消費明細」CSV）', 5000); return; }
  let nN = 0, nU = 0; res.forEach(v => { const r = invPut(v); if (r === 'new') nN++; else if (r) nU++; });
  invChanged(); const last = res.map(v => v.date).filter(Boolean).sort().pop(); if (last) { const d = ymdDate(last); Inv.ym = [d.getFullYear(), d.getMonth()]; renderInv(); }
  buzz(40); toast(`✅ 匯入 ${res.length} 張發票（新增 ${nN}、更新 ${nU}）`, 4000);
}
function parseInvCsv(t) {
  const out = {}, rows = String(t).replace(/^﻿/, '').split(/\r?\n/).map(l => l.split(/[|,]/).map(x => x.replace(/^"|"$/g, '').trim()));
  const isNo = s => /^[A-Z]{2}-?\d{8}$/.test(s || ''), nNo = s => String(s).replace('-', ''), isDate = s => /^\d{8}$/.test(s || '') || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s || '') || /^\d{3}[/-]?\d{2}[/-]?\d{2}$/.test(s || '');
  const toDate = s => { s = String(s); let m = s.match(/^(\d{4})[/-]?(\d{1,2})[/-]?(\d{1,2})$/); if (m && +m[1] > 1911) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; m = s.match(/^(\d{3})[/-]?(\d{2})[/-]?(\d{2})$/); if (m) return `${+m[1] + 1911}-${m[2]}-${m[3]}`; return ''; };
  rows.forEach(f => { if (f.length < 3) return; const tag = f[0].replace(/[^MD]/g, '');
    if (tag === 'M') { const ni = f.findIndex(isNo); if (ni < 0) return; const no = nNo(f[ni]), di = f.findIndex(isDate), sid = f.find((x, i) => i !== ni && /^\d{8}$/.test(x) && i !== di) || '';
      const nums = f.slice(ni + 1).map(x => x.replace(/[$,]/g, '')).filter(x => /^-?\d+(\.\d+)?$/.test(x)), name = f.find((x, i) => i > 2 && /[一-鿿A-Za-z]/.test(x) && !/開立|作廢|折讓|手機條碼|載具/.test(x) && !isNo(x)) || '';
      const o = out[no] = out[no] || {no, items: [], src: 'csv'}; o.date = toDate(di >= 0 ? f[di] : '') || o.date; o.sellerId = sid || o.sellerId; o.seller = name || o.seller; if (nums.length) o.total = numP(nums[0]); }
    else if (tag === 'D') { const ni = f.findIndex(isNo); if (ni < 0) return; const no = nNo(f[ni]), rest = f.slice(ni + 1).filter(x => x !== '');
      const numI = rest.findIndex(x => /^-?\$?[\d,]+(\.\d+)?$/.test(x)), amt = numI >= 0 ? (parseFloat(rest[numI].replace(/[$,]/g, '')) || 0) : 0, name = rest.filter((x, i) => i !== numI).find(x => /[一-鿿A-Za-z]/.test(x)) || '';
      if (!name) return; const o = out[no] = out[no] || {no, items: [], src: 'csv'}; o.items.push({n: name, q: 1, p: amt, amt}); } });
  return Object.values(out).filter(v => v.date || v.items.length);
}

/* ---------- App 內開財政部電子發票平台，自己登入後讀取頁面（實驗性） ---------- */
function openInvWeb() {
  if (!(IS_APP && NB.invWeb)) { const sh = sheet({title: '🌐 載具發票'}); sh.body.innerHTML = `<p>這個功能需要在 App 裡使用（要用 App 內的瀏覽器打開財政部網站，再讀取頁面）。</p><p class="small muted">也可以到財政部電子發票整合服務平台下載「載具消費明細」CSV，再按「📄 匯入 CSV」。</p>`; return; }
  const sh = sheet({title: '🌐 讀取載具發票（實驗性）', foot: '<button class="btn pri" data-a="go">打開財政部網站</button>'});
  sh.body.innerHTML = `<ol class="invSteps"><li>按下面的按鈕，會在 App 裡打開<b>財政部電子發票整合服務平台</b></li><li>用你的<b>手機條碼＋驗證碼</b>登入（帳密只在財政部網站上輸入，日日帳本不會儲存）</li><li>進到「消費發票查詢」，打開想要的發票明細</li><li>按上面的 <b>📥 讀取這一頁</b>，頁面上的發票和品項就會存進發票區</li></ol>
    <div class="gTip">💡 發票列表頁可以一次讀到多張發票的表頭（日期、店家、金額）；要品項的話請打開那張發票的明細頁再讀一次。網站改版可能會讀不到，這時可以改用「📄 匯入 CSV」。</div>`;
  sh.foot.onclick = e => { if (!e.target.closest('[data-a="go"]')) return; sh.close(); NB.invWeb('https://www.einvoice.nat.gov.tw/'); };
}
function invFromWeb(j) {
  const text = String(j.x || ''), tables = j.tables || [], found = {};
  const noRe = /([A-Z]{2})-?(\d{8})/g, toDate = s => { let m = s.match(/(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; m = s.match(/(\d{3})[/.-](\d{1,2})[/.-](\d{1,2})/); if (m) return `${+m[1] + 1911}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return ''; };
  const numOf = s => { const m = String(s).replace(/,/g, '').match(/(-)?\s*(?:NT)?\$?\s*(-)?(\d+(\.\d+)?)/); return m ? (m[1] || m[2] ? -1 : 1) * parseFloat(m[3]) : NaN; };
  /* 1) 表格：每一列有發票號碼 → 表頭；表頭有「品名」→ 明細 */
  let detailItems = null;
  tables.forEach(T => { if (!T || !T.length) return; const head = (T[0] || []).join('|');
    if (/品名|品項/.test(head)) { const ci = {n: T[0].findIndex(c => /品名|品項/.test(c)), q: T[0].findIndex(c => /數量/.test(c)), p: T[0].findIndex(c => /單價/.test(c)), a: T[0].findIndex(c => /小計|金額/.test(c))};
      const its = T.slice(1).map(r => { const n = (r[ci.n] || '').trim(), q = ci.q >= 0 ? numOf(r[ci.q]) : 1, a = ci.a >= 0 ? numOf(r[ci.a]) : NaN, p = ci.p >= 0 ? numOf(r[ci.p]) : (isNaN(a) ? NaN : a / (q || 1));
        return n && !isNaN(isNaN(a) ? p : a) ? {n, q: q || 1, p: isNaN(p) ? a : p, amt: isNaN(a) ? p * (q || 1) : a} : null; }).filter(Boolean);
      if (its.length) detailItems = (detailItems || []).concat(its); }
    T.forEach(r => { const line = r.join(' '), m = line.match(/([A-Z]{2})-?(\d{8})/); if (!m) return; const no = m[1] + m[2], o = found[no] = found[no] || {no, src: 'web'};
      o.date = o.date || toDate(line); const amts = r.map(numOf).filter(x => !isNaN(x) && x > 0 && x < 1e6); if (amts.length && !o.total) o.total = amts[amts.length - 1];
      const nm = r.find(c => /[一-鿿]{2,}/.test(c) && !/發票|開立|作廢|中獎|查詢|明細/.test(c)); if (nm && !o.seller) o.seller = nm.trim(); }); });
  /* 2) 文字：只有一張發票號碼時，當成明細頁 */
  const nos = [...new Set([...text.matchAll(noRe)].map(m => m[1] + m[2]))];
  if (nos.length === 1) { const no = nos[0], o = found[no] = found[no] || {no, src: 'web'}; o.date = o.date || toDate(text);
    const sm = text.match(/(?:消費店家|商店名稱|賣方名稱|店家名稱)[:：]\s*([^\n]+)/); if (sm) o.seller = sm[1].trim();
    const im = text.match(/(?:店家統編|賣方統編|統一編號)[:：]\s*(\d{8})/); if (im) o.sellerId = im[1];
    const am = text.match(/(?:消費金額|總計|總金額|發票金額)[:：]?\s*\$?\s*([\d,]+)/); if (am) o.total = numP(am[1].replace(/,/g, ''));
    const tm = text.match(/(\d{1,2}:\d{2})(?::\d{2})?/); if (tm) o.time = tm[1].padStart(5, '0');
    if (detailItems) o.items = detailItems; }
  const L = Object.values(found).filter(v => v.date || v.items); if (!L.length) { toast('這一頁沒有找到發票，請打開發票列表或發票明細再讀取', 4000); return; }
  let nN = 0; L.forEach(v => { if (invPut(v) === 'new') nN++; if (v.sellerId) lookupSeller(v.sellerId); }); invChanged(); buzz(40);
  const withItems = L.filter(v => v.items && v.items.length).length;
  toast(`✅ 讀到 ${L.length} 張發票${withItems ? `（${withItems} 張有品項）` : ''}，新增 ${nN} 張`, 4000);
}

/* ---------- 發票明細 ---------- */
function openInvDetail(no) {
  let v = DB.invs[no]; if (!v) return;
  const sh = sheet({title: '🧾 發票明細', full: true, foot: '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button><button class="btn pri" data-a="split"></button>'});
  invIds(v);
  const draw = () => { discSync(v); const b = invBill(v), its = v.items || [], ds = v.disc || [], od = v.odisc || [], fe = v.fees || [], sum = its.reduce((s, x) => s + (+x.amt || 0), 0) - ds.reduce((s, d) => s + (+d.amt || 0), 0) - od.reduce((s, d) => s + (+d.amt || 0), 0) + fe.reduce((s, d) => s + (+d.amt || 0), 0);
    sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .5rem">點任何一個欄位或品項就可以修改</div>
      <div class="invHead card"><button class="ihNo" data-a="no">🧾 ${invNoFmt(v.no)} <i class="ed">✎</i><span class="chip">${{qr: '紙本 QR', csv: '載具 CSV', web: '載具網站', shot: '截圖', acc: '協助工具'}[v.src] || ''}</span></button>
        <div class="ihR"><span>發票日期</span><b class="ihDT"><button data-a="date">${v.date ? dayLabel(v.date) : '未填'} ✎</button><button data-a="time">${esc(v.time || '時間')} ✎</button></b></div>
        <button class="ihR ihS" data-a="seller"><span>消費店家</span><b><em>${esc(invSeller(v))}</em><i class="ed">✎</i></b></button>
        <button class="ihR ihS" data-a="sid"><span>店家統編</span><b><em>${v.sellerId || '未填'}</em><i class="ed">✎</i></b></button></div>
      <div class="ihWay">${wayBox(v.way)}</div>
      <button class="ihAmt card" data-a="total"><span>💲 消費金額</span><b>${money(v.total)} <i class="ed">✎</i></b></button>
      <div class="lbl ihLbl" style="margin-top:.8rem"><span>🛍️ 消費品項</span><button class="btn sm" data-a="addIt">＋ 品項</button></div>
      ${its.length ? `<div class="ihT card"><div class="ihTr h"><span>品名</span><span>數量</span><span>小計</span></div>${its.map((x, i) => `<button class="ihTr ${+x.amt < 0 ? 'neg' : ''}" data-i="${i}"><span>${esc(x.n)}</span><span>${fq(x.q)}</span><span>${money(x.amt)}</span></button>`).join('')}</div>
        <div class="lbl ihLbl" style="margin-top:.9rem"><span>🏷️ 折扣</span><button class="btn sm" data-a="addDs">＋ 折扣</button></div>
        ${ds.length ? `<div class="ihT card">${ds.map((d, k) => { const nm = (d.items || []).map(id => (its.find(x => x.id === id) || {}).n).filter(Boolean); return `<button class="ihD" data-dk="${k}"><span class="grow"><b>${esc(d.n)}${discLabel(d) ? `<span class="chip" style="margin-left:.35rem">${discLabel(d)}</span>` : ''}</b><small>${nm.length ? '套用：' + esc(nm.join('、')) : '<span class="warnT">還沒勾選品項</span>'}</small></span><b class="neg">-${money(d.amt)}</b></button>`; }).join('')}</div>` : '<div class="small muted" style="margin:-.1rem 0 .2rem">例如「鮮食促 -21」：填折扣名稱和金額，再勾選上面套用的品項</div>'}
        <div class="lbl ihLbl" style="margin-top:.9rem"><span>🎟️ 整單折扣・優惠券</span><button class="btn sm" data-a="addOd">＋ 整單折扣</button></div>
        ${od.length ? `<div class="ihT card">${od.map((d, k) => `<button class="ihD" data-ok="${k}"><span class="grow"><b>${esc(d.n)}${d.kind && d.kind !== 'amt' ? `<span class="chip" style="margin-left:.35rem">${discLabel(d)}</span>` : ''}</b></span><b class="neg">-${money(d.amt)}</b></button>`).join('')}</div>` : ''}
        <div class="lbl ihLbl" style="margin-top:.9rem"><span>🚚 費用（平台費、運費…）</span><button class="btn sm" data-a="addFe">＋ 費用</button></div>
        ${fe.length ? `<div class="ihT card">${fe.map((d, k) => `<button class="ihD" data-fk="${k}"><span class="grow"><b>${esc(d.n)}</b></span><b>+${money(d.amt)}</b></button>`).join('')}</div>` : ''}
        ${Math.abs(sum - numP(v.total)) > 0.5 && v.total ? `<div class="blWarn" style="margin:.5rem 0 0">⚠️ 品項${ds.length || od.length || fe.length ? '加減折扣和費用後' : ''}合計 ${money(sum)} 和消費金額不同${v.src === 'qr' ? '（右邊 QR 可能沒掃到，可以再掃一次）' : ''}</div>` : `${ds.length || od.length || fe.length || its.some(x => +x.amt < 0) ? `<div class="blOk" style="margin:.5rem 0 0">✅ 品項${ds.length || od.length || fe.length ? '加減折扣和費用後' : ''}合計和消費金額一致</div>` : ''}`}`
        : `<div class="empty" style="padding:1rem">這張發票還沒有品項明細<br><span class="small">按「＋ 品項」手動輸入，或用截圖、協助工具補上</span></div>`}
      <button class="btn block" data-a="fromBill" style="margin-top:.8rem">📥 用消費明細的內容取代品項和折扣</button>
      ${b ? `<button class="invLink card" data-a="open"><span>✓ 已拿去分帳：${dayLabel(billKey(b))} ${esc(billStore(b) || '')}</span><b>打開 ›</b></button><div class="small muted" style="margin-top:.35rem">修改發票不會自動改到已經做好的分帳</div>` : ''}`;
    $('[data-a="split"]', sh.foot).textContent = b ? '🧾 打開分帳' : '🧾 拿去分帳'; };
  draw();
  const save = () => { invChanged(); draw(); };
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-i],[data-dk],[data-ok],[data-fk]'); if (!t) return; buzz(8); const a = t.dataset.a;
    if (t.dataset.i != null && !a) { await invItemEdit(v, +t.dataset.i); save(); return; }
    if (t.dataset.dk != null) { await invDiscEdit(v, +t.dataset.dk); save(); return; }
    if (a === 'addDs') { await invDiscEdit(v, -1); save(); return; }
    if (t.dataset.ok != null) { await editAmtRow(v, 'odisc', v.odisc[+t.dataset.ok]); save(); return; }
    if (t.dataset.fk != null) { await editAmtRow(v, 'fees', v.fees[+t.dataset.fk]); save(); return; }
    if (a === 'addOd') { v.odisc = v.odisc || []; await editAmtRow(v, 'odisc'); save(); return; }
    if (a === 'addFe') { v.fees = v.fees || []; await editAmtRow(v, 'fees'); save(); return; }
    if (a === 'fromBill') { const bb = await pickBillFor(v); if (bb && await applyBillToInv(bb, v)) save(); return; }
    if (a === 'way') { v.way = v.way === t.dataset.w ? '' : t.dataset.w; save(); return; }
    if (a === 'wayAdd') { const w = await addWay(); if (w) { v.way = w; save(); } return; }
    if (a === 'addIt') { await invItemEdit(v, -1); save(); }
    else if (a === 'no') { const nv = ((await askText('發票號碼（2 個英文字母＋8 位數字）', invNoFmt(v.no))) || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!nv || nv === v.no) return;
      if (!/^[A-Z]{2}\d{8}$/.test(nv)) { toast('發票號碼格式不對，例如 AB-12345678'); return; } if (DB.invs[nv]) { toast('已經有這張發票了'); return; }
      delete DB.invs[v.no]; v.no = nv; DB.invs[nv] = v; save(); }
    else if (a === 'date') { const k = await datePick(v.date || ymd(new Date())); if (k) { v.date = k; save(); } }
    else if (a === 'time') { const tv = await timePick(v.time); if (tv != null) { v.time = tv; save(); } }
    else if (a === 'seller') { const nv = await pickName('消費店家', invSeller(v).replace(/^統編 \d+$/, '')); if (!nv) return; const old = invSeller(v); v.seller = nv; if (v.sellerId) { DB.scfg.sellers = DB.scfg.sellers || {}; DB.scfg.sellers[v.sellerId] = nv; saveScfg(); invList().forEach(x => { if (x.sellerId === v.sellerId) x.seller = nv; }); } save(); if (!/^統編 \d+$|^未知店家$/.test(old)) await renameStoreAsk(old, nv); }
    else if (a === 'sid') { const nv = ((await askText('店家統編（8 位數字，可留空）', v.sellerId || '')) || '').replace(/\D/g, ''); if (nv && nv.length !== 8) { toast('統編是 8 位數字'); return; } v.sellerId = nv; if (nv && !v.seller) lookupSeller(nv); save(); }
    else if (a === 'total') { const nv = await askText('消費金額', v.total == null ? '' : String(v.total)); if (nv == null || nv === '') return; const n = parseFloat(String(nv).replace(/[^\d.\-]/g, '')); if (isNaN(n)) return; v.total = n; save(); }
    else if (a === 'open') { const b = invBill(v); if (b) { while (sheets.length) sheets[sheets.length - 1].close(); gotoBill(billKey(b), b.id); } } });
  sh.foot.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return; buzz(10);
    if (t.dataset.a === 'del') { if (!await ask(`刪除發票 ${invNoFmt(v.no)}？（已經做好的分帳不會刪）`, '刪除', true)) return; delete DB.invs[v.no]; invChanged(); sh.close(); return; }
    const b = invBill(v); if (b) { while (sheets.length) sheets[sheets.length - 1].close(); gotoBill(billKey(b), b.id); return; }
    if (!(v.items || []).length && !await ask('這張發票沒有品項明細，還是要建立分帳嗎？（之後可以手動加品項）', '建立')) return;
    invToBill(v); });
}
/* 編輯發票品項：品名、數量、小計（負數＝折扣） */
function invItemEdit(v, i) {
  return new Promise(res => { const isNew = i < 0, x = isNew ? {n: '', q: 1, amt: ''} : v.items[i];
    const sh = sheet({title: isNew ? '新增品項' : '編輯品項', foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`, onClose() { res(); }});
    sh.body.innerHTML = `<div class="field"><label>品名</label><input id="ivN" value="${esc(x.n)}" maxlength="80"></div>
      <div class="iGrid"><div class="field"><label>單價</label><input id="ivU" inputmode="decimal" value="${x.amt !== '' && x.q ? esc(Math.round(x.amt / x.q * 100) / 100) : ''}"></div><div class="field"><label>數量</label><input id="ivQ" inputmode="decimal" value="${x.q}"></div><div class="field"><label>小計</label><input id="ivA" inputmode="decimal" value="${esc(x.amt)}"></div></div>
      <div class="small muted">折扣（例如鮮食促）小計填負數，例如 -21</div>`;
    const r2 = n => Math.round(n * 100) / 100, U = $('#ivU', sh.body), Q = $('#ivQ', sh.body), A = $('#ivA', sh.body), num = el => parseFloat(String(el.value).replace(/[^\d.\-]/g, ''));
    sh.body.addEventListener('input', e => { const q = num(Q) || 1; if ((e.target === U || e.target === Q) && !isNaN(num(U))) A.value = r2(num(U) * q); else if (e.target === A && !isNaN(num(A))) U.value = r2(num(A) / q); });
    sh.foot.onclick = async e => { const t = e.target.closest('[data-a]'); if (!t) return; buzz(8);
      if (t.dataset.a === 'del') { const id = v.items[i].id; v.items.splice(i, 1); (v.disc || []).forEach(d => { d.items = (d.items || []).filter(x => x !== id); }); sh.close(); return; }
      const n = $('#ivN', sh.body).value.trim(), q = num(Q) || 1, a = num(A); if (!n || isNaN(a)) { toast('請輸入品名和小計'); return; }
      const o = {id: isNew ? 'i' + uid() : x.id || 'i' + uid(), n, q, p: r2(a / q), amt: r2(a)}; v.items = v.items || []; if (isNew) v.items.push(o); else v.items[i] = o; sh.close(); }; });
}
const invIds = v => { (v.items || []).forEach(x => { if (!x.id) x.id = 'i' + uid(); }); };
/* 發票折扣：三種算法
   amt   折扣金額（例如鮮食促 -21）
   bundle 組合價（例如任選 2 件 $49：勾 2 件，折扣＝這 2 件原價合計 − 49）
   pct   打折（例如 8 折、6.5 折：折扣＝勾選品項合計 × (1 − 折數/10)） */
const DK = {amt: '折扣金額', bundle: '組合價', pct: '打折'};
function discCalc(v, d) {
  const its = v.items || [], sum = (d.items || []).reduce((t, id) => t + (+((its.find(x => x.id === id) || {}).amt) || 0), 0), val = +d.val || 0;
  if (d.kind === 'bundle') return Math.max(0, Math.round((sum - val) * 100) / 100);
  if (d.kind === 'pct') { const r = val > 10 ? val / 10 : val; return r > 0 && r < 10 ? Math.round(sum * (1 - r / 10) * 100) / 100 : 0; }
  return Math.abs(+d.amt || val || 0);
}
const discLabel = d => d.kind === 'bundle' ? `組合價 $${d.val}` : d.kind === 'pct' ? `${d.val > 10 ? d.val / 10 : d.val} 折` : '';
function invDiscEdit(v, k, title) {
  return new Promise(res => { invIds(v); v.disc = v.disc || []; const isNew = k < 0, d0 = isNew ? {n: '', kind: 'amt', val: '', items: []} : v.disc[k], sel = new Set(d0.items || []), its = (v.items || []).filter(x => +x.amt > 0);
    let kind = d0.kind || 'amt';
    const sh = sheet({title: (isNew ? '新增' : '編輯') + (title || '折扣'), full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`, onClose() { res(); }});
    const presets = [...new Set(['鮮食促', '組合優惠', '第二件折扣', '會員折扣'].concat((DB.scfg.invDisc || [])))], hint = {amt: '例如 21（直接折掉的金額）', bundle: '例如 49（勾選的品項合起來賣多少錢）', pct: '例如 8 或 6.5（8 折、6.5 折）'};
    sh.body.innerHTML = `<div class="whoRow presetRow" style="margin-bottom:.6rem">${presets.map(p => `<button data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      <div class="field"><label>折扣名稱</label><input id="idN" value="${esc(d0.n)}" maxlength="40" placeholder="例如 鮮食促、組合優惠"></div>
      <div class="lbl">折扣方式</div><div class="dkSeg">${Object.entries(DK).map(([kk, t]) => `<button data-k="${kk}" class="${kk === kind ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="field"><label id="idL"></label><input id="idA" inputmode="decimal" value="${esc(d0.kind ? d0.val : d0.amt || '')}"></div>
      <div class="dkRes" id="idR"></div>
      <div class="lbl">勾選這個折扣套用的品項</div>
      ${its.length ? its.map(x => `<label class="mcR"><input type="checkbox" data-id="${x.id}" ${sel.has(x.id) ? 'checked' : ''}><div class="grow"><b>${esc(x.n)}</b><small>${x.q > 1 ? '×' + fq(x.q) + '・' : ''}${money(x.amt)}</small></div></label>`).join('') : '<div class="empty" style="padding:.8rem">還沒有品項，請先新增品項</div>'}`;
    const cur = () => ({kind, val: parseFloat(String($('#idA', sh.body).value).replace(/[^\d.]/g, '')) || 0, items: its.filter(x => sel.has(x.id)).map(x => x.id)});
    const upd = () => { $('#idL', sh.body).textContent = {amt: '折扣金額', bundle: '組合價格（勾選的品項合計賣多少）', pct: '打幾折'}[kind]; $('#idA', sh.body).placeholder = hint[kind];
      $$('.dkSeg button', sh.body).forEach(b => b.classList.toggle('on', b.dataset.k === kind));
      const c = cur(), orig = c.items.reduce((t, id) => t + (+(its.find(x => x.id === id) || {}).amt || 0), 0), dc = discCalc(v, Object.assign({amt: c.val}, c));
      $('#idR', sh.body).innerHTML = !c.items.length ? '<span class="warnT">請勾選套用的品項</span>' : !c.val ? '　' : `勾 ${c.items.length} 項・原價 ${money(orig)} → ${kind === 'amt' ? '' : `${kind === 'bundle' ? '組合價' : discLabel(c)} `}折扣 <b>-${money(dc)}</b>${c.items.length > 1 ? `（每項 -${money(dc / c.items.length)}）` : ''}`; };
    upd(); sh.body.addEventListener('input', upd);
    sh.body.addEventListener('change', e => { const c = e.target.closest('[data-id]'); if (!c) return; buzz(8); if (c.checked) sel.add(c.dataset.id); else sel.delete(c.dataset.id); upd(); });
    sh.body.addEventListener('click', e => { const t = e.target.closest('[data-p],[data-k]'); if (!t) return; buzz(8);
      if (t.dataset.k) { kind = t.dataset.k; upd(); return; }
      $('#idN', sh.body).value = t.dataset.p; if (/組合/.test(t.dataset.p)) kind = 'bundle'; else if (/會員|第二件/.test(t.dataset.p)) kind = 'pct'; else if (kind === 'bundle') kind = 'amt'; upd(); });
    sh.foot.onclick = e => { const t = e.target.closest('[data-a]'); if (!t) return; buzz(10);
      if (t.dataset.a === 'del') { v.disc.splice(k, 1); sh.close(); return; }
      const c = cur(), n = $('#idN', sh.body).value.trim() || (kind === 'bundle' ? '組合優惠' : '折扣'); if (!c.val) { toast('請輸入' + {amt: '折扣金額', bundle: '組合價格', pct: '折數'}[kind]); return; }
      if (kind !== 'amt' && !c.items.length) { toast('組合價和打折要勾選套用的品項'); return; }
      const o = Object.assign({id: d0.id || 'v' + uid(), n}, c, d0.auto ? {auto: false} : {}); o.amt = discCalc(v, Object.assign({amt: c.val}, o)); if (kind === 'amt') o.amt = c.val;
      if (isNew) v.disc.push(o); else v.disc[k] = o;
      if (!presets.includes(n)) { DB.scfg.invDisc = (DB.scfg.invDisc || []).concat(n).slice(-12); saveScfg(); } sh.close(); }; });
}
/* 名稱選擇：輸入關鍵字（任何位置都可以），列出以前用過的店名讓你選 */
function nameHistory() {
  const cnt = {}, add = n => { n = String(n || '').trim(); if (n && !/^統編 \d+$/.test(n)) cnt[n] = (cnt[n] || 0) + 1; };
  Object.values(DB.scfg.sellers || {}).forEach(add); invList().forEach(v => add(v.seller)); (DB.side ? DB.side.shop.places : []).forEach(p => add(p.name)); Object.values(DB.bills || {}).forEach(L => L.forEach(b => add(billStore(b))));
  return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a.length - b.length);
}
function pickName(title, cur) {
  return new Promise(res => { let done = false; const all = nameHistory();
    const sh = sheet({title, full: true, onClose() { if (!done) res(null); }}), fin = v => { done = true; sh.close(); res(v); };
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="pnQ" type="search" value="${esc(cur || '')}" placeholder="輸入店名或關鍵字，例如 便利商店、星河"></div><button class="btn block pri" data-a="use" id="pnUse" style="border-radius:6px;margin-bottom:.7rem"></button><div class="lbl">以前用過的名稱</div><div id="pnL"></div>`;
    const norm = s => String(s).toLowerCase().replace(/\s+/g, '');
    const draw = () => { const q = norm($('#pnQ', sh.body).value), raw = $('#pnQ', sh.body).value.trim();
      const sub = all.filter(n => !q || norm(n).includes(q)), seq = q ? all.filter(n => !sub.includes(n) && (() => { let i = 0; const t = norm(n); for (const ch of q) { i = t.indexOf(ch, i); if (i < 0) return false; i++; } return true; })()) : [];
      const hi = n => { if (!q) return esc(n); const t = n, k = norm(t).indexOf(q); if (k < 0) return esc(t); let c = 0, s0 = -1, e0 = -1; for (let i = 0; i < t.length; i++) { if (/\s/.test(t[i])) continue; if (c === k) s0 = i; if (c === k + q.length - 1) { e0 = i + 1; break; } c++; } return s0 < 0 || e0 < 0 ? esc(t) : esc(t.slice(0, s0)) + '<mark>' + esc(t.slice(s0, e0)) + '</mark>' + esc(t.slice(e0)); };
      $('#pnL', sh.body).innerHTML = sub.concat(seq).slice(0, 60).map(n => `<button class="pnR" data-n="${esc(n)}">🏪 ${hi(n)}</button>`).join('') || '<div class="small muted" style="padding:.5rem 0">沒有符合的紀錄，可以直接用輸入的名稱</div>';
      const u = $('#pnUse', sh.body); u.hidden = !raw; u.textContent = `✓ 使用「${raw.slice(0, 24)}」`; };
    draw(); $('#pnQ', sh.body).addEventListener('input', draw); setTimeout(() => { const i = $('#pnQ', sh.body); if (i) { i.focus(); i.select(); } }, 250);
    sh.body.addEventListener('click', e => { const t = e.target.closest('[data-n],[data-a="use"]'); if (!t) return; buzz(10); fin(t.dataset.n || $('#pnQ', sh.body).value.trim()); }); });
}
/* 發票 → 購物分帳：負數的行（鮮食促 -21）當成品項折扣，自動配對品項 */
function invToBill(v) {
  const nm = invSeller(v), st = matchShopStore(nm.replace(/^統編 \d+$/, '')), k = v.date || ymd(new Date());
  const b = {id: 'b' + uid(), place: st ? st.id : '', pname: st ? st.name : nm, time: v.time || '', total: numP(v.total) || '', imgs: [], items: [], disc: [], odisc: [], fees: [], src: 'inv', inv: v.no, way: v.way || ''};
  invIds(v); const map = {};
  (v.items || []).forEach(x => { const a = +x.amt || 0; if (a > 0) { const id = 'x' + uid(); map[x.id] = id; b.items.push({id, n: rcName(x.n), q: x.q || 1, amt: a, o: '', ppl: []}); } });
  (v.disc || []).forEach(d => { const ids = (d.items || []).map(i => map[i]).filter(Boolean); b.disc.push({id: 'd' + uid(), n: d.n, amt: +d.amt || 0, items: ids, auto: false, kind: d.kind, val: d.val}); });
  (v.odisc || []).forEach(d => b.odisc.push({id: 'o' + uid(), n: d.n, amt: +d.amt || 0, kind: d.kind, val: d.val, ppl: []}));
  (v.fees || []).forEach(d => b.fees.push({id: 'f' + uid(), n: d.n, amt: +d.amt || 0, ppl: []}));
  (v.items || []).forEach(x => { const a = +x.amt || 0; if (a < 0) { const ids = guessDiscItems(x.n, b.items); b.disc.push({id: 'd' + uid(), n: x.n, amt: Math.abs(a), items: ids, auto: !!ids.length}); } });
  if (DB.mcfg.people.length === 1) { const id = DB.mcfg.people[0].id; b.items.forEach(x => { x.ppl = [id]; }); }
  (DB.bills[k] = DB.bills[k] || []).push(b); v.bill = {k, id: b.id}; saveInvs(); shopChanged();
  while (sheets.length) sheets[sheets.length - 1].close(); buzz(30); toast('✅ 已建立分帳，接著選每一項是誰付的', 3000); gotoBill(k, b.id);
}

/* ---------- 消費明細 → 發票：保留發票號碼、統編、日期、時間、消費金額，只換品項、折扣、整單折扣、費用 ---------- */
const sameSeller = (a, b) => { const n = s => String(s || '').replace(/股份有限公司|有限公司|福利中心|實業|分公司|\s/g, '').toLowerCase(); const x = n(a), y = n(b); return x && y && (x.includes(y.slice(0, 2)) || y.includes(x.slice(0, 2))); };
function pickInvFor(b) {
  const k = billKey(b), tot = numP(billCalc(b).computed), bt = numP(b.total), st = billStore(b);
  const score = v => (v.date === k ? 4 : 0) + (Math.abs(numP(v.total) - (bt || tot)) < 0.5 ? 3 : 0) + (sameSeller(invSeller(v), st) ? 2 : 0) + (b.inv === v.no ? 10 : 0);
  return new Promise(res => { let q = '', done = false; const sh = sheet({title: '🧾 選擇要套用的發票', full: true, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .6rem">會保留發票號碼、店家統編、日期、時間和消費金額，只把品項、折扣、整單折扣和費用換成這筆明細的內容。同一天、同金額、同店家的排在最前面。</div><div class="searchBox" style="margin-bottom:.7rem"><input id="piQ" type="search" placeholder="搜尋店家、品項或發票號碼"></div><div id="piL"></div>`;
    const draw = () => { const L = invList().filter(v => !q || (invSeller(v) + ' ' + v.no + ' ' + (v.items || []).map(x => x.n).join(' ')).toLowerCase().includes(q)).sort((x, y) => score(y) - score(x) || (y.date || '').localeCompare(x.date || '')).slice(0, 80);
      $('#piL', sh.body).innerHTML = L.map(v => { const sc = score(v); return `<button class="invC card piC ${sc >= 7 ? 'best' : ''}" data-no="${v.no}"><div class="invL"><b>${esc(invSeller(v))}</b><small>${v.date ? dayLabel(v.date) : '沒有日期'}・${invNoFmt(v.no)}・${(v.items || []).length ? (v.items || []).length + ' 項' : '沒有明細'}</small>${sc >= 7 ? '<span class="chip">很可能是這張</span>' : ''}</div><div class="invR"><b>${money(v.total)}</b></div></button>`; }).join('') || '<div class="empty">沒有發票</div>'; };
    draw(); $('#piQ', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    sh.body.addEventListener('click', e => { const t = e.target.closest('[data-no]'); if (!t) return; buzz(10); done = true; sh.close(); res(DB.invs[t.dataset.no]); }); });
}
function pickBillFor(v) {
  const all = []; Object.keys(DB.bills || {}).forEach(k => DB.bills[k].forEach(b => all.push(b)));
  const score = b => (billKey(b) === v.date ? 4 : 0) + (Math.abs(numP(b.total || billCalc(b).computed) - numP(v.total)) < 0.5 ? 3 : 0) + (sameSeller(invSeller(v), billStore(b)) ? 2 : 0) + (b.inv === v.no ? 10 : 0);
  return new Promise(res => { let done = false; const sh = sheet({title: '📥 選擇消費明細', full: true, onClose() { if (!done) res(null); }});
    const L = all.sort((x, y) => score(y) - score(x) || billKey(y).localeCompare(billKey(x))).slice(0, 80);
    sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .6rem">選一筆消費明細，用它的品項、折扣、整單折扣和費用取代這張發票的內容（發票號碼、統編、日期時間和金額不變）</div>` + (L.map(b => { const sc = score(b); return `<button class="invC card piC ${sc >= 7 ? 'best' : ''}" data-id="${b.id}"><div class="invL"><b>${esc(billStore(b) || '消費明細')}</b><small>${dayLabel(billKey(b))}・${(b.items || []).length} 項</small>${sc >= 7 ? '<span class="chip">很可能是這筆</span>' : ''}</div><div class="invR"><b>${money(b.total || billCalc(b).computed)}</b></div></button>`; }).join('') || '<div class="empty">還沒有消費明細</div>');
    sh.body.addEventListener('click', e => { const t = e.target.closest('[data-id]'); if (!t) return; buzz(10); done = true; sh.close(); res(all.find(b => b.id === t.dataset.id)); }); });
}
async function applyBillToInv(b, v) {
  if (!await ask(`用「${billStore(b) || '消費明細'}」的 ${(b.items || []).length} 個品項取代發票 ${invNoFmt(v.no)} 的品項和折扣？\n發票號碼、店家統編、日期、時間和消費金額會保留。`, '取代')) return false;
  const r2 = n => Math.round(n * 100) / 100;
  v.items = (b.items || []).map(x => { const q = +x.q || 1, a = numP(x.amt); return {id: x.id || 'i' + uid(), n: x.n, q, p: r2(a / q), amt: r2(a)}; });
  v.disc = (b.disc || []).map(d => ({id: d.id || 'v' + uid(), n: d.n, amt: numP(d.amt), items: (d.items || []).slice(), kind: d.kind, val: d.val}));
  v.odisc = (b.odisc || []).map(d => ({id: d.id || 'o' + uid(), n: d.n, amt: numP(d.amt), kind: d.kind, val: d.val}));
  v.fees = (b.fees || []).map(d => ({id: d.id || 'f' + uid(), n: d.n, amt: numP(d.amt)}));
  if (b.way) v.way = b.way; v.bill = {k: billKey(b), id: b.id}; b.inv = v.no; saveInvs(); saveBills(); buzz(30); toast('✅ 已把消費明細的內容套用到發票', 2500); return true;
}
async function billToInv(b) { const v = await pickInvFor(b); if (!v) return; if (await applyBillToInv(b, v)) { invChanged(); openInvDetail(v.no); } }

/* ---------- 搜尋、設定 ---------- */
function openInvSearch() {
  let q = ''; const sh = sheet({title: '🔍 搜尋發票', full: true});
  sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.8rem"><input id="isQ" type="search" placeholder="店家、品項或發票號碼"></div><div id="isR"></div>`;
  const draw = () => { const L = invList().filter(v => !q || (invSeller(v) + ' ' + v.no + ' ' + (v.items || []).map(x => x.n).join(' ')).toLowerCase().includes(q)).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 200);
    $('#isR', sh.body).innerHTML = L.map(v => `<div class="invDay">${dayLabel(v.date)}</div>${invCard(v)}`).join('') || `<div class="empty">${invList().length ? '找不到符合的發票' : '還沒有任何發票'}</div>`; };
  draw(); $('#isQ', sh.body).oninput = debounce(e => { q = e.target.value.trim().toLowerCase(); draw(); }, 200);
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-no]'); if (t) openInvDetail(t.dataset.no); });
}
function openInvSettings() {
  const sh = sheet({title: '⚙️ 發票設定', full: true, onClose() { if (curTab === 'Inv') renderInv(); }});
  const draw = () => { const n = invList().length;
    sh.body.innerHTML = `<div class="msSec"><div class="msH"><b class="grow">📱 手機條碼</b><button class="btn sm" data-a="car">${DB.scfg.carrier ? '✎ 修改' : '＋ 設定'}</button></div><div class="small muted">${DB.scfg.carrier ? esc(DB.scfg.carrier) + '（顯示在發票區最上面，結帳時給店員掃）' : '還沒設定'}</div>${DB.scfg.carrier ? '<button class="btn sm" data-a="carDel" style="margin-top:.5rem">移除手機條碼</button>' : ''}</div>
      ${IS_APP && NB.invApps ? `<div class="msSec"><div class="msH"><b class="grow">🤖 協助工具</b><button class="btn sm" data-a="accHelp">說明／設定</button></div><div class="small muted">按「🤖 協助工具」時自動打開：<b>${esc(((invAppList().apps || []).find(x => x.pkg === DB.scfg.invApp) || {}).label || '自動（發票大師）')}</b></div><button class="btn sm" data-a="accApp" style="margin-top:.5rem">更換要打開的 App</button></div>` : ''}
      <div class="msSec"><div class="msH"><b class="grow">🏪 店家名稱對照</b></div><div class="small muted" style="margin-bottom:.4rem">掃 QR Code 只會拿到統編，App 會自動查經濟部公示資料；查不到或想改名可以在這裡改</div>
        ${Object.entries(DB.scfg.sellers || {}).map(([id, nm]) => `<div class="msR" data-id="${id}"><b class="grow">${esc(nm)}<small class="muted" style="display:block;font-weight:500">${id}</small></b><button class="btn sm" data-a="sRen">✎</button></div>`).join('') || '<div class="small muted">還沒有</div>'}</div>
      <div class="msSec"><div class="msH"><b class="grow">🧾 發票紀錄</b></div><div class="small muted">共 ${n} 張，會一起放進「設定 → 匯出備份」。</div>${n ? '<button class="btn sm danger" data-a="wipe" style="margin-top:.6rem">清除所有發票</button>' : ''}</div>
      <div class="gTip">ℹ️ 用手機條碼直接連動載具、把紙本發票存進載具，需要財政部核發的電子發票 API 帳號（目前只開放給營業人或組織，並要求資安認證），所以這裡改用掃描 QR Code、匯入 CSV 和 App 內讀取網站的方式。</div>`; };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
    if (a === 'accApp') { await pickInvApp(true); draw(); return; } if (a === 'accHelp') { openInvAcc(true); return; }
    if (a === 'car') { await editCarrier(); draw(); } else if (a === 'carDel') { delete DB.scfg.carrier; saveScfg(); draw(); }
    else if (a === 'sRen') { const id = t.closest('.msR').dataset.id, old = DB.scfg.sellers[id], nv = ((await askText('店家名稱', old)) || '').trim(); if (!nv || nv === old) return;
      /* 同一個統編的發票全部換成新名稱，再問要不要同步地圖、日常、分帳、記帳 */
      const olds = new Set([old]); invList().forEach(v => { if (v.sellerId === id) { if (v.seller) olds.add(v.seller); v.seller = nv; } }); DB.scfg.sellers[id] = nv; saveScfg(); saveInvs();
      const others = [...olds].filter(o => o && o !== nv && !isPcatPayee(o)), refs = others.map(o => [o, storeRefs(o)]).filter(([, c]) => storeRefText(c));
      if (refs.length && await ask(`發票已改成「${nv}」。\n其他地方也有用到舊名稱：\n${refs.map(([o, c]) => `・${o}（${storeRefText(c)}）`).join('\n')}\n要一起改成新名稱嗎？`, '一起改')) { let n = 0; for (const [o] of refs) n += await renameStoreAll(o, nv); toast(`✅ 已同步更新 ${n} 筆`); refreshAll(); }
      else others.forEach(o => { DB.scfg.alias = DB.scfg.alias || {}; DB.scfg.alias[o] = nv; }); saveScfg(); draw(); }
    else if (a === 'wipe') { if (!await ask('確定要清除所有發票紀錄嗎？（分帳紀錄不會刪）', '全部清除', true)) return; DB.invs = {}; saveInvs(); draw(); } });
}


/* ---------- 匯入發票截圖（發票大師、發票存摺、財政部 App 的明細頁或列表頁） ---------- */
const INV_PROMPT = `這是台灣電子發票 App（例如發票大師、發票存摺、財政部「統一發票兌獎」）的截圖，可能是「發票明細」頁或「發票列表」頁。
只輸出下面格式的文字行，一行一筆，不要說明、不要 markdown：
發票|發票號碼（2 個英文字母＋8 位數字，不要橫線）|日期 YYYY-MM-DD|時間 HH:MM|店家名稱|店家統編|消費金額
品|發票號碼|品名|數量|小計
規則：
1. 列表頁：每一張發票輸出一行「發票」。年份看頁首（例如「115年11-12月」= 2026 年），看不到就用今年。
2. 明細頁：輸出一行「發票」，再把「消費品項」表格每一列輸出成一行「品」。小計是負數（例如「鮮食促 -21」）要保留負號。
3. 店家名稱照抄完整（換行的部分接起來）。看不清楚或不確定的欄位直接留空白，馬上處理下一行，不要猜。`;
const InvJob = {n: 0, done: 0, msg: ''};
function invJobs() { const box = $('#invJobs'); if (!box) return; box.hidden = !InvJob.n;
  box.innerHTML = InvJob.n ? `<div class="sjR"><span class="spin"></span><span class="sjT"><b>🤖 AI 讀取發票截圖 ${InvJob.done}/${InvJob.n}</b><small>${esc(InvJob.msg)}</small></span><i class="sjBar"></i></div>` : ''; }
function invParseAI(t) {
  const out = {}, num = v => { const n = parseFloat(String(v || '').replace(/[^\d.\-]/g, '')); return isNaN(n) ? NaN : n; };
  String(t || '').split(/\r?\n/).forEach(line => { const f = line.split(/[|｜]/).map(x => x.trim()); const k = (f[0] || '').replace(/^[-*•\s]+/, '');
    const no = String(f[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!/^[A-Z]{2}\d{8}$/.test(no)) return;
    const o = out[no] = out[no] || {no, items: [], src: 'shot'};
    if (k === '發票') { const dm = (f[2] || '').match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); if (dm) o.date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;
      const tm = (f[3] || '').match(/(\d{1,2}):(\d{2})/); if (tm) o.time = tm[1].padStart(2, '0') + ':' + tm[2];
      if (f[4]) o.seller = f[4]; if (/^\d{8}$/.test(f[5] || '')) o.sellerId = f[5]; const a = num(f[6]); if (!isNaN(a)) o.total = a; }
    else if (k === '品') { const n = f[2], q = num(f[3]), a = num(f[4]); if (n && !isNaN(a)) o.items.push({n, q: isNaN(q) ? 1 : q, p: Math.round(a / (isNaN(q) || !q ? 1 : q) * 100) / 100, amt: a}); } });
  return Object.values(out);
}
async function invShots(files) {
  if (!S.aikey) { needAiKey(); return; }
  InvJob.n = files.length; InvJob.done = 0; InvJob.msg = '準備中…'; invJobs(); let got = 0, nNew = 0, fail = 0; const t0 = Date.now();
  for (const f of files) {
    try { const imgs = await rcPrep([f]), parts = [{text: INV_PROMPT}, ...imgs], order = await aiOrder(); let text = '', last = null;
      for (const m of order) { if (AIQ.blocked(m)) continue; let ti = (S.rcTh || {})[m] != null ? S.rcTh[m] : (/gemini-2\./.test(m) ? 1 : 0); const TH = [{thinkingLevel: 'minimal'}, {thinkingBudget: 0}, null];
        while (ti < TH.length) { try { InvJob.msg = `第 ${InvJob.done + 1} 張・${aiShort(m)} 讀取中…`; invJobs();
            text = await rcStream(m, parts, TH[ti], tx => { const n = (tx.match(/^\s*(發票|品)[|｜]/gm) || []).length; InvJob.msg = `第 ${InvJob.done + 1} 張・${aiShort(m)} 已讀到 ${n} 行…`; const el = $('#invJobs small'); if (el) el.textContent = InvJob.msg; });
            AIQ.inc(m); break; } catch (e) { last = e; if (e.code === 400) { ti++; continue; } if (e.code === 429 && e.perDay) AIQ.block(m, e.limit); break; } }
        if (invParseAI(text).length) break; }
      const L = invParseAI(text); if (!L.length) { fail++; if (last) console.warn(last); }
      L.forEach(v => { if (!v.date && !v.items.length) return; const r = invPut(v); if (r === 'new') nNew++; got++; if (v.sellerId && v.seller) { DB.scfg.sellers = DB.scfg.sellers || {}; if (!DB.scfg.sellers[v.sellerId]) DB.scfg.sellers[v.sellerId] = v.seller; } else if (v.sellerId) lookupSeller(v.sellerId); });
      invChanged(); }
    catch (er) { fail++; }
    InvJob.done++; invJobs();
  }
  AILOG.add({kind: '發票截圖', place: '', model: '', ms: Date.now() - t0, ok: got > 0, n: got});
  InvJob.n = 0; invJobs(); saveScfg(); buzz(40);
  const lastD = invList().map(v => v.date).filter(Boolean).sort().pop(); if (lastD && got) { const d = ymdDate(lastD); Inv.ym = [d.getFullYear(), d.getMonth()]; renderInv(); }
  toast(got ? `✅ 從 ${files.length} 張截圖讀到 ${got} 張發票（新增 ${nNew}）${fail ? `，${fail} 張讀不到` : ''}` : '❌ 截圖裡沒有讀到發票，請截「發票明細」或「發票列表」畫面', 5000);
}

/* ---------- 協助工具讀取（讀發票大師等 App 畫面上的文字） ---------- */
/* 協助工具要打開的發票 App：設定過的 → 上次讀取的 → 名稱有「發票大師」→ 讓你選 */
function invAppList() { try { return JSON.parse(NB.invApps()); } catch (e) { return {apps: []}; } }
async function pickInvApp(force) {
  const r = invAppList(), L = r.apps || [];
  const zj = L.find(x => /發票載具/.test(x.label)); if (zj && !DB.scfg.invAppZJ) { DB.scfg.invAppZJ = 1; DB.scfg.invApp = zj.pkg; saveScfg(); }   /* 優先用發票載具 */
  if (!force) { const pref = DB.scfg.invApp || r.last; if (pref && L.some(x => x.pkg === pref)) return pref; const m = zj || L.find(x => /發票大師/.test(x.label)); if (m) return m.pkg; if (L.length === 1) return L[0].pkg; }
  if (!L.length) { toast('找不到發票 App，請自己切到發票大師', 3500); return ''; }
  return new Promise(res => { let done = false; const sh = sheet({title: '要打開哪個發票 App？', onClose() { if (!done) res(''); }});
    sh.body.innerHTML = `<div class="actList">${L.map(x => `<button data-p="${esc(x.pkg)}">🧾 ${esc(x.label)}${x.pkg === DB.scfg.invApp ? '　✓' : ''}</button>`).join('')}</div>`;
    sh.body.onclick = e => { const t = e.target.closest('[data-p]'); if (!t) return; buzz(10); DB.scfg.invApp = t.dataset.p; saveScfg(); done = true; sh.close(); res(t.dataset.p); }; });
}
async function openInvAcc(setup) {
  if (!(IS_APP && NB.invAccState)) { const sh = sheet({title: '🤖 協助工具讀取'}); sh.body.innerHTML = '<p>這個功能要在 Android App 裡使用。</p>'; return; }
  if (!setup && NB.invAccState() === 'on') { const pkg = await pickInvApp(); NB.invAccArm(true); buzz(20); if (pkg) { NB.openPkg(pkg); toast('已打開發票 App：在發票明細或列表按右下的 🧾', 3500); } else toast('切到發票 App，按畫面上的 🧾', 3500); return; }
  const sh = sheet({title: '🤖 協助工具讀取', full: true, foot: '<button class="btn" data-a="set">⚙️ 協助工具設定</button><button class="btn pri" data-a="go">▶ 開始</button>'});
  const draw = () => { const on = NB.invAccState() === 'on';
    sh.body.innerHTML = `<div class="accSt ${on ? 'on' : ''}">${on ? '✅ 協助工具已開啟' : '⚠️ 還沒開啟協助工具'}</div>
      <ol class="invSteps">
        <li>${on ? '<s>開啟協助工具</s>（已完成）' : '按下面的「⚙️ 協助工具設定」→ 找到「<b>日日帳本 發票讀取</b>」→ 開啟'}</li>
        <li>之後在發票區按「🤖 協助工具」，會<b>自動打開發票大師</b>，畫面上出現一顆綠色圓形按鈕 🧾（可以拖曳）</li>
        <li>打開<b>發票列表</b>或<b>發票明細</b>，按一下 🧾：
          <div class="accBtns">明細頁 → 讀這一張<br>列表頁 → 自動往下捲到底，讀出全部發票<br>讀完可以選「🔁 也讀取每張明細」，自動一張張打開讀品項<br>沒有發票號碼 → 會跳出「未偵測到發票號碼」</div></li>
        <li>按「✓ 返回日日帳本」，讀到的發票自動存進發票區，同一張不會重複</li></ol>
      <div class="gTip">🔒 只有你按 🧾 時才會讀取畫面上的文字，讀到的內容只存在這支手機裡，不會上傳。不用時可以到協助工具設定關掉。</div>`; };
  draw();
  sh.foot.addEventListener('click', e => { const t = e.target.closest('[data-a]'); if (!t) return; buzz(10);
    if (t.dataset.a === 'set') { NB.invAccSettings(); return; }
    if (NB.invAccState() !== 'on') { toast('請先到協助工具設定開啟「日日帳本 發票讀取」', 3500); NB.invAccSettings(); return; }
    sh.close(); openInvAcc(); });
  const re = () => { if (!document.hidden && !sh.closed) draw(); }; document.addEventListener('visibilitychange', re);
}
function invPullAcc() {
  if (!(IS_APP && NB.invInbox)) return; let raw = ''; try { raw = NB.invInbox(); } catch (e) { return; } if (!raw) return;
  let arr; try { arr = JSON.parse(raw); } catch (e) { return; } const all = {};
  (arr || []).forEach(rec => (rec.pages || []).forEach(lines => invParseLines(lines).forEach(v => { const o = all[v.no]; if (!o) all[v.no] = v; else { Object.keys(v).forEach(k => { if ((o[k] == null || o[k] === '') && v[k] !== '') o[k] = v[k]; }); if (v.items && v.items.length) o.items = v.items; } })));
  const L = Object.values(all); if (!L.length) { toast('協助工具讀到的畫面裡沒有發票，請在發票明細或列表畫面按讀取', 4000); return; }
  let nNew = 0; L.forEach(v => { if (invPut(v) === 'new') nNew++; if (v.sellerId && v.seller) { DB.scfg.sellers = DB.scfg.sellers || {}; if (!DB.scfg.sellers[v.sellerId]) DB.scfg.sellers[v.sellerId] = v.seller; } else if (v.sellerId) lookupSeller(v.sellerId); });
  saveScfg(); invChanged(); buzz(40); const wi = L.filter(v => v.items && v.items.length).length;
  const lastD = L.map(v => v.date).filter(Boolean).sort().pop(); if (lastD) { const d = ymdDate(lastD); Inv.ym = [d.getFullYear(), d.getMonth()]; }
  if (curTab !== 'Inv') showTab('Inv'); else renderInv();
  toast(`✅ 協助工具讀到 ${L.length} 張發票（${wi} 張有品項），新增 ${nNew} 張${L.length - nNew ? `，${L.length - nNew} 張已經有了（不重複新增，只補上缺的資料）` : ''}`, 5000);
}
/* 把一頁畫面文字（每行用 tab 分欄）解析成發票：明細頁或列表頁 */
function invParseLines(lines) {
  /* 支援：發票大師、發票存摺、發票載具…（各家 App 的畫面排法不同，盡量用通用的規則讀） */
  const L = (lines || []).map(l => String(l)), noRe = /([A-Z]{2})-?(\d{8})/, out = [], cells = l => l.split(/\s*\t\s*/).map(x => x.trim()).filter(Boolean);
  const money1 = s => { const m = String(s).replace(/,/g, '').match(/(-)?\s*\$\s*(-)?(\d+(\.\d+)?)/); return m ? (m[1] || m[2] ? -1 : 1) * parseFloat(m[3]) : NaN; };
  const yuan = s => { const m = String(s).replace(/,/g, '').match(/(-?\d+(\.\d+)?)\s*元/); return m ? parseFloat(m[1]) : NaN; };
  const num = s => { const m = String(s).replace(/,/g, '').trim().match(/^(-?\d+(\.\d+)?)$/); return m ? parseFloat(m[1]) : NaN; };
  const nos = new Set(); L.forEach(l => { const m = l.match(/[A-Z]{2}-?\d{8}/g); (m || []).forEach(x => nos.add(x.replace('-', ''))); });
  const all = L.join('\n'), KW = /發票日期|消費店家|店家統編|賣方統編|賣方名稱|消費品項|購買品項|總金額|品名/;
  const isDetail = (nos.size <= 2 && KW.test(all)) || (nos.size === 1 && !/我的發票|尚未開獎|對獎專區|開獎倒數/.test(all));
  if (isDetail) { const m = all.match(noRe); if (!m) return out; const v = {no: m[1] + m[2], items: [], src: 'acc'};
    let dm = all.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}):(\d{2}))?/), y;
    if (dm) y = +dm[1]; else { dm = all.match(/(?:^|\D)(1\d{2})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}):(\d{2}))?/); if (dm) y = +dm[1] + 1911; }
    if (dm) { v.date = `${y}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`; if (dm[4]) v.time = dm[4].padStart(2, '0') + ':' + dm[5]; }
    const ni = L.findIndex(l => noRe.test(l));
    L.forEach((l, i) => { const t = l.replace(/\s*\t\s*/g, ' ');
      let mm = t.match(/(?:消費店家|商店名稱|賣方名稱)[:：]\s*(.+)$/); if (mm) { let nm = mm[1].trim(); const nx = (L[i + 1] || '').replace(/\s*\t\s*/g, ' ').trim(); if (nx && !/[:：]/.test(nx) && !/統編|存入|隨機|開獎/.test(nx) && nx.length < 30) nm += nx; v.seller = nm; }
      mm = t.match(/(?:店家統編|賣方統編|統一編號)[:：]?\s*(\d{8})/); if (mm) v.sellerId = mm[1];
      if (v.total == null && /消費金額|總計|總金額/.test(t)) { const x = t.replace(/,/g, '').match(/(?:消費金額|總計|總金額)[^\d-]*(-?\d+(\.\d+)?)/); let a = x ? parseFloat(x[1]) : money1(t); if (isNaN(a)) a = money1(L[i + 1] || ''); if (!isNaN(a)) v.total = a; } });
    /* 沒有「消費店家」標籤（例如發票載具）：號碼下面那幾行，優先用含「公司」的全名，否則用第一個店名 */
    if (!v.seller && ni >= 0) { const near = L.slice(ni, ni + 6).map(l => l.replace(/\s*\t\s*/g, ' ').replace(noRe, '').trim()).filter(x => /[一-鿿]{2,}/.test(x) && !/[:：]|載具|手機條碼|年.*月.*日|發票明細|消費品項|總金額|尚未開獎/.test(x));
      v.seller = (near.find(x => /公司/.test(x)) || near[0] || '').slice(0, 40); }
    /* 品項 */
    const hi = L.findIndex(l => /品名|消費品項|購買品項|品項明細/.test(l));
    const rowA = /^(.+?)(?:\s*\$\s*-?[\d,.]+)?\s+[x×*]\s*(\d+(?:\.\d+)?)\s+(-?[\d,]+(?:\.\d+)?)$/;   /* 蘿蔔 $45  x1  45 */
    for (let i = hi >= 0 ? hi + 1 : 0; i < L.length; i++) { if (/發票備註|刪除發票|編輯發票|字數限制|^備註/.test(L[i])) break;
      const c = cells(L[i]), t = c.join(' ');
      let r = t.match(rowA);
      if (r) { const n = r[1].replace(/\s*\$\s*-?[\d,.]+$/, '').trim(); if (n && !KW.test(n) && !noRe.test(n)) { const q = parseFloat(r[2]) || 1, a = parseFloat(r[3].replace(/,/g, '')); v.items.push({n, q, p: Math.round(a / q * 100) / 100, amt: a}); } continue; }
      if (hi < 0 || c.length < 2) continue;
      const ai = c.findIndex((x, k) => k > 0 && !isNaN(money1(x))), name = c[0];
      if (ai >= 0 && name && !/^\$/.test(name)) { const qx = c.slice(1, ai).find(x => /^[x×*]?\s*\d+(\.\d+)?$/.test(x)), q = qx ? parseFloat(qx.replace(/[x×*]/, '')) : 1, a = money1(c[ai]); v.items.push({n: name, q, p: Math.round(a / (q || 1) * 100) / 100, amt: a}); continue; }
      /* 沒有 $ 的表格：名稱｜數量｜金額 */
      if (c.length >= 3 && !isNaN(num(c[c.length - 1])) && /^[x×*]?\s*\d+(\.\d+)?$/.test(c[c.length - 2]) && /[一-鿿A-Za-z]/.test(name) && !KW.test(name)) { const q = parseFloat(c[c.length - 2].replace(/[x×*]/, '')) || 1, a = num(c[c.length - 1]); v.items.push({n: name.replace(/\s*\$\s*-?[\d,.]+$/, ''), q, p: Math.round(a / q * 100) / 100, amt: a}); }
    }
    out.push(v); return out; }
  /* 列表頁：每張發票的日期／店家／金額可能在號碼前面（發票大師）或後面（發票載具），兩種都試，取讀得比較完整的 */
  const ym = all.match(/(\d{3})\s*年\s*(\d{1,2})/), baseY = ym ? +ym[1] + 1911 : new Date().getFullYear();
  const IGN = /^(電子|載具|手動存入|紙本|本期|我的發票|對獎專區|開獎倒數|消費分析|昨日消費累積|手機條碼|尚未開獎|尚未|開獎|已開獎|未中獎|首頁|探索|掃碼|個人|載具發票)/;
  const fields = blk => { const f = {}; blk.forEach(l => cells(l).forEach((x, k) => {
      const d = x.match(/^(\d{1,2})\/(\d{1,2})$/); if (d) { if (!f.date) f.date = `${baseY}-${d[1].padStart(2, '0')}-${d[2].padStart(2, '0')}`; return; }
      if (f.total == null && /\$/.test(x) && !isNaN(money1(x))) { f.total = money1(x); return; }
      if (f.total == null && !isNaN(yuan(x))) { f.total = yuan(x); return; }
      if (!f.seller && !noRe.test(x) && /[一-鿿A-Za-z]{2,}/.test(x) && !IGN.test(x) && !/\d{3}\s*年/.test(x)) { let sv = x.replace(/…$/, ''); f.seller = sv; } })); return f; };
  const idx = []; L.forEach((l, i) => { const m = l.match(noRe); if (m) idx.push({i, no: m[1] + m[2]}); });
  const build = after => idx.map((o, k) => { const blk = after ? L.slice(o.i, k + 1 < idx.length ? idx[k + 1].i : L.length) : L.slice(k ? idx[k - 1].i + 1 : 0, o.i + 1); const f = fields(blk);
      if (after && f.seller && / /.test(f.seller) && f.seller.length > 8) f.seller = f.seller.split(' ')[0];   /* 「日昇小吃店 特製涼麵」→ 店名 */
      return {no: o.no, date: f.date || '', seller: f.seller || '', total: f.total, items: [], src: 'acc'}; });
  const A = build(true), B = build(false), score = R => R.filter(v => v.date && v.total != null).length;
  return (score(A) > score(B) ? A : B).filter(v => v.date);
}
