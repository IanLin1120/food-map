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
const Inv = {ym: null, q: ''};
const invList = () => Object.values(DB.invs || {});
const invSeller = v => v.seller || (DB.scfg.sellers || {})[v.sellerId] || (v.sellerId ? '統編 ' + v.sellerId : '未知店家');
const invNoFmt = n => String(n || '').replace(/^([A-Z]{2})(\d{8})$/, '$1-$2');
const invBill = v => { if (!v.bill) return null; const L = DB.bills[v.bill.k] || []; const b = L.find(x => x.id === v.bill.id); if (b) return b; for (const k of Object.keys(DB.bills)) { const f = DB.bills[k].find(x => x.id === v.bill.id); if (f) { v.bill.k = k; return f; } } return null; };

/* ---------- 合併一張發票（同號碼會補齊缺的資料） ---------- */
function invPut(v) {
  if (!v || !/^[A-Z]{2}\d{8}$/.test(v.no)) return false; const o = DB.invs[v.no];
  if (!o) { DB.invs[v.no] = Object.assign({items: [], add: Date.now()}, v); return 'new'; }
  ['date', 'time', 'sellerId', 'seller', 'total'].forEach(k => { if ((o[k] == null || o[k] === '') && v[k] != null && v[k] !== '') o[k] = v[k]; });
  if (v.items && v.items.length && (!o.items || !o.items.length || v.src === 'qr' && o.src !== 'qr' && v.items.length >= o.items.length)) o.items = v.items;
  if (v.seller && !o.seller) o.seller = v.seller; return 'upd';
}
function invChanged() { saveInvs(); if (curTab === 'Inv') renderInv(); }

/* ---------- 頁面 ---------- */
function renderInv() {
  const box = $('#invBody'); if (!box) return; const now = new Date(); if (!Inv.ym) Inv.ym = [now.getFullYear(), now.getMonth()];
  const [Y, Mo] = Inv.ym, pre = `${Y}-${String(Mo + 1).padStart(2, '0')}`;
  const L = invList().filter(v => (v.date || '').startsWith(pre)).sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  const tot = L.reduce((s, v) => s + numP(v.total), 0), done = L.filter(v => invBill(v)).length;
  $('#invSub').textContent = `${Y}年${Mo + 1}月・${L.length} 張`;
  const car = DB.scfg.carrier || '';
  const byDay = {}; L.forEach(v => { (byDay[v.date] = byDay[v.date] || []).push(v); });
  box.innerHTML = `${car ? `<button class="carCard card" data-a="carBig"><div class="carT"><b>📱 我的手機條碼</b><span>點一下放大給店員掃</span></div>${code39(car, 46)}<div class="carN">${esc(car)}</div></button>`
      : `<button class="carCard card empty" data-a="carSet"><b>📱 設定我的手機條碼</b><span>結帳時直接打開給店員掃，存進你的載具</span></button>`}
    <div class="cal invCal">${calHead(Y, Mo)}</div>
    <div class="invSum"><span>本月張數<b>${L.length}</b></span><span>已分帳<b>${done}</b></span><span>本月合計<b>${money(tot)}</b></span></div>
    ${L.length ? Object.keys(byDay).map(k => `<div class="invDay">${dayLabel(k)}</div>${byDay[k].map(invCard).join('')}`).join('')
      : `<div class="empty mealEmpty"><span class="big">🧾</span>這個月還沒有發票<br><span class="small">按上面的「掃描發票」掃紙本發票的 QR Code，<br>或用「載具發票」「匯入 CSV」帶入手機條碼裡的發票</span></div>`}`;
}
function invCard(v) {
  const b = invBill(v);
  return `<button class="invC card" data-no="${v.no}"><div class="invL"><b>${esc(invSeller(v))}</b><small>${invNoFmt(v.no)}${v.time ? '・' + esc(v.time) : ''}・${(v.items || []).length ? (v.items || []).length + ' 項' : '<span class="warnT">沒有明細</span>'}</small></div>
    <div class="invR"><b>${money(v.total)}</b>${b ? '<span class="chip ok">✓ 已分帳</span>' : '<span class="chip">未分帳</span>'}</div></button>`;
}
function initInv() {
  const box = $('#invBody');
  $('#invScan').onclick = () => openInvScan(); $('#invWeb').onclick = () => openInvWeb(); $('#invCsv').onclick = () => $('#csvPick').click();
  $('#invFind').onclick = () => openInvSearch(); $('#invSet').onclick = () => openInvSettings();
  $('#csvPick').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importInvCsv(f); };
  box.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-no]'); if (!t) return;
    if (t.dataset.no) { openInvDetail(t.dataset.no); return; } const a = t.dataset.a;
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
  return {no, date: `${y}-${m}-${d}`, sellerId: /^\d{8}$/.test(sellerId) ? sellerId : '', total: isNaN(total) ? 0 : total, items, src: 'qr', need: +(f[3] || 0)};
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
    .catch(er => { $('#scTip', sh.body).textContent = '❌ 打不開相機：' + (er.name === 'NotAllowedError' ? '請允許食光帳本使用相機' : er.message); });
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
  sh.body.innerHTML = `<ol class="invSteps"><li>按下面的按鈕，會在 App 裡打開<b>財政部電子發票整合服務平台</b></li><li>用你的<b>手機條碼＋驗證碼</b>登入（帳密只在財政部網站上輸入，食光帳本不會儲存）</li><li>進到「消費發票查詢」，打開想要的發票明細</li><li>按上面的 <b>📥 讀取這一頁</b>，頁面上的發票和品項就會存進發票區</li></ol>
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
  const v = DB.invs[no]; if (!v) return;
  const sh = sheet({title: '🧾 發票明細', full: true, foot: '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button><button class="btn pri" data-a="split"></button>'});
  const draw = () => { const b = invBill(v), its = v.items || [], sum = its.reduce((s, x) => s + (+x.amt || 0), 0);
    sh.body.innerHTML = `<div class="invHead card"><div class="ihNo">🧾 ${invNoFmt(v.no)}<span class="chip">${{qr: '紙本 QR', csv: '載具 CSV', web: '載具網站'}[v.src] || ''}</span></div>
        <div class="ihR"><span>發票日期</span><b>${dayLabel(v.date)}${v.time ? ' ' + esc(v.time) : ''}</b></div>
        <button class="ihR ihS" data-a="seller"><span>消費店家</span><b>${esc(invSeller(v))} ✎</b></button>
        ${v.sellerId ? `<div class="ihR"><span>店家統編</span><b>${v.sellerId}</b></div>` : ''}</div>
      <div class="ihAmt card"><span>💲 消費金額</span><b>${money(v.total)}</b></div>
      <div class="lbl" style="margin-top:.8rem">🛍️ 消費品項</div>
      ${its.length ? `<div class="ihT card"><div class="ihTr h"><span>品名</span><span>數量</span><span>小計</span></div>${its.map(x => `<div class="ihTr ${+x.amt < 0 ? 'neg' : ''}"><span>${esc(x.n)}</span><span>${fq(x.q)}</span><span>${money(x.amt)}</span></div>`).join('')}</div>
        ${Math.abs(sum - numP(v.total)) > 0.5 && v.total ? `<div class="blWarn" style="margin:.5rem 0 0">⚠️ 品項合計 ${money(sum)} 和消費金額不同${v.src === 'qr' ? '（右邊 QR 可能沒掃到，可以再掃一次）' : ''}</div>` : ''}`
        : `<div class="empty" style="padding:1rem">這張發票還沒有品項明細<br><span class="small">${v.src === 'web' ? '請在財政部網站打開這張發票的明細頁，再按「📥 讀取這一頁」' : '可以掃描紙本發票的 QR Code 補上'}</span></div>`}
      ${b ? `<button class="invLink card" data-a="open">✓ 已拿去分帳：${dayLabel(billKey(b))} ${esc(billStore(b) || '')} <b>打開 ›</b></button>` : ''}`;
    $('[data-a="split"]', sh.foot).textContent = b ? '🧾 打開分帳' : '🧾 拿去分帳'; };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return;
    if (t.dataset.a === 'seller') { const nv = ((await askText('店家名稱', invSeller(v).replace(/^統編 \d+$/, ''))) || '').trim(); if (!nv) return; v.seller = nv; if (v.sellerId) { DB.scfg.sellers = DB.scfg.sellers || {}; DB.scfg.sellers[v.sellerId] = nv; saveScfg(); } invChanged(); draw(); }
    else if (t.dataset.a === 'open') { const b = invBill(v); if (b) { while (sheets.length) sheets[sheets.length - 1].close(); gotoBill(billKey(b), b.id); } } });
  sh.foot.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return;
    if (t.dataset.a === 'del') { if (!await ask(`刪除發票 ${invNoFmt(v.no)}？（已經做好的分帳不會刪）`, '刪除', true)) return; delete DB.invs[v.no]; invChanged(); sh.close(); return; }
    const b = invBill(v); if (b) { while (sheets.length) sheets[sheets.length - 1].close(); gotoBill(billKey(b), b.id); return; }
    if (!(v.items || []).length && !await ask('這張發票沒有品項明細，還是要建立分帳嗎？（之後可以手動加品項）', '建立')) return;
    invToBill(v); });
}
/* 發票 → 購物分帳：負數的行（鮮食促 -21）當成品項折扣，自動配對品項 */
function invToBill(v) {
  const nm = invSeller(v), st = matchShopStore(nm.replace(/^統編 \d+$/, '')), k = v.date || ymd(new Date());
  const b = {id: 'b' + uid(), place: st ? st.id : '', pname: st ? st.name : nm, time: v.time || '', total: numP(v.total) || '', imgs: [], items: [], disc: [], odisc: [], fees: [], src: 'inv', inv: v.no};
  (v.items || []).forEach(x => { const a = +x.amt || 0; if (a > 0) b.items.push({id: 'x' + uid(), n: rcName(x.n), q: x.q || 1, amt: a, o: '', ppl: []}); });
  (v.items || []).forEach(x => { const a = +x.amt || 0; if (a < 0) { const ids = guessDiscItems(x.n, b.items); b.disc.push({id: 'd' + uid(), n: x.n, amt: Math.abs(a), items: ids, auto: !!ids.length}); } });
  if (DB.mcfg.people.length === 1) { const id = DB.mcfg.people[0].id; b.items.forEach(x => { x.ppl = [id]; }); }
  (DB.bills[k] = DB.bills[k] || []).push(b); v.bill = {k, id: b.id}; saveInvs(); shopChanged();
  while (sheets.length) sheets[sheets.length - 1].close(); buzz(30); toast('✅ 已建立分帳，接著選每一項是誰付的', 3000); gotoBill(k, b.id);
}

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
      <div class="msSec"><div class="msH"><b class="grow">🏪 店家名稱對照</b></div><div class="small muted" style="margin-bottom:.4rem">掃 QR Code 只會拿到統編，App 會自動查經濟部公示資料；查不到或想改名可以在這裡改</div>
        ${Object.entries(DB.scfg.sellers || {}).map(([id, nm]) => `<div class="msR" data-id="${id}"><b class="grow">${esc(nm)}<small class="muted" style="display:block;font-weight:500">${id}</small></b><button class="btn sm" data-a="sRen">✎</button></div>`).join('') || '<div class="small muted">還沒有</div>'}</div>
      <div class="msSec"><div class="msH"><b class="grow">🧾 發票紀錄</b></div><div class="small muted">共 ${n} 張，會一起放進「設定 → 匯出備份」。</div>${n ? '<button class="btn sm danger" data-a="wipe" style="margin-top:.6rem">清除所有發票</button>' : ''}</div>
      <div class="gTip">ℹ️ 用手機條碼直接連動載具、把紙本發票存進載具，需要財政部核發的電子發票 API 帳號（目前只開放給營業人或組織，並要求資安認證），所以這裡改用掃描 QR Code、匯入 CSV 和 App 內讀取網站的方式。</div>`; };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a]'); if (!t) return; const a = t.dataset.a;
    if (a === 'car') { await editCarrier(); draw(); } else if (a === 'carDel') { delete DB.scfg.carrier; saveScfg(); draw(); }
    else if (a === 'sRen') { const id = t.closest('.msR').dataset.id, nv = ((await askText('店家名稱', DB.scfg.sellers[id])) || '').trim(); if (nv) { DB.scfg.sellers[id] = nv; saveScfg(); draw(); } }
    else if (a === 'wipe') { if (!await ask('確定要清除所有發票紀錄嗎？（分帳紀錄不會刪）', '全部清除', true)) return; DB.invs = {}; saveInvs(); draw(); } });
}
