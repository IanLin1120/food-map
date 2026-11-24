'use strict';
/* ============================================================
   日日帳本 — 核心：工具、資料儲存、主題、面板、拖曳排序、圖片
   ============================================================ */
const APP_VERSION = '__VER__';
const APP_VER = APP_VERSION;
/* 線上更新來源（GitHub Pages）：IanLin1120/food-map */
const GH = {repo: 'https://github.com/IanLin1120/food-map', pages: 'https://ianlin1120.github.io/food-map/'};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const IS_APP = typeof window.NB === 'object' && !!window.NB; const NB = window.NB || {};
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

/* ---------- IndexedDB ---------- */
const IDB = {
  db: null, mem: {kv: new Map(), places: new Map(), recipes: new Map(), imgs: new Map()},
  open() { return new Promise(res => { try { const r = indexedDB.open('shiguang-foodmap', 1);
    r.onupgradeneeded = () => { const d = r.result; ['kv', 'places', 'recipes', 'imgs'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
    r.onsuccess = () => { IDB.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false); } catch (e) { res(false); } }); },
  run(store, mode, fn) { if (!IDB.db) return Promise.resolve(fn(null, IDB.mem[store]));
    return new Promise((res, rej) => { const t = IDB.db.transaction(store, mode), s = t.objectStore(store); let rq; try { rq = fn(s); } catch (e) { rej(e); return; }
      t.oncomplete = () => res(rq && 'result' in rq ? rq.result : undefined); t.onerror = t.onabort = () => rej(t.error || new Error('儲存失敗')); }); },
  get(st, k) { return IDB.run(st, 'readonly', (s, m) => s ? s.get(k) : m.get(k)); },
  all(st) { return IDB.run(st, 'readonly', (s, m) => s ? s.getAll() : [...m.values()]); },
  keys(st) { return IDB.run(st, 'readonly', (s, m) => s ? s.getAllKeys() : [...m.keys()]); },
  put(st, k, v) { return IDB.run(st, 'readwrite', (s, m) => s ? s.put(v, k) : void m.set(k, v)); },
  del(st, k) { return IDB.run(st, 'readwrite', (s, m) => s ? s.delete(k) : void m.delete(k)); },
  clear(st) { return IDB.run(st, 'readwrite', (s, m) => s ? s.clear() : void m.clear()); }
};

/* ---------- 狀態 ---------- */
const S_DEF = {autoUpd: true, theme: 'auto', palette: 'earth', scale: 100, haptic: true, hapLv: 2, map3d: true, area: null, rfold: {}, labels: true, navApp: 'ask', gkey: '', aikey: '', aimodel: 'auto', view: null, onboard: false, fold: {}};
let S = Object.assign({}, S_DEF);
const DB = {cats: [], places: [], recipes: [], rcats: []};
/* 食譜分類（料理方式），可自訂名稱、圖示、排序 */
const DEF_RCATS = [['煎', '🍳', '#D2603A'], ['炒', '🥘', '#E8A13A'], ['電鍋', '🍚', '#5A7A44'], ['湯', '🍲', '#3F8F86'], ['烤', '🔥', '#C23B4E'], ['甜點', '🍰', '#C2678F']];
const RUNCAT = {id: '', name: '未分類', icon: '📖', color: '#7d6c57'};
const rcatOf = id => DB.rcats.find(c => c.id === id) || RUNCAT;
const DEF_CATS = [
  ['早餐', '🍳', '#E8A13A'], ['午餐', '🍱', '#D2603A'], ['晚餐', '🍽️', '#8E4B2B'], ['宵夜', '🌙', '#4A5B8C'],
  ['速食店', '🍔', '#C23B4E'], ['飲料店', '🧋', '#3F8F86'], ['咖啡廳', '☕', '#6B5344'], ['甜點', '🍰', '#C2678F']
];
const CAT_COLORS = ['#E8A13A', '#D2603A', '#C23B4E', '#C2678F', '#8A5A9E', '#4A5B8C', '#3F6E8C', '#3F8F86', '#5A7A44', '#8C8A2E', '#8E4B2B', '#6B5344', '#57606A', '#2F2A25'];
const CAT_EMOJI = '🍳 🥪 🥞 🥐 🍱 🍛 🍜 🍝 🍚 🍙 🍣 🥟 🍲 🥘 🍽️ 🥩 🍗 🍖 🍔 🍟 🍕 🌭 🌮 🥗 🍢 🍡 🌙 🍺 🍻 🍷 🍶 🧋 🥤 🍵 ☕ 🧃 🍰 🧁 🍩 🍦 🍧 🍮 🥧 🍪 🍫 🥖 🧇 🥓 🧆 🦐 🦀 🐟 🔥 ⭐ ❤️ 🏪 🛒 🥬'.split(' ');
/* 購物分帳功能區的預設分類 */
const SHOP_CATS = [['量販店', '🛒', '#C23B4E'], ['超市', '🧺', '#5A7A44'], ['超商', '🏪', '#3F6E8C'], ['外送', '🛵', '#D2603A'], ['藥妝', '💊', '#8A5A9E'], ['其他', '🛍️', '#6B5344']];
const UNCAT = {id: '', name: '未分類', icon: '📍', color: '#7d6c57'};
const catOf = id => DB.cats.find(c => c.id === id) || UNCAT;

const saveS = debounce(() => { IDB.put('kv', 'S', S).catch(() => {}); try { localStorage.setItem('fm.theme', JSON.stringify({theme: S.theme, palette: S.palette, scale: S.scale})); } catch (e) {} }, 150);
const saveCats = () => IDB.put('kv', 'cats', DB.cats).catch(saveErr);
const saveRcats = () => IDB.put('kv', 'rcats', DB.rcats).catch(saveErr);
const savePlace = p => IDB.put('places', p.id, p).catch(saveErr);
const saveRecipe = r => IDB.put('recipes', r.id, r).catch(saveErr);
function saveErr(e) { toast('⚠️ 儲存失敗：' + (e && e.message || e), 4000); }

const SAMPLE_RECIPES = [
  {title: '高麗菜大阪燒', serv: '一人份', ing: [['中筋麵粉', '60g'], ['水', '30g'], ['蛋', '一顆'], ['高麗菜', '半顆×1/4'], ['雞胸肉', '剪碎(半盒)'], ['鹽巴', '少許(1/3匙)'], ['胡椒粉', '少許(提味用)'], ['油', '少許(加入麵糰中避免沾鍋)']],
    steps: ['秤重60g中筋麵粉', '倒入30g的飲用水', '加入一顆雞蛋', '加入1/3匙鹽巴以及少許胡椒粉', '倒入少許的油(大概一小湯匙左右)', '先將上述的步驟混合均勻成麵糊(沒有結塊的麵粉狀態即可)', '將半盒雞胸肉及高麗菜倒入麵糊中攪拌均勻', '在不沾鍋中倒入稍微多一點的油', '將麵糰倒入不沾鍋桌鋪平壓緊', '蓋上鍋蓋使用1200W煎5分鐘左右', '開蓋看是否有焦黑，如果沒有再複煎2分鐘', '開蓋翻面', '蓋上鍋蓋使用1200W再煎2-3分鐘', '出鍋灑上醬油膏以及美乃滋']},
  {title: '梅干扣肉食譜', serv: '兩人四天份', ing: [['五花肉', '一條'], ['洋蔥', '半顆'], ['滷味香滷包', '一包'], ['水', '300g'], ['水煮蛋', '八顆'], ['梅干菜', '150g'], ['可樂', '900mL'], ['醬油', '八匙(撈湯的湯匙)'], ['醬油膏', '一匙(吃飯的湯匙)'], ['胡椒粉', '少許(提味用)'], ['油', '少許(煎肉用)']],
    steps: ['浸泡150g梅干菜(水淹過梅干菜)', '蛋水煮(建議用蒸的)(煮熟後丟入冷水浸泡，這樣比較好剝蛋殼)', '使用煎鍋倒入少許油煎肉', '肉兩面煎的稍微金黃倒入洋蔥拌炒', '灑一些胡椒粉', '倒入一杯米杯可樂', '倒入一湯匙(吃飯用的小湯匙)醬油', '倒入些許醬油膏', '倒入些許米酒', '先將上述步驟的調味料與肉還有洋蔥拌炒大約2分鐘', '將煎好的肉夾到蒸鍋中(只夾肉，鍋中會剩餘醬料以及洋蔥)', '將浸泡完的梅干菜剪一剪然後擰乾丟入炒過中拌炒2分鐘(醬料會被梅干菜吸收)', '將炒完的梅干菜以及洋蔥倒入蒸鍋中(全部殘留的醬料也全部倒入鍋中)', '將浸泡在冷水中的水煮蛋剝好後放入蒸鍋中', '將滷味香滷包放入蒸鍋中', '將剩下的可樂全部倒入蒸鍋中', '倒入300cc的開水', '倒入八匙(撈湯用的湯匙)醬油', '倒入一匙(吃飯用的湯匙)醬油膏', '倒入一米杯米酒', '灑一些胡椒粉(提味用的)', '外鍋倒入300cc的開水', '蓋鍋蓋蒸到跳，然後燜一個小時']}
];

async function loadAll() {
  await IDB.open();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  const s = await IDB.get('kv', 'S').catch(() => null); if (s) S = Object.assign({}, S_DEF, s);
  const cats = await IDB.get('kv', 'cats').catch(() => null);
  if (cats) DB.cats = cats; else { DB.cats = DEF_CATS.map(([name, icon, color], i) => ({id: 'c' + i + uid(), name, icon, color})); saveCats();
    SAMPLE_RECIPES.forEach((r, i) => { const o = {id: uid() + i, title: r.title, serv: r.serv, ing: r.ing.map(([n, q]) => ({n, q})), steps: r.steps.slice(), note: '', cover: '', ord: i, t: Date.now()}; DB.recipes.push(o); saveRecipe(o); }); }
  if (cats) DB.recipes = (await IDB.all('recipes').catch(() => [])) || [];
  const allP = ((await IDB.all('places').catch(() => [])) || []).sort((a, b) => (a.ord || 0) - (b.ord || 0)); DB.recipes.sort((a, b) => (a.ord || 0) - (b.ord || 0));
  const rc = await IDB.get('kv', 'rcats').catch(() => null);
  if (rc) DB.rcats = rc; else { DB.rcats = DEF_RCATS.map(([name, icon, color], i) => ({id: 'r' + i + uid(), name, icon, color})); saveRcats(); }
  await loadMeal(); await loadShop();
  /* 美食點餐和購物分帳共用同一份收藏店家和分類（v3.4 起）。舊版購物分帳自己的店家：
     同名（或很近又名字相似）的店合併成一家、明細改指向美食那家；「外送」分類拿掉，那些店先放「未分類」讓你自己選 */
  let allPl = allP;
  if (!await IDB.get('kv', 'shared1').catch(() => null)) {
    const sc = await IDB.get('kv', 'cats_shop').catch(() => null) || SHOP_CATS.filter(c => c[0] !== '其他' || !DB.cats.some(f => f.name === '其他')).map(([name, icon, color], i) => ({id: 's' + i + uid(), name, icon, color})), foodP = allP.filter(p => (p.mode || 'food') === 'food'), shopP = allP.filter(p => p.mode === 'shop');
    const norm = x => String(x || '').replace(/\s+/g, '').toLowerCase(), near = (a, b) => Math.abs((a.lat || 0) - (b.lat || 0)) < 0.0007 && Math.abs((a.lon || 0) - (b.lon || 0)) < 0.0008;
    const dl = sc.find(c => c.name === '外送'), remap = {}, gone = [];
    sc.forEach(c => { if (dl && c.id === dl.id) return; const same = DB.cats.find(f => f.name === c.name); if (same) remap[c.id] = same.id; else DB.cats.push(c); });
    shopP.forEach(p => { const n = norm(p.name), dup = foodP.find(f => norm(f.name) === n || near(f, p) && n && (norm(f.name).includes(n) || n.includes(norm(f.name))));
      if (dup) { Object.values(DB.bills || {}).forEach(L => L.forEach(b => { if (b.place === p.id) b.place = dup.id; })); gone.push(p); IDB.del('places', p.id).catch(() => {}); }
      else { if (dl && p.cat === dl.id) p.cat = ''; else if (remap[p.cat]) p.cat = remap[p.cat]; delete p.mode; IDB.put('places', p.id, p).catch(() => {}); } });
    allPl = allP.filter(p => !gone.includes(p)); await IDB.put('kv', 'cats', DB.cats).catch(() => {}); await IDB.put('kv', 'bills', DB.bills || {}).catch(() => {}); await IDB.put('kv', 'shared1', 1).catch(() => {});
  }
  DB.side = {food: {places: allPl, cats: DB.cats}}; DB.side.shop = DB.side.food; DB.places = allPl;
  /* 舊版資料升級：菜單圖片改成「版本資料夾」（每個版本可放多張） */
  DB.places.forEach(p => { if (!p.albums) { p.albums = (p.imgs || []).length ? [{id: 'a' + uid(), name: dateName(p.t), t: p.t || Date.now(), imgs: p.imgs}] : []; delete p.imgs; savePlace(p); } });
}
const dateName = t => { const d = new Date(t || Date.now()); return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'); };
/* 菜單圖檔：albums 由新到舊；allImgs 依序攤平（最新版本在最前面） */
/* 版本順序：使用者排過的照自訂順序（o），之後新加的版本放最上面；沒排過的新到舊 */
const albumsOf = p => (p.albums || []).slice().sort((a, b) => ((a.o != null) - (b.o != null)) || (a.o != null ? a.o - b.o : (b.t || 0) - (a.t || 0)));
const imgCount = p => (p.albums || []).reduce((n, a) => n + (a.imgs || []).length, 0);

/* ---------- 震動、提示 ---------- */
/* 震動：強度 0 關／1 弱／2 中／3 強。新版 APK 可直接控制馬達強度，舊版以震動時間長短代替 */
let buzzAt = 0;
function buzz(ms) { const lv = S.haptic === false ? 0 : (S.hapLv == null ? 2 : S.hapLv); if (!lv) return; const now = Date.now(); if (now - buzzAt < 45) return; buzzAt = now; ms = ms || 12;
  try { if (IS_APP && NB.vibrate2) NB.vibrate2(Math.round(ms * [0, .8, 1, 1.4][lv]), [0, 70, 150, 255][lv]); else { const d = Math.max(1, Math.round(ms * [0, .5, 1, 2.2][lv])); if (IS_APP && NB.vibrate) NB.vibrate(d); else if (navigator.vibrate) navigator.vibrate(d); } } catch (e) {} }
/* 所有可以點的按鈕、選項，點下去都震動一下 */
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button,select,[data-a],.chip,.res,.pl,.rc,.rrow,.catRow,label.sw,input[type=checkbox],.pin,summary')) buzz(12); }, true);
let toastT; function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.remove('undo'); t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2400); }
/* 有「復原」按鈕的提示（刪除後 5 秒內可以救回來） */
function toastUndo(msg, undo) { const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span><button class="tUndo">↩ 復原</button>`; t.classList.add('on', 'undo'); clearTimeout(toastT);
  t.querySelector('.tUndo').onclick = e => { e.stopPropagation(); buzz(15); t.classList.remove('on', 'undo'); clearTimeout(toastT); undo(); };
  toastT = setTimeout(() => t.classList.remove('on', 'undo'), 5000); }
function busy(msg) { $('#busyT').textContent = msg || ''; $('#busy').classList.toggle('on', msg != null && msg !== false); }
function openUrl(u) { if (IS_APP && NB.openUrl) NB.openUrl(u); else window.open(u, '_blank', 'noopener'); }
async function copyText(t) { try { if (IS_APP && NB.copy) NB.copy(t); else await navigator.clipboard.writeText(t); toast('已複製'); } catch (e) { toast('無法複製'); } }

/* ---------- 主題配色（與網頁擷取相同：底色維持大地色，只換重點色） ---------- */
const PALETTES = {
  earth: {name: '大地棕', sw: '#a2613a', sd: '#e0a066'},
  moss: {name: '苔蘚綠', sw: '#5a7a44', sd: '#a8c787', l: {accent: '#5a7a44', 'accent-2': '#47622f'}, d: {accent: '#a8c787', 'accent-2': '#bcd69e', 'accent-fg': '#1a2410'}},
  teal: {name: '青瓷', sw: '#3f7a74', sd: '#86c4bb', l: {accent: '#3f7a74', 'accent-2': '#30625d'}, d: {accent: '#86c4bb', 'accent-2': '#9fd3cb', 'accent-fg': '#0d2421'}},
  indigo: {name: '靛藍', sw: '#3f6185', sd: '#97b7dc', l: {accent: '#3f6185', 'accent-2': '#304d6c'}, d: {accent: '#97b7dc', 'accent-2': '#adc7e6', 'accent-fg': '#0f1d2c'}},
  plum: {name: '紫藤', sw: '#6e5896', sd: '#b9a6e0', l: {accent: '#6e5896', 'accent-2': '#59467c'}, d: {accent: '#b9a6e0', 'accent-2': '#cabbe9', 'accent-fg': '#1e1430'}},
  rose: {name: '玫瑰', sw: '#a94f66', sd: '#eba0b2', l: {accent: '#a94f66', 'accent-2': '#8d3f54'}, d: {accent: '#eba0b2', 'accent-2': '#f2b5c3', 'accent-fg': '#2c0f17'}},
  amber: {name: '琥珀', sw: '#9a6b12', sd: '#e3b55a', l: {accent: '#9a6b12', 'accent-2': '#7e570d'}, d: {accent: '#e3b55a', 'accent-2': '#ecc679', 'accent-fg': '#2a1d04'}},
  ink: {name: '墨黑', sw: '#3f3a34', sd: '#ddd2c2', l: {accent: '#3f3a34', 'accent-2': '#2c2824'}, d: {accent: '#ddd2c2', 'accent-2': '#ebe2d5', 'accent-fg': '#1e1a15'}}
};
const isDark = () => S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
let palStyle;
function applyTheme() {
  const root = document.documentElement, dark = isDark();
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  const p = PALETTES[S.palette] || PALETTES.earth, vars = (dark ? p.d : p.l) || {};
  if (!palStyle) { palStyle = document.createElement('style'); document.head.appendChild(palStyle); }
  palStyle.textContent = ':root:root{' + Object.keys(vars).map(k => '--' + k + ':' + vars[k]).join(';') + '}';
  root.style.setProperty('--ui', (S.scale || 100) / 100);
  const bg = dark ? '#1d1812' : '#efe5d3';
  const m = $('meta[name=theme-color]'); if (m) m.content = bg;
  try { if (IS_APP && NB.setBars) NB.setBars(bg, !dark); } catch (e) {}
}
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

/* ---------- 底部面板、對話框 ---------- */
const sheets = [];
function sheet(o) {
  const w = el(`<div class="shWrap"><div class="shBg"></div><div class="sheet ${o.full ? 'full' : ''}"><div class="shHead"><b class="shTitle"></b><span class="shTools row"></span><button class="ic shX" aria-label="關閉">✕</button></div><div class="shBody"></div>${o.foot ? '<div class="shFoot"></div>' : ''}</div></div>`);
  $('.shTitle', w).textContent = o.title || '';
  const body = $('.shBody', w); if (typeof o.html === 'string') body.innerHTML = o.html; else if (o.html) body.append(o.html);
  if (o.foot) $('.shFoot', w).innerHTML = o.foot;
  const me = {el: w, body, foot: $('.shFoot', w), tools: $('.shTools', w), closed: false,
    title(t) { $('.shTitle', w).textContent = t; },
    close() { if (me.closed) return; me.closed = true; const i = sheets.indexOf(me); if (i >= 0) sheets.splice(i, 1); w.classList.remove('on'); setTimeout(() => w.remove(), 260); if (o.onClose) o.onClose(); }};
  $('.shBg', w).onclick = () => me.close(); $('.shX', w).onclick = () => me.close();
  /* 先讓呼叫的地方把內容放進去、畫好，下一個畫格才開始滑上來，避免滑動時畫面破碎閃爍 */
  document.body.append(w); sheets.push(me); requestAnimationFrame(() => requestAnimationFrame(() => { if (!me.closed) w.classList.add('on'); })); return me;
}
function ask(msg, okLabel, danger) {
  return new Promise(res => { let done = false;
    const w = el(`<div class="shWrap center"><div class="shBg"></div><div class="dlg"><p></p><div class="row"><button class="btn ghost" data-a="0">取消</button><button class="btn ${danger ? 'danger' : 'pri'}" data-a="1"></button></div></div></div>`);
    $('p', w).textContent = msg; $('[data-a="1"]', w).textContent = okLabel || '確定';
    const me = {el: w, closed: false, close(v) { if (done) return; done = true; me.closed = true; const i = sheets.indexOf(me); if (i >= 0) sheets.splice(i, 1); w.classList.remove('on'); setTimeout(() => w.remove(), 220); res(!!v); }};
    $('.shBg', w).onclick = () => me.close(false); $$('button', w).forEach(b => b.onclick = () => me.close(b.dataset.a === '1'));
    document.body.append(w); w.offsetHeight; w.classList.add('on'); sheets.push(me); });
}
function askText(msg, val, ph) {
  return new Promise(res => { let done = false;
    const w = el(`<div class="shWrap center"><div class="shBg"></div><div class="dlg"><p></p><input style="margin-bottom:1rem"><div class="row"><button class="btn ghost" data-a="0">取消</button><button class="btn pri" data-a="1">確定</button></div></div></div>`);
    $('p', w).textContent = msg; const inp = $('input', w); inp.value = val || ''; inp.placeholder = ph || '';
    const me = {el: w, closed: false, close(v) { if (done) return; done = true; me.closed = true; const i = sheets.indexOf(me); if (i >= 0) sheets.splice(i, 1); w.classList.remove('on'); setTimeout(() => w.remove(), 220); res(v); }};
    $('.shBg', w).onclick = () => me.close(null); $$('button', w).forEach(b => b.onclick = () => me.close(b.dataset.a === '1' ? inp.value : null));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) me.close(inp.value); });
    document.body.append(w); w.offsetHeight; w.classList.add('on'); sheets.push(me); setTimeout(() => inp.focus(), 250); });
}
/* Android 返回鍵：先關最上層的面板／圖片，其次回到地圖頁；回傳 false 代表交給系統 */
window.__back = function () {
  if ($('#viewer').classList.contains('on')) { Viewer.close(); return true; }
  if (sheets.length) { sheets[sheets.length - 1].close(); return true; }
  /* 記帳區：返回只在記帳區裡面切換，不會跑到地圖 */
  if (document.body.classList.contains('mAcc')) { if (curTab !== 'Acc') { showTab('Acc'); return true; } return false; }
  if (typeof mapBack === 'function' && mapBack()) return true;
  if (curTab !== 'Map') { showTab('Map'); return true; }
  return false;
};

/* ---------- 拖曳排序：長按（或抓握把）拖動、震動回饋、放置位置提示線、靠邊自動捲動 ---------- */
function sortable(root, o) {
  let st = null;
  const items = () => $$(o.item, root).filter(e => e.offsetParent !== null && (!o.scope || e.closest(o.scope) === st.scope));
  const pt = e => e.touches ? e.touches[0] || e.changedTouches[0] : e;
  function down(e) {
    if (st || (e.button != null && e.button !== 0)) return;
    const it = e.target.closest(o.item); if (!it || !root.contains(it)) return;
    const viaH = o.handle && e.target.closest(o.handle);
    if (o.handle && o.handleOnly && !viaH) return;
    if (o.start && !e.target.closest(o.start)) return;
    if (!viaH && e.target.closest('input,textarea,select')) return;
    const p = pt(e);
    st = {it, x0: p.clientX, y0: p.clientY, x: p.clientX, y: p.clientY, on: false, scope: o.scope ? it.closest(o.scope) : null, gFrom: o.groups ? it.closest(o.groups) : null, touch: !!e.touches};
    /* 一律要按住 0.4 秒才開始拖曳（手指一動就當成捲動），避免滑動畫面時誤拖 */
    st.timer = setTimeout(begin, o.hold || 400); st.hl = setTimeout(() => { if (st && !st.on) st.it.classList.add('holding'); }, 120);
    if (!st.touch) { window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); }
  }
  function begin() {
    if (!st) return; st.on = true; st.it.classList.remove('holding'); buzz(35);
    const r = st.it.getBoundingClientRect(); st.dx = st.x - r.left; st.dy = st.y - r.top;
    const g = st.it.cloneNode(true); g.classList.add('dragGhost'); g.style.width = r.width + 'px'; g.style.height = r.height + 'px'; g.style.left = r.left + 'px'; g.style.top = r.top + 'px';
    document.body.append(g); st.ghost = g; st.it.classList.add('dragSrc');
    st.line = el(`<div class="dropLine ${o.axis === 'x' || o.axis === 'grid' ? 'v' : 'h'}"></div>`); document.body.append(st.line);
    st.list = o.groups ? $$(o.item, st.gFrom).filter(e => e.offsetParent !== null) : items(); st.from = st.list.indexOf(st.it); st.ins = st.from; st.gTo = st.gFrom;
    st.scroller = o.scroller ? (typeof o.scroller === 'string' ? root.closest(o.scroller) : o.scroller) : root;
    document.body.classList.add('noSel'); place(); st.raf = requestAnimationFrame(auto);
  }
  function place() {
    const g = st.ghost, G = o.axis === 'grid'; if (o.axis === 'x' || G) g.style.left = st.x - st.dx + 'px'; if (o.axis !== 'x') g.style.top = st.y - st.dy + 'px';
    if (o.groups) { /* 跨資料夾拖曳：先找出手指目前在哪個資料夾上 */
      const gs = $$(o.groups, root).filter(e => e.offsetParent !== null); let best = st.gTo, bd = 1e9;
      for (const e of gs) { const r = e.getBoundingClientRect(), d = st.y < r.top ? r.top - st.y : st.y > r.bottom ? st.y - r.bottom : 0; if (d < bd) { bd = d; best = e; } }
      if (best !== st.gTo) { st.gTo = best; buzz(10); }
      $$(o.groups, root).forEach(e => e.classList.toggle('dropOn', e === best && best !== st.gFrom));
      st.list = $$(o.item, best).filter(e => e.offsetParent !== null);
      if (!st.list.length) { const r = best.getBoundingClientRect(), ln = st.line.style; st.ins = 0; ln.height = '4px'; ln.width = r.width - 24 + 'px'; ln.left = r.left + 12 + 'px'; ln.top = r.bottom - 10 + 'px'; return; } }
    const L = st.list, X = o.axis === 'x' || G; let ins = 0;
    for (const e of L) { const r = e.getBoundingClientRect(); if (G ? (st.y > r.bottom || (st.y >= r.top && st.x > r.left + r.width / 2)) : (X ? st.x : st.y) > (X ? r.left + r.width / 2 : r.top + r.height / 2)) ins++; }
    if (ins !== st.ins) { st.ins = ins; buzz(8); }
    const ref = L[Math.min(ins, L.length - 1)].getBoundingClientRect(), after = ins >= L.length;
    let gap = 8; if (L.length > 1) { const a = L[0].getBoundingClientRect(), b = L[1].getBoundingClientRect(); gap = Math.max(4, X ? b.left - a.right : b.top - a.bottom); }
    const ln = st.line.style;
    if (X) { ln.width = '4px'; ln.height = ref.height + 'px'; ln.top = ref.top + 'px'; ln.left = (after ? ref.right + gap / 2 : ref.left - gap / 2) - 2 + 'px'; }
    else { ln.height = '4px'; ln.width = ref.width + 'px'; ln.left = ref.left + 'px'; ln.top = (after ? ref.bottom + gap / 2 : ref.top - gap / 2) - 2 + 'px'; }
  }
  function auto() {
    if (!st || !st.on) return; const sc = st.scroller, r = sc.getBoundingClientRect(), X = o.axis === 'x', p = X ? st.x : st.y, a = X ? r.left : r.top, b = X ? r.right : r.bottom, edge = 56;
    let v = 0; if (p < a + edge) v = -Math.ceil((a + edge - p) / 5); else if (p > b - edge) v = Math.ceil((p - (b - edge)) / 5);
    if (v) { if (X) sc.scrollLeft += v; else sc.scrollTop += v; place(); }
    st.raf = requestAnimationFrame(auto);
  }
  function move(e) {
    if (!st) return; const p = pt(e); st.x = p.clientX; st.y = p.clientY;
    if (!st.on) { if (Math.hypot(st.x - st.x0, st.y - st.y0) > 9) cancel(); return; }
    if (e.cancelable) e.preventDefault(); place();
  }
  function cancel() { if (!st) return; clearTimeout(st.timer); clearTimeout(st.hl); st.it.classList.remove('holding'); cancelAnimationFrame(st.raf); if (st.ghost) st.ghost.remove(); if (st.line) st.line.remove(); st.it.classList.remove('dragSrc'); document.body.classList.remove('noSel'); if (o.groups) $$(o.groups, root).forEach(e => e.classList.remove('dropOn'));
    window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); st = null; }
  function up() {
    if (!st) return; const was = st.on, from = st.from, ins = st.ins, scope = st.scope, gFrom = st.gFrom, gTo = st.gTo; cancel();
    if (!was) return; swallow = Date.now();
    if (o.groups) { const same = gTo === gFrom, t = same ? (ins > from ? ins - 1 : ins) : ins; if (!same || t !== from) { buzz(20); o.onSort(from, t, gFrom, gTo); } return; }
    const to = ins > from ? ins - 1 : ins; if (to !== from) { buzz(20); o.onSort(from, to, scope); }
  }
  let swallow = 0;
  root.addEventListener('touchstart', down, {passive: false}); root.addEventListener('touchmove', move, {passive: false});
  root.addEventListener('touchend', up); root.addEventListener('touchcancel', up); root.addEventListener('mousedown', down);
  root.addEventListener('click', e => { if (Date.now() - swallow < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  root.addEventListener('contextmenu', e => { if (e.target.closest(o.item)) e.preventDefault(); });
}
const moveItem = (arr, from, to) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr; };

/* ---------- 圖片：縮小後存入資料庫 ---------- */
const imgCache = new Map();
async function imgURL(id) { if (!id) return ''; if (imgCache.has(id)) return imgCache.get(id); const r = await IDB.get('imgs', id).catch(() => null); if (!r) return '';
  const u = URL.createObjectURL(new Blob([r.buf], {type: r.type || 'image/jpeg'})); imgCache.set(id, u); return u; }
async function imgBlob(id) { const r = await IDB.get('imgs', id); return r ? new Blob([r.buf], {type: r.type || 'image/jpeg'}) : null; }
async function imgDel(id) { if (!id) return; const u = imgCache.get(id); if (u) { URL.revokeObjectURL(u); imgCache.delete(id); } await IDB.del('imgs', id).catch(() => {}); }
function loadImage(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('無法讀取圖片')); }; im.src = u; }); }
async function imgStore(file, max) {
  max = max || 2400; const im = await loadImage(file); let w = im.naturalWidth, h = im.naturalHeight; const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .88)); const id = 'i' + uid();
  await IDB.put('imgs', id, {buf: await blob.arrayBuffer(), type: 'image/jpeg', w, h}); return id;
}
function pickImages(multi) { return new Promise(res => { const f = $('#filePick'); f.multiple = !!multi; f.value = ''; let done = false;
  f.onchange = () => { done = true; res([...f.files]); }; f.oncancel = () => { if (!done) res([]); }; f.click(); }); }
const blobB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

/* ---------- 圖片檢視（雙指縮放、左右滑動切換；items = [{id, label}]，第一張是最新版本） ---------- */
const Viewer = {items: [], i: 0, z: 1, title: '',
  async open(items, i, title) { items = items.map(x => typeof x === 'string' ? {id: x, label: ''} : x); if (!items.length) return; Viewer.items = items; Viewer.i = i || 0; Viewer.title = title || ''; $('#viewer').classList.add('on'); await Viewer.show(); },
  async show() { const im = $('#vImg'), it = Viewer.items[Viewer.i]; im.src = await imgURL(it.id); Viewer.zoom(1, true);
    $('#vT').innerHTML = esc(Viewer.title) + (it.label ? `<small style="display:block;font-weight:400;opacity:.8">${esc(it.label)}</small>` : ''); $('#vN').textContent = (Viewer.i + 1) + ' / ' + Viewer.items.length;
    $('#vPrev').disabled = Viewer.i <= 0; $('#vNext').disabled = Viewer.i >= Viewer.items.length - 1; },
  zoom(z, abs) { const sc = $('#vScroll'), im = $('#vImg'); const old = Viewer.z; Viewer.z = Math.max(1, Math.min(8, abs ? z : Viewer.z * z));
    const cx = (sc.scrollLeft + sc.clientWidth / 2) / (sc.scrollWidth || 1), cy = (sc.scrollTop + sc.clientHeight / 2) / (sc.scrollHeight || 1);
    const fit = () => { const nw = im.naturalWidth || 1, nh = im.naturalHeight || 1, k = Math.min(sc.clientWidth / nw, sc.clientHeight / nh); im.style.width = nw * k * Viewer.z + 'px'; im.style.height = nh * k * Viewer.z + 'px';
      if (old !== Viewer.z) { sc.scrollLeft = cx * sc.scrollWidth - sc.clientWidth / 2; sc.scrollTop = cy * sc.scrollHeight - sc.clientHeight / 2; } };
    if (im.complete && im.naturalWidth) fit(); else im.onload = fit; },
  step(d) { const n = Viewer.i + d; if (n < 0 || n >= Viewer.items.length) { buzz(30); return; } buzz(10); Viewer.i = n; Viewer.show(); },
  close() { $('#viewer').classList.remove('on'); $('#vImg').removeAttribute('src'); }
};
function initViewer() {
  $('#vX').onclick = Viewer.close; $('#vPrev').onclick = () => Viewer.step(-1); $('#vNext').onclick = () => Viewer.step(1);
  $('#vZi').onclick = () => Viewer.zoom(1.5); $('#vZo').onclick = () => Viewer.zoom(1 / 1.5);
  const sc = $('#vScroll'); let d0 = 0, z0 = 1, lastTap = 0, sx = 0, sy = 0, multi = false;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  sc.addEventListener('touchstart', e => { if (e.touches.length === 2) { d0 = dist(e.touches); z0 = Viewer.z; multi = true; } else if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; multi = false; } }, {passive: true});
  sc.addEventListener('touchmove', e => { if (e.touches.length === 2 && d0) { e.preventDefault(); Viewer.zoom(z0 * dist(e.touches) / d0, true); } }, {passive: false});
  sc.addEventListener('touchend', e => { if (e.touches.length < 2) d0 = 0; if (e.touches.length) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    /* 沒放大時左右滑動換張：往左滑＝下一張（較舊），往右滑＝上一張（較新） */
    if (!multi && Viewer.z <= 1.05 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) { Viewer.step(dx < 0 ? 1 : -1); lastTap = 0; return; }
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { const n = Date.now(); if (n - lastTap < 300) Viewer.zoom(Viewer.z > 1.2 ? 1 : 2.5, true); lastTap = n; } });
  if (!('ontouchstart' in window)) sc.addEventListener('dblclick', () => Viewer.zoom(Viewer.z > 1.2 ? 1 : 2.5, true));
  sc.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); Viewer.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); } }, {passive: false});
  document.addEventListener('keydown', e => { if (!$('#viewer').classList.contains('on')) return; if (e.key === 'ArrowRight') Viewer.step(1); else if (e.key === 'ArrowLeft') Viewer.step(-1); else if (e.key === 'Escape') Viewer.close(); });
}
