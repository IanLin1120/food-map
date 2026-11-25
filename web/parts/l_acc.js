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
    const show = !(S.wHide) && !AccLock.has(), f = v => show ? money(Math.round(v)) : '$ ••••';
    NB.widgetData(JSON.stringify({m: (now.getMonth() + 1) + '月', out: f(o), inc: f(i), today: f(t), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a0562f'}));
  } catch (e) { console.log('widget', e); }
}
/* 從小工具、通知欄、控制中心打開：直接進記帳區開始記一筆 */
const Quick = {async check() { if (!(IS_APP && NB.quickTake)) return; const a = NB.quickTake(); if (!a) return;
  while (sheets.length) sheets[sheets.length - 1].close();
  /* 有上鎖：先解鎖才能記帳 */
  if (!S.inAcc) { if (!await enterAcc('Acc')) return; } else { if (!await AccLock.need()) return; showTab('Acc'); } buzz(15);
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
/* 同一個人在不同地方用不同綽號：例如日常點餐叫「便當哥」、記帳叫「因因」。same 存「別名 id → 記帳裡的那個人 id」 */
const accSame = () => DB.acc.same || (DB.acc.same = {});
function accPid(id) { const M = accSame(); let n = 0; while (id && M[id] && M[id] !== id && n++ < 6) id = M[id]; return id; }
const mealWho = id => ((DB.mcfg && DB.mcfg.people) || []).find(u => u.id === id);
function accSameName(id) { const u = accPeople().find(x => x.id === id) || mealWho(id); return u ? u : ((DB.acc.sameN || {})[id] ? {id, name: DB.acc.sameN[id], icon: (DB.acc.sameI || {})[id] || '👤'} : null); }
/* 把別名併進主要的人：記帳裡所有用到別名的地方都換成主要的人，別名從記帳名單拿掉 */
function accLink(alias, main) { if (!alias || !main || alias === main) return; const A = DB.acc, f = id => id === alias ? main : id, u = accSameName(alias);
  (A.sameN = A.sameN || {})[alias] = u ? u.name : alias; (A.sameI = A.sameI || {})[alias] = u ? u.icon : '👤'; accSame()[alias] = main; Object.keys(accSame()).forEach(k => { if (accSame()[k] === alias) accSame()[k] = main; });
  const fixSplit = L => { const out = []; (L || []).forEach(x => { const p = f(x.p), o = out.find(y => y.p === p); if (o) o.amt = r2((+o.amt || 0) + (+x.amt || 0)); else out.push(Object.assign({}, x, {p})); }); return out; };
  A.recs.forEach(r => { if (r.payer) r.payer = f(r.payer); if (r.split) r.split = fixSplit(r.split); if (r.settled && r.settled[alias] != null) { if (r.settled[main] == null) r.settled[main] = r.settled[alias]; delete r.settled[alias]; } (r.items || []).forEach(x => { if (x.ppl) x.ppl = [...new Set(x.ppl.map(f))]; }); });
  A.settles.forEach(t => { if (t.p) t.p = f(t.p); }); A.tpls.forEach(t => { if (t.payer) t.payer = f(t.payer); if (t.split) t.split = fixSplit(t.split); });
  if (A.me === alias) A.me = main; A.people = accPeople().filter(x => x.id !== alias); saveAcc(); }
function accUnlink(alias) { delete accSame()[alias]; saveAcc(); }
/* 選「同一個人」：先選記帳裡顯示的名字，再選另一個名字（記帳名單或日常點餐名單） */
async function accLinkAsk(mainId) {
  const pick = (title, L) => new Promise(res => { let done = false; const sh = sheet({title, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = L.length ? `<div class="whoRow pplGrid">${L.map(u => `<button data-id="${esc(u.id)}">${esc(u.icon || '👤')} ${esc(u.name)}${u.tag ? `<small class="muted"> ${esc(u.tag)}</small>` : ''}</button>`).join('')}</div>` : '<div class="empty">沒有可以選的人</div>';
    sh.body.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; buzz(10); done = true; sh.close(); res(b.dataset.id); }; });
  const main = mainId || await pick('① 記帳裡要顯示哪個名字？', accPeople()); if (!main) return false; const M = accPeople().find(u => u.id === main);
  const cand = accPeople().filter(u => u.id !== main).map(u => Object.assign({tag: '記帳'}, u)).concat(((DB.mcfg && DB.mcfg.people) || []).filter(u => u.id !== main && !accPeople().some(x => x.id === u.id) && accPid(u.id) !== main).map(u => Object.assign({}, u, {tag: '日常點餐'})));
  const al = await pick(`② 哪個名字其實也是「${M ? M.name : ''}」？`, cand); if (!al) return false; const A = accSameName(al), inAcc = accPeople().some(u => u.id === al);
  if (!await ask(`「${A ? A.name : ''}」和「${M ? M.name : ''}」是同一個人？\n\n${inAcc ? `記帳裡「${A ? A.name : ''}」的紀錄、欠款都會併到「${M ? M.name : ''}」，記帳名單只留「${M ? M.name : ''}」。` : `日常點餐還是叫「${A ? A.name : ''}」，從分帳匯入記帳時會自動變成「${M ? M.name : ''}」。`}`, '是同一個人')) return false;
  accLink(al, main); buzz(30); toast(`🔗 ${A ? A.name : ''} ＝ ${M ? M.name : ''}`); return true; }
/* 從日常設定進來：先選日常的名字，再選記帳裡是誰 */
async function accLinkAskMeal() {
  const pick = (title, L) => new Promise(res => { let done = false; const sh = sheet({title, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = L.length ? `<div class="whoRow pplGrid">${L.map(u => `<button data-id="${esc(u.id)}">${esc(u.icon || '👤')} ${esc(u.name)}</button>`).join('')}</div>` : '<div class="empty">沒有可以選的人</div>';
    sh.body.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; buzz(10); done = true; sh.close(); res(b.dataset.id); }; });
  const al = await pick('① 日常點餐裡的哪個名字？', DB.mcfg.people); if (!al) return false; const A = mealWho(al);
  const main = await pick(`② 「${A.name}」在記帳裡是誰？`, accPeople().filter(u => u.id !== al)); if (!main) return false; const M = accPeople().find(u => u.id === main);
  if (!await ask(`「${A.name}」（日常）和「${M.name}」（記帳）是同一個人？\n日常還是顯示「${A.name}」，從分帳匯入記帳時會自動變成「${M.name}」${accPeople().some(u => u.id === al) ? `；記帳裡原本「${A.name}」的紀錄也會併到「${M.name}」` : ''}。`, '是同一個人')) return false;
  accLink(al, main); buzz(30); toast(`🔗 ${A.name} ＝ ${M.name}`); return true; }
const aWho = id => (id = accPid(id), accPeople().find(u => u.id === id)) || ((DB.mcfg && DB.mcfg.people) || []).find(u => u.id === id) || {id, name: '（已刪除）', icon: '👤'};
const accMe = () => { const P = accPeople(); if (DB.acc.me && P.some(u => u.id === DB.acc.me)) return DB.acc.me; const u = P.find(x => x.name === '我') || P[0]; return u ? u.id : 'me'; };
/* 找類別：回傳 {p: 母分類, s: 子分類} */
function catFind(type, id) { const L = DB.acc.cats[type === 'in' ? 'in' : 'out'] || []; for (const p of L) { if (p.id === id) return {p, s: null}; const s = (p.subs || []).find(x => x.id === id); if (s) return {p, s}; } return {p: null, s: null}; }
/* 提款、存款的圖示（大地色系）：提款＝提款機吐出鈔票；存款＝存錢筒投入硬幣 */
const ICO_WD = `<svg viewBox="0 0 48 48" class="acSvg" aria-label="提款"><rect x="6" y="5" width="36" height="24" rx="5" fill="#5d7f86"/><rect x="11" y="10" width="26" height="8" rx="2" fill="#dfeee9"/><rect x="13" y="22" width="22" height="3" rx="1.5" fill="#2f4a50"/><rect x="15" y="23.5" width="18" height="15" rx="2" fill="#7fa65a" stroke="#4f6e34" stroke-width="1.4"/><circle cx="24" cy="31" r="3.4" fill="none" stroke="#f3f8e9" stroke-width="1.6"/><path d="M24 39.5v4.5m-3-3 3 3 3-3" stroke="#b5653a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ICO_DP = `<svg viewBox="0 0 48 48" class="acSvg" aria-label="存款"><ellipse cx="23" cy="30" rx="16" ry="12" fill="#d98b6a"/><circle cx="37" cy="27" r="5" fill="#d98b6a"/><circle cx="39" cy="27" r="1.1" fill="#7a3f27"/><path d="M14 39.5v4M30 39.5v4" stroke="#b56a4d" stroke-width="4" stroke-linecap="round"/><path d="M16 20l-3-6 7 3" fill="#c97857"/><circle cx="18" cy="27" r="1.4" fill="#5a2e1d"/><rect x="19" y="18.5" width="9" height="2.2" rx="1.1" fill="#7a3f27"/><circle cx="23.5" cy="9" r="5.5" fill="#e8b84a" stroke="#b8862a" stroke-width="1.4"/><path d="M23.5 6.5v5" stroke="#b8862a" stroke-width="1.6" stroke-linecap="round"/><path d="M23.5 15.5v2" stroke="#6f7d3c" stroke-width="2" stroke-linecap="round"/></svg>`;
const accCat = r => { if (r.type === 'loss') return {n: '金額遺失', i: '💸'}; if (r.type === 'tr') { if (r.from === '' && r.settle) return {n: '收回欠款', i: '🔄'}; const A = accAcct(r.acct), B = accAcct(r.to); /* 從銀行、儲值轉到現金類帳戶（現金、紅包）＝提款 */ if (!r.settle && B && B.kind === 'cash' && A && A.kind !== 'cash') return {n: '提款', i: '🏧', svg: ICO_WD, k: 'wd'}; if (!r.settle && A && A.kind === 'cash' && B && B.kind === 'bank') return {n: '存款', i: '🏦', svg: ICO_DP, k: 'dp'}; return {n: '轉帳', i: '🔄'}; } const f = catFind(r.type, r.cat); return f.s ? {n: f.s.n, i: f.s.i || f.p.i, pn: f.p.n} : f.p ? {n: f.p.n, i: f.p.i, pn: f.p.n} : {n: r.type === 'in' ? '收入' : '支出', i: r.type === 'in' ? '💵' : '📦', pn: '其他'}; };
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
/* ============================================================
   記帳・對帳的上鎖（跟 Terra 瀏覽器同一套）：6～16 位數字密碼（只存加鹽 PBKDF2 雜湊）＋指紋／臉部
   解鎖一次後，直到 App 被關掉或螢幕關閉前都不用再輸入；連續輸錯 5 次起要等待，時間會加倍
   密碼不強制：第一次進記帳時推薦設定；改密碼要先輸入舊密碼、移除密碼要輸入密碼
   ============================================================ */
const AccLock = {
  webOk: false,
  app: () => IS_APP && !!NB.lockHas,
  has() { if (this.app()) return !!NB.lockHas(); try { return !!JSON.parse(localStorage.getItem('accPin') || 'null'); } catch (e) { return false; } },
  open() { return !this.has() || (this.app() ? !!NB.lockSession() : this.webOk); },
  bioOk() { return this.app() && !!NB.lockBioOk && !!NB.lockBioOk() && S.accBio !== false; },
  relock() { if (this.app()) NB.lockRelock(); this.webOk = false; },
  /* 網頁版（沒有 App 時）：瀏覽器裡用 WebCrypto PBKDF2 */
  async webHash(pin, salt) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const b = await crypto.subtle.deriveBits({name: 'PBKDF2', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: 60000, hash: 'SHA-256'}, k, 256); return btoa(String.fromCharCode(...new Uint8Array(b))); },
  async check(pin) { if (this.app()) { try { return JSON.parse(NB.lockCheck(pin)); } catch (e) { return {ok: false}; } }
    const w = JSON.parse(localStorage.getItem('accPin') || 'null'); if (!w) return {ok: true}; const ok = await this.webHash(pin, w.salt) === w.hash; if (ok) this.webOk = true; return {ok}; },
  len() { if (this.app()) return NB.lockLen() || 0; try { return (JSON.parse(localStorage.getItem('accPin') || 'null') || {}).len || 0; } catch (e) { return 0; } },
  async set(old, pin) { if (this.app()) return NB.lockSet(old || '', pin);
    if (this.has() && !(await this.check(old)).ok) return '舊密碼不正確'; const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    localStorage.setItem('accPin', JSON.stringify({salt, hash: await this.webHash(pin, salt), len: pin.length})); this.webOk = true; return ''; },
  async clear(pin) { if (this.app()) return NB.lockClear(pin); if (!(await this.check(pin)).ok) return '密碼錯誤'; localStorage.removeItem('accPin'); this.webOk = false; return ''; },
  /* 需要解鎖時呼叫：回傳 Promise<是否解鎖> */
  need(title) { if (this.open()) return Promise.resolve(true); return new Promise(res => accPinPad({title: title || '🔒 解鎖記帳', bio: true, onOk: () => { res(true); this.paint(); }, onCancel: () => res(false)})); },
  /* 原生事件：螢幕關閉 → 馬上上鎖 */
  onNative(d) { try { d = typeof d === 'string' ? JSON.parse(d) : d; } catch (e) { return; } if (d.bio) { (this.bioCb || (() => {}))(d); return; } if (d.relock) { this.webOk = false; this.gate(); } },
  /* 已經在記帳區、但被上鎖了：把記帳畫面蓋住，要求解鎖；取消就回到日日帳本 */
  async gate() { this.paint(); if (!S.inAcc || this.open() || this.gating) return; this.gating = true;
    while (sheets.length) sheets[sheets.length - 1].close(); document.body.classList.add('accLocked');
    const ok = await this.need('🔒 記帳已上鎖'); this.gating = false; document.body.classList.remove('accLocked'); if (!ok) leaveAcc(); else this.paint(); },
  /* 設定頁上的鎖頭按鈕 */
  label() { const has = this.has(), op = this.open(); return !has ? '🔓 未設定密碼・點一下設定' : op ? '🔓 已解鎖・點一下上鎖' : '🔒 已上鎖・點一下解鎖'; },
  paint() { $$('[data-lk]').forEach(b => { b.classList.toggle('on', this.has() && !this.open()); b.innerHTML = this.label(); }); },
  async toggle() { if (!this.has()) { if (await ask('還沒有設定密碼。要現在設定嗎？\n設定後進入記帳・對帳要先輸入密碼或指紋。', '設定密碼')) await accSetPin(); this.paint(); return; }
    if (this.open()) { this.relock(); this.paint(); buzz(30); toast('🔒 記帳已上鎖'); if (S.inAcc) this.gate(); }
    else if (await this.need()) { buzz(20); toast('🔓 已解鎖'); } this.paint(); }
};
/* 數字鍵盤（像手機鎖屏） */
function accPinPad(o) {
  let pin = '', done = false; const target = o.mode === 'new' ? 0 : AccLock.len(), bio = o.bio && AccLock.bioOk() && o.mode !== 'new';
  const sh = sheet({title: o.title || '輸入密碼', foot: target ? '' : `<button class="btn pri" data-a="ok" style="flex:1">${esc(o.okText || '確定')}</button>`, onClose() { if (!done && o.onCancel) o.onCancel(); }});
  sh.body.innerHTML = `<div class="pinBox"><div class="pinLock">🔒</div><div class="pinDots"></div><div class="pinMsg">${esc(o.msg || (o.mode === 'new' ? '6～16 位數字' : ''))}</div><div class="pinKeys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map(k => `<button class="pinKey ${k === 'bio' && !bio ? 'ghost' : ''}" data-k="${k}">${k === 'del' ? '⌫' : k === 'bio' ? (bio ? '👆' : '') : k}</button>`).join('')}</div></div>`;
  const box = $('.pinBox', sh.body), dots = $('.pinDots', sh.body), msg = $('.pinMsg', sh.body);
  const paint = () => { dots.innerHTML = Array.from({length: Math.max(6, pin.length)}, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
  const fail = t => { buzz(60); msg.textContent = t; msg.classList.add('err'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); pin = ''; paint(); };
  const finish = v => { done = true; buzz(25); sh.close(); o.onOk && o.onOk(v); };
  const submit = async () => { if (pin.length < 6) { fail('至少要 6 位數字'); return; } if (o.mode === 'new' || o.raw) { finish(pin); return; }
    const r = await AccLock.check(pin); if (r.ok) { finish(pin); return; }
    if (r.wait) { const sec = Math.ceil(r.wait / 1000); fail('輸錯太多次，請 ' + (sec >= 60 ? Math.ceil(sec / 60) + ' 分鐘' : sec + ' 秒') + '後再試'); return; }
    fail('密碼錯誤' + (r.fails ? `（已錯 ${r.fails} 次${r.fails >= 3 ? '，錯 5 次要等待' : ''}）` : '')); };
  const doBio = () => { if (!bio) return; AccLock.bioCb = d => { AccLock.bioCb = null; if (d.ok) finish(''); }; NB.lockBio(o.title ? o.title.replace(/^🔒\s*/, '') : '解鎖記帳'); };
  sh.body.onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; buzz(10);
    if (k === 'del') { pin = pin.slice(0, -1); paint(); return; } if (k === 'bio') { doBio(); return; } if (pin.length >= 16) return;
    pin += k; paint(); msg.classList.remove('err'); if (target && pin.length === target) setTimeout(submit, 120); };
  if (sh.foot) sh.foot.onclick = e => { if (e.target.closest('[data-a=ok]')) submit(); };
  paint(); if (bio) setTimeout(doBio, 300);
}
/* 設定／更改密碼：輸入兩次；已經有密碼要先輸入舊密碼（不能用指紋） */
function accSetPin() {
  return new Promise(res => { const had = AccLock.has();
    const askNew = old => accPinPad({title: had ? '設定新密碼' : '設定記帳密碼', mode: 'new', msg: '輸入 6～16 位數字', okText: '下一步', onCancel: () => res(false), onOk: p1 =>
      accPinPad({title: '再輸入一次新密碼', mode: 'new', okText: '完成', onCancel: () => res(false), onOk: async p2 => {
        if (p1 !== p2) { toast('兩次輸入的密碼不一樣，請重新設定', 3000); res(false); return; }
        const e = await AccLock.set(old, p1); if (e) { toast('❌ ' + e, 3500); res(false); return; }
        toast(had ? '✓ 已更改密碼' : '✓ 已設定密碼，記帳・對帳已上鎖保護'); AccLock.paint(); res(true); }})});
    if (!had) { askNew(''); return; }
    accPinPad({title: '先輸入目前的密碼', raw: true, okText: '下一步', onCancel: () => res(false), onOk: async old => { const r = await AccLock.check(old); if (!r.ok) { toast(r.wait ? '輸錯太多次，請稍後再試' : '密碼錯誤', 3000); res(false); return; } askNew(old); }}); });
}
async function accClearPin() {
  if (!AccLock.has()) return; if (!await ask('移除密碼後，進入記帳・對帳就不用解鎖。確定要移除嗎？', '移除密碼', true)) return;
  accPinPad({title: '輸入密碼以移除', raw: true, onOk: async p => { const e = await AccLock.clear(p); if (e) { toast('❌ ' + e, 3000); return; } toast('已移除密碼'); AccLock.paint(); renderAccCfg(); }});
}
/* 進入記帳：有密碼要先解鎖；第一次用而且沒有密碼時推薦設定（不強制） */
async function enterAcc(tab) {
  if (!await AccLock.need()) return false;
  S.inAcc = true; saveS(); document.body.classList.add('mAcc'); showTab(tab || 'Acc');
  if (!AccLock.has() && !S.accPinAsked) { S.accPinAsked = 1; saveS(); setTimeout(async () => {
    if (await ask('記帳・對帳裡有你的收支和帳戶資料。\n建議設定一組 6 位數密碼（可以用指紋解鎖），進入前要先解鎖。\n不設定也可以照常使用，之後可以到 記帳 → 設定 → 上鎖 再設定。', '設定密碼')) accSetPin(); }, 500); }
  return true;
}
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
  box.innerHTML = `<button class="acTplBtn card" data-a="tpls"><span class="acTplI">⭐</span><span class="grow"><b>常用紀錄</b><small>${DB.acc.tpls.length ? `${DB.acc.tpls.length} 個常用紀錄` : '每月房租、手機費…點一下就記好'}</small></span><span class="acDGo">打開 ›</span></button>
    <div class="acSum card"><div class="acT out"><small>支出（我的）</small><b>${money(out)}</b></div><div class="acT in"><small>收入</small><b>${money(inc)}</b></div><div class="acT bal"><small>結餘</small><b>${money(inc - out - lossM)}</b></div></div>${lossM ? `<div class="acLoss card">💸 這個月遺失 <b>${money(lossM)}</b><small>（另外統計，已算進結餘）</small></div>` : ''}
    ${dIds.length ? `<div class="acDebt card"><div class="acDH"><b>🤝 還沒結清的欠款</b><span class="row" style="gap:.35rem"><button class="btn sm" data-a="settleHist">📚 歷史</button><button class="btn sm" data-a="settleLog">對帳紀錄</button></span></div>${dIds.map(p => { const u = aWho(p), v = debts[p]; return `<button class="acDR" data-settle="${p}"><span class="acDI">${esc(u.icon)}</span><span class="grow"><b>${esc(u.name)}</b><small>${v > 0 ? '欠我' : '我欠他'}</small></span><span class="acDV ${v > 0 ? 'pos' : 'neg'}">${money(Math.abs(v))}</span><span class="acDGo">對帳 ›</span></button>`; }).join('')}</div>` : ''}
    <div class="cal card">${calHead(Y, Mo)}<div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG acCal">${cells}</div></div>
    ${Acc.day ? `<div class="invDayBar"><span class="grow">📅 只看 ${dayLabel(Acc.day)}</span><button class="btn sm" data-a="allDays">看整個月</button></div>` : ''}
    ${days.map(g => { const s = g.L.reduce((t, r) => t + accSign(r) * accMine(r), 0); return `<div class="acDay"><span>${dayLabel(g.d)}</span>${s ? `<b class="${s > 0 ? 'pos' : 'neg'}">${s > 0 ? '+' : ''}${money(s)}</b>` : ''}</div>${g.L.map(accCard).join('')}`; }).join('')
      || `<div class="empty mealEmpty"><span class="big">📒</span>${Acc.day ? '這天' : '這個月'}還沒有記帳<br><span class="small">按上面的「＋ 記一筆」，或「從分帳匯入」把消費明細帶進來</span></div>`}`;
}
function accCard(r) {
  const c = accCat(r), me = accMe(), sp = (r.split || []).filter(s => s.p !== me), payer = r.payer || me;
  if (r.type === 'loss') return `<button class="acR card" data-r="${r.id}"><span class="acI loss">💸</span><span class="acM"><b>金額遺失${r.note ? `<em>${esc(String(r.note).split('\n')[0])}</em>` : ''}</b><small>${esc([r.t, acctName(r.acct)].filter(Boolean).join('・'))}</small></span><span class="acV neg">-${money(r.amt)}</span></button>`;
  if (r.type === 'tr') { const nl = String(r.note || '').split('\n'), ext = '外部' + (r.via ? `（${r.via}）` : '');
    return `<button class="acR card" data-r="${r.id}"><span class="acI tr ${c.k || ''}">${r.settle ? '🤝' : c.svg || '🔄'}</span><span class="acM"><b>${esc(nl[0] || c.n)}</b><small>${esc([r.t, (r.acct ? acctName(r.acct) : ext) + ' → ' + (acctName(r.to) || ext), +r.fee ? '手續費 ' + money(r.fee) : ''].filter(Boolean).join('・'))}</small>${nl.length > 1 ? `<span class="acNoteL">${esc(nl.slice(1).join('\n'))}</span>` : ''}</span><span class="acV ${r.settle && r.to ? 'pos' : ''}">${money(r.amt)}</span></button>`; }
  const chips = sp.length ? (payer === me ? sp.map(s => { const st = (r.settled || {})[s.p]; return `<span class="acChip ${st ? 'ok' : ''}">${esc(aWho(s.p).name)} 欠 ${money(s.amt)}${st ? ' ✓' : ''}</span>`; }).join('')
    : `<span class="acChip ${(r.settled || {})[payer] ? 'ok' : 'neg'}">${esc(aWho(payer).name)} 付・我欠 ${money(-accOwe(r, payer))}${(r.settled || {})[payer] ? ' ✓' : ''}</span>`) : '';
  const first = String(r.note || '').split('\n')[0];
  return `<button class="acR card" data-r="${r.id}"><span class="acI">${esc(c.i)}</span><span class="acM"><b>${esc(r.payee || c.n)}${r.payee ? `<em>${esc(c.n)}</em>` : ''}</b><small>${[r.t, acctName(r.acct), first, (r.imgs || []).length ? '🖼️' + r.imgs.length : ''].filter(Boolean).map(esc).join('・')}</small>${chips ? `<span class="acChips">${chips}</span>` : ''}</span>
    <span class="acV ${r.type === 'in' ? 'pos' : 'neg'}">${r.type === 'in' ? '+' : '-'}${money(r.amt)}${sp.length && r.type === 'out' ? `<small>我 ${money(accMine(r))}</small>` : ''}</span></button>`;
}
/* 點常用紀錄：一律先打開「記一筆」讓你確認內容（金額有設就帶入），按儲存才記下 */
async function useTpl(t) {
  const pre = JSON.parse(JSON.stringify(t)); delete pre.id; delete pre.name; if (!(+pre.amt > 0)) { pre.amt = 0; pre.split = (pre.split || []).map(x => ({p: x.p, amt: 0})); }
  await accEdit(null, pre);
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
    else if (a === 'settleLog') accSettleLog(); else if (a === 'settleHist') accSettleHist(); else if (a === 'tpls') tplList(); });
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
  return `<div class="dkSeg acKind">${Object.entries(AK).map(([k, [n, i]]) => `<button data-kind="${k}" data-key="${key}" class="${k === kind ? 'on' : ''}"><span>${i}</span><b>${n}</b></button>`).join('')}</div>
    <div class="acAccts">${L.map(x => `<button data-acct="${x.id}" data-key="${key}" class="${x.id === cur ? 'on' : ''}">${aIco(x)}<span class="acN ${[...x.n].length > 7 ? 'lg' : ''}">${esc(x.n)}</span></button>`).join('')}<button data-a="addAcct" data-kind="${kind}" data-key="${key}" class="add">＋ 新增${AK[kind][0]}</button></div>
    ${a && a.kind === 'pay' ? `<div class="acFund"><small>實際從哪裡扣款</small><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'card' || x.kind === 'stored').map(x => `<button data-fund="${x.id}" data-fk="${fk}" class="${x.id === F ? 'on' : ''}">${aIco(x)}<span class="acN ${[...x.n].length > 7 ? 'lg' : ''}">${esc(x.n)}</span></button>`).join('') || '<span class="muted small">先新增銀行、信用卡或儲值帳戶</span>'}</div></div>` : ''}`;
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
function accEdit(r0, preset, opt = {}) { accMigVia();
  return new Promise(res => {
    const isNew = !r0, me = accMe(), now = new Date(), TPL = !!opt.tpl;
    const r = JSON.parse(JSON.stringify(r0 || Object.assign({id: 'r' + uid(), d: Acc.day || ymd(now), t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), type: 'out', amt: 0, cat: '', acct: (DB.acc.accts[0] || {}).id || '', to: '', fee: 0, note: '', payee: '', payer: me, split: [], items: [], imgs: []}, preset || {})));
    if (!r.d) r.d = Acc.day || ymd(now); if (!r.t) r.t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    r.imgs = r.imgs || []; if (!r.cat && (r.type === 'out' || r.type === 'in')) r.cat = firstCat(r.type);
    let expr = r.amt ? String(r.amt) : '', openP = '', mode = (r.split || []).length && r.split.some((s, i, A) => Math.abs(s.amt - A[0].amt) > 0.011) ? 'custom' : 'even', saved = false;
    let who = (r.split || []).map(s => s.p), custom = {}; (r.split || []).forEach(s => { custom[s.p] = s.amt; });
    const sh = sheet({title: TPL ? (isNew ? '⭐ 新增常用紀錄' : '⭐ 編輯常用紀錄') : isNew ? '📒 記一筆' : '📒 編輯記帳', full: true, foot: TPL ? `<div class="tplFoot ${isNew ? 'new' : ''}">${isNew ? '' : '<button class="btn danger" data-a="del">🗑 刪除</button><button class="btn" data-a="saveAs">＋ 另存常用</button>'}<button class="btn pri" data-a="ok">✓ ${isNew ? '儲存常用紀錄' : '儲存'}</button></div>` : `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn" data-a="tpl" style="flex:0 0 auto">⭐ 存成常用</button><button class="btn pri" data-a="ok">儲存</button>`, onClose() { if (!saved) res(null); }});
    const evalX = e2 => { try { const s2 = String(e2).replace(/×/g, '*').replace(/÷/g, '/').replace(/[^\d.+\-*/]/g, '').replace(/[+\-*/.]+$/, ''); if (!s2) return 0; const v = Function('"use strict";return (' + s2 + ')')(); return isFinite(v) ? r2(v) : 0; } catch (e) { return 0; } };
    const calc = () => evalX(expr);
    const shares = () => { const A = calc(); if (!who.length) return []; if (mode === 'custom') return who.map(p => ({p, amt: r2(+custom[p] || 0)}));
      const base = Math.floor(A / who.length * 100) / 100; let rest = r2(A - base * who.length); return who.map(p => { let v = base; if (rest > 0.001) { v = r2(v + 0.01); rest = r2(rest - 0.01); } return {p, amt: v}; }); };
    const draw = () => { const A = calc(), sp = shares(), sumSp = r2(sp.reduce((s, x) => s + x.amt, 0)), payer = r.payer || me, top = sh.body.scrollTop, tr = r.type === 'tr';
      sh.body.innerHTML = `<div class="acType four"><button data-ty="out" class="${r.type === 'out' ? 'on' : ''}">支出</button><button data-ty="in" class="${r.type === 'in' ? 'on' : ''}">收入</button><button data-ty="tr" class="${tr ? 'on' : ''}">轉帳</button><button data-ty="loss" class="${r.type === 'loss' ? 'on' : ''}">遺失</button></div>
        <div class="acAmt ${r.type}"><span class="acCur">NT$</span><b id="acA">${expr ? esc(expr) : '0'}</b>${/[+\-×÷]/.test(expr) ? `<small>= ${money(A)}</small>` : ''}</div>
        <div class="acKeys">${['AC', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '00', '0', '.'].map(k => `<button data-k="${k}" class="${/[⌫+−×÷]|AC/.test(k) ? 'op' : k === '=' ? 'eq' : ''}">${k}</button>`).join('')}</div>
        ${TPL ? '<div class="small muted" style="margin:-.5rem 0 .8rem">常用紀錄的金額可以留 0（例如每期不一樣的電費），點常用紀錄時會打開「記一筆」讓你輸入金額再儲存。</div>' : ''}
        ${TPL ? `<div class="field"><label>常用紀錄名稱</label><input id="acTn" value="${esc(r.name || '')}" placeholder="例如：房租、手機月租"></div>` : ''}<div class="acRow2 ${TPL ? 'hide' : ''}"><button class="btn" data-a="date">📅 ${r.d.replace(/-/g, '/')}（${MWD[ymdDate(r.d).getDay()]}）</button><button class="btn" data-a="time">🕒 ${esc(r.t || '時間')}</button></div>
        ${tr && r.settle ? (() => { const inn = !r.acct, k = inn ? 'to' : 'acct'; return `<div class="lbl">${inn ? '從哪裡轉進來' : '轉給對方'}</div><div class="acExt">🌐 外部（對方的帳戶／支付）</div><div class="lbl">付款方式</div><div class="acAccts">${SETTLE_VIA.map(v => `<button data-via="${v}" class="${v === r.via ? 'on' : ''}">${v}</button>`).join('')}</div><div class="lbl">${inn ? '收進我的哪個帳戶' : '從我的哪個帳戶付'}</div><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'cash').map(x => `<button data-sacct="${k}:${x.id}" class="${x.id === r[k] ? 'on' : ''}">${aIco(x)}<span class="acN ${[...x.n].length > 7 ? 'lg' : ''}">${esc(x.n)}</span></button>`).join('')}</div>`; })() : tr ? `<div class="lbl">從哪個帳戶轉出</div>${acctPickerHtml(r.acct, 'acct', r.fund)}<div class="lbl">轉入哪個帳戶</div>${acctPickerHtml(r.to, 'to', r.fund2)}<div class="field" style="margin-top:.6rem"><label>手續費（沒有就留空）</label><input id="acFee" value="${+r.fee ? r.fee : ''}" inputmode="decimal" placeholder="0"></div>`
        : r.type === 'loss' ? `<div class="lbl">從哪裡遺失的（現金、銀行、卡片…）</div>${acctPickerHtml(r.acct, 'acct', r.fund)}<div class="small muted" style="margin:.2rem 0 .4rem">💸 金額遺失會從這個帳戶扣掉，另外統計，不算在支出裡。</div>`
        : `<div class="lbl">類別</div>${catPickerHtml(r.type, r.cat, openP)}
        <div class="lbl">商家／對象</div><button class="acPayee" data-a="payee">${r.payee ? `<b>${esc(r.payee)}</b>` : '<span class="muted">選擇店名，或自訂名稱（例如：台灣電力公司）</span>'}<i>›</i></button>${r.payee && !isPcatPayee(r.payee) && r.type !== 'tr' ? (storeLoc(r.payee) ? `<div class="pyLocT on">📍 已連結地圖${storeLoc(r.payee).addr ? '・' + esc(storeLoc(r.payee).addr) : ''}</div>` : '<button class="pyLocT" data-a="pinP">📌 這間店還沒有地圖位置，點這裡釘選</button>') : ''}
        <div class="lbl">${r.type === 'in' ? '收進哪個帳戶' : '付款帳戶'}</div>${acctPickerHtml(r.acct, 'acct', r.fund)}`}
        ${r0 && Object.keys(r.settled || {}).length ? `<div class="acSetl">${Object.keys(r.settled).map(p => `<div class="row" style="gap:.5rem"><span class="grow">✓ 已和 ${esc(aWho(p).name)} 結清</span><button class="btn sm" data-unst="${p}">改回未結清</button></div>`).join('')}</div>` : ''}
        <div class="field" style="margin-top:.7rem"><label class="row" style="gap:.4rem"><span class="grow">備註／消費明細</span></label>${tr ? '' : `<div class="acRow2" style="margin-bottom:.5rem"><button class="btn" data-a="billEd">🧾 ${r.bill ? '編輯明細（' + (r.bill.items || []).length + ' 項）' : '用分帳方式輸入'}</button><button class="btn" data-a="fromBill">📥 從分帳帶入</button></div>`}<textarea id="acNote" rows="${Math.min(10, Math.max(3, String(r.note || '').split('\n').length + 1))}" placeholder="例如：\n鮮奶 ×2  $95\n雞蛋  $60">${esc(r.note || '')}</textarea></div>
        ${tr ? '' : accInvHtml(r)}
        <div class="lbl">圖片</div><div class="acImgs">${r.imgs.map((id, i) => `<span class="acImg"><img data-img="${id}" data-i="${i}" alt=""><button data-rmimg="${i}" aria-label="移除">✕</button></span>`).join('')}<button class="acImgAdd" data-a="addImg">＋<small>加入圖片</small></button></div>
        ${r.type === 'out' ? `<div class="acSplit card"><div class="acSH"><b>🤝 分帳</b><small>${who.length ? '選了 ' + who.length + ' 人分' : '不分帳就不用選'}</small></div>
          <div class="lbl">誰付的錢</div><div class="whoRow pplGrid">${accPeople().map(u => `<button data-payer="${u.id}" class="${payer === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div>
          <div class="lbl">誰要分（點選）</div><div class="whoRow pplGrid">${accPeople().map(u => `<button data-who="${u.id}" class="${who.includes(u.id) ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}<button data-a="addP">＋ 新增</button></div>
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
      else if (a === 'invPick') { const v = await pickInvForAcc(r); if (!v) return; accLinkInv(r, v.no);
        const iv = (v.items || []).filter(x => +x.amt > 0), had = (r.items || []).length || (r.bill && (r.bill.items || []).length);
        if (iv.length && had) { const ch = await accChoose('品項名稱要以哪個為主？', [['mine', '用我輸入的名稱', '發票只拿來對號碼、時間'], ['inv', '用發票上的名稱', '依順序把品項名稱換成發票上的'], ['edit', '我自己編輯', '先帶入發票資訊，再打開明細讓你改']]);
          if (ch === 'inv') accInvNames(r, iv); else if (ch === 'edit') { draw(); sh.body.querySelector('[data-a="billEd"]').click(); return; } }
        else if (iv.length && !String(r.note || '').trim()) { r.note = `${invSeller(v)}${v.time ? ' ' + v.time : ''}\n` + iv.map(x => `${x.n}${x.q > 1 ? ' ×' + x.q : ''}　${money(x.amt)}`).join('\n'); }
        if (!(+r.amt > 0) && +v.total > 0) expr = String(v.total); draw(); toast('🧾 已帶入發票 ' + v.no); return; }
      else if (a === 'invNo') { const v = ((await askText('發票號碼（例如 AB12345678）', r.inv || '')) || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!v) return; if (!/^[A-Z]{2}\d{8}$/.test(v)) { await alertBox('發票號碼是 2 個英文字母加 8 個數字，例如 AB12345678。'); return; } accLinkInv(r, v); draw(); return; }
      else if (a === 'invRm') { if (!await ask('拿掉這筆記帳的發票號碼？（發票本身不會刪除）', '拿掉', true)) return; const v = (DB.invs || {})[r.inv]; if (v && v.acc === r.id) { delete v.acc; saveInvs(); } r.inv = ''; draw(); return; }
      else if (a === 'invQr') { accInvQr(r); return; }
      else if (a === 'invOpen') { const v = (DB.invs || {})[r.inv]; if (v) openInvDetail(v.no); return; }
      else if (a === 'fromBill') { const pick = await pickBillForAcc(); if (!pick) return; const x = billToAccRec(pick.b, pick.k);
        /* 原本已經自己輸入了明細：讓你選要保留自己的品項名稱，還是改用分帳（發票）的 */
        const had = (r.items || []).length || (r.bill && (r.bill.items || []).length) || String(r.note || '').trim();
        if (had) { const ch = await accChoose('這筆已經有你自己輸入的明細', [['keep', '保留我的明細', '只帶入發票號碼、日期時間' + (x.inv ? '' : '（這筆分帳沒有發票）')], ['bill', '改用分帳的明細', '品項名稱、金額、分帳都換成分帳那筆的']]); if (!ch) return;
          if (ch === 'keep') { if (x.inv) accLinkInv(r, x.inv); else { r.d = x.d; if (x.t) r.t = x.t; } r.src = Object.assign({}, r.src || {}, {bill: pick.b.id}); pick.b.acc = r.id; saveBills(); draw(); toast(x.inv ? '已帶入發票資訊，明細保留你原本的' : '已帶入日期時間'); return; } }
        x.imgs = await copyImgs(pick.b.imgs); if (x.inv) accLinkInv(r, x.inv);
        Object.assign(r, {d: x.d, t: x.t || r.t, type: 'out', cat: x.cat, payee: x.payee, note: x.note, items: x.items, split: x.split, payer: me, src: x.src}); r.imgs = r.imgs.concat(x.imgs); expr = String(x.amt);
        who = x.split.map(s => s.p); custom = {}; x.split.forEach(s => { custom[s.p] = s.amt; }); mode = x.split.length && x.split.some((s, i, A2) => Math.abs(s.amt - A2[0].amt) > 0.011) ? 'custom' : 'even'; pick.b.acc = r.id; saveBills(); draw(); toast('已帶入分帳明細'); } });
    const build = () => { const A = calc(); r.amt = A; if (r.type === 'out') { r.split = shares(); if (r.split.length === 1 && r.split[0].p === (r.payer || me)) r.split = []; } else { r.split = []; r.payer = me; } if (r.type === 'tr' || r.type === 'loss') { r.cat = ''; r.payee = ''; } return A; };
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; keep(); buzz(10);
      if (TPL) { if (b.dataset.a === 'del') { if (!await ask('刪除這個常用紀錄？', '刪除', true)) return; DB.acc.tpls = DB.acc.tpls.filter(x => x.id !== r.id); saveAcc(); saved = true; sh.close(); res(null); return; }
        const A = build(); if (A < 0) { toast('金額不正確'); return; } if (!r.name) { toast('請輸入常用紀錄名稱'); return; } if (r.type === 'tr' && (!r.to || r.to === r.acct)) { toast('請選擇不同的轉出、轉入帳戶'); return; }
        const t = JSON.parse(JSON.stringify(r)); ['d', 't', 'settled', 'imgs', 'src', 'items'].forEach(k => delete t[k]); if (!t.id || t.id[0] !== 'T') t.id = 'T' + uid(); t.name = t.name.slice(0, 20);
        /* 另存常用：原本那筆不動，存成一筆新的（放在原本那筆後面） */
        if (b.dataset.a === 'saveAs') { const orig = DB.acc.tpls.find(x => x.id === t.id); t.id = 'T' + uid(); if (orig && orig.name === t.name) t.name = (t.name + '（複製）').slice(0, 20);
          const at = DB.acc.tpls.indexOf(orig); if (at >= 0) DB.acc.tpls.splice(at + 1, 0, t); else DB.acc.tpls.push(t); saveAcc(); saved = true; sh.close(); toast('⭐ 已另存成新的常用紀錄'); res(t); return; }
        const i = DB.acc.tpls.findIndex(x => x.id === t.id); if (i >= 0) DB.acc.tpls[i] = t; else DB.acc.tpls.push(t); saveAcc(); saved = true; sh.close(); toast('⭐ 已儲存常用紀錄'); res(t); return; }
      if (b.dataset.a === 'del') { if (!await ask('確定要刪除這筆記帳嗎？', '刪除', true)) return; DB.acc.recs = DB.acc.recs.filter(x => x.id !== r.id); for (const id of r.imgs || []) imgDel(id); saveAcc(); saved = true; sh.close(); renderAcc(); toast('已刪除'); res(null); return; }
      const A = build(); if (!(A > 0) && b.dataset.a !== 'tpl') { await alertBox('還沒有輸入金額，請先輸入這筆的金額再儲存。'); return; }
      if (r.type === 'tr' && !r.settle && (!r.to || r.to === r.acct)) { toast('請選擇不同的轉出、轉入帳戶'); return; }
      if (r.type === 'tr' && r.settle && !(r.to || r.acct)) { await alertBox('請選擇收進哪個帳戶（銀行或現金）'); return; }
      if (b.dataset.a === 'tpl') { const nm = ((await askText('常用紀錄的名稱（例如：房租、手機月租）', r.payee || accCat(r).n)) || '').trim(); if (!nm) return;
        /* 常用紀錄可以不填金額：每次使用時再輸入（例如電費） */
        const t = JSON.parse(JSON.stringify(r)); if (!(+t.amt > 0)) { t.amt = 0; t.split = (t.split || []).map(x => ({p: x.p, amt: 0})); } ['id', 'd', 't', 'settled', 'imgs', 'src', 'items'].forEach(k => delete t[k]); t.id = 'T' + uid(); t.name = nm.slice(0, 20); DB.acc.tpls.push(t); saveAcc(); toast(`⭐ 已存成常用「${t.name}」，在記帳頁「常用紀錄」點一下就會記帳`); return; }
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
  const sh = sheet({title: '🤝 要跟誰對帳？', html: `<button class="btn block" data-hist="1" style="margin-bottom:.6rem">📚 對帳還款歷史（已完成／未完成）</button><div class="actList">${ids.map(p => `<button data-p="${p}">${esc(aWho(p).icon)} ${esc(aWho(p).name)}　<b class="${d[p] > 0 ? 'pos' : 'neg'}">${d[p] > 0 ? '欠我' : '我欠'} ${money(Math.abs(d[p]))}</b></button>`).join('')}${others.map(u => `<button data-p="${u.id}">${esc(u.icon)} ${esc(u.name)}　<span class="muted">沒有未結清</span></button>`).join('')}</div>`});
  sh.body.onclick = e => { if (e.target.closest('[data-hist]')) { buzz(10); sh.close(); accSettleHist(); return; } const t = e.target.closest('[data-p]'); if (!t) return; buzz(10); sh.close(); accSettle(t.dataset.p); };
}
/* 對帳：每一筆可以勾選要不要這次結清（有的先還、有的之後還），勾選的這幾筆可以選錢進出哪個帳戶；結清後畫面留著，剩下的可以再選別的帳戶結清 */
const SETTLE_VIA = ['LINE Pay', '台灣 Pay', '街口支付', '銀行轉帳', '現金支付', '其他'];
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
  let from = pend()[0].d, to = ymd(new Date()), open = new Set(), into = '', off = new Set(), via = '', lastSt = null;
  const sh = sheet({title: `🤝 和 ${u.icon} ${u.name} 對帳`, full: true, foot: '<div class="stFoot"><button class="btn" data-a="copy">📋 複製</button><button class="btn" data-a="csv">📤 CSV</button><button class="btn pri" data-a="ok">✅ 結清</button></div>'});
  const list = () => pend().filter(r => r.d >= from && r.d <= to), picked = () => list().filter(r => !off.has(r.id));
  const sum = L => r2(L.reduce((s, r) => s + accOwe(r, p), 0));
  const draw = () => { const L = list(), P = picked(), T = sum(L), TP = sum(P), top = sh.body.scrollTop;
    const undoBar = lastSt && DB.acc.settles.includes(lastSt) ? `<div class="stUndo"><span>✅ 剛剛結清 ${lastSt.recs.length} 筆・${money(Math.abs(lastSt.amt))}</span><button class="btn sm" data-a="undoLast">↩ 整批還原</button></div>` : '';
    if (!pend().length) { sh.body.innerHTML = undoBar + `<div class="empty mealEmpty"><span class="big">🎉</span>和 ${esc(u.name)} 的帳都結清了</div>`; sh.foot.classList.add('hide'); return; }
    sh.foot.classList.remove('hide'); sh.body.innerHTML = undoBar + `<div class="acStH ${T >= 0 ? 'pos' : 'neg'}"><small>${from.replace(/-/g, '/')} ～ ${to.replace(/-/g, '/')}・${L.length} 筆</small><b>${T >= 0 ? `${esc(u.name)} 欠我` : `我欠 ${esc(u.name)}`}</b><strong>${money(Math.abs(T))}</strong>${P.length !== L.length ? `<small>這次勾選 ${P.length} 筆：${TP >= 0 ? '他還我' : '我還他'} <b>${money(Math.abs(TP))}</b></small>` : ''}</div>
      <div class="acRow2"><button class="btn" data-a="from">從 ${from.replace(/-/g, '/')}</button><button class="btn" data-a="to">到 ${to.replace(/-/g, '/')}</button></div>
      <div class="row" style="gap:.4rem;margin:-.3rem 0 .5rem"><button class="btn sm" data-a="all">全選</button><button class="btn sm" data-a="none">全不選</button><span class="small muted grow" style="text-align:right">勾選這次要結清的</span></div>
      <div class="acStL card">${L.map(r => { const c = accCat(r), o = accOwe(r, p), on = !off.has(r.id), its = (r.items || []).filter(x => (x.ppl || []).includes(p) || (r.payer === p && (x.ppl || []).includes(accMe()))); return `<div class="acStR ${on ? '' : 'dim'}"><button class="acCk2 ${on ? 'on' : ''}" data-ck="${r.id}" aria-label="勾選"></button><span class="acStD">${r.d.slice(5).replace('-', '/')}</span><span class="grow" data-o="${r.id}"><b>${esc(c.i)} ${esc(r.payee || c.n)}</b><small>總額 ${money(r.amt)}・${r.payer === p ? esc(u.name) + ' 付' : '我付'}${its.length ? '・' + its.length + ' 個品項 ' + (open.has(r.id) ? '▴' : '▾') : ''}</small>
        ${open.has(r.id) && its.length ? `<span class="acStIt">${its.map(x => `<span>${esc(x.n)}<em>${money(x.amt / ((x.ppl || []).length || 1))}</em></span>`).join('')}</span>` : ''}</span><b class="${o >= 0 ? 'pos' : 'neg'}">${o >= 0 ? '' : '-'}${money(Math.abs(o))}</b></div>`; }).join('') || '<div class="empty">這段期間沒有紀錄</div>'}</div>
      <div class="lbl" style="margin-top:.8rem">勾選的這 ${P.length} 筆：${TP >= 0 ? '錢收進哪個帳戶' : '從哪個帳戶付給他'}<span class="req">必選</span></div>
      <div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'cash').map(x => `<button data-acct="${x.id}" class="${x.id === into ? 'on' : ''}">${aIco(x)}<span class="acN ${[...x.n].length > 7 ? 'lg' : ''}">${esc(x.n)}</span></button>`).join('')}<button data-a="addAcct" data-kind="bank" class="add">＋ 新增銀行</button></div>
      <div class="lbl">${TP >= 0 ? '對方怎麼付給我的' : '我怎麼付給他的'}（選填）</div><div class="acAccts">${SETTLE_VIA.map(v => `<button data-via="${v}" class="${v === via ? 'on' : ''}">${v}</button>`).join('')}</div>
      <div class="small muted" style="margin-top:.6rem">結清後這幾筆就不會再算進欠款，剩下沒勾的會留著，可以之後再結清、或選別的帳戶。在「對帳紀錄」可以取消結清。</div>`;
    sh.body.scrollTop = top; };
  const text = () => { const L = picked(), T = sum(L); return [`🤝 ${u.name} 對帳（${from.replace(/-/g, '/')}～${to.replace(/-/g, '/')}）`, ''].concat(L.map(r => { const c = accCat(r), o = accOwe(r, p), its = (r.items || []).filter(x => (x.ppl || []).includes(p)); return `${r.d.slice(5).replace('-', '/')} ${r.payee || c.n}　${o >= 0 ? '' : '-'}${money(Math.abs(o))}` + (its.length ? '\n' + its.map(x => `　・${x.n} ${money(x.amt / ((x.ppl || []).length || 1))}`).join('\n') : ''); })).concat(['', T >= 0 ? `合計：${u.name} 欠我 ${money(T)}` : `合計：我欠 ${u.name} ${money(-T)}`]).join('\n'); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-o],[data-ck],[data-acct],[data-kind],[data-fund],[data-via]'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.a === 'undoLast') { sh.foot.onclick({target: t}); return; }
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
      Acc.day = null; Acc.ym = null; saveAcc(); renderAcc(); buzz(40); off.clear(); into = ''; via = ''; lastSt = st; draw(); toastUndo(`✅ 已結清 ${L.length} 筆`, () => { undoSettle(st); lastSt = null; draw(); toast('↩ 已整批還原'); }); }
    else if (a === 'undoLast') { if (!lastSt) return; if (!await ask(`把剛剛結清的 ${lastSt.recs.length} 筆整批還原成未結清？那筆還款也會刪除。`, '整批還原', true)) return; undoSettle(lastSt); lastSt = null; sh.foot.classList.remove('hide'); draw(); toast('↩ 已整批還原'); } };
}
/* 整批還原一次結清：那次勾選的紀錄全部回到未結清，還款那筆也刪掉 */
function undoSettle(st) { if (!st) return 0; const n = st.recs.length; DB.acc.recs.forEach(r => { if (r.settled && r.settled[st.p] === st.id) delete r.settled[st.p]; });
  DB.acc.recs = DB.acc.recs.filter(r => r.settle !== st.id); DB.acc.settles = DB.acc.settles.filter(x => x !== st); saveAcc(); renderAcc(); return n; }
/* 對帳紀錄清理：記帳裡已經刪掉的紀錄從結清裡拿掉；一筆都不剩的結清就移除（還款那筆照樣留在記帳，只是不再算是結清） */
function accPruneSettles() { const A = DB.acc, ids = new Set(A.recs.map(r => r.id)); let ch = false;
  A.settles = A.settles.filter(st => { const k = st.recs.filter(id => ids.has(id)); if (k.length !== st.recs.length) { st.recs = k; ch = true; }
    if (k.length) return true; A.recs.forEach(r => { if (r.settle === st.id) delete r.settle; }); ch = true; return false; });
  return ch; }
function accSettleLog() {
  if (accPruneSettles()) saveAcc();
  let showOk = false; const sh = sheet({title: '📜 對帳紀錄', full: true}), open = new Set(); const draw = () => { const all = DB.acc.settles.slice().reverse(), L = all.filter(st => showOk || !st.ok), nOk = all.filter(st => st.ok).length;
    sh.body.innerHTML = (L.map(st => { const R = st.recs.map(id => DB.acc.recs.find(x => x.id === id)).filter(Boolean), tr = DB.acc.recs.find(x => x.settle === st.id);
      return `<div class="acLog card col ${st.ok ? 'ok' : ''}"><button class="acLogT" data-o="${st.id}"><span class="acDI">${esc(aWho(st.p).icon)}</span><span class="grow"><b>${esc(aWho(st.p).name)}・${st.amt >= 0 ? '他還我' : '我還他'}</b><b class="amt">${money(Math.abs(st.amt))}</b><small>${st.d} 結清・${R.length} 筆${tr && acctName(tr.to || tr.acct) ? '・' + esc(acctName(tr.to || tr.acct)) : ''}${tr && tr.via ? '・' + esc(tr.via) : ''} ${open.has(st.id) ? '▴' : '▾'}</small></span></button>
        ${open.has(st.id) ? `<div class="acLogL">${R.map(r => `<div class="acIt"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.payee || accCat(r).n)}</span><b>${money(Math.abs(accOwe(r, st.p)))}</b>${st.ok ? '' : `<button class="btn sm" data-x="${st.id}:${r.id}">改回未結清</button>`}</div>`).join('')}</div>` : ''}
        <div class="acLogB">${st.ok ? `<span class="okTag">✓ 已確認無誤</span><button class="btn sm" data-k="${st.id}">取消確認</button>` : `<button class="btn sm" data-u="${st.id}">↩ 整批還原</button><button class="btn sm pri" data-k="${st.id}">✓ 確認無誤</button>`}</div></div>`; }).join('') || `<div class="empty">${nOk ? '每一批都確認過了 👍' : '還沒有對帳紀錄'}</div>`)
      + (nOk ? `<button class="btn block acLogMore" data-a="showOk">${showOk ? '隱藏已確認的' : `顯示已確認的 ${nOk} 批`}</button>` : ''); };
  draw(); sh.body.onclick = async e => { const t = e.target.closest('[data-u],[data-o],[data-x],[data-k],[data-a]'); if (!t) return; buzz(8);
    if (t.dataset.a === 'showOk') { showOk = !showOk; draw(); return; }
    if (t.dataset.k) { const st = DB.acc.settles.find(x => x.id === t.dataset.k); if (!st) return;
      if (!st.ok && !await ask('確認這一批結清沒有問題？確認後就不會顯示在對帳紀錄裡（可以從下面「顯示已確認的」找回來）。', '確認無誤')) return;
      st.ok = !st.ok; saveAcc(); buzz(20); toast(st.ok ? '✓ 已確認，這批不再顯示' : '已取消確認'); draw(); return; }
    if (t.dataset.o) { if (open.has(t.dataset.o)) open.delete(t.dataset.o); else open.add(t.dataset.o); draw(); return; }
    if (t.dataset.x) { const [sid, rid] = t.dataset.x.split(':'), st = DB.acc.settles.find(x => x.id === sid), r = DB.acc.recs.find(x => x.id === rid); if (!st || !r) return; if (!await ask(`把「${r.payee || accCat(r).n}」改回未結清？這次結清的還款金額會跟著減少。`, '改回未結清')) return; unsettleRec(r, st.p); draw(); renderAcc(); toast('已改回未結清'); return; }
    if (!await ask('整批還原這次結清？這次勾選的紀錄會全部回到「未結清」，那筆還款也會刪除。', '整批還原', true)) return;
    const st = DB.acc.settles.find(x => x.id === t.dataset.u); undoSettle(st); draw(); toast('↩ 已整批還原'); renderAcc(); };
}

/* ---------- 從分帳匯入 ---------- */
function accGuessCat(b) {
  const P = (DB.places || []).find(x => x.id === b.place), cn = P ? (DB.cats.find(c => c.id === P.cat) || {}).name || '' : '', py = DB.acc.payees.find(x => x.n === billStore(b));
  if (py && py.cat) return py.cat; let hit = ''; const find = n => { DB.acc.cats.out.forEach(p => (p.subs || []).forEach(s => { if (!hit && s.n === n) hit = s.id; })); return hit; };
  return find(cn) || (/超市|量販|全聯|家樂福|大全聯|好市多/.test(cn + billStore(b)) ? find('食材生鮮') : '') || (/超商|便利/.test(cn) ? find('日用品') : '') || (/外送|foodpanda|uber/i.test((b.way || '') + cn) ? find('晚餐') : '') || find('日用品') || firstCat('out');
}
/* 分帳明細 → 備註（日常「模板二」的寫法：每個人列自己的品項和小計；平台費、包材費、整單折扣照分帳方式分攤） */
function accNoteFromBill(b) {
  const c = billCalc(b), ids = pOrder(Object.keys(c.per)), out = [`🏪 ${billStore(b) || '消費明細'}${b.time ? ' ' + b.time : ''}`, `🛒 購物方式：${b.way || '實體店購物'}`, ''];
  if (ids.length) { const L = billBlock(b); out.push(...L.slice(1)); return out.join('\n').replace(/\n(小計：[^\n]+)\n(?!合計)/g, '\n$1\n\n'); }
  (b.items || []).forEach(x => { const unit = (numP(x.amt) - (c.itemDisc[x.id] || 0)) / (x.q || 1); out.push(`${tn(x.n)}${x.o ? '(' + x.o + ')' : ''}[${ntd(unit)}]×${x.q || 1}`); });
  (b.odisc || []).forEach(d => out.push(`${d.n}：-${ntd(d.amt)}`)); (b.fees || []).forEach(d => out.push(`${d.n}：${ntd(d.amt)}`)); out.push(`合計：${ntd(c.computed)}`); return out.join('\n');
}
function billToAccRec(b, k) {
  const c = billCalc(b), me = accMe(), tot = r2(c.total != null ? c.total : c.computed), per = c.per, ids = pOrder(Object.keys(per));
  let split = []; ids.forEach(p0 => { const p = accPid(p0), o = split.find(x => x.p === p); if (o) o.amt = r2(o.amt + r2(per[p0])); else split.push({p, amt: r2(per[p0])}); }); const diff = r2(tot - split.reduce((s, x) => s + x.amt, 0)); if (split.length && Math.abs(diff) < 1) split[split.length - 1].amt = r2(split[split.length - 1].amt + diff);
  if (split.length === 1 && split[0].p === me) split = [];
  const items = (b.items || []).map(x => ({n: x.n, amt: r2(numP(x.amt) - (c.itemDisc[x.id] || 0)), ppl: [...new Set((x.ppl || []).map(accPid))], q: x.q || 1}));
  const note = accNoteFromBill(b);
  return {id: 'r' + uid(), d: k, t: b.time || '', type: 'out', amt: tot, cat: accGuessCat(b), acct: (DB.acc.accts[0] || {}).id || '', note, payee: billStore(b) || '', payer: me, split, items, imgs: [], src: {bill: b.id}, inv: b.inv || ''};
}
function pickBillForAcc() {
  const all = []; Object.keys(DB.bills || {}).sort().reverse().forEach(k => DB.bills[k].forEach(b => all.push({k, b})));
  return new Promise(res => { let done = false; const sh = sheet({title: '📥 選一筆分帳明細', full: true, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = all.slice(0, 120).map(({k, b}, i) => `<button class="acImp card" data-i="${i}"><span class="grow"><b>${esc(billStore(b) || '消費明細')}</b><small>${dayLabel(k)}・${(b.items || []).length} 項${(b.imgs || []).length ? '・🖼️' + b.imgs.length : ''}${b.acc ? '・已匯入過' : ''}</small></span><b>${money(billCalc(b).total != null ? billCalc(b).total : billCalc(b).computed)}</b></button>`).join('') || '<div class="empty">分帳裡還沒有明細</div>';
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
  const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">勾選要匯入的消費明細（已經匯入過的不會出現）。每個人分到的金額、品項明細和圖片都會一起帶進來，付錢的人預設是「${esc(aWho(accMe()).name)}」。</div>` + all.map(({k, b}) => { const c = billCalc(b), ids = pOrder(Object.keys(c.per)); return `<button class="acImp card ${sel.has(b.id) ? 'on' : ''}" data-b="${b.id}"><span class="acCk"></span><span class="grow"><b>${esc(billStore(b) || '消費明細')}</b><small>${dayLabel(k)}・${(b.items || []).length} 項${(b.imgs || []).length ? '・🖼️' + b.imgs.length : ''}${ids.length ? '・' + ids.map(p => esc(aWho(p).name) + ' ' + money(c.per[p])).join('、') : ''}</small></span><b>${money(c.total != null ? c.total : c.computed)}</b></button>`; }).join('');
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
  const flows = DB.acc.recs.filter(r => acctFlow(r, a.id)).sort(recSort), payUse = DB.acc.recs.filter(r => r.acct === a.id).sort(recSort);
  /* 收支明細依月份分組，可以收合；預設只打開最新的月份 */
  const moOpen = new Set(); { const f = (flows[0] || payUse[0]); if (f) moOpen.add(f.d.slice(0, 7)); }
  const draw = () => { const cur = acctBal(a); sh.body.innerHTML = `<div class="niRow"><button class="niIc" data-a="ic">${aIco({i: ic, logo, kind})}<small>換圖示</small></button><div class="field grow" style="margin:0"><label>名稱</label><input id="eaN" value="${esc(a.n)}"></div></div>
    <div class="lbl">種類</div><div class="dkSeg acKind">${Object.entries(AK).map(([k, [n, i]]) => `<button data-k="${k}" class="${kind === k ? 'on' : ''}"><span>${i}</span><b>${n}</b></button>`).join('')}</div>
    ${kind === 'pay' ? `<div class="lbl" style="margin-top:.8rem">綁定哪個帳戶扣款（記帳時預設從這裡扣）</div><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank' || x.kind === 'card' || x.kind === 'stored').map(x => `<button data-fd="${x.id}" class="${fund === x.id ? 'on' : ''}">${aIco(x)}<span class="acN ${[...x.n].length > 7 ? 'lg' : ''}">${esc(x.n)}</span></button>`).join('') || '<span class="muted small">先新增銀行、信用卡或儲值帳戶</span>'}</div>`
      : `<div class="field" style="margin-top:.8rem"><label>目前餘額${kind === 'card' ? '（信用卡欠款請填負數，例如 -3500）' : ''}</label><input id="eaB" value="${cur}" inputmode="decimal"></div>`}
    ${kind === 'card' ? `<div class="field"><label>每月幾號還款（1～28）</label><input id="eaD" value="${a.payDay || ''}" inputmode="numeric" placeholder="例如 5"></div><div class="lbl">從哪個帳戶自動扣款還款</div><div class="acAccts">${DB.acc.accts.filter(x => x.kind === 'bank').map(x => `<button data-pf="${x.id}" class="${pf === x.id ? 'on' : ''}">${aIco(x)}<span class="acN ${[...x.n].length > 7 ? 'lg' : ''}">${esc(x.n)}</span></button>`).join('') || '<span class="muted small">先在「銀行」新增帳戶</span>'}</div>` : ''}
    <div class="lbl" style="margin-top:1rem">${kind === 'pay' ? '用這個付款方式的紀錄' : '收支明細'}</div>${(() => { const L = kind === 'pay' ? payUse : flows, val = r => kind === 'pay' ? -(+r.amt || 0) : acctFlow(r, a.id); if (!L.length) return '<div class="card"><div class="empty" style="padding:.8rem">還沒有紀錄</div></div>';
      const G = []; L.forEach(r => { const k = r.d.slice(0, 7); let g = G[G.length - 1]; if (!g || g.k !== k) G.push(g = {k, L: []}); g.L.push(r); }); const allOpen = G.every(g => moOpen.has(g.k));
      return `<div class="moBar"><span class="muted small">共 ${L.length} 筆・${G.length} 個月</span><button class="btn sm" data-a="moAll">${allOpen ? '⊟ 全部收合' : '⊞ 全部展開'}</button></div>` + G.map(g => { const op = moOpen.has(g.k), inn = g.L.reduce((t, r) => t + Math.max(0, val(r)), 0), out = g.L.reduce((t, r) => t + Math.min(0, val(r)), 0);
        return `<div class="moG card ${op ? 'on' : ''}"><button class="moH" data-mo="${g.k}"><b>${op ? '▾' : '▸'} ${+g.k.slice(0, 4)}年${+g.k.slice(5)}月</b><small>${g.L.length} 筆</small><span class="grow"></span>${inn ? `<em class="pos">+${money(inn)}</em>` : ''}${out ? `<em class="neg">${money(out)}</em>` : ''}</button>
          ${op ? `<div class="moB">${g.L.map(r => { const v = val(r); return `<button class="acIt" data-rid="${r.id}"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.payee || String(r.note || '').split('\n')[0] || accCat(r).n)}</span><b class="${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : ''}${money(v)}</b></button>`; }).join('')}</div>` : ''}</div>`; }).join(''); })()}`; };
  draw();
  const keepN = () => { const n = $('#eaN', sh.body); if (n) a._n = n.value; const bb = $('#eaB', sh.body); if (bb) a._b = bb.value; const dd = $('#eaD', sh.body); if (dd) a._d = dd.value; };
  sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8); keepN();
    if (t.dataset.mo) { const k = t.dataset.mo; moOpen.has(k) ? moOpen.delete(k) : moOpen.add(k); }
    else if (t.dataset.a === 'moAll') { const ks = [...new Set((kind === 'pay' ? payUse : flows).map(r => r.d.slice(0, 7)))], all = ks.every(k => moOpen.has(k)); ks.forEach(k => all ? moOpen.delete(k) : moOpen.add(k)); }
    else if (t.dataset.rid) { const r = DB.acc.recs.find(x => x.id === t.dataset.rid); if (r) accEdit(r); return; }
    else if (t.dataset.a === 'ic') { const v = await iconPick(ic, 'fin'); if (v) { ic = v; logo = ''; } }
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
/* 期間：日 d／週 w／月 m／半年 h／年 y。Acc.sp = {u, a: 錨點日期 'YYYY-MM-DD'} */
const SPU = [['d', '日'], ['w', '週'], ['m', '月'], ['h', '半年'], ['y', '年']];
function spRange(u, a) { const d = new Date(a + 'T00:00:00'), Y = d.getFullYear(), M = d.getMonth();
  if (u === 'd') return {s: ymd(d), e: ymd(d), lab: `${M + 1}月${d.getDate()}日（${'日一二三四五六'[d.getDay()]}）`, days: 1};
  if (u === 'w') { const s0 = new Date(d); s0.setDate(d.getDate() - (d.getDay() + 6) % 7); const e0 = new Date(s0); e0.setDate(s0.getDate() + 6); return {s: ymd(s0), e: ymd(e0), lab: `${s0.getMonth() + 1}/${s0.getDate()} – ${e0.getMonth() + 1}/${e0.getDate()}`, days: 7, s0}; }
  if (u === 'm') { const n = new Date(Y, M + 1, 0).getDate(); return {s: ymd(new Date(Y, M, 1)), e: ymd(new Date(Y, M, n)), lab: `${Y}年${M + 1}月`, days: n}; }
  if (u === 'h') { const h = M < 6 ? 0 : 6, s0 = new Date(Y, h, 1), e0 = new Date(Y, h + 6, 0); return {s: ymd(s0), e: ymd(e0), lab: `${Y}年${h ? '下' : '上'}半年（${h + 1}–${h + 6}月）`, days: Math.round((e0 - s0) / 864e5) + 1, h}; }
  const e0 = new Date(Y, 12, 0); return {s: `${Y}-01-01`, e: `${Y}-12-31`, lab: `${Y}年`, days: Math.round((e0 - new Date(Y, 0, 1)) / 864e5) + 1}; }
function spShift(u, a, k) { const d = new Date(a + 'T00:00:00'); if (u === 'd') d.setDate(d.getDate() + k); else if (u === 'w') d.setDate(d.getDate() + 7 * k); else if (u === 'm') { d.setDate(1); d.setMonth(d.getMonth() + k); } else if (u === 'h') { d.setDate(1); d.setMonth(d.getMonth() + 6 * k); } else { d.setDate(1); d.setFullYear(d.getFullYear() + k); } return ymd(d); }
const kMoney = v => { v = Math.round(v); const a = Math.abs(v); return a >= 1e4 ? (v / 1e4).toFixed(a >= 1e5 ? 0 : 1) + '萬' : a >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v); };
/* 甜甜圈圖：G = [{n, i, v, c}] */
function donut(G, tot, title, sz = 180) { const R = sz * .39, r0 = sz * .25, c = sz / 2; let ang = -Math.PI / 2; const P = (an, rr) => [c + rr * Math.cos(an), c + rr * Math.sin(an)].map(n => n.toFixed(2)).join(' ');
  const arcs = G.filter(g => g.v > 0).map(g => { const a = g.v / (tot || 1) * Math.PI * 2, a2 = ang + a, big = a > Math.PI ? 1 : 0;
    const d = a > Math.PI * 2 - .001 ? `M ${c} ${c - R} A ${R} ${R} 0 1 1 ${c - .01} ${c - R} L ${c - .01} ${c - r0} A ${r0} ${r0} 0 1 0 ${c} ${c - r0} Z` : `M ${P(ang, R)} A ${R} ${R} 0 ${big} 1 ${P(a2, R)} L ${P(a2, r0)} A ${r0} ${r0} 0 ${big} 0 ${P(ang, r0)} Z`; ang = a2; return `<path d="${d}" fill="${g.c}" stroke="var(--surface)" stroke-width="1.5"/>`; }).join('');
  return `<svg viewBox="0 0 ${sz} ${sz}" class="stSvg">${arcs || `<circle cx="${c}" cy="${c}" r="${(R + r0) / 2}" fill="none" stroke="var(--border-soft)" stroke-width="${R - r0}"/>`}<text x="${c}" y="${c - 4}" text-anchor="middle" class="stC1">${esc(title)}</text><text x="${c}" y="${c + 15}" text-anchor="middle" class="stC2">${money(tot)}</text></svg>`; }
function renderAccStat() {
  const box = $('#accSBody'); if (!box || !DB.acc) return; if (!Acc.sp) Acc.sp = {u: 'm', a: ymd(new Date())};
  const {u, a} = Acc.sp, Rg = spRange(u, a), Pg = spRange(u, spShift(u, a, -1)), inR = (r, g) => r.d && r.d >= g.s && r.d <= g.e;
  const isOpt = r => { const f = catFind('out', r.cat); return f.s ? !!f.s.opt : f.p ? !!f.p.opt : false; };
  const outs = DB.acc.recs.filter(r => r.type === 'out' && inR(r, Rg)), ins = DB.acc.recs.filter(r => r.type === 'in' && inR(r, Rg));
  const tot = outs.reduce((t, r) => t + accMine(r), 0), inc = ins.reduce((t, r) => t + (+r.amt || 0), 0), last = DB.acc.recs.filter(r => r.type === 'out' && inR(r, Pg)).reduce((t, r) => t + accMine(r), 0);
  const optL = outs.filter(isOpt), essL = outs.filter(r => !isOpt(r)), opt = optL.reduce((t, r) => t + accMine(r), 0), ess = tot - opt;
  /* 依母分類分組（含子分類） */
  const grp = L => { const by = {}; L.forEach(r => { const f = catFind('out', r.cat), k = f.p ? f.p.id : '_'; const g = by[k] = by[k] || {id: k, n: f.p ? f.p.n : '其他', i: f.p ? f.p.i : '📦', v: 0, cnt: 0, subs: {}}; const v = accMine(r); g.v += v; g.cnt++; const sk = f.s ? f.s.id : '_'; const sg = g.subs[sk] = g.subs[sk] || {n: f.s ? f.s.n : g.n, i: f.s ? f.s.i || '' : g.i, v: 0}; sg.v += v; });
    return Object.values(by).filter(g => g.v > 0).sort((x, y) => y.v - x.v).map((g, i) => Object.assign(g, {c: PAL[i % PAL.length]})); };
  const G = grp(outs), GE = grp(essL), GO = grp(optL);
  /* 趨勢：每一格分必要／非必要 */
  const B = []; const bk = (lab, s, e, tip) => { const L = outs.filter(r => r.d >= s && r.d <= e), o = L.filter(isOpt).reduce((t, r) => t + accMine(r), 0), all = L.reduce((t, r) => t + accMine(r), 0); B.push({lab, tip, e: all - o, o, v: all, inc: ins.filter(r => r.d >= s && r.d <= e).reduce((t, r) => t + (+r.amt || 0), 0)}); };
  if (u === 'w' || u === 'm') { const d0 = new Date(Rg.s + 'T00:00:00'); for (let k = 0; k < Rg.days; k++) { const d = new Date(d0); d.setDate(d0.getDate() + k); const x = ymd(d); bk(u === 'w' ? '一二三四五六日'[k] : (k === 0 || (k + 1) % 5 === 0 ? String(k + 1) : ''), x, x, `${d.getMonth() + 1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`); } }
  else if (u === 'h' || u === 'y') { const Y = +Rg.s.slice(0, 4), m0 = +Rg.s.slice(5, 7) - 1, n = u === 'h' ? 6 : 12; for (let k = 0; k < n; k++) { const m = m0 + k, s0 = ymd(new Date(Y, m, 1)), e0 = ymd(new Date(Y, m + 1, 0)); bk(`${m + 1}月`, s0, e0, `${Y}年${m + 1}月`); } }
  const bmx = Math.max(1, ...B.map(x => x.v));
  /* 星期幾 */
  const WD = [0, 0, 0, 0, 0, 0, 0]; outs.forEach(r => { WD[(new Date(r.d + 'T00:00:00').getDay() + 6) % 7] += accMine(r); }); const wmx = Math.max(1, ...WD);
  const byPy = {}; outs.forEach(r => { const n = r.payee || accCat(r).n; const o = byPy[n] = byPy[n] || {v: 0, c: 0}; o.v += accMine(r); o.c++; }); const PY = Object.entries(byPy).sort((x, y) => y[1].v - x[1].v).slice(0, 8);
  const big = outs.slice().sort((x, y) => accMine(y) - accMine(x)).slice(0, 5), chg = last ? (tot - last) / last * 100 : 0, uN = {d: '天', w: '週', m: '月', h: '半年', y: '年'}[u], pN = {d: '昨天', w: '上週', m: '上個月', h: '上個半年', y: '去年'}[u];
  /* 自動分析重點 */
  const tips = []; if (tot) { if (G[0]) tips.push(`花最多的是 <b>${esc(G[0].i)} ${esc(G[0].n)}</b>，${money(G[0].v)}，佔 ${(G[0].v / tot * 100).toFixed(0)}%`);
    if (last) tips.push(`比${pN}${chg > 0 ? '多' : '少'}花 <b>${money(Math.abs(tot - last))}</b>（${chg > 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(0)}%）`);
    tips.push(opt ? `非必要消費 ${money(opt)}，佔 ${(opt / tot * 100).toFixed(0)}%${GO[0] ? `，最多的是 ${esc(GO[0].i)} ${esc(GO[0].n)}` : ''}${opt / tot > .3 ? '；已經超過三成，可以先從這一類開始減少' : ''}` : '這段期間沒有非必要消費 👍');
    if (u !== 'd' && Rg.days > 1) tips.push(`平均每天 ${money(Math.round(tot / Rg.days))}，每筆平均 ${money(Math.round(tot / outs.length))}`);
    if (u !== 'd' && u !== 'w') { const w = WD.indexOf(Math.max(...WD)); tips.push(`星期${'一二三四五六日'[w]}花最多（${money(WD[w])}）`); }
    if (inc) tips.push(`收入 ${money(inc)}，${inc >= tot ? `存下 <b class="pos">${money(inc - tot)}</b>（儲蓄率 ${((inc - tot) / inc * 100).toFixed(0)}%）` : `<b class="neg">超支 ${money(tot - inc)}</b>`}`); }
  const legend = (L, T, key) => L.map(g => `<button class="stL" data-sp="${key}:${g.id}"><i style="background:${g.c}"></i><span class="grow">${esc(g.i)} ${esc(g.n)}<small class="muted"> ${g.cnt} 筆</small></span><b>${money(g.v)}</b><em>${(g.v / (T || 1) * 100).toFixed(0)}%</em></button>
      ${Acc.statOpen === key + ':' + g.id ? `<div class="stSubs">${Object.values(g.subs).sort((x, y) => y.v - x.v).map(sb => `<div><span class="grow">${esc(sb.i)} ${esc(sb.n)}</span><b>${money(sb.v)}</b><em class="muted">${(sb.v / g.v * 100).toFixed(0)}%</em><span class="stBar"><i style="width:${(sb.v / g.v * 100).toFixed(1)}%;background:${g.c}"></i></span></div>`).join('')}</div>` : ''}`).join('');
  const sel = Acc.bk != null && B[Acc.bk] ? B[Acc.bk] : null;
  box.innerHTML = `<div class="spSeg">${SPU.map(([k, n]) => `<button data-u="${k}" class="${u === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="spNav"><button class="btn" data-a="sp-">◀</button><button class="btn spLab" data-a="spPick">${Rg.lab}</button><button class="btn" data-a="sp+">▶</button></div>
    <div class="stKpi"><div class="card"><small>支出（我的）</small><b class="neg">${money(tot)}</b><em class="${chg > 0 ? 'neg' : 'pos'}">${last ? `${chg > 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(0)}% vs ${pN}` : `${pN}沒有資料`}</em></div>
      <div class="card"><small>收入</small><b class="pos">${money(inc)}</b><em>${inc || tot ? `結餘 ${money(inc - tot)}` : '—'}</em></div>
      <div class="card"><small>${u === 'd' ? '筆數' : '平均每天'}</small><b>${u === 'd' ? outs.length + ' 筆' : money(Math.round(tot / Rg.days))}</b><em>${outs.length} 筆支出</em></div></div>
    ${tips.length ? `<div class="stCard card"><div class="stH"><b>💡 分析重點</b></div><ul class="stTips">${tips.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
    ${B.length ? `<div class="stCard card"><div class="stH"><b>📊 ${u === 'w' ? '這週每天' : u === 'm' ? '每天' : '每個月'}支出</b><span class="stKey"><i class="ess"></i>必要 <i class="opt"></i>非必要</span></div>
      <div class="stBars n${B.length > 12 ? 'm' : ''}">${B.map((x, k) => `<button class="stBk ${Acc.bk === k ? 'on' : ''}" data-bk="${k}">${B.length <= 12 && x.v ? `<small class="stV">${kMoney(x.v)}</small>` : ''}<span class="stCol"><span class="stStk" style="height:${(x.v / bmx * 100).toFixed(1)}%"><i class="opt" style="flex:${x.o}"></i><i class="ess" style="flex:${x.e}"></i></span></span><em>${x.lab}</em></button>`).join('')}</div>
      <div class="stSel">${sel ? `<b>${sel.tip}</b>　支出 ${money(sel.v)}（必要 ${money(sel.e)}・非必要 ${money(sel.o)}）${u === 'h' || u === 'y' ? `・收入 ${money(sel.inc)}` : ''}` : '<span class="muted">點長條看當天／當月的金額</span>'}</div>
      ${u === 'h' || u === 'y' ? `<div class="stTbl"><div class="th"><span>月份</span><span>支出</span><span>非必要</span><span>收入</span><span>結餘</span></div>${B.map(x => `<div><span>${x.lab}</span><span class="neg">${kMoney(x.v)}</span><span>${kMoney(x.o)}</span><span class="pos">${kMoney(x.inc)}</span><span class="${x.inc - x.v < 0 ? 'neg' : 'pos'}">${kMoney(x.inc - x.v)}</span></div>`).join('')}</div>` : ''}
      <div class="small muted">最高 ${money(Math.max(0, ...B.map(x => x.v)))}・平均每${u === 'h' || u === 'y' ? '月' : '天'} ${money(Math.round(tot / B.length))}</div></div>` : ''}
    ${G.length ? `<div class="stPie card"><div class="stH"><b>🍩 支出分類</b></div>${donut(G, tot, '支出')}<div class="stLeg">${legend(G, tot, 'a')}</div></div>` : `<div class="empty mealEmpty"><span class="big">📊</span>這段期間還沒有支出紀錄</div>`}
    <div class="stCard card"><div class="stH"><b>🧭 必要／非必要消費</b><button class="btn sm" data-a="optCfg">設定哪些是非必要</button></div>
      <div class="stOpt"><div class="stOptBar"><i style="width:${tot ? (ess / tot * 100).toFixed(1) : 100}%"></i></div><div class="stOptL"><span><i class="ess"></i>必要 <b>${money(ess)}</b>（${tot ? (ess / tot * 100).toFixed(0) : 0}%）</span><span><i class="opt"></i>非必要 <b>${money(opt)}</b>（${tot ? (opt / tot * 100).toFixed(0) : 0}%）</span></div></div>
      ${tot ? `<div class="stTwo"><div><div class="lbl">✅ 必要消費的分類佔比</div>${GE.length ? donut(GE, ess, '必要', 150) + `<div class="stLeg">${legend(GE, ess, 'e')}</div>` : '<div class="small muted">沒有必要消費</div>'}</div>
        <div><div class="lbl">🎈 非必要消費的分類佔比</div>${GO.length ? donut(GO, opt, '非必要', 150) + `<div class="stLeg">${legend(GO, opt, 'o')}</div>` : '<div class="small muted">沒有非必要消費 👍</div>'}</div></div>` : ''}
      ${opt ? `<div class="stTip">💡 如果非必要消費少一半，這個${uN}可以多存 <b>${money(Math.round(opt / 2))}</b>${u !== 'y' ? `，一年大約 <b>${money(Math.round(opt / 2 / Rg.days * 365))}</b>` : ''}。</div>` : ''}</div>
    ${u !== 'd' && u !== 'w' && tot ? `<div class="stCard card"><div class="stH"><b>📆 星期幾花最多</b></div><div class="stWd">${WD.map((v, k) => `<div><small class="stV">${v ? kMoney(v) : ''}</small><span><i style="height:${(v / wmx * 100).toFixed(1)}%"></i></span><em>${'一二三四五六日'[k]}</em></div>`).join('')}</div></div>` : ''}
    ${big.length ? `<div class="stCard card"><div class="stH"><b>🔝 最大筆的支出</b></div>${big.map(r => `<div class="acIt" data-r="${r.id}"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(accCat(r).i)} ${esc(r.payee || accCat(r).n)}${isOpt(r) ? ' <small class="optTag">非必要</small>' : ''}</span><b class="neg">${money(accMine(r))}</b></div>`).join('')}</div>` : ''}
    ${PY.length ? `<div class="stCard card"><div class="stH"><b>🏪 最常花錢的地方</b></div>${PY.map(([n, o]) => `<div class="stPy"><span class="grow">${esc(n)}<small class="muted"> ${o.c} 次</small></span><b>${money(o.v)}</b><span class="stBar"><i style="width:${(o.v / PY[0][1].v * 100).toFixed(1)}%"></i></span></div>`).join('')}</div>` : ''}
    ${(() => { const LL = DB.acc.recs.filter(r => r.type === 'loss'), lm = LL.filter(r => inR(r, Rg)); if (!LL.length) return ''; const byA = {}; lm.forEach(r => { const k = acctName(r.acct) || '未指定'; byA[k] = (byA[k] || 0) + (+r.amt || 0); });
      return `<div class="stCard card"><div class="stH"><b>💸 金額遺失</b></div><div class="stLossG"><span><small>這個${uN}</small><b class="neg">${money(lm.reduce((t, r) => t + (+r.amt || 0), 0))}</b></span><span><small>全部</small><b class="neg">${money(LL.reduce((t, r) => t + (+r.amt || 0), 0))}</b></span></div>
        ${Object.keys(byA).length ? Object.entries(byA).map(([k, v]) => `<div class="acIt"><span class="grow">${esc(k)}</span><b class="neg">${money(v)}</b></div>`).join('') : '<div class="small muted">這段期間沒有遺失 👍</div>'}</div>`; })()}`;
  $('#accSSub').textContent = Rg.lab;
}
async function accStatClick(e) {
  const t = e.target.closest('[data-a],[data-sp],[data-r],[data-u],[data-bk]'); if (!t) return; buzz(8); const a = t.dataset.a, sp = Acc.sp;
  if (t.dataset.u) { sp.u = t.dataset.u; Acc.bk = null; renderAccStat(); return; }
  if (t.dataset.bk != null) { const k = +t.dataset.bk; Acc.bk = Acc.bk === k ? null : k; renderAccStat(); return; }
  if (t.dataset.sp) { Acc.statOpen = Acc.statOpen === t.dataset.sp ? '' : t.dataset.sp; renderAccStat(); return; }
  if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r).then(renderAccStat); return; }
  if (a === 'sp-' || a === 'sp+') { sp.a = spShift(sp.u, sp.a, a === 'sp-' ? -1 : 1); Acc.bk = null; renderAccStat(); }
  else if (a === 'spPick') { const d = new Date(sp.a + 'T00:00:00'); if (sp.u === 'd' || sp.u === 'w') { const v = await datePick(sp.a); if (v) { sp.a = v; renderAccStat(); } }
    else { const r = await ymPick(d.getFullYear(), d.getMonth(), sp.u === 'm' ? 'm' : 'y'); if (r) { sp.a = ymd(new Date(r[0], r[1], 1)); Acc.bk = null; renderAccStat(); } } }
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
const AM = {map: null, marks: [], q: '', f: 'all', area: null, sel: '', tw: new Map(), me: null, res: [], rMarks: [], gseq: 0};
/* 收合狀態記在 S.amFold（沒記過的分類預設收合） */
const amFolded = k => { const F = S.amFold || {}; return F[k] !== false; };
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
  const co = DB.acc.amCord || [], cats0 = DB.cats.map(c => c.id).concat(['', '_acc']), cats = cats0.map((k, i) => [k, co.indexOf(k) < 0 ? 1e4 + i : co.indexOf(k)]).sort((a, b) => a[1] - b[1]).map(x => x[0]).filter(k => cnt(k));
  const ordOf = k => ((DB.acc.amOrd || {})[k]) || [], anyOpen = AM.f === 'all' && cats.some(k => !amFolded(k));
  const towns = AM.area && TW.counties[AM.area.c] ? TW.counties[AM.area.c].towns : [];
  $('#accMList').innerHTML = `<div class="amChips">${[['all', '🗺️ 全部', '']].concat(cats.map(k => { const c = amCat(k); return [k, `${c.icon} ${c.name}`, c.color]; })).map(([k, t, c]) => `<button class="chip ${AM.f === k ? 'on' : ''}" data-f="${k}" ${c ? `style="--c:${c}"` : ''}>${esc(t)} <span class="n">${cnt(k)}</span></button>`).join('')}</div>
    ${TW.ready ? `<div class="amArea"><select id="amC" aria-label="選擇縣市"><option value="">全部縣市</option>${TW.names.map(n => `<option ${AM.area && AM.area.c === n ? 'selected' : ''}>${n}</option>`).join('')}</select><select id="amT" aria-label="選擇鄉鎮市區" ${AM.area ? '' : 'disabled'}><option value="">全部鄉鎮市區</option>${towns.map(t => `<option ${AM.area && AM.area.t === t.name ? 'selected' : ''}>${t.name}</option>`).join('')}</select>${AM.area ? '<button class="ic" data-a="arX" aria-label="取消區域">✕</button>' : ''}</div>` : ''}
    <div class="amBar"><div class="searchBox amQ"><input id="amQ" type="search" placeholder="搜尋店名或地址" value="${esc(AM.q)}"></div>${AM.f === 'all' && cats.length > 1 ? `<button class="btn sm amFoldAll" data-a="foldAll">${anyOpen ? '⊟ 全部收合' : '⊞ 全部展開'}</button>` : ''}</div>
    <div class="small muted amTip">按住分類標題可以上下移動；展開後按住店家可以排序</div><div id="amSecs">
    ${(AM.f === 'all' ? cats : [AM.f]).map(k => { const c = amCat(k), od = ordOf(k), oi = o => { const i = od.indexOf(o.n); return i < 0 ? 1e6 : i; }, L = V.filter(o => o.cat === k).sort((a, b) => oi(a) - oi(b) || ((b.st || {}).last || '').localeCompare((a.st || {}).last || '') || a.n.localeCompare(b.n, 'zh-Hant')); if (!L.length) return '';
      const fd = AM.f === 'all' && amFolded(k) && !AM.q;
      return `<div class="amSec ${fd ? 'fold' : ''}" data-k="${k}"><button class="amSecH" data-fold="${k}" style="--c:${c.color}"><span class="grip"></span><span>${esc(c.icon)}</span><b>${esc(c.name)}</b><em>${L.length}</em>${AM.f === 'all' ? `<i>${fd ? '▸' : '▾'}</i>` : ''}</button>
        ${fd ? '' : L.map(o => `<button class="amR card ${AM.sel === o.n ? 'sel' : ''}" data-st="${esc(o.n)}"><span class="amPinI ${o.loc ? 'on' : ''}">${o.loc ? '📍' : '📌'}</span><span class="grow"><b>${esc(o.n)}</b><small>${o.loc ? esc(o.loc.addr || '已釘選位置') : '還沒有位置'}</small><small>${o.st ? `記帳 ${o.st.cnt} 筆・${money(o.st.sum)}・最近 ${o.st.last.slice(5).replace('-', '/')}` : '還沒有記帳紀錄'}</small></span>${o.loc ? '<span class="chev">›</span>' : `<span class="btn sm" data-pin="${esc(o.n)}">📍 釘選</span>`}</button>`).join('')}</div>`; }).join('') || '<div class="empty">沒有符合的店家</div>'}</div>`;
  /* 長按拖曳：分類整組上下移動、分類裡的店家排序（只影響記帳這張地圖的順序） */
  const secs = $('#amSecs');
  if (AM.f === 'all' && cats.length > 1) sortable(secs, {item: '.amSec', handle: '.amSecH', handleOnly: true, scroller: $('#pgAccM .pgBody'), onSort(f, t) { const ks = $$('.amSec', secs).map(e => e.dataset.k), m = ks.splice(f, 1)[0]; ks.splice(t, 0, m);
    DB.acc.amCord = ks.concat(cats0.filter(k => !ks.includes(k))); saveAcc(); renderAccMap(); }});
  sortable(secs, {item: '.amR', scope: '.amSec', scroller: $('#pgAccM .pgBody'), onSort(f, t, scope) { const k = scope.dataset.k, ns = $$('.amR', scope).map(e => e.dataset.st), m = ns.splice(f, 1)[0]; ns.splice(t, 0, m);
    DB.acc.amOrd = DB.acc.amOrd || {}; DB.acc.amOrd[k] = ns; saveAcc(); renderAccMap(); }});
  const inp = $('#amQ'); inp.oninput = debounce(() => { AM.q = inp.value.trim(); const pos = inp.selectionStart; renderAccMap().then(() => { const n = $('#amQ'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }); }, 300);
  const cs = $('#amC'), ts = $('#amT'); if (cs) { cs.onchange = () => { AM.area = cs.value ? {c: cs.value, t: ''} : null; AM.fit = true; buzz(10); renderAccMap(); }; ts.onchange = () => { AM.area = cs.value ? {c: cs.value, t: ts.value} : null; AM.fit = true; buzz(10); renderAccMap(); }; }
  await accMapInit(); accMapMarks(V);
}
function initAccMap() {
  $('#accMList').addEventListener('click', async e => { const t = e.target.closest('[data-f],[data-fold],[data-pin],[data-st],[data-a]'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.f != null) { AM.f = d.f; AM.fit = true; renderAccMap(); return; }
    if (d.a === 'arX') { AM.area = null; AM.fit = true; renderAccMap(); return; }
    if (d.fold != null) { if (AM.f !== 'all' || AM.q) return; S.amFold = S.amFold || {}; S.amFold[d.fold] = !amFolded(d.fold); saveS(); renderAccMap(); return; }
    if (d.a === 'foldAll') { const ks = $$('#amSecs .amSec').map(e => e.dataset.k), open = ks.some(k => !amFolded(k)); S.amFold = S.amFold || {}; ks.forEach(k => { S.amFold[k] = open; }); saveS(); renderAccMap(); return; }
    if (d.pin) { e.stopPropagation(); if (await accPinStore(d.pin)) { AM.sel = d.pin; renderAccMap(); } return; }
    if (d.st) accMapSelect(d.st, true); });
}
async function accMapInit() {
  if (AM.map || !window.maplibregl) { if (AM.map) AM.map.resize(); return; }
  try { const st = await mapStyle(), v = S.view || {c: [120.96, 23.75], z: 6.6};
    AM.map = new maplibregl.Map({container: 'accMap', style: st, center: v.c, zoom: Math.min(v.z, 12), attributionControl: false, dragRotate: false, pitchWithRotate: false, localIdeographFontFamily: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif', fadeDuration: 0});
    AM.map.on('error', () => {}); AM.fit = true;
    if (S.amNorth !== false) AM.map.touchZoomRotate.disableRotation();
    AM.map.on('rotate', () => { const n = $('#amNorth i'); if (n) n.style.transform = `rotate(${-AM.map.getBearing()}deg)`; });
    $('.amMapBox').insertAdjacentHTML('beforeend', `<div class="amFabs l"><button class="fab glass" data-m="in" aria-label="放大"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button><button class="fab glass" data-m="out" aria-label="縮小"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button></div><div class="amFabs"><button class="fab glass ${S.amNorth !== false ? 'on' : ''}" data-m="north" id="amNorth" aria-label="固定朝北"><i><svg viewBox="0 0 24 24"><path d="M12 3l4 9H8z" fill="currentColor"/><path d="M12 21l-4-9h8z"/></svg></i></button><button class="fab glass" data-m="me" id="amMe" aria-label="目前位置"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button></div>`);
    $('.amMapBox').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; buzz(10); const m = b.dataset.m, M2 = AM.map;
      if (m === 'in') M2.zoomIn({duration: 250}); else if (m === 'out') M2.zoomOut({duration: 250});
      else if (m === 'north') { S.amNorth = S.amNorth === false; saveS(); b.classList.toggle('on', S.amNorth); M2.easeTo({bearing: 0, pitch: 0, duration: 400}); if (S.amNorth) M2.touchZoomRotate.disableRotation(); else M2.touchZoomRotate.enableRotation(); toast(S.amNorth ? '🧭 固定朝北' : '可以用兩指旋轉地圖'); }
      else if (m === 'me') accMapLocate(); });
    accGSInit(); AM.map.on('click', () => { const b = $('#amGR'); if (b) b.classList.add('hide'); const i = $('#amGQ'); if (i) i.blur(); });
    /* 一進到記帳的地圖就定位到現在的位置 */
    AM.map.once('load', () => accMapLocate('entry'));
  } catch (e) { $('#accMap').innerHTML = '<div class="empty">這台裝置不支援地圖</div>'; }
}
function accMapMarks(L) { if (!AM.map) return; AM.marks.forEach(m => m.remove()); AM.marks = [];
  const P = L.filter(o => o.loc); P.forEach(o => { const c = amCat(o.cat), e = el(`<button class="amPin ${AM.sel === o.n ? 'sel' : ''}" style="--c:${c.color}"><span><i>${esc(c.icon)}</i></span><b>${esc(o.n)}</b></button>`);
    e.onclick = ev => { ev.stopPropagation(); buzz(10); accMapSelect(o.n, false); };
    const mk = new maplibregl.Marker({element: e, anchor: 'bottom'}).setLngLat([o.loc.lon, o.loc.lat]).addTo(AM.map); mk._n = o.n; AM.marks.push(mk); });
  if (AM.fit && P.length) { AM.fit = false; const bb = new maplibregl.LngLatBounds(); P.forEach(o => bb.extend([o.loc.lon, o.loc.lat])); setTimeout(() => { try { AM.map.resize(); AM.map.fitBounds(bb, {padding: 50, maxZoom: 15, duration: 500}); } catch (e) {} }, 60); } }
/* 目前位置：沿用日日帳本的定位（已經在定位就直接飛過去） */
function accMapLocate(auto) { if (!AM.map) return; Loc.start(); const b = $('#amMe'); b && b.classList.add('locating'); let n = 0;
  const go = () => { const L = Loc.last; if (L && Date.now() - L.t < 120000) { b && b.classList.remove('locating');
      if (!AM.me) { const e = el('<div class="meWrap"><div class="meDot"></div></div>'); AM.me = new maplibregl.Marker({element: e}).setLngLat([L.lon, L.lat]).addTo(AM.map); } else AM.me.setLngLat([L.lon, L.lat]);
      /* 依目前位置自動選縣市、鄉鎮市區，直接顯示那一區的收藏 */
      const tw = TW.init() && TW.townAt(L.lon, L.lat);
      if (auto !== true && tw && !(AM.area && AM.area.c === tw.county && AM.area.t === tw.name)) { AM.area = {c: tw.county, t: tw.name}; AM.f = 'all'; AM.q = ''; S.amFold = S.amFold || {}; Object.keys(S.amFold).forEach(k => { S.amFold[k] = false; }); DB.cats.map(c => c.id).concat(['', '_acc']).forEach(k => { S.amFold[k] = false; }); saveS(); AM.fit = false; renderAccMap(); if (!auto) toast(`📍 ${tw.county} ${tw.name}`); }
      AM.map.flyTo({center: [L.lon, L.lat], zoom: Math.max(AM.map.getZoom(), 15.5), duration: 700}); return; }
    if (++n > 30 || Loc.err === 'denied' || Loc.err === 'off') { b && b.classList.remove('locating'); if (!auto) toast(Loc.err === 'denied' ? '請允許定位權限才能顯示你的位置' : Loc.err === 'off' ? '手機的定位功能是關閉的' : '暫時抓不到位置，請到室外或確認已開啟定位', 3500); return; }
    setTimeout(go, 500); };
  go(); }
/* 記帳地圖的搜尋：像 Google 地圖一樣，輸入店名或「停車場」這類關鍵字，所有結果都標在地圖上，點了就能加入收藏 */
function accGSInit() { const box = $('.amMapBox'); if (!box || $('#amGQ')) return;
  box.insertAdjacentHTML('beforeend', `<div class="amGS"><div class="searchBox"><input id="amGQ" type="search" enterkeyhint="search" placeholder="搜尋地點，例如：停車場、咖啡廳"><button class="amGX hide" id="amGX" aria-label="清除">✕</button></div><div class="amGR hide" id="amGR"></div></div>`);
  const inp = $('#amGQ'), x = $('#amGX'), R = $('#amGR');
  inp.addEventListener('input', () => { x.classList.toggle('hide', !inp.value); if (!inp.value.trim()) accGSClear(); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); accGSearch(inp.value); } });
  inp.addEventListener('focus', () => { if (R.innerHTML) R.classList.remove('hide'); });
  x.onclick = () => { buzz(8); inp.value = ''; x.classList.add('hide'); accGSClear(); };
  R.addEventListener('click', e => { const t = e.target.closest('[data-i]'); if (!t) return; buzz(10); const r = AM.res[+t.dataset.i]; if (!r) return;
    if (e.target.closest('[data-add]')) { accGSAdd(r); return; } R.classList.add('hide'); AM.map.flyTo({center: [r.lon, r.lat], zoom: Math.max(AM.map.getZoom(), 16), duration: 600}); accGSCard(r); }); }
function accGSClear() { AM.gseq++; AM.res = []; AM.rMarks.forEach(m => m.remove()); AM.rMarks = []; const R = $('#amGR'); if (R) { R.innerHTML = ''; R.classList.add('hide'); } }
async function accGSearch(q) { q = (q || '').trim(); if (q.length < 2 || !AM.map) return; const seq = ++AM.gseq, R = $('#amGR'); R.innerHTML = '<div class="resNote">搜尋中…</div>'; R.classList.remove('hide');
  try { const c = [AM.map.getCenter().lat, AM.map.getCenter().lng]; let r = S.gkey ? await gPlaces(q, c, searchOpt(AM.map, AM.area)) : await nomSearch(q, c, areaGeo(AM.area)); if (seq !== AM.gseq) return;
    AM.res = r; accGSMarks(true); accGSList(); R.classList.remove('hide');
  } catch (e) { if (seq === AM.gseq) R.innerHTML = `<div class="resNote">❌ ${esc(e.message)}</div>`; } }
function accGSList() { const R = $('#amGR'), r = AM.res; if (!R) return;
    R.innerHTML = r.map((x, i) => { const has = accGSHas(x); return `<div class="amGRow" data-i="${i}"><span class="rIc">📍</span><span class="grow"><b>${esc(x.name)}</b><small>${x.tag ? esc(x.tag) + ' · ' : ''}${esc(x.addr || '')}</small></span>${has ? '<span class="amGHas">已收藏</span>' : '<button class="btn sm pri" data-add="1">＋ 收藏</button>'}</div>`; }).join('') || `<div class="resNote">${AM.area ? esc(AM.area.c + (AM.area.t ? ' ' + AM.area.t : '')) + ' 裡' : ''}找不到符合的地點，換個關鍵字試試</div>`;
    if (!S.gkey) R.insertAdjacentHTML('beforeend', '<div class="resNote">目前使用 OpenStreetMap 搜尋，店家較不齊全；填入 Google Maps 金鑰後可用 Google 地圖搜尋（設定 → 地圖）。</div>'); }
const accGSHas = x => (DB.places || []).some(p => (x.gid && p.gid === x.gid) || (p.name === x.name && Math.abs(p.lat - x.lat) < 3e-4 && Math.abs(p.lon - x.lon) < 3e-4));
function accGSMarks(fit) { AM.rMarks.forEach(m => m.remove()); AM.rMarks = []; const r = AM.res; if (!AM.map || !r.length) return;
  r.forEach(x => { const e = el(`<button class="amPin res ${accGSHas(x) ? 'has' : ''}"><span><i>📍</i></span><b>${esc(x.name)}</b></button>`);
    e.onclick = ev => { ev.stopPropagation(); buzz(10); const R = $('#amGR'); R && R.classList.add('hide'); accGSCard(x); };
    AM.rMarks.push(new maplibregl.Marker({element: e, anchor: 'bottom'}).setLngLat([x.lon, x.lat]).addTo(AM.map)); });
  if (fit) { if (r.length > 1) { const bb = new maplibregl.LngLatBounds(); r.forEach(x => bb.extend([x.lon, x.lat])); AM.map.fitBounds(bb, {padding: {top: 70, bottom: 40, left: 40, right: 40}, maxZoom: 16, duration: 700}); } else AM.map.flyTo({center: [r[0].lon, r[0].lat], zoom: 16, duration: 600}); } }
function accGSCard(r) { const has = accGSHas(r);
  const sh = sheet({title: '📍 ' + (r.name || '地點'), html: `<div class="amInfo card">${r.tag ? `<div><b>🏷️ 類型</b><span>${esc(r.tag)}</span></div>` : ''}<div><b>📍 地址</b><span>${esc(r.addr || '（沒有地址）')}</span></div>${has ? '<div><b>⭐ 收藏</b><span>已經在收藏裡</span></div>' : ''}</div>`,
    foot: `<div class="amGFoot">${has ? '' : '<button class="btn pri" data-a="add">＋ 加入收藏</button>'}<button class="btn olive" data-a="nav">🧭 導航</button><button class="btn" data-a="gm">Google 地圖</button></div>`});
  sh.foot.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); const a = b.dataset.a;
    if (a === 'add') { sh.close(); accGSAdd(r); } else if (a === 'nav') navTo(r); else if (a === 'gm') openUrl(gmUrl(r)); }; }
function accGSAdd(r) { addDraft(Object.assign({}, r), p => { AM.sel = p.name; AM.fit = false; renderAccMap().then(() => { accGSMarks(false); accGSList(); const R = $('#amGR'); if (R) R.classList.add('hide'); setTimeout(() => accMapSelect(p.name, false), 250); }); }); }
/* 選一間店：地圖上標出來（標籤放大），再打開店家卡片 */
function accMapSelect(n, fly) { AM.sel = n; AM.marks.forEach(m => m.getElement().classList.toggle('sel', m._n === n)); $$('#accMList .amR').forEach(r => r.classList.toggle('sel', r.dataset.st === n));
  const lc = storeLoc(n); if (lc && AM.map && fly !== false) { $('#pgAccM .pgBody').scrollTo({top: 0, behavior: 'smooth'}); AM.map.flyTo({center: [lc.lon, lc.lat], zoom: Math.max(AM.map.getZoom(), 16), duration: 650}); }
  accStoreCard(n); }
/* 從其他地方（例如商家名單）跳到記帳的地圖，標出這間店 */
function accMapFocus(n) { while (sheets.length) sheets[sheets.length - 1].close(); AM.f = 'all'; AM.q = ''; AM.area = null; AM.sel = n;
  (async () => { if (!S.inAcc) { if (!await enterAcc('AccM')) return; } else showTab('AccM'); setTimeout(() => accMapSelect(n, true), 350); })(); }
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
    <div class="setG"><h3>上鎖</h3><div class="setC">
      <button class="setR" data-a="lkSet" style="width:100%;text-align:left"><span class="gRi">🔑</span><div class="t"><b>${AccLock.has() ? '更改密碼' : '設定密碼'}</b><small>${AccLock.has() ? '要先輸入目前的密碼' : '6～16 位數字；不設定也可以使用'}</small></div><span class="chev">›</span></button>
      ${AccLock.has() ? `${AccLock.app() && NB.lockBioOk && NB.lockBioOk() ? `<button class="setR" data-a="lkBio" style="width:100%;text-align:left"><span class="gRi">👆</span><div class="t"><b>可以用指紋／臉部解鎖</b><small>解鎖時自動跳出指紋，也可以改用密碼；關掉要先驗證密碼</small></div><span class="sw2 ${S.accBio !== false ? 'on' : ''}"></span></button>` : ''}
      <div class="setR" style="cursor:default"><span class="gRi">🛡️</span><div class="t"><b>自動上鎖</b><small>螢幕關閉、或從最近使用把 App 滑掉再打開，都會馬上上鎖。連續輸錯 5 次要等待，時間會越來越長。</small></div></div>
      <div class="accLkRow in"><button class="lkBtn ${!AccLock.open() ? 'on' : ''}" data-lk data-a="lkTog">${AccLock.label()}</button><button class="btn sm" data-a="lkDel">移除密碼</button></div>` : ''}
      ${IS_APP && NB.guardOn ? `<button class="setR" data-a="guard" style="width:100%;text-align:left"><span class="gRi">🧷</span><div class="t"><b>防止誤刪 App</b><small>開啟後不能直接解除安裝；要刪除得先到手機設定停用保護，並輸入手機的解鎖密碼確認${AccLock.has() ? '。在這裡關閉要先輸入記帳密碼' : ''}</small></div><span class="sw2 ${NB.guardOn() ? 'on' : ''}"></span></button>` : ''}</div></div>
    ${IS_APP && NB.widgetData ? `<div class="setG"><h3>快速記帳</h3><div class="setC">
      <button class="setR" data-a="qNotif" style="width:100%;text-align:left"><span class="gRi">🔔</span><div class="t"><b>通知欄快速記帳</b><small>通知欄常駐三顆按鈕（＋支出／＋收入／⭐常用），跟桌面小工具一樣</small></div><span class="sw2 ${S.qNotif ? 'on' : ''}"></span></button>
      <button class="setR" data-a="wHide" style="width:100%;text-align:left"><span class="gRi">👁</span><div class="t"><b>小工具和通知顯示金額</b><small>關掉後桌面小工具、通知只顯示 $ ••••</small></div><span class="sw2 ${S.wHide ? '' : 'on'}"></span></button>
      <div class="setR" style="cursor:default"><span class="gRi">📱</span><div class="t"><b>桌面小工具、控制中心按鈕</b><small>桌面：長按空白處 →「小工具」→ 日日帳本。控制中心：下拉兩次 → 編輯（鉛筆）→ 把「記一筆」「常用記帳」拖進去。</small></div></div></div></div>` : ''}
    <div class="setG"><h3>說明</h3><div class="setC"><button class="setR" data-a="guide" style="width:100%;text-align:left"><span class="gRi">📖</span><div class="t"><b>記帳 圖解說明</b><small>記一筆、常用、欠款對帳、資產、分析、備份換機</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>分帳的人</h3><div class="setC"><div class="setR col"><div class="t"><b>我是誰</b><small>分帳、對帳時「我」是哪一個人（記帳自己的名單，和日常點餐分開）</small></div><div class="whoRow pplGrid">${accPeople().map(u => `<button data-me="${u.id}" class="${accMe() === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div></div>
      <div class="setR col"><div class="t"><b>🔗 同一個人，不同綽號</b><small>例如日常點餐叫「便當哥」、記帳叫「因因」：設定後分帳匯入記帳會自動對到同一個人，欠款、對帳也算在一起</small></div>
        ${Object.keys(accSame()).length ? `<div class="sameL">${Object.keys(accSame()).map(k => { const a = accSameName(k), m = aWho(k); return `<div class="sameR"><span>${esc((a && a.icon) || '👤')} ${esc(a ? a.name : (DB.acc.sameN || {})[k] || k)}${mealWho(k) ? '<small>日常</small>' : ''}</span><b>＝</b><span>${esc(m.icon)} ${esc(m.name)}<small>記帳</small></span><button class="ic" data-unlink="${esc(k)}" aria-label="取消">✕</button></div>`; }).join('')}</div>` : ''}
        <button class="btn block" data-a="link">🔗 設定同一個人</button></div>
      <button class="setR" data-a="people" style="width:100%;text-align:left"><span class="gRi">👥</span><div class="t"><b>管理名單</b><small>新增、改名、換圖示、刪除、拖曳排序</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>分類</h3><div class="setC">
      <button class="setR" data-a="cats" data-ty="out" style="width:100%;text-align:left"><span class="gRi">📂</span><div class="t"><b>支出分類</b><small>${DB.acc.cats.out.map(p => p.n).join('、')}</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="cats" data-ty="in" style="width:100%;text-align:left"><span class="gRi">💰</span><div class="t"><b>收入分類</b><small>${DB.acc.cats.in.map(p => p.n).join('、')}</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="opt" style="width:100%;text-align:left"><span class="gRi">🧭</span><div class="t"><b>非必要消費</b><small>分析頁「必要／非必要」用</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>商家・帳戶・常用</h3><div class="setC">
      <button class="setR" data-a="payees" style="width:100%;text-align:left"><span class="gRi">🏪</span><div class="t"><b>商家／對象名稱</b><small>${DB.acc.payees.length ? DB.acc.payees.length + ' 個・' : ''}例如台灣自來水公司，各自歸到分類</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="accts" style="width:100%;text-align:left"><span class="gRi">🏦</span><div class="t"><b>帳戶</b><small>${DB.acc.accts.length} 個・現金、銀行、信用卡、行動支付</small></div><span class="chev">›</span></button>
      <button class="setR" data-a="tpls" style="width:100%;text-align:left"><span class="gRi">⭐</span><div class="t"><b>常用紀錄</b><small>${DB.acc.tpls.length ? `${DB.acc.tpls.length} 筆常用紀錄` : '在「記一筆」按「⭐ 存成常用」建立'}</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>匯出</h3><div class="setC"><button class="setR" data-a="csv" style="width:100%;text-align:left"><span class="gRi">📤</span><div class="t"><b>匯出 CSV</b><small>選日期區間：所有消費明細（含品項、分帳），以及資產明細</small></div><span class="chev">›</span></button></div></div>
    <div class="setG"><h3>備份與換機（整個日日帳本＋所有圖片）</h3><div class="bkWhat">📦 會備份：${BACKUP_WHAT}。手機、雲端、QR Code 換機都一樣；只有雲端登入和記帳密碼不備份。</div><div class="setC">
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
  const t = e.target.closest('[data-a],[data-me],[data-unlink]'); if (!t) return; buzz(8); const a = t.dataset.a;
  if (t.dataset.me) { DB.acc.me = t.dataset.me; saveAcc(); renderAccCfg(); return; }
  if (t.dataset.unlink) { const k = t.dataset.unlink, a = accSameName(k); if (!await ask(`取消「${a ? a.name : (DB.acc.sameN || {})[k] || ''}」＝「${aWho(k).name}」？\n已經併在一起的紀錄不會拆開，之後從分帳匯入的才會分開算。`, '取消連結', true)) return; buzz(15); accUnlink(k); renderAccCfg(); return; }
  if (a === 'people') { await accPeopleEdit(); renderAccCfg(); return; }
  if (a === 'link') { if (await accLinkAsk()) renderAccCfg(); return; }
  if (a === 'guard') { if (!NB.guardOn()) { Guard.asked = 1; NB.guardEnable(); return; }
    if (!await ask('關閉後，日日帳本就可以直接被解除安裝（帳本資料會一起刪除）。確定要關閉嗎？', '關閉保護', true)) return;
    if (AccLock.has() && !await new Promise(r => accPinPad({title: '關閉防誤刪要先驗證', onOk: () => r(true), onCancel: () => r(false)}))) return;
    NB.guardDisable(); setTimeout(renderAccCfg, 300); toast('已關閉防止誤刪'); return; }
  if (a === 'leave') leaveAcc(); else if (a === 'guide') openGuide('acc'); else if (a === 'lkSet') { await accSetPin(); renderAccCfg(); } else if (a === 'lkTog') { await AccLock.toggle(); renderAccCfg(); } else if (a === 'lkDel') { await accClearPin(); } else if (a === 'lkBio') { if (S.accBio !== false) { const ok = await new Promise(r => accPinPad({title: '關閉指紋解鎖要先驗證', onOk: () => r(true), onCancel: () => r(false)})); if (!ok) return; S.accBio = false; } else S.accBio = true; saveS(); renderAccCfg(); } else if (a === 'qNotif') { S.qNotif = !S.qNotif; saveS(); NB.quickNotif(!!S.qNotif); accWidgetPush(); renderAccCfg(); toast(S.qNotif ? '🔔 已開啟通知欄快速記帳' : '已關閉通知欄快速記帳'); } else if (a === 'wHide') { S.wHide = !S.wHide; saveS(); accWidgetPush(); renderAccCfg(); } else if (a === 'cats') editCatTree(t.dataset.ty); else if (a === 'opt') optCfg(); else if (a === 'payees') managePayees(); else if (a === 'accts') enterAcc('AccA'); else if (a === 'tpls') manageTpls(); else if (a === 'csv') accCsv();
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
const tpFolded = k => !!(S.tpFold || {})[k];
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
      <div class="tpTop"><span class="small muted">點一下打開記一筆確認；點分類名稱收合，按住可以整組上下移動；按住紀錄拖曳排序；按 ✎ 編輯。</span>${G.length ? `<button class="btn sm" data-fa="1">${G.every(g => tpFolded(g.k)) ? '⊞ 全部展開' : '⊟ 全部收合'}</button>` : ''}</div>
      <div id="tpL">${G.map(g => `<div class="tpG ${tpFolded(g.k) ? 'fold' : ''}" data-g="${g.k}"><div class="tpGH" data-fg="${g.k}">${G.length > 1 ? '<span class="grip"></span>' : ''}<span class="lbl">${esc(g.n)}</span><em>${g.L.length}</em><i class="tpArr">${tpFolded(g.k) ? '▸' : '▾'}</i></div>${(tpFolded(g.k) ? [] : g.L).map(t => `<div class="tpR card" data-t="${t.id}"><span class="grip"></span><button class="tpUse" data-use="${t.id}"><b>${esc(t.name)}</b><small>${esc([t.payee, t.type === 'tr' ? acctName(t.acct) + ' → ' + acctName(t.to) : acctName(t.acct), (t.split || []).length ? '分帳 ' + t.split.length + ' 人' : ''].filter(Boolean).join('・'))}</small><span class="tpV ${!+t.amt ? '' : t.type === 'in' ? 'pos' : t.type === 'out' ? 'neg' : ''}">${+t.amt ? money(t.amt) : '💬 每次輸入金額'}</span></button><button class="ic" data-ed="${t.id}" aria-label="編輯">✎</button></div>`).join('')}</div>`).join('') || '<div class="empty">這一類還沒有常用紀錄<br><span class="small">按下面「＋ 新增常用紀錄」，或在記一筆時按「⭐ 存成常用」</span></div>'}</div>`;
    sortable($('#tpL', sh.body), {item: '.tpR', scope: '.tpG', scroller: sh.body, onSort(f, t, scope) { const ids = $$('.tpR', scope).map(e => e.dataset.t), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv);
      const pos = DB.acc.tpls.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => DB.acc.tpls.find(x => x.id === id)); pos.forEach((p, i) => { DB.acc.tpls[p] = objs[i]; }); saveAcc(); draw(); renderAcc(); }});
    /* 分類整組上下移動 */
    if (G.length > 1) sortable($('#tpL', sh.body), {item: '.tpG', handle: '.tpGH', handleOnly: true, scroller: sh.body, onSort(f, t) { const ks = G.map(g => g.k), mv = ks.splice(f, 1)[0]; ks.splice(t, 0, mv);
      DB.acc.tgord = DB.acc.tgord || {}; DB.acc.tgord[ty] = ks; saveAcc(); draw(); renderAcc(); }}); };
  draw();
  sh.body.addEventListener('click', async e => { const fg = e.target.closest('[data-fg]'); if (fg && !e.target.closest('button')) { buzz(8); const k = fg.dataset.fg; S.tpFold = S.tpFold || {}; S.tpFold[k] = !tpFolded(k); saveS(); draw(); return; }
    const t = e.target.closest('button'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.fa) { const G = groups(), all = G.every(g => tpFolded(g.k)); S.tpFold = S.tpFold || {}; G.forEach(g => { S.tpFold[g.k] = !all; }); saveS(); draw(); return; }
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

/* 防止誤刪：原生回報「裝置管理員」開關結果 */
var Guard = {asked: 0, onNative(j) { let o = {}; try { o = JSON.parse(j); } catch (e) {} const a = this.asked; this.asked = 0;
  if (o.on && a) { buzz(20); toast('🧷 已開啟防止誤刪，要刪除得先到手機設定停用保護', 3500); } else if (a && !o.on) toast(o.err ? '這支手機不支援防止誤刪' : '防止誤刪沒有開啟', 3000); if (typeof renderAccCfg === 'function') renderAccCfg(); }};

/* ===== 記帳裡的發票：號碼、日期時間、賣方，並可產生像紙本發票一樣的左右兩個 QR Code ===== */
function accChoose(title, opts) { return new Promise(res => { let done = false; const sh = sheet({title, onClose() { if (!done) res(null); }});
  sh.body.innerHTML = `<div class="chooseL">${opts.map(([k, t, d]) => `<button class="card" data-k="${k}"><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}</button>`).join('')}</div>`;
  sh.body.onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; buzz(10); done = true; sh.close(); res(b.dataset.k); }; }); }
/* 連結發票：寫入號碼，日期、時間改成發票上的（發票比較準） */
function accMigVia() { if (accMigVia.done) return; accMigVia.done = 1; try { (DB.acc.recs || []).forEach(r => { if (r.via === '現金面交') r.via = '現金支付'; (r.note && r.note.includes('（現金面交）')) && (r.note = r.note.split('（現金面交）').join('（現金支付）')); }); } catch (e) {} }
function accLinkInv(r, no) { r.inv = no; const v = (DB.invs || {})[no]; if (!v) return; if (v.date) r.d = v.date; if (v.time) r.t = String(v.time).slice(0, 5); v.acc = r.id; saveInvs(); }
/* 用發票上的品項名稱：數量一樣就照順序換名字；記帳原本沒有品項就整份帶入。備註裡的舊名稱也一起換 */
function accInvNames(r, iv) { const L = (r.bill && (r.bill.items || []).length ? r.bill.items : r.items) || [];
  if (L.length === iv.length) L.forEach((x, i) => { const old = x.n; x.n = iv[i].n; if (old && r.note) r.note = r.note.split(old).join(iv[i].n); });
  else { r.items = iv.map(x => ({n: x.n, amt: +x.amt || 0, q: x.q || 1, ppl: []})); }
  if (r.bill && r.items && r.items.length === r.bill.items.length) r.items.forEach((x, i) => { x.n = r.bill.items[i].n; }); }
function pickInvForAcc(r) { const L = Object.values(DB.invs || {}).filter(v => !v.acc || v.acc === r.id), A = +r.amt || 0;
  const sc = v => (v.date === r.d ? 6 : Math.abs(new Date(v.date) - new Date(r.d)) < 3 * 864e5 ? 3 : 0) + (A && Math.abs(numP(v.total) - A) < .5 ? 5 : 0) + (r.payee && sameSeller(invSeller(v), r.payee) ? 3 : 0);
  L.sort((x, y) => sc(y) - sc(x) || String(y.date).localeCompare(String(x.date)));
  return new Promise(res => { let done = false; const sh = sheet({title: '🧾 選一張發票', full: true, onClose() { if (!done) res(null); }});
    sh.body.innerHTML = L.length ? `<div class="small muted" style="margin-bottom:.5rem">日期、金額、店家相近的排在前面</div>` + L.slice(0, 150).map((v, i) => `<button class="acImp card" data-i="${i}"><span class="grow"><b>${esc(invSeller(v))}</b><small>${esc(v.no)}・${dayLabel(v.date)}${v.time ? ' ' + v.time : ''}・${(v.items || []).length} 項${sc(v) >= 8 ? '・⭐ 很可能是這張' : ''}</small></span><b>${money(numP(v.total))}</b></button>`).join('') : '<div class="empty">發票區還沒有發票，可以先掃描或匯入，或按「手動輸入號碼」</div>';
    sh.body.onclick = e => { const t = e.target.closest('[data-i]'); if (!t) return; buzz(10); done = true; sh.close(); res(L[+t.dataset.i]); }; }); }
function accInvHtml(r) { const v = r.inv ? (DB.invs || {})[r.inv] : null;
  if (!r.inv) return `<div class="lbl">🧾 發票</div><div class="acInv card empty2"><span class="small muted">還沒有發票號碼；發票之後才收到也可以回來補上</span><div class="acRow2" style="margin:.5rem 0 0"><button class="btn" data-a="invPick">🎫 選擇發票</button><button class="btn" data-a="invNo">✎ 手動輸入號碼</button></div></div>`;
  return `<div class="lbl">🧾 發票</div><div class="acInv card"><div class="acInvH"><b class="invNo">${esc(r.inv.slice(0, 2))}-${esc(r.inv.slice(2))}</b>${v ? `<span class="chip">${(v.items || []).length} 項</span>` : '<span class="chip">只有號碼</span>'}</div>
    <div class="acInvG">${v ? `<span>日期</span><b>${dayLabel(v.date)}${v.time ? ' ' + esc(v.time) : ''}</b><span>賣方</span><b>${esc(invSeller(v))}</b>${v.rnd ? `<span>隨機碼</span><b>${esc(v.rnd)}</b>` : ''}<span>總計</span><b>${money(numP(v.total))}</b>` : `<span>日期</span><b>${dayLabel(r.d)}${r.t ? ' ' + esc(r.t) : ''}</b>`}</div>
    <div class="acInvB"><button class="btn pri" data-a="invQr">🔳 發票 QR Code</button>${v ? '<button class="btn" data-a="invOpen">查看發票</button>' : ''}<button class="btn" data-a="invPick">換一張</button><button class="btn danger" data-a="invRm">拿掉</button></div></div>`; }
/* 依財政部電子發票 QR Code 格式產生左右兩個碼：左邊放發票號碼、日期、隨機碼、金額、統編和前幾個品項，右邊放剩下的品項。
   加密驗證欄位只有開立發票的店家能產生，這裡填 0，所以只給「日日帳本」或一般掃描讀取資料用，不能拿去對獎或歸戶。 */
function invQrStrings(r) { const v = (DB.invs || {})[r.inv] || {}, no = r.inv, d = new Date((v.date || r.d) + 'T00:00:00');
  const roc = String(d.getFullYear() - 1911).padStart(3, '0') + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const tot = Math.round(numP(v.total) || +r.amt || 0), hx = n => n.toString(16).toUpperCase().padStart(8, '0');
  let items = (v.items || []).filter(x => +x.amt > 0).map(x => ({n: x.n, q: x.q || 1, p: x.p != null ? x.p : r2((+x.amt || 0) / (x.q || 1))}));
  if (!items.length) items = ((r.bill && r.bill.items) || r.items || []).map(x => ({n: x.n, q: x.q || 1, p: r2((+x.amt || 0) / (x.q || 1))}));
  const clean = t => String(t).replace(/[:\n\r]/g, ' ').trim().slice(0, 30), seg = items.map(x => `${clean(x.n)}:${x.q}:${x.p}`);
  const head = `${no}${roc}${(v.rnd || '0000').slice(0, 4).padStart(4, '0')}${hx(tot)}${hx(tot)}00000000${/^\d{8}$/.test(v.sellerId || '') ? v.sellerId : '00000000'}${'0'.repeat(24)}`;
  const enc = new TextEncoder(); let left = [], used = enc.encode(head).length + 30; for (const g of seg) { const n = enc.encode(g).length + 1; if (left.length && used + n > 230) break; left.push(g); used += n; }
  const right = seg.slice(left.length);
  return {L: `${head}:**********:${left.length}:${items.length}:1:${left.join(':')}`, R: '**' + (right.length ? right.join(':') : ''), n: items.length}; }
function qrSvgStr(t, sz = 240) { const q = qrcode(0, 'L'); q.addData(unescape(encodeURIComponent(t))); q.make(); const n = q.getModuleCount(), c = sz / (n + 4); let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${((x + 2) * c).toFixed(2)} ${((y + 2) * c).toFixed(2)}h${c.toFixed(2)}v${c.toFixed(2)}h-${c.toFixed(2)}z`;
  return `<svg viewBox="0 0 ${sz} ${sz}" class="qrSvg"><rect width="${sz}" height="${sz}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`; }
function accInvQr(r) { const Q = invQrStrings(r), v = (DB.invs || {})[r.inv] || {};
  const sh = sheet({title: '🔳 發票 QR Code', full: true});
  sh.body.innerHTML = `<div class="einv"><div class="einvT">電子發票證明聯</div><div class="einvP">${(() => { const d = new Date((v.date || r.d) + 'T00:00:00'), y = d.getFullYear() - 1911, m = d.getMonth() + 1, a = m % 2 ? m : m - 1; return `${y}年${String(a).padStart(2, '0')}-${String(a + 1).padStart(2, '0')}月`; })()}</div>
    <div class="einvNo">${esc(r.inv.slice(0, 2))}-${esc(r.inv.slice(2))}</div><div class="einvD"><span>${esc(v.date || r.d)}${v.time || r.t ? ' ' + esc(v.time || r.t) : ''}</span></div>
    <div class="einvD"><span>隨機碼：${esc(v.rnd || '----')}</span><span>總計：${Math.round(numP(v.total) || +r.amt || 0)}</span></div>
    <div class="einvD"><span>賣方：${esc(v.sellerId || '—')}</span><span>${esc(v.seller ? invSeller(v) : r.payee || '')}</span></div>
    <div class="einvQ">${qrSvgStr(Q.L)}${qrSvgStr(Q.R)}</div><div class="einvF">左：發票資訊＋前段品項　右：其餘品項（共 ${Q.n} 項）</div></div>
    <div class="einvSw"><button class="btn" data-q="plain">📷 一般相機版（掃了直接看到明細文字）</button></div><div id="einvPlain"></div>
    <div class="blWarn" style="margin-top:.7rem">這是依發票格式產生的資料碼，用日日帳本或發票 App 掃描可以讀到號碼和品項；因為沒有店家的加密驗證，不能拿去兌獎或載具歸戶。</div>`;
  /* 一般手機相機掃 QR 只會顯示原始文字：另外做一個「易讀版」，掃了直接看到發票號碼、店家、品項和金額 */
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-q="plain"]'); if (!b) return; buzz(10); const box = $('#einvPlain', sh.body); if (box.innerHTML) { box.innerHTML = ''; return; }
    const its = (v.items || []).filter(x => +x.amt > 0), L = its.length ? its.map(x => `${x.n} ×${x.q || 1}  $${Math.round(+x.amt)}`) : ((r.bill && r.bill.items) || r.items || []).map(x => `${x.n} ×${x.q || 1}  $${Math.round(+x.amt || 0)}`);
    const t = [`電子發票 ${r.inv.slice(0, 2)}-${r.inv.slice(2)}`, `${v.date || r.d}${v.time || r.t ? ' ' + (v.time || r.t) : ''}`, (v.seller ? invSeller(v) : r.payee) || '', ...L, `總計 $${Math.round(numP(v.total) || +r.amt || 0)}`].filter(Boolean).join('\n');
    box.innerHTML = `<div class="einv" style="margin-top:.7rem"><div class="einvT" style="font-size:1rem">一般相機版</div><div style="max-width:15rem;margin:.5rem auto">${qrSvgStr(t, 300)}</div><pre class="einvTxt">${esc(t)}</pre></div>`; }); }

/* ===== 對帳還款歷史：未完成（還沒結清的每一筆）／已完成（每一次結清還款），可以依人或依時間分類、篩選某個人 ===== */
function accSettleHist() {
  if (accPruneSettles()) saveAcc();
  let st = 'done', by = 'p', who = '', open = new Set(), first = true; const sh = sheet({title: '📚 對帳還款歷史', full: true}), me = accMe();
  const moL = k => `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`;
  /* 未完成：每一筆還沒結清的分帳（對每個人各算一筆） */
  const pend = () => { const out = []; DB.acc.recs.forEach(r => { if (r.type !== 'out' || !(r.split || []).length) return; (r.split || []).map(x => x.p).concat(r.payer ? [r.payer] : []).forEach(p => { if (p === me || (r.settled || {})[p]) return; const o = accOwe(r, p); if (Math.abs(o) >= .01 && !out.some(x => x.r === r && x.p === p)) out.push({p, d: r.d, amt: o, r}); }); }); return out; };
  const done = () => DB.acc.settles.map(x => ({p: x.p, d: x.d, amt: x.amt, st: x}));
  const draw = () => { const all = st === 'done' ? done() : pend(), ppl = pOrder([...new Set(all.map(x => x.p))]), L = all.filter(x => !who || x.p === who).sort((a, b) => b.d.localeCompare(a.d));
    const sum = L => L.reduce((t, x) => t + x.amt, 0), groups = [];
    if (by === 'p') pOrder([...new Set(L.map(x => x.p))]).forEach(p => { const LL = L.filter(x => x.p === p), M = []; LL.forEach(x => { const k = x.d.slice(0, 7); let g = M.find(m => m.k === k); if (!g) M.push(g = {k, L: []}); g.L.push(x); }); groups.push({k: 'p:' + p, t: `${aWho(p).icon} ${aWho(p).name}`, L: LL, M}); });
    else { const M = []; L.forEach(x => { const k = x.d.slice(0, 7); let g = M.find(m => m.k === k); if (!g) M.push(g = {k, L: []}); g.L.push(x); }); M.forEach(m => groups.push({k: 'm:' + m.k, t: moL(m.k), L: m.L, M: null})); }
    if (first) { groups.slice(0, 1).forEach(g => { open.add(g.k); if (g.M && g.M[0]) open.add(g.k + '|' + g.M[0].k); }); first = false; }
    const amtTxt = v => st === 'done' ? (v >= 0 ? `他還我 ${money(v)}` : `我還他 ${money(-v)}`) : (v >= 0 ? `欠我 ${money(v)}` : `我欠 ${money(-v)}`);
    const row = x => { if (st === 'done') { const S = x.st, R = S.recs.map(id => DB.acc.recs.find(y => y.id === id)).filter(Boolean), tr = DB.acc.recs.find(y => y.settle === S.id), ok = open.has('s:' + S.id);
        return `<div class="shR"><button class="shRT" data-o="s:${S.id}"><span class="grow"><b>${S.d.slice(5).replace('-', '/')} ${by === 'm' ? esc(aWho(S.p).icon + ' ' + aWho(S.p).name) + '・' : ''}${R.length} 筆</b><small>${tr && acctName(tr.to || tr.acct) ? esc(acctName(tr.to || tr.acct)) : ''}${tr && tr.via ? '・' + esc(tr.via) : ''}${S.ok ? '・✓ 已確認' : ''}</small></span><b class="${S.amt >= 0 ? 'pos' : 'neg'}">${money(Math.abs(S.amt))}</b><i>${ok ? '▴' : '▾'}</i></button>
          ${ok ? `<div class="shRL">${R.map(r => `<button class="acIt" data-r="${r.id}"><span class="grow">${r.d.slice(5).replace('-', '/')} ${esc(r.payee || accCat(r).n)}</span><b>${money(Math.abs(accOwe(r, S.p)))}</b></button>`).join('') || '<div class="small muted">這批的紀錄已經刪除</div>'}</div>` : ''}</div>`; }
      return `<button class="shR shP" data-r="${x.r.id}"><span class="grow"><b>${x.d.slice(5).replace('-', '/')} ${by === 'm' ? esc(aWho(x.p).icon + ' ' + aWho(x.p).name) + '・' : ''}${esc(x.r.payee || accCat(x.r).n)}</b><small>${esc(accCat(x.r).i)} ${esc(accCat(x.r).n)}・總額 ${money(x.r.amt)}</small></span><b class="${x.amt >= 0 ? 'pos' : 'neg'}">${money(Math.abs(x.amt))}</b></button>`; };
    sh.body.innerHTML = `<div class="spSeg two"><button data-st="pend" class="${st === 'pend' ? 'on' : ''}">⏳ 未完成</button><button data-st="done" class="${st === 'done' ? 'on' : ''}">✅ 已完成</button></div>
      <div class="dkSeg shBy"><button data-by="p" class="${by === 'p' ? 'on' : ''}">👥 依人分類</button><button data-by="m" class="${by === 'm' ? 'on' : ''}">📅 依時間分類</button></div>
      ${ppl.length > 1 ? `<div class="whoRow pplGrid shWho"><button data-w="" class="${!who ? 'on' : ''}">全部</button>${ppl.map(p => `<button data-w="${p}" class="${who === p ? 'on' : ''}">${esc(aWho(p).icon)} ${esc(aWho(p).name)}</button>`).join('')}</div>` : ''}
      <div class="shSum card"><span>${st === 'done' ? `${L.length} 次還款` : `${L.length} 筆還沒結清`}</span><b class="${sum(L) >= 0 ? 'pos' : 'neg'}">${L.length ? amtTxt(sum(L)) : '—'}</b>${groups.length > 1 ? `<button class="btn sm" data-fa="1">${groups.every(g => open.has(g.k)) ? '⊟ 全部收合' : '⊞ 全部展開'}</button>` : ''}</div>
      ${groups.map(g => { const op = open.has(g.k); return `<div class="shG card ${op ? 'on' : ''}"><button class="shGH" data-o="${g.k}"><b>${op ? '▾' : '▸'} ${esc(g.t)}</b><small>${g.L.length} ${st === 'done' ? '次' : '筆'}</small><span class="grow"></span><em class="${sum(g.L) >= 0 ? 'pos' : 'neg'}">${amtTxt(sum(g.L))}</em></button>
        ${op ? (g.M ? g.M.map(m => { const k2 = g.k + '|' + m.k, o2 = open.has(k2); return `<div class="shM"><button class="shMH" data-o="${k2}"><span>${o2 ? '▾' : '▸'} ${moL(m.k)}</span><small>${m.L.length} ${st === 'done' ? '次' : '筆'}・${amtTxt(sum(m.L))}</small></button>${o2 ? m.L.map(row).join('') : ''}</div>`; }).join('') : g.L.map(row).join(''))
          + (st === 'pend' && by === 'p' ? `<button class="btn sm block" data-settle="${g.k.slice(2)}" style="margin:.4rem 0 .2rem">🤝 和${esc(aWho(g.k.slice(2)).name)}對帳</button>` : '') : ''}</div>`; }).join('') || `<div class="empty">${st === 'done' ? '還沒有對帳還款的紀錄' : '沒有還沒結清的欠款 👍'}</div>`}`; };
  draw();
  sh.body.onclick = async e => { const t = e.target.closest('[data-st],[data-by],[data-w],[data-o],[data-r],[data-fa],[data-settle]'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.st) { st = d.st; open = new Set(); first = true; draw(); return; }
    if (d.by) { by = d.by; open = new Set(); first = true; draw(); return; }
    if (d.w != null) { who = d.w; open = new Set(); first = true; draw(); return; }
    if (d.fa) { const gs = [...sh.body.querySelectorAll('.shGH')].map(b => b.dataset.o), all = gs.every(k => open.has(k)); if (all) open = new Set(); else { gs.forEach(k => open.add(k)); draw(); sh.body.querySelectorAll('.shMH').forEach(b => open.add(b.dataset.o)); } draw(); return; }
    if (d.o) { open.has(d.o) ? open.delete(d.o) : open.add(d.o); draw(); return; }
    if (d.settle) { sh.close(); accSettle(d.settle); return; }
    if (d.r) { const r = DB.acc.recs.find(x => x.id === d.r); if (r) { await accEdit(r); draw(); } } };
}
