/* ============================================================
   記帳區（獨立功能區，底部四個分頁：記帳／資產／分析／設定）
   DB.acc = {v:2, recs, settles, cats:{out:[母分類{id,n,i,subs:[{id,n,i,opt}]}], in:[…]}, accts:[{id,n,i,kind,bal0,payDay,payFrom}],
             payees:[{id,n,cat}], tpls:[範本], me, autopay:{卡id:'YYYY-MM'}}
   rec = {id, d, t, type:'out'|'in'|'tr', amt, cat(子分類或母分類 id), acct, to, fee, note, payee, payer, split:[{p,amt}], items, imgs, src, settled:{人:結清id}}
   欠款：付錢的是我 → 分到的人欠我；付錢的是別人 → 我分到的部分我欠他
   ============================================================ */
const ACC_OUT2 = [['吃喝', '🍽️', [['早餐', '🍳'], ['午餐', '🍱'], ['晚餐', '🍲'], ['宵夜', '🌙'], ['飲料', '🧋', 1], ['點心', '🍰', 1], ['食材生鮮', '🥕']]],
  ['購物', '🛍️', [['日用品', '🧻'], ['衣服鞋子', '👕', 1], ['3C 電子', '📱', 1], ['家具家電', '🛋️'], ['美妝保養', '💄', 1]]],
  ['交通', '🚌', [['加油', '⛽'], ['停車費', '🅿️'], ['大眾運輸', '🚇'], ['計程車', '🚕', 1], ['高鐵火車', '🚄'], ['保養維修', '🔧']]],
  ['生活', '🏠', [['房租', '🏠'], ['水費', '💧'], ['電費', '💡'], ['瓦斯費', '🔥'], ['電話網路', '📶'], ['管理費', '🏢']]],
  ['娛樂', '🎬', [['電影', '🎬', 1], ['遊戲', '🎮', 1], ['訂閱服務', '📺', 1], ['運動健身', '🏃']]],
  ['旅行', '✈️', [['住宿', '🏨', 1], ['門票', '🎫', 1], ['伴手禮', '🎁', 1], ['機票車票', '🎟️']]],
  ['學習', '📚', [['書籍', '📖'], ['課程', '🎓'], ['文具', '✏️']]],
  ['醫療', '💊', [['看診', '🩺'], ['藥品', '💊'], ['保健食品', '🫚']]],
  ['投資', '📈', [['股票', '📈'], ['基金', '💹'], ['保險', '🛡️']]],
  ['人情', '🎁', [['禮物', '🎁', 1], ['紅包', '🧧'], ['請客', '🍻', 1]]],
  ['其他', '📦', [['其他', '📦']]]];
const ACC_IN2 = [['工作', '💼', [['薪水', '💰'], ['獎金', '🎉'], ['加班費', '⏰'], ['兼職', '🧑‍💻']]], ['投資', '📈', [['利息', '🏦'], ['股利', '💹'], ['投資收益', '📈']]],
  ['其他', '💵', [['退款', '🔁'], ['紅包', '🧧'], ['收回欠款', '↩️'], ['二手拍賣', '🏷️'], ['其他收入', '💵']]]];
const AK = {cash: ['現金', '💵'], bank: ['銀行', '🏦'], card: ['信用卡', '💳'], stored: ['儲值', '🎫'], pay: ['行動支付', '📲']};
/* 常見的銀行、行動支付、儲值帳戶（圖示用官網的網站圖示，沒有網路時顯示表情符號） */
/* 資產區的圖示：自己畫的銀行／支付簡稱徽章（品牌色＋簡稱），和記帳區的美食、生活圖示分開 */
const ACCT_PRESET = {   /* [名稱, 簡稱, 底色, 第二色（下緣色條）, 字色] */
  bank: [['玉山銀行', '玉山', '#009a77'], ['國泰世華', '國泰', '#00a04a'], ['中國信託', '中信', '#008c7e', '#e60012'], ['台新銀行', '台新', '#e8380d'], ['富邦銀行', '富邦', '#0067b1', '#00a8b5'], ['永豐銀行', '永豐', '#d6001c'], ['兆豐銀行', '兆豐', '#c8102e', '#f39800'], ['第一銀行', '一銀', '#0b6db7', '#22a84a'], ['華南銀行', '華南', '#d7000f'], ['彰化銀行', '彰銀', '#e4002b'], ['合作金庫', '合庫', '#0060a9', '#3aaa35'], ['土地銀行', '土銀', '#00954c'], ['臺灣銀行', '臺銀', '#004b8d', '#c9a227'], ['上海商銀', '上海', '#a6192e'], ['中華郵政', '郵局', '#00924a', '#e60012'], ['元大銀行', '元大', '#003f87', '#e60012'], ['聯邦銀行', '聯邦', '#d6000f'], ['遠東商銀', '遠銀', '#c8102e'], ['新光銀行', '新光', '#e60012'], ['凱基銀行', '凱基', '#00305e', '#c8a24a'], ['星展銀行', '星展', '#e3001b'], ['渣打銀行', '渣打', '#0473ea', '#38d200'], ['匯豐銀行', '匯豐', '#db0011'], ['台中銀行', '中銀', '#d6001c'], ['臺灣企銀', '企銀', '#00529b'], ['王道銀行', '王道', '#1b1f4a', '#ffb81c'], ['將來銀行', '將來', '#2a2f8f'], ['LINE Bank', 'LINE', '#06c755'], ['樂天銀行', '樂天', '#bf0000'], ['陽信銀行', '陽信', '#f18d00'], ['京城銀行', '京城', '#004a98'], ['安泰銀行', '安泰', '#c8102e'], ['板信銀行', '板信', '#0068b7'], ['高雄銀行', '高銀', '#0087cf'], ['三信銀行', '三信', '#1f7a3a'], ['華泰銀行', '華泰', '#00449e'], ['瑞興銀行', '瑞興', '#8c1d2c'], ['農會', '農會', '#3f8f2f']],
  card: [['國泰世華信用卡', '國泰', '#00a04a'], ['中信信用卡', '中信', '#008c7e', '#e60012'], ['台新信用卡', '台新', '#e8380d'], ['玉山信用卡', '玉山', '#009a77'], ['富邦信用卡', '富邦', '#0067b1', '#00a8b5'], ['永豐信用卡', '永豐', '#d6001c'], ['聯邦信用卡', '聯邦', '#d6000f'], ['匯豐信用卡', '匯豐', '#db0011'], ['兆豐信用卡', '兆豐', '#c8102e', '#f39800'], ['第一信用卡', '一銀', '#0b6db7', '#22a84a'], ['星展信用卡', '星展', '#e3001b'], ['遠東信用卡', '遠銀', '#c8102e'], ['樂天信用卡', '樂天', '#bf0000'], ['將來信用卡', '將來', '#2a2f8f'], ['華南信用卡', '華南', '#d7000f'], ['元大信用卡', '元大', '#003f87', '#e60012'], ['凱基信用卡', '凱基', '#00305e', '#c8a24a'], ['新光信用卡', '新光', '#e60012']],
  pay: [['LINE Pay', 'LINE', '#06c755'], ['街口支付', '街口', '#e3002c'], ['全支付', '全支', '#ff5a00'], ['Apple Pay', 'Pay', '#000000'], ['Google Pay', 'G', '#ffffff', '#4285f4', '#4285f4'], ['Samsung Pay', 'S', '#1428a0'], ['悠遊付', '悠遊付', '#00a0e9', '#8dc21f'], ['icash Pay', 'icash', '#e5006e'], ['台灣 Pay', 'TW', '#0059a8', '#e60012'], ['Pi 拍錢包', 'Pi', '#00a7e1'], ['歐付寶', '歐付', '#00a650'], ['OPEN 錢包', 'OPEN', '#f39800', '#00a651'], ['全盈+PAY', '全盈', '#ffd400', '', '#1f1f1f'], ['橘子支付', '橘子', '#ff7f00'], ['中油 Pay', '中油', '#0062b0', '#00a650'], ['萬家福 Pay', '萬家福', '#e60012', '#0057a8'], ['Hami Pay', 'Hami', '#00a0e9'], ['PayPal', 'PP', '#003087', '#009cde']],
  stored: [['悠遊卡', '悠遊', '#00a0e9', '#8dc21f'], ['一卡通', '一卡通', '#e4007f'], ['icash', 'icash', '#e5006e'], ['POYA Pay', 'POYA', '#e6007e'], ['星巴克隨行卡', '星巴克', '#00704a'], ['My FamiPay', 'Fami', '#0068b7', '#00a73c'], ['有錢卡', '有錢', '#ffcc00', '', '#3a2a00'], ['麥當勞點點卡', 'M', '#da291c', '', '#ffc72c'], ['家樂福錢包', '家樂福', '#004e9e', '#e2001a'], ['高鐵 TGo', 'TGo', '#ff7a00'], ['屈臣氏', '屈臣氏', '#00a0a8'], ['康是美', '康是美', '#e5004f'], ['路易莎', '路易莎', '#1d3b6e'], ['85度C', '85°C', '#8a1538']],
  cash: [['錢包', '💵'], ['零錢罐', '🪙'], ['外幣現金', '💱'], ['紅包袋', '🧧']]};
const mono = (t, c, c2, fg) => `m:${t}:${c}${c2 || fg ? ':' + (c2 || '') + ':' + (fg || '') : ''}`;
const lightBg = c => { const n = parseInt(String(c).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r * .299 + g * .587 + b * .114 > 170; };
const monoHtml = s2 => { const [, t, c, c2, fg] = String(s2).split(':'); return `<span class="aMono ${[...t].length > 2 ? 'sm' : ''} ${!fg && lightBg(c) ? 'dk' : ''} ${c2 ? 'two' : ''} ${lightBg(c) ? 'lt' : ''}" style="--m:${c};${c2 ? '--m2:' + c2 + ';' : ''}${fg ? 'color:' + fg : ''}">${esc(t)}</span>`; };
const icoHtml = e => { e = String(e || ''); return e.startsWith('m:') ? monoHtml(e) : e.startsWith('img:') ? `<img class="aLogo own" src="${e.slice(4)}" alt="">` : esc(e); };
const logoURL = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const aIco = a => !a ? '' : /^(m|img):/.test(String(a.i || '')) ? icoHtml(a.i) : a.logo ? `<img class="aLogo" src="${logoURL(a.logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${AK[a.kind] ? AK[a.kind][1] : '🏦'}'))">` : esc(a.i || '');
const ICONS = {'常用': '🍳🍱🍲🍜🍣🍔🍕🥗🧋☕🍰🍪🥕🧻🛍️👕📱💄🚌⛽🅿️🚕🚄🏠💧💡🔥📶🎬🎮📺🏃🏨🎫🎁✈️📚🎓✏️💊🩺📈🛡️🧧🍻📦💰🎉',
  '餐飲': '🍳🥐🥞🍞🥪🌮🍱🍙🍛🍜🍝🍲🍣🍤🍔🍟🍕🌭🥗🥘🍗🍖🥩🥟🦞🍦🍰🧁🍩🍪🍫🍬🍡🍧🍉🍎🍌🍇🥕🥦🧄🥚🥛🧋☕🍵🧃🥤🍺🍷🍶',
  '購物': '🛍️🛒👕👖👗👟👜👓💍💄🧴🧼🧻🧽🪥🧺📱💻🖥️⌨️🎧📷🔌🔋🛋️🛏️🪑🧸🪴🎁📦🏷️',
  '交通': '🚌🚇🚆🚄🚕🚗🏍️🛵🚲🛴✈️🚢⛽🅿️🔧🛞🎫🛣️',
  '生活': '🏠🏢🏡💧💡🔥📶📞📺🧹🧺🐶🐱🐾👶💇💅🧖🏥💊🩺🦷👓',
  '娛樂': '🎬🎮🎤🎵🎸🎨📚📖🎓✏️🏃⚽🏀🏸🏊🧘🎳🎢🏕️🏖️🎪🃏',
  '收入': '💰💵🎉🎁🧧↩️🔁📈💹🏆💼⏰🧑‍💻🏷️',
  '其他': '⭐❤️✨🌙☀️🌈🍀🌸🎯📌📍🔖📝📎🔑🎈🎀⚙️🧩❓'};
const ICONS_FIN = {'帳戶': '💵🪙💴💶💷💱🏦🏧💳🎫📲👛💰🧧🐷📈📉💹🧾💸🔐🏠🚗'};
function iconPick(cur, lib) {
  return new Promise(res => { let done = false, monoC = '#5a7a44'; const fin = lib === 'fin', rk = fin ? 'iconsF' : 'icons', rec = (DB.acc[rk] || []).slice(0, 16), sh = sheet({title: fin ? '選擇帳戶圖示' : '選擇圖示', full: true, onClose() { if (!done) res(null); }});
    const seg = v => [...new Set(Array.from(new Intl.Segmenter().segment(v), x => x.segment))];
    const curH = cur ? icoHtml(cur) : '？';
    const monos = fin ? Object.entries({bank: '銀行', card: '信用卡', pay: '行動支付', stored: '儲值'}).map(([k, n]) => `<div class="lbl">${n}</div><div class="icG mono">${ACCT_PRESET[k].map(([nm, t, c, c2, fg]) => `<button data-e="${esc(mono(t, c, c2, fg))}" title="${esc(nm)}">${monoHtml(mono(t, c, c2, fg))}</button>`).join('')}</div>`).join('') : '';
    sh.body.innerHTML = `<div class="icCur"><span>${curH}</span><input id="icIn" placeholder="${fin ? '輸入簡稱做成徽章（例如 合庫）或貼表情符號' : '或輸入／貼上任何表情符號'}" maxlength="8"><button class="btn sm pri" data-a="use">使用</button></div>
      ${fin ? '<button class="btn block" data-a="img" style="margin-bottom:.6rem">🖼️ 用自己的圖片（例如銀行 App 的截圖）</button>' : ''}${fin ? `<div class="icColors">${['#0f8f74', '#2e8b3d', '#d7282f', '#1a5fa8', '#0067b1', '#c8102e', '#f39800', '#7a1f2b', '#5a7a44', '#1d1d1f', '#00a0e9', '#e4007f'].map(c => `<button data-c="${c}" style="background:${c}" class="${c === monoC ? 'on' : ''}"></button>`).join('')}</div>` : ''}
      ${rec.length ? `<div class="lbl icRecL">最近用過<span class="muted small">（長按可刪除）</span></div><div class="icG icRec ${fin ? 'mono' : ''}">${rec.map(e => `<button data-e="${esc(e)}" data-rc="1">${icoHtml(e)}</button>`).join('')}</div>` : ''}
      ${monos}${Object.entries(fin ? ICONS_FIN : ICONS).map(([k, v]) => `<div class="lbl">${k}</div><div class="icG">${seg(v).map(e => `<button data-e="${e}" class="${e === cur ? 'on' : ''}">${e}</button>`).join('')}</div>`).join('')}`;
    const finish = e => { if (!e) return; DB.acc[rk] = [e].concat((DB.acc[rk] || []).filter(x => x !== e)).slice(0, 24); saveAcc(); done = true; sh.close(); res(e); };
    /* 長按「最近用過」的圖示可以刪掉（自己上傳的圖片也一樣） */
    let lpT = null, lpDone = false;
    sh.body.addEventListener('pointerdown', e => { const t = e.target.closest('[data-rc]'); if (!t) return; lpDone = false; t.classList.add('holding');
      lpT = setTimeout(async () => { lpT = null; lpDone = true; t.classList.remove('holding'); buzz(35);
        if (!await ask('從「最近用過」刪除這個圖示？\n（已經在用這個圖示的帳戶或分類不會改變）', '刪除', true)) return;
        const v = t.dataset.e; DB.acc[rk] = (DB.acc[rk] || []).filter(x => x !== v); saveAcc(); const g = t.parentElement; t.remove(); buzz(20);
        if (!g.children.length) { g.previousElementSibling && g.previousElementSibling.remove(); g.remove(); } toast('已刪除'); }, 550); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => sh.body.addEventListener(ev, () => { if (lpT) { clearTimeout(lpT); lpT = null; } $$('[data-rc].holding', sh.body).forEach(b => b.classList.remove('holding')); }));
    sh.body.addEventListener('scroll', () => { if (lpT) { clearTimeout(lpT); lpT = null; } }, {passive: true});
    sh.body.addEventListener('contextmenu', e => { if (e.target.closest('[data-rc]')) e.preventDefault(); });
    sh.body.onclick = e => { const t = e.target.closest('button'); if (!t) return; if (lpDone) { lpDone = false; return; } buzz(8);
      if (t.dataset.c) { monoC = t.dataset.c; $$('[data-c]', sh.body).forEach(b => b.classList.toggle('on', b === t)); return; }
      if (t.dataset.a === 'img') { (async () => { const fs = await pickImages(false); if (!fs.length) return; const u = URL.createObjectURL(fs[0]), im = new Image(); im.onload = () => { const c = document.createElement('canvas'), n = 96, sc = Math.max(n / im.width, n / im.height); c.width = c.height = n; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); g.drawImage(im, (n - im.width * sc) / 2, (n - im.height * sc) / 2, im.width * sc, im.height * sc); URL.revokeObjectURL(u); finish('img:' + c.toDataURL('image/jpeg', .85)); }; im.src = u; })(); return; }
      if (t.dataset.e) finish(t.dataset.e);
      else if (t.dataset.a === 'use') { const v = $('#icIn', sh.body).value.trim(); if (!v) return; const first = Array.from(new Intl.Segmenter().segment(v), x => x.segment)[0];
        finish(fin && !/\p{Extended_Pictographic}/u.test(first) ? mono(v.slice(0, 4), monoC) : first); } }; });
}
/* 名稱和圖示分開設定（類別、帳戶共用） */
function nameIcon(title, o, opts = {}) {
  return new Promise(res => { let done = false, ic = o.i || opts.icon || '📁'; const sh = sheet({title, onClose() { if (!done) res(null); }, foot: `${opts.del ? '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>' : ''}<button class="btn pri" data-a="ok">儲存</button>`});
    sh.body.innerHTML = `<div class="niRow"><button class="niIc" data-a="ic">${icoHtml(ic)}<small>換圖示</small></button><div class="field grow" style="margin:0"><label>名稱</label><input id="niN" value="${esc(o.n || '')}" placeholder="${esc(opts.ph || '')}"></div></div>${opts.extra || ''}`;
    sh.body.onclick = async e => { const t = e.target.closest('[data-a="ic"]'); if (!t) return; buzz(8); const v = await iconPick(ic, opts.lib); if (v) { ic = v; t.innerHTML = icoHtml(v) + '<small>換圖示</small>'; } };
    sh.foot.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); if (b.dataset.a === 'del') { done = true; sh.close(); res({del: true}); return; }
      const n = $('#niN', sh.body).value.trim(); if (!n) { toast('請輸入名稱'); return; } const extra = opts.read ? opts.read(sh.body) : {}; done = true; sh.close(); res(Object.assign({n: n.slice(0, 14), i: ic}, extra)); };
    setTimeout(() => { const i = $('#niN', sh.body); if (i && !o.n) i.focus(); }, 250); });
}
const Acc = {ym: null, day: null, sym: null, statOpen: ''};
const saveAcc = debounce(() => { IDB.put('kv', 'acc', DB.acc).catch(saveErr); accWidgetPush(); }, 200);
/* 桌面小工具、通知欄：把本月支出、收入、今天支出交給 App 顯示 */
function accWidgetPush() {
  if (!(IS_APP && NB.widgetData) || !DB.acc) return;
  try { const now = new Date(), ym = ymd(now).slice(0, 7), td = ymd(now); let o = 0, i = 0, t = 0;
    DB.acc.recs.forEach(r => { if (!r.d || r.d.slice(0, 7) !== ym) return; const v = accMine(r);
      if (r.type === 'out' || r.type === 'loss') { o += v; if (r.d === td) t += v; } else if (r.type === 'in') i += v; });
    const show = !(S.wHide), f = v => show ? money(Math.round(v)) : '$ ••••';
    NB.widgetData(JSON.stringify({m: (now.getMonth() + 1) + '月', out: f(o), inc: f(i), today: f(t), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a0562f'}));
  } catch (e) { console.log('widget', e); }
}
/* 從小工具、通知欄、控制中心打開：直接進記帳區開始記一筆 */
const Quick = {check() { if (!(IS_APP && NB.quickTake)) return; const a = NB.quickTake(); if (!a) return;
  while (sheets.length) sheets[sheets.length - 1].close();
  if (!S.inAcc) enterAcc('Acc'); else showTab('Acc'); buzz(15);
  setTimeout(() => { if (a === 'in') accEdit(null, {type: 'in'}); else if (a === 'tr') accEdit(null, {type: 'tr'}); else if (a === 'tpl') tplList(); else if (a === 'out') accEdit(null); }, 250); }};
const mkCats = L => L.map(([n, i, subs], k) => ({id: 'p' + k + uid(), n, i, subs: subs.map(([sn, si, opt], j) => Object.assign({id: 'c' + k + j + uid(), n: sn, i: si}, opt ? {opt: 1} : {}))}));
async function loadAcc() {
  const v = await IDB.get('kv', 'acc').catch(() => null);
  DB.acc = Object.assign({v: 2, recs: [], settles: [], cats: {out: mkCats(ACC_OUT2), in: mkCats(ACC_IN2)}, accts: [{id: 'a0' + uid(), n: '現金', i: '💵', kind: 'cash', bal0: 0}], payees: [], tpls: [], me: '', autopay: {}}, v || {});
  const A = DB.acc; ['payees', 'tpls', 'settles', 'recs'].forEach(k => { A[k] = A[k] || []; }); A.autopay = A.autopay || {};
  /* 記帳的「分帳的人」自己一份名單，和日常點餐分開（第一次用時從點餐名單複製，id 不變，舊紀錄照樣對得上） */
  if (!Array.isArray(A.people)) A.people = ((DB.mcfg && DB.mcfg.people) || []).map(u => ({id: u.id, name: u.name, icon: u.icon}));
  /* 預設徽章換成新的顏色（自己改過的不動） */
  A.accts.forEach(a => { if (!String(a.i).startsWith('m:')) return; const t = String(a.i).split(':')[1], P = Object.values(ACCT_PRESET).flat().find(x => x[0] === a.n && x[1] === t && x[2]); if (P) a.i = mono(P[1], P[2], P[3], P[4]); });
  if (v && v.v !== 2) {   /* v1 → v2：平的類別放進母分類；帳戶加上種類 */
    ['out', 'in'].forEach(ty => { const old = (v.cats || {})[ty] || [], base = mkCats(ty === 'out' ? ACC_OUT2 : ACC_IN2);
      old.forEach(c => { let hit = null; base.forEach(P => P.subs.forEach(s => { if (s.n === c.n) hit = s; })); if (hit) hit.id = c.id; else { const P = base.find(x => x.n === c.n) || base[base.length - 1]; P.subs.push({id: c.id, n: c.n, i: c.i}); } });
      A.cats[ty] = base; });
    A.accts = (v.accts || []).map(a => Object.assign({kind: /信用卡|卡/.test(a.n) ? 'card' : /銀行|郵局/.test(a.n) ? 'bank' : /支付|pay/i.test(a.n) ? 'pay' : 'cash', bal0: 0}, a));
    if (!A.accts.length) A.accts = [{id: 'a0' + uid(), n: '現金', i: '💵', kind: 'cash', bal0: 0}];
    A.recs.forEach(r => { if (r.tags && r.tags.length && !r.payee) r.payee = r.tags[0]; }); A.v = 2; saveAcc(); }
}
const accPeople = () => DB.acc.people || (DB.acc.people = []);
const aWho = id => accPeople().find(u => u.id === id) || ((DB.mcfg && DB.mcfg.people) || []).find(u => u.id === id) || {id, name: '（已刪除）', icon: '👤'};
const accMe = () => { const P = accPeople(); if (DB.acc.me && P.some(u => u.id === DB.acc.me)) return DB.acc.me; const u = P.find(x => x.name === '我') || P[0]; return u ? u.id : 'me'; };
/* 找類別：回傳 {p: 母分類, s: 子分類} */
function catFind(type, id) { const L = DB.acc.cats[type === 'in' ? 'in' : 'out'] || []; for (const p of L) { if (p.id === id) return {p, s: null}; const s = (p.subs || []).find(x => x.id === id); if (s) return {p, s}; } return {p: null, s: null}; }
const accCat = r => { if (r.type === 'loss') return {n: '金額遺失', i: '💸'}; if (r.type === 'tr') return {n: r.from === '' && r.settle ? '收回欠款' : '轉帳', i: '🔄'}; const f = catFind(r.type, r.cat); return f.s ? {n: f.s.n, i: f.s.i || f.p.i, pn: f.p.n} : f.p ? {n: f.p.n, i: f.p.i, pn: f.p.n} : {n: r.type === 'in' ? '收入' : '支出', i: r.type === 'in' ? '💵' : '📦', pn: '其他'}; };
const accAcct = id => DB.acc.accts.find(a => a.id === id);
const acctName = id => { const a = accAcct(id); return a ? (/^(m|img):/.test(String(a.i)) || a.logo ? (AK[a.kind] || ['', '🏦'])[1] : a.i) + ' ' + a.n : ''; };
/* 行動支付本身沒有餘額，實際扣款的是它綁定的銀行／信用卡／儲值帳戶（每筆也可以另外指定） */
const realAcct = (id, fund) => { const a = accAcct(id); if (a && a.kind === 'pay') return fund || a.fund || ''; return id; };
const firstCat = ty => { const p = DB.acc.cats[ty][0]; return p ? ((p.subs || [])[0] || p).id : ''; };
const r2 = n => Math.round(n * 100) / 100;
function accOwe(r, p) {
  if (r.type !== 'out' || !(r.split || []).length) return 0; const me = accMe(), payer = r.payer || me, sh = id => (r.split.find(s => s.p === id) || {}).amt || 0;
  if (payer === me && p !== me) return sh(p); if (payer === p) return -sh(me); return 0;
}
function accDebts() { const per = {}; (DB.acc ? DB.acc.recs : []).forEach(r => (r.split || []).map(s => s.p).concat(r.payer ? [r.payer] : []).forEach(p => { if (p === accMe() || (r.settled || {})[p]) return; const o = accOwe(r, p); if (o) per[p] = r2((per[p] || 0) + o); })); Object.keys(per).forEach(p => { if (Math.abs(per[p]) < 0.01) delete per[p]; }); return per; }
const accSign = r => r.type === 'in' ? 1 : r.type === 'out' ? -1 : 0;
const accMine = r => r.type === 'in' ? +r.amt || 0 : r.type !== 'out' ? 0 : (r.split || []).length ? ((r.split.find(s => s.p === accMe()) || {}).amt || 0) : +r.amt || 0;
const recSort = (a, b) => (b.d + (b.t || '')).localeCompare(a.d + (a.t || ''));

/* ---------- 進出記帳區 ---------- */
function enterAcc(tab) { S.inAcc = true; saveS(); document.body.classList.add('mAcc'); showTab(tab || 'Acc'); }
function leaveAcc() { S.inAcc = false; saveS(); document.body.classList.remove('mAcc'); showTab('Set'); toast('已回到日日帳本'); }

/* ---------- 帳戶餘額 ---------- */
function acctFlow(r, id) {   /* 這筆紀錄讓帳戶 id 增減多少 */
  const me = accMe(); let v = 0;
  const A = realAcct(r.acct, r.fund), T = realAcct(r.to, r.fund2);
  if (r.type === 'out' && A === id && (r.payer || me) === me) v -= +r.amt || 0;
  if (r.type === 'in' && A === id) v += +r.amt || 0;
  if (r.type === 'loss' && A === id) v -= +r.amt || 0;
  if (r.type === 'tr') { if (A === id) v -= (+r.amt || 0) + (+r.fee || 0); if (T === id) v += +r.amt || 0; }
  return v;
}
const acctBal = (a, upto) => r2((+a.bal0 || 0) + DB.acc.recs.reduce((s, r) => s + (!upto || r.d <= upto ? acctFlow(r, a.id) : 0), 0));
/* 信用卡自動還款：每月到了還款日，從指定的銀行帳戶把上個月底的欠款轉過去 */
function accAutoPay() {
  const now = new Date(), key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; let n = 0;
  DB.acc.accts.filter(a => a.kind === 'card' && +a.payDay && a.payFrom && accAcct(a.payFrom)).forEach(a => {
    if (now.getDate() < +a.payDay || DB.acc.autopay[a.id] === key) return; DB.acc.autopay[a.id] = key;
    const last = ymd(new Date(now.getFullYear(), now.getMonth(), 0)), owe = -acctBal(a, last) - DB.acc.recs.filter(r => r.type === 'tr' && r.to === a.id && r.d > last).reduce((s, r) => s + (+r.amt || 0), 0);
    if (owe > 0.5) { DB.acc.recs.push({id: 'r' + uid(), d: `${key}-${String(Math.min(+a.payDay, 28)).padStart(2, '0')}`, t: '09:00', type: 'tr', amt: r2(owe), acct: a.payFrom, to: a.id, fee: 0, note: a.n + ' 自動還款', auto: 1}); n++; } });
  if (n) { saveAcc(); toast(`💳 已自動記下 ${n} 筆信用卡還款`, 3500); }
}

/* ---------- ① 記帳（月曆） ---------- */
function renderAcc() {
  const box = $('#accBody'); if (!box || !DB.acc) return; accAutoPay(); const now = new Date(); if (!Acc.ym) Acc.ym = [now.getFullYear(), now.getMonth()];
  const [Y, Mo] = Acc.ym, pre = `${Y}-${String(Mo + 1).padStart(2, '0')}`, first = new Date(Y, Mo, 1), nd = new Date(Y, Mo + 1, 0).getDate(), today = ymd(now);
  const mon = DB.acc.recs.filter(r => r.d && r.d.startsWith(pre)), out = mon.reduce((s, r) => s + (r.type === 'out' ? accMine(r) : 0), 0), inc = mon.reduce((s, r) => s + (r.type === 'in' ? +r.amt || 0 : 0), 0);
  const net = {}, trD = {}; mon.forEach(r => { if (r.type !== 'tr') net[r.d] = (net[r.d] || 0) + accSign(r) * accMine(r); else trD[r.d] = 1; });
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), dow = (first.getDay() + d - 1) % 7, v = net[k];
    cells += `<button class="cd ${k === Acc.day ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${v ? `<em class="acN ${v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${Math.abs(v) >= 100000 ? +(v / 10000).toFixed(Math.abs(v) >= 1000000 ? 0 : 1) + '萬' : Math.round(v).toLocaleString('en-US')}</em>` : trD[k] ? '<em class="acN tr">轉帳</em>' : ''}</button>`; }
  const debts = accDebts(), dIds = pOrder(Object.keys(debts)), lossM = mon.filter(r => r.type === 'loss').reduce((t, r) => t + (+r.amt || 0), 0);
  const L = (Acc.day ? mon.filter(r => r.d === Acc.day) : mon).slice().sort(recSort);
  const days = []; L.forEach(r => { let g = days.find(x => x.d === r.d); if (!g) days.push(g = {d: r.d, L: []}); g.L.push(r); });
  $('#accSub').textContent = `${Mo + 1}月・${mon.length} 筆`;
  box.innerHTML = `<button class="acTplBtn card" data-a="tpls"><span class="acTplI">⭐</span><span class="grow"><b>常用紀錄</b><small>${DB.acc.tpls.length ? esc(DB.acc.tpls.slice(0, 3).map(t => t.name).join('、')) + (DB.acc.tpls.length > 3 ? ` 等 ${DB.acc.tpls.length} 個` : '') : '每月房租、手機費…點一下就記好'}</small></span><span class="acDGo">打開 ›</span></button>
    <div class="acSum card"><div class="acT out"><small>支出（我的）</small><b>${money(out)}</b></div><div class="acT in"><small>收入</small><b>${money(inc)}</b></div><div class="acT bal"><small>結餘</small><b>${money(inc - out - lossM)}</b></div></div>${lossM ? `<div class="acLoss card">💸 這個月遺失 <b>${money(lossM)}</b><small>（另外統計，已算進結餘）</small></div>` : ''}
    ${dIds.length ? `<div class="acDebt card"><div class="acDH"><b>🤝 還沒結清的欠款</b><button class="btn sm" data-a="settleLog">對帳紀錄</button></div>${dIds.map(p => { const u = aWho(p), v = debts[p]; return `<button class="acDR" data-settle="${p}"><span class="acDI">${esc(u.icon)}</span><span class="grow"><b>${esc(u.name)}</b><small>${v > 0 ? '欠我' : '我欠他'}</small></span><span class="acDV ${v > 0 ? 'pos' : 'neg'}">${money(Math.abs(v))}</span><span class="acDGo">對帳 ›</span></button>`; }).join('')}</div>` : ''}
    <div class="cal card">${calHead(Y, Mo)}<div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG acCal">${cells}</div></div>
    ${Acc.day ? `<div class="invDayBar"><span class="grow">📅 只看 ${dayLabel(Acc.day)}</span><button class="btn sm" data-a="allDays">看整個月</button></div>` : ''}
    ${days.map(g => { const s = g.L.reduce((t, r) => t + accSign(r) * accMine(r), 0); return `<div class="acDay"><span>${dayLabel(g.d)}</span>${s ? `<b class="${s > 0 ? 'pos' : 'neg'}">${s > 0 ? '+' : ''}${money(s)}</b>` : ''}</div>${g.L.map(accCard).join('')}`; }).join('')
      || `<div class="empty mealEmpty"><span class="big">📒</span>${Acc.day ? '這天' : '這個月'}還沒有記帳<br><span class="small">按上面的「＋ 記一筆」，或「從分帳匯入」把購物明細帶進來</span></div>`}`;
}
function accCard(r) {
  const c = accCat(r), me = accMe(), sp = (r.split || []).filter(s => s.p !== me), payer = r.payer || me;
  if (r.type === 'loss') return `<button class="acR card" data-r="${r.id}"><span class="acI loss">💸</span><span class="acM"><b>金額遺失${r.note ? `<em>${esc(String(r.note).split('\n')[0])}</em>` : ''}</b><small>${esc([r.t, acctName(r.acct)].filter(Boolean).join('・'))}</small></span><span class="acV neg">-${money(r.amt)}</span></button>`;
  if (r.type === 'tr') { const nl = String(r.note || '').split('\n'), ext = '外部' + (r.via ? `（${r.via}）` : '');
    return `<button class="acR card" data-r="${r.id}"><span class="acI tr">${r.settle ? '🤝' : '🔄'}</span><span class="acM"><b>${esc(nl[0] || c.n)}</b><small>${esc([r.t, (r.acct ? acctName(r.acct) : ext) + ' → ' + (acctName(r.to) || ext), +r.fee ? '手續費 ' + money(r.fee) : ''].filter(Boolean).join('・'))}</small>${nl.length > 1 ? `<span class="acNoteL">${esc(nl.slice(1).join('\n'))}</span>` : ''}</span><span class="acV ${r.settle && r.to ? 'pos' : ''}">${money(r.amt)}</span></button>`; }
  const chips = sp.length ? (payer === me ? sp.map(s => { const st = (r.settled || {})[s.p]; return `<span class="acChip ${st ? 'ok' : ''}">${esc(aWho(s.p).name)} 欠 ${money(s.amt)}${st ? ' ✓' : ''}</span>`; }).join('')
    : `<span class="acChip ${(r.settled || {})[payer] ? 'ok' : 'neg'}">${esc(aWho(payer).name)} 付・我欠 ${money(-accOwe(r, payer))}${(r.settled || {})[payer] ? ' ✓' : ''}</span>`) : '';
  const first = String(r.note || '').split('\n')[0];
  return `<button class="acR card" data-r="${r.id}"><span class="acI">${esc(c.i)}</span><span class="acM"><b>${esc(r.payee || c.n)}${r.payee ? `<em>${esc(c.n)}</em>` : ''}</b><small>${[r.t, acctName(r.acct), first, (r.imgs || []).length ? '🖼️' + r.imgs.length : ''].filter(Boolean).map(esc).join('・')}</small>${chips ? `<span class="acChips">${chips}</span>` : ''}</span>
    <span class="acV ${r.type === 'in' ? 'pos' : 'neg'}">${r.type === 'in' ? '+' : '-'}${money(r.amt)}${sp.length && r.type === 'out' ? `<small>我 ${money(accMine(r))}</small>` : ''}</span></button>`;
}
async function useTpl(t) {
  if (!(+t.amt > 0)) { const pre = JSON.parse(JSON.stringify(t)); delete pre.id; delete pre.name; pre.amt = 0; pre.split = (pre.split || []).map(s => ({p: s.p, amt: 0})); await accEdit(null, pre); return; }   /* 沒設金額（例如電費）：先輸入金額 */
  const now = new Date(), r = Object.assign(JSON.parse(JSON.stringify(t)), {id: 'r' + uid(), d: ymd(now), t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), settled: {}, imgs: []}); delete r.name;
  DB.acc.recs.push(r); saveAcc(); buzz(30); renderAcc();
  const T = $('#toast'); toast(`✅ 已記下「${t.name}」${money(t.amt)}（點這裡復原）`, 4000); T.onclick = () => { T.onclick = null; DB.acc.recs = DB.acc.recs.filter(x => x !== r); saveAcc(); renderAcc(); toast('已復原'); };
}
function initAcc() {
  initAccMap();
  if (S.inAcc) document.body.classList.add('mAcc');
  $('#accNew').onclick = () => { buzz(15); accEdit(null); };
  $('#accImp').onclick = () => { buzz(10); accImportBills(); };
  $('#accFind').onclick = () => { buzz(10); accSearch(); };
  $('#accToday').onclick = () => { buzz(10); const d = new Date(); Acc.ym = [d.getFullYear(), d.getMonth()]; Acc.day = ymd(d); renderAcc(); };
  $('#accSettle').onclick = () => { buzz(10); accPickSettle(); };
  $('#accTr').onclick = () => { buzz(10); accEdit(null, {type: 'tr'}); };
  $('#accBody').addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-d],[data-r],[data-settle],[data-tpl]'); if (!t) return; buzz(8);
    if (t.dataset.d) { Acc.day = Acc.day === t.dataset.d ? null : t.dataset.d; renderAcc(); return; }
    if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r); return; }
    if (t.dataset.settle) { accSettle(t.dataset.settle); return; }
    if (t.dataset.tpl) { const tp = DB.acc.tpls.find(x => x.id === t.dataset.tpl); if (tp) useTpl(tp); return; }
    const a = t.dataset.a, [Y, Mo] = Acc.ym;
    if (a === 'pm' || a === 'nm') { const d = new Date(Y, Mo + (a === 'pm' ? -1 : 1), 1); Acc.ym = [d.getFullYear(), d.getMonth()]; Acc.day = null; renderAcc(); }
    else if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Y, Mo, a === 'ymY' ? 'y' : 'm'); if (r) { Acc.ym = r; Acc.day = null; renderAcc(); } }
    else if (a === 'allDays') { Acc.day = null; renderAcc(); }
    else if (a === 'settleLog') accSettleLog(); else if (a === 'tpls') tplList(); });
  $('#accABody').addEventListener('click', accAssetClick); $('#accEye').onclick = () => { buzz(15); Acc.showAmt = !Acc.showAmt; renderAccAsset(); };
  $('#accSBody').addEventListener('click', accStatClick);
  $('#accCBody').addEventListener('click', accCfgClick);
}

/* ---------- 類別選擇（母分類 → 子分類） ---------- */
function catPickerHtml(type, cur, openP) {
  const L = DB.acc.cats[type], f = catFind(type, cur), P = L.find(p => p.id === openP) || f.p || L[0];
  return `<div class="acPar">${L.map(p => `<button data-par="${p.id}" class="${P && p.id === P.id ? 'on' : ''}"><i>${esc(p.i)}</i>${esc(p.n)}</button>`).join('')}</div>
    <div class="acCats">${P ? (P.subs || []).map(c => `<button data-cat="${c.id}" class="${c.id === cur ? 'on' : ''}"><i>${esc(c.i || P.i)}</i><span>${esc(c.n)}</span></button>`).join('') + `<button data-a="addSub" data-p="${P.id}"><i>＋</i><span>新增</span></button>` : ''}</div>`;
}
const emojiSplit = s => { const m = String(s).trim().match(/^(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)\s*(.+)$/u); return m ? [m[1], m[2].trim()] : ['', String(s).trim()]; };

/* ---------- 帳戶選擇（種類 → 哪一個） ---------- */
function acctPickerHtml(cur, key, fund) {
  const a = accAcct(cur), kind = (a && a.kind) || (acctPickerHtml.k || {})[key] || 'cash', L = DB.acc.accts.filter(x => x.kind === kind);
  const fk = key === 'to' ? 'fund2' : 'fund', F = a && a.kind === 'pay' ? (fund || a.fund || '') : '';
  return `<div class="dkSeg acKind">${Object.entries(AK).map(([k, [n, i]]) => `<button data-kind="${k}" data-key="${key}" class="${k === kind ? 'on' : ''}">${i} ${n}</button>`).join('')}</div>
    <div class="acAccts">${L.map(x => `<button data-acct="${x.id}" data-key="${key}" class="${x.id === cur ? 'on' : ''}">${aIco(x)} ${esc(x.n)}</button>`).join('')}<button data-a="addAcct" data-kind="${kind}" data-key="${key}" class="add">＋ 新增${AK[kind][0]}</button></div>
    ${a && a.kind === 'pay' ? `<div class="acFund"><small>實際從哪裡扣款</small><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'card' || x.kind === 'stored').map(x => `<button data-fund="${x.id}" data-fk="${fk}" class="${x.id === F ? 'on' : ''}">${aIco(x)} ${esc(x.n)}</button>`).join('') || '<span class="muted small">先新增銀行、信用卡或儲值帳戶</span>'}</div></div>` : ''}`;
}
acctPickerHtml.k = {};
function newAcct(kind) {
  return new Promise(res => { let done = false; const P = (ACCT_PRESET[kind] || []).filter(([n]) => !DB.acc.accts.some(x => x.n === n)), sh = sheet({title: `新增${AK[kind][0]}`, full: true, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = `<button class="btn block" data-a="custom" style="margin-bottom:.8rem">✏️ 自己輸入名稱和圖示</button>${P.length ? `<div class="lbl">常見的${AK[kind][0]}</div><div class="acPre">${P.map(([n, t, c, c2, fg], i) => `<button data-i="${i}">${c ? monoHtml(mono(t, c, c2, fg)) : t}<span>${esc(n)}</span></button>`).join('')}</div>` : ''}
      <div class="small muted" style="margin-top:.7rem">${kind === 'pay' ? '行動支付沒有餘額，是付款方式；新增後請設定它綁定哪個銀行、信用卡或儲值帳戶，記帳時會從那個帳戶扣款。' : kind === 'stored' ? '儲值帳戶（悠遊卡、一卡通、POYA Pay…）有自己的餘額，可以用「轉帳」從銀行儲值。' : '選好之後可以在資產頁點帳戶換圖示。'}</div>`;
    const add = a => { DB.acc.accts.push(a); saveAcc(); done = true; sh.close(); res(a); };
    sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.i != null) { const [n, tt, c, c2, fg] = P[+t.dataset.i]; add({id: 'a' + uid(), n, i: c ? mono(tt, c, c2, fg) : tt, kind, bal0: 0}); return; }
      if (t.dataset.a === 'custom') { const v = await nameIcon(`新增${AK[kind][0]}`, {n: '', i: AK[kind][1]}, {lib: 'fin', ph: {cash: '例如：錢包', bank: '例如：玉山銀行', card: '例如：CUBE 卡', stored: '例如：悠遊卡', pay: '例如：LINE Pay'}[kind]}); if (v) add({id: 'a' + uid(), n: v.n, i: v.i, kind, bal0: 0}); } }; });
}

/* ---------- 商家／對象 ---------- */
/* ---------- 商家／對象：和收藏的店家整合成同一份清單 ----------
   分類 = 收藏分類（早餐、午餐、量販店…，和購物分帳共用）＋ 只用在記帳的分類（生活繳費：台電、台水…）
   payee = {id, n, g: 分類 id, cat: 記帳類別}；放在收藏分類裡的名稱也會出現在購物分帳的「選擇店家」 */
const payGroups = () => { const A = DB.acc; A.pcats = A.pcats || []; A.gord = A.gord || [];
  const L = DB.cats.map(c => ({id: c.id, name: c.name, icon: c.icon, color: c.color, shop: 1})).concat(A.pcats.map(c => Object.assign({shop: 0}, c)));
  const ix = id => { const i = A.gord.indexOf(id); return i < 0 ? 1e4 + L.findIndex(x => x.id === id) : i; }; return L.sort((x, y) => ix(x.id) - ix(y.id)); };
const isShopG = g => DB.cats.some(c => c.id === g);
const autoCat = (gname, type = 'out') => { let id = ''; (DB.acc.cats[type] || []).forEach(P => (P.subs || []).forEach(sc => { if (!id && sc.n === gname) id = sc.id; })); return id; };
/* 舊的商家名稱（沒有分類）：同名的收藏店家就跟著它，其他依記帳母分類建一個「只用在記帳」的分類 */
function payMigrate() { const A = DB.acc; A.pcats = A.pcats || []; A.iord = A.iord || {}; let ch = 0;
  A.payees.forEach(py => { if (py.g !== undefined) return; const P = (DB.places || []).find(x => x.name === py.n); if (P) { py.g = P.cat || ''; py.dupe = 1; ch++; return; }
    const f = catFind('out', py.cat).p ? catFind('out', py.cat) : catFind('in', py.cat), sameC = f.s && DB.cats.find(c => c.name === f.s.n); if (sameC) { py.g = sameC.id; ch++; return; } const nm = f.p ? f.p.n + (f.p.n === '生活' ? '繳費' : '') : '其他';
    let g = A.pcats.find(x => x.name === nm); if (!g) { g = {id: 'g' + uid(), name: nm, icon: f.p ? f.p.i : '🏷️', color: '#8a6a4a'}; A.pcats.push(g); } py.g = g.id; ch++; });
  const n0 = A.payees.length; A.payees = A.payees.filter(py => !py.dupe); if (ch || A.payees.length !== n0) saveAcc(); }
/* 某個分類裡的所有項目（收藏店家＋自訂名稱），依自訂順序 */
function payItems(g, hit) { const A = DB.acc, ord = (A.iord || {})[g || '_'] || [];
  const pl = (DB.places || []).filter(p => (g ? p.cat === g : !DB.cats.some(c => c.id === p.cat)) && (!hit || hit(p.name))).map(p => ({k: 'p:' + p.id, n: p.name, pl: p}));
  const py = A.payees.filter(x => (x.g || '') === (g || '') && (!hit || hit(x.n)) && !pl.some(z => z.n === x.n)).map(x => ({k: 'y:' + x.id, n: x.n, py: x}));
  const all = pl.concat(py), ix = it => { const i = ord.indexOf(it.k); return i < 0 ? 1e4 + all.indexOf(it) : i; }; return all.sort((x, y) => ix(x) - ix(y)); }
function payGroupSort(ids) { const A = DB.acc; A.gord = ids.slice(); const order = ids.map(id => DB.cats.find(c => c.id === id)).filter(Boolean), pos = DB.cats.map((c, i) => order.includes(c) ? i : -1).filter(i => i >= 0); pos.forEach((p, i) => { DB.cats[p] = order[i]; }); saveCats(); saveAcc(); }
function payItemSort(g, keys) { const A = DB.acc; A.iord = A.iord || {}; A.iord[g || '_'] = keys.slice(); saveAcc();
  const pids = keys.filter(k => k[0] === 'p').map(k => k.slice(2)), pos = DB.places.map((x, i) => pids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = pids.map(id => DB.places.find(x => x.id === id)); pos.forEach((p, i) => { DB.places[p] = objs[i]; });
  DB.places.forEach((p, i) => { if (p.ord !== i) { p.ord = i; savePlace(p); } }); }
function payListHtml(q, cur, sub) {
  const hit = q ? n => n.toLowerCase().includes(q) : null, F = S.pyFold = S.pyFold || {}, G = payGroups().concat([{id: '', name: '未分類', icon: '📍', color: '#7d6c57', shop: 1}]).map(g => Object.assign(g, {L: payItems(g.id, hit)})).filter(g => g.L.length || (!q && g.id));
  const allFold = G.length && G.every(g => F[g.id || '_']);
  return {G, html: (G.length && !q ? `<div class="pyTop"><span class="small muted grow">按住 ☰ 拖曳分類、按住名稱拖曳排序</span><button class="btn sm" data-a="foldAll">${allFold ? '⊞ 全部展開' : '⊟ 全部收合'}</button></div>` : '')
    + `<div class="pyCats">${G.map(g => { const k = g.id || '_', shut = !q && F[k]; return `<div class="pyCat ${shut ? 'shut' : ''}" data-g="${k}"><button class="pyCH" data-fold="${k}" style="--c:${g.color}">${q || !g.id ? '' : '<span class="grip"></span>'}<span>${esc(g.icon)}</span><b>${esc(g.name)}</b>${g.shop ? '' : '<span class="pyOnly">只用在記帳</span>'}${sub && g.id && !g.shop ? `<span class="pyEd" data-gedit="${g.id}">✎</span>` : ''}<em>${g.L.length}</em><i class="psCv">▾</i></button>${shut ? '' : `<div class="acPyG pyS">${g.L.map(it => `<button class="acPy ${it.n === cur ? 'on' : ''}" data-k="${it.k}">${esc(it.n)}${storeLoc(it.n) ? '<i class="pyLoc" title="已連結地圖">📍</i>' : ''}${sub && it.py ? '<i>✎</i>' : ''}</button>`).join('')}${g.L.length ? '' : `<button class="acPy new" data-addg="${g.id}">＋ 在這裡新增名稱</button>`}</div>`}</div>`; }).join('')}</div>`
    + (G.length ? '' : '<div class="empty">還沒有名稱，按「＋ 新增名稱」建立</div>')};
}
function payBindSort(root, scroller, redraw) {
  sortable(root, {item: '.acPy[data-k]', scope: '.pyS', axis: 'grid', scroller, onSort(f, t, scope) { const keys = $$('.acPy', scope).map(e => e.dataset.k), mv = keys.splice(f, 1)[0]; keys.splice(t, 0, mv); const g = scope.closest('.pyCat').dataset.g; payItemSort(g === '_' ? '' : g, keys); redraw(); }});
  const CW = $('.pyCats', root); if (CW) sortable(CW, {item: '.pyCat', handle: '.grip', handleOnly: true, scroller, onSort(f, t) { const ids = $$('.pyCat', CW).map(e => e.dataset.g).filter(x => x !== '_'), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv); payGroupSort(ids); redraw(); }});
}
function payFold(t, root, redraw) { const F = S.pyFold = S.pyFold || {};
  if (t.dataset.fold) { F[t.dataset.fold] = F[t.dataset.fold] ? 0 : 1; saveS(); redraw(); return true; }
  if (t.dataset.a === 'foldAll') { const ks = $$('.pyCat', root).map(e => e.dataset.g), all = ks.every(k => F[k]); ks.forEach(k => { F[k] = all ? 0 : 1; }); saveS(); redraw(); return true; } return false; }
const payFromKey = (k, type) => { if (k[0] === 'p') { const P = DB.places.find(x => x.id === k.slice(2)); if (!P) return null; const gn = (DB.cats.find(c => c.id === P.cat) || {}).name || ''; return {n: P.name, cat: autoCat(gn, type), place: P.id}; } return DB.acc.payees.find(x => x.id === k.slice(2)) || null; };
function pickPayee(type, cur) {
  payMigrate();
  return new Promise(res => { let done = false, q = ''; const sh = sheet({title: '🏪 商家／對象', full: true, onClose() { if (!done) res(undefined); }});
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="pyQ" type="search" placeholder="搜尋或直接輸入新名稱"></div><div class="row" style="gap:.5rem;margin-bottom:.7rem"><button class="btn sm" data-a="new">＋ 新增名稱</button><button class="btn sm" data-a="none">不填</button><button class="btn sm" data-a="mng">⚙️ 管理</button></div><div id="pyL"></div>`;
    const draw = () => { const r = payListHtml(q, cur); $('#pyL', sh.body).innerHTML = `<div class="pyW">${q && !r.G.some(g => g.L.some(it => it.n.toLowerCase() === q)) ? `<button class="acPy new" data-add="1">＋ 新增「${esc($('#pyQ', sh.body).value.trim())}」</button>` : ''}${r.html}</div>`; if (!q) payBindSort($('.pyW', sh.body), sh.body, draw); };
    draw(); $('#pyQ', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    const fin = v => { done = true; sh.close(); res(v); };
    sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (payFold(t, sh.body, draw)) return;
      if (t.dataset.k) { const v = payFromKey(t.dataset.k, type); if (v) fin(v); return; }
      if (t.dataset.a === 'none') { fin(null); return; }
      if (t.dataset.a === 'mng') { await managePayees(); draw(); return; }
      if (t.dataset.addg) { const py = await editPayee(type, {n: '', g: t.dataset.addg}); if (py) fin(py); else draw(); return; }
      if (t.dataset.add || t.dataset.a === 'new') { const py = await editPayee(type, {n: t.dataset.add ? $('#pyQ', sh.body).value.trim() : ''}); if (py) fin(py); } }); });
}
/* 新分類：可以選要不要也放進收藏分類（購物分帳的店家會用到） */
async function newPayGroup() {
  const v = await nameIcon('新增分類', {n: '', i: '🏷️'}, {ph: '例如：早午餐、生活繳費', extra: `<button class="ckRow on" data-a="shopck" id="pyShopCk"><span class="acCk"></span>也當成收藏店家的分類（購物分帳選店家時看得到）</button><div class="small muted">像台電、台水這種只在記帳用的，就把勾勾拿掉。</div>`, read: b => ({shop: $('#pyShopCk', b).classList.contains('on')})});
  if (!v) return null;
  if (v.shop) { const c = {id: 'c' + uid(), name: v.n, icon: v.i, color: CAT_COLORS.find(x => !DB.cats.some(y => y.color.toLowerCase() === x.toLowerCase())) || CAT_COLORS[DB.cats.length % CAT_COLORS.length]}; DB.cats.push(c); saveCats(); return c.id; }
  const g = {id: 'g' + uid(), name: v.n, icon: v.i, color: '#8a6a4a'}; (DB.acc.pcats = DB.acc.pcats || []).push(g); saveAcc(); return g.id;
}
/* 只用在記帳的分類：改名、換圖示、刪除（裡面的名稱移到「未分類」） */
async function editPayGroup(id) { const A = DB.acc, g = (A.pcats || []).find(x => x.id === id); if (!g) return;
  const v = await nameIcon('編輯分類', {n: g.name, i: g.icon}, {del: true}); if (!v) return;
  if (v.del) { const n = A.payees.filter(x => x.g === id).length; if (!await ask(n ? `刪除分類「${g.name}」？裡面的 ${n} 個名稱會移到「未分類」。` : `刪除分類「${g.name}」？`, '刪除', true)) return;
    A.payees.forEach(x => { if (x.g === id) x.g = ''; }); A.pcats = A.pcats.filter(x => x !== g); A.gord = (A.gord || []).filter(x => x !== id); saveAcc(); toast('已刪除分類'); return; }
  g.name = v.n; g.icon = v.i; saveAcc(); }
document.addEventListener('click', e => { const t = e.target.closest('#pyShopCk'); if (t) { buzz(8); t.classList.toggle('on'); } }, true);
function editPayee(type, p0) {
  return new Promise(res => { const isNew = !p0.id, p = Object.assign({id: 'y' + uid(), n: '', cat: '', g: undefined}, p0); let ty = type, openP = '', done = false;
    if (p.g === undefined) { const G = payGroups(); p.g = (G.find(g => !g.shop) || G[0] || {}).id || ''; }
    const sh = sheet({title: isNew ? '新增商家／對象' : '編輯商家／對象', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">儲存</button>`, onClose() { if (!done) res(null); }});
    const draw = () => { const G = payGroups(), gs = isShopG(p.g);
      const lc = p.n ? storeLoc(p.n) : null;
      sh.body.innerHTML = `<div class="field"><label>名稱</label><input id="pyN" value="${esc(p.n)}" placeholder="例如：台灣電力公司、好鄰居超市"></div>
        <div class="pyLocR card"><span class="grow">${lc ? `📍 <b>已連結地圖</b><small>${esc(lc.addr || '')}${lc.fav ? '・日日帳本地圖收藏' : ''}</small>` : '📌 <b>還沒有地圖位置</b><small>釘選後會出現在記帳的「地圖」分頁</small>'}</span>${lc && lc.fav ? '' : `<button class="btn sm" data-a="pin">📍 ${lc ? '更改' : '釘選'}</button>`}</div>
        <div class="lbl">放在哪個分類</div><div class="pgPick">${G.map(g => `<button data-g="${g.id}" class="${g.id === p.g ? 'on' : ''}" style="--c:${g.color}">${esc(g.icon)} ${esc(g.name)}${g.shop ? '' : '<small>記帳</small>'}</button>`).join('')}<button data-a="newG" class="add">＋ 新分類</button></div>
        <div class="small muted" style="margin:-.2rem 0 .8rem">${gs ? '🛒 這個分類是收藏店家的分類，購物分帳「選擇店家」時也看得到這個名稱。' : '📒 只用在記帳，不會出現在購物分帳。'}</div>
        <div class="lbl">記帳時自動帶入的類別</div><div class="acType"><button data-ty="out" class="${ty === 'out' ? 'on' : ''}">支出</button><button data-ty="in" class="${ty === 'in' ? 'on' : ''}">收入</button></div>${catPickerHtml(ty, p.cat, openP)}`; };
    draw();
    sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); p.n = $('#pyN', sh.body).value.trim();
      if (t.dataset.g != null) { p.g = t.dataset.g; if (!p.cat) { const gn = (payGroups().find(g => g.id === p.g) || {}).name; p.cat = autoCat(gn, ty) || p.cat; } draw(); }
      else if (t.dataset.a === 'newG') { const id = await newPayGroup(); if (id) { p.g = id; draw(); } }
      else if (t.dataset.a === 'pin') { if (!p.n) { toast('請先輸入名稱'); return; } if (await accPinStore(p.n)) draw(); }
      else if (t.dataset.ty) { ty = t.dataset.ty; openP = ''; draw(); } else if (t.dataset.par) { openP = t.dataset.par; draw(); } else if (t.dataset.cat) { p.cat = t.dataset.cat; draw(); } });
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; p.n = $('#pyN', sh.body).value.trim();
      if (b.dataset.a === 'del') { if (!await ask(`刪除「${p.n}」？`, '刪除', true)) return; DB.acc.payees = DB.acc.payees.filter(x => x.id !== p.id); saveAcc(); done = true; sh.close(); res(null); return; }
      if (!p.n) { toast('請輸入名稱'); return; } const i = DB.acc.payees.findIndex(x => x.id === p.id), oldN = i >= 0 ? DB.acc.payees[i].n : ''; if (i >= 0) DB.acc.payees[i] = p; else DB.acc.payees.push(p); saveAcc(); done = true; sh.close();
      if (oldN && oldN !== p.n && !isShopG(p.g) && (DB.acc.pcats || []).some(c => c.id === p.g)) { DB.acc.recs.forEach(r => { if (r.payee === oldN) r.payee = p.n; }); DB.acc.tpls.forEach(t => { if (t.payee === oldN) t.payee = p.n; }); if (DB.acc.locs && DB.acc.locs[oldN]) { DB.acc.locs[p.n] = DB.acc.locs[oldN]; delete DB.acc.locs[oldN]; } saveAcc(); }
      else if (oldN && oldN !== p.n) { const newN = p.n; p.n = oldN; await renameStoreAsk(oldN, newN); p.n = newN; saveAcc(); }
      res(p); }; });
}
/* ---------- 記一筆／編輯 ---------- */
function accEdit(r0, preset, opt = {}) {
  return new Promise(res => {
    const isNew = !r0, me = accMe(), now = new Date(), TPL = !!opt.tpl;
    const r = JSON.parse(JSON.stringify(r0 || Object.assign({id: 'r' + uid(), d: Acc.day || ymd(now), t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), type: 'out', amt: 0, cat: '', acct: (DB.acc.accts[0] || {}).id || '', to: '', fee: 0, note: '', payee: '', payer: me, split: [], items: [], imgs: []}, preset || {})));
    if (!r.d) r.d = Acc.day || ymd(now); if (!r.t) r.t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    r.imgs = r.imgs || []; if (!r.cat && (r.type === 'out' || r.type === 'in')) r.cat = firstCat(r.type);
    let expr = r.amt ? String(r.amt) : '', openP = '', mode = (r.split || []).length && r.split.some((s, i, A) => Math.abs(s.amt - A[0].amt) > 0.011) ? 'custom' : 'even', saved = false;
    let who = (r.split || []).map(s => s.p), custom = {}; (r.split || []).forEach(s => { custom[s.p] = s.amt; });
    const sh = sheet({title: TPL ? (isNew ? '⭐ 新增常用紀錄' : '⭐ 編輯常用紀錄') : isNew ? '📒 記一筆' : '📒 編輯記帳', full: true, foot: TPL ? `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">儲存常用紀錄</button>` : `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn" data-a="tpl" style="flex:0 0 auto">⭐ 存成常用</button><button class="btn pri" data-a="ok">儲存</button>`, onClose() { if (!saved) res(null); }});
    const evalX = e2 => { try { const s2 = String(e2).replace(/×/g, '*').replace(/÷/g, '/').replace(/[^\d.+\-*/]/g, '').replace(/[+\-*/.]+$/, ''); if (!s2) return 0; const v = Function('"use strict";return (' + s2 + ')')(); return isFinite(v) ? r2(v) : 0; } catch (e) { return 0; } };
    const calc = () => evalX(expr);
    const shares = () => { const A = calc(); if (!who.length) return []; if (mode === 'custom') return who.map(p => ({p, amt: r2(+custom[p] || 0)}));
      const base = Math.floor(A / who.length * 100) / 100; let rest = r2(A - base * who.length); return who.map(p => { let v = base; if (rest > 0.001) { v = r2(v + 0.01); rest = r2(rest - 0.01); } return {p, amt: v}; }); };
    const draw = () => { const A = calc(), sp = shares(), sumSp = r2(sp.reduce((s, x) => s + x.amt, 0)), payer = r.payer || me, top = sh.body.scrollTop, tr = r.type === 'tr';
      sh.body.innerHTML = `<div class="acType four"><button data-ty="out" class="${r.type === 'out' ? 'on' : ''}">支出</button><button data-ty="in" class="${r.type === 'in' ? 'on' : ''}">收入</button><button data-ty="tr" class="${tr ? 'on' : ''}">轉帳</button><button data-ty="loss" class="${r.type === 'loss' ? 'on' : ''}">遺失</button></div>
        <div class="acAmt ${r.type}"><span class="acCur">NT$</span><b id="acA">${expr ? esc(expr) : '0'}</b>${/[+\-×÷]/.test(expr) ? `<small>= ${money(A)}</small>` : ''}</div>
        <div class="acKeys">${['AC', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '00', '0', '.'].map(k => `<button data-k="${k}" class="${/[⌫+−×÷]|AC/.test(k) ? 'op' : k === '=' ? 'eq' : ''}">${k}</button>`).join('')}</div>
        ${TPL ? '<div class="small muted" style="margin:-.5rem 0 .8rem">常用紀錄的金額可以留 0（例如每期不一樣的電費），點常用紀錄時會先讓你輸入金額。</div>' : ''}
        ${TPL ? `<div class="field"><label>常用紀錄名稱</label><input id="acTn" value="${esc(r.name || '')}" placeholder="例如：房租、手機月租"></div>` : ''}<div class="acRow2 ${TPL ? 'hide' : ''}"><button class="btn" data-a="date">📅 ${r.d.replace(/-/g, '/')}（${MWD[ymdDate(r.d).getDay()]}）</button><button class="btn" data-a="time">🕒 ${esc(r.t || '時間')}</button></div>
        ${tr && r.settle ? (() => { const inn = !r.acct, k = inn ? 'to' : 'acct'; return `<div class="lbl">${inn ? '從哪裡轉進來' : '轉給對方'}</div><div class="acExt">🌐 外部（對方的帳戶／支付）</div><div class="lbl">付款方式</div><div class="acAccts">${SETTLE_VIA.map(v => `<button data-via="${v}" class="${v === r.via ? 'on' : ''}">${v}</button>`).join('')}</div><div class="lbl">${inn ? '收進我的哪個帳戶' : '從我的哪個帳戶付'}</div><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'cash').map(x => `<button data-sacct="${k}:${x.id}" class="${x.id === r[k] ? 'on' : ''}">${aIco(x)} ${esc(x.n)}</button>`).join('')}</div>`; })() : tr ? `<div class="lbl">從哪個帳戶轉出</div>${acctPickerHtml(r.acct, 'acct', r.fund)}<div class="lbl">轉入哪個帳戶</div>${acctPickerHtml(r.to, 'to', r.fund2)}<div class="field" style="margin-top:.6rem"><label>手續費（沒有就留空）</label><input id="acFee" value="${+r.fee ? r.fee : ''}" inputmode="decimal" placeholder="0"></div>`
        : r.type === 'loss' ? `<div class="lbl">從哪裡遺失的（現金、銀行、卡片…）</div>${acctPickerHtml(r.acct, 'acct', r.fund)}<div class="small muted" style="margin:.2rem 0 .4rem">💸 金額遺失會從這個帳戶扣掉，另外統計，不算在支出裡。</div>`
        : `<div class="lbl">類別</div>${catPickerHtml(r.type, r.cat, openP)}
        <div class="lbl">商家／對象</div><button class="acPayee" data-a="payee">${r.payee ? `<b>${esc(r.payee)}</b>` : '<span class="muted">選擇店名，或自訂名稱（例如：台灣電力公司）</span>'}<i>›</i></button>${r.payee && !isPcatPayee(r.payee) && r.type !== 'tr' ? (storeLoc(r.payee) ? `<div class="pyLocT on">📍 已連結地圖${storeLoc(r.payee).addr ? '・' + esc(storeLoc(r.payee).addr) : ''}</div>` : '<button class="pyLocT" data-a="pinP">📌 這間店還沒有地圖位置，點這裡釘選</button>') : ''}
        <div class="lbl">${r.type === 'in' ? '收進哪個帳戶' : '付款帳戶'}</div>${acctPickerHtml(r.acct, 'acct', r.fund)}`}
        ${r0 && Object.keys(r.settled || {}).length ? `<div class="acSetl">${Object.keys(r.settled).map(p => `<div class="row" style="gap:.5rem"><span class="grow">✓ 已和 ${esc(aWho(p).name)} 結清</span><button class="btn sm" data-unst="${p}">改回未結清</button></div>`).join('')}</div>` : ''}
        <div class="field" style="margin-top:.7rem"><label class="row" style="gap:.4rem"><span class="grow">備註／購物明細</span></label>${tr ? '' : `<div class="acRow2" style="margin-bottom:.5rem"><button class="btn" data-a="billEd">🧾 ${r.bill ? '編輯明細（' + (r.bill.items || []).length + ' 項）' : '用分帳方式輸入'}</button><button class="btn" data-a="fromBill">📥 從分帳帶入</button></div>`}<textarea id="acNote" rows="${Math.min(10, Math.max(3, String(r.note || '').split('\n').length + 1))}" placeholder="例如：\n鮮奶 ×2  $95\n雞蛋  $60">${esc(r.note || '')}</textarea></div>
        <div class="lbl">圖片</div><div class="acImgs">${r.imgs.map((id, i) => `<span class="acImg"><img data-img="${id}" data-i="${i}" alt=""><button data-rmimg="${i}" aria-label="移除">✕</button></span>`).join('')}<button class="acImgAdd" data-a="addImg">＋<small>加入圖片</small></button></div>
        ${r.type === 'out' ? `<div class="acSplit card"><div class="acSH"><b>🤝 分帳</b><small>${who.length ? '選了 ' + who.length + ' 人分' : '不分帳就不用選'}</small></div>
          <div class="lbl">誰付的錢</div><div class="whoRow">${accPeople().map(u => `<button data-payer="${u.id}" class="${payer === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div>
          <div class="lbl">誰要分（點選）</div><div class="whoRow">${accPeople().map(u => `<button data-who="${u.id}" class="${who.includes(u.id) ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}<button data-a="addP">＋ 新增</button></div>
          ${who.length ? `<div class="dkSeg acMode"><button data-mode="even" class="${mode === 'even' ? 'on' : ''}">平均分</button><button data-mode="custom" class="${mode === 'custom' ? 'on' : ''}">自己填金額</button></div>
            <div class="acShares">${sp.map(s => `<div class="acShR"><span>${esc(aWho(s.p).icon)} ${esc(aWho(s.p).name)}</span>${mode === 'custom' ? `<input data-cu="${s.p}" value="${custom[s.p] != null ? custom[s.p] : ''}" inputmode="decimal" placeholder="0">` : `<b>${money(s.amt)}</b>`}</div>`).join('')}</div>
            ${mode === 'custom' && Math.abs(sumSp - A) > 0.01 ? `<div class="blWarn">⚠️ 分攤合計 ${money(sumSp)}，和金額 ${money(A)} 差 ${money(A - sumSp)}</div>` : ''}
            <div class="acOwe">${sp.filter(s => s.p !== payer).map(s => `<span>${esc(aWho(s.p).name)} → ${esc(aWho(payer).name)}　<b>${money(s.amt)}</b></span>`).join('') || '<span class="muted">只有付錢的人自己，沒有欠款</span>'}</div>` : ''}</div>` : ''}
        ${(r.items || []).length ? `<div class="lbl">品項（從分帳帶入）</div><div class="acItems card">${r.items.map(x => `<div class="acIt"><span class="grow">${esc(x.n)}</span><small>${(x.ppl || []).map(p => esc(aWho(p).name)).join('、')}</small><b>${money(x.amt)}</b></div>`).join('')}</div>` : ''}`;
      sh.body.scrollTop = top; $$('img[data-img]', sh.body).forEach(async im => { im.src = await imgURL(im.dataset.img); }); };
    draw();
    const keep = () => { const n = $('#acNote', sh.body), f = $('#acFee', sh.body), tn2 = $('#acTn', sh.body); if (n) r.note = n.value.replace(/\s+$/, ''); if (f) r.fee = r2(numP(f.value)); if (tn2) r.name = tn2.value.trim(); };
    sh.body.addEventListener('input', e => { const c = e.target.dataset.cu; if (c) custom[c] = e.target.value.replace(/[^\d.]/g, ''); });
    sh.body.addEventListener('change', e => { if (e.target.dataset.cu) { keep(); draw(); } });
    sh.body.addEventListener('click', async e => { const im = e.target.closest('img[data-img]'); if (im) { Viewer.open(r.imgs.map((id, i) => ({id, label: `圖片 ${i + 1}/${r.imgs.length}`})), +im.dataset.i, r.payee || '記帳圖片'); return; }
      const t = e.target.closest('button'); if (!t) return; buzz(8); keep(); const d = t.dataset;
      if (d.k) { const k = d.k, op = {'+': '+', '−': '-', '×': '×', '÷': '÷'}[k];
        if (k === 'AC') expr = ''; else if (k === '⌫') expr = expr.slice(0, -1); else if (k === '=') { const v = calc(); expr = v ? String(v) : ''; }
        else if (op) { if (expr && /[+\-×÷]$/.test(expr)) expr = expr.slice(0, -1) + op; else if (expr) expr += op; else if (op === '-') expr = ''; }
        else if (k === '.') { if (!/\./.test(expr.split(/[+\-×÷]/).pop() || '')) expr += (expr && !/[+\-×÷]$/.test(expr) ? '' : '0') + '.'; } else if (expr.replace(/[^\d]/g, '').length < 12) expr = (expr === '0' ? '' : expr) + k; draw(); return; }
      if (d.via) { r.via = r.via === d.via ? '' : d.via; draw(); return; }
      if (d.sacct) { const [k, id] = d.sacct.split(':'); r[k] = id; draw(); return; }
      if (d.unst) { if (!await ask(`把這筆改回和 ${aWho(d.unst).name} 未結清？那次結清的還款金額會跟著減少。`, '改回未結清')) return; const db = DB.acc.recs.find(x => x.id === r.id); if (db) unsettleRec(db, d.unst); delete r.settled[d.unst]; r.settled = Object.assign({}, r.settled); renderAcc(); toast('已改回未結清'); draw(); return; }
      if (d.ty) { if (r.type !== d.ty) { r.type = d.ty; openP = ''; if (d.ty === 'out' || d.ty === 'in') r.cat = firstCat(d.ty); } draw(); return; }
      if (d.par) { openP = d.par; const P = DB.acc.cats[r.type].find(p => p.id === d.par); if (P && !(P.subs || []).length) r.cat = P.id; draw(); return; }
      if (d.cat) { r.cat = d.cat; draw(); return; }
      if (d.kind && !d.a) { acctPickerHtml.k[d.key] = d.kind; const L = DB.acc.accts.filter(x => x.kind === d.kind); r[d.key] = L.length === 1 ? L[0].id : (L.some(x => x.id === r[d.key]) ? r[d.key] : ''); if (!L.length) { const a = await newAcct(d.kind); if (a) r[d.key] = a.id; } draw(); return; }
      if (d.acct) { r[d.key] = d.acct; const ac = accAcct(d.acct); if (ac && ac.kind === 'pay') r[d.key === 'to' ? 'fund2' : 'fund'] = ac.fund || ''; draw(); return; }
      if (d.fund) { r[d.fk] = d.fund; draw(); return; }
      if (d.rmimg != null) { if (!await ask('從這筆記帳移除這張圖片？', '移除', true)) return; const id = r.imgs.splice(+d.rmimg, 1)[0]; if (!r0 || !(r0.imgs || []).includes(id)) imgDel(id); draw(); return; }
      if (d.payer) { r.payer = d.payer; if (!who.includes(d.payer) && who.length) who.push(d.payer); draw(); return; }
      if (d.who) { const i = who.indexOf(d.who); if (i >= 0) who.splice(i, 1); else who.push(d.who); who = sortIds(who); draw(); return; }
      if (d.mode) { mode = d.mode; if (mode === 'custom') shares().forEach(s => { if (custom[s.p] == null || custom[s.p] === '') custom[s.p] = s.amt; }); draw(); return; }
      const a = d.a;
      if (a === 'date') { const k = await datePick(r.d); if (k) { r.d = k; draw(); } }
      else if (a === 'time') { const v = await timePick(r.t); if (v) { r.t = v; draw(); } }
      else if (a === 'pinP') { if (await accPinStore(r.payee)) draw(); }
      else if (a === 'payee') { const p = await pickPayee(r.type, r.payee); if (p === undefined) return; r.payee = p ? p.n : ''; if (p && p.cat && catFind(r.type, p.cat).p) r.cat = p.cat; openP = ''; draw(); }
      else if (a === 'addAcct') { const ac = await newAcct(d.kind); if (ac) { r[d.key] = ac.id; draw(); } }
      else if (a === 'addImg') { const fs = await pickImages(true); if (!fs.length) return; busy('加入圖片…'); try { for (const f of fs) r.imgs.push(await imgStore(f, 2000)); } finally { busy(false); } draw(); }
      else if (a === 'addSub') { const P = DB.acc.cats[r.type].find(p => p.id === d.p), v = await nameIcon(`在「${P.n}」新增子分類`, {n: '', i: P.i}); if (!v) return; const c = {id: 'c' + uid(), n: v.n.slice(0, 10), i: v.i}; P.subs = P.subs || []; P.subs.push(c); r.cat = c.id; openP = P.id; saveAcc(); draw(); }
      else if (a === 'addP') { const n = ((await askText('新增人員名字', '')) || '').trim(); if (!n) return; const u = {id: 'u' + uid(), name: n.slice(0, 10), icon: PERSON_EMOJI[accPeople().length % PERSON_EMOJI.length]}; accPeople().push(u); saveAcc(); who.push(u.id); draw(); }
      else if (a === 'billEd') { const b = r.bill ? JSON.parse(JSON.stringify(r.bill)) : {id: 'x' + uid(), place: '', pname: r.payee || '', way: '', time: r.t || '', items: [], disc: [], odisc: [], fees: [], total: '', imgs: []};
        editBill(b, {detached: true, onDone(bb) { if (!(bb.items || []).length && !(bb.fees || []).length) { delete r.bill; draw(); return; } const x = billToAccRec(bb, r.d); r.bill = bb; r.note = x.note; r.items = x.items; r.payee = billStore(bb) || r.payee; if (!r.cat || r.cat === firstCat(r.type)) r.cat = x.cat;
          if (x.split.length) { r.split = x.split; who = x.split.map(s2 => s2.p); custom = {}; x.split.forEach(s2 => { custom[s2.p] = s2.amt; }); mode = x.split.some((s2, i, A2) => Math.abs(s2.amt - A2[0].amt) > 0.011) ? 'custom' : 'even'; }
          expr = String(x.amt || ''); draw(); toast('已用模板二寫入備註'); }}); }
      else if (a === 'fromBill') { const pick = await pickBillForAcc(); if (!pick) return; const x = billToAccRec(pick.b, pick.k); x.imgs = await copyImgs(pick.b.imgs);
        Object.assign(r, {d: x.d, t: x.t || r.t, type: 'out', cat: x.cat, payee: x.payee, note: x.note, items: x.items, split: x.split, payer: me, src: x.src}); r.imgs = r.imgs.concat(x.imgs); expr = String(x.amt);
        who = x.split.map(s => s.p); custom = {}; x.split.forEach(s => { custom[s.p] = s.amt; }); mode = x.split.length && x.split.some((s, i, A2) => Math.abs(s.amt - A2[0].amt) > 0.011) ? 'custom' : 'even'; pick.b.acc = r.id; saveBills(); draw(); toast('已帶入分帳明細'); } });
    const build = () => { const A = calc(); r.amt = A; if (r.type === 'out') { r.split = shares(); if (r.split.length === 1 && r.split[0].p === (r.payer || me)) r.split = []; } else { r.split = []; r.payer = me; } if (r.type === 'tr' || r.type === 'loss') { r.cat = ''; r.payee = ''; } return A; };
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; keep(); buzz(10);
      if (TPL) { if (b.dataset.a === 'del') { if (!await ask('刪除這個常用紀錄？', '刪除', true)) return; DB.acc.tpls = DB.acc.tpls.filter(x => x.id !== r.id); saveAcc(); saved = true; sh.close(); res(null); return; }
        const A = build(); if (A < 0) { toast('金額不正確'); return; } if (!r.name) { toast('請輸入常用紀錄名稱'); return; } if (r.type === 'tr' && (!r.to || r.to === r.acct)) { toast('請選擇不同的轉出、轉入帳戶'); return; }
        const t = JSON.parse(JSON.stringify(r)); ['d', 't', 'settled', 'imgs', 'src', 'items'].forEach(k => delete t[k]); if (!t.id || t.id[0] !== 'T') t.id = 'T' + uid(); t.name = t.name.slice(0, 20);
        const i = DB.acc.tpls.findIndex(x => x.id === t.id); if (i >= 0) DB.acc.tpls[i] = t; else DB.acc.tpls.push(t); saveAcc(); saved = true; sh.close(); toast('⭐ 已儲存常用紀錄'); res(t); return; }
      if (b.dataset.a === 'del') { if (!await ask('確定要刪除這筆記帳嗎？', '刪除', true)) return; DB.acc.recs = DB.acc.recs.filter(x => x.id !== r.id); for (const id of r.imgs || []) imgDel(id); saveAcc(); saved = true; sh.close(); renderAcc(); toast('已刪除'); res(null); return; }
      const A = build(); if (!(A > 0)) { toast('請輸入金額'); return; }
      if (r.type === 'tr' && !r.settle && (!r.to || r.to === r.acct)) { toast('請選擇不同的轉出、轉入帳戶'); return; }
      if (r.type === 'tr' && r.settle && !(r.to || r.acct)) { await alertBox('請選擇收進哪個帳戶（銀行或現金）'); return; }
      if (b.dataset.a === 'tpl') { const nm = ((await askText('常用紀錄的名稱（例如：房租、手機月租）', r.payee || accCat(r).n)) || '').trim(); if (!nm) return;
        const t = JSON.parse(JSON.stringify(r)); ['id', 'd', 't', 'settled', 'imgs', 'src', 'items'].forEach(k => delete t[k]); t.id = 'T' + uid(); t.name = nm.slice(0, 20); DB.acc.tpls.push(t); saveAcc(); toast(`⭐ 已存成常用「${t.name}」，在記帳頁「常用紀錄」點一下就會記帳`); return; }
      if (mode === 'custom' && r.split.length && Math.abs(r.split.reduce((s, x) => s + x.amt, 0) - A) > 0.01 && !await ask('分攤金額加起來和總金額不一樣，還是要儲存嗎？', '儲存')) return;
      const i = DB.acc.recs.findIndex(x => x.id === r.id); if (i >= 0) DB.acc.recs[i] = r; else DB.acc.recs.push(r);
      if (r0) (r0.imgs || []).filter(id => !r.imgs.includes(id)).forEach(id => imgDel(id));
      saveAcc(); buzz(25); const d0 = ymdDate(r.d); Acc.ym = [d0.getFullYear(), d0.getMonth()]; saved = true; sh.close(); if (curTab === 'Acc') renderAcc(); else if (curTab === 'AccA') renderAccAsset(); toast(isNew ? '✅ 已記帳' : '✅ 已儲存'); res(r); };
  });
}
async function copyImgs(ids) { const out = []; for (const id of ids || []) { const r = await IDB.get('imgs', id).catch(() => null); if (!r) continue; const nid = 'i' + uid(); await IDB.put('imgs', nid, Object.assign({}, r)); out.push(nid); } return out; }

/* ---------- 對帳 ---------- */
function accPickSettle() {
  const d = accDebts(), ids = pOrder(Object.keys(d)); const others = accPeople().filter(u => u.id !== accMe() && !ids.includes(u.id));
  const sh = sheet({title: '🤝 要跟誰對帳？', html: `<div class="actList">${ids.map(p => `<button data-p="${p}">${esc(aWho(p).icon)} ${esc(aWho(p).name)}　<b class="${d[p] > 0 ? 'pos' : 'neg'}">${d[p] > 0 ? '欠我' : '我欠'} ${money(Math.abs(d[p]))}</b></button>`).join('')}${others.map(u => `<button data-p="${u.id}">${esc(u.icon)} ${esc(u.name)}　<span class="muted">沒有未結清</span></button>`).join('')}</div>`});
  sh.body.onclick = e => { const t = e.target.closest('[data-p]'); if (!t) return; buzz(10); sh.close(); accSettle(t.dataset.p); };
}
/* 對帳：每一筆可以勾選要不要這次結清（有的先還、有的之後還），勾選的這幾筆可以選錢進出哪個帳戶；結清後畫面留著，剩下的可以再選別的帳戶結清 */
const SETTLE_VIA = ['LINE Pay', '台灣 Pay', '街口支付', '銀行轉帳', '現金面交', '其他'];
function alertBox(msg) { setTimeout(() => buzz(40), 60); return new Promise(res => { let done = false; const w = el(`<div class="shWrap center"><div class="shBg"></div><div class="dlg warn"><b class="dlgT">⚠️ 提醒</b><p></p><div class="row"><button class="btn pri" style="flex:1">知道了</button></div></div></div>`);
  $('p', w).textContent = msg; const me = {el: w, closed: false, close() { if (done) return; done = true; me.closed = true; const i = sheets.indexOf(me); if (i >= 0) sheets.splice(i, 1); w.classList.remove('on'); setTimeout(() => w.remove(), 220); res(); }};
  $('.shBg', w).onclick = () => me.close(); $('button', w).onclick = () => me.close(); document.body.append(w); w.offsetHeight; w.classList.add('on'); sheets.push(me); }); }
/* 結清的備註：日期、店家、欠款多少，合計和結算日期 */
function settleNote(st, L, u) { u = u || aWho(st.p); const T = st.amt;
  return [`${T >= 0 ? u.name + ' 還款' : '還給 ' + u.name}（${st.d.replace(/-/g, '/')} 結算）`].concat(L.map(r => `・${r.d.slice(5).replace('-', '/')} ${r.payee || accCat(r).n}　${money(Math.abs(accOwe(r, st.p)))}`)).concat([`合計：${money(Math.abs(T))}`]).join('\n'); }
/* 單獨把一筆改回未結清：從那次結清拿掉，還款金額跟著調整 */
function unsettleRec(r, p) {
  const st = DB.acc.settles.find(x => x.id === (r.settled || {})[p]); delete r.settled[p]; if (!st) { saveAcc(); return; }
  st.recs = st.recs.filter(id => id !== r.id); const L = st.recs.map(id => DB.acc.recs.find(x => x.id === id)).filter(Boolean); st.amt = r2(L.reduce((t, x) => t + accOwe(x, p), 0));
  const tr = DB.acc.recs.find(x => x.settle === st.id);
  if (!L.length) { DB.acc.settles = DB.acc.settles.filter(x => x !== st); DB.acc.recs = DB.acc.recs.filter(x => x !== tr); }
  else if (tr) { tr.amt = Math.abs(st.amt); tr.note = settleNote(st, L); }
  saveAcc();
}
function accSettle(p) {
  const u = aWho(p), pend = () => DB.acc.recs.filter(r => !(r.settled || {})[p] && accOwe(r, p)).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  if (!pend().length) { toast(`和 ${u.name} 沒有還沒結清的帳`); return; }
  let from = pend()[0].d, to = ymd(new Date()), open = new Set(), into = '', off = new Set(), via = '';
  const sh = sheet({title: `🤝 和 ${u.icon} ${u.name} 對帳`, full: true, foot: '<div class="stFoot"><button class="btn" data-a="copy">📋 複製</button><button class="btn" data-a="csv">📤 CSV</button><button class="btn pri" data-a="ok">✅ 結清</button></div>'});
  const list = () => pend().filter(r => r.d >= from && r.d <= to), picked = () => list().filter(r => !off.has(r.id));
  const sum = L => r2(L.reduce((s, r) => s + accOwe(r, p), 0));
  const draw = () => { const L = list(), P = picked(), T = sum(L), TP = sum(P), top = sh.body.scrollTop;
    if (!pend().length) { sh.body.innerHTML = `<div class="empty mealEmpty"><span class="big">🎉</span>和 ${esc(u.name)} 的帳都結清了</div>`; sh.foot.classList.add('hide'); return; }
    sh.body.innerHTML = `<div class="acStH ${T >= 0 ? 'pos' : 'neg'}"><small>${from.replace(/-/g, '/')} ～ ${to.replace(/-/g, '/')}・${L.length} 筆</small><b>${T >= 0 ? `${esc(u.name)} 欠我` : `我欠 ${esc(u.name)}`}</b><strong>${money(Math.abs(T))}</strong>${P.length !== L.length ? `<small>這次勾選 ${P.length} 筆：${TP >= 0 ? '他還我' : '我還他'} <b>${money(Math.abs(TP))}</b></small>` : ''}</div>
      <div class="acRow2"><button class="btn" data-a="from">從 ${from.replace(/-/g, '/')}</button><button class="btn" data-a="to">到 ${to.replace(/-/g, '/')}</button></div>
      <div class="row" style="gap:.4rem;margin:-.3rem 0 .5rem"><button class="btn sm" data-a="all">全選</button><button class="btn sm" data-a="none">全不選</button><span class="small muted grow" style="text-align:right">勾選這次要結清的</span></div>
      <div class="acStL card">${L.map(r => { const c = accCat(r), o = accOwe(r, p), on = !off.has(r.id), its = (r.items || []).filter(x => (x.ppl || []).includes(p) || (r.payer === p && (x.ppl || []).includes(accMe()))); return `<div class="acStR ${on ? '' : 'dim'}"><button class="acCk2 ${on ? 'on' : ''}" data-ck="${r.id}" aria-label="勾選"></button><span class="acStD">${r.d.slice(5).replace('-', '/')}</span><span class="grow" data-o="${r.id}"><b>${esc(c.i)} ${esc(r.payee || c.n)}</b><small>總額 ${money(r.amt)}・${r.payer === p ? esc(u.name) + ' 付' : '我付'}${its.length ? '・' + its.length + ' 個品項 ' + (open.has(r.id) ? '▴' : '▾') : ''}</small>
        ${open.has(r.id) && its.length ? `<span class="acStIt">${its.map(x => `<span>${esc(x.n)}<em>${money(x.amt / ((x.ppl || []).length || 1))}</em></span>`).join('')}</span>` : ''}</span><b class="${o >= 0 ? 'pos' : 'neg'}">${o >= 0 ? '' : '-'}${money(Math.abs(o))}</b></div>`; }).join('') || '<div class="empty">這段期間沒有紀錄</div>'}</div>
      <div class="lbl" style="margin-top:.8rem">勾選的這 ${P.length} 筆：${TP >= 0 ? '錢收進哪個帳戶' : '從哪個帳戶付給他'}<span class="req">必選</span></div>
      <div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'cash').map(x => `<button data-acct="${x.id}" class="${x.id === into ? 'on' : ''}">${aIco(x)} ${esc(x.n)}</button>`).join('')}<button data-a="addAcct" data-kind="bank" class="add">＋ 新增銀行</button></div>
      <div class="lbl">${TP >= 0 ? '對方怎麼付給我的' : '我怎麼付給他的'}（選填）</div><div class="acAccts">${SETTLE_VIA.map(v => `<button data-via="${v}" class="${v === via ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="small muted" style="margin-top:.6rem">結清後這幾筆就不會再算進欠款，剩下沒勾的會留著，可以之後再結清、或選別的帳戶。在「對帳紀錄」可以取消結清。</div>`;
    sh.body.scrollTop = top; };
  const text = () => { const L = picked(), T = sum(L); return [`🤝 ${u.name} 對帳（${from.replace(/-/g, '/')}～${to.replace(/-/g, '/')}）`, ''].concat(L.map(r => { const c = accCat(r), o = accOwe(r, p), its = (r.items || []).filter(x => (x.ppl || []).includes(p)); return `${r.d.slice(5).replace('-', '/')} ${r.payee || c.n}　${o >= 0 ? '' : '-'}${money(Math.abs(o))}` + (its.length ? '\n' + its.map(x => `　・${x.n} ${money(x.amt / ((x.ppl || []).length || 1))}`).join('\n') : ''); })).concat(['', T >= 0 ? `合計：${u.name} 欠我 ${money(T)}` : `合計：我欠 ${u.name} ${money(-T)}`]).join('\n'); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-o],[data-ck],[data-acct],[data-kind],[data-fund],[data-via]'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.via) { via = via === d.via ? '' : d.via; draw(); return; }
    if (d.ck) { if (off.has(d.ck)) off.delete(d.ck); else off.add(d.ck); draw(); return; }
    if (d.o) { if (open.has(d.o)) open.delete(d.o); else open.add(d.o); draw(); return; }
    if (d.acct) { into = d.acct; draw(); return; }
    if (d.kind && !d.a) { acctPickerHtml.k.into = d.kind; draw(); return; }
    if (d.a === 'addAcct') { const a = await newAcct(d.kind); if (a) { into = a.id; draw(); } return; }
    if (d.a === 'all') { off.clear(); draw(); return; } if (d.a === 'none') { list().forEach(r => off.add(r.id)); draw(); return; }
    if (d.a === 'from') { const k = await datePick(from); if (k) { from = k; draw(); } } else if (d.a === 'to') { const k = await datePick(to); if (k) { to = k; draw(); } } });
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); const a = b.dataset.a, L = picked(), T = sum(L);
    if (a === 'copy') copyText(text());
    else if (a === 'csv') { const rows = [['日期', '類別', '商家／對象', '總額', '誰付', '欠款', '品項']].concat(L.map(r => [r.d, accCat(r).n, r.payee || '', r.amt, r.payer === p ? u.name : '我', accOwe(r, p), (r.items || []).filter(x => (x.ppl || []).includes(p)).map(x => x.n + ' ' + r2(x.amt / ((x.ppl || []).length || 1))).join('；')])).concat([[], [T >= 0 ? `${u.name} 欠我` : `我欠 ${u.name}`, '', '', '', '', Math.abs(T)]]);
      await saveCsv(`對帳_${u.name}_${from}_${to}.csv`, rows); }
    else if (a === 'ok') { if (!L.length) { await alertBox('請先勾選要結清的紀錄'); return; } const ac = accAcct(into); if (!ac) { await alertBox(`請先選擇${T >= 0 ? '錢收進哪個帳戶' : '從哪個帳戶付給他'}（銀行或現金），一次結清只能選一個帳戶。`); return; }
      if (!await ask(`${T >= 0 ? `${u.name} 還我` : `我還 ${u.name}`} ${money(Math.abs(T))}（${L.length} 筆），${T >= 0 ? '收進' : '從'}「${ac.n}」${via ? '（' + via + '）' : ''}，標記為已結清？`, '結清')) return;
      const st = {id: 's' + uid(), p, d: ymd(new Date()), from: L[0].d, to: L[L.length - 1].d, amt: T, recs: L.map(r => r.id)}; DB.acc.settles.push(st); L.forEach(r => { r.settled = r.settled || {}; r.settled[p] = st.id; });
      if (Math.abs(T) > 0) { const now = new Date(), rr = {id: 'r' + uid(), d: st.d, t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), type: 'tr', amt: Math.abs(T), acct: T >= 0 ? '' : into, to: T >= 0 ? into : '', fee: 0, note: settleNote(st, L, u), via, settle: st.id}; DB.acc.recs.push(rr); st.rec = rr.id; }
      Acc.day = null; Acc.ym = null; saveAcc(); renderAcc(); buzz(40); off.clear(); into = ''; via = ''; toast(`✅ 已結清 ${L.length} 筆${pend().length ? `，還有 ${pend().length} 筆沒結清` : ''}`); draw(); } };
}
function accSettleLog() {
  const sh = sheet({title: '📜 對帳紀錄', full: true}), open = new Set(); const draw = () => { const L = DB.acc.settles.slice().reverse();
    sh.body.innerHTML = L.map(st => { const R = st.recs.map(id => DB.acc.recs.find(x => x.id === id)).filter(Boolean), tr = DB.acc.recs.find(x => x.settle === st.id);
      return `<div class="acLog card col"><div class="row" style="gap:.6rem;width:100%"><span class="acDI">${esc(aWho(st.p).icon)}</span><button class="grow acLogT" data-o="${st.id}"><b>${esc(aWho(st.p).name)}・${st.amt >= 0 ? '他還我' : '我還他'} ${money(Math.abs(st.amt))}</b><small>${st.d} 結清・${R.length} 筆${tr ? '・' + esc(acctName(tr.to || tr.acct)) : ''}${tr && tr.via ? '・' + esc(tr.via) : ''} ${open.has(st.id) ? '▴' : '▾'}</small></button><button class="btn sm" data-u="${st.id}">全部取消</button></div>
        ${open.has(st.id) ? `<div class="acLogL">${R.map(r => `<div class="acIt"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.payee || accCat(r).n)}</span><b>${money(Math.abs(accOwe(r, st.p)))}</b><button class="btn sm" data-x="${st.id}:${r.id}">改回未結清</button></div>`).join('')}</div>` : ''}</div>`; }).join('') || '<div class="empty">還沒有對帳紀錄</div>'; };
  draw(); sh.body.onclick = async e => { const t = e.target.closest('[data-u],[data-o],[data-x]'); if (!t) return; buzz(8);
    if (t.dataset.o) { if (open.has(t.dataset.o)) open.delete(t.dataset.o); else open.add(t.dataset.o); draw(); return; }
    if (t.dataset.x) { const [sid, rid] = t.dataset.x.split(':'), st = DB.acc.settles.find(x => x.id === sid), r = DB.acc.recs.find(x => x.id === rid); if (!st || !r) return; if (!await ask(`把「${r.payee || accCat(r).n}」改回未結清？這次結清的還款金額會跟著減少。`, '改回未結清')) return; unsettleRec(r, st.p); draw(); renderAcc(); toast('已改回未結清'); return; }
    if (!await ask('取消這次結清？這些紀錄會全部回到「未結清」，那筆還款也會刪除。', '取消結清', true)) return;
    const st = DB.acc.settles.find(x => x.id === t.dataset.u); DB.acc.recs.forEach(r => { if (r.settled && r.settled[st.p] === st.id) delete r.settled[st.p]; }); DB.acc.recs = DB.acc.recs.filter(r => r.settle !== st.id); DB.acc.settles = DB.acc.settles.filter(x => x !== st); saveAcc(); draw(); renderAcc(); };
}

/* ---------- 從分帳匯入 ---------- */
function accGuessCat(b) {
  const P = (DB.places || []).find(x => x.id === b.place), cn = P ? (DB.cats.find(c => c.id === P.cat) || {}).name || '' : '', py = DB.acc.payees.find(x => x.n === billStore(b));
  if (py && py.cat) return py.cat; let hit = ''; const find = n => { DB.acc.cats.out.forEach(p => (p.subs || []).forEach(s => { if (!hit && s.n === n) hit = s.id; })); return hit; };
  return find(cn) || (/超市|量販|全聯|家樂福|大全聯|好市多/.test(cn + billStore(b)) ? find('食材生鮮') : '') || (/超商|便利/.test(cn) ? find('日用品') : '') || (/外送|foodpanda|uber/i.test((b.way || '') + cn) ? find('晚餐') : '') || find('日用品') || firstCat('out');
}
/* 分帳明細 → 備註（日常「模板二」的寫法：每個人列自己的品項和小計；平台費、包材費、整單折扣照分帳方式分攤） */
function accNoteFromBill(b) {
  const c = billCalc(b), ids = pOrder(Object.keys(c.per)), out = [`🏪 ${billStore(b) || '購物明細'}${b.time ? ' ' + b.time : ''}`, `🛒 購物方式：${b.way || '實體店購物'}`, ''];
  if (ids.length) { const L = billBlock(b); out.push(...L.slice(1)); return out.join('\n').replace(/\n(小計：[^\n]+)\n(?!合計)/g, '\n$1\n\n'); }
  (b.items || []).forEach(x => { const unit = (numP(x.amt) - (c.itemDisc[x.id] || 0)) / (x.q || 1); out.push(`${tn(x.n)}${x.o ? '(' + x.o + ')' : ''}[${ntd(unit)}]×${x.q || 1}`); });
  (b.odisc || []).forEach(d => out.push(`${d.n}：-${ntd(d.amt)}`)); (b.fees || []).forEach(d => out.push(`${d.n}：${ntd(d.amt)}`)); out.push(`合計：${ntd(c.computed)}`); return out.join('\n');
}
function billToAccRec(b, k) {
  const c = billCalc(b), me = accMe(), tot = r2(c.total != null ? c.total : c.computed), per = c.per, ids = pOrder(Object.keys(per));
  let split = ids.map(p => ({p, amt: r2(per[p])})); const diff = r2(tot - split.reduce((s, x) => s + x.amt, 0)); if (split.length && Math.abs(diff) < 1) split[split.length - 1].amt = r2(split[split.length - 1].amt + diff);
  if (split.length === 1 && split[0].p === me) split = [];
  const items = (b.items || []).map(x => ({n: x.n, amt: r2(numP(x.amt) - (c.itemDisc[x.id] || 0)), ppl: (x.ppl || []).slice(), q: x.q || 1}));
  const note = accNoteFromBill(b);
  return {id: 'r' + uid(), d: k, t: b.time || '', type: 'out', amt: tot, cat: accGuessCat(b), acct: (DB.acc.accts[0] || {}).id || '', note, payee: billStore(b) || '', payer: me, split, items, imgs: [], src: {bill: b.id}};
}
function pickBillForAcc() {
  const all = []; Object.keys(DB.bills || {}).sort().reverse().forEach(k => DB.bills[k].forEach(b => all.push({k, b})));
  return new Promise(res => { let done = false; const sh = sheet({title: '📥 選一筆分帳明細', full: true, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = all.slice(0, 120).map(({k, b}, i) => `<button class="acImp card" data-i="${i}"><span class="grow"><b>${esc(billStore(b) || '購物明細')}</b><small>${dayLabel(k)}・${(b.items || []).length} 項${(b.imgs || []).length ? '・🖼️' + b.imgs.length : ''}${b.acc ? '・已匯入過' : ''}</small></span><b>${money(billCalc(b).total != null ? billCalc(b).total : billCalc(b).computed)}</b></button>`).join('') || '<div class="empty">分帳裡還沒有明細</div>';
    sh.body.onclick = e => { const t = e.target.closest('[data-i]'); if (!t) return; buzz(10); done = true; sh.close(); res(all[+t.dataset.i]); }; });
}
async function billToAcc(b) {
  const k = billKey(b), old = DB.acc.recs.find(r => r.src && r.src.bill === b.id);
  if (old) { toast('這筆明細已經匯入過了，不會重複匯入'); accEdit(old); return; }
  const x = billToAccRec(b, k); x.imgs = await copyImgs(b.imgs); const r = await accEdit(null, x); if (r) { b.acc = r.id; saveBills(); } else for (const id of x.imgs) if (!DB.acc.recs.some(rr => (rr.imgs || []).includes(id))) imgDel(id);
}
function accImportBills() {
  const done = new Set(DB.acc.recs.filter(r => r.src && r.src.bill).map(r => r.src.bill)), all = [];
  Object.keys(DB.bills || {}).sort().reverse().forEach(k => DB.bills[k].forEach(b => { if (!done.has(b.id)) all.push({k, b}); }));
  if (!all.length) { toast('分帳裡的明細都已經匯入過了，不會重複匯入'); return; }
  const sel = new Set();   /* 預設全不選 */
  const sh = sheet({title: '📥 從分帳匯入', full: true, foot: '<button class="btn" data-a="all">全選</button><button class="btn pri" data-a="ok">匯入</button>'});
  const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">勾選要匯入的購物明細（已經匯入過的不會出現）。每個人分到的金額、品項明細和圖片都會一起帶進來，付錢的人預設是「${esc(aWho(accMe()).name)}」。</div>` + all.map(({k, b}) => { const c = billCalc(b), ids = pOrder(Object.keys(c.per)); return `<button class="acImp card ${sel.has(b.id) ? 'on' : ''}" data-b="${b.id}"><span class="acCk"></span><span class="grow"><b>${esc(billStore(b) || '購物明細')}</b><small>${dayLabel(k)}・${(b.items || []).length} 項${(b.imgs || []).length ? '・🖼️' + b.imgs.length : ''}${ids.length ? '・' + ids.map(p => esc(aWho(p).name) + ' ' + money(c.per[p])).join('、') : ''}</small></span><b>${money(c.total != null ? c.total : c.computed)}</b></button>`; }).join('');
    sh.foot.querySelector('[data-a="ok"]').textContent = `匯入 ${sel.size} 筆`; };
  draw(); sh.body.onclick = e => { const t = e.target.closest('[data-b]'); if (!t) return; buzz(8); const id = t.dataset.b; if (sel.has(id)) sel.delete(id); else sel.add(id); draw(); };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10);
    if (b.dataset.a === 'all') { if (sel.size === all.length) sel.clear(); else all.forEach(x => sel.add(x.b.id)); draw(); return; }
    if (!sel.size) { toast('請先勾選'); return; } busy('匯入中…'); let n = 0;
    try { for (const {k, b: bb} of all) { if (!sel.has(bb.id) || DB.acc.recs.some(r => r.src && r.src.bill === bb.id)) continue; const r = billToAccRec(bb, k); r.imgs = await copyImgs(bb.imgs); DB.acc.recs.push(r); bb.acc = r.id; n++; } } finally { busy(false); }
    saveAcc(); saveBills(); sh.close(); renderAcc(); toast(`✅ 已匯入 ${n} 筆`); };
}

/* ---------- 搜尋 ---------- */
function accSearch() {
  let q = '', only = false; const sh = sheet({title: '🔍 搜尋記帳', full: true});
  sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="aq" type="search" placeholder="商家、備註、類別、金額、人名"></div><div class="whoRow" style="margin-bottom:.6rem"><button data-a="only">🤝 只看未結清</button></div><div id="aqS"></div><div id="aqL"></div>`;
  const draw = () => { const me = accMe(), L = DB.acc.recs.filter(r => { if (only && !(r.split || []).concat(r.payer && r.payer !== me ? [{p: r.payer}] : []).some(s => s.p !== me && !(r.settled || {})[s.p] && accOwe(r, s.p))) return false; if (!q) return true;
      const c = accCat(r), s = [c.n, c.pn, r.payee, r.note, String(r.amt), acctName(r.acct), ...(r.split || []).map(x => aWho(x.p).name), ...(r.items || []).map(x => x.n)].join(' ').toLowerCase(); return s.includes(q); }).sort(recSort);
    const o = L.reduce((s, r) => s + (r.type === 'out' ? accMine(r) : 0), 0), i = L.reduce((s, r) => s + (r.type === 'in' ? +r.amt || 0 : 0), 0);
    $('#aqS', sh.body).innerHTML = `<div class="acSum card sm"><div class="acT out"><small>支出</small><b>${money(o)}</b></div><div class="acT in"><small>收入</small><b>${money(i)}</b></div><div class="acT bal"><small>${L.length} 筆</small><b>${money(i - o)}</b></div></div>`;
    $('#aqL', sh.body).innerHTML = L.slice(0, 200).map(r => `<div class="acDay"><span>${dayLabel(r.d)}</span></div>` + accCard(r)).join('') || '<div class="empty">找不到符合的紀錄</div>'; $('[data-a="only"]', sh.body).classList.toggle('on', only); };
  draw(); $('#aq', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-a],[data-r]'); if (!t) return; buzz(8); if (t.dataset.a === 'only') { only = !only; draw(); } else if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r).then(() => draw()); } });
}

/* ---------- ② 資產 ---------- */
function renderAccAsset() {
  const box = $('#accABody'), M = v => Acc.showAmt ? money(v) : (v < 0 ? '-' : '') + '$ ••••'; if (!box || !DB.acc) return; accAutoPay();
  const A = DB.acc.accts.filter(a => a.kind !== 'pay').map(a => ({a, b: acctBal(a)})), pos = A.filter(x => x.a.kind !== 'card').reduce((s, x) => s + x.b, 0), neg = A.filter(x => x.a.kind === 'card').reduce((s, x) => s + Math.min(0, x.b), 0);
  const debts = accDebts(), lend = Object.values(debts).reduce((s, v) => s + (v > 0 ? v : 0), 0), borrow = Object.values(debts).reduce((s, v) => s + (v < 0 ? -v : 0), 0);
  $('#accASub').textContent = `${DB.acc.accts.length} 個帳戶・按住拖曳排序`; const eye = $('#accEye'); eye.classList.toggle('on', !!Acc.showAmt); eye.innerHTML = Acc.showAmt ? '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg><span>隱藏</span>' : '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg><span>顯示金額</span>';
  const nextPay = a => { const now = new Date(); let d = new Date(now.getFullYear(), now.getMonth(), Math.min(+a.payDay, 28)); if (DB.acc.autopay[a.id] === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` || d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(+a.payDay, 28)); return d; };
  const row = a => { const b = a.kind === 'pay' ? null : acctBal(a), sub = a.kind === 'card' ? (+a.payDay && a.payFrom ? `每月 ${a.payDay} 號由 ${esc(acctName(a.payFrom))} 自動還款・下次 ${(d => `${d.getMonth() + 1}/${d.getDate()}`)(nextPay(a))}` : '⚠️ 還沒設定還款日和扣款帳戶') : a.kind === 'pay' ? (a.fund ? `扣款：${esc(acctName(a.fund))}` : '⚠️ 還沒設定扣款帳戶') : '';
    return `<div class="asR card" data-ac="${a.id}"><span class="asI">${aIco(a)}</span><span class="grow"><b>${esc(a.n)}</b>${sub ? `<small>${sub}</small>` : ''}</span>${b == null ? '<span class="asPay">付款方式</span>' : `<b class="asV ${b < 0 ? 'neg' : ''}">${M(b)}</b>`}</div>`; };
  box.innerHTML = `<div class="asW"><div class="asNet card"><small>淨資產</small><strong>${M(pos + neg + lend - borrow)}</strong><div class="asNetG"><span><small>資產</small><b class="pos">${M(pos)}</b></span><span><small>負債（信用卡）</small><b class="neg">${M(-neg)}</b></span><span><small>別人欠我</small><b>${M(lend)}</b></span><span><small>我欠別人</small><b>${M(borrow)}</b></span></div></div>
    ${Object.entries(AK).map(([k, [n, i]]) => { const L = DB.acc.accts.filter(x => x.kind === k), s = k === 'pay' ? null : L.reduce((t, x) => t + acctBal(x), 0); return `<div class="asGrp" data-k="${k}"><div class="asGH"><b>${i} ${n}</b>${s == null ? '<span class="muted small">不計餘額</span>' : `<span class="${s < 0 ? 'neg' : ''}">${M(s)}</span>`}<button class="btn sm" data-a="add" data-kind="${k}">＋ 新增</button></div>
      ${L.map(row).join('') || `<div class="asEmpty">還沒有${n}帳戶</div>`}</div>`; }).join('')}
    <div class="small muted" style="margin-top:.4rem">餘額＝期初餘額＋收入－支出（只算我付的）±轉帳。行動支付是付款方式，實際從它綁定的銀行、信用卡或儲值帳戶扣款。信用卡設定還款日和扣款銀行後，到了還款日會自動記一筆轉帳。</div></div>`;
  sortable($('.asW', box), {item: '.asR', scope: '.asGrp', scroller: $('#pgAccA .pgBody'), onSort(f, t, scope) { const ids = $$('.asR', scope).map(e => e.dataset.ac), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv);
    const pos2 = DB.acc.accts.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => accAcct(id)); pos2.forEach((p, i) => { DB.acc.accts[p] = objs[i]; }); saveAcc(); renderAccAsset(); }});
}
async function accAssetClick(e) {
  const t = e.target.closest('[data-a],[data-ac]'); if (!t) return; buzz(8);
  if (t.dataset.a === 'add') { const a = await newAcct(t.dataset.kind); if (a) { renderAccAsset(); editAcct(a); } return; }
  if (t.dataset.ac) editAcct(accAcct(t.dataset.ac));
}
function editAcct(a) {
  if (!a) return; let kind = a.kind, pf = a.payFrom || '', fund = a.fund || '', ic = a.i, logo = a.logo || '';
  const sh = sheet({title: '編輯帳戶', full: true, foot: '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button><button class="btn pri" data-a="ok">儲存</button>'});
  const flows = DB.acc.recs.filter(r => acctFlow(r, a.id)).sort(recSort).slice(0, 120), payUse = DB.acc.recs.filter(r => r.acct === a.id).sort(recSort).slice(0, 60);
  const draw = () => { const cur = acctBal(a); sh.body.innerHTML = `<div class="niRow"><button class="niIc" data-a="ic">${aIco({i: ic, logo, kind})}<small>換圖示</small></button><div class="field grow" style="margin:0"><label>名稱</label><input id="eaN" value="${esc(a.n)}"></div></div>
    <div class="lbl">種類</div><div class="dkSeg acKind">${Object.entries(AK).map(([k, [n, i]]) => `<button data-k="${k}" class="${kind === k ? 'on' : ''}">${i} ${n}</button>`).join('')}</div>
    ${kind === 'pay' ? `<div class="lbl" style="margin-top:.8rem">綁定哪個帳戶扣款（記帳時預設從這裡扣）</div><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'card' || x.kind === 'stored').map(x => `<button data-fd="${x.id}" class="${fund === x.id ? 'on' : ''}">${aIco(x)} ${esc(x.n)}</button>`).join('') || '<span class="muted small">先新增銀行、信用卡或儲值帳戶</span>'}</div>`
      : `<div class="field" style="margin-top:.8rem"><label>目前餘額${kind === 'card' ? '（信用卡欠款請填負數，例如 -3500）' : ''}</label><input id="eaB" value="${cur}" inputmode="decimal"></div>`}
    ${kind === 'card' ? `<div class="field"><label>每月幾號還款（1～28）</label><input id="eaD" value="${a.payDay || ''}" inputmode="numeric" placeholder="例如 5"></div><div class="lbl">從哪個帳戶自動扣款還款</div><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank').map(x => `<button data-pf="${x.id}" class="${pf === x.id ? 'on' : ''}">${aIco(x)} ${esc(x.n)}</button>`).join('') || '<span class="muted small">先在「銀行」新增帳戶</span>'}</div>` : ''}
    <div class="lbl" style="margin-top:1rem">${kind === 'pay' ? '用這個付款方式的紀錄' : '收支明細'}</div><div class="card" style="padding:.2rem .7rem">${(kind === 'pay' ? payUse.map(r => `<div class="acIt"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.payee || String(r.note || '').split('\n')[0] || accCat(r).n)}</span><b class="neg">${money(r.amt)}</b></div>`) : flows.map(r => { const v = acctFlow(r, a.id); return `<div class="acIt"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.payee || String(r.note || '').split('\n')[0] || accCat(r).n)}</span><b class="${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${money(v)}</b></div>`; })).join('') || '<div class="empty" style="padding:.8rem">還沒有紀錄</div>'}</div>`; };
  draw();
  const keepN = () => { const n = $('#eaN', sh.body); if (n) a._n = n.value; const bb = $('#eaB', sh.body); if (bb) a._b = bb.value; const dd = $('#eaD', sh.body); if (dd) a._d = dd.value; };
  sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); keepN();
    if (t.dataset.a === 'ic') { const v = await iconPick(ic, 'fin'); if (v) { ic = v; logo = ''; } }
    else if (t.dataset.k) kind = t.dataset.k; else if (t.dataset.pf) pf = t.dataset.pf; else if (t.dataset.fd) fund = t.dataset.fd; else return;
    draw(); if (a._n != null) $('#eaN', sh.body).value = a._n; if (a._b != null && $('#eaB', sh.body)) $('#eaB', sh.body).value = a._b; if (a._d != null && $('#eaD', sh.body)) $('#eaD', sh.body).value = a._d; };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); keepN(); delete a._n; delete a._b; delete a._d;
    if (b.dataset.a === 'del') { const used = DB.acc.recs.some(r => r.acct === a.id || r.to === a.id); if (!await ask(used ? `「${a.n}」已經有記帳紀錄，刪除帳戶後那些紀錄會變成沒有帳戶，確定嗎？` : `刪除「${a.n}」？`, '刪除', true)) return; DB.acc.accts = DB.acc.accts.filter(x => x !== a); saveAcc(); sh.close(); renderAccAsset(); return; }
    const nm = $('#eaN', sh.body).value.trim(); if (!nm) { toast('請輸入名稱'); return; } a.n = nm.slice(0, 16); a.i = ic || AK[kind][1]; a.logo = logo; a.kind = kind;
    if (kind === 'pay') { a.fund = fund; a.bal0 = 0; } else { const want = parseFloat(String($('#eaB', sh.body).value).replace(/[^\d.\-]/g, '')); if (!isNaN(want)) a.bal0 = r2((+a.bal0 || 0) + want - acctBal(a)); }
    if (kind === 'card') { a.payDay = Math.max(0, Math.min(28, parseInt($('#eaD', sh.body).value) || 0)); a.payFrom = pf; }
    saveAcc(); sh.close(); renderAccAsset(); toast('✅ 已儲存'); };
}

/* ---------- ③ 消費分析 ---------- */
const PAL = ['#b5653a', '#6f7d3c', '#c08a3e', '#8a6a4a', '#5d7f86', '#a8472f', '#9a8a3a', '#7a5c8a', '#4f7a5a', '#b58a6a', '#6a6a6a', '#c27a5a'];
function renderAccStat() {
  const box = $('#accSBody'); if (!box || !DB.acc) return; const now = new Date(); if (!Acc.sym) Acc.sym = [now.getFullYear(), now.getMonth()];
  const [Y, Mo] = Acc.sym, pre = `${Y}-${String(Mo + 1).padStart(2, '0')}`, pv = new Date(Y, Mo - 1, 1), ppre = `${pv.getFullYear()}-${String(pv.getMonth() + 1).padStart(2, '0')}`;
  const mon = DB.acc.recs.filter(r => r.d && r.d.startsWith(pre) && r.type === 'out'), tot = mon.reduce((s, r) => s + accMine(r), 0), last = DB.acc.recs.filter(r => r.d && r.d.startsWith(ppre) && r.type === 'out').reduce((s, r) => s + accMine(r), 0);
  const byP = {}; mon.forEach(r => { const f = catFind('out', r.cat), k = f.p ? f.p.id : '_'; const g = byP[k] = byP[k] || {p: f.p || {n: '其他', i: '📦'}, v: 0, subs: {}}; const v = accMine(r); g.v += v; const sk = f.s ? f.s.id : '_'; const sg = g.subs[sk] = g.subs[sk] || {s: f.s || {n: g.p.n, i: g.p.i}, v: 0}; sg.v += v; });
  const G = Object.values(byP).filter(g => g.v > 0).sort((a, b) => b.v - a.v);
  /* 圓餅圖 */
  let ang = -Math.PI / 2; const R = 70, r0 = 44, cx = 90, cy = 90; const arcs = G.map((g, i) => { const a = g.v / (tot || 1) * Math.PI * 2, a2 = ang + a, big = a > Math.PI ? 1 : 0, P = (an, rr) => [cx + rr * Math.cos(an), cy + rr * Math.sin(an)].map(n => n.toFixed(2)).join(' ');
    const d = G.length === 1 ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - .01} ${cy - R} L ${cx - .01} ${cy - r0} A ${r0} ${r0} 0 1 0 ${cx} ${cy - r0} Z` : `M ${P(ang, R)} A ${R} ${R} 0 ${big} 1 ${P(a2, R)} L ${P(a2, r0)} A ${r0} ${r0} 0 ${big} 0 ${P(ang, r0)} Z`; ang = a2; return `<path d="${d}" fill="${PAL[i % PAL.length]}" stroke="var(--surface)" stroke-width="1.5"/>`; }).join('');
  /* 近 6 個月 */
  const M6 = []; for (let i = 5; i >= 0; i--) { const d = new Date(Y, Mo - i, 1), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, L = DB.acc.recs.filter(r => r.d && r.d.startsWith(k)); M6.push({m: d.getMonth() + 1, o: L.reduce((s, r) => s + (r.type === 'out' ? accMine(r) : 0), 0), n: L.reduce((s, r) => s + (r.type === 'in' ? +r.amt || 0 : 0), 0)}); }
  const mx = Math.max(1, ...M6.map(x => Math.max(x.o, x.n)));
  /* 每日 */
  const nd = new Date(Y, Mo + 1, 0).getDate(), D = []; for (let d = 1; d <= nd; d++) { const k = `${pre}-${String(d).padStart(2, '0')}`; D.push(mon.filter(r => r.d === k).reduce((s, r) => s + accMine(r), 0)); } const dmx = Math.max(1, ...D);
  /* 非必要 */
  const isOpt = r => { const f = catFind('out', r.cat); return f.s ? !!f.s.opt : f.p ? !!f.p.opt : false; }, optL = mon.filter(isOpt), opt = optL.reduce((s, r) => s + accMine(r), 0);
  const topOpt = optL.slice().sort((a, b) => accMine(b) - accMine(a)).slice(0, 5);
  const byPy = {}; mon.forEach(r => { if (r.payee) byPy[r.payee] = (byPy[r.payee] || 0) + accMine(r); }); const PY = Object.entries(byPy).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const chg = last ? (tot - last) / last * 100 : 0;
  box.innerHTML = `<div class="stTop">${calHead(Y, Mo)}</div>
    <div class="stHead card"><div><small>${Mo + 1} 月支出（只算我的部分）</small><strong>${money(tot)}</strong></div><span class="stChg ${chg > 0 ? 'neg' : 'pos'}">${last ? `比上個月 ${chg > 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(0)}%` : '上個月沒有資料'}</span></div>
    ${G.length ? `<div class="stPie card"><svg viewBox="0 0 180 180" class="stSvg">${arcs}<text x="90" y="86" text-anchor="middle" class="stC1">支出</text><text x="90" y="104" text-anchor="middle" class="stC2">${money(tot)}</text></svg>
      <div class="stLeg">${G.map((g, i) => `<button class="stL" data-sp="${g.p.id || '_'}"><i style="background:${PAL[i % PAL.length]}"></i><span class="grow">${esc(g.p.i)} ${esc(g.p.n)}</span><b>${money(g.v)}</b><em>${(g.v / tot * 100).toFixed(0)}%</em></button>
        ${Acc.statOpen === (g.p.id || '_') ? `<div class="stSubs">${Object.values(g.subs).sort((a, b) => b.v - a.v).map(s => `<div><span class="grow">${esc(s.s.i || '')} ${esc(s.s.n)}</span><b>${money(s.v)}</b><span class="stBar"><i style="width:${(s.v / g.v * 100).toFixed(1)}%;background:${PAL[i % PAL.length]}"></i></span></div>`).join('')}</div>` : ''}`).join('')}</div></div>` : '<div class="empty mealEmpty"><span class="big">📊</span>這個月還沒有支出紀錄</div>'}
    <div class="stCard card"><div class="stH"><b>🧭 必要／非必要消費</b><button class="btn sm" data-a="optCfg">設定哪些是非必要</button></div>
      <div class="stOpt"><div class="stOptBar"><i style="width:${tot ? (100 - opt / tot * 100).toFixed(1) : 100}%"></i></div><div class="stOptL"><span><i class="ess"></i>必要 <b>${money(tot - opt)}</b></span><span><i class="opt"></i>非必要 <b>${money(opt)}</b>（${tot ? (opt / tot * 100).toFixed(0) : 0}%）</span></div></div>
      ${topOpt.length ? `<div class="lbl">最大筆的非必要消費</div>${topOpt.map(r => `<div class="acIt" data-r="${r.id}"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(accCat(r).i)} ${esc(r.payee || accCat(r).n)}</span><b class="neg">${money(accMine(r))}</b></div>`).join('')}
        <div class="stTip">💡 如果非必要消費少一半，這個月可以多存 <b>${money(opt / 2)}</b>${opt / (tot || 1) > .3 ? '；非必要已經超過三成，可以先從最大的幾筆開始減少。' : '。'}</div>` : '<div class="small muted">這個月沒有非必要消費 👍</div>'}</div>
    ${(() => { const LL = DB.acc.recs.filter(r => r.type === 'loss'), lm = LL.filter(r => r.d.startsWith(pre)), ly = LL.filter(r => r.d.startsWith(String(Y))); if (!LL.length) return ''; const byA = {}; lm.forEach(r => { const k = acctName(r.acct) || '未指定'; byA[k] = (byA[k] || 0) + (+r.amt || 0); });
      return `<div class="stCard card"><div class="stH"><b>💸 金額遺失</b></div><div class="stLossG"><span><small>${Mo + 1} 月</small><b class="neg">${money(lm.reduce((t, r) => t + (+r.amt || 0), 0))}</b></span><span><small>${Y} 年</small><b class="neg">${money(ly.reduce((t, r) => t + (+r.amt || 0), 0))}</b></span><span><small>全部</small><b class="neg">${money(LL.reduce((t, r) => t + (+r.amt || 0), 0))}</b></span></div>
        ${Object.keys(byA).length ? Object.entries(byA).map(([k, v]) => `<div class="acIt"><span class="grow">${esc(k)}</span><b class="neg">${money(v)}</b></div>`).join('') : '<div class="small muted">這個月沒有遺失 👍</div>'}
        ${lm.map(r => `<div class="acIt" data-r="${r.id}"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.note ? String(r.note).split('\n')[0] : '金額遺失')}</span><small>${esc(acctName(r.acct))}</small><b class="neg">${money(r.amt)}</b></div>`).join('')}</div>`; })()}
    <div class="stCard card"><div class="stH"><b>📅 每天支出</b></div><div class="stDays">${D.map((v, i) => `<span title="${i + 1}日 ${money(v)}"><i style="height:${(v / dmx * 100).toFixed(1)}%"></i></span>`).join('')}</div><div class="stDayX"><span>1</span><span>${Math.ceil(nd / 2)}</span><span>${nd}</span></div><div class="small muted">平均每天 ${money(tot / nd)}・最高 ${money(dmx === 1 && !D.some(Boolean) ? 0 : dmx)}</div></div>
    <div class="stCard card"><div class="stH"><b>📈 近 6 個月</b><span class="stKey"><i class="o"></i>支出 <i class="n"></i>收入</span></div><div class="stMon">${M6.map(x => `<div><span class="stMB"><i class="o" style="height:${(x.o / mx * 100).toFixed(1)}%"></i><i class="n" style="height:${(x.n / mx * 100).toFixed(1)}%"></i></span><small>${x.m}月</small></div>`).join('')}</div></div>
    ${PY.length ? `<div class="stCard card"><div class="stH"><b>🏪 最常花錢的地方</b></div>${PY.map(([n, v]) => `<div class="stPy"><span class="grow">${esc(n)}</span><b>${money(v)}</b><span class="stBar"><i style="width:${(v / PY[0][1] * 100).toFixed(1)}%"></i></span></div>`).join('')}</div>` : ''}`;
  $('#accSSub').textContent = `${Y}年${Mo + 1}月`;
}
async function accStatClick(e) {
  const t = e.target.closest('[data-a],[data-sp],[data-r]'); if (!t) return; buzz(8); const a = t.dataset.a, [Y, Mo] = Acc.sym;
  if (t.dataset.sp) { Acc.statOpen = Acc.statOpen === t.dataset.sp ? '' : t.dataset.sp; renderAccStat(); return; }
  if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r).then(renderAccStat); return; }
  if (a === 'pm' || a === 'nm') { const d = new Date(Y, Mo + (a === 'pm' ? -1 : 1), 1); Acc.sym = [d.getFullYear(), d.getMonth()]; renderAccStat(); }
  else if (a === 'ymY' || a === 'ymM') { const r = await ymPick(Y, Mo, a === 'ymY' ? 'y' : 'm'); if (r) { Acc.sym = r; renderAccStat(); } }
  else if (a === 'optCfg') optCfg();
}
function optCfg() {
  const sh = sheet({title: '🧭 哪些算非必要消費？', full: true}); const draw = () => sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">點一下切換：亮起來的是「非必要」（想要而不是需要的花費），分析頁會幫你算比例。</div>` + DB.acc.cats.out.map(p => `<div class="lbl">${esc(p.i)} ${esc(p.n)}</div><div class="acCfgL">${(p.subs || []).map(s => `<button data-o="${s.id}" class="${s.opt ? 'on' : ''}">${esc(s.i || '')} ${esc(s.n)}</button>`).join('')}</div>`).join('');
  draw(); sh.body.onclick = e => { const t = e.target.closest('[data-o]'); if (!t) return; buzz(8); const f = catFind('out', t.dataset.o); if (f.s) { f.s.opt = f.s.opt ? 0 : 1; saveAcc(); draw(); renderAccStat(); } };
}

/* ---------- ④ 設定 ---------- */
function gwManual() { const sh = sheet({title: '🖥️ 電腦版雲端硬碟'}); sh.body.innerHTML = `<p style="color:var(--muted);font-size:.85rem;line-height:1.6;margin:0 0 .7rem">自動上傳不能用時，改開電腦版的雲端硬碟網頁，可以用手指放大縮小。</p>
  <button class="card setR" data-m="up" style="width:100%;text-align:left;margin-bottom:.5rem"><span class="gRi">⬆️</span><div class="t"><b>上傳備份</b><small>按左上角「＋ 新增 → 檔案上傳」，備份檔會自動選好</small></div><span class="chev">›</span></button>
  <button class="card setR" data-m="down" style="width:100%;text-align:left"><span class="gRi">⬇️</span><div class="t"><b>下載備份還原</b><small>找到備份檔，按「⋮ → 下載」就會自動還原</small></div><span class="chev">›</span></button>`;
  sh.body.onclick = e => { const t = e.target.closest('[data-m]'); if (!t) return; buzz(8); sh.close(); gDriveWeb(t.dataset.m, true); }; }
/* ---------- 記帳區的店家地圖：只顯示店名、地址、位置和消費紀錄；跟日日帳本的地圖分開，只共用店名 ----------
   位置來源：日日帳本地圖上的收藏（同名就算連結）＞ 在記帳這邊自己釘選的位置 DB.acc.locs[店名] */
const AM = {map: null, marks: [], q: '', f: 'all', area: null, sel: '', fold: {}, tw: new Map()};
function storeLoc(n) { n = String(n || '').trim(); if (!n) return null; const p = (DB.places || []).find(x => x.name === n && x.lat != null);
  if (p) return {lat: p.lat, lon: p.lon, addr: p.addr || '', fav: true, pid: p.id}; const l = (DB.acc.locs || {})[n]; return l ? Object.assign({own: true}, l) : null; }
/* 記帳的消費統計（依店名） */
function accStoreStats() { const m = {}; DB.acc.recs.forEach(r => { const n = (r.payee || '').trim(); if (!n || r.type === 'tr') return; const o = m[n] = m[n] || {cnt: 0, sum: 0, last: ''}; o.cnt++; o.sum += r.type === 'out' || r.type === 'loss' ? accMine(r) : 0; if (r.d > o.last) o.last = r.d; }); return m; }
/* 地圖上的店：日日帳本所有收藏 ＋ 記帳裡出現過、但不在收藏裡的店（台電這類只用在記帳的不算） */
function accStores() { const A = DB.acc, st = accStoreStats(), out = [], seen = new Set();
  (DB.places || []).forEach(p => { if (seen.has(p.name)) return; seen.add(p.name); out.push({n: p.name, place: p, cat: p.cat || '', loc: p.lat != null ? {lat: p.lat, lon: p.lon, addr: p.addr || '', fav: true} : null, st: st[p.name]}); });
  const add = n => { n = (n || '').trim(); if (!n || seen.has(n) || isPcatPayee(n)) return; seen.add(n); const l = (A.locs || {})[n]; out.push({n, cat: '_acc', loc: l ? Object.assign({own: true}, l) : null, st: st[n]}); };
  A.recs.forEach(r => { if (r.type !== 'tr') add(r.payee); }); A.payees.forEach(y => { if (isShopG(y.g)) add(y.n); });
  return out; }
function amTown(o) { if (!o.loc || !TW.ready) return null; const k = o.loc.lat + ',' + o.loc.lon; let t = AM.tw.get(k); if (t === undefined) { const tw = TW.townAt(o.loc.lon, o.loc.lat); t = tw ? {c: tw.county, t: tw.name} : null; AM.tw.set(k, t); } return t; }
const amInArea = o => { const a = AM.area; if (!a) return true; const t = amTown(o); return !!t && t.c === a.c && (!a.t || t.t === a.t); };
const amCat = id => id === '_acc' ? {id, name: '記帳店家', icon: '📒', color: '#8a6d4b'} : catOf(id);
async function renderAccMap() {
  TW.init(); const all = accStores(), q = AM.q.toLowerCase();
  const inQ = o => !q || o.n.toLowerCase().includes(q) || (o.loc && (o.loc.addr || '').toLowerCase().includes(q));
  const base = all.filter(o => amInArea(o) && inQ(o)), cnt = k => base.filter(o => k === 'all' || o.cat === k).length;
  if (AM.f !== 'all' && !cnt(AM.f)) AM.f = 'all';
  const V = base.filter(o => AM.f === 'all' || o.cat === AM.f), pinned = all.filter(o => o.loc).length;
  $('#accMSub').textContent = `${all.length} 間店・${pinned} 間在地圖上`;
  const cats = DB.cats.map(c => c.id).concat(['', '_acc']).filter(k => cnt(k));
  const towns = AM.area && TW.counties[AM.area.c] ? TW.counties[AM.area.c].towns : [];
  $('#accMList').innerHTML = `<div class="amChips">${[['all', '🗺️ 全部', '']].concat(cats.map(k => { const c = amCat(k); return [k, `${c.icon} ${c.name}`, c.color]; })).map(([k, t, c]) => `<button class="chip ${AM.f === k ? 'on' : ''}" data-f="${k}" ${c ? `style="--c:${c}"` : ''}>${esc(t)} <span class="n">${cnt(k)}</span></button>`).join('')}</div>
    ${TW.ready ? `<div class="amArea"><select id="amC"><option value="">全部縣市</option>${TW.names.map(n => `<option ${AM.area && AM.area.c === n ? 'selected' : ''}>${n}</option>`).join('')}</select><select id="amT" ${AM.area ? '' : 'disabled'}><option value="">全部鄉鎮市區</option>${towns.map(t => `<option ${AM.area && AM.area.t === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}</select>${AM.area ? '<button class="ic" data-a="arX" aria-label="取消區域">✕</button>' : ''}</div>` : ''}
    <div class="searchBox amQ"><input id="amQ" type="search" placeholder="搜尋店名或地址" value="${esc(AM.q)}"></div>
    ${(AM.f === 'all' ? cats : [AM.f]).map(k => { const c = amCat(k), L = V.filter(o => o.cat === k).sort((a, b) => ((b.st || {}).last || '').localeCompare((a.st || {}).last || '') || a.n.localeCompare(b.n, 'zh-Hant')); if (!L.length) return '';
      const fd = AM.fold[k] && AM.f === 'all';
      return `<div class="amSec ${fd ? 'fold' : ''}"><button class="amSecH" data-fold="${k}" style="--c:${c.color}"><span>${esc(c.icon)}</span><b>${esc(c.name)}</b><em>${L.length}</em>${AM.f === 'all' ? `<i>${fd ? '▸' : '▾'}</i>` : ''}</button>
        ${fd ? '' : L.map(o => `<button class="amR card ${AM.sel === o.n ? 'sel' : ''}" data-st="${esc(o.n)}"><span class="amPinI ${o.loc ? 'on' : ''}">${o.loc ? '📍' : '📌'}</span><span class="grow"><b>${esc(o.n)}</b><small>${o.loc ? esc(o.loc.addr || '已釘選位置') : '還沒有位置'}</small><small>${o.st ? `記帳 ${o.st.cnt} 筆・${money(o.st.sum)}・最近 ${o.st.last.slice(5).replace('-', '/')}` : '還沒有記帳紀錄'}</small></span>${o.loc ? '<span class="chev">›</span>' : `<span class="btn sm" data-pin="${esc(o.n)}">📍 釘選</span>`}</button>`).join('')}</div>`; }).join('') || '<div class="empty">沒有符合的店家</div>'}`;
  const inp = $('#amQ'); inp.oninput = debounce(() => { AM.q = inp.value.trim(); const pos = inp.selectionStart; renderAccMap().then(() => { const n = $('#amQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }); }, 300);
  const cs = $('#amC'), ts = $('#amT'); if (cs) { cs.onchange = () => { AM.area = cs.value ? {c: cs.value, t: ''} : null; AM.fit = true; buzz(10); renderAccMap(); }; ts.onchange = () => { AM.area = cs.value ? {c: cs.value, t: ts.value} : null; AM.fit = true; buzz(10); renderAccMap(); }; }
  await accMapInit(); accMapMarks(V);
}
function initAccMap() {
  $('#accMList').addEventListener('click', async e => { const t = e.target.closest('[data-f],[data-fold],[data-pin],[data-st],[data-a]'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.f != null) { AM.f = d.f; AM.fit = true; renderAccMap(); return; }
    if (d.a === 'arX') { AM.area = null; AM.fit = true; renderAccMap(); return; }
    if (d.fold != null) { AM.fold[d.fold] = !AM.fold[d.fold]; renderAccMap(); return; }
    if (d.pin) { e.stopPropagation(); if (await accPinStore(d.pin)) { AM.sel = d.pin; renderAccMap(); } return; }
    if (d.st) accMapSelect(d.st, true); });
}
async function accMapInit() {
  if (AM.map || !window.maplibregl) { if (AM.map) AM.map.resize(); return; }
  try { const st = await mapStyle(), v = S.view || {c: [120.96, 23.75], z: 6.6};
    AM.map = new maplibregl.Map({container: 'accMap', style: st, center: v.c, zoom: Math.min(v.z, 12), attributionControl: false, dragRotate: false, pitchWithRotate: false, localIdeographFontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif', fadeDuration: 0});
    AM.map.on('error', () => {}); AM.fit = true;
  } catch (e) { $('#accMap').innerHTML = '<div class="empty">這台裝置不支援地圖</div>'; }
}
function accMapMarks(L) { if (!AM.map) return; AM.marks.forEach(m => m.remove()); AM.marks = [];
  const P = L.filter(o => o.loc); P.forEach(o => { const c = amCat(o.cat), e = el(`<button class="amPin ${AM.sel === o.n ? 'sel' : ''}" style="--c:${c.color}"><span><i>${esc(c.icon)}</i></span><b>${esc(o.n)}</b></button>`);
    e.onclick = ev => { ev.stopPropagation(); buzz(10); accMapSelect(o.n, false); };
    const mk = new maplibregl.Marker({element: e, anchor: 'bottom'}).setLngLat([o.loc.lon, o.loc.lat]).addTo(AM.map); mk._n = o.n; AM.marks.push(mk); });
  if (AM.fit && P.length) { AM.fit = false; const bb = new maplibregl.LngLatBounds(); P.forEach(o => bb.extend([o.loc.lon, o.loc.lat])); setTimeout(() => { try { AM.map.resize(); AM.map.fitBounds(bb, {padding: 50, maxZoom: 15, duration: 500}); } catch (e) {} }, 60); } }
/* 選一間店：地圖上標出來（標籤放大），再打開店家卡片 */
function accMapSelect(n, fly) { AM.sel = n; AM.marks.forEach(m => m.getElement().classList.toggle('sel', m._n === n)); $$('#accMList .amR').forEach(r => r.classList.toggle('sel', r.dataset.st === n));
  const lc = storeLoc(n); if (lc && AM.map && fly !== false) { $('#pgAccM .pgBody').scrollTo({top: 0, behavior: 'smooth'}); AM.map.flyTo({center: [lc.lon, lc.lat], zoom: Math.max(AM.map.getZoom(), 16), duration: 650}); }
  accStoreCard(n); }
/* 從其他地方（例如商家名單）跳到記帳的地圖，標出這間店 */
function accMapFocus(n) { while (sheets.length) sheets[sheets.length - 1].close(); AM.f = 'all'; AM.q = ''; AM.area = null; AM.sel = n;
  if (!S.inAcc) enterAcc('AccM'); else showTab('AccM'); setTimeout(() => accMapSelect(n, true), 350); }
/* 一間店：店名、地址、位置、記帳明細；可以改店名（同步到所有區） */
function accStoreCard(n) {
  const sh = sheet({title: '🏪 ' + n, foot: `<button class="btn" data-a="ren">✎ 改店名</button><button class="btn" data-a="pin">📍 ${storeLoc(n) ? '更改位置' : '釘選位置'}</button>`});
  const draw = () => { const lc = storeLoc(n), R = DB.acc.recs.filter(r => (r.payee || '').trim() === n && r.type !== 'tr').sort((a, b) => (b.d + (b.t || '')).localeCompare(a.d + (a.t || ''))), sum = R.reduce((t, r) => t + (r.type === 'out' || r.type === 'loss' ? accMine(r) : 0), 0);
    const P = (DB.places || []).find(x => x.name === n), tw = lc ? amTown({loc: lc}) : null;
    sh.el.querySelector('.shH b, .shT, h2') && (sh.el.querySelector('.shH b, .shT, h2').textContent = '🏪 ' + n);
    sh.body.innerHTML = `<div class="amInfo card"><div><b>📍 地址</b><span>${lc ? esc(lc.addr || '（沒有地址）') : '還沒有位置'}</span></div>${tw ? `<div><b>🏙️ 地區</b><span>${esc(tw.c + ' ' + tw.t)}</span></div>` : ''}<div><b>🗂️ 分類</b><span>${P ? esc(catOf(P.cat).icon + ' ' + catOf(P.cat).name) + '（日日帳本收藏）' : lc ? '記帳店家（在記帳這邊釘選）' : '記帳店家'}</span></div><div><b>🧾 記帳</b><span>${R.length} 筆・我的支出 ${money(sum)}</span></div>${lc && lc.own ? '<div><b></b><span><button class="lnk" data-a="unpin">取消釘選</button></span></div>' : ''}</div>
      <div class="lbl">記帳明細</div>${R.map(accCard).join('') || '<div class="empty">還沒有記帳紀錄</div>'}`; };
  draw();
  sh.body.onclick = async e => { const t = e.target.closest('[data-a],[data-r]'); if (!t) return; buzz(8);
    if (t.dataset.a === 'unpin') { if (!await ask(`取消「${n}」在地圖上的位置？`, '取消釘選', true)) return; delete DB.acc.locs[n]; saveAcc(); sh.close(); renderAccMap(); return; }
    if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) { await accEdit(r); draw(); renderAccMap(); } } };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10);
    if (b.dataset.a === 'pin') { if (await accPinStore(n)) { sh.close(); renderAccMap(); } return; }
    if (b.dataset.a === 'ren') { const nv = ((await askText('店家名稱（會同步到地圖、日常、分帳、發票、記帳）', n)) || '').trim(); if (!nv || nv === n) return;
      const P = (DB.places || []).find(x => x.name === n), c = storeRefs(n), onlyAcc = !c.map && !c.meal && !c.list && !c.bill && !c.inv;
      if (P) { P.name = nv; await savePlace(P); (DB.places || []).forEach(x => { if (x !== P && x.name === n) { x.name = nv; savePlace(x); } }); await renameStoreAsk(n, nv); refreshAll(); }
      else if (onlyAcc) await renameStoreAll(n, nv); else await renameStoreAsk(n, nv);
      AM.sel = nv; sh.close(); renderAccMap(); setTimeout(() => accMapSelect(nv, false), 200); toast('✅ 已改名'); } }; }
/* 幫店家在地圖上釘選位置：優先用 Google 地圖搜尋，沒有金鑰就用 OpenStreetMap */
function accPinStore(n) {
  return new Promise(res => { let done = false, R = []; const sh = sheet({title: '📍 釘選「' + n + '」的位置', full: true, onClose() { if (!done) res(false); }});
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.5rem"><input id="apQ" type="search" value="${esc(n)}" placeholder="店名或地址"></div><button class="btn block pri" data-a="go" style="border-radius:6px;margin-bottom:.4rem">🔍 用 ${S.gkey ? 'Google 地圖' : 'OpenStreetMap'} 搜尋</button>
      ${S.gkey ? '' : '<div class="small muted" style="margin-bottom:.5rem">填入 Google Maps 金鑰後就能用 Google 地圖的方式搜尋（設定 → 地圖）。</div>'}<div id="apR"></div>`;
    const go = async () => { const q = $('#apQ', sh.body).value.trim(); if (q.length < 2) return; const box = $('#apR', sh.body); box.innerHTML = '<div class="empty">搜尋中…</div>';
      try { const c = AM.map ? [AM.map.getCenter().lat, AM.map.getCenter().lng] : (S.view ? [S.view.c[1], S.view.c[0]] : null); R = S.gkey ? await gPlaces(q, c) : await nomSearch(q, c);
        box.innerHTML = R.map((r, i) => `<button class="res card" data-i="${i}"><span class="rIc">📍</span><span class="grow"><b>${esc(r.name)}</b><small>${r.tag ? esc(r.tag) + ' · ' : ''}${esc(r.addr || '')}</small></span></button>`).join('') || '<div class="empty">找不到，換個關鍵字試試（例如加上地區）</div>';
      } catch (er) { box.innerHTML = `<div class="empty">❌ ${esc(er.message)}</div>`; } };
    $('#apQ', sh.body).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    sh.body.onclick = e => { const t = e.target.closest('[data-a],[data-i]'); if (!t) return; buzz(8); if (t.dataset.a === 'go') { go(); return; }
      const r = R[+t.dataset.i]; if (!r) return; DB.acc.locs = DB.acc.locs || {}; DB.acc.locs[n] = {lat: r.lat, lon: r.lon, addr: r.addr || '', gid: r.gid || '', gname: r.name}; saveAcc(); AM.fit = false;
      done = true; sh.close(); toast('📍 已釘選'); buzz(25); res(true); if (AM.map) setTimeout(() => AM.map.flyTo({center: [r.lon, r.lat], zoom: 16, duration: 600}), 300); };
    setTimeout(go, 50); });
}

/* ---------- 店家名稱同步：在任何一區改店名，地圖、日常、分帳、發票、記帳一起改 ----------
   記帳裡「只用在記帳」的分類（台灣電力公司、自來水公司這類）不跟著改。
   改過的名稱記在 DB.scfg.alias（舊名 → 新名），之後匯入的發票、明細也會自動換成新名稱。 */
const isPcatPayee = n => { const A = DB.acc; if (!A) return false; const py = A.payees.find(x => x.n === n); return !!(py && py.g && (A.pcats || []).some(c => c.id === py.g)); };
function storeRefs(name) { const n = String(name || '').trim(), c = {map: 0, meal: 0, list: 0, bill: 0, inv: 0, acc: 0}; if (!n) return c;
  (DB.places || []).forEach(p => { if (p.name === n) c.map++; });
  Object.values(DB.days || {}).forEach(L => L.forEach(m => { if (!m.place && m.pname === n) c.meal++; }));
  Object.values(DB.lists || {}).forEach(L => L.forEach(l => { if (!l.place && l.pname === n) c.list++; }));
  Object.values(DB.bills || {}).forEach(L => L.forEach(b => { if (!b.place && b.pname === n) c.bill++; }));
  invList().forEach(v => { if (invSeller(v) === n) c.inv++; });
  if (DB.acc && !isPcatPayee(n)) DB.acc.recs.forEach(r => { if (r.payee === n) c.acc++; });
  return c; }
const storeRefText = c => [['map', '地圖收藏'], ['meal', '日常'], ['list', '購物清單'], ['bill', '分帳'], ['inv', '發票'], ['acc', '記帳']].filter(([k]) => c[k]).map(([k, n]) => `${n} ${c[k]}`).join('、');
/* 真的去改：回傳改了幾筆 */
async function renameStoreAll(oldN, newN, opt = {}) {
  oldN = String(oldN || '').trim(); newN = String(newN || '').trim(); if (!oldN || !newN || oldN === newN) return 0;
  let n = 0; const pc = isPcatPayee(oldN);
  for (const p of (DB.places || [])) if (p.name === oldN && !opt.skipMap) { p.name = newN; await savePlace(p); n++; }
  Object.values(DB.days || {}).forEach(L => L.forEach(m => { if (!m.place && m.pname === oldN) { m.pname = newN; n++; } })); saveDays();
  Object.values(DB.lists || {}).forEach(L => L.forEach(l => { if (!l.place && l.pname === oldN) { l.pname = newN; n++; } })); saveLists();
  Object.values(DB.bills || {}).forEach(L => L.forEach(b => { if (!b.place && b.pname === oldN) { b.pname = newN; n++; } })); saveBills();
  const S2 = DB.scfg.sellers || {}; Object.keys(S2).forEach(id => { if (S2[id] === oldN) S2[id] = newN; });
  invList().forEach(v => { if (v.seller === oldN || (!v.seller && S2[v.sellerId] === newN)) { v.seller = newN; n++; } }); saveInvs();
  const custom = (DB.mcfg && DB.mcfg.custom) || []; custom.forEach(x => { if (x.pname === oldN) x.pname = newN; }); saveMcfg();
  if (DB.acc && !pc) { const A = DB.acc; A.recs.forEach(r => { if (r.payee === oldN) { r.payee = newN; n++; } }); A.tpls.forEach(t => { if (t.payee === oldN) t.payee = newN; });
    A.payees.forEach(y => { if (y.n === oldN) y.n = newN; }); if (A.locs && A.locs[oldN]) { A.locs[newN] = A.locs[newN] || A.locs[oldN]; delete A.locs[oldN]; } saveAcc(); }
  const al = DB.scfg.alias = DB.scfg.alias || {}; Object.keys(al).forEach(k => { if (al[k] === oldN) al[k] = newN; }); al[oldN] = newN; delete al[newN]; saveScfg();
  invChanged && invChanged(); return n; }
/* 改名前問要不要同步其他區 */
async function renameStoreAsk(oldN, newN) { oldN = String(oldN || '').trim(); newN = String(newN || '').trim(); if (!oldN || !newN || oldN === newN) return 0;
  if (isPcatPayee(oldN)) return 0; const c = storeRefs(oldN), tx = storeRefText(c); if (!tx) { await renameStoreAll(oldN, newN); return 0; }
  if (!await ask(`「${oldN}」改成「${newN}」\n其他地方也有用到這個店名：${tx}\n要一起改嗎？`, '一起改')) return 0;
  const n = await renameStoreAll(oldN, newN); toast(`✅ 已同步更新 ${n} 筆`); refreshAll && refreshAll(); return n; }
const storeAlias = n => { const al = (DB.scfg && DB.scfg.alias) || {}; let x = String(n || '').trim(), i = 0; while (al[x] && i++ < 5) x = al[x]; return x; };
/* 記帳的「分帳的人」名單：新增、改名、換圖示、刪除、排序 */
function accPeopleEdit() {
  return new Promise(res => { const sh = sheet({title: '👥 分帳的人', full: true, foot: '<button class="btn pri" data-a="add">＋ 新增人員</button>', onClose: res});
    const used = id => DB.acc.recs.some(r => r.payer === id || (r.split || []).some(x => x.p === id)) || DB.acc.settles.some(x => x.p === id);
    const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">這份名單只用在記帳，日常點餐的名單不受影響。按住 ☰ 拖曳排序。</div><div id="apL">${accPeople().map(u => `<div class="apR card" data-u="${u.id}"><span class="grip"></span><span class="apI">${esc(u.icon)}</span><b class="grow">${esc(u.name)}${accMe() === u.id ? '<small>我</small>' : ''}</b><button class="ic" data-ed="${u.id}" aria-label="編輯">✎</button></div>`).join('') || '<div class="empty">還沒有人</div>'}</div>`;
      sortable($('#apL', sh.body), {item: '.apR', handle: '.grip', scroller: sh.body, onSort(f, t) { const L = accPeople(), m = L.splice(f, 1)[0]; L.splice(t, 0, m); saveAcc(); draw(); }}); };
    draw();
    sh.body.onclick = async e => { const b = e.target.closest('[data-ed]'); if (!b) return; buzz(8); const u = accPeople().find(x => x.id === b.dataset.ed); if (!u) return;
      const v = await nameIcon('編輯人員', {n: u.name, i: u.icon}, {del: true, ph: '名字'}); if (!v) return;
      if (v.del) { if (used(u.id) && !await ask(`「${u.name}」已經有分帳或對帳紀錄。刪除後那些紀錄會顯示「（已刪除）」，確定刪除？`, '刪除', true)) return;
        DB.acc.people = accPeople().filter(x => x !== u); if (DB.acc.me === u.id) DB.acc.me = ''; saveAcc(); draw(); return; }
      u.name = v.n.slice(0, 10) || u.name; u.icon = v.i || u.icon; saveAcc(); draw(); };
    sh.foot.onclick = async () => { buzz(10); const v = await nameIcon('新增人員', {n: '', i: PERSON_EMOJI[accPeople().length % PERSON_EMOJI.length]}, {ph: '名字'}); if (!v || !v.n) return;
      accPeople().push({id: 'u' + uid(), name: v.n.slice(0, 10), icon: v.i}); saveAcc(); draw(); }; });
}
function renderAccCfg() {
  const box = $('#accCBody'); if (!box || !DB.acc) return; const pc = S.pc || {}, gi = (() => { try { return JSON.parse(NB.gInfo ? NB.gInfo() : '{}'); } catch (e) { return {}; } })();
  box.innerHTML = `<div class="setG"><h3>功能區</h3><div class="setC"><button class="recCard" data-a="leave"><span class="rcI">🍽️</span><span class="rcT"><b>回到日日帳本</b><small>地圖、日常、分帳、發票</small></span><span class="rcGo">切換 ›</span></button></div></div>
    ${IS_APP && NB.widgetData ? `<div class="setG"><h3>快速記帳</h3><div class="setC">
      <button class="setR" data-a="qNotif" style="width:100%;text-align:left"><span class="gRi">🔔</span><div class="t"><b>通知欄快速記帳</b><small>通知欄常駐三顆按鈕（＋支出／＋收入／⭐常用），跟桌面小工具一樣</small></div><span class="sw2 ${S.qNotif ? 'on' : ''}"></span></button>
      <button class="setR" data-a="wHide" style="width:100%;text-align:left"><span class="gRi">👁</span><div class="t"><b>小工具和通知顯示金額</b><small>關掉後桌面小工具、通知只顯示 $ ••••</small></div><span class="sw2 ${S.wHide ? '' : 'on'}"></span></button>
      <div class="setR" style="cursor:default"><span class="gRi">📱</span><div class="t"><b>桌面小工具、控制中心按鈕</b><small>桌面：長按空白處 →「小工具」→ 日日帳本。控制中心：下拉兩次 → 編輯（鉛筆）→ 把「記一筆」「常用記帳」拖進去。</small></div></div></div></div>` : ''}
    <div class="setG"><h3>說明</h3><div class="setC"><button class="setR" data-a="guide" style="width:100%;text-align:left"><span class="gRi">📖</span><div class="t"><b>記帳 圖解說明</b><small>記一筆、常用、欠款對帳、資產、分析、備份換機</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>分帳的人</h3><div class="setC"><div class="setR col"><div class="t"><b>我是誰</b><small>分帳、對帳時「我」是哪一個人（記帳自己的名單，和日常點餐分開）</small></div><div class="whoRow">${accPeople().map(u => `<button data-me="${u.id}" class="${accMe() === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div></div>
      <button class="setR" data-a="people" style="width:100%;text-align:left"><span class="gRi">👥</span><div class="t"><b>管理名單</b><small>新增、改名、換圖示、刪除、拖曳排序</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>分類</h3><div class="setC">
      <button class="setR" data-a="cats" data-ty="out" style="width:100%;text-align:left"><span class="gRi">📂</span><div class="t"><b>支出分類</b><small>${DB.acc.cats.out.map(p => p.n).join('、')}</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="cats" data-ty="in" style="width:100%;text-align:left"><span class="gRi">💰</span><div class="t"><b>收入分類</b><small>${DB.acc.cats.in.map(p => p.n).join('、')}</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="opt" style="width:100%;text-align:left"><span class="gRi">🧭</span><div class="t"><b>非必要消費</b><small>分析頁「必要／非必要」用</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>商家・帳戶・常用</h3><div class="setC">
      <button class="setR" data-a="payees" style="width:100%;text-align:left"><span class="gRi">🏪</span><div class="t"><b>商家／對象名稱</b><small>${DB.acc.payees.length ? DB.acc.payees.length + ' 個・' : ''}例如台灣自來水公司，各自歸到分類</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="accts" style="width:100%;text-align:left"><span class="gRi">🏦</span><div class="t"><b>帳戶</b><small>${DB.acc.accts.length} 個・現金、銀行、信用卡、行動支付</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="tpls" style="width:100%;text-align:left"><span class="gRi">⭐</span><div class="t"><b>常用紀錄</b><small>${DB.acc.tpls.length ? DB.acc.tpls.map(t => t.name).join('、') : '在「記一筆」按「⭐ 存成常用」建立'}</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>匯出</h3><div class="setC"><button class="setR" data-a="csv" style="width:100%;text-align:left"><span class="gRi">📤</span><div class="t"><b>匯出 CSV</b><small>選日期區間：所有消費明細（含品項、分帳），以及資產明細</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>備份與換機（整個日日帳本＋所有圖片）</h3><div class="setC">
      <div class="setR col"><div class="t"><b>☁️ Google 雲端硬碟</b><small>${(S.gd || {}).email || gi.email ? '帳戶：' + esc((S.gd || {}).email || gi.email) : '還沒登入（可以用瀏覽器登入，支援兩步驟驗證）'}・資料夾：${esc((S.gd || {}).folder || '日日帳本備份')}${S.gd && S.gd.last ? '・上次備份 ' + new Date(S.gd.last).toLocaleString('zh-TW') : ''}</small></div>
        <div class="acRow2"><button class="btn pri" data-a="gUp">⬆️ 上傳備份</button><button class="btn" data-a="gDown">⬇️ 從雲端還原</button></div><div class="acRow2"><button class="btn sm" data-a="gFolder">📁 選擇資料夾</button>${gi.email || (S.gd || {}).rt ? '<button class="btn sm" data-a="gOut">換帳戶／登出</button>' : '<button class="btn sm" data-a="gIn">🌐 登入 Google</button>'}</div><div class="gwBox"><b>🌐 網頁版雲端硬碟（免設定）</b><small>在 App 裡打開 drive.google.com，跟用瀏覽器一樣登入。登入後會自動建立「日日帳本備份」資料夾並上傳；還原時列出資料夾裡的備份讓你選。${S.gd && S.gd.wEmail ? '<br>已登入：' + esc(S.gd.wEmail) : ''}</small><div class="acRow2"><button class="btn" data-a="gwUp">⬆️ 上傳備份</button><button class="btn" data-a="gwDown">⬇️ 從雲端還原</button></div><button class="btn sm" data-a="gwMan" style="margin-top:.3rem">🖥️ 開電腦版網頁自己上傳／下載</button></div></div>
      <div class="setR col"><div class="t"><b>☁️ pCloud</b><small>${pc.auth ? '帳戶：' + esc(pc.email || '') + '・資料夾：' + esc((pc.folder || {}).path || '/日日帳本備份') + (pc.last ? '・上次備份 ' + new Date(pc.last).toLocaleString('zh-TW') : '') : '還沒登入（可以用 pCloud 網頁登入，支援 Google 登入、兩步驟驗證）'}</small></div>
        <div class="acRow2"><button class="btn pri" data-a="pUp">⬆️ 上傳備份</button><button class="btn" data-a="pDown">⬇️ 從雲端還原</button></div><div class="acRow2"><button class="btn sm" data-a="pFolder">📁 選擇資料夾</button>${pc.auth ? '<button class="btn sm" data-a="pOut">登出 pCloud</button>' : '<button class="btn sm" data-a="pIn">🌐 登入 pCloud</button>'}</div></div>
      <div class="setR col"><div class="t"><b>📱 手機內建儲存</b><small>把整個日日帳本存成一個備份檔放在手機的「下載」資料夾，或從備份檔還原</small></div>
        <div class="acRow2"><button class="btn" data-a="lUp">💾 備份到手機</button><button class="btn" data-a="lDown">📂 從手機還原</button></div></div>
      <div class="setR col"><div class="t"><b>📲 快速換機（QR Code）</b><small>兩支手機連同一個 Wi-Fi：舊手機按「顯示 QR Code」，新手機按「掃描接收」，資料和圖片直接傳過去</small></div>
        <div class="acRow2"><button class="btn" data-a="xSend">📤 顯示 QR Code</button><button class="btn" data-a="xRecv">📷 掃描接收</button></div></div>
      <div class="setR col"><div class="t"><small>每張圖片都用自己的編號存在備份裡，記錄只記著圖片編號，所以還原後圖片會回到原本那一筆記帳、分帳明細、菜單和食譜，不會亂掉。</small></div></div></div></div>`;
}
async function accCfgClick(e) {
  const t = e.target.closest('[data-a],[data-me]'); if (!t) return; buzz(8); const a = t.dataset.a;
  if (t.dataset.me) { DB.acc.me = t.dataset.me; saveAcc(); renderAccCfg(); return; }
  if (a === 'people') { await accPeopleEdit(); renderAccCfg(); return; }
  if (a === 'leave') leaveAcc(); else if (a === 'guide') openGuide('acc'); else if (a === 'qNotif') { S.qNotif = !S.qNotif; saveS(); NB.quickNotif(!!S.qNotif); accWidgetPush(); renderAccCfg(); toast(S.qNotif ? '🔔 已開啟通知欄快速記帳' : '已關閉通知欄快速記帳'); } else if (a === 'wHide') { S.wHide = !S.wHide; saveS(); accWidgetPush(); renderAccCfg(); } else if (a === 'cats') editCatTree(t.dataset.ty); else if (a === 'opt') optCfg(); else if (a === 'payees') managePayees(); else if (a === 'accts') enterAcc('AccA'); else if (a === 'tpls') manageTpls(); else if (a === 'csv') accCsv();
  else if (a === 'gFolder') gPickFolder(); else if (a === 'pFolder') pPickFolder(); else if (a === 'pIn') pLogin(); else if (a === 'lUp') localBackup(); else if (a === 'lDown') localRestore(); else if (a === 'xSend') xferSend(); else if (a === 'xRecv') xferRecv();
  else if (a === 'gwUp') gDriveWeb('up'); else if (a === 'gwDown') gDriveWeb('down'); else if (a === 'gwMan') gwManual();
  else if (a === 'gUp') cloudUp('g'); else if (a === 'gDown') cloudDown('g'); else if (a === 'pUp') cloudUp('p'); else if (a === 'pDown') cloudDown('p');
  else if (a === 'gIn') gChooseLogin().then(() => renderAccCfg()); else if (a === 'gOut') { if (NB.gSignOut) NB.gSignOut(); S.gd = {cid: (S.gd || {}).cid, csec: (S.gd || {}).csec}; saveS(); renderAccCfg(); } else if (a === 'pOut') { S.pc = {}; saveS(); renderAccCfg(); }
}
function editCatTree(ty) {
  const sh = sheet({title: ty === 'out' ? '📂 支出分類' : '💰 收入分類', full: true, foot: '<button class="btn pri" data-a="addP">＋ 新增母分類</button>'});
  const L = DB.acc.cats[ty]; const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">點名稱可以改名、換圖示或刪除；按住母分類或子分類拖曳排序（子分類可以拖到別的母分類）。</div><div id="ctL">${L.map(p => `<div class="ctP card" data-pid="${p.id}"><div class="ctH"><span class="grip"></span><button class="ctN" data-ep="${p.id}"><i>${esc(p.i)}</i><b>${esc(p.n)}</b></button><button class="btn sm" data-as="${p.id}">＋ 子分類</button></div><div class="acCfgL ctS">${(p.subs || []).map(s => `<button class="ctSub" data-es="${p.id}:${s.id}">${esc(s.i || '')} ${esc(s.n)}</button>`).join('')}</div></div>`).join('')}</div>`;
    sortable($('#ctL', sh.body), {item: '.ctP', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, to) { moveItem(L, f, to); saveAcc(); draw(); }});
    sortable($('#ctL', sh.body), {item: '.ctSub', groups: '.ctS', axis: 'grid', scroller: sh.body, onSort(f, to, gF, gT) { const pF = L.find(p => p.id === gF.closest('.ctP').dataset.pid), pT = L.find(p => p.id === gT.closest('.ctP').dataset.pid); const it = pF.subs.splice(f, 1)[0]; (pT.subs = pT.subs || []).splice(to, 0, it); saveAcc(); draw(); }}); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.ep) { const p = L.find(x => x.id === d.ep), v = await nameIcon('編輯母分類', p, {del: true}); if (!v) return; if (v.del) { if (L.length <= 1) { toast('至少要留一個'); return; } if (!await ask(`刪除「${p.n}」和它的子分類？已經記的帳不會刪除。`, '刪除', true)) return; L.splice(L.indexOf(p), 1); } else Object.assign(p, {n: v.n.slice(0, 10), i: v.i}); saveAcc(); draw(); }
    else if (d.as) { const p = L.find(x => x.id === d.as), v = await nameIcon(`在「${p.n}」新增子分類`, {n: '', i: p.i}); if (!v) return; (p.subs = p.subs || []).push({id: 'c' + uid(), n: v.n.slice(0, 10), i: v.i}); saveAcc(); draw(); }
    else if (d.es) { const [pid, sid] = d.es.split(':'), p = L.find(x => x.id === pid), sc = p.subs.find(x => x.id === sid), v = await nameIcon('編輯子分類', sc, {del: true}); if (!v) return; if (v.del) { if (!await ask(`刪除「${sc.n}」？已經記的帳不會刪除。`, '刪除', true)) return; p.subs.splice(p.subs.indexOf(sc), 1); } else Object.assign(sc, {n: v.n.slice(0, 10), i: v.i}); saveAcc(); draw(); } });
  sh.foot.onclick = async () => { const v = await nameIcon('新增母分類', {n: '', i: '📁'}); if (!v) return; L.push({id: 'p' + uid(), n: v.n.slice(0, 10), i: v.i, subs: []}); saveAcc(); draw(); };
}
function managePayees() {
  payMigrate();
  return new Promise(res => { const sh = sheet({title: '🏪 商家／對象名稱', full: true, foot: '<button class="btn" data-a="newG">＋ 新分類</button><button class="btn pri" data-a="add">＋ 新增名稱</button>', onClose() { res(); }});
    const draw = () => { const r = payListHtml('', '', true); sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .6rem">收藏的店家和自訂名稱在同一份清單；點自訂名稱可以編輯，點分類名稱可以收合。收藏店家要在地圖或收藏頁編輯。</div><div class="pyW">${r.html}</div>`; payBindSort($('.pyW', sh.body), sh.body, draw); };
    draw(); sh.body.onclick = async e => { const ge = e.target.closest('[data-gedit]'); if (ge) { e.stopPropagation(); buzz(8); await editPayGroup(ge.dataset.gedit); draw(); return; }
      const t = e.target.closest('button'); if (!t) return; buzz(8); if (payFold(t, sh.body, draw)) return;
      if (t.dataset.k && t.dataset.k[0] === 'y') { const p = DB.acc.payees.find(x => x.id === t.dataset.k.slice(2)); await editPayee(catFind('in', p.cat).p && !catFind('out', p.cat).p ? 'in' : 'out', p); draw(); }
      else if (t.dataset.addg) { await editPayee('out', {n: '', g: t.dataset.addg}); draw(); }
      else if (t.dataset.k) { const pl = (DB.places || []).find(x => x.id === t.dataset.k.replace(/^p:?/, '')); if (pl) accMapFocus(pl.name); } };
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10);
      if (b.dataset.a === 'newG') { const id = await newPayGroup(); draw(); if (id) { const el = $(`.pyCat[data-g="${id}"]`, sh.body); if (el) { el.scrollIntoView({block: 'center', behavior: 'smooth'}); el.classList.add('flash'); toast('✅ 已新增分類'); } } return; }
      await editPayee('out', {n: ''}); draw(); }; });
}
function manageTpls() { tplList(); }
/* 常用紀錄完整清單：支出／收入／轉帳，依分類排列；長按拖曳排序 */
function tplList() {
  let ty = 'out'; const sh = sheet({title: '⭐ 常用紀錄', full: true, foot: '<button class="btn pri" data-a="new">＋ 新增常用紀錄</button>'});
  const groups = () => { const L = DB.acc.tpls.filter(t => (t.type || 'out') === ty), G = [];
    if (ty === 'tr') { if (L.length) G.push({k: 'tr', n: '🔄 轉帳', L}); return G; }
    DB.acc.cats[ty].forEach(p => [{id: p.id, n: p.n, i: p.i}].concat(p.subs || []).forEach(sc => { const M = L.filter(t => t.cat === sc.id); if (M.length) G.push({k: sc.id, n: (sc.i || p.i) + ' ' + (sc.id === p.id ? p.n : p.n + '・' + sc.n), L: M}); }));
    const rest = L.filter(t => !G.some(g => g.L.includes(t))); if (rest.length) G.push({k: '_', n: '📦 其他', L: rest});
    const ord = ((DB.acc.tgord || {})[ty]) || [], at = k => { const i = ord.indexOf(k); return i < 0 ? 1e6 : i; };
    return G.map((g, i) => [g, i]).sort((a, b) => at(a[0].k) - at(b[0].k) || a[1] - b[1]).map(x => x[0]); };
  const draw = () => { const G = groups(), n = k => DB.acc.tpls.filter(t => (t.type || 'out') === k).length;
    sh.body.innerHTML = `<div class="acType three"><button data-ty="out" class="${ty === 'out' ? 'on' : ''}">支出 ${n('out') || ''}</button><button data-ty="in" class="${ty === 'in' ? 'on' : ''}">收入 ${n('in') || ''}</button><button data-ty="tr" class="${ty === 'tr' ? 'on' : ''}">轉帳 ${n('tr') || ''}</button></div>
      <div class="small muted" style="margin:-.2rem 0 .7rem">點一下就用今天的日期記帳；按住紀錄拖曳可以在分類裡排序，按住分類名稱可以整組上下移動；按 ✎ 編輯。</div>
      <div id="tpL">${G.map(g => `<div class="tpG" data-g="${g.k}"><div class="tpGH">${G.length > 1 ? '<span class="grip"></span>' : ''}<span class="lbl">${esc(g.n)}</span><em>${g.L.length}</em></div>${g.L.map(t => `<div class="tpR card" data-t="${t.id}"><span class="grip"></span><button class="tpUse" data-use="${t.id}"><b>${esc(t.name)}</b><small>${esc([t.payee, t.type === 'tr' ? acctName(t.acct) + ' → ' + acctName(t.to) : acctName(t.acct), (t.split || []).length ? '分帳 ' + t.split.length + ' 人' : ''].filter(Boolean).join('・'))}</small><span class="tpV ${!+t.amt ? '' : t.type === 'in' ? 'pos' : t.type === 'out' ? 'neg' : ''}">${+t.amt ? money(t.amt) : '💬 每次輸入金額'}</span></button><button class="ic" data-ed="${t.id}" aria-label="編輯">✎</button></div>`).join('')}</div>`).join('') || '<div class="empty">這一類還沒有常用紀錄<br><span class="small">按下面「＋ 新增常用紀錄」，或在記一筆時按「⭐ 存成常用」</span></div>'}</div>`;
    sortable($('#tpL', sh.body), {item: '.tpR', scope: '.tpG', scroller: sh.body, onSort(f, t, scope) { const ids = $$('.tpR', scope).map(e => e.dataset.t), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv);
      const pos = DB.acc.tpls.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => DB.acc.tpls.find(x => x.id === id)); pos.forEach((p, i) => { DB.acc.tpls[p] = objs[i]; }); saveAcc(); draw(); renderAcc(); }});
    /* 分類整組上下移動 */
    if (G.length > 1) sortable($('#tpL', sh.body), {item: '.tpG', handle: '.tpGH', handleOnly: true, scroller: sh.body, onSort(f, t) { const ks = G.map(g => g.k), mv = ks.splice(f, 1)[0]; ks.splice(t, 0, mv);
      DB.acc.tgord = DB.acc.tgord || {}; DB.acc.tgord[ty] = ks; saveAcc(); draw(); renderAcc(); }}); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.ty) { ty = d.ty; draw(); return; }
    if (d.use) { const tp = DB.acc.tpls.find(x => x.id === d.use); sh.close(); useTpl(tp); return; }
    if (d.ed) { const tp = DB.acc.tpls.find(x => x.id === d.ed); await accEdit(tp, null, {tpl: true}); draw(); renderAcc(); } });
  sh.foot.onclick = async () => { buzz(10); await accEdit(null, {type: ty}, {tpl: true, isNew: true}); draw(); renderAcc(); };
}

/* ---------- 匯出 CSV ---------- */
const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function saveCsv(name, rows) { const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], {type: 'text/csv'}); try { const p = await saveFile(name, blob); toast(IS_APP ? '已匯出到「下載」資料夾：' + p : '已下載 ' + name, 4000); } catch (e) { toast('匯出失敗：' + e.message); } }
function accCsv() {
  const now = new Date(); let from = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to = ymd(now);
  const sh = sheet({title: '📤 匯出 CSV', foot: '<button class="btn" data-a="asset">資產明細</button><button class="btn pri" data-a="rec">消費明細</button>'});
  const draw = () => { const n = DB.acc.recs.filter(r => r.d >= from && r.d <= to).length; sh.body.innerHTML = `<div class="lbl">日期區間</div><div class="acRow2"><button class="btn" data-a="from">從 ${from.replace(/-/g, '/')}</button><button class="btn" data-a="to">到 ${to.replace(/-/g, '/')}</button></div><div class="whoRow" style="margin:.6rem 0">${[['本月', 0], ['上個月', 1], ['今年', 2], ['全部', 3]].map(([t, k]) => `<button data-q="${k}">${t}</button>`).join('')}</div><div class="small muted">這段期間有 ${n} 筆紀錄。「消費明細」包含每筆的類別、商家、帳戶、備註、分帳、品項；「資產明細」包含每個帳戶的期初、期末餘額和這段期間的每一筆收支。</div>`; };
  draw(); sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.a === 'from') { const k = await datePick(from); if (k) { from = k; draw(); } } else if (d.a === 'to') { const k = await datePick(to); if (k) { to = k; draw(); } }
    else if (d.q != null) { const q = +d.q; if (q === 0) { from = ymd(new Date(now.getFullYear(), now.getMonth(), 1)); to = ymd(now); } else if (q === 1) { from = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)); to = ymd(new Date(now.getFullYear(), now.getMonth(), 0)); } else if (q === 2) { from = `${now.getFullYear()}-01-01`; to = ymd(now); } else { from = DB.acc.recs.map(r => r.d).sort()[0] || ymd(now); to = ymd(now); } draw(); } };
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); const L = DB.acc.recs.filter(r => r.d >= from && r.d <= to).sort((a, c) => (a.d + (a.t || '')).localeCompare(c.d + (c.t || '')));
    if (b.dataset.a === 'rec') { const T = {out: '支出', in: '收入', tr: '轉帳', loss: '遺失'};
      const rows = [['日期', '時間', '種類', '母分類', '子分類', '金額', '我的部分', '帳戶', '轉入帳戶', '手續費', '商家／對象', '誰付', '分帳', '欠款狀態', '備註／明細', '品項', '圖片數']].concat(L.map(r => { const f = catFind(r.type, r.cat), me = accMe();
        return [r.d, r.t || '', T[r.type], f.p ? f.p.n : '', f.s ? f.s.n : '', r.amt, r.type === 'out' ? accMine(r) : r.type === 'in' ? r.amt : '', acctName(r.acct).replace(/^\S+\s/, ''), r.type === 'tr' ? acctName(r.to).replace(/^\S+\s/, '') : '', +r.fee || '', r.payee || '', r.type === 'out' ? aWho(r.payer || me).name : '',
          (r.split || []).map(s => aWho(s.p).name + ' ' + s.amt).join('；'), (r.split || []).filter(s => s.p !== me && accOwe(r, s.p)).map(s => aWho(s.p).name + ((r.settled || {})[s.p] ? ' 已結清' : ' 未結清')).join('；'), r.note || '', (r.items || []).map(x => x.n + ' ' + x.amt + ((x.ppl || []).length ? '（' + x.ppl.map(p => aWho(p).name).join('、') + '）' : '')).join('；'), (r.imgs || []).length]; }));
      await saveCsv(`記帳明細_${from}_${to}.csv`, rows); }
    else { const pd = ymd(new Date(ymdDate(from).getTime() - 864e5)); const rows = [['帳戶', '種類', `期初餘額（${pd}）`, `期末餘額（${to}）`, '這段期間收入', '這段期間支出', '信用卡還款日', '扣款帳戶']];
      DB.acc.accts.forEach(a => { const fl = L.map(r => acctFlow(r, a.id)); rows.push([a.n, AK[a.kind][0], acctBal(a, pd), acctBal(a, to), r2(fl.filter(v => v > 0).reduce((s, v) => s + v, 0)), r2(-fl.filter(v => v < 0).reduce((s, v) => s + v, 0)), a.kind === 'card' ? a.payDay || '' : '', a.kind === 'card' ? acctName(a.payFrom).replace(/^\S+\s/, '') : '']); });
      rows.push([], ['日期', '帳戶', '金額變動', '種類', '說明']); L.forEach(r => DB.acc.accts.forEach(a => { const v = acctFlow(r, a.id); if (v) rows.push([r.d, a.n, v, {out: '支出', in: '收入', tr: '轉帳', loss: '遺失'}[r.type], r.payee || String(r.note || '').split('\n')[0] || accCat(r).n]); }));
      await saveCsv(`資產明細_${from}_${to}.csv`, rows); } };
}
