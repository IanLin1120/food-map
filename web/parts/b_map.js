/* ============================================================
   地圖（3D 向量地圖，設計同行跡導航：MapLibre + OpenFreeMap）、搜尋、收藏地點
   ============================================================ */
const M = {map: null, ready: false, marks: new Map(), temp: null, me: null, meLL: null, filter: 'all', sel: null, draft: null, watch: null};
const OFM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_STYLE = {version: 8, sources: {osm: {type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19}},
  layers: [{id: 'bg', type: 'background', paint: {'background-color': '#e6dcc6'}}, {id: 'osm', type: 'raster', source: 'osm'}]};

/* 網路請求：先用瀏覽器 fetch；在 App 內若被瀏覽器擋下（CORS 等），自動改走原生連線 */
const NBCB = {}; window.__nbHttp = (id, status, text) => { const f = NBCB[id]; if (f) { delete NBCB[id]; f({status, text}); } };
function nbHttp(url, opt, timeout) { return new Promise((res, rej) => { const id = 'h' + uid(), tm = setTimeout(() => { delete NBCB[id]; rej(new Error('連線逾時，請確認網路')); }, timeout);
  NBCB[id] = r => { clearTimeout(tm); if (!r.status) rej(new Error('網路連線失敗，請確認網路')); else res(r.text); };
  NB.http(id, (opt && opt.method) || 'GET', url, JSON.stringify((opt && opt.headers) || {}), (opt && opt.body) || '', timeout); }); }
async function jfetch(url, opt, timeout) {
  timeout = timeout || 20000; const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeout); let t, ok = true, st = 0;
  try { const r = await fetch(url, Object.assign({signal: ctl.signal}, opt || {})); ok = r.ok; st = r.status; t = await r.text(); }
  catch (e) { clearTimeout(tm); if (e && e.name === 'AbortError') throw new Error('連線逾時，請確認網路'); if (IS_APP && NB.http) t = await nbHttp(url, opt, timeout); else throw new Error('網路連線失敗，請確認網路'); }
  finally { clearTimeout(tm); }
  let j = null; try { j = JSON.parse(t); } catch (e) {} if (j == null) throw new Error(ok ? '伺服器回應格式不正確' : '伺服器錯誤 ' + st); return j;
}

async function mapStyle() {
  let c = null; try { c = JSON.parse(localStorage.getItem('fm.style') || 'null'); } catch (e) {}
  let st = c && c.st && Date.now() - c.t < 14 * 864e5 ? c.st : null;
  if (!st) { try { st = await jfetch(OFM_STYLE, null, 15000); if (!st.layers) throw new Error('style'); try { localStorage.setItem('fm.style', JSON.stringify({t: Date.now(), st})); } catch (e) {} }
    catch (e) { st = c && c.st ? c.st : null; } }
  if (!st) return JSON.parse(JSON.stringify(FALLBACK_STYLE));
  st = JSON.parse(JSON.stringify(st));
  /* 路名、地名一律優先顯示繁體中文 */
  const ZH = ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh-TW'], ['get', 'name'], ['get', 'name:zh'], ['get', 'name_en']];
  st.layers.forEach(l => { const tf = l.layout && l.layout['text-field']; if (tf == null) return; const js = JSON.stringify(tf); if (/name/.test(js) && !/"ref"/.test(js)) l.layout['text-field'] = ZH; });
  /* 3D 建築：沿用樣式內建的立體建築層，沒有就自己加一層；顏色調成暖色調 */
  let b3 = st.layers.find(l => l.type === 'fill-extrusion');
  if (!b3) { const src = Object.keys(st.sources).find(k => st.sources[k].type === 'vector');
    if (src) { b3 = {id: 'fm-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 14, paint: {'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0]}}; st.layers.push(b3); } }
  if (b3) { b3.paint = Object.assign({}, b3.paint, {'fill-extrusion-color': '#e3d6bf', 'fill-extrusion-opacity': .88}); }
  /* 圖磚、字型、圖示都改走自訂通道：有離線地圖就讀手機裡的，沒有才上網抓 */
  M.rawStyle = {glyphs: st.glyphs, sprite: st.sprite, fonts: [...new Set(st.layers.map(l => l.layout && l.layout['text-font']).filter(f => Array.isArray(f) && typeof f[0] === 'string').map(f => f.join(',')))]};
  Object.keys(st.sources).forEach(k => { const so = st.sources[k]; if (so.type === 'vector' && (so.url || '').indexOf('openfreemap') >= 0) { Off.tjUrl = so.url; st.sources[k] = {type: 'vector', tiles: ['fmt://{z}/{x}/{y}'], minzoom: 0, maxzoom: 14, attribution: '© OpenFreeMap © OpenStreetMap'}; } });
  if (typeof st.glyphs === 'string') st.glyphs = 'fmc://' + st.glyphs; if (typeof st.sprite === 'string') st.sprite = 'fmc://' + st.sprite;
  return st;
}

function mapHint(msg) { let h = $('.mapHint'); if (!msg) { if (h) h.remove(); return; } if (!h) { h = el('<div class="mapHint card"></div>'); $('#pgMap').append(h); } h.textContent = msg; }

async function initMap() {
  if (!window.maplibregl) { mapHint('地圖元件載入失敗'); return; }
  Off.init();
  const st = await mapStyle(), v = S.view || {c: [120.96, 23.75], z: 6.6};
  try {
    M.map = new maplibregl.Map({container: 'map', style: st, center: v.c, zoom: v.z, pitch: S.map3d ? (v.p != null ? v.p : 55) : 0, bearing: v.b || 0, maxPitch: 70, attributionControl: false,
      localIdeographFontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif', fadeDuration: 0, dragRotate: true});
  } catch (e) { mapHint('這個裝置不支援 3D 向量地圖（WebGL），收藏與食譜功能仍可正常使用'); return; }
  const m = M.map; M.ready = true;
  m.on('load', () => { try { m.setLight({anchor: 'viewport', intensity: .22, color: '#ffffff', position: [1.2, 200, 35]}); } catch (e) {} Area.draw(); });
  m.on('error', () => {});
  const saveView = debounce(() => { const c = m.getCenter(); S.view = {c: [+c.lng.toFixed(6), +c.lat.toFixed(6)], z: +m.getZoom().toFixed(2), p: Math.round(m.getPitch()), b: Math.round(m.getBearing())}; saveS(); }, 600);
  const onView = () => { $('#map').classList.toggle('zLbl', S.labels && m.getZoom() >= 13.5); $('#fb3d').classList.toggle('on', m.getPitch() > 5); $('#fb3d').textContent = m.getPitch() > 5 ? '3D' : '2D';
    $('#fbN svg').style.transform = `rotate(${-m.getBearing()}deg)`; };
  m.on('move', onView); m.on('moveend', saveView); onView();
  m.on('click', e => { hideResults(); $('#mQ').blur(); if (M.sel || M.draft) { clearSel(); return; } Area.tap(e.lngLat.lng, e.lngLat.lat); });
  m.on('contextmenu', e => { e.preventDefault(); pickPoint(e.lngLat.lat, e.lngLat.lng); });
  { let lt = 0, sx = 0, sy = 0; const cv = m.getCanvasContainer();
    cv.addEventListener('touchstart', e => { clearTimeout(lt); if (e.touches.length !== 1 || e.target.closest('.pin')) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      lt = setTimeout(() => { const r = cv.getBoundingClientRect(), ll = m.unproject([sx - r.left, sy - r.top]); buzz(30); pickPoint(ll.lat, ll.lng); }, 650); }, {passive: true});
    cv.addEventListener('touchmove', e => { const t = e.touches[0]; if (!t || e.touches.length > 1 || Math.hypot(t.clientX - sx, t.clientY - sy) > 10) clearTimeout(lt); }, {passive: true});
    ['touchend', 'touchcancel'].forEach(ev => cv.addEventListener(ev, () => clearTimeout(lt), {passive: true})); }
  syncMarkers();
  /* 一進 App 就定位到現在的位置、朝北，並選好目前的鄉鎮 */
  locWarm(); Loc.start(); Loc.want = 3;
}
function mapResize() { if (M.map) setTimeout(() => M.map.resize(), 30); }
function flyTo(lat, lon, z) { if (!M.map) return; M.map.flyTo({center: [lon, lat], zoom: Math.max(M.map.getZoom(), z || 16), pitch: S.map3d ? Math.max(M.map.getPitch(), 50) : M.map.getPitch(), duration: 900, essential: true}); }

/* ---------- 旗子圖釘 ---------- */
function pinEl(p) { const c = catOf(p.cat); const e = el(`<div class="pin"><div class="hit"></div><div class="base"></div><div class="pole"></div><div class="knob"></div><div class="flag">${esc(c.icon)}</div><div class="lbl">${esc(p.name)}</div></div>`);
  e.style.setProperty('--c', c.color); return e; }
function syncMarkers() {
  if (!M.map) return;
  const live = new Set(DB.places.map(p => p.id));
  for (const [id, mk] of M.marks) if (!live.has(id)) { mk.remove(); M.marks.delete(id); }
  DB.places.forEach(p => { const sig = [p.lat, p.lon, p.cat, p.name, catOf(p.cat).icon, catOf(p.cat).color].join('|'); let mk = M.marks.get(p.id);
    if (mk && mk._sig !== sig) { mk.remove(); M.marks.delete(p.id); mk = null; }
    if (!mk) { const e = pinEl(p); e.addEventListener('click', ev => { ev.stopPropagation(); selectPlace(p.id); });
      mk = new maplibregl.Marker({element: e, anchor: 'center'}).setLngLat([p.lon, p.lat]).addTo(M.map); mk._sig = sig; M.marks.set(p.id, mk); }
    const show = (M.filter === 'all' || pCats(p).includes(M.filter)) && (Area.has(p) || M.sel === p.id);
    mk.getElement().style.display = show ? '' : 'none'; mk.getElement().classList.toggle('sel', M.sel === p.id); });
}
function placesIn(f) { return f === 'all' ? DB.places : DB.places.filter(p => pCats(p).includes(f)); }
/* 目前地圖上看得到的：分類 ＋ 選取的縣市／鄉鎮市區 */
function placesShown(f) { return placesIn(f).filter(p => Area.has(p)); }

/* ---------- 上方分類列 ---------- */
function renderChips() {
  const box = $('#chips'), un = placesIn('').length; if (M.filter !== 'all' && M.filter !== '' && !DB.cats.some(c => c.id === M.filter)) M.filter = 'all'; if (M.filter === '' && !un) M.filter = 'all';
  box.innerHTML = `<button class="chip ${M.filter === 'all' ? 'on' : ''}" data-f="all">🗺️ 全部 <span class="n">${placesShown('all').length}</span></button>` +
    DB.cats.map(c => `<button class="chip srt ${M.filter === c.id ? 'on' : ''}" data-f="${c.id}" style="--c:${c.color}">${esc(c.icon)} ${esc(c.name)} <span class="n">${placesShown(c.id).length}</span></button>`).join('') +
    (un ? `<button class="chip ${M.filter === '' ? 'on' : ''}" data-f="" style="--c:${UNCAT.color}">📍 未分類 <span class="n">${un}</span></button>` : '') +
    `<button class="chip tool" data-f="+">✎ 分類</button>`;
}
function initChips() {
  $('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; const f = b.dataset.f; if (f === '+') { openCats('place'); return; }
    M.filter = f; clearSel(); renderChips(); syncMarkers(); if (S.area) Area.card(); else fitFilter(); });
  sortable($('#chips'), {item: '.chip.srt', axis: 'x', onSort(from, to) { moveItem(DB.cats, from, to); saveCats(); refreshAll(); }});
}
function fitFilter() { if (!M.map) return; const ps = placesShown(M.filter); if (!ps.length) { if (M.filter !== 'all') toast('這個分類還沒有收藏地點'); return; }
  const b = M.map.getBounds(); if (ps.some(p => b.contains([p.lon, p.lat]))) return;
  if (ps.length === 1) { flyTo(ps[0].lat, ps[0].lon, 15); return; }
  const bb = new maplibregl.LngLatBounds(); ps.forEach(p => bb.extend([p.lon, p.lat])); M.map.fitBounds(bb, {padding: {top: 150, bottom: 120, left: 50, right: 70}, maxZoom: 16, duration: 900}); }
function refreshAll() { Area.cache.clear(); renderChips(); syncMarkers(); if (curTab === 'Fav') renderFav(); updCounts(); if (S.area && !M.sel && !M.draft && !Area.hideList) Area.card(); }

/* ---------- 營業時間 ---------- */
const WD = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'], WD2 = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'], WD3 = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function hoursIdx(p) { const h = p.hours || []; if (!h.length) return -1; const d = new Date().getDay(); let i = h.findIndex(x => x.startsWith(WD[d]) || x.startsWith(WD2[d]) || x.toLowerCase().startsWith(WD3[d])); if (i < 0 && h.length === 7) i = (d + 6) % 7; return i; }
function openState(p) {
  const i = hoursIdx(p); if (i < 0) return null; const t = p.hours[i].replace(/^[^:：]{0,10}[:：]\s*/, ''); if (/休息|公休|不營業|closed/i.test(t)) return {open: false, txt: '今日休息'};
  if (/24\s*小時/.test(t)) return {open: true, txt: '24 小時營業'};
  const n = new Date(), now = n.getHours() * 60 + n.getMinutes(), re = /(上午|下午|AM|PM)?\s*(\d{1,2})[:：](\d{2})\s*(AM|PM)?\s*[–\-~－—至到]+\s*(上午|下午|AM|PM)?\s*(\d{1,2})[:：](\d{2})\s*(AM|PM)?/gi;
  const mins = (ap, h, m) => { h = +h; if (ap && /下午|PM/i.test(ap) && h < 12) h += 12; if (ap && /上午|AM/i.test(ap) && h === 12) h = 0; return h * 60 + +m; };
  let mm, any = false, open = false; while ((mm = re.exec(t))) { any = true; const a = mins(mm[1] || mm[4], mm[2], mm[3]); let b = mins(mm[5] || mm[8], mm[6], mm[7]); if (b <= a) b += 1440; if ((now >= a && now < b) || (now + 1440 >= a && now + 1440 < b)) open = true; }
  return {open: any ? open : null, txt: t};
}
function stateHtml(p) { const s = openState(p); if (!s) return ''; return `<span class="dot ${s.open === true ? 'ok' : s.open === false ? 'no' : ''}"></span>${s.open === true ? '營業中 · ' : s.open === false && s.txt !== '今日休息' ? '休息中 · ' : ''}${esc(s.txt)}`; }

/* ---------- 地圖下方資訊卡 ---------- */
function showCard(html) { const c = $('#mCard'); c.innerHTML = html; c.classList.add('on'); requestAnimationFrame(() => { $$('.mapFabs').forEach(f => { f.style.bottom = c.offsetHeight + 22 + 'px'; }); fabFit(); }); }
/* 下方清冊打開、空間不夠時，先把 ＋／－ 收起來，避免按鈕疊到上面的區域選單 */
function fabFit() { const bar = $('#areaBar'); $$('.mapFabs').forEach(f => { f.classList.remove('tight'); if (bar && f.getBoundingClientRect().top < bar.getBoundingClientRect().bottom + 8) f.classList.add('tight'); }); }
function hideCard() { $('#mCard').classList.remove('on'); $$('.mapFabs').forEach(f => { f.style.bottom = ''; f.classList.remove('tight'); }); }
function clearSel() { M.sel = null; M.draft = null; if (M.temp) { M.temp.remove(); M.temp = null; } hideCard(); syncMarkers(); if (S.area && !Area.hideList) Area.card(); }
function mapBack() { if (curTab !== 'Map') return false; if (!$('#mResults').classList.contains('hide')) { hideResults(); return true; } if (M.sel || M.draft) { clearSel(); return true; } if (S.area) { Area.set(null); return true; } return false; }
function selectPlace(id, fly) {
  const p = DB.places.find(x => x.id === id); if (!p) return; if (curTab !== 'Map') showTab('Map');
  if (M.filter !== 'all' && (DB.cats.some(c => c.id === p.cat) ? p.cat : '') !== M.filter) { M.filter = 'all'; renderChips(); }
  M.draft = null; if (M.temp) { M.temp.remove(); M.temp = null; } M.sel = id; syncMarkers(); buzz(10); if (fly) flyTo(p.lat, p.lon, 16);
  const c = catOf(p.cat), n = (p.menu || []).length, ni = imgCount(p);
  showCard(`<div class="row" style="align-items:flex-start"><div class="grow" data-a="open"><h3>${esc(p.name)}</h3>
    <div class="small" style="margin:.25rem 0"><span class="tag" style="--c:${c.color}">${esc(c.icon)} ${esc(c.name)}</span></div>
    ${stateHtml(p) ? `<div class="small muted row" style="gap:.35rem">${stateHtml(p)}</div>` : ''}<div class="small muted">${esc(p.addr || '')}</div></div><button class="ic" data-a="x">✕</button></div>
    <div class="acts"><button class="btn pri" data-a="open">詳細資料</button><button class="btn olive" data-a="nav">🧭 導航</button>${hasMenu(p) ? `<button class="btn" data-a="menu">📋 菜單${n ? ' ' + n : ni ? ' 🖼️' : ''}</button>` : ''}${(() => { const k = Object.values(DB.bills || {}).reduce((t, L) => t + L.filter(b => b.place === p.id).length, 0); return k || !hasMenu(p) ? `<button class="btn" data-a="recs">🧾 ${hasMenu(p) ? '紀錄' : '消費紀錄'}${k ? ' ' + k : ''}</button>` : ''; })()}</div>`);
}
function initCard() {
  $('#mCard').addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a;
    if (act === 'ax') { Area.hideList = true; hideCard(); return; } if (act === 'ap') { selectPlace(a.dataset.id, true); return; } if (act === 'al') { Area.hideList = false; Area.card(); return; }
    if (act === 'x') { clearSel(); return; }
    if (M.sel) { const p = DB.places.find(x => x.id === M.sel); if (!p) return; if (act === 'open') openPlace(p.id); else if (act === 'nav') navTo(p); else if (act === 'menu') openPlace(p.id, true); else if (act === 'recs') openPlace(p.id, 'recs'); return; }
    if (M.draft) { const d = M.draft; if (act === 'add') addDraft(d); else if (act === 'nav') navTo(d); else if (act === 'gm') openUrl(gmUrl(d)); } });
}
const gmUrl = p => p.gurl || (p.gid ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name || '')}&query_place_id=${p.gid}` : `https://www.google.com/maps/search/?api=1&query=${(+p.lat).toFixed(6)},${(+p.lon).toFixed(6)}`);

/* 暫時選取的位置（搜尋結果、長按地圖） */
function showDraft(d, fly) {
  M.sel = null; M.draft = d; syncMarkers(); if (curTab !== 'Map') showTab('Map');
  if (M.map) { if (M.temp) M.temp.remove(); const e = el('<div class="pin temp sel"><div class="base"></div><div class="pole"></div><div class="knob"></div><div class="flag">📌</div></div>');
    M.temp = new maplibregl.Marker({element: e, anchor: 'center'}).setLngLat([d.lon, d.lat]).addTo(M.map); if (fly) flyTo(d.lat, d.lon, 16.5); }
  showCard(`<div class="row" style="align-items:flex-start"><div class="grow"><h3>${esc(d.name || '已選取的位置')}</h3>${d.tag ? `<div class="small muted">${esc(d.tag)}</div>` : ''}<div class="small muted" id="dAddr">${esc(d.addr || '查詢地址中…')}</div></div><button class="ic" data-a="x">✕</button></div>
    <div class="acts"><button class="btn pri" data-a="add">＋ 加入收藏</button><button class="btn olive" data-a="nav">🧭 導航</button><button class="btn" data-a="gm">Google 地圖</button></div>`);
}
async function pickPoint(lat, lon) {
  const d = {name: '', addr: '', lat, lon}; showDraft(d);
  try { const r = await revGeo(lat, lon); if (M.draft !== d) return; d.addr = r.addr; if (r.name) d.name = r.name; const a = $('#dAddr'); if (a) a.textContent = r.addr || `${lat.toFixed(5)}, ${lon.toFixed(5)}`; if (r.name) { const h = $('#mCard h3'); if (h) h.textContent = r.name; } }
  catch (e) { const a = $('#dAddr'); if (a && M.draft === d) a.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`; }
}
async function addDraft(d, done) {
  const p = {id: '', name: d.name || '', addr: d.addr || '', lat: d.lat, lon: d.lon, cat: M.filter !== 'all' ? M.filter : (DB.cats[0] ? DB.cats[0].id : ''), hours: [], phone: '', note: '', albums: [], menu: [], gid: d.gid || '', gurl: ''};
  if (S.gkey) { busy('向 Google 取得營業時間…'); try { await gFill(p); } catch (e) { toast('Google 資料沒有帶入：' + e.message, 3500); } busy(false); }
  editPlace(p, true, done);
}

/* ---------- 我的位置 ----------
   以前每次按都重新等 GPS（冷啟動可能 5～15 秒，逾時就要再按一次）。
   現在：App 開著時持續接收位置（新版 APK 用手機原生定位，同時用 GPS 與網路定位），
   按下按鈕立刻飛到最後一次的位置，再隨著更精準的定位自動修正。 */
var Loc = {last: null, on: false, wid: null, want: 0, err: '', native() { return !!(IS_APP && NB.locStart); },
  start() { if (this.on) return; this.on = true; this.err = '';
    if (this.native()) { try { NB.locStart(); } catch (e) {} return; }
    if (!navigator.geolocation) { this.err = '這個裝置不支援定位'; return; }
    /* 先要一個快速的大概位置（網路定位，通常 1 秒內），同時持續接收精準的 GPS 位置 */
    navigator.geolocation.getCurrentPosition(p => this.web(p), () => {}, {enableHighAccuracy: false, timeout: 5000, maximumAge: 600000});
    this.wid = navigator.geolocation.watchPosition(p => this.web(p), e => this.fail(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavail'), {enableHighAccuracy: true, maximumAge: 3000, timeout: 30000}); },
  stop() { if (!this.on) return; this.on = false; if (this.native()) { try { NB.locStop(); } catch (e) {} } if (this.wid != null) { navigator.geolocation.clearWatch(this.wid); this.wid = null; } },
  web(p) { this.fix(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp || Date.now(), 'web'); },
  onNative(d) { try { d = typeof d === 'string' ? JSON.parse(d) : d; } catch (e) { return; } if (d.err) { this.fail(d.err); return; } this.fix(d.lat, d.lon, d.acc, d.t, d.p); },
  fix(lat, lon, acc, t, src) {
    const L = this.last; if (L && t < L.t - 1000) return;                       /* 舊資料不要蓋掉新的 */
    if (L && Date.now() - L.t < 10000 && acc > L.acc * 2.5 && L.acc < 80) return; /* 剛有精準 GPS 時，不要被粗略的網路定位拉走 */
    this.last = {lat, lon, acc: acc || 0, t: t || Date.now(), src}; this.err = ''; M.meLL = [lat, lon]; this.draw();
    if (this.want) { const fresh = Date.now() - this.last.t < 30000;
      if (this.want === 3) { this.entry(); this.want = fresh && acc < 60 ? 0 : 2; if (!this.want) this.busy(false); }
      else if (this.want === 1 || (fresh && acc < 120)) { this.fly(this.want === 1); this.want = fresh && acc < 60 ? 0 : 2; if (!this.want) this.busy(false); } }
  },
  fail(code) { this.err = code; if (this.want && !this.last) { this.want = 0; this.busy(false);
    toast(code === 'denied' ? '請允許定位權限才能顯示你的位置' : code === 'off' ? '手機的定位功能是關閉的，請到系統設定開啟「位置」' : '暫時抓不到位置，請到室外或確認已開啟定位', 3500); } },
  draw() { if (!M.map || !this.last) return; const L = this.last;
    if (!M.me) { const e = el('<div class="meWrap"><div class="meAcc"></div><div class="meDot"></div></div>'); M.me = new maplibregl.Marker({element: e}).setLngLat([L.lon, L.lat]).addTo(M.map); M.map.on('zoom', () => this.acc()); }
    else M.me.setLngLat([L.lon, L.lat]); this.acc(); },
  acc() { if (!M.me || !this.last) return; const z = M.map.getZoom(), mpp = 156543.03 * Math.cos(this.last.lat * Math.PI / 180) / Math.pow(2, z), px = Math.min(400, Math.max(0, this.last.acc / mpp * 2));
    const a = M.me.getElement().querySelector('.meAcc'); a.style.width = a.style.height = px + 'px'; a.style.display = px > 22 ? '' : 'none'; },
  /* 進 App：飛到目前位置、轉回朝北，並自動選好目前所在的鄉鎮市區 */
  entry() { if (!M.map || !this.last) return; const L = this.last; M.map.flyTo({center: [L.lon, L.lat], zoom: Math.max(M.map.getZoom(), 15.5), bearing: 0, duration: 700, essential: true});
    const tw = TW.init() && TW.townAt(L.lon, L.lat); if (tw && !(S.area && S.area.c === tw.county && S.area.t === tw.name) && !M.sel && !M.draft) Area.set({c: tw.county, t: tw.name}, false);
    if (typeof AM !== 'undefined' && AM.map && curTab === 'AccM') accMapLocate('entry'); },
  /* 回到 App（離開超過 3 分鐘）也當作重新進來 */
  resume() { if (!this.hidAt || Date.now() - this.hidAt < 180000) return; this.hidAt = 0; if (curTab === 'AccM') { if (typeof accMapLocate === 'function') accMapLocate('entry'); return; }
    if (this.last && Date.now() - this.last.t < 20000) this.entry(); else this.want = 3; },
  fly(first) { if (!M.map || !this.last) return; const c = [this.last.lon, this.last.lat];
    if (first) M.map.flyTo({center: c, zoom: Math.max(M.map.getZoom(), 16), duration: 700, essential: true}); else M.map.easeTo({center: c, duration: 500}); },
  busy(b) { const f = $('#fbMe'); if (f) f.classList.toggle('locating', !!b); clearTimeout(this.bt); if (b) this.bt = setTimeout(() => { if (this.want) { this.want = 0; this.busy(false); if (!this.last) toast('暫時抓不到位置，請到室外或確認已開啟定位', 3500); } }, 25000); }
};
function locateMe(quiet) {
  Loc.start(); if (quiet) return;
  const L = Loc.last, age = L ? Date.now() - L.t : 1e9;
  if (L) { Loc.fly(true); if (age < 15000 && L.acc < 60) { Loc.want = 0; Loc.busy(false); return; } Loc.want = 2; Loc.busy(true); return; }   /* 先飛到最後的位置，再等更準的定位 */
  if (Loc.err === 'denied' || Loc.err === 'off') { const c = Loc.err; Loc.stop(); Loc.start(); Loc.err = c; }
  Loc.want = 1; Loc.busy(true);
}
/* 有權限就一打開 App 就開始暖機定位，按按鈕時就不用等；App 切到背景時暫停省電 */
async function locWarm() {
  let ok = false; try { if (Loc.native()) ok = !!(NB.locHasPerm && NB.locHasPerm()); else if (navigator.permissions) ok = (await navigator.permissions.query({name: 'geolocation'})).state === 'granted'; } catch (e) {}
  if (ok || S.locOn) Loc.start();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { Loc.wasOn = Loc.on; Loc.hidAt = Date.now(); Loc.stop(); } else { if (Loc.wasOn) Loc.start(); Loc.resume(); } });
}

/* ---------- 搜尋：Google Places API (New)，與行跡導航相同；沒有金鑰時改用 OpenStreetMap ---------- */
const GPC = new Map();
const gHead = mask => ({'Content-Type': 'application/json', 'X-Goog-Api-Key': S.gkey, 'X-Goog-FieldMask': mask});
function gErrHint(m, st) { m = String(m || '') + ' ' + String(st || '');
  if (/API key not valid|API_KEY_INVALID/i.test(m)) return '金鑰不正確，請確認有完整複製（通常以 AIza 開頭）。';
  if (/has not been used|is disabled|SERVICE_DISABLED|not enabled/i.test(m)) return '這個專案還沒啟用「Places API (New)」，請依教學第 3 步啟用，等 1～2 分鐘再試。';
  if (/billing/i.test(m)) return '專案還沒有設定帳單帳戶，請依教學第 2 步完成。';
  if (/blocked|API_KEY_SERVICE_BLOCKED/i.test(m)) return '金鑰的「API 限制」沒有勾選「Places API (New)」。';
  if (/referer|referrer|IP address|Android app|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_ANDROID_APP_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED/i.test(m)) return '金鑰的「應用程式限制」請改成「無」。';
  if (/quota|RESOURCE_EXHAUSTED|rate/i.test(m)) return '已達用量上限，請稍後再試。';
  return ''; }
function gThrow(j) { if (j && j.error) { const m = j.error.message || j.error.status || '錯誤', h = gErrHint(m + JSON.stringify(j.error.details || ''), j.error.status); throw new Error(h || ('Google：' + m)); } }
const cleanAddr = a => String(a || '').replace(/^\d{3,6}\s*/, '').replace(/^(台灣|臺灣)/, '');
async function gPlaces(q, c, o) {
  o = o || {}; c = c || [23.9, 121]; const g = o.area, k = q + '|' + (g ? 'A' + g.bbox.join(',') : (+c[0]).toFixed(2) + ',' + (+c[1]).toFixed(2)) + '|' + (o.n || 10), h = GPC.get(k); if (h && Date.now() - h.t < 6e5) return h.r;
  /* 有選區域：只在那一區的範圍裡找，最多翻 3 頁（60 筆），再用行政區外框把區外的剔掉 */
  const body = {textQuery: q, languageCode: 'zh-TW', regionCode: 'TW', pageSize: o.n || 10};
  if (g) body.locationRestriction = {rectangle: {low: {latitude: g.bbox[1], longitude: g.bbox[0]}, high: {latitude: g.bbox[3], longitude: g.bbox[2]}}};
  else body.locationBias = {circle: {center: {latitude: +c[0], longitude: +c[1]}, radius: o.r || 50000}};
  let out = [], seen = new Set();
  for (let pg = 0; pg < (g ? 3 : 1); pg++) {
    const j = await jfetch('https://places.googleapis.com/v1/places:searchText', {method: 'POST', headers: gHead('places.id,places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,nextPageToken'), body: JSON.stringify(body)}, 12000); gThrow(j);
    (j.places || []).filter(p => p.location && !seen.has(p.id)).forEach(p => { seen.add(p.id); out.push({name: (p.displayName && p.displayName.text) || q, addr: cleanAddr(p.formattedAddress), lat: p.location.latitude, lon: p.location.longitude, tag: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || '', gid: p.id}); });
    if (!j.nextPageToken) break; body.pageToken = j.nextPageToken; }
  if (g) out = out.filter(x => TW.inGeom(g.geom, x.lon, x.lat));
  GPC.set(k, {t: Date.now(), r: out}); if (GPC.size > 60) GPC.delete(GPC.keys().next().value); return out;
}

const G_DETAIL = 'id,displayName,formattedAddress,location,regularOpeningHours.weekdayDescriptions,nationalPhoneNumber,rating,userRatingCount,googleMapsUri,websiteUri';
/* 從 Google 帶入名稱、地址、營業時間、電話、評分 */
async function gFill(p, force) {
  let d = null;
  if (p.gid) { d = await jfetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.gid)}?languageCode=zh-TW&regionCode=TW`, {headers: gHead(G_DETAIL)}, 12000); gThrow(d); }
  else { const body = {textQuery: p.name || p.addr || `${p.lat},${p.lon}`, languageCode: 'zh-TW', regionCode: 'TW', maxResultCount: 1, locationBias: {circle: {center: {latitude: p.lat, longitude: p.lon}, radius: 200}}};
    const j = await jfetch('https://places.googleapis.com/v1/places:searchText', {method: 'POST', headers: gHead(G_DETAIL.split(',').map(x => 'places.' + x).join(',')), body: JSON.stringify(body)}, 12000); gThrow(j); d = (j.places || [])[0];
    if (!d) throw new Error('Google 上找不到這個地點'); }
  p.gid = d.id || p.gid; const nm = d.displayName && d.displayName.text; if (nm && (force || !p.name)) p.name = nm;
  if (d.formattedAddress && (force || !p.addr)) p.addr = cleanAddr(d.formattedAddress);
  const h = d.regularOpeningHours && d.regularOpeningHours.weekdayDescriptions; if (h && h.length) p.hours = h.slice();
  if (d.nationalPhoneNumber) p.phone = d.nationalPhoneNumber; if (d.rating) { p.rating = d.rating; p.ratingN = d.userRatingCount || 0; }
  if (d.googleMapsUri) p.gurl = d.googleMapsUri; if (d.websiteUri) p.web = d.websiteUri; return p;
}
let nomLast = 0;
async function nomSearch(q, c, g) { const w = 1100 - (Date.now() - nomLast); if (w > 0) await sleep(w); nomLast = Date.now();
  let u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=zh-TW,zh,en&countrycodes=tw&q=' + encodeURIComponent(q);
  if (g) u = u.replace('limit=8', 'limit=40') + `&bounded=1&viewbox=${g.bbox[0]},${g.bbox[3]},${g.bbox[2]},${g.bbox[1]}`; else if (c) u += `&viewbox=${c[1] - .6},${c[0] + .6},${c[1] + .6},${c[0] - .6}`;
  const j = await jfetch(u, null, 10000); return (Array.isArray(j) ? j : []).filter(x => !g || TW.inGeom(g.geom, +x.lon, +x.lat)).map(x => ({name: x.name || x.display_name.split(',')[0], addr: nomAddr(x.display_name), lat: +x.lat, lon: +x.lon, tag: ''})); }
const nomAddr = dn => String(dn || '').split(', ').filter(s => !/^\d{3,6}$/.test(s) && !/^(臺灣|台灣|Taiwan)$/.test(s)).reverse().join('');
async function revGeo(lat, lon) { const j = await jfetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=zh-TW,zh,en&lat=${lat}&lon=${lon}`, null, 10000);
  const poi = j && j.name && !/^\d/.test(j.name) && j.category && !/highway|boundary|place/.test(j.category) ? j.name : ''; return {addr: nomAddr(j && j.display_name), name: poi}; }

let searchSeq = 0;
function hideResults() { $('#mResults').classList.add('hide'); }
function localMatches(q) { q = q.toLowerCase(); return DB.places.filter(p => (p.name + ' ' + (p.addr || '')).toLowerCase().includes(q)).slice(0, 5); }
function renderResults(q, remote, note) {
  const box = $('#mResults'), loc = localMatches(q); M.results = remote || [];
  const html = loc.map(p => { const c = catOf(p.cat); return `<button class="res" data-id="${p.id}"><span class="rIc" style="background:${c.color}">${esc(c.icon)}</span><span class="grow"><b>${esc(p.name)}</b><small>已收藏 · ${esc(c.name)}${p.addr ? ' · ' + esc(p.addr) : ''}</small></span></button>`; }).join('') +
    (remote || []).map((r, i) => `<button class="res" data-i="${i}"><span class="rIc">📍</span><span class="grow"><b>${esc(r.name)}</b><small>${r.tag ? esc(r.tag) + ' · ' : ''}${esc(r.addr)}</small></span></button>`).join('') + (note ? `<div class="resNote">${note}</div>` : '');
  box.innerHTML = html; box.classList.toggle('hide', !html);
}
/* 像 Google 地圖：搜尋「停車場」這類關鍵字時，把所有結果都標在地圖上，點標籤就能加入收藏 */
function resMarks(r, fit) { (M.rMarks || []).forEach(m => m.remove()); M.rMarks = []; if (!M.map || !r || !r.length) return;
  r.forEach(x => { const e = el(`<button class="amPin res"><span><i>📍</i></span><b>${esc(x.name)}</b></button>`);
    e.onclick = ev => { ev.stopPropagation(); buzz(10); hideResults(); showDraft(Object.assign({}, x), false); M.map.easeTo({center: [x.lon, x.lat], duration: 400}); };
    M.rMarks.push(new maplibregl.Marker({element: e, anchor: 'bottom'}).setLngLat([x.lon, x.lat]).addTo(M.map)); });
  if (fit && r.length > 1) { const bb = new maplibregl.LngLatBounds(); r.forEach(x => bb.extend([x.lon, x.lat])); M.map.fitBounds(bb, {padding: {top: 170, bottom: 120, left: 50, right: 50}, maxZoom: 16, duration: 700}); }
  else if (fit && r.length === 1) flyTo(r[0].lat, r[0].lon, 16); }
const searchOpt = (m, a) => ({n: 20, r: m && m.getZoom() >= 11 ? 6000 : 50000, area: areaGeo(a)});
async function doSearch(q, fit) {
  q = q.trim(); if (q.length < 2) { hideResults(); resMarks(null); return; } const seq = ++searchSeq; renderResults(q, null, '搜尋中…');
  const c = M.map ? [M.map.getCenter().lat, M.map.getCenter().lng] : null;
  try { let r, note = '';
    if (S.gkey) r = await gPlaces(q, c, searchOpt(M.map, S.area)); else { r = await nomSearch(q, c, areaGeo(S.area)); note = '目前使用 OpenStreetMap 搜尋，店家較不齊全。<br>填入 Google Maps 金鑰後，可用 Google 地圖的方式搜尋並自動帶入營業時間。 <button class="btn sm pri" data-a="key" style="margin-top:.4rem">看圖文教學</button>'; }
    if (seq !== searchSeq) return; r = r.filter(x => !DB.places.some(p => (x.gid && p.gid === x.gid)));
    resMarks(r, fit); renderResults(q, r, r.length || localMatches(q).length ? note : '找不到符合的地點' + (note ? '<br>' + note : ''));
  } catch (e) { if (seq === searchSeq) renderResults(q, null, '❌ ' + esc(e.message) + (S.gkey ? ' <button class="btn sm" data-a="key" style="margin-top:.4rem">檢查金鑰設定</button>' : '')); }
}
function initSearch() {
  const inp = $('#mQ'), auto = debounce(() => doSearch(inp.value), 700);
  inp.addEventListener('input', () => { $('#mQx').style.display = inp.value ? '' : 'none'; const q = inp.value.trim(); if (q.length < 2) { searchSeq++; hideResults(); if (!q) resMarks(null); return; } renderResults(q, null, '輸入後稍等，或按 🔍 搜尋'); auto(); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); doSearch(inp.value, true); } });
  inp.addEventListener('focus', () => { if (inp.value.trim().length >= 2 && $('#mResults').innerHTML) $('#mResults').classList.remove('hide'); });
  $('#mQgo').onclick = () => { inp.blur(); doSearch(inp.value, true); };
  $('#mQx').onclick = () => { inp.value = ''; $('#mQx').style.display = 'none'; searchSeq++; hideResults(); resMarks(null); inp.focus(); };
  $('#mResults').addEventListener('click', e => { const k = e.target.closest('[data-a="key"]'); if (k) { hideResults(); openTutorial('maps'); return; }
    const b = e.target.closest('.res'); if (!b) return; hideResults();
    if (b.dataset.id) selectPlace(b.dataset.id, true); else { const r = M.results[+b.dataset.i]; if (r) showDraft(Object.assign({}, r), true); } });
}
function openAdd() {
  const sh = sheet({title: '新增收藏地點', html: `<div class="setC">
    <button class="setR" data-a="search" style="width:100%;text-align:left"><span style="font-size:1.4rem">🔍</span><span class="t"><b>搜尋地點</b><small>輸入名稱或地址，從搜尋結果加入</small></span></button>
    <button class="setR" data-a="center" style="width:100%;text-align:left"><span style="font-size:1.4rem">🎯</span><span class="t"><b>用地圖中心點</b><small>先把地圖移到店家位置，再按這裡</small></span></button>
    <button class="setR" data-a="me" style="width:100%;text-align:left"><span style="font-size:1.4rem">🧭</span><span class="t"><b>用我現在的位置</b><small>人在店裡時最方便</small></span></button></div>
    <div class="callout">💡 小技巧：直接<b>長按地圖</b>上任何一個位置，也可以插旗收藏。</div>`});
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; sh.close(); const a = b.dataset.a;
    if (a === 'search') setTimeout(() => $('#mQ').focus(), 300);
    else if (a === 'center') { if (!M.map) { toast('地圖尚未就緒'); return; } const c = M.map.getCenter(); pickPoint(c.lat, c.lng); }
    else { if (!navigator.geolocation) { toast('這個裝置不支援定位'); return; } toast('定位中…'); navigator.geolocation.getCurrentPosition(p => { flyTo(p.coords.latitude, p.coords.longitude, 17); pickPoint(p.coords.latitude, p.coords.longitude); }, () => toast('無法取得位置，請確認定位權限'), {enableHighAccuracy: true, timeout: 12000}); } });
}

/* ---------- 導航：選擇要用哪個導航軟體 ---------- */
function navApps(p) {
  const ll = `${(+p.lat).toFixed(6)},${(+p.lon).toFixed(6)}`, nm = encodeURIComponent(p.name || '目的地');
  const g = `https://www.google.com/maps/dir/?api=1&destination=${ll}${p.gid ? '&destination_place_id=' + p.gid : ''}&travelmode=driving`, wz = `https://waze.com/ul?ll=${ll}&navigate=yes`;
  const L = [{id: 'gmaps', name: 'Google 地圖', ic: '🗺️', sub: '開車、機車、大眾運輸、步行', go: () => IS_APP && NB.openNav ? NB.openNav('com.google.android.apps.maps', 'google.navigation:q=' + ll, g) : openUrl(g)}];
  if (IS_APP && NB.openNav) L.push({id: 'xingji', name: '行跡導航', ic: '🧭', sub: '用你自己的行跡導航 App 開啟', go: () => NB.openNav('com.ian.navi', 'google.navigation:q=' + ll, '')});
  L.push({id: 'waze', name: 'Waze', ic: '🚗', sub: '即時路況導航', go: () => IS_APP && NB.openNav ? NB.openNav('com.waze', wz, wz) : openUrl(wz)});
  if (IS_IOS) L.push({id: 'apple', name: 'Apple 地圖', ic: '🍎', sub: 'iPhone 內建地圖', go: () => openUrl(`https://maps.apple.com/?daddr=${ll}&q=${nm}&dirflg=d`)});
  if (IS_APP && NB.openNav) L.push({id: 'sys', name: '其他導航 App', ic: '📲', sub: '顯示手機裡所有能導航的 App 讓你選', go: () => NB.openNav('', `geo:${ll}?q=${ll}(${nm})`, g)});
  return L;
}
function navTo(p) {
  const L = navApps(p), def = L.find(x => x.id === S.navApp); if (def) { toast('用「' + def.name + '」導航到 ' + (p.name || '目的地')); def.go(); return; }
  const sh = sheet({title: '導航到 ' + (p.name || '這個位置'), html: `<div class="setC">${L.map(x => `<button class="setR" data-id="${x.id}" style="width:100%;text-align:left"><span style="font-size:1.5rem">${x.ic}</span><span class="t"><b>${x.name}</b><small>${x.sub}</small></span><span class="muted">›</span></button>`).join('')}</div>
    <label class="row" style="margin-top:.9rem;gap:.5rem"><input type="checkbox" id="navRem" style="width:1.2rem;height:1.2rem;flex:none"> <span class="small">記住我的選擇，下次直接開啟（可到「設定」更改）</span></label>`});
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (!b) return; const x = L.find(y => y.id === b.dataset.id); if ($('#navRem', sh.body).checked) { S.navApp = x.id; saveS(); if (curTab === 'Set') renderSet(); } sh.close(); x.go(); });
}
