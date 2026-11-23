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
const ACCT_PRESET = {
  bank: [['玉山銀行', '玉山', '#0f8f74'], ['國泰世華', '國泰', '#2e8b3d'], ['中國信託', '中信', '#d7282f'], ['台新銀行', '台新', '#d71920'], ['富邦銀行', '富邦', '#1a5fa8'], ['永豐銀行', '永豐', '#c41e3a'], ['兆豐銀行', '兆豐', '#b8102b'], ['第一銀行', '一銀', '#0067b1'], ['華南銀行', '華南', '#d9282f'], ['彰化銀行', '彰銀', '#e60012'], ['合作金庫', '合庫', '#009b4c'], ['土地銀行', '土銀', '#008c5a'], ['臺灣銀行', '臺銀', '#a8792c'], ['上海商銀', '上海', '#b5122c'], ['中華郵政', '郵局', '#009944'], ['元大銀行', '元大', '#00489d'], ['聯邦銀行', '聯邦', '#e2001a'], ['遠東商銀', '遠銀', '#b8102b'], ['新光銀行', '新光', '#e60012'], ['凱基銀行', '凱基', '#003a70'], ['星展銀行', '星展', '#e3001b'], ['渣打銀行', '渣打', '#0072ce'], ['匯豐銀行', '匯豐', '#db0011'], ['台中銀行', '中銀', '#e1251b'], ['臺灣企銀', '企銀', '#00508f'], ['王道銀行', '王道', '#f39800'], ['將來銀行', '將來', '#1e2e5c'], ['LINE Bank', 'LINE', '#06c755'], ['樂天銀行', '樂天', '#bf0000'], ['陽信銀行', '陽信', '#f08200'], ['京城銀行', '京城', '#00539f'], ['安泰銀行', '安泰', '#b8102b'], ['板信銀行', '板信', '#0c6eb5'], ['高雄銀行', '高銀', '#0090d8'], ['三信銀行', '三信', '#2f6f3e'], ['華泰銀行', '華泰', '#003399'], ['瑞興銀行', '瑞興', '#7a1f2b'], ['農會', '農會', '#3f8f2f']],
  card: [['國泰世華信用卡', '國泰', '#2e8b3d'], ['中信信用卡', '中信', '#d7282f'], ['台新信用卡', '台新', '#d71920'], ['玉山信用卡', '玉山', '#0f8f74'], ['富邦信用卡', '富邦', '#1a5fa8'], ['永豐信用卡', '永豐', '#c41e3a'], ['聯邦信用卡', '聯邦', '#e2001a'], ['匯豐信用卡', '匯豐', '#db0011'], ['兆豐信用卡', '兆豐', '#b8102b'], ['第一信用卡', '一銀', '#0067b1'], ['星展信用卡', '星展', '#e3001b'], ['遠東信用卡', '遠銀', '#b8102b'], ['樂天信用卡', '樂天', '#bf0000'], ['將來信用卡', '將來', '#1e2e5c'], ['華南信用卡', '華南', '#d9282f'], ['元大信用卡', '元大', '#00489d'], ['凱基信用卡', '凱基', '#003a70'], ['新光信用卡', '新光', '#e60012']],
  pay: [['LINE Pay', 'LINE', '#06c755'], ['街口支付', '街口', '#c8102e'], ['全支付', '全支', '#f26a21'], ['Apple Pay', 'Pay', '#1d1d1f'], ['Google Pay', 'G', '#4285f4'], ['Samsung Pay', 'S', '#1428a0'], ['悠遊付', '悠遊付', '#0aa5e0'], ['icash Pay', 'icash', '#e3007f'], ['台灣 Pay', 'TW', '#0063b1'], ['Pi 拍錢包', 'Pi', '#00a0e9'], ['歐付寶', '歐付', '#00a0e9'], ['OPEN 錢包', 'OPEN', '#e60012'], ['全盈+PAY', '全盈', '#f5b400'], ['橘子支付', '橘子', '#ff7e00'], ['中油 Pay', '中油', '#0067b1'], ['萬家福 Pay', '萬家福', '#e94709'], ['Hami Pay', 'Hami', '#2aa1d3'], ['PayPal', 'PP', '#003087']],
  stored: [['悠遊卡', '悠遊', '#00a0e9'], ['一卡通', '一卡通', '#e4007f'], ['icash', 'icash', '#e60012'], ['POYA Pay', 'POYA', '#e4007f'], ['星巴克隨行卡', '星巴克', '#00704a'], ['My FamiPay', 'Fami', '#00a6e2'], ['有錢卡', '有錢', '#f5b400'], ['麥當勞點點卡', 'M', '#da291c'], ['家樂福錢包', '家樂福', '#1f60a6'], ['高鐵 TGo', 'TGo', '#f28c00'], ['屈臣氏', '屈臣氏', '#00a99d'], ['康是美', '康是美', '#e5004f'], ['路易莎', '路易莎', '#5b3a29'], ['85度C', '85°C', '#7a1f2b']],
  cash: [['錢包', '💵'], ['零錢罐', '🪙'], ['外幣現金', '💱'], ['紅包袋', '🧧']]};
const mono = (t, c) => `m:${t}:${c}`;
const lightBg = c => { const n = parseInt(String(c).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return r * .299 + g * .587 + b * .114 > 170; };
const monoHtml = s2 => { const [, t, c] = String(s2).split(':'); return `<span class="aMono ${[...t].length > 2 ? 'sm' : ''} ${lightBg(c) ? 'dk' : ''}" style="--m:${c}">${esc(t)}</span>`; };
const logoURL = d => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
const aIco = a => !a ? '' : String(a.i || '').startsWith('m:') ? monoHtml(a.i) : a.logo ? `<img class="aLogo" src="${logoURL(a.logo)}" alt="" onerror="this.replaceWith(document.createTextNode('${AK[a.kind] ? AK[a.kind][1] : '🏦'}'))">` : esc(a.i || '');
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
    const curH = String(cur || '').startsWith('m:') ? monoHtml(cur) : esc(cur || '？');
    const monos = fin ? Object.entries({bank: '銀行', card: '信用卡', pay: '行動支付', stored: '儲值'}).map(([k, n]) => `<div class="lbl">${n}</div><div class="icG mono">${ACCT_PRESET[k].map(([nm, t, c]) => `<button data-e="${esc(mono(t, c))}" title="${esc(nm)}">${monoHtml(mono(t, c))}</button>`).join('')}</div>`).join('') : '';
    sh.body.innerHTML = `<div class="icCur"><span>${curH}</span><input id="icIn" placeholder="${fin ? '輸入簡稱做成徽章（例如 合庫）或貼表情符號' : '或輸入／貼上任何表情符號'}" maxlength="8"><button class="btn sm pri" data-a="use">使用</button></div>
      ${fin ? `<div class="icColors">${['#0f8f74', '#2e8b3d', '#d7282f', '#1a5fa8', '#0067b1', '#c8102e', '#f39800', '#7a1f2b', '#5a7a44', '#1d1d1f', '#00a0e9', '#e4007f'].map(c => `<button data-c="${c}" style="background:${c}" class="${c === monoC ? 'on' : ''}"></button>`).join('')}</div>` : ''}
      ${rec.length ? `<div class="lbl">最近用過</div><div class="icG ${fin ? 'mono' : ''}">${rec.map(e => `<button data-e="${esc(e)}">${String(e).startsWith('m:') ? monoHtml(e) : e}</button>`).join('')}</div>` : ''}
      ${monos}${Object.entries(fin ? ICONS_FIN : ICONS).map(([k, v]) => `<div class="lbl">${k}</div><div class="icG">${seg(v).map(e => `<button data-e="${e}" class="${e === cur ? 'on' : ''}">${e}</button>`).join('')}</div>`).join('')}`;
    const finish = e => { if (!e) return; DB.acc[rk] = [e].concat((DB.acc[rk] || []).filter(x => x !== e)).slice(0, 24); saveAcc(); done = true; sh.close(); res(e); };
    sh.body.onclick = e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.c) { monoC = t.dataset.c; $$('[data-c]', sh.body).forEach(b => b.classList.toggle('on', b === t)); return; }
      if (t.dataset.e) finish(t.dataset.e);
      else if (t.dataset.a === 'use') { const v = $('#icIn', sh.body).value.trim(); if (!v) return; const first = Array.from(new Intl.Segmenter().segment(v), x => x.segment)[0];
        finish(fin && !/\p{Extended_Pictographic}/u.test(first) ? mono(v.slice(0, 4), monoC) : first); } }; });
}
/* 名稱和圖示分開設定（類別、帳戶共用） */
function nameIcon(title, o, opts = {}) {
  return new Promise(res => { let done = false, ic = o.i || opts.icon || '📁'; const sh = sheet({title, onClose() { if (!done) res(null); }, foot: `${opts.del ? '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>' : ''}<button class="btn pri" data-a="ok">儲存</button>`});
    sh.body.innerHTML = `<div class="niRow"><button class="niIc" data-a="ic">${String(ic).startsWith('m:') ? monoHtml(ic) : esc(ic)}<small>換圖示</small></button><div class="field grow" style="margin:0"><label>名稱</label><input id="niN" value="${esc(o.n || '')}" placeholder="${esc(opts.ph || '')}"></div></div>${opts.extra || ''}`;
    sh.body.onclick = async e => { const t = e.target.closest('[data-a="ic"]'); if (!t) return; buzz(8); const v = await iconPick(ic, opts.lib); if (v) { ic = v; t.innerHTML = (String(v).startsWith('m:') ? monoHtml(v) : esc(v)) + '<small>換圖示</small>'; } };
    sh.foot.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); if (b.dataset.a === 'del') { done = true; sh.close(); res({del: true}); return; }
      const n = $('#niN', sh.body).value.trim(); if (!n) { toast('請輸入名稱'); return; } const extra = opts.read ? opts.read(sh.body) : {}; done = true; sh.close(); res(Object.assign({n: n.slice(0, 14), i: ic}, extra)); };
    setTimeout(() => { const i = $('#niN', sh.body); if (i && !o.n) i.focus(); }, 250); });
}
const Acc = {ym: null, day: null, sym: null, statOpen: ''};
const saveAcc = debounce(() => IDB.put('kv', 'acc', DB.acc).catch(saveErr), 200);
const mkCats = L => L.map(([n, i, subs], k) => ({id: 'p' + k + uid(), n, i, subs: subs.map(([sn, si, opt], j) => Object.assign({id: 'c' + k + j + uid(), n: sn, i: si}, opt ? {opt: 1} : {}))}));
async function loadAcc() {
  const v = await IDB.get('kv', 'acc').catch(() => null);
  DB.acc = Object.assign({v: 2, recs: [], settles: [], cats: {out: mkCats(ACC_OUT2), in: mkCats(ACC_IN2)}, accts: [{id: 'a0' + uid(), n: '現金', i: '💵', kind: 'cash', bal0: 0}], payees: [], tpls: [], me: '', autopay: {}}, v || {});
  const A = DB.acc; ['payees', 'tpls', 'settles', 'recs'].forEach(k => { A[k] = A[k] || []; }); A.autopay = A.autopay || {};
  if (v && v.v !== 2) {   /* v1 → v2：平的類別放進母分類；帳戶加上種類 */
    ['out', 'in'].forEach(ty => { const old = (v.cats || {})[ty] || [], base = mkCats(ty === 'out' ? ACC_OUT2 : ACC_IN2);
      old.forEach(c => { let hit = null; base.forEach(P => P.subs.forEach(s => { if (s.n === c.n) hit = s; })); if (hit) hit.id = c.id; else { const P = base.find(x => x.n === c.n) || base[base.length - 1]; P.subs.push({id: c.id, n: c.n, i: c.i}); } });
      A.cats[ty] = base; });
    A.accts = (v.accts || []).map(a => Object.assign({kind: /信用卡|卡/.test(a.n) ? 'card' : /銀行|郵局/.test(a.n) ? 'bank' : /支付|pay/i.test(a.n) ? 'pay' : 'cash', bal0: 0}, a));
    if (!A.accts.length) A.accts = [{id: 'a0' + uid(), n: '現金', i: '💵', kind: 'cash', bal0: 0}];
    A.recs.forEach(r => { if (r.tags && r.tags.length && !r.payee) r.payee = r.tags[0]; }); A.v = 2; saveAcc(); }
}
const accMe = () => { const P = DB.mcfg.people; if (DB.acc.me && P.some(u => u.id === DB.acc.me)) return DB.acc.me; const u = P.find(x => x.name === '我') || P[0]; return u ? u.id : 'me'; };
/* 找類別：回傳 {p: 母分類, s: 子分類} */
function catFind(type, id) { const L = DB.acc.cats[type === 'in' ? 'in' : 'out'] || []; for (const p of L) { if (p.id === id) return {p, s: null}; const s = (p.subs || []).find(x => x.id === id); if (s) return {p, s}; } return {p: null, s: null}; }
const accCat = r => { if (r.type === 'tr') return {n: r.from === '' && r.settle ? '收回欠款' : '轉帳', i: '🔄'}; const f = catFind(r.type, r.cat); return f.s ? {n: f.s.n, i: f.s.i || f.p.i, pn: f.p.n} : f.p ? {n: f.p.n, i: f.p.i, pn: f.p.n} : {n: r.type === 'in' ? '收入' : '支出', i: r.type === 'in' ? '💵' : '📦', pn: '其他'}; };
const accAcct = id => DB.acc.accts.find(a => a.id === id);
const acctName = id => { const a = accAcct(id); return a ? (String(a.i).startsWith('m:') || a.logo ? (AK[a.kind] || ['', '🏦'])[1] : a.i) + ' ' + a.n : ''; };
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
  const net = {}; mon.forEach(r => { if (r.type !== 'tr') net[r.d] = (net[r.d] || 0) + accSign(r) * accMine(r); });
  let cells = ''; for (let i = 0; i < first.getDay(); i++) cells += '<span class="cd emp"></span>';
  for (let d = 1; d <= nd; d++) { const k = ymd(new Date(Y, Mo, d)), dow = (first.getDay() + d - 1) % 7, v = net[k];
    cells += `<button class="cd ${k === Acc.day ? 'sel' : ''} ${k === today ? 'tdy' : ''} ${dow === 0 || dow === 6 ? 'we' : ''}" data-d="${k}"><b>${d}</b>${v ? `<em class="acN ${v > 0 ? 'pos' : ''}">${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}</em>` : ''}</button>`; }
  const debts = accDebts(), dIds = pOrder(Object.keys(debts));
  const L = (Acc.day ? mon.filter(r => r.d === Acc.day) : mon).slice().sort(recSort);
  const days = []; L.forEach(r => { let g = days.find(x => x.d === r.d); if (!g) days.push(g = {d: r.d, L: []}); g.L.push(r); });
  $('#accSub').textContent = `${Mo + 1}月・${mon.length} 筆`;
  box.innerHTML = `<button class="acTplBtn card" data-a="tpls"><span class="acTplI">⭐</span><span class="grow"><b>常用紀錄</b><small>${DB.acc.tpls.length ? esc(DB.acc.tpls.slice(0, 3).map(t => t.name).join('、')) + (DB.acc.tpls.length > 3 ? ` 等 ${DB.acc.tpls.length} 個` : '') : '每月房租、手機費…點一下就記好'}</small></span><span class="acDGo">打開 ›</span></button>
    <div class="acSum card"><div class="acT out"><small>支出（我的）</small><b>${money(out)}</b></div><div class="acT in"><small>收入</small><b>${money(inc)}</b></div><div class="acT bal"><small>結餘</small><b>${money(inc - out)}</b></div></div>
    ${dIds.length ? `<div class="acDebt card"><div class="acDH"><b>🤝 還沒結清的欠款</b><button class="btn sm" data-a="settleLog">對帳紀錄</button></div>${dIds.map(p => { const u = mWho(p), v = debts[p]; return `<button class="acDR" data-settle="${p}"><span class="acDI">${esc(u.icon)}</span><span class="grow"><b>${esc(u.name)}</b><small>${v > 0 ? '欠我' : '我欠他'}</small></span><span class="acDV ${v > 0 ? 'pos' : 'neg'}">${money(Math.abs(v))}</span><span class="acDGo">對帳 ›</span></button>`; }).join('')}</div>` : ''}
    <div class="cal card">${calHead(Y, Mo)}<div class="calWd">${MWD.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div><div class="calG acCal">${cells}</div></div>
    ${Acc.day ? `<div class="invDayBar"><span class="grow">📅 只看 ${dayLabel(Acc.day)}</span><button class="btn sm" data-a="allDays">看整個月</button></div>` : ''}
    ${days.map(g => { const s = g.L.reduce((t, r) => t + accSign(r) * accMine(r), 0); return `<div class="acDay"><span>${dayLabel(g.d)}</span>${s ? `<b class="${s > 0 ? 'pos' : 'neg'}">${s > 0 ? '+' : ''}${money(s)}</b>` : ''}</div>${g.L.map(accCard).join('')}`; }).join('')
      || `<div class="empty mealEmpty"><span class="big">📒</span>${Acc.day ? '這天' : '這個月'}還沒有記帳<br><span class="small">按上面的「＋ 記一筆」，或「從分帳匯入」把購物明細帶進來</span></div>`}`;
}
function accCard(r) {
  const c = accCat(r), me = accMe(), sp = (r.split || []).filter(s => s.p !== me), payer = r.payer || me;
  if (r.type === 'tr') return `<button class="acR card" data-r="${r.id}"><span class="acI tr">🔄</span><span class="acM"><b>${esc(r.note || c.n)}</b><small>${esc([r.t, (r.acct ? acctName(r.acct) : esc('外部')) + ' → ' + (acctName(r.to) || '外部'), +r.fee ? '手續費 ' + money(r.fee) : ''].filter(Boolean).join('・'))}</small></span><span class="acV">${money(r.amt)}</span></button>`;
  const chips = sp.length ? (payer === me ? sp.map(s => { const st = (r.settled || {})[s.p]; return `<span class="acChip ${st ? 'ok' : ''}">${esc(mWho(s.p).name)} 欠 ${money(s.amt)}${st ? ' ✓' : ''}</span>`; }).join('')
    : `<span class="acChip ${(r.settled || {})[payer] ? 'ok' : 'neg'}">${esc(mWho(payer).name)} 付・我欠 ${money(-accOwe(r, payer))}${(r.settled || {})[payer] ? ' ✓' : ''}</span>`) : '';
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
  if (S.inAcc) document.body.classList.add('mAcc');
  $('#accNew').onclick = () => { buzz(15); accEdit(null); };
  $('#accImp').onclick = () => { buzz(10); accImportBills(); };
  $('#accFind').onclick = () => { buzz(10); accSearch(); };
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
  $('#accABody').addEventListener('click', accAssetClick);
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
    sh.body.innerHTML = `<button class="btn block" data-a="custom" style="margin-bottom:.8rem">✏️ 自己輸入名稱和圖示</button>${P.length ? `<div class="lbl">常見的${AK[kind][0]}</div><div class="acPre">${P.map(([n, t, c], i) => `<button data-i="${i}">${c ? monoHtml(mono(t, c)) : t}<span>${esc(n)}</span></button>`).join('')}</div>` : ''}
      <div class="small muted" style="margin-top:.7rem">${kind === 'pay' ? '行動支付沒有餘額，是付款方式；新增後請設定它綁定哪個銀行、信用卡或儲值帳戶，記帳時會從那個帳戶扣款。' : kind === 'stored' ? '儲值帳戶（悠遊卡、一卡通、POYA Pay…）有自己的餘額，可以用「轉帳」從銀行儲值。' : '選好之後可以在資產頁點帳戶換圖示。'}</div>`;
    const add = a => { DB.acc.accts.push(a); saveAcc(); done = true; sh.close(); res(a); };
    sh.body.onclick = async e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.i != null) { const [n, tt, c] = P[+t.dataset.i]; add({id: 'a' + uid(), n, i: c ? mono(tt, c) : tt, kind, bal0: 0}); return; }
      if (t.dataset.a === 'custom') { const v = await nameIcon(`新增${AK[kind][0]}`, {n: '', i: AK[kind][1]}, {lib: 'fin', ph: {cash: '例如：錢包', bank: '例如：玉山銀行', card: '例如：CUBE 卡', stored: '例如：悠遊卡', pay: '例如：LINE Pay'}[kind]}); if (v) add({id: 'a' + uid(), n: v.n, i: v.i, kind, bal0: 0}); } }; });
}

/* ---------- 商家／對象 ---------- */
function pickPayee(type, cur) {
  return new Promise(res => { let done = false, q = ''; const sh = sheet({title: '🏪 商家／對象', full: true, onClose() { if (!done) res(undefined); }});
    sh.body.innerHTML = `<div class="searchBox" style="margin-bottom:.6rem"><input id="pyQ" type="search" placeholder="搜尋或直接輸入新名稱"></div><div class="row" style="gap:.5rem;margin-bottom:.7rem"><button class="btn sm" data-a="new">＋ 新增名稱</button><button class="btn sm" data-a="none">不填</button></div><div id="pyL"></div>`;
    /* 全部用同一種分組：自訂名稱依記帳母分類（生活：台電、台水…），收藏店家依收藏分類（早餐、午餐…）；每組可以收合 */
    const fold = () => (S.pyFold = S.pyFold || {});
    const draw = () => { const hit = n => !q || n.toLowerCase().includes(q), mine = DB.acc.payees.filter(p => hit(p.n)), places = (DB.places || []).filter(p => hit(p.name) && !DB.acc.payees.some(x => x.n === p.name));
      const G = []; DB.acc.cats[type].forEach(P => { const L = mine.filter(p => { const f = catFind(type, p.cat); return f.p && f.p.id === P.id; }); if (L.length) G.push({k: 'y' + P.id, ic: P.i, n: P.n, color: '#8a6a4a', L, kind: 'py'}); });
      const un = mine.filter(p => !catFind(type, p.cat).p); if (un.length) G.push({k: 'y_', ic: '🏷️', n: '其他名稱', color: '#8a6a4a', L: un, kind: 'py'});
      DB.cats.concat([UNCAT]).forEach(c => { const L = places.filter(p => c.id ? p.cat === c.id : !DB.cats.some(x => x.id === p.cat)); if (L.length) G.push({k: 'c' + (c.id || '_'), cid: c.id || '', ic: c.icon, n: c.name, color: c.color, L, kind: 'pl'}); });
      const F = fold(), allFold = G.length && G.every(g => F[g.k]);
      $('#pyL', sh.body).innerHTML = `<div class="pyW">${(q && !mine.some(p => p.n === q) ? `<button class="acPy new" data-add="${esc(q)}">＋ 新增「${esc($('#pyQ', sh.body).value.trim())}」</button>` : '')
        + (G.length && !q ? `<div class="pyTop"><span class="small muted grow">按住 ☰ 拖曳分類、按住名稱拖曳排序</span><button class="btn sm" data-a="foldAll">${allFold ? '⊞ 全部展開' : '⊟ 全部收合'}</button></div>` : '')
        + `<div class="pyCats">${G.map(g => { const shut = !q && F[g.k]; return `<div class="pyCat k${g.kind} ${shut ? 'shut' : ''}" data-k="${g.k}" data-cid="${g.cid || ''}"><button class="pyCH" data-fold="${g.k}" style="--c:${g.color}">${q || g.kind !== 'pl' ? '' : '<span class="grip"></span>'}<span>${esc(g.ic)}</span><b>${esc(g.n)}</b><em>${g.L.length}</em><i class="psCv">▾</i></button>${shut ? '' : `<div class="acPyG ${g.kind === 'pl' ? 'pyPl' : 'pyS'}">${g.L.map(p => g.kind === 'pl' ? `<button class="acPy ${p.name === cur ? 'on' : ''}" data-pl="${p.id}">${esc(p.name)}</button>` : `<button class="acPy ${p.n === cur ? 'on' : ''}" data-py="${p.id}">${esc(p.n)}${(() => { const f = catFind(type, p.cat); return f.s ? `<small>${esc(f.s.n)}</small>` : ''; })()}</button>`).join('')}</div>`}</div>`; }).join('')}</div>`
        + (G.length ? '' : '<div class="empty">還沒有名稱，按「＋ 新增名稱」建立（例如：台灣自來水公司、台灣電力公司）</div>')}</div>`;
      if (q) return; const W = $('.pyW', sh.body);
      sortable(W, {item: '.acPy[data-py]', scope: '.pyS', axis: 'grid', scroller: sh.body, onSort(f, t, scope) { const ids = $$('.acPy', scope).map(e => e.dataset.py), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv); const pos = DB.acc.payees.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => DB.acc.payees.find(x => x.id === id)); pos.forEach((p, i) => { DB.acc.payees[p] = objs[i]; }); saveAcc(); draw(); }});
      sortable(W, {item: '.acPy[data-pl]', scope: '.pyPl', axis: 'grid', scroller: sh.body, onSort(f, t, scope) { const ids = $$('.acPy', scope).map(e => e.dataset.pl), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv);
        const pos = DB.places.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => DB.places.find(x => x.id === id)); pos.forEach((p, i) => { DB.places[p] = objs[i]; });
        DB.places.forEach((p, i) => { if (p.ord !== i) { p.ord = i; savePlace(p); } }); draw(); }});
      const CW = $('.pyCats', sh.body); if (CW) sortable(CW, {item: '.pyCat.kpl', handle: '.grip', handleOnly: true, scroller: sh.body, onSort(f, t) { const els = $$('.pyCat.kpl', CW), ids = els.map(e => e.dataset.cid), real = ids.filter(Boolean).map(id => DB.cats.find(c => c.id === id));
        const mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv); const order = ids.filter(Boolean).map(id => DB.cats.find(c => c.id === id)), pos = DB.cats.map((c, i) => real.includes(c) ? i : -1).filter(i => i >= 0); pos.forEach((p, i) => { DB.cats[p] = order[i]; }); saveCats(); draw(); }}); };
    draw(); $('#pyQ', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    const fin = v => { done = true; sh.close(); res(v); };
    sh.body.addEventListener('click', async e => { const t = e.target.closest('button'); if (!t) return; buzz(8);
      if (t.dataset.fold) { const F = fold(); F[t.dataset.fold] = F[t.dataset.fold] ? 0 : 1; saveS(); draw(); return; }
      if (t.dataset.a === 'foldAll') { const F = fold(), ks = $$('.pyCat', sh.body).map(e => e.dataset.k), all = ks.every(k => F[k]); ks.forEach(k => { F[k] = all ? 0 : 1; }); saveS(); draw(); return; }
      if (t.dataset.py) { fin(DB.acc.payees.find(p => p.id === t.dataset.py)); return; }
      if (t.dataset.pl) { const P = DB.places.find(p => p.id === t.dataset.pl), cn = (DB.cats.find(c => c.id === P.cat) || {}).name || ''; let cat = ''; DB.acc.cats[type].forEach(pp => (pp.subs || []).forEach(s => { if (s.n === cn) cat = s.id; }));
        const py = {id: 'y' + uid(), n: P.name, cat}; DB.acc.payees.push(py); saveAcc(); fin(py); return; }
      if (t.dataset.a === 'none') { fin(null); return; }
      if (t.dataset.add != null || t.dataset.a === 'new') { const py = await editPayee(type, {n: t.dataset.add != null ? $('#pyQ', sh.body).value.trim() : ''}); if (py) fin(py); } }); });
}
function editPayee(type, p0) {
  return new Promise(res => { const isNew = !p0.id, p = Object.assign({id: 'y' + uid(), n: '', cat: ''}, p0); let ty = type, openP = '', done = false;
    const sh = sheet({title: isNew ? '新增商家／對象' : '編輯商家／對象', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">儲存</button>`, onClose() { if (!done) res(null); }});
    const draw = () => { sh.body.innerHTML = `<div class="field"><label>名稱</label><input id="pyN" value="${esc(p.n)}" placeholder="例如：台灣自來水公司、好鄰居超市 中央店"></div><div class="lbl">歸到哪個分類（記帳時選這個名稱會自動帶入）</div><div class="acType"><button data-ty="out" class="${ty === 'out' ? 'on' : ''}">支出</button><button data-ty="in" class="${ty === 'in' ? 'on' : ''}">收入</button></div>${catPickerHtml(ty, p.cat, openP)}`; };
    draw();
    sh.body.addEventListener('click', e => { const t = e.target.closest('button'); if (!t) return; buzz(8); p.n = $('#pyN', sh.body).value.trim();
      if (t.dataset.ty) { ty = t.dataset.ty; openP = ''; draw(); } else if (t.dataset.par) { openP = t.dataset.par; draw(); } else if (t.dataset.cat) { p.cat = t.dataset.cat; draw(); } });
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; p.n = $('#pyN', sh.body).value.trim();
      if (b.dataset.a === 'del') { if (!await ask(`刪除「${p.n}」？`, '刪除', true)) return; DB.acc.payees = DB.acc.payees.filter(x => x.id !== p.id); saveAcc(); done = true; sh.close(); res(null); return; }
      if (!p.n) { toast('請輸入名稱'); return; } const i = DB.acc.payees.findIndex(x => x.id === p.id); if (i >= 0) DB.acc.payees[i] = p; else DB.acc.payees.push(p); saveAcc(); done = true; sh.close(); res(p); }; });
}

/* ---------- 記一筆／編輯 ---------- */
function accEdit(r0, preset, opt = {}) {
  return new Promise(res => {
    const isNew = !r0, me = accMe(), now = new Date(), TPL = !!opt.tpl;
    const r = JSON.parse(JSON.stringify(r0 || Object.assign({id: 'r' + uid(), d: Acc.day || ymd(now), t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), type: 'out', amt: 0, cat: '', acct: (DB.acc.accts[0] || {}).id || '', to: '', fee: 0, note: '', payee: '', payer: me, split: [], items: [], imgs: []}, preset || {})));
    if (!r.d) r.d = Acc.day || ymd(now); if (!r.t) r.t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    r.imgs = r.imgs || []; if (!r.cat && r.type !== 'tr') r.cat = firstCat(r.type);
    let expr = r.amt ? String(r.amt) : '', openP = '', mode = (r.split || []).length && r.split.some((s, i, A) => Math.abs(s.amt - A[0].amt) > 0.011) ? 'custom' : 'even', saved = false;
    let who = (r.split || []).map(s => s.p), custom = {}; (r.split || []).forEach(s => { custom[s.p] = s.amt; });
    const sh = sheet({title: TPL ? (isNew ? '⭐ 新增常用紀錄' : '⭐ 編輯常用紀錄') : isNew ? '📒 記一筆' : '📒 編輯記帳', full: true, foot: TPL ? `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">儲存常用紀錄</button>` : `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn" data-a="tpl" style="flex:0 0 auto">⭐ 存成常用</button><button class="btn pri" data-a="ok">儲存</button>`, onClose() { if (!saved) res(null); }});
    const evalX = e2 => { try { const s2 = String(e2).replace(/×/g, '*').replace(/÷/g, '/').replace(/[^\d.+\-*/]/g, '').replace(/[+\-*/.]+$/, ''); if (!s2) return 0; const v = Function('"use strict";return (' + s2 + ')')(); return isFinite(v) ? r2(v) : 0; } catch (e) { return 0; } };
    const calc = () => evalX(expr);
    const shares = () => { const A = calc(); if (!who.length) return []; if (mode === 'custom') return who.map(p => ({p, amt: r2(+custom[p] || 0)}));
      const base = Math.floor(A / who.length * 100) / 100; let rest = r2(A - base * who.length); return who.map(p => { let v = base; if (rest > 0.001) { v = r2(v + 0.01); rest = r2(rest - 0.01); } return {p, amt: v}; }); };
    const draw = () => { const A = calc(), sp = shares(), sumSp = r2(sp.reduce((s, x) => s + x.amt, 0)), payer = r.payer || me, top = sh.body.scrollTop, tr = r.type === 'tr';
      sh.body.innerHTML = `<div class="acType three"><button data-ty="out" class="${r.type === 'out' ? 'on' : ''}">支出</button><button data-ty="in" class="${r.type === 'in' ? 'on' : ''}">收入</button><button data-ty="tr" class="${tr ? 'on' : ''}">轉帳</button></div>
        <div class="acAmt ${r.type}"><span class="acCur">NT$</span><b id="acA">${expr ? esc(expr) : '0'}</b>${/[+\-×÷]/.test(expr) ? `<small>= ${money(A)}</small>` : ''}</div>
        <div class="acKeys">${['AC', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '00', '0', '.'].map(k => `<button data-k="${k}" class="${/[⌫+−×÷]|AC/.test(k) ? 'op' : k === '=' ? 'eq' : ''}">${k}</button>`).join('')}</div>
        ${TPL ? '<div class="small muted" style="margin:-.5rem 0 .8rem">常用紀錄的金額可以留 0（例如每期不一樣的電費），點常用紀錄時會先讓你輸入金額。</div>' : ''}
        ${TPL ? `<div class="field"><label>常用紀錄名稱</label><input id="acTn" value="${esc(r.name || '')}" placeholder="例如：房租、手機月租"></div>` : ''}<div class="acRow2 ${TPL ? 'hide' : ''}"><button class="btn" data-a="date">📅 ${r.d.replace(/-/g, '/')}（${MWD[ymdDate(r.d).getDay()]}）</button><button class="btn" data-a="time">🕒 ${esc(r.t || '時間')}</button></div>
        ${tr ? `<div class="lbl">從哪個帳戶轉出</div>${acctPickerHtml(r.acct, 'acct', r.fund)}<div class="lbl">轉入哪個帳戶</div>${acctPickerHtml(r.to, 'to', r.fund2)}<div class="field" style="margin-top:.6rem"><label>手續費（沒有就留空）</label><input id="acFee" value="${+r.fee ? r.fee : ''}" inputmode="decimal" placeholder="0"></div>`
        : `<div class="lbl">類別</div>${catPickerHtml(r.type, r.cat, openP)}
        <div class="lbl">商家／對象</div><button class="acPayee" data-a="payee">${r.payee ? `<b>${esc(r.payee)}</b>` : '<span class="muted">選擇店名，或自訂名稱（例如：台灣電力公司）</span>'}<i>›</i></button>
        <div class="lbl">${r.type === 'in' ? '收進哪個帳戶' : '付款帳戶'}</div>${acctPickerHtml(r.acct, 'acct', r.fund)}`}
        <div class="field" style="margin-top:.7rem"><label class="row" style="gap:.4rem"><span class="grow">備註／購物明細</span></label>${tr ? '' : `<div class="acRow2" style="margin-bottom:.5rem"><button class="btn" data-a="billEd">🧾 ${r.bill ? '編輯明細（' + (r.bill.items || []).length + ' 項）' : '用分帳方式輸入'}</button><button class="btn" data-a="fromBill">📥 從分帳帶入</button></div>`}<textarea id="acNote" rows="${Math.min(10, Math.max(3, String(r.note || '').split('\n').length + 1))}" placeholder="例如：\n鮮奶 ×2  $95\n雞蛋  $60">${esc(r.note || '')}</textarea></div>
        <div class="lbl">圖片</div><div class="acImgs">${r.imgs.map((id, i) => `<span class="acImg"><img data-img="${id}" data-i="${i}" alt=""><button data-rmimg="${i}" aria-label="移除">✕</button></span>`).join('')}<button class="acImgAdd" data-a="addImg">＋<small>加入圖片</small></button></div>
        ${r.type === 'out' ? `<div class="acSplit card"><div class="acSH"><b>🤝 分帳</b><small>${who.length ? '選了 ' + who.length + ' 人分' : '不分帳就不用選'}</small></div>
          <div class="lbl">誰付的錢</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-payer="${u.id}" class="${payer === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div>
          <div class="lbl">誰要分（點選）</div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-who="${u.id}" class="${who.includes(u.id) ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}<button data-a="addP">＋ 新增</button></div>
          ${who.length ? `<div class="dkSeg acMode"><button data-mode="even" class="${mode === 'even' ? 'on' : ''}">平均分</button><button data-mode="custom" class="${mode === 'custom' ? 'on' : ''}">自己填金額</button></div>
            <div class="acShares">${sp.map(s => `<div class="acShR"><span>${esc(mWho(s.p).icon)} ${esc(mWho(s.p).name)}</span>${mode === 'custom' ? `<input data-cu="${s.p}" value="${custom[s.p] != null ? custom[s.p] : ''}" inputmode="decimal" placeholder="0">` : `<b>${money(s.amt)}</b>`}</div>`).join('')}</div>
            ${mode === 'custom' && Math.abs(sumSp - A) > 0.01 ? `<div class="blWarn">⚠️ 分攤合計 ${money(sumSp)}，和金額 ${money(A)} 差 ${money(A - sumSp)}</div>` : ''}
            <div class="acOwe">${sp.filter(s => s.p !== payer).map(s => `<span>${esc(mWho(s.p).name)} → ${esc(mWho(payer).name)}　<b>${money(s.amt)}</b></span>`).join('') || '<span class="muted">只有付錢的人自己，沒有欠款</span>'}</div>` : ''}</div>` : ''}
        ${(r.items || []).length ? `<div class="lbl">品項（從分帳帶入）</div><div class="acItems card">${r.items.map(x => `<div class="acIt"><span class="grow">${esc(x.n)}</span><small>${(x.ppl || []).map(p => esc(mWho(p).name)).join('、')}</small><b>${money(x.amt)}</b></div>`).join('')}</div>` : ''}`;
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
      if (d.ty) { if (r.type !== d.ty) { r.type = d.ty; openP = ''; if (d.ty !== 'tr') r.cat = firstCat(d.ty); } draw(); return; }
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
      else if (a === 'payee') { const p = await pickPayee(r.type, r.payee); if (p === undefined) return; r.payee = p ? p.n : ''; if (p && p.cat && catFind(r.type, p.cat).p) r.cat = p.cat; openP = ''; draw(); }
      else if (a === 'addAcct') { const ac = await newAcct(d.kind); if (ac) { r[d.key] = ac.id; draw(); } }
      else if (a === 'addImg') { const fs = await pickImages(true); if (!fs.length) return; busy('加入圖片…'); try { for (const f of fs) r.imgs.push(await imgStore(f, 2000)); } finally { busy(false); } draw(); }
      else if (a === 'addSub') { const P = DB.acc.cats[r.type].find(p => p.id === d.p), v = await nameIcon(`在「${P.n}」新增子分類`, {n: '', i: P.i}); if (!v) return; const c = {id: 'c' + uid(), n: v.n.slice(0, 10), i: v.i}; P.subs = P.subs || []; P.subs.push(c); r.cat = c.id; openP = P.id; saveAcc(); draw(); }
      else if (a === 'addP') { const n = ((await askText('新增人員名字', '')) || '').trim(); if (!n) return; const u = {id: 'u' + uid(), name: n.slice(0, 10), icon: PERSON_EMOJI[DB.mcfg.people.length % PERSON_EMOJI.length]}; DB.mcfg.people.push(u); saveMcfg(); who.push(u.id); draw(); }
      else if (a === 'billEd') { const b = r.bill ? JSON.parse(JSON.stringify(r.bill)) : {id: 'x' + uid(), place: '', pname: r.payee || '', way: '', time: r.t || '', items: [], disc: [], odisc: [], fees: [], total: '', imgs: []};
        editBill(b, {detached: true, onDone(bb) { if (!(bb.items || []).length && !(bb.fees || []).length) { delete r.bill; draw(); return; } const x = billToAccRec(bb, r.d); r.bill = bb; r.note = x.note; r.items = x.items; r.payee = billStore(bb) || r.payee; if (!r.cat || r.cat === firstCat(r.type)) r.cat = x.cat;
          if (x.split.length) { r.split = x.split; who = x.split.map(s2 => s2.p); custom = {}; x.split.forEach(s2 => { custom[s2.p] = s2.amt; }); mode = x.split.some((s2, i, A2) => Math.abs(s2.amt - A2[0].amt) > 0.011) ? 'custom' : 'even'; }
          expr = String(x.amt || ''); draw(); toast('已用模板二寫入備註'); }}); }
      else if (a === 'fromBill') { const pick = await pickBillForAcc(); if (!pick) return; const x = billToAccRec(pick.b, pick.k); x.imgs = await copyImgs(pick.b.imgs);
        Object.assign(r, {d: x.d, t: x.t || r.t, type: 'out', cat: x.cat, payee: x.payee, note: x.note, items: x.items, split: x.split, payer: me, src: x.src}); r.imgs = r.imgs.concat(x.imgs); expr = String(x.amt);
        who = x.split.map(s => s.p); custom = {}; x.split.forEach(s => { custom[s.p] = s.amt; }); mode = x.split.length && x.split.some((s, i, A2) => Math.abs(s.amt - A2[0].amt) > 0.011) ? 'custom' : 'even'; pick.b.acc = r.id; saveBills(); draw(); toast('已帶入分帳明細'); } });
    const build = () => { const A = calc(); r.amt = A; if (r.type === 'out') { r.split = shares(); if (r.split.length === 1 && r.split[0].p === (r.payer || me)) r.split = []; } else { r.split = []; r.payer = me; } if (r.type === 'tr') { r.cat = ''; r.payee = ''; } return A; };
    sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; keep(); buzz(10);
      if (TPL) { if (b.dataset.a === 'del') { if (!await ask('刪除這個常用紀錄？', '刪除', true)) return; DB.acc.tpls = DB.acc.tpls.filter(x => x.id !== r.id); saveAcc(); saved = true; sh.close(); res(null); return; }
        const A = build(); if (A < 0) { toast('金額不正確'); return; } if (!r.name) { toast('請輸入常用紀錄名稱'); return; } if (r.type === 'tr' && (!r.to || r.to === r.acct)) { toast('請選擇不同的轉出、轉入帳戶'); return; }
        const t = JSON.parse(JSON.stringify(r)); ['d', 't', 'settled', 'imgs', 'src', 'items'].forEach(k => delete t[k]); if (!t.id || t.id[0] !== 'T') t.id = 'T' + uid(); t.name = t.name.slice(0, 20);
        const i = DB.acc.tpls.findIndex(x => x.id === t.id); if (i >= 0) DB.acc.tpls[i] = t; else DB.acc.tpls.push(t); saveAcc(); saved = true; sh.close(); toast('⭐ 已儲存常用紀錄'); res(t); return; }
      if (b.dataset.a === 'del') { if (!await ask('確定要刪除這筆記帳嗎？', '刪除', true)) return; DB.acc.recs = DB.acc.recs.filter(x => x.id !== r.id); for (const id of r.imgs || []) imgDel(id); saveAcc(); saved = true; sh.close(); renderAcc(); toast('已刪除'); res(null); return; }
      const A = build(); if (!(A > 0)) { toast('請輸入金額'); return; }
      if (r.type === 'tr' && (!r.to || r.to === r.acct)) { toast('請選擇不同的轉出、轉入帳戶'); return; }
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
  const d = accDebts(), ids = pOrder(Object.keys(d)); const others = DB.mcfg.people.filter(u => u.id !== accMe() && !ids.includes(u.id));
  const sh = sheet({title: '🤝 要跟誰對帳？', html: `<div class="actList">${ids.map(p => `<button data-p="${p}">${esc(mWho(p).icon)} ${esc(mWho(p).name)}　<b class="${d[p] > 0 ? 'pos' : 'neg'}">${d[p] > 0 ? '欠我' : '我欠'} ${money(Math.abs(d[p]))}</b></button>`).join('')}${others.map(u => `<button data-p="${u.id}">${esc(u.icon)} ${esc(u.name)}　<span class="muted">沒有未結清</span></button>`).join('')}</div>`});
  sh.body.onclick = e => { const t = e.target.closest('[data-p]'); if (!t) return; buzz(10); sh.close(); accSettle(t.dataset.p); };
}
/* 對帳：每一筆可以勾選要不要這次結清（有的先還、有的之後還），勾選的這幾筆可以選錢進出哪個帳戶；結清後畫面留著，剩下的可以再選別的帳戶結清 */
function accSettle(p) {
  const u = mWho(p), pend = () => DB.acc.recs.filter(r => !(r.settled || {})[p] && accOwe(r, p)).sort((a, b) => (a.d + (a.t || '')).localeCompare(b.d + (b.t || '')));
  if (!pend().length) { toast(`和 ${u.name} 沒有還沒結清的帳`); return; }
  let from = pend()[0].d, to = ymd(new Date()), open = new Set(), into = '', off = new Set();
  const sh = sheet({title: `🤝 和 ${u.icon} ${u.name} 對帳`, full: true, foot: '<button class="btn" data-a="copy">📋 複製明細</button><button class="btn" data-a="csv">📤 CSV</button><button class="btn pri" data-a="ok">✅ 結清勾選的</button>'});
  const list = () => pend().filter(r => r.d >= from && r.d <= to), picked = () => list().filter(r => !off.has(r.id));
  const sum = L => r2(L.reduce((s, r) => s + accOwe(r, p), 0));
  const draw = () => { const L = list(), P = picked(), T = sum(L), TP = sum(P), top = sh.body.scrollTop;
    if (!pend().length) { sh.body.innerHTML = `<div class="empty mealEmpty"><span class="big">🎉</span>和 ${esc(u.name)} 的帳都結清了</div>`; sh.foot.classList.add('hide'); return; }
    sh.body.innerHTML = `<div class="acStH ${T >= 0 ? 'pos' : 'neg'}"><small>${from.replace(/-/g, '/')} ～ ${to.replace(/-/g, '/')}・${L.length} 筆</small><b>${T >= 0 ? `${esc(u.name)} 欠我` : `我欠 ${esc(u.name)}`}</b><strong>${money(Math.abs(T))}</strong>${P.length !== L.length ? `<small>這次勾選 ${P.length} 筆：${TP >= 0 ? '他還我' : '我還他'} <b>${money(Math.abs(TP))}</b></small>` : ''}</div>
      <div class="acRow2"><button class="btn" data-a="from">從 ${from.replace(/-/g, '/')}</button><button class="btn" data-a="to">到 ${to.replace(/-/g, '/')}</button></div>
      <div class="row" style="gap:.4rem;margin:-.3rem 0 .5rem"><button class="btn sm" data-a="all">全選</button><button class="btn sm" data-a="none">全不選</button><span class="small muted grow" style="text-align:right">勾選這次要結清的</span></div>
      <div class="acStL card">${L.map(r => { const c = accCat(r), o = accOwe(r, p), on = !off.has(r.id), its = (r.items || []).filter(x => (x.ppl || []).includes(p) || (r.payer === p && (x.ppl || []).includes(accMe()))); return `<div class="acStR ${on ? '' : 'dim'}"><button class="acCk2 ${on ? 'on' : ''}" data-ck="${r.id}" aria-label="勾選"></button><span class="acStD">${r.d.slice(5).replace('-', '/')}</span><span class="grow" data-o="${r.id}"><b>${esc(c.i)} ${esc(r.payee || c.n)}</b><small>總額 ${money(r.amt)}・${r.payer === p ? esc(u.name) + ' 付' : '我付'}${its.length ? '・' + its.length + ' 個品項 ' + (open.has(r.id) ? '▴' : '▾') : ''}</small>
        ${open.has(r.id) && its.length ? `<span class="acStIt">${its.map(x => `<span>${esc(x.n)}<em>${money(x.amt / ((x.ppl || []).length || 1))}</em></span>`).join('')}</span>` : ''}</span><b class="${o >= 0 ? 'pos' : 'neg'}">${o >= 0 ? '' : '-'}${money(Math.abs(o))}</b></div>`; }).join('') || '<div class="empty">這段期間沒有紀錄</div>'}</div>
      <div class="lbl" style="margin-top:.8rem">勾選的這 ${P.length} 筆：${TP >= 0 ? '錢收進哪個帳戶' : '從哪個帳戶付給他'}（可以不選；選了會同步資產餘額）</div>${acctPickerHtml(into, 'into')}
      <div class="small muted" style="margin-top:.6rem">結清後這幾筆就不會再算進欠款，剩下沒勾的會留著，可以之後再結清、或選別的帳戶。在「對帳紀錄」可以取消結清。</div>`;
    sh.body.scrollTop = top; };
  const text = () => { const L = picked(), T = sum(L); return [`🤝 ${u.name} 對帳（${from.replace(/-/g, '/')}～${to.replace(/-/g, '/')}）`, ''].concat(L.map(r => { const c = accCat(r), o = accOwe(r, p), its = (r.items || []).filter(x => (x.ppl || []).includes(p)); return `${r.d.slice(5).replace('-', '/')} ${r.payee || c.n}　${o >= 0 ? '' : '-'}${money(Math.abs(o))}` + (its.length ? '\n' + its.map(x => `　・${x.n} ${money(x.amt / ((x.ppl || []).length || 1))}`).join('\n') : ''); })).concat(['', T >= 0 ? `合計：${u.name} 欠我 ${money(T)}` : `合計：我欠 ${u.name} ${money(-T)}`]).join('\n'); };
  draw();
  sh.body.addEventListener('click', async e => { const t = e.target.closest('[data-a],[data-o],[data-ck],[data-acct],[data-kind],[data-fund]'); if (!t) return; buzz(8); const d = t.dataset;
    if (d.ck) { if (off.has(d.ck)) off.delete(d.ck); else off.add(d.ck); draw(); return; }
    if (d.o) { if (open.has(d.o)) open.delete(d.o); else open.add(d.o); draw(); return; }
    if (d.acct) { into = into === d.acct ? '' : d.acct; draw(); return; }
    if (d.kind && !d.a) { acctPickerHtml.k.into = d.kind; draw(); return; }
    if (d.a === 'addAcct') { const a = await newAcct(d.kind); if (a) { into = a.id; draw(); } return; }
    if (d.a === 'all') { off.clear(); draw(); return; } if (d.a === 'none') { list().forEach(r => off.add(r.id)); draw(); return; }
    if (d.a === 'from') { const k = await datePick(from); if (k) { from = k; draw(); } } else if (d.a === 'to') { const k = await datePick(to); if (k) { to = k; draw(); } } });
  sh.foot.onclick = async e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(10); const a = b.dataset.a, L = picked(), T = sum(L);
    if (a === 'copy') copyText(text());
    else if (a === 'csv') { const rows = [['日期', '類別', '商家／對象', '總額', '誰付', '欠款', '品項']].concat(L.map(r => [r.d, accCat(r).n, r.payee || '', r.amt, r.payer === p ? u.name : '我', accOwe(r, p), (r.items || []).filter(x => (x.ppl || []).includes(p)).map(x => x.n + ' ' + r2(x.amt / ((x.ppl || []).length || 1))).join('；')])).concat([[], [T >= 0 ? `${u.name} 欠我` : `我欠 ${u.name}`, '', '', '', '', Math.abs(T)]]);
      await saveCsv(`對帳_${u.name}_${from}_${to}.csv`, rows); }
    else if (a === 'ok') { if (!L.length) { toast('請先勾選要結清的紀錄'); return; } const ac = accAcct(into);
      if (!await ask(`${T >= 0 ? `${u.name} 還我` : `我還 ${u.name}`} ${money(Math.abs(T))}（${L.length} 筆）${ac ? `，${T >= 0 ? '收進' : '從'}「${ac.n}」` : ''}，標記為已結清？`, '結清')) return;
      const st = {id: 's' + uid(), p, d: ymd(new Date()), from: L[0].d, to: L[L.length - 1].d, amt: T, recs: L.map(r => r.id)}; DB.acc.settles.push(st); L.forEach(r => { r.settled = r.settled || {}; r.settled[p] = st.id; });
      if (into && Math.abs(T) > 0) { const now = new Date(), rr = {id: 'r' + uid(), d: st.d, t: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), type: 'tr', amt: Math.abs(T), acct: T >= 0 ? '' : into, to: T >= 0 ? into : '', fee: 0, note: T >= 0 ? `${u.name} 還款` : `還給 ${u.name}`, settle: st.id}; DB.acc.recs.push(rr); st.rec = rr.id; }
      saveAcc(); renderAcc(); buzz(40); off.clear(); into = ''; toast(`✅ 已結清 ${L.length} 筆${pend().length ? `，還有 ${pend().length} 筆沒結清` : ''}`); draw(); } };
}
function accSettleLog() {
  const sh = sheet({title: '📜 對帳紀錄', full: true}); const draw = () => { const L = DB.acc.settles.slice().reverse();
    sh.body.innerHTML = L.map(s => `<div class="acLog card"><span class="acDI">${esc(mWho(s.p).icon)}</span><span class="grow"><b>${esc(mWho(s.p).name)}・${s.amt >= 0 ? '他還我' : '我還他'} ${money(Math.abs(s.amt))}</b><small>${s.d} 結清・${s.from.slice(5)}～${s.to.slice(5)}・${s.recs.length} 筆</small></span><button class="btn sm" data-u="${s.id}">取消結清</button></div>`).join('') || '<div class="empty">還沒有對帳紀錄</div>'; };
  draw(); sh.body.onclick = async e => { const t = e.target.closest('[data-u]'); if (!t) return; if (!await ask('取消這次結清？這些紀錄會回到「未結清」。', '取消結清', true)) return;
    const s = DB.acc.settles.find(x => x.id === t.dataset.u); DB.acc.recs.forEach(r => { if (r.settled && r.settled[s.p] === s.id) delete r.settled[s.p]; }); DB.acc.recs = DB.acc.recs.filter(r => r.settle !== s.id); DB.acc.settles = DB.acc.settles.filter(x => x !== s); saveAcc(); draw(); renderAcc(); };
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
  const draw = () => { sh.body.innerHTML = `<div class="small muted" style="margin:-.2rem 0 .7rem">勾選要匯入的購物明細（已經匯入過的不會出現）。每個人分到的金額、品項明細和圖片都會一起帶進來，付錢的人預設是「${esc(mWho(accMe()).name)}」。</div>` + all.map(({k, b}) => { const c = billCalc(b), ids = pOrder(Object.keys(c.per)); return `<button class="acImp card ${sel.has(b.id) ? 'on' : ''}" data-b="${b.id}"><span class="acCk"></span><span class="grow"><b>${esc(billStore(b) || '購物明細')}</b><small>${dayLabel(k)}・${(b.items || []).length} 項${(b.imgs || []).length ? '・🖼️' + b.imgs.length : ''}${ids.length ? '・' + ids.map(p => esc(mWho(p).name) + ' ' + money(c.per[p])).join('、') : ''}</small></span><b>${money(c.total != null ? c.total : c.computed)}</b></button>`; }).join('');
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
      const c = accCat(r), s = [c.n, c.pn, r.payee, r.note, String(r.amt), acctName(r.acct), ...(r.split || []).map(x => mWho(x.p).name), ...(r.items || []).map(x => x.n)].join(' ').toLowerCase(); return s.includes(q); }).sort(recSort);
    const o = L.reduce((s, r) => s + (r.type === 'out' ? accMine(r) : 0), 0), i = L.reduce((s, r) => s + (r.type === 'in' ? +r.amt || 0 : 0), 0);
    $('#aqS', sh.body).innerHTML = `<div class="acSum card sm"><div class="acT out"><small>支出</small><b>${money(o)}</b></div><div class="acT in"><small>收入</small><b>${money(i)}</b></div><div class="acT bal"><small>${L.length} 筆</small><b>${money(i - o)}</b></div></div>`;
    $('#aqL', sh.body).innerHTML = L.slice(0, 200).map(r => `<div class="acDay"><span>${dayLabel(r.d)}</span></div>` + accCard(r)).join('') || '<div class="empty">找不到符合的紀錄</div>'; $('[data-a="only"]', sh.body).classList.toggle('on', only); };
  draw(); $('#aq', sh.body).oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-a],[data-r]'); if (!t) return; buzz(8); if (t.dataset.a === 'only') { only = !only; draw(); } else if (t.dataset.r) { const r = DB.acc.recs.find(x => x.id === t.dataset.r); if (r) accEdit(r).then(() => draw()); } });
}

/* ---------- ② 資產 ---------- */
function renderAccAsset() {
  const box = $('#accABody'); if (!box || !DB.acc) return; accAutoPay();
  const A = DB.acc.accts.filter(a => a.kind !== 'pay').map(a => ({a, b: acctBal(a)})), pos = A.filter(x => x.a.kind !== 'card').reduce((s, x) => s + x.b, 0), neg = A.filter(x => x.a.kind === 'card').reduce((s, x) => s + Math.min(0, x.b), 0);
  const debts = accDebts(), lend = Object.values(debts).reduce((s, v) => s + (v > 0 ? v : 0), 0), borrow = Object.values(debts).reduce((s, v) => s + (v < 0 ? -v : 0), 0);
  $('#accASub').textContent = `${DB.acc.accts.length} 個帳戶・按住拖曳排序`;
  const nextPay = a => { const now = new Date(); let d = new Date(now.getFullYear(), now.getMonth(), Math.min(+a.payDay, 28)); if (DB.acc.autopay[a.id] === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` || d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(+a.payDay, 28)); return d; };
  const row = a => { const b = a.kind === 'pay' ? null : acctBal(a), sub = a.kind === 'card' ? (+a.payDay && a.payFrom ? `每月 ${a.payDay} 號由 ${esc(acctName(a.payFrom))} 自動還款・下次 ${(d => `${d.getMonth() + 1}/${d.getDate()}`)(nextPay(a))}` : '⚠️ 還沒設定還款日和扣款帳戶') : a.kind === 'pay' ? (a.fund ? `扣款：${esc(acctName(a.fund))}` : '⚠️ 還沒設定扣款帳戶') : '';
    return `<div class="asR card" data-ac="${a.id}"><span class="asI">${aIco(a)}</span><span class="grow"><b>${esc(a.n)}</b>${sub ? `<small>${sub}</small>` : ''}</span>${b == null ? '<span class="asPay">付款方式</span>' : `<b class="asV ${b < 0 ? 'neg' : ''}">${money(b)}</b>`}</div>`; };
  box.innerHTML = `<div class="asW"><div class="asNet card"><small>淨資產</small><strong>${money(pos + neg + lend - borrow)}</strong><div class="asNetG"><span><small>資產</small><b class="pos">${money(pos)}</b></span><span><small>負債（信用卡）</small><b class="neg">${money(-neg)}</b></span><span><small>別人欠我</small><b>${money(lend)}</b></span><span><small>我欠別人</small><b>${money(borrow)}</b></span></div></div>
    ${Object.entries(AK).map(([k, [n, i]]) => { const L = DB.acc.accts.filter(x => x.kind === k), s = k === 'pay' ? null : L.reduce((t, x) => t + acctBal(x), 0); return `<div class="asGrp" data-k="${k}"><div class="asGH"><b>${i} ${n}</b>${s == null ? '<span class="muted small">不計餘額</span>' : `<span class="${s < 0 ? 'neg' : ''}">${money(s)}</span>`}<button class="btn sm" data-a="add" data-kind="${k}">＋ 新增</button></div>
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
function renderAccCfg() {
  const box = $('#accCBody'); if (!box || !DB.acc) return; const pc = S.pc || {}, gi = (() => { try { return JSON.parse(NB.gInfo ? NB.gInfo() : '{}'); } catch (e) { return {}; } })();
  box.innerHTML = `<div class="setG"><h3>功能區</h3><div class="setC"><button class="recCard" data-a="leave"><span class="rcI">🍽️</span><span class="rcT"><b>回到日日帳本</b><small>地圖、日常、分帳、發票</small></span><span class="rcGo">切換 ›</span></button></div></div>
    <div class="setG"><h3>分帳的人</h3><div class="setC"><div class="setR col"><div class="t"><b>我是誰</b><small>分帳、對帳時「我」是哪一個人（和日常點餐共用名單）</small></div><div class="whoRow">${DB.mcfg.people.map(u => `<button data-me="${u.id}" class="${accMe() === u.id ? 'on' : ''}">${esc(u.icon)} ${esc(u.name)}</button>`).join('')}</div></div></div></div>
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
      <div class="setR col"><div class="t"><b>☁️ Google 雲端硬碟</b><small>${gi.email || (S.gd && S.gd.email) ? '帳戶：' + esc(gi.email || S.gd.email) : '還沒登入'}・資料夾：${esc((S.gd || {}).folder || '日日帳本備份')}${S.gd && S.gd.last ? '・上次備份 ' + new Date(S.gd.last).toLocaleString('zh-TW') : ''}</small></div>
        <div class="acRow2"><button class="btn pri" data-a="gUp">⬆️ 上傳備份</button><button class="btn" data-a="gDown">⬇️ 從雲端還原</button></div><div class="acRow2"><button class="btn sm" data-a="gFolder">📁 選擇資料夾</button>${gi.email ? '<button class="btn sm" data-a="gOut">換帳戶／登出</button>' : '<span></span>'}</div></div>
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
  if (a === 'leave') leaveAcc(); else if (a === 'cats') editCatTree(t.dataset.ty); else if (a === 'opt') optCfg(); else if (a === 'payees') managePayees(); else if (a === 'accts') enterAcc('AccA'); else if (a === 'tpls') manageTpls(); else if (a === 'csv') accCsv();
  else if (a === 'gFolder') gPickFolder(); else if (a === 'pFolder') pPickFolder(); else if (a === 'pIn') pLogin(); else if (a === 'lUp') localBackup(); else if (a === 'lDown') localRestore(); else if (a === 'xSend') xferSend(); else if (a === 'xRecv') xferRecv();
  else if (a === 'gUp') cloudUp('g'); else if (a === 'gDown') cloudDown('g'); else if (a === 'pUp') cloudUp('p'); else if (a === 'pDown') cloudDown('p');
  else if (a === 'gOut') { if (NB.gSignOut) NB.gSignOut(); S.gd = {}; saveS(); renderAccCfg(); } else if (a === 'pOut') { S.pc = {}; saveS(); renderAccCfg(); }
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
  let draw; const sh = sheet({title: '🏪 商家／對象名稱', full: true, foot: '<button class="btn pri" data-a="add">＋ 新增名稱</button>'});
  draw = () => { const groups = {}; DB.acc.payees.forEach(p => { const f = catFind('out', p.cat).p ? catFind('out', p.cat) : catFind('in', p.cat), k = f.s ? f.p.i + ' ' + f.p.n + '・' + f.s.n : f.p ? f.p.i + ' ' + f.p.n : '未分類'; (groups[k] = groups[k] || []).push(p); });
    sh.body.innerHTML = Object.keys(groups).map(k => `<div class="lbl">${esc(k)}</div><div class="acPyG pyS">${groups[k].map(p => `<button class="acPy" data-py="${p.id}">${esc(p.n)}</button>`).join('')}</div>`).join('') + (DB.acc.payees.length ? '<div class="small muted" style="margin-top:.6rem">按住名稱拖曳可以排序</div>' : '') || '<div class="empty">還沒有名稱。可以建立「台灣自來水公司、台灣電力公司、房東」等，並歸到分類，記帳時選它就會自動帶入分類。</div>'; };
  const draw0 = draw; draw = () => { draw0(); const w = document.createElement('div'); w.append(...sh.body.childNodes); sh.body.append(w); sortable(w, {item: '.acPy', scope: '.pyS', axis: 'grid', onSort(f, t, scope) { const ids = $$('.acPy', scope).map(e => e.dataset.py), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv); const pos = DB.acc.payees.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => DB.acc.payees.find(x => x.id === id)); pos.forEach((p, i) => { DB.acc.payees[p] = objs[i]; }); saveAcc(); draw(); }}); };
  draw(); sh.body.onclick = async e => { const t = e.target.closest('[data-py]'); if (!t) return; buzz(8); const p = DB.acc.payees.find(x => x.id === t.dataset.py); await editPayee(catFind('in', p.cat).p && !catFind('out', p.cat).p ? 'in' : 'out', p); draw(); };
  sh.foot.onclick = async () => { await editPayee('out', {n: ''}); draw(); };
}
function manageTpls() { tplList(); }
/* 常用紀錄完整清單：支出／收入／轉帳，依分類排列；長按拖曳排序 */
function tplList() {
  let ty = 'out'; const sh = sheet({title: '⭐ 常用紀錄', full: true, foot: '<button class="btn pri" data-a="new">＋ 新增常用紀錄</button>'});
  const groups = () => { const L = DB.acc.tpls.filter(t => (t.type || 'out') === ty), G = [];
    if (ty === 'tr') { if (L.length) G.push({k: 'tr', n: '🔄 轉帳', L}); return G; }
    DB.acc.cats[ty].forEach(p => [{id: p.id, n: p.n, i: p.i}].concat(p.subs || []).forEach(sc => { const M = L.filter(t => t.cat === sc.id); if (M.length) G.push({k: sc.id, n: (sc.i || p.i) + ' ' + (sc.id === p.id ? p.n : p.n + '・' + sc.n), L: M}); }));
    const rest = L.filter(t => !G.some(g => g.L.includes(t))); if (rest.length) G.push({k: '_', n: '📦 其他', L: rest}); return G; };
  const draw = () => { const G = groups(), n = k => DB.acc.tpls.filter(t => (t.type || 'out') === k).length;
    sh.body.innerHTML = `<div class="acType three"><button data-ty="out" class="${ty === 'out' ? 'on' : ''}">支出 ${n('out') || ''}</button><button data-ty="in" class="${ty === 'in' ? 'on' : ''}">收入 ${n('in') || ''}</button><button data-ty="tr" class="${ty === 'tr' ? 'on' : ''}">轉帳 ${n('tr') || ''}</button></div>
      <div class="small muted" style="margin:-.2rem 0 .7rem">點一下就用今天的日期記帳；按住拖曳可以排序；按 ✎ 編輯。</div>
      <div id="tpL">${G.map(g => `<div class="tpG"><div class="lbl">${esc(g.n)}</div>${g.L.map(t => `<div class="tpR card" data-t="${t.id}"><span class="grip"></span><button class="tpUse" data-use="${t.id}"><b>${esc(t.name)}</b><small>${esc([t.payee, t.type === 'tr' ? acctName(t.acct) + ' → ' + acctName(t.to) : acctName(t.acct), (t.split || []).length ? '分帳 ' + t.split.length + ' 人' : ''].filter(Boolean).join('・'))}</small></button><b class="tpV ${t.type === 'in' ? 'pos' : t.type === 'out' ? 'neg' : ''}">${+t.amt ? money(t.amt) : '<small class="muted">每次輸入</small>'}</b><button class="ic" data-ed="${t.id}" aria-label="編輯">✎</button></div>`).join('')}</div>`).join('') || '<div class="empty">這一類還沒有常用紀錄<br><span class="small">按下面「＋ 新增常用紀錄」，或在記一筆時按「⭐ 存成常用」</span></div>'}</div>`;
    sortable($('#tpL', sh.body), {item: '.tpR', scope: '.tpG', scroller: sh.body, onSort(f, t, scope) { const ids = $$('.tpR', scope).map(e => e.dataset.t), mv = ids.splice(f, 1)[0]; ids.splice(t, 0, mv);
      const pos = DB.acc.tpls.map((x, i) => ids.includes(x.id) ? i : -1).filter(i => i >= 0), objs = ids.map(id => DB.acc.tpls.find(x => x.id === id)); pos.forEach((p, i) => { DB.acc.tpls[p] = objs[i]; }); saveAcc(); draw(); renderAcc(); }}); };
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
    if (b.dataset.a === 'rec') { const T = {out: '支出', in: '收入', tr: '轉帳'};
      const rows = [['日期', '時間', '種類', '母分類', '子分類', '金額', '我的部分', '帳戶', '轉入帳戶', '手續費', '商家／對象', '誰付', '分帳', '欠款狀態', '備註／明細', '品項', '圖片數']].concat(L.map(r => { const f = catFind(r.type, r.cat), me = accMe();
        return [r.d, r.t || '', T[r.type], f.p ? f.p.n : '', f.s ? f.s.n : '', r.amt, r.type === 'out' ? accMine(r) : r.type === 'in' ? r.amt : '', acctName(r.acct).replace(/^\S+\s/, ''), r.type === 'tr' ? acctName(r.to).replace(/^\S+\s/, '') : '', +r.fee || '', r.payee || '', r.type === 'out' ? mWho(r.payer || me).name : '',
          (r.split || []).map(s => mWho(s.p).name + ' ' + s.amt).join('；'), (r.split || []).filter(s => s.p !== me && accOwe(r, s.p)).map(s => mWho(s.p).name + ((r.settled || {})[s.p] ? ' 已結清' : ' 未結清')).join('；'), r.note || '', (r.items || []).map(x => x.n + ' ' + x.amt + ((x.ppl || []).length ? '（' + x.ppl.map(p => mWho(p).name).join('、') + '）' : '')).join('；'), (r.imgs || []).length]; }));
      await saveCsv(`記帳明細_${from}_${to}.csv`, rows); }
    else { const pd = ymd(new Date(ymdDate(from).getTime() - 864e5)); const rows = [['帳戶', '種類', `期初餘額（${pd}）`, `期末餘額（${to}）`, '這段期間收入', '這段期間支出', '信用卡還款日', '扣款帳戶']];
      DB.acc.accts.forEach(a => { const fl = L.map(r => acctFlow(r, a.id)); rows.push([a.n, AK[a.kind][0], acctBal(a, pd), acctBal(a, to), r2(fl.filter(v => v > 0).reduce((s, v) => s + v, 0)), r2(-fl.filter(v => v < 0).reduce((s, v) => s + v, 0)), a.kind === 'card' ? a.payDay || '' : '', a.kind === 'card' ? acctName(a.payFrom).replace(/^\S+\s/, '') : '']); });
      rows.push([], ['日期', '帳戶', '金額變動', '種類', '說明']); L.forEach(r => DB.acc.accts.forEach(a => { const v = acctFlow(r, a.id); if (v) rows.push([r.d, a.n, v, {out: '支出', in: '收入', tr: '轉帳'}[r.type], r.payee || String(r.note || '').split('\n')[0] || accCat(r).n]); }));
      await saveCsv(`資產明細_${from}_${to}.csv`, rows); } };
}
