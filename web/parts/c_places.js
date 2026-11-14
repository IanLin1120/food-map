/* ============================================================
   AI（Gemini）圖片辨識、收藏地點明細／編輯、分類管理、收藏頁
   ============================================================ */
const AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const aiHead = () => ({'Content-Type': 'application/json', 'x-goog-api-key': S.aikey});
/* ============================================================
   Gemini 免費額度（2026 年實測，Google 沒有公開保證）：
   Flash 每天約 20 次、每分鐘 5 次；Flash-Lite 每天約 500 次、每分鐘 15 次。
   以「專案」計算，太平洋時間午夜重置。Google 沒有提供查詢剩餘額度的 API，
   所以由 App 自己記錄這支手機的使用次數，碰到額度上限時再從錯誤訊息讀出真正的上限。
   免費版不能使用「Google 搜尋」功能。
   ============================================================ */
const AIQ = {
  st: lsGet('fm.aiq', {day: '', used: {}, lim: {}, block: {}}),
  day() { try { return new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()); } catch (e) { return new Date(Date.now() - 8 * 36e5).toISOString().slice(0, 10); } },
  norm() { const d = this.day(); if (this.st.day !== d) { this.st.day = d; this.st.used = {}; this.st.block = {}; this.save(); } return this.st; },
  save() { lsSet('fm.aiq', this.st); },
  fam: m => /lite/.test(m || '') ? 'lite' : 'flash',
  inc(m) { const s = this.norm(); s.used[m] = (s.used[m] || 0) + 1; this.save(); },
  used(m) { return this.norm().used[m] || 0; },
  lim(m) { return this.st.lim[m] || (this.fam(m) === 'lite' ? 500 : 20); },
  limKnown(m) { return !!this.st.lim[m]; },
  left(m) { return Math.max(0, this.lim(m) - this.used(m)); },
  blocked(m) { return !!this.norm().block[m]; },
  block(m, lim) { const s = this.norm(); s.block[m] = 1; if (lim) { s.lim[m] = lim; s.used[m] = Math.max(s.used[m] || 0, lim); } this.save(); },
  /* 額度在太平洋時間午夜重置，換算成這支手機的當地時間 */
  resetAt() { try { const p = {}; new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(new Date()).forEach(x => p[x.type] = +x.value);
    const sec = ((p.hour % 24) * 3600 + p.minute * 60 + p.second), t = new Date(Date.now() + (86400 - sec) * 1000); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); } catch (e) { return '16:00'; } }
};
/* 每次 AI 執行都記下來，設定頁可以看到失敗原因 */
const AILOG = {
  add(o) { const L = lsGet('fm.ailog', []); L.unshift(Object.assign({t: Date.now()}, o)); lsSet('fm.ailog', L.slice(0, 25)); },
  list() { return lsGet('fm.ailog', []); }
};
function aiErr(j, http) {
  const er = (j && j.error) || {}, m = String(er.message || er.status || ('HTTP ' + (http || '?'))), det = er.details || [];
  const e = new Error(m); e.code = er.code || http || 0; e.status = er.status || ''; e.raw = m;
  const qf = det.find(d => /QuotaFailure/.test(d['@type'] || '')), ri = det.find(d => /RetryInfo/.test(d['@type'] || ''));
  if (qf) { const v = (qf.violations || []); e.perDay = v.some(x => /PerDay/i.test(x.quotaId || '')); e.perMin = v.some(x => /PerMinute/i.test(x.quotaId || '')) && !e.perDay; const lv = v.map(x => +x.quotaValue).filter(x => x > 0); if (lv.length) e.limit = Math.min(...lv); }
  else if (e.code === 429) { e.perDay = /per day|daily|PerDay/i.test(m); e.perMin = !e.perDay; const mm = m.match(/limit:\s*(\d+)/); if (mm) e.limit = +mm[1]; }
  if (ri && ri.retryDelay) e.retryMs = Math.round(parseFloat(ri.retryDelay) * 1000);
  if (e.code === 429 && /limit:\s*0\b/.test(m)) e.zero = true;
  e.fatal = /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|API_KEY_SERVICE_BLOCKED/i.test(m + e.status) || e.code === 401 || e.code === 403;
  e.gone = e.code === 404 || /no longer available|not found for API version|is not supported for generateContent/i.test(m);
  e.badThink = e.code === 400 && /thinking|budget|thinkingLevel/i.test(m);
  e.badMedia = e.code === 400 && /media_?resolution|mediaResolution/i.test(m);
  e.grounding = /google_search|grounding|search tool|Search Grounding/i.test(m);
  e.busy = [500, 502, 503, 504].includes(e.code) || /overloaded|UNAVAILABLE|INTERNAL|DEADLINE/i.test(m + e.status);
  return e;
}
function aiErrText(e) {
  if (!e) return '未知錯誤'; if (e.message === 'NOKEY') return '尚未設定 Gemini 金鑰';
  if (e.fatal) return 'Gemini 金鑰不正確或沒有權限，請到「設定」重新貼上金鑰';
  if (e.code === 429 && e.perDay) return `今天的免費額度用完了（${e.model ? aiShort(e.model) + ' ' : ''}每天 ${e.limit || '約 20'} 次），每天 ${AIQ.resetAt()} 重置`;
  if (e.code === 429) return '請求太頻繁，請稍等一分鐘再試';
  if (e.busy) return 'Google AI 伺服器忙碌中，請稍後再試';
  if (e.idle) return 'AI 太久沒有回應（網路不穩或圖片太大），請再試一次';
  return e.raw || e.message || String(e);
}
const aiShort = m => /lite/.test(m) ? 'Flash-Lite' : /flash/.test(m) ? 'Flash' : m;
async function aiListModels() { const j = await jfetch(AI_BASE + '?pageSize=200', {headers: aiHead()}, 20000); if (j.error) throw aiErr(j);
  return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')); }
/* 從可用的模型裡挑出最新的 Flash-Lite 與 Flash（優先用 Google 提供的 -latest 別名） */
function aiPickFam(list, fam) {
  const lite = fam === 'lite', ok = list.filter(n => /^gemini/.test(n) && /flash/.test(n) && (lite ? /lite/.test(n) : !/lite/.test(n)) && !/(image|tts|live|audio|embed|native|8b|computer|robot|learn|thinking|exp)/.test(n));
  const alias = lite ? 'gemini-flash-lite-latest' : 'gemini-flash-latest'; if (ok.includes(alias)) return alias;
  const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0), pre = n => /preview/.test(n) ? 1 : 0;
  ok.sort((a, b) => pre(a) - pre(b) || ver(b) - ver(a) || a.length - b.length); return ok[0] || '';
}
const aiPick = list => aiPickFam(list, 'flash') || aiPickFam(list, 'lite');
async function aiModels(force) {
  const c = S.aiM; if (!force && c && c.t && Date.now() - c.t < 864e5 && (c.lite || c.flash)) return c;
  try { const l = await aiListModels(); S.aiM = {t: Date.now(), lite: aiPickFam(l, 'lite'), flash: aiPickFam(l, 'flash'), all: l.filter(n => /^gemini/.test(n))}; saveS(); return S.aiM; }
  catch (e) { if (e.fatal) throw e; return c || {lite: 'gemini-flash-lite-latest', flash: 'gemini-flash-latest'}; }
}
/* 依照設定決定嘗試順序：自動＝先用 Flash-Lite（快、額度多），不行再換 Flash */
async function aiOrder(prefer) {
  const m = await aiModels(), sel = S.aimodel || 'auto';
  let L = sel === 'flash' ? [m.flash, m.lite] : sel === 'lite' || sel === 'auto' ? [m.lite, m.flash] : [sel, m.lite, m.flash];
  if (prefer === 'flash' && sel === 'auto') L = [m.flash, m.lite];
  return [...new Set(L.filter(Boolean))];
}
/* 關閉或降低「思考」可以大幅加快速度；不同世代的模型參數不同，被拒絕就換下一種寫法並記住 */
const THINK = [{thinkingLevel: 'minimal'}, {thinkingBudget: 0}, {thinkingLevel: 'low'}, null];
function thinkIdx(m) { const k = (S.aiThink || {})[m]; return k != null ? k : (/gemini-2\./.test(m) ? 1 : 0); }
function aiBody(base, m) {
  const b = JSON.parse(JSON.stringify(base)); b.generationConfig = b.generationConfig || {}; const t = THINK[thinkIdx(m)];
  if (t) b.generationConfig.thinkingConfig = t; if (b._hiRes && !(S.aiNoMedia || {})[m]) b.generationConfig.mediaResolution = 'MEDIA_RESOLUTION_HIGH'; delete b._hiRes; return JSON.stringify(b);
}
/* 一次請求（串流）：邊收邊回報文字，太久沒有資料就中止 */
async function aiOnce(m, base, onText, opt) {
  const ctl = new AbortController(); let idleT, text = '', finish = '', first = true;
  const arm = ms => { clearTimeout(idleT); idleT = setTimeout(() => { ctl.abort(); }, ms); };
  const body = aiBody(base, m);
  arm(opt.firstMs || 90000);
  try {
    let r;
    try { r = await fetch(`${AI_BASE}/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`, {method: 'POST', headers: aiHead(), body, signal: ctl.signal}); }
    catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('idle'), {idle: true});
      /* App 內被瀏覽器擋下時改走原生連線（不串流） */
      if (IS_APP && NB.http) { clearTimeout(idleT); const j = await jfetch(`${AI_BASE}/${encodeURIComponent(m)}:generateContent`, {method: 'POST', headers: aiHead(), body}, opt.firstMs ? opt.firstMs + 60000 : 150000);
        if (j.error) throw aiErr(j); const c = (j.candidates || [])[0] || {}; text = ((c.content && c.content.parts) || []).map(p => p.thought ? '' : p.text || '').join(''); if (onText) onText(text); return {text, finish: c.finishReason || '', fb: j.promptFeedback}; }
      throw Object.assign(new Error('網路連線失敗，請確認網路'), {net: true}); }
    if (!r.ok) { const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {} if (Array.isArray(j)) j = j[0]; throw aiErr(j, r.status); }
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', fb = null;
    for (;;) { const {value, done} = await rd.read(); if (done) break; buf += dec.decode(value, {stream: true});
      let i; while ((i = buf.indexOf('\n\n')) >= 0 || (i = buf.indexOf('\r\n\r\n')) >= 0) { const ev = buf.slice(0, i); buf = buf.slice(i + (buf[i] === '\r' ? 4 : 2));
        const data = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join(''); if (!data) continue; let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.error) throw aiErr(j); if (j.promptFeedback && j.promptFeedback.blockReason) fb = j.promptFeedback;
        const c = (j.candidates || [])[0]; if (c) { const add = ((c.content && c.content.parts) || []).map(p => p.thought ? '' : p.text || '').join(''); if (add) { text += add; if (onText) onText(text); } if (c.finishReason) finish = c.finishReason; } }
      if (first) first = false; arm(opt.idleMs || 45000); }
    return {text, finish, fb};
  } catch (e) { if (e.name === 'AbortError') { const x = new Error('idle'); x.idle = true; x.partial = text; throw x; } if (text && !e.partial) e.partial = text; throw e; }
  finally { clearTimeout(idleT); }
}
/* 依序嘗試各模型；額度用完自動換另一個模型（兩者額度分開計算） */
async function aiRun(base, opt) {
  if (!S.aikey) throw new Error('NOKEY'); opt = opt || {};
  const order = await aiOrder(opt.prefer), t0 = Date.now(); let last = null;
  const avail = order.filter(m => !AIQ.blocked(m)); if (!avail.length) { const e = new Error('quota'); e.code = 429; e.perDay = true; e.model = order[0]; e.limit = AIQ.lim(order[0]); throw e; }
  for (const m of avail) {
    for (let tries = 0; tries < 4; tries++) {
      if (opt.onModel) opt.onModel(m, tries);
      try { const r = await aiOnce(m, base, opt.onText, opt); AIQ.inc(m); r.model = m; r.ms = Date.now() - t0;
        if (r.fb && r.fb.blockReason) { const e = new Error('AI 拒絕處理這張圖片（' + r.fb.blockReason + '）'); e.model = m; throw e; }
        return r; }
      catch (e) { e.model = e.model || m; last = e;
        if (e.badThink) { S.aiThink = S.aiThink || {}; S.aiThink[m] = Math.min(THINK.length - 1, thinkIdx(m) + 1); saveS(); continue; }
        if (e.badMedia) { S.aiNoMedia = S.aiNoMedia || {}; S.aiNoMedia[m] = 1; saveS(); continue; }
        if (e.fatal || e.message === 'NOKEY') throw e;
        if (e.code === 429 && e.perDay) { AIQ.block(m, e.limit); break; }                 /* 這個模型今天用完 → 換下一個 */
        if (e.code === 429) { if (tries >= 1) break; const w = Math.min(60000, e.retryMs || 20000); if (opt.onWait) opt.onWait(Math.ceil(w / 1000)); await sleep(w); continue; }
        if (e.gone) { S.aiM = null; saveS(); break; }
        if (e.idle && e.partial && opt.keepPartial) { AIQ.inc(m); return {text: e.partial, finish: 'IDLE', model: m, ms: Date.now() - t0}; }
        if ((e.busy || e.idle || e.net) && tries < 1) { await sleep(2500); continue; }
        if (e.busy) break;                                                                 /* 一直忙線就換另一個模型 */
        throw e; }
    }
  }
  throw last || new Error('AI 沒有回應');
}
function parseLoose(t) { t = String(t || '').trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim(); try { return JSON.parse(t); } catch (e) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} } throw new Error('AI 回傳的內容無法解析，請再試一次'); }
/* 一般 JSON 用途（例如食譜匯入） */
async function gemini(parts, schema, opt) { const r = await aiRun({contents: [{role: 'user', parts}], generationConfig: {responseMimeType: 'application/json', responseSchema: schema, temperature: 0, maxOutputTokens: 16384}, _hiRes: true}, opt); return parseLoose(r.text); }

/* 菜單辨識：用精簡的「類型|分類|品名|價格」一行一項輸出，比 JSON 少很多字，速度快很多。
   菜單有兩種形式：一般菜單（每項有價格）、組合式菜單（依步驟自選：主食選一、配料選五…）。
   每一列分成三種類型：品項（有價格的餐點）、選項（組合式菜單裡可挑選的東西）、加購（加購區、加價）。 */
const MENU_PROMPT = `你是台灣餐飲店的菜單辨識助手。請把這張菜單照片上「所有」可以點的東西逐項列出。
先判斷菜單形式（可能混合）：
A. 一般菜單：每個品項有自己的價格。
B. 組合式（自選）菜單：顧客依步驟挑選，例如「1 主食（選一）→ 2 蛋白質（選一，有價格）→ 3 配料區（選五）→ 4 醬料（選一）」。
輸出格式：每行一項，用半形直線 | 分成四欄：類型|分類|品名|價格
類型只能是下列三種之一：
・品項＝有自己價格、可以單獨點的餐點。組合式菜單裡「決定價格的那一步」也算品項（例如蛋白質主菜 $140），分類寫餐點名稱，例如：品項|溫沙拉|日式薑汁豬|140。
・選項＝組合式菜單裡讓顧客挑選、本身不另外標價（已含在主餐價格）的東西，例如主食的白米飯、配料、醬料。分類寫「所屬餐點・步驟名稱（可選幾種）」，例如：選項|溫沙拉・主食（選一）|白米飯|、選項|溫沙拉・配料（選五）|海藻|、選項|溫沙拉・沙拉醬（選一）|和風醬|。價格留空。
・加購＝加購區、加價項目、單點配料、飯換菜等額外付費的東西，例如：加購|加購區|樹頂蘋果汁|40、加購|加價|加蛋|10、加購|加購區|飯換菜|10。
其他規則：
1. 分類＝菜單上的區塊標題（例如 漢堡、吐司、蛋餅、麵類、飯類、湯品、小菜、飲料、套餐）；沒有標題就寫「其他」。同一個區塊的品項分類要寫得一模一樣。
2. 價格只寫阿拉伯數字（不要 $ 或「元」）；看不清楚就留空，但品項仍要列出。
3. 同一個品項有好幾個價格欄（例如 M/L/瓶、中/大、小碗/大碗、薄片/厚片、一般量/加大），每個價格各寫一行，品名後面用括號註明欄名，例如：品項|飲料|紅茶 (L)|25 與 品項|飲料|紅茶 (XL)|30。價格欄是「-」「—」「/」、斜線或空白，代表沒有這個尺寸，那一格不要寫。
4. 表格是「口味 × 種類」的對照表時（例如每一列是 起司、火腿，每一欄是 吐司、漢堡），每一格各寫一行：分類寫欄名，品名寫「列名＋欄名」，例如：品項|吐司|起司吐司|30。
5. 套餐把內容寫在品名，例如：品項|套餐|1 原味蛋餅＋蘿蔔糕(2片)|55。
6. 菜單分成左右好幾欄時，先把同一欄（同一個區塊）由上到下全部列完，再換下一個區塊，不要左右交錯。
7. 不要列出：店名、電話、地址、營業時間、公休日、外帶/內用、桌號、數量欄、勾選框、合計欄、QR code。
8. 不可遺漏，也不可以自己編造。文字照抄菜單原文（繁體中文）。
9. 只輸出品項行，不要標題列、不要編號、不要說明文字、不要 markdown。`;
const SZ = /\s*[（(]([^()（）]{1,8})[)）]\s*$/;
const baseName = n => n.replace(SZ, '').trim();
const REGIONS = ['北部', '中部', '南部', '東部', '離島'];
const MT = {品項: 'item', 選項: 'opt', 加購: 'add', item: 'item', opt: 'opt', add: 'add'};
const normCat = c => String(c || '').replace(/\s+/g, '').replace(/[:：]+$/, '').replace(/\(/g, '（').replace(/\)/g, '）') || '其他';
function parseMenu(t) {
  const out = []; String(t || '').split(/\r?\n/).forEach(l => { l = l.replace(/^[\s>*\-•`]+/, '').trim(); if (!l || /^```/.test(l)) return;
    let f = l.split(/\s*[|｜]\s*/); if (f.length < 2) return; let ty = 'item';
    if (MT[f[0]]) { ty = MT[f[0]]; f = f.slice(1); } else if (/^(類型|type)$/i.test(f[0])) return;
    let c, n, pr; if (f.length >= 3) { c = f[0]; n = f.slice(1, f.length - 1).join(' '); pr = f[f.length - 1]; } else if (f.length === 2) { if (ty === 'opt') { c = f[0]; n = f[1]; pr = ''; } else { c = '其他'; n = f[0]; pr = f[1]; } } else return;
    if (/^(分類|類別|category)$/i.test(c) && /^(品名|名稱|name)$/i.test(n)) return; n = (n || '').trim(); if (!n) return;
    c = normCat(c); if (ty === 'item' && /^(加購|加價|加點|單點加購)/.test(c)) ty = 'add';
    const pp = ty === 'opt' && !/\d/.test(pr || '') ? '' : normPrice(pr); if (/^[-—–/／xX✕]+$/.test(pp)) return;
    out.push({t: ty, c, n, p: pp}); });
  /* 「瓶」「M」這類沒有價格的尺寸：同一品項有其他尺寸有價格時就不要列出來 */
  const priced = new Set(out.filter(r => r.p && SZ.test(r.n)).map(r => r.c + '|' + baseName(r.n)));
  return groupMenu(out.filter(r => r.p || !SZ.test(r.n) || !priced.has(r.c + '|' + baseName(r.n))));
}
/* 把同一個分類的品項排在一起（照第一次出現的順序），品項 → 選項 → 加購 */
function groupMenu(rows) {
  const out = [], gs = []; (rows || []).forEach(r => { const g = r.g || ''; if (!gs.includes(g)) gs.push(g); });
  gs.forEach(g => ['item', 'opt', 'add'].forEach(t => { const cats = [], by = {};
    (rows || []).forEach(r => { if ((r.g || '') !== g || (r.t || 'item') !== t) return; const c = normCat(r.c); if (!by[c]) { by[c] = []; cats.push(c); } by[c].push(Object.assign({}, r, {c, t})); });
    cats.forEach(c => out.push(...by[c])); }));
  return out;
}
const RECIPE_PROMPT = '這是食譜的圖片（可能有多張，是同一道食譜）。請整理成 JSON：title（食譜名稱）、servings（份數，例如「一人份」，沒有就空字串）、ingredients（食材陣列，每筆有 name 食材、amount 數量）、steps（製作步驟陣列，每個步驟一個字串，不要包含編號）、note（其他備註，沒有就空字串）。文字一律照圖片上的原文，不可遺漏或自行編造。';
const RECIPE_SCHEMA = {type: 'OBJECT', properties: {title: {type: 'STRING'}, servings: {type: 'STRING'}, ingredients: {type: 'ARRAY', items: {type: 'OBJECT', properties: {name: {type: 'STRING'}, amount: {type: 'STRING'}}, required: ['name', 'amount']}}, steps: {type: 'ARRAY', items: {type: 'STRING'}}, note: {type: 'STRING'}}, required: ['title', 'ingredients', 'steps']};
const imgPart = async blob => ({inline_data: {mime_type: blob.type || 'image/jpeg', data: await blobB64(blob)}});
function needAiKey() { ask('AI 圖片辨識需要先設定免費的 Gemini 金鑰。\n要看圖文教學嗎？（大約 1 分鐘）', '看教學').then(y => { if (y) openTutorial('ai'); }); }
const normPrice = s => { s = String(s == null ? '' : s).trim(); const m = s.replace(/[,，\s]/g, '').match(/^\$?(?:NT\$?)?(\d+(?:\.\d+)?)元?$/i); return m ? m[1] : s; };
/* 今天大約還能辨識幾次（顯示用） */
function aiLeftText() { const m = S.aiM; if (!m || !S.aikey) return ''; const L = [m.lite, m.flash].filter(Boolean); if (!L.length) return '';
  return '今天大約還能辨識：' + L.map(x => `${aiShort(x)} ${AIQ.blocked(x) ? 0 : AIQ.left(x)} 次`).join('、'); }

/* ---------- AI 工作在背景執行：不擋畫面，完成後自動帶入表格 ---------- */
const AIJ = {jobs: {},
  set(id, j) { if (j) this.jobs[id] = j; else delete this.jobs[id]; this.pill(); document.dispatchEvent(new CustomEvent('fm:job', {detail: id})); },
  msg(id, m) { if (this.jobs[id]) { this.jobs[id].msg = m; this.pill(); document.dispatchEvent(new CustomEvent('fm:job', {detail: id})); } },
  pill() { let e = $('#aiPill'); const ids = Object.keys(this.jobs); if (!ids.length) { if (e) e.remove(); return; }
    if (!e) { e = el('<button id="aiPill" class="glass"></button>'); document.body.append(e); e.onclick = () => { const id = Object.keys(AIJ.jobs)[0]; if (id && !sheets.length) openPlace(id, true); }; }
    const p = DB.places.find(x => x.id === ids[0]); e.innerHTML = `<span class="spin"></span><span>${esc((p ? p.name : '') + '：' + (this.jobs[ids[0]].msg || 'AI 處理中…'))}${ids.length > 1 ? '（另有 ' + (ids.length - 1) + ' 個）' : ''}</span>`; }
};
const menuDone = (p, msg) => { buzz(40); toast(msg, 4500); document.dispatchEvent(new CustomEvent('fm:job', {detail: p.id})); refreshAll(); };

/* 有分區域（北部／中部／南部…）的菜單：先選要辨識哪些版本，每個區域各自一份表格 */
function pickAlbums(p, prefer) {
  const L = albumsOf(p), best = new Set(); const seenR = new Set(); L.forEach(a => { const r = a.rg || ''; if (!seenR.has(r)) { seenR.add(r); best.add(a.id); } });
  const sh = sheet({title: '要辨識哪些菜單版本？', full: true, foot: '<button class="btn pri" data-a="go">開始辨識</button>'}); const sel = new Set(best);
  const render = () => { sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">每個區域會各自產生一份表格，表格上方可以切換區域。已預先勾選每個區域最新的版本。</div>` + L.map(a => `<button class="res alb ${sel.has(a.id) ? 'on' : ''}" data-id="${a.id}"><span class="rIc">${sel.has(a.id) ? '✅' : '⬜'}</span><span class="grow"><b>${esc(a.name)}</b><small>${a.rg ? '📍 ' + esc(a.rg) + '・' : '不分區・'}${a.imgs.length} 張・${dateName(a.t)}</small></span></button>`).join('');
    const b = $('[data-a="go"]', sh.foot); b.disabled = !sel.size; b.textContent = sel.size ? `開始辨識（${sel.size} 個版本）` : '請至少選一個版本'; };
  render(); sh.body.addEventListener('click', e => { const b = e.target.closest('.alb'); if (!b) return; const id = b.dataset.id; if (sel.has(id)) sel.delete(id); else sel.add(id); render(); });
  sh.foot.onclick = () => { if (!sel.size) return; sh.close(); aiMenu(p, prefer, L.filter(a => sel.has(a.id))); };
}
async function aiMenu(p, prefer, albums) {
  if (!S.aikey) { needAiKey(); return; } if (AIJ.jobs[p.id]) { toast('這間店的 AI 工作還在進行中'); return; }
  const L = albumsOf(p).filter(a => a.imgs.length); if (!L.length) { toast('請先在「管理圖檔」加入菜單圖片'); return; }
  if (!albums) { if (L.length > 1 && L.some(a => a.rg)) { pickAlbums(p, prefer); return; } albums = [L[0]]; }
  const regs = new Set(albums.map(a => a.rg || '')), regTxt = [...regs].map(r => r || '不分區').join('、'), hasReg = (p.menu || []).some(r => r.g) || [...regs].some(Boolean);
  const old = (p.menu || []).filter(r => regs.has(r.g || ''));
  let replace = true; if (old.length) { replace = await ask(`目前表格${hasReg ? '「' + regTxt + '」' : ''}已有 ${old.length} 個品項。\n按「刪掉舊的、換成新的」＝${hasReg ? '這些區域的' : '整份'}表格換成這次的辨識結果${hasReg ? '（其他區域不受影響）' : ''}。\n按「取消」＝保留舊表格，把新結果加在後面。`, '刪掉舊的、換成新的'); }
  const imgs = albums.flatMap(a => a.imgs.map(id => ({id, g: a.rg || ''}))), res = []; let fail = '', okN = 0, partial = false, models = new Set(); const t0 = Date.now(), cnt = {};
  const show = () => { const n = Object.values(cnt).reduce((a, b) => a + b, 0); AIJ.msg(p.id, `辨識中${imgs.length > 1 ? `（${okN}/${imgs.length} 張）` : ''}… 已讀到 ${n} 項`); };
  AIJ.set(p.id, {kind: 'img', msg: '準備圖片…'}); toast('已在背景開始辨識，完成後會自動帶入表格，可以先做別的事', 3000);
  let i = 0; const worker = async () => { while (i < imgs.length) { const k = i++;
    try { const b = await imgBlob(imgs[k].id); if (!b) continue; cnt[k] = 0; show();
      const r = await aiRun({contents: [{role: 'user', parts: [{text: MENU_PROMPT}, await imgPart(b)]}], generationConfig: {temperature: 0, maxOutputTokens: 16384}, _hiRes: true},
        {prefer, keepPartial: true, onText: t => { cnt[k] = parseMenu(t).length; show(); }, onWait: s => AIJ.msg(p.id, `Google 限制每分鐘次數，${s} 秒後自動繼續…`), onModel: (m, n) => { if (n) AIJ.msg(p.id, `${aiShort(m)} 重試中…`); }});
      const rows = parseMenu(r.text); models.add(r.model); if (r.finish === 'MAX_TOKENS' || r.finish === 'IDLE') partial = true;
      if (!rows.length) throw Object.assign(new Error('這張圖片沒有辨識到品項（可能太模糊或不是菜單）'), {model: r.model});
      rows.forEach(x => { if (imgs[k].g) x.g = imgs[k].g; }); res[k] = rows; okN++; AILOG.add({kind: '菜單辨識', place: p.name, model: r.model, ms: r.ms, ok: true, n: rows.length, note: (imgs[k].g ? imgs[k].g + ' ' : '') + (partial ? '結果可能不完整' : '')}); }
    catch (e) { fail = aiErrText(e); AILOG.add({kind: '菜單辨識', place: p.name, model: e.model || '', ms: Date.now() - t0, ok: false, err: fail + (e.raw && e.raw !== fail ? '（' + e.raw.slice(0, 160) + '）' : '')}); if (e.fatal || e.message === 'NOKEY' || (e.code === 429 && e.perDay)) { i = imgs.length; } }
    show(); } };
  await Promise.all(imgs.length > 1 ? [worker(), worker()] : [worker()]);
  /* 同一份菜單分好幾張截圖時，重疊的部分會重複出現 → 同一區域裡一模一樣的列只留一筆 */
  const seen = new Set(), rows = res.filter(Boolean).flat().filter(r => { const k = [r.g || '', r.t, r.c, r.n.replace(/\s+/g, ''), r.p].join('|'); if (seen.has(k)) return false; seen.add(k); return true; }); AIJ.set(p.id, null);
  if (!DB.places.includes(p)) return;
  if (!rows.length) { menuDone(p, '❌ 菜單辨識失敗：' + (fail || '沒有辨識到任何品項')); return; }
  p.menu = groupMenu(replace ? (p.menu || []).filter(r => !regs.has(r.g || '')).concat(rows) : (p.menu || []).concat(rows));
  if (regs.size === 1 && [...regs][0]) p.rgSel = [...regs][0];
  p.menuSrc = {kind: 'ai', t: Date.now(), ver: albums.map(a => a.name).join('、'), model: [...models].join('、'), partial};
  await savePlace(p);
  menuDone(p, `✅「${p.name}」辨識完成：${rows.length} 個品項${hasReg ? '（' + regTxt + '）' : ''}，用時 ${Math.round((Date.now() - t0) / 1000)} 秒${fail ? '（有圖片失敗：' + fail + '）' : partial ? '（結果可能不完整，請核對）' : ''}`);
}

/* ---------- 上網找菜單 ----------
   1. Google 地圖上的店家相片（用 Google Maps 金鑰）：很多人會拍菜單上傳，挑出來存成新的菜單版本，再用 AI 辨識
   2. AI 網路文字搜尋：Gemini 的 Google 搜尋功能只有「已開通付費」的專案能用，免費金鑰會失敗 */
async function fetchImgBlob(url) {
  try { const r = await fetch(url, {mode: 'cors'}); if (r.ok) { const b = await r.blob(); if (b.size > 500) return b; } } catch (e) {}
  if (IS_APP && NB.fetchB64) return new Promise((res, rej) => { const id = 'b' + uid(), tm = setTimeout(() => { delete NBCB[id]; rej(new Error('下載相片逾時')); }, 45000);
    NBCB[id] = r => { clearTimeout(tm); if (!r.status) { rej(new Error('下載相片失敗')); return; } const bin = atob(r.text), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); res(new Blob([u], {type: r.mime || 'image/jpeg'})); };
    NB.fetchB64(id, url); });
  throw new Error(IS_APP ? '需要 APK v1.6.0 以上才能下載這張圖片' : '網頁版無法下載其他網站的圖片，請在 App 裡使用');
}
window.__nbB64 = (id, ok, mime, b64) => { const f = NBCB[id]; if (f) { delete NBCB[id]; f({status: ok ? 200 : 0, text: b64 || '', mime}); } };
async function gPhotoList(p) {
  if (!p.gid) { await gFill(p); await savePlace(p); }
  const d = await jfetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.gid)}`, {headers: gHead('photos')}, 15000); gThrow(d);
  return (d.photos || []).map(x => ({name: x.name, w: x.widthPx, h: x.heightPx, by: ((x.authorAttributions || [])[0] || {}).displayName || ''}));
}
async function gPhotoUri(name, w) { const j = await jfetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true`, {headers: {'X-Goog-Api-Key': S.gkey}}, 15000); gThrow(j); if (!j.photoUri) throw new Error('Google 沒有提供這張相片'); return j.photoUri; }
function webMenu(p) {
  const canShare = IS_APP && !!NB.sharedTake;
  const u0 = p.menuUrl || (isMenuSite(p.web) ? p.web : '');
  const sh = sheet({title: '上網找菜單 · ' + p.name, html: `<div class="setC">
    <button class="setR" data-a="net" style="width:100%;text-align:left"><span style="font-size:1.5rem">🔎</span><span class="t"><b>在網路上搜尋最新菜單</b><small>App 在背景用瀏覽器搜尋「${esc(brandName(p.name))} 菜單」，點搜尋結果就會抓出網頁裡的菜單圖片或文字，挑選後存成菜單（可標北中南區域）。</small></span><span class="muted">›</span></button>
    <button class="setR" data-a="url" style="width:100%;text-align:left"><span style="font-size:1.5rem">🔗</span><span class="t"><b>讀取線上點餐網頁（最新菜單）</b><small>例如「你訂」、iChef、店家官網的點餐頁。App 會開啟網頁讀出所有品項與價格，再用 AI 整理成表格；網址會記住，之後一鍵更新。${u0 ? '<br>✅ 已有網址：' + esc(u0) : p.web ? '<br>Google 地圖上的網站：' + esc(p.web) : ''}</small></span><span class="muted">›</span></button>
    <button class="setR" data-a="gm" style="width:100%;text-align:left"><span style="font-size:1.5rem">📲</span><span class="t"><b>到 Google 地圖的「菜單」截圖（推薦）</b><small>打開這家店的 Google 地圖，在「菜單」分頁截圖，再用「分享」傳回食光地圖，會自動存進這家店的菜單。${canShare ? '' : '<br>⚠️ 需要 APK v1.4.0 以上才能用「分享」傳回；舊版請截圖後用「管理圖檔」從相簿加入。'}</small></span><span class="muted">›</span></button>
    <button class="setR" data-a="gp" style="width:100%;text-align:left"><span style="font-size:1.5rem">🖼️</span><span class="t"><b>Google 地圖首頁相片</b><small>Google 只開放每家店最多 10 張首頁相片（拿不到「菜單」分頁），不一定有菜單。AI 會先幫忙挑。${S.gkey ? '' : '<br>⚠️ 需要先設定 Google Maps 金鑰。'}</small></span><span class="muted">›</span></button>
    <button class="setR" data-a="web" style="width:100%;text-align:left"><span style="font-size:1.5rem">🌐</span><span class="t"><b>AI 網路文字搜尋</b><small>⚠️ 只有「已開通付費」的 Gemini 專案能用，免費金鑰一定會失敗。</small></span><span class="muted">›</span></button></div>`});
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; sh.close(); const a = b.dataset.a; if (a === 'net') netMenuSearch(p); else if (a === 'url') urlMenuSheet(p); else if (a === 'gm') gmMenuGuide(p); else if (a === 'gp') gPhotoPicker(p); else webTextMenu(p); });
}
/* ---------- 線上點餐網頁（你訂、iChef、官網…）：App 在背景開網頁、等內容載入後讀出文字，再交給 AI 整理 ---------- */
const MENU_SITES = /nidin\.shop|ichef|inline\.app|eats365|quickclick|order|menu|點餐|foodpanda|ubereats|line\.me\/R\/ti|lin\.ee|myship|cyberbiz|shopline|91app|weibyapps|dudoo|okshop|fooding/i;
const isMenuSite = u => !!u && MENU_SITES.test(u);
function readPage(url, full) { return new Promise((res, rej) => {
  if (!(IS_APP && NB.pageText)) { rej(new Error(IS_APP ? '需要 APK v1.5.0 以上才能讀取點餐網頁' : '網頁版沒辦法讀取其他網站，請在 App 裡使用')); return; }
  const id = 'pg' + uid(), tm = setTimeout(() => { delete NBCB[id]; rej(new Error('網頁載入太久，請確認網址或稍後再試')); }, 60000);
  NBCB[id] = r => { clearTimeout(tm); if (!r.status) { rej(new Error(r.text || '網頁打不開')); return; } let o = {}; try { o = JSON.parse(r.text); } catch (e) { o = {x: r.text}; } res({title: o.t || '', text: String(o.x || ''), url: o.u || url, links: o.links || [], imgs: o.imgs || []}); };
  if (full && !NB.pageRead) { clearTimeout(tm); delete NBCB[id]; rej(new Error('需要 APK v1.6.0 以上才能在背景搜尋菜單')); return; }
  if (NB.pageRead) NB.pageRead(id, url, !!full); else NB.pageText(id, url); }); }
/* 店名去掉分店名稱，例如「好喝茶坊 中山店」→「麻古茶坊」 */
function brandName(n) { n = String(n || '').trim().replace(/[（(][^()（）]*(店|門市)[)）]\s*$/, '').trim();
  const sp = n.split(/[\s　]+/); if (sp.length > 1 && /(店|門市|館|分店|旗艦店)$/.test(sp[sp.length - 1])) return sp.slice(0, -1).join(' ');
  n = n.replace(/[-－・·|｜]\s*[^-－・·|｜]{1,10}(店|門市)$/, '').trim();
  /* 「好喝茶坊中山店」這種沒有空格的：從台灣的鄉鎮市區名稱切開 */
  if (/(店|門市)$/.test(n) && TW.init()) { let cut = -1; for (const t of TW.towns) { const k = t.name.replace(/[市區鄉鎮]$/, ''); if (k.length < 2) continue; const i = n.indexOf(k, 2); if (i > 0 && (cut < 0 || i < cut)) cut = i; } if (cut > 1) return n.slice(0, cut); }
  return n; }
/* ---------- 在背景用瀏覽器搜尋網路上的最新菜單 ---------- */
function netMenuSearch(p) {
  const sh = sheet({title: '搜尋最新菜單', full: true}); let q = brandName(p.name) + ' 菜單 ' + new Date().getFullYear(), results = [], page = null, sel = new Set(), rg = '';
  const regsKnown = [...new Set((p.albums || []).map(a => a.rg).filter(Boolean))];
  const head = () => `<div class="keyBox" style="margin-bottom:.7rem"><input id="nq" value="${esc(q)}" placeholder="例如：麻古 菜單" enterkeyhint="search"><button class="btn sm pri" data-a="s">搜尋</button></div>`;
  const viewResults = (msg) => { page = null; sh.title('搜尋最新菜單');
    sh.body.innerHTML = head() + (msg || (results.length ? `<div class="small muted" style="margin-bottom:.5rem">點一個結果，App 會在背景打開它，抓出裡面的菜單圖片或文字。官方網站的「菜單」頁通常最新。</div>` + results.map((r, i) => `<button class="res" data-a="open" data-i="${i}"><span class="rIc">${/官方|官網|official/i.test(r.t) ? '⭐' : '🌐'}</span><span class="grow"><b>${esc(r.t)}</b><small>${esc(r.d)}</small></span></button>`).join('') : '<div class="empty">輸入關鍵字後按「搜尋」</div>'));
    if (!(IS_APP && NB.pageRead)) sh.body.insertAdjacentHTML('beforeend', `<div class="callout warn small">${IS_APP ? '需要安裝 APK v1.6.0 以上才能在背景搜尋。' : '網頁版沒辦法在背景開啟其他網站，請在 Android App 裡使用。'}</div>`); };
  const search = async () => { q = ($('#nq', sh.body) || {}).value || q; viewResults('<div class="empty"><div class="spin"></div>在背景用 Google 搜尋中…</div>');
    try { const pg = await readPage('https://www.google.com/search?hl=zh-TW&num=20&q=' + encodeURIComponent(q), true); if (sh.closed || page) return; const seen = new Set();
      results = pg.links.map(l => { let h = l.h; const m = h.match(/[?&]q=(https?[^&]+)/); if (/google\.[^/]+\/url/.test(h) && m) h = decodeURIComponent(m[1]); return {h, t: l.t}; })
        .filter(l => /^https?:/.test(l.h) && !/(^https?:\/\/([^/]*\.)?(google\.|gstatic\.|googleusercontent\.|youtube\.|accounts\.|support\.google|policies\.google|maps\.app\.goo))/.test(l.h))
        .map(l => { const d = l.h.replace(/^https?:\/\//, '').split('/')[0]; return {h: l.h, d, t: l.t.split(/\s+https?:\/\//)[0].replace(new RegExp('\\s*' + d.replace(/\./g, '\\.') + '.*$'), '').slice(0, 90) || d}; })
        .filter(l => { const k = l.h.split('#')[0]; if (seen.has(k) || l.t.length < 4) return false; seen.add(k); return true; }).slice(0, 15);
      if (!results.length) viewResults('<div class="empty">沒有找到搜尋結果' + (/unusual|recaptcha|驗證/i.test(pg.text) ? '（Google 要求驗證，請稍後再試或改用瀏覽器搜尋）' : '') + `<br><button class="btn sm" data-a="ext" style="margin-top:.6rem">用瀏覽器搜尋 ↗</button></div>`); else viewResults(); }
    catch (e) { if (!sh.closed) viewResults(`<div class="empty">⚠️ ${esc(e.message)}<br><button class="btn sm" data-a="ext" style="margin-top:.6rem">用瀏覽器搜尋 ↗</button></div>`); } };
  const viewPage = () => { const P = page; sh.title(P.d);
    const imgs = P.imgs.slice().sort((a, b) => (/菜單|menu|價目|飲品|drink/i.test(b.a + b.s) - /菜單|menu|價目|飲品|drink/i.test(a.a + a.s)) || (b.w * b.h - a.w * a.h)).slice(0, 30); P.list = imgs;
    sh.body.innerHTML = `<button class="btn sm ghost" data-a="back" style="margin-bottom:.5rem">‹ 搜尋結果</button><div class="small muted" style="margin-bottom:.6rem;word-break:break-all">${esc(P.title || P.d)}<br>${esc(P.url)}</div>
      ${imgs.length ? `<div class="small" style="margin-bottom:.4rem"><b>點選是菜單的圖片（可多選）</b></div><div class="gpGrid">${imgs.map((x, i) => `<button class="gp ${sel.has(i) ? 'on' : ''}" data-a="pick" data-i="${i}"><img src="${esc(x.s)}" alt="" loading="lazy" referrerpolicy="no-referrer"><i>✓</i>${x.w ? `<small>${x.w}×${x.h}</small>` : ''}</button>`).join('')}</div>` : '<div class="empty" style="padding:1rem">這個網頁沒有找到大張圖片</div>'}
      <div class="field" style="margin-top:.8rem"><label>存成哪個區域的菜單（連鎖店北中南價格不同時選）</label><div class="rgPick">${['', ...REGIONS, ...regsKnown.filter(r => !REGIONS.includes(r))].map(r => `<button data-a="rg" data-v="${esc(r)}" class="${rg === r ? 'on' : ''}">${r ? esc(r) : '不分區'}</button>`).join('')}</div></div>
      <div class="row wrap" style="gap:.5rem"><button class="btn pri" data-a="saveImg" ${sel.size ? '' : 'disabled'}>存成菜單版本${sel.size ? `（${sel.size} 張）` : ''}</button>${P.text.replace(/\s+/g, '').length > 300 ? '<button class="btn olive" data-a="useText">用網頁文字整理成表格</button>' : ''}<button class="btn" data-a="extp">用瀏覽器打開 ↗</button></div>`; };
  sh.body.addEventListener('keydown', e => { if (e.target.id === 'nq' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); search(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 's') search(); else if (a === 'ext') openUrl('https://www.google.com/search?q=' + encodeURIComponent(q)); else if (a === 'back') viewResults();
    else if (a === 'open') { const r = results[+b.dataset.i]; sel = new Set(); sh.body.innerHTML = '<div class="empty"><div class="spin"></div>在背景打開網頁、讀取菜單圖片與文字…<br><span class="small muted">' + esc(r.d) + '</span></div>';
      try { const P = await readPage(r.h, true); if (sh.closed) return; page = Object.assign(P, {d: r.d}); viewPage(); } catch (er) { if (!sh.closed) viewResults(`<div class="empty">⚠️ ${esc(er.message)}<br><button class="btn sm" data-a="back" style="margin-top:.6rem">‹ 搜尋結果</button></div>`); } }
    else if (a === 'pick') { const i = +b.dataset.i; if (sel.has(i)) sel.delete(i); else sel.add(i); b.classList.toggle('on', sel.has(i)); const sb = $('[data-a="saveImg"]', sh.body); sb.disabled = !sel.size; sb.textContent = '存成菜單版本' + (sel.size ? `（${sel.size} 張）` : ''); }
    else if (a === 'rg') { rg = b.dataset.v; $$('.rgPick button', sh.body).forEach(x => x.classList.toggle('on', x.dataset.v === rg)); }
    else if (a === 'extp') openUrl(page.url);
    else if (a === 'useText') { sh.close(); urlMenu(p, page.url); }
    else if (a === 'saveImg') { const L = [...sel].sort((x, y) => x - y).map(i => page.list[i]), al = {id: 'a' + uid(), name: page.d + ' ' + dateName(), t: Date.now(), imgs: [], src: 'web', rg};
      busy('下載圖片中…'); let err = ''; for (const x of L) { try { al.imgs.push(await imgStore(await fetchImgBlob(x.s))); } catch (er) { err = er.message; } } busy(false);
      if (!al.imgs.length) { toast('❌ 圖片下載失敗：' + (err || '未知原因'), 4000); return; }
      p.albums = p.albums || []; p.albums.push(al); await savePlace(p); sh.close(); refreshAll(); document.dispatchEvent(new CustomEvent('fm:job', {detail: p.id}));
      toast(`已存成菜單版本（${al.imgs.length} 張${rg ? '・' + rg : ''}）`, 3000);
      if (S.aikey && await ask('要現在用 AI 把這些菜單圖片辨識成表格嗎？（在背景執行）', '開始辨識')) aiMenu(p, undefined, [al]); } });
  viewResults(); if (IS_APP && NB.pageRead) search();
}
window.__nbPage = (id, ok, val) => { const f = NBCB[id]; if (f) { delete NBCB[id]; f({status: ok ? 200 : 0, text: typeof val === 'string' ? val : JSON.stringify(val || '')}); } };
const URL_PROMPT = `以下是一家台灣餐飲店「線上點餐網頁」讀出來的全部文字，裡面會夾雜按鈕、購物車、營業時間、公告、登入等無關文字。
請只整理出菜單上所有可以點的餐點，照下面的格式輸出，不可遺漏，也不可以自己編造（網頁上沒有的價格就留空）。
飲料店常見情況：
・同一品項有不同杯型價格（中杯/大杯、M/L、瓶裝），每個價格各寫一行，品名後面用括號註明，例如：品項|茶類|紅茶 (M)|30 與 品項|茶類|紅茶 (L)|35。
・甜度、冰塊、冷熱這類不另外收費的選擇，寫成選項，分類寫「飲料客製・甜度（選一）」這樣的格式。
・加料（珍珠、椰果…）有價格的寫成加購，例如：加購|加料|珍珠|10。
・「售完」「已售完」的品項照樣列出，品名後面加（售完）。
`;
function urlMenuSheet(p) {
  const u0 = p.menuUrl || (isMenuSite(p.web) ? p.web : '');
  const sh = sheet({title: '讀取線上點餐網頁', foot: '<button class="btn pri" data-a="go">讀取並整理成表格</button>'});
  sh.body.innerHTML = `<div class="field"><label>點餐網頁網址</label><div class="keyBox"><input id="uU" type="url" value="${esc(u0)}" placeholder="https://order.nidin.shop/menu/…" autocomplete="off"><button class="btn sm" data-a="paste">貼上</button></div></div>
    ${p.web && p.web !== u0 ? `<div class="small muted" style="margin:-.4rem 0 .8rem">Google 地圖上這家店的網站：<a href="#" data-a="useWeb">${esc(p.web)}</a>（點一下帶入）</div>` : ''}
    <div class="row wrap" style="margin-bottom:.8rem"><button class="btn sm" data-a="find">🔍 用 Google 搜尋這家店的點餐網頁</button>${u0 ? '<button class="btn sm" data-a="open">在瀏覽器打開看看 ↗</button>' : ''}</div>
    <div class="callout small">💡 找網址的方法：按「用 Google 搜尋」，或在 Google 地圖店家頁的「線上點餐／訂購」、店家 Facebook／LINE 官方帳號裡找到點餐連結，複製後貼到上面。<br>網頁的菜單會隨時更新，網址記住後，之後按表格下方的「重新讀取最新菜單」就能更新。</div>
    ${IS_APP && NB.pageText ? '' : '<div class="callout warn small">' + (IS_APP ? '需要安裝 APK v1.5.0 以上才能讀取點餐網頁。' : '網頁版沒辦法讀取其他網站的內容，請在 Android App 裡使用。') + '</div>'}`;
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, inp = $('#uU', sh.body);
    if (a === 'useWeb') { e.preventDefault(); inp.value = p.web; }
    else if (a === 'paste') { try { const t = (IS_APP && NB.paste ? NB.paste() : await navigator.clipboard.readText()).trim(); const m = t.match(/https?:\/\/\S+/); if (m) inp.value = m[0]; else toast('剪貼簿裡沒有網址'); } catch (er) { toast('請長按輸入框選「貼上」'); inp.focus(); } }
    else if (a === 'find') openUrl('https://www.google.com/search?q=' + encodeURIComponent(p.name + ' ' + (p.addr || '').slice(0, 12) + ' 線上點餐 菜單'));
    else if (a === 'open') openUrl(inp.value.trim() || u0); });
  sh.foot.onclick = () => { let u = $('#uU', sh.body).value.trim(); if (!u) { toast('請先貼上點餐網頁網址'); return; } if (!/^https?:\/\//i.test(u)) u = 'https://' + u; sh.close(); urlMenu(p, u); };
}
async function urlMenu(p, url) {
  if (!S.aikey) { needAiKey(); return; } if (AIJ.jobs[p.id]) { toast('這間店的 AI 工作還在進行中'); return; }
  let replace = true; if ((p.menu || []).length) { replace = await ask(`目前表格已有 ${p.menu.length} 個品項。\n按「刪掉舊的、換成新的」＝整份表格換成網頁上的最新菜單。\n按「取消」＝保留舊表格，把新結果加在後面。`, '刪掉舊的、換成新的'); }
  const t0 = Date.now(); AIJ.set(p.id, {kind: 'url', msg: '開啟點餐網頁中…'}); toast('已在背景讀取點餐網頁，完成後會自動帶入表格', 3000);
  let pg, rows = [], err = '', model = '';
  try { pg = await readPage(url); if (pg.text.replace(/\s+/g, '').length < 40) throw new Error('網頁上沒有讀到菜單文字（可能需要登入，或網址不是菜單頁）');
    p.menuUrl = url; await savePlace(p);
    AIJ.msg(p.id, `讀到網頁（${Math.round(pg.text.length / 100) / 10}k 字），AI 整理中…`);
    const r = await aiRun({contents: [{role: 'user', parts: [{text: URL_PROMPT + '\n' + MENU_PROMPT.split('\n').slice(1).join('\n') + '\n\n網頁標題：' + pg.title + '\n網頁內容：\n' + pg.text.slice(0, 80000)}]}], generationConfig: {temperature: 0, maxOutputTokens: 16384}},
      {keepPartial: true, firstMs: 120000, onText: t => AIJ.msg(p.id, `AI 整理中… 已讀到 ${parseMenu(t).length} 項`), onWait: s => AIJ.msg(p.id, `Google 限制每分鐘次數，${s} 秒後自動繼續…`)});
    rows = parseMenu(r.text); model = r.model; if (!rows.length) throw new Error('AI 在這個網頁裡找不到菜單品項');
    AILOG.add({kind: '點餐網頁', place: p.name, model, ms: Date.now() - t0, ok: true, n: rows.length, note: url.slice(0, 80)}); }
  catch (e) { err = e.code || e.idle || e.fatal ? aiErrText(e) : e.message; AILOG.add({kind: '點餐網頁', place: p.name, model: e.model || '', ms: Date.now() - t0, ok: false, err: err + '（' + url.slice(0, 80) + '）'}); }
  AIJ.set(p.id, null); if (!DB.places.includes(p)) return;
  if (!rows.length) { menuDone(p, '❌ 讀取點餐網頁失敗：' + err); return; }
  p.menu = groupMenu(replace ? rows : (p.menu || []).concat(rows)); p.menuSrc = {kind: 'url', t: Date.now(), url, model, title: pg.title}; await savePlace(p);
  menuDone(p, `✅ 已從點餐網頁帶入 ${rows.length} 個品項，用時 ${Math.round((Date.now() - t0) / 1000)} 秒`);
}
/* 到 Google 地圖「菜單」分頁截圖 → 分享回來（Google 沒有開放菜單分頁的資料給其他 App，所以用截圖＋分享） */
function gmMenuGuide(p) {
  const sh = sheet({title: '從 Google 地圖拿菜單', full: true, foot: '<button class="btn pri" data-a="go">打開「' + esc(p.name) + '」的 Google 地圖</button>'});
  sh.body.innerHTML = `<div class="tut"><p>Google 沒有開放「菜單」分頁的照片給其他 App 讀取，所以請照下面的步驟截圖傳回來（大約 30 秒）：</p>
    <div class="steps">
      <div><b>1</b><span>按下方按鈕打開 Google 地圖，在店家頁面點上方的「<b>菜單</b>」分頁。</span></div>
      <div><b>2</b><span>點開菜單照片，放大到整張菜單看得清楚的大小。</span></div>
      <div><b>3</b><span><b>截圖</b>（通常是 電源鍵＋音量下）。菜單很長或有好幾張，就每張各截一次。</span></div>
      <div><b>4</b><span>在截圖預覽按「<b>分享</b>」→ 選「<b>食光地圖</b>」。也可以截完全部後，到相簿一次選多張分享。</span></div>
      <div><b>5</b><span>回到食光地圖會問你要存到哪一家店（已經幫你選好「${esc(p.name)}」），存好就能按 AI 辨識。</span></div></div>
    <div class="callout">💡 30 分鐘內陸續分享回來的截圖，會自動放進同一個菜單版本。</div>
    ${IS_APP && NB.sharedTake ? '' : '<div class="callout warn">這個版本還不能接收「分享」。請安裝 APK v1.4.0，或截圖後到「管理圖檔」→「新增版本」從相簿選擇。</div>'}</div>`;
  sh.foot.onclick = () => { Share.expect(p.id); sh.close(); const u = gmUrl(p); if (IS_APP && NB.openNav) NB.openNav('com.google.android.apps.maps', u, u); else openUrl(u); };
}
/* ---------- 接收其他 App「分享」過來的圖片（截圖、相簿） ---------- */
var Share = {
  expect(id) { lsSet('fm.shareFor', {id, t: Date.now()}); },
  onNative() { this.check(); },
  async check() {
    if (!IS_APP || !NB.sharedTake || this.running) return; let L = []; try { L = JSON.parse(NB.sharedTake() || '[]'); } catch (e) {} if (!L.length) return; this.running = true;
    try { const blobs = []; for (const n of L) { try { const r = await fetch(location.origin + '/shared/' + encodeURIComponent(n)); if (r.ok) blobs.push(await r.blob()); } catch (e) {} try { NB.sharedDone(n); } catch (e) {} }
      if (!blobs.length) { toast('沒有收到可以用的圖片'); return; } while (sheets.length) sheets[sheets.length - 1].close(); if (curTab !== 'Fav' && curTab !== 'Map') showTab('Fav'); this.ask(blobs); }
    finally { this.running = false; } },
  ask(blobs) {
    const f = lsGet('fm.shareFor', null); let pid = f && Date.now() - f.t < 2 * 3600e3 && DB.places.some(x => x.id === f.id) ? f.id : (M.sel || ''); let q = '';
    const urls = blobs.map(b => URL.createObjectURL(b)), cleanup = () => urls.forEach(u => URL.revokeObjectURL(u));
    const sh = sheet({title: `收到 ${blobs.length} 張圖片`, full: true, foot: '<button class="btn pri" data-a="ok">存成菜單</button>', onClose: cleanup});
    const latest = () => { const p = DB.places.find(x => x.id === pid), a = p && albumsOf(p)[0]; return a && a.src === 'share' && Date.now() - a.t < 30 * 60e3 ? a : null; };
    let mode = 'new';
    const render = () => { const p = DB.places.find(x => x.id === pid), la = latest(); if (la && mode === 'new' && !sh.modeSet) mode = 'add';
      const list = DB.places.filter(x => !q || (x.name + ' ' + (x.addr || '')).toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.id === pid) - (a.id === pid));
      sh.body.innerHTML = `<div class="thumbs" style="margin-bottom:.8rem">${urls.map(u => `<div class="th"><img src="${u}" alt=""></div>`).join('')}</div>
        <div class="field"><label>存到哪一家店的菜單</label><div class="searchBox" style="margin-bottom:.5rem"><input id="shQ" type="search" placeholder="搜尋收藏的店家…" value="${esc(q)}"></div>
          <div class="shList">${list.slice(0, 30).map(x => { const c = catOf(x.cat); return `<button class="res ${x.id === pid ? 'on' : ''}" data-id="${x.id}"><span class="rIc" style="background:${c.color}">${esc(c.icon)}</span><span class="grow"><b>${esc(x.name)}</b><small>${esc(x.addr || '')}</small></span>${x.id === pid ? '<span class="tag">已選</span>' : ''}</button>`; }).join('') || '<div class="resNote">找不到收藏的店家</div>'}</div></div>
        ${p ? `<div class="field"><label>放在</label><div class="seg" id="shM"><button data-v="new" class="${mode === 'new' ? 'on' : ''}">新的菜單版本</button><button data-v="add" class="${mode === 'add' ? 'on' : ''}" ${albumsOf(p).length ? '' : 'disabled'}>加到最新版本${albumsOf(p)[0] ? '「' + esc(albumsOf(p)[0].name) + '」' : ''}</button></div></div>` : ''}`;
      const b = $('[data-a="ok"]', sh.foot); b.disabled = !p; b.textContent = p ? `存成「${p.name}」的菜單` : '先選擇店家'; };
    render();
    sh.body.addEventListener('input', e => { if (e.target.id === 'shQ') { q = e.target.value; const pos = e.target.selectionStart; render(); const i = $('#shQ', sh.body); i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) {} } });
    sh.body.addEventListener('click', e => { const r = e.target.closest('.res'); if (r) { pid = r.dataset.id; sh.modeSet = false; mode = 'new'; render(); return; } const m = e.target.closest('#shM button'); if (m && !m.disabled) { mode = m.dataset.v; sh.modeSet = true; render(); } });
    sh.foot.onclick = async () => { const p = DB.places.find(x => x.id === pid); if (!p) return; busy('存入圖片中…');
      try { p.albums = p.albums || []; let a = mode === 'add' ? albumsOf(p)[0] : null;
        if (!a) { a = {id: 'a' + uid(), name: (lsGet('fm.shareFor', {}) || {}).id === p.id ? 'Google 地圖菜單 ' + dateName() : dateName(), t: Date.now(), imgs: [], src: 'share'}; p.albums.push(a); }
        for (const b of blobs) a.imgs.push(await imgStore(b)); a.t = Math.max(a.t, Date.now() - 1); await savePlace(p); this.expect(p.id); }
      catch (er) { busy(false); toast('❌ ' + er.message); return; }
      busy(false); sh.close(); refreshAll(); buzz(30); toast(`已存進「${p.name}」的菜單（${blobs.length} 張）`, 3000); openPlace(p.id, true);
      if (S.aikey && !AIJ.jobs[p.id] && await ask('要現在用 AI 把菜單辨識成表格嗎？（在背景執行）\n如果還有其他菜單截圖要傳，可以先按取消，全部傳完再辨識。', '開始辨識')) aiMenu(p); };
  }
};
async function gPhotoPicker(p) {
  if (!S.gkey) { ask('這個功能需要 Google Maps 金鑰。\n要看設定教學嗎？', '看教學').then(y => { if (y) openTutorial('maps'); }); return; }
  const sh = sheet({title: 'Google 地圖相片 · ' + p.name, full: true, foot: '<button class="btn pri" data-a="save" disabled>存成新的菜單版本</button>'}); let L = [], sel = new Set();
  sh.body.innerHTML = '<div class="empty"><div class="spin"></div>讀取 Google 地圖相片中…</div>';
  const foot = () => { const b = $('[data-a="save"]', sh.foot); b.disabled = !sel.size; b.textContent = sel.size ? `存成新的菜單版本（${sel.size} 張）` : '先點選菜單相片'; };
  try { L = await gPhotoList(p); if (sh.closed) return; if (!L.length) { sh.body.innerHTML = '<div class="empty"><span class="big">🖼️</span>Google 地圖上沒有這家店的相片</div>'; return; }
    const th = await Promise.all(L.map(x => gPhotoUri(x.name, 480).catch(() => ''))); if (sh.closed) return; L.forEach((x, i) => x.th = th[i]);
    sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.6rem">點選是菜單的相片（可多選），再按下方按鈕。相片來自 Google 地圖，著作權屬於上傳者。</div><div id="aiPick" class="small" style="margin-bottom:.6rem"></div>
      <div class="gpGrid">${L.map((x, i) => `<button class="gp" data-i="${i}">${x.th ? `<img src="${esc(x.th)}" alt="" loading="lazy">` : '<span>無法顯示</span>'}<i>✓</i>${x.by ? `<small>${esc(x.by)}</small>` : ''}</button>`).join('')}</div>`;
    foot();
    if (S.aikey) autoPick(); }
  catch (e) { if (!sh.closed) sh.body.innerHTML = `<div class="empty"><span class="big">⚠️</span>讀取失敗：${esc(e.message)}</div>`; return; }
  /* 用 AI 先幫忙挑出看起來是菜單的相片（1 次請求） */
  async function autoPick() { const o = $('#aiPick', sh.body); o.innerHTML = '<span class="spin" style="display:inline-block;width:1rem;height:1rem;vertical-align:-3px;margin:0 .4rem 0 0;border-width:2px"></span>AI 正在挑出菜單相片…';
    try { const parts = [{text: `以下依序是 ${L.length} 張餐廳相片（編號 1 到 ${L.length}）。哪幾張是「菜單或價目表」（拍到品項與價格的看板、紙本菜單、點餐單）？只回覆編號，用逗號分隔，例如：2,5。都不是就回覆 0。`}];
      for (const x of L) { if (!x.th) { parts.push({text: '（無法讀取）'}); continue; } const b = await fetchImgBlob(x.th); parts.push(await imgPart(b)); }
      const r = await aiRun({contents: [{role: 'user', parts}], generationConfig: {temperature: 0, maxOutputTokens: 200}}, {});
      const ns = (r.text.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= L.length); if (sh.closed) return;
      ns.forEach(n => { sel.add(n - 1); const g = $(`.gp[data-i="${n - 1}"]`, sh.body); if (g) g.classList.add('on'); }); foot();
      o.textContent = ns.length ? `✨ AI 挑出 ${ns.length} 張可能是菜單的相片，請確認後再存。` : '✨ AI 看起來這些相片裡沒有菜單，可以自己點選。'; AILOG.add({kind: '挑選菜單相片', place: p.name, model: r.model, ms: r.ms, ok: true, n: ns.length}); }
    catch (e) { if (!sh.closed) o.textContent = 'AI 沒有幫忙挑選（' + aiErrText(e) + '），請自己點選菜單相片。'; } }
  sh.body.addEventListener('click', e => { const b = e.target.closest('.gp'); if (!b) return; const i = +b.dataset.i; if (sel.has(i)) sel.delete(i); else sel.add(i); b.classList.toggle('on', sel.has(i)); foot(); });
  sh.foot.addEventListener('click', async () => { if (!sel.size) return; const idx = [...sel].sort((a, b) => a - b), a = {id: 'a' + uid(), name: 'Google 地圖相片 ' + dateName(), t: Date.now(), imgs: [], src: 'google'};
    busy('下載相片中…'); let err = '';
    for (const i of idx) { try { const u = await gPhotoUri(L[i].name, 2000), b = await fetchImgBlob(u); a.imgs.push(await imgStore(b)); } catch (e) { err = e.message; } }
    busy(false); if (!a.imgs.length) { toast('❌ ' + (err || '相片下載失敗'), 4500); return; }
    p.albums = p.albums || []; p.albums.push(a); await savePlace(p); sh.close(); refreshAll(); document.dispatchEvent(new CustomEvent('fm:job', {detail: p.id}));
    toast(`已存成新的菜單版本（${a.imgs.length} 張）${err ? '，有部分失敗：' + err : ''}`, 3500);
    if (S.aikey && await ask('要現在用 AI 把這些菜單相片辨識成表格嗎？（在背景執行）', '開始辨識')) aiMenu(p); });
}
async function webTextMenu(p) {
  if (!S.aikey) { needAiKey(); return; } if (AIJ.jobs[p.id]) { toast('這間店的 AI 工作還在進行中'); return; }
  AIJ.set(p.id, {kind: 'web', msg: '上網搜尋菜單中…'}); toast('已在背景開始搜尋，找到會自動帶入表格', 3000); const t0 = Date.now();
  const prompt = `請用 Google 搜尋台灣這家店的菜單與價格：店名「${p.name}」${p.addr ? '，地址「' + p.addr + '」' : ''}${p.phone ? '，電話 ' + p.phone : ''}。可參考店家官網、Facebook、Instagram、外送平台（foodpanda、Uber Eats）、美食部落格。\n` +
    '請只輸出一個 JSON 物件，不要其他文字：{"items":[{"category":"分類","name":"品名","price":"價格數字"}],"note":"這份菜單的來源與大約年份，一句話"}。\n規則：1) 必須確定是這一家店（同店名、同地區）。2) 只列出搜尋結果裡真的有寫到的品項與價格，不可以自行編造。3) 找不到就輸出 {"items":[],"note":"找不到的原因"}。4) 使用繁體中文。';
  let res = null, err = '';
  try { const r = await aiRun({contents: [{role: 'user', parts: [{text: prompt}]}], tools: [{google_search: {}}], generationConfig: {temperature: 0}}, {prefer: 'flash', firstMs: 120000});
    const j = parseLoose(r.text); res = {rows: (j.items || []).filter(x => x && String(x.name || '').trim()).map(x => ({c: String(x.category || '其他').trim() || '其他', n: String(x.name).trim(), p: normPrice(x.price)})), note: String(j.note || '')};
    AILOG.add({kind: '網路文字搜尋', place: p.name, model: r.model, ms: r.ms, ok: true, n: res.rows.length, note: res.note.slice(0, 80)}); }
  catch (e) { err = e.grounding || (e.code === 429 && e.zero) || (e.code === 400 && /search|tool/i.test(e.raw || '')) ? '免費版 Gemini 不能使用 Google 搜尋，請改用「到 Google 地圖的菜單截圖」' : aiErrText(e); AILOG.add({kind: '網路文字搜尋', place: p.name, model: e.model || '', ms: Date.now() - t0, ok: false, err: err + (e.raw && e.raw !== err ? '（' + e.raw.slice(0, 160) + '）' : '')}); }
  AIJ.set(p.id, null); if (!DB.places.includes(p)) return;
  if (!res || !res.rows.length) { menuDone(p, err ? '❌ ' + err : `網路上找不到「${p.name}」的菜單文字${res && res.note ? '（' + res.note + '）' : ''}，建議改用「到 Google 地圖的菜單截圖」`); return; }
  const src = {kind: 'web', t: Date.now(), note: res.note, links: []}, apply = async rep => { p.menu = groupMenu(rep ? res.rows : (p.menu || []).concat(res.rows)); p.menuSrc = src; await savePlace(p); menuDone(p, `✅ 已帶入網路上找到的 ${res.rows.length} 個品項`); };
  if (!(p.menu || []).length) { await apply(true); return; }
  buzz(40); dialog(`網路上找到「${p.name}」的 ${res.rows.length} 個品項`, `${esc(res.note)}<br><span class="small muted">網路資料可能不是最新，請以店家為準。</span><br><br>目前表格已有 ${p.menu.length} 個品項，要怎麼處理？`, [['取代原本的表格', () => apply(true)], ['加在原本的後面', () => apply(false)], ['不要帶入', null]]);
}

/* ---------- 菜單圖檔管理：每個版本一個資料夾（可放多張、可自訂名稱），最新的排最前面 ---------- */
function openAlbums(p, onChange) {
  const sh = sheet({title: '菜單圖檔 · ' + p.name, full: true, foot: '<button class="btn pri" data-a="new">＋ 新增版本（新菜單）</button>', onClose() { onChange && onChange(); }});
  const add = async (al) => { const fs = await pickImages(true); if (!fs.length) return false; busy('處理圖片中…'); try { for (const f of fs) al.imgs.push(await imgStore(f)); } catch (e) { toast('❌ ' + e.message); } busy(false); return true; };
  const render = async () => { const L = albumsOf(p); const th = await Promise.all(L.map(a => Promise.all(a.imgs.map(imgURL))));
    sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">每次菜單改版就「新增版本」，舊菜單會保留。連鎖店北中南價格不同時，把各區菜單分成不同版本並設定「區域」，表格就能切換區域。打開菜單圖檔時先顯示最新版本，往左滑是較舊的版本。版本名稱可以自己改（例如 2026 春季、第 3 版）。</div>` +
      (L.map((a, i) => `<div class="album" data-id="${a.id}"><div class="row"><span class="vTag" style="background:${i ? '#8a7a66' : '#5f9a5a'}">${i ? '舊' : '最新'}</span><input class="grow" data-k="name" value="${esc(a.name)}" maxlength="24" aria-label="版本名稱"><button class="ic" data-a="del" style="color:var(--danger)" aria-label="刪除這個版本">🗑</button></div>
        <div class="small muted" style="margin:.25rem 0 .4rem">建立於 ${dateName(a.t)} · ${a.imgs.length} 張</div>
        <div class="rgPick"><span>區域</span>${['', ...REGIONS, ...new Set((p.albums || []).map(x => x.rg).filter(r => r && !REGIONS.includes(r)))].map(r => `<button data-a="rg" data-v="${esc(r)}" class="${(a.rg || '') === r ? 'on' : ''}">${r ? esc(r) : '不分區'}</button>`).join('')}<button data-a="rgC">＋ 自訂</button></div>
        <div class="thumbs">${a.imgs.map((im, k) => `<div class="th"><img src="${th[i][k]}" data-a="view" data-i="${k}" alt=""><button class="rm" data-a="rm" data-i="${k}" aria-label="移除">✕</button></div>`).join('')}<button class="th addTh" data-a="add">＋<small>加圖片</small></button></div></div>`).join('') || '<div class="empty"><span class="big">🖼️</span>還沒有菜單圖片<br><span class="small">按下方「新增版本」從相簿選擇或拍照</span></div>'); };
  render();
  sh.body.addEventListener('change', e => { const t = e.target; if (t.dataset.k !== 'name') return; const a = p.albums.find(x => x.id === t.closest('.album').dataset.id); if (a) { a.name = t.value.trim() || dateName(a.t); savePlace(p); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = p.albums.find(x => x.id === b.closest('.album').dataset.id), i = +b.dataset.i; if (!a) return;
    if (b.dataset.a === 'add') { if (await add(a)) { await savePlace(p); render(); } }
    else if (b.dataset.a === 'rg') { a.rg = b.dataset.v; await savePlace(p); render(); }
    else if (b.dataset.a === 'rgC') { const v = ((await askText('自訂區域名稱', a.rg && !REGIONS.includes(a.rg) ? a.rg : '', '例如：大葉高島屋、桃竹苗')) || '').trim().slice(0, 10); if (v) { a.rg = v; await savePlace(p); render(); } }
    else if (b.dataset.a === 'view') Viewer.open(a.imgs.map((id, k) => ({id, label: a.name + ' · 第 ' + (k + 1) + ' 張'})), i, p.name);
    else if (b.dataset.a === 'rm') { if (!await ask('要移除這張圖片嗎？', '移除', true)) return; const [im] = a.imgs.splice(i, 1); await imgDel(im); await savePlace(p); render(); }
    else if (b.dataset.a === 'del') { if (!await ask(`確定要刪除版本「${a.name}」和裡面的 ${a.imgs.length} 張圖片嗎？`, '刪除', true)) return; for (const im of a.imgs) await imgDel(im); p.albums.splice(p.albums.indexOf(a), 1); await savePlace(p); render(); } });
  sh.foot.onclick = async () => { const n = (p.albums || []).length + 1, a = {id: 'a' + uid(), name: dateName() + ((p.albums || []).some(x => x.name === dateName()) ? ' #' + n : ''), t: Date.now(), imgs: []}; if (!await add(a) || !a.imgs.length) return; p.albums = p.albums || []; p.albums.push(a); await savePlace(p); await render();
    if (S.aikey && !AIJ.jobs[p.id] && await ask('新版本已加入。\n要用 AI 把這個版本辨識成表格嗎？（在背景執行）', '開始辨識')) aiMenu(p); };
  if (!(p.albums || []).length) setTimeout(() => sh.foot.onclick(), 350);
}
function openMenuImgs(p) { const items = []; albumsOf(p).forEach((a, i) => a.imgs.forEach((id, k) => items.push({id, label: (a.rg ? '【' + a.rg + '】' : '') + (i ? '舊版本：' : '最新版本：') + a.name + (a.imgs.length > 1 ? ' · 第 ' + (k + 1) + '/' + a.imgs.length + ' 張' : '')}))); if (!items.length) { toast('還沒有菜單圖片'); return; } Viewer.open(items, 0, p.name); }

/* ---------- 收藏地點：明細 ---------- */
function openPlace(id, toMenu) {
  const p = DB.places.find(x => x.id === id); if (!p) return; let editT = false, mq = '', mc = '';
  /* 區域：目前選的區域＋不分區的列 */
  const regsOf = () => { const r = []; (p.menu || []).forEach(x => { if (x.g && !r.includes(x.g)) r.push(x.g); }); return r; };
  const curReg = () => { const r = regsOf(); if (!r.length) return ''; return r.includes(p.rgSel) ? p.rgSel : r[0]; };
  const inReg = x => { const c = curReg(); return !c || !x.g || x.g === c; };
  const onJob = e => { if (e.detail === p.id && !editT) render(); };
  const sh = sheet({title: p.name, full: true, onClose() { document.removeEventListener('fm:job', onJob); }}); sh.tools.innerHTML = '<button class="btn sm" data-a="edit">✎ 編輯</button>';
  document.addEventListener('fm:job', onJob);
  sh.tools.onclick = () => editPlace(p, false, del => { if (del) sh.close(); else render(); });
  const save = debounce(() => savePlace(p), 400);
  /* 菜單表格：上方分類籤（全部、各分類、🧩 組合選項、➕ 加購），下面依序是品項表、組合選項、加購表 */
  const TY = r => r.t || 'item';
  const cats = () => { const s = []; (p.menu || []).forEach(r => { if (inReg(r) && TY(r) === 'item' && !s.includes(r.c)) s.push(r.c); }); return s; };
  const price = v => v !== '' && v != null && !isNaN(+v) ? '$' + esc(v) : esc(v || '');
  function rowsHtml() {
    const q = mq.trim().toLowerCase(), hit = r => inReg(r) && (!q || (r.c + ' ' + r.n).toLowerCase().includes(q)), all = (p.menu || []).filter(hit);
    const showItem = mc === '' || (mc !== '🧩' && mc !== '➕'), items = all.filter(r => TY(r) === 'item' && (mc === '' || r.c === mc)), opts = all.filter(r => TY(r) === 'opt'), adds = all.filter(r => TY(r) === 'add');
    let html = '';
    /* 分類標題獨佔一列，下面再列品名與價格，分類名稱很長也不會把品名擠成一直條 */
    /* 同一品項的不同尺寸（L、瓶、中、大…）合併成一行，沒有價格的尺寸不顯示 */
    const merge = L => { const out = [], idx = {}; L.forEach(r => { const m = r.n.match(SZ), b = m ? baseName(r.n) : r.n, k = r.c + '|' + b;
      if (m && idx[k] != null) { out[idx[k]].v.push({s: m[1], p: r.p}); return; } if (m) idx[k] = out.length; out.push({c: r.c, n: b, multi: !!m, v: [{s: m ? m[1] : '', p: r.p}]}); }); return out; };
    const catRows = (L0, pre) => { const L = merge(L0); let last = null; return L.map(r => { const g = r.c !== last; last = r.c; const vs = r.v.filter(x => x.p !== '' && x.p != null);
      const pc = r.multi ? vs.map(x => `<span class="szp"><i>${esc(x.s)}</i>${pre}${price(x.p)}</span>`).join('') : (vs[0] ? pre + price(vs[0].p) : '');
      return (g ? `<tr class="cat"><td colspan="2">${esc(r.c)} <span>${L.filter(x => x.c === r.c).length}</span></td></tr>` : '') + `<tr><td>${esc(r.n)}</td><td class="p${r.multi && vs.length > 1 ? ' multi' : ''}">${pc}</td></tr>`; }).join(''); };
    if (showItem && items.length) html += `<table class="mtable list"><thead><tr><th>品名</th><th class="p">價格</th></tr></thead><tbody>${catRows(items, '')}</tbody></table>`;
    if ((mc === '' || mc === '🧩') && opts.length) { const gs = []; opts.forEach(r => { let g = gs.find(x => x.c === r.c); if (!g) gs.push(g = {c: r.c, L: []}); g.L.push(r); });
      html += `<div class="mSec">🧩 組合選項<small>依步驟挑選，已含在主餐價格內</small></div>` + gs.map(g => { const m = g.c.match(/^(.*?)（(.+?)）$/); return `<div class="optG"><div class="optH"><b>${esc(m ? m[1] : g.c)}</b>${m ? `<span class="tag">${esc(m[2])}</span>` : ''}</div><div class="optL">${g.L.map(r => `<span>${esc(r.n)}${r.p ? ' <em>+' + esc(r.p) + '</em>' : ''}</span>`).join('')}</div></div>`; }).join(''); }
    if ((mc === '' || mc === '➕') && adds.length) html += `<div class="mSec">➕ 加購・加價</div><table class="mtable list add"><tbody>${catRows(adds, '+')}</tbody></table>`;
    return html || '<div class="empty" style="padding:1rem">找不到符合的品項</div>';
  }
  function tableHtml() {
    const rows = p.menu || []; if (!rows.length && !editT) return `<div class="empty" style="padding:1.2rem"><span class="muted">還沒有菜單表格。<br>可以用菜單照片「✨ AI 辨識」、「🌐 上網找菜單」，或手動建立。</span><div style="margin-top:.7rem"><button class="btn sm" data-a="tEdit">✎ 手動建立表格</button></div></div>`;
    if (editT) return `${curReg() ? `<div class="callout small" style="margin:0 0 .5rem">正在編輯「${esc(curReg())}」的菜單（不分區的品項也會顯示）。</div>` : ''}<div class="small muted" style="margin-bottom:.4rem">類型：品項＝有價格的餐點；選項＝組合式菜單可挑選的東西（分類寫「步驟（選幾種）」，例如：主食（選一））；加購＝加購區、加價。</div>
      <table class="mtable edit"><thead><tr><th style="width:4.6rem">類型</th><th style="width:26%">分類</th><th>品名</th><th style="width:18%" class="p">價格</th><th></th></tr></thead><tbody>${rows.map((r, i) => !inReg(r) ? '' : `<tr><td><select data-i="${i}" data-k="t">${[['item', '品項'], ['opt', '選項'], ['add', '加購']].map(([v, l]) => `<option value="${v}" ${TY(r) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><input data-i="${i}" data-k="c" value="${esc(r.c)}"></td><td><input data-i="${i}" data-k="n" value="${esc(r.n)}"></td><td><input data-i="${i}" data-k="p" value="${esc(r.p)}" inputmode="decimal" style="text-align:right"></td><td class="x"><button class="ic" data-a="tDel" data-i="${i}" style="color:var(--danger);width:2rem;height:2rem">✕</button></td></tr>`).join('')}</tbody></table>
      <div class="row wrap" style="margin-top:.6rem"><button class="btn sm" data-a="tAdd">＋ 新增一列</button><button class="btn sm danger" data-a="tClear">清空表格</button><span class="grow"></span><button class="btn sm pri" data-a="tEdit">完成</button></div>`;
    const RR = rows.filter(inReg), cs = cats(), nO = RR.filter(r => TY(r) === 'opt').length, nA = RR.filter(r => TY(r) === 'add').length, regs = regsOf(), cr = curReg();
    if (mc && !cs.includes(mc) && !(mc === '🧩' && nO) && !(mc === '➕' && nA)) mc = ''; const src = p.menuSrc;
    return `${regs.length ? `<div class="regBar"><span>📍 區域</span><div class="seg">${regs.map(r => `<button data-a="mr" data-r="${esc(r)}" class="${r === cr ? 'on' : ''}">${esc(r)}</button>`).join('')}</div></div>` : ''}<div class="mcats noSel"><button class="chip ${mc ? '' : 'on'}" data-a="mc" data-c="">全部 <span class="n">${RR.length}</span></button>${cs.map(c => `<button class="chip ${mc === c ? 'on' : ''}" data-a="mc" data-c="${esc(c)}">${esc(c)} <span class="n">${RR.filter(r => TY(r) === 'item' && r.c === c).length}</span></button>`).join('')}${nO ? `<button class="chip ${mc === '🧩' ? 'on' : ''}" data-a="mc" data-c="🧩">🧩 組合選項 <span class="n">${nO}</span></button>` : ''}${nA ? `<button class="chip ${mc === '➕' ? 'on' : ''}" data-a="mc" data-c="➕">➕ 加購 <span class="n">${nA}</span></button>` : ''}</div>
      <div class="row" style="margin-bottom:.55rem"><div class="searchBox grow"><input id="mq" type="search" placeholder="搜尋品名…" value="${esc(mq)}"></div><button class="btn sm" data-a="tEdit">✎ 編輯表格</button></div>
      <div id="mBody">${rowsHtml()}</div>
      ${src && src.kind === 'url' ? `<div class="small muted" style="margin-top:.5rem">🔗 ${dateName(src.t)} 從點餐網頁整理${src.title ? '（' + esc(src.title.slice(0, 40)) + '）' : ''}，請核對價格。<br><button class="btn sm" data-a="urlRe" style="margin-top:.4rem">🔄 重新讀取最新菜單</button> <button class="btn sm" data-a="urlOpen" style="margin-top:.4rem">打開網頁 ↗</button></div>` : ''}
      ${src && src.kind === 'web' ? `<div class="callout warn small" style="margin-top:.6rem">🌐 這份表格是 ${dateName(src.t)} 從網路搜尋整理的，可能不是最新，請以店家為準。${src.note ? '<br>' + esc(src.note) : ''}</div>` : src && src.kind === 'ai' ? `<div class="small muted" style="margin-top:.5rem">✨ 由菜單圖檔「${esc(src.ver || '')}」辨識（${dateName(src.t)}${src.model ? '・' + esc(aiShort(src.model.split('、')[0])) : ''}），請核對價格是否正確。${src.partial ? '<br>⚠️ 這次結果可能不完整。' : ''}${src.model && /lite/.test(src.model) ? '<br><button class="btn sm" data-a="aiF" style="margin-top:.4rem">用較準的 Flash 重新辨識（每天約 20 次）</button>' : ''}</div>` : ''}`;
  }
  if ((p.menu || []).length) { const g = groupMenu(p.menu); if (g.some((r, i) => r.c !== p.menu[i].c || r.n !== p.menu[i].n || r.t !== p.menu[i].t)) { p.menu = g; savePlace(p); } }
  function render() {
    const c = catOf(p.cat), hi = hoursIdx(p), ni = imgCount(p), nv = (p.albums || []).length, job = AIJ.jobs[p.id]; sh.title(p.name);
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
      ${job ? `<div class="jobBar"><span class="spin"></span><span class="grow">${esc(job.msg || 'AI 處理中…')}<small>在背景執行中，完成後會自動帶入，可以先離開這個畫面</small></span></div>` : ''}
      <div class="mBtns"><button class="btn pri" data-a="imgs" ${ni ? '' : 'disabled'}>🖼️ 打開菜單圖檔${ni ? `（${nv > 1 ? nv + ' 個版本・' : ''}${ni} 張）` : ''}</button><button class="btn" data-a="albums">🗂️ ${ni ? '管理圖檔' : '加入菜單圖片'}</button>
        <button class="btn olive" data-a="ai" ${job ? 'disabled' : ''}>✨ AI 辨識成表格</button><button class="btn olive" data-a="webm" ${job ? 'disabled' : ''}>🌐 上網找菜單</button></div>${S.aikey && aiLeftText() ? `<div class="small muted" style="margin:-.3rem 0 .7rem">${esc(aiLeftText())}（每天 ${AIQ.resetAt()} 重置）</div>` : ''}
      <div id="mtWrap">${tableHtml()}</div>`;
    sh.body.scrollTop = top;
  }
  sh.body.addEventListener('input', e => { const t = e.target; if (t.id === 'mq') { mq = t.value; $('#mBody', sh.body).innerHTML = rowsHtml(); return; }
    if (t.dataset.k) { p.menu[+t.dataset.i][t.dataset.k] = t.value; save(); } });
  sh.body.addEventListener('change', e => { const t = e.target; if (t.dataset.k === 't') { p.menu[+t.dataset.i].t = t.value; save(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, i = +b.dataset.i;
    if (a === 'nav') navTo(p); else if (a === 'gm') openUrl(gmUrl(p)); else if (a === 'tel') openUrl('tel:' + p.phone.replace(/[^\d+]/g, '')); else if (a === 'web') openUrl(p.web);
    else if (a === 'show') { while (sheets.length) sheets[sheets.length - 1].close(); selectPlace(p.id, true); }
    else if (a === 'copyAddr') { if (p.addr) copyText(p.addr); }
    else if (a === 'lnk') { e.preventDefault(); const l = (p.menuSrc.links || [])[i]; if (l) openUrl(l.uri); }
    else if (a === 'gfill') { busy('向 Google 更新資訊…'); try { await gFill(p); await savePlace(p); refreshAll(); toast('已更新營業時間等資訊'); } catch (er) { toast('❌ ' + er.message, 4000); } busy(false); render(); }
    else if (a === 'imgs') openMenuImgs(p); else if (a === 'albums') openAlbums(p, () => { render(); refreshAll(); });
    else if (a === 'ai') aiMenu(p); else if (a === 'aiF') aiMenu(p, 'flash'); else if (a === 'urlRe') urlMenu(p, p.menuUrl || p.menuSrc.url); else if (a === 'urlOpen') openUrl(p.menuUrl || p.menuSrc.url); else if (a === 'webm') webMenu(p);
    else if (a === 'mc') { mc = b.dataset.c; $('#mtWrap', sh.body).innerHTML = tableHtml(); }
    else if (a === 'mr') { p.rgSel = b.dataset.r; mc = ''; savePlace(p); $('#mtWrap', sh.body).innerHTML = tableHtml(); }
    else if (a === 'tEdit') { editT = !editT; p.menu = (p.menu || []).filter(r => (r.c + r.n + r.p).trim()); if (!editT) p.menu = groupMenu(p.menu); if (editT && !p.menu.length) p.menu.push({c: '', n: '', p: ''}); await savePlace(p); render(); refreshAll(); }
    else if (a === 'tAdd') { const l = p.menu[p.menu.length - 1]; p.menu.push(Object.assign({t: l ? TY(l) : 'item', c: l ? l.c : '', n: '', p: ''}, curReg() ? {g: curReg()} : {})); $('#mtWrap', sh.body).innerHTML = tableHtml(); const ins = $$('#mtWrap input[data-k="n"]', sh.body); ins[ins.length - 1].focus(); }
    else if (a === 'tDel') { p.menu.splice(i, 1); save(); $('#mtWrap', sh.body).innerHTML = tableHtml(); }
    else if (a === 'tClear') { if (await ask('確定要清空整個菜單表格嗎？（圖片不會被刪除）', '清空', true)) { p.menu = []; delete p.menuSrc; editT = false; await savePlace(p); render(); refreshAll(); } } });
  render(); if (toMenu) { const t = $('#menuTop', sh.body); if (t) setTimeout(() => { sh.body.scrollTop = t.offsetTop - 8; }, 50); }
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
    if (cb) { if (cb.dataset.c === '+') { read(); editCat(null, c => { if (c) d.cat = c.id; fill(); }, 'place'); return; } d.cat = cb.dataset.c; $$('#eC button', sh.body).forEach(b => b.classList.toggle('on', b === cb)); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'key') openTutorial('maps');
    if (b.dataset.a === 'g') { read(); busy('向 Google 查詢…'); try { await gFill(d, !d.name); toast('已帶入 Google 資料'); } catch (er) { toast('❌ ' + er.message, 4000); } busy(false); fill(); } });
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { if (!await ask(`確定要刪除「${src.name}」嗎？\n菜單圖片與表格也會一併刪除。`, '刪除', true)) return;
      for (const al of src.albums || []) for (const im of al.imgs || []) await imgDel(im); DB.places.splice(DB.places.indexOf(src), 1); await IDB.del('places', src.id).catch(() => {}); if (M.sel === src.id) clearSel(); sh.close(); refreshAll(); toast('已刪除'); done && done(true); return; }
    read(); if (!d.name) { toast('請輸入店名'); $('#eN', sh.body).focus(); return; }
    if (isNew) { d.id = 'p' + uid(); d.t = Date.now(); d.ord = DB.places.length ? Math.max(...DB.places.map(x => x.ord || 0)) + 1 : 0; DB.places.push(d); await savePlace(d); sh.close(); clearSel(); refreshAll(); buzz(25); toast('已加入收藏 🚩'); selectPlace(d.id); }
    else { Object.assign(src, d); await savePlace(src); sh.close(); refreshAll(); if (M.sel === src.id) selectPlace(src.id); toast('已儲存'); done && done(false); } });
}

/* ---------- 分類管理（收藏分類、食譜分類共用：自訂名稱、圖示、顏色、拖曳排序） ---------- */
const CK = {
  place: {list: () => DB.cats, save: saveCats, count: id => placesIn(id).length, unit: '間', title: '管理收藏分類', tip: '地圖上方的分類列與收藏頁會跟著變。', ph: '例如：火鍋、拉麵、早午餐', pre: 'c', color: '旗子顏色', flag: true,
    drop(id) { DB.places.forEach(p => { if (p.cat === id) { p.cat = ''; savePlace(p); } }); }, after() { refreshAll(); }},
  recipe: {list: () => DB.rcats, save: saveRcats, count: id => DB.recipes.filter(r => r.cat === id).length, unit: '道', title: '管理食譜分類', tip: '食譜頁的資料夾會跟著變。', ph: '例如：煎、炒、電鍋、湯、氣炸鍋', pre: 'r', color: '資料夾顏色', flag: false,
    drop(id) { DB.recipes.forEach(r => { if (r.cat === id) { r.cat = ''; saveRecipe(r); } }); }, after() { if (curTab === 'Rec') renderRec(); }}
};
function openCats(kind) {
  const K = CK[kind === 'recipe' ? 'recipe' : 'place'], sh = sheet({title: K.title, full: true, foot: '<button class="btn pri" data-a="add">＋ 新增分類</button>'});
  const render = () => { sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">長按或抓住 ☰ 拖動可以調整順序；${K.tip}</div><div id="catL" class="noSel">${K.list().map(c => `<div class="catRow" data-id="${c.id}" style="--c:${c.color}"><span class="grip"></span><span class="ico">${esc(c.icon)}</span><b class="grow">${esc(c.name)} <span class="small muted" style="font-weight:600">${K.count(c.id)} ${K.unit}</span></b><button class="btn sm" data-a="edit">✎ 編輯</button></div>`).join('') || '<div class="empty">還沒有分類</div>'}</div>`;
    sortable($('#catL', sh.body), {item: '.catRow', handle: '.grip', scroller: sh.body, onSort(from, to) { moveItem(K.list(), from, to); K.save(); K.after(); render(); }}); };
  render();
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-a="edit"]'); if (b) editCat(K.list().find(c => c.id === b.closest('.catRow').dataset.id), render, kind); });
  sh.foot.onclick = () => editCat(null, render, kind);
}
function editCat(cat, done, kind) {
  const K = CK[kind === 'recipe' ? 'recipe' : 'place'], L = K.list();
  const isNew = !cat, d = cat ? Object.assign({}, cat) : {id: '', name: '', icon: '🍴', color: CAT_COLORS.find(c => !L.some(x => x.color.toLowerCase() === c.toLowerCase())) || CAT_COLORS[0]};
  const sh = sheet({title: isNew ? '新增分類' : '編輯分類', full: true, foot: `${isNew ? '' : '<button class="btn danger" data-a="del" style="flex:0 0 auto">刪除</button>'}<button class="btn pri" data-a="ok">${isNew ? '新增' : '儲存'}</button>`});
  sh.body.innerHTML = `<div class="row" style="justify-content:center;margin:.3rem 0 1.4rem;height:3.2rem">${K.flag ? '<div style="position:relative;width:3rem;height:3rem"><div class="pin" id="cPrev" style="position:absolute;left:.6rem;bottom:.2rem"><div class="base"></div><div class="pole"></div><div class="knob"></div><div class="flag"></div></div></div>' : ''}<span class="chip on" id="cChip"></span></div>
    <div class="field"><label>分類名稱</label><input id="cN" value="${esc(d.name)}" placeholder="${K.ph}" maxlength="12"></div>
    <div class="field"><label>圖示</label><div class="emoGrid" id="cE">${CAT_EMOJI.map(x => `<button data-e="${x}">${x}</button>`).join('')}</div><div class="row" style="margin-top:.5rem"><span class="small muted" style="white-space:nowrap">或自己輸入：</span><input id="cI" value="${esc(d.icon)}" maxlength="4" style="width:5rem;text-align:center;font-size:1.2rem"></div></div>
    <div class="field"><label>${K.color}</label><div class="swGrid" id="cS">${CAT_COLORS.map(c => `<button class="sw" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('')}<label class="sw" style="--c:conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red);background:var(--c)" title="自訂顏色"><input type="color" id="cC" value="${/^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#a2613a'}"></label></div></div>`;
  const upd = () => { if (K.flag) { $('#cPrev', sh.body).style.setProperty('--c', d.color); $('#cPrev .flag', sh.body).textContent = d.icon; } const ch = $('#cChip', sh.body); ch.style.setProperty('--c', d.color); ch.textContent = d.icon + ' ' + (d.name || '分類名稱');
    $$('#cE button', sh.body).forEach(b => b.classList.toggle('on', b.dataset.e === d.icon)); $$('#cS .sw[data-c]', sh.body).forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === d.color.toLowerCase())); };
  upd();
  $('#cN', sh.body).oninput = e => { d.name = e.target.value.trim(); upd(); }; $('#cI', sh.body).oninput = e => { d.icon = e.target.value.trim() || '🍴'; upd(); }; $('#cC', sh.body).oninput = e => { d.color = e.target.value; upd(); };
  $('#cE', sh.body).onclick = e => { const b = e.target.closest('button'); if (!b) return; d.icon = b.dataset.e; $('#cI', sh.body).value = d.icon; upd(); };
  $('#cS', sh.body).onclick = e => { const b = e.target.closest('.sw[data-c]'); if (!b) return; d.color = b.dataset.c; upd(); };
  sh.foot.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'del') { const n = K.count(cat.id); if (!await ask(`確定要刪除分類「${cat.name}」嗎？${n ? `\n裡面的 ${n} ${K.unit}不會被刪除，會移到「未分類」。` : ''}`, '刪除', true)) return;
      K.drop(cat.id); L.splice(L.indexOf(cat), 1); await K.save(); sh.close(); K.after(); done && done(null); return; }
    if (!d.name) { toast('請輸入分類名稱'); $('#cN', sh.body).focus(); return; }
    let out; if (isNew) { d.id = K.pre + uid(); L.push(d); out = d; } else { Object.assign(cat, d); out = cat; } await K.save(); sh.close(); K.after(); done && done(out); });
}

/* ---------- 收藏分類頁 ---------- */
function renderFav() {
  const q = $('#favQ').value.trim().toLowerCase(), box = $('#favList');
  const hit = p => !q || (p.name + ' ' + (p.addr || '') + ' ' + (p.note || '') + ' ' + (p.menu || []).map(r => r.n).join(' ')).toLowerCase().includes(q);
  const secs = DB.cats.map(c => ({c, srt: true})); if (placesIn('').length) secs.push({c: UNCAT, srt: false});
  const html = secs.map(({c, srt}) => { const all = placesIn(c.id), ps = all.filter(hit); if (q && !ps.length) return '';
    return `<div class="sec ${S.fold[c.id] && !q ? 'fold' : ''}" data-cat="${c.id}" ${srt && !q ? 'data-srt' : ''} style="--c:${c.color}"><div class="secHead">${srt && !q ? '<span class="grip secGrip"></span>' : ''}<span class="ico">${esc(c.icon)}</span><b class="grow" data-a="fold">${esc(c.name)} <span class="cnt">${ps.length} 間</span></b><button class="ic chev" data-a="fold" aria-label="收合">▾</button></div>
      <div class="secList">${ps.map(p => { const st = stateHtml(p), n = (p.menu || []).length, ni = imgCount(p);
        return `<div class="pl" data-id="${p.id}"><div class="grow" data-a="open"><b>${esc(p.name)}</b>${st ? `<div class="meta">${st}</div>` : ''}<div class="meta">${esc(p.addr || '')}</div>${n || ni || p.phone ? `<div class="meta">${n ? '<span>📋 ' + n + ' 個品項</span>' : ''}${ni ? '<span>🖼️ ' + ni + ' 張菜單</span>' : ''}${p.phone ? '<span>📞 ' + esc(p.phone) + '</span>' : ''}</div>` : ''}</div><button class="ic go" data-a="nav" aria-label="導航">🧭</button><button class="ic go" data-a="map" aria-label="在地圖上看">📍</button>${q ? '' : '<span class="grip plGrip"></span>'}</div>`; }).join('') || '<div class="secEmpty">這個分類還沒有收藏的店家</div>'}</div></div>`; }).join('');
  box.innerHTML = html || `<div class="empty"><span class="big">🚩</span>${q ? '找不到符合的收藏' : '還沒有任何收藏<br><span class="small">到「地圖」頁搜尋店家，或長按地圖插旗收藏</span>'}</div>`;
  foldBtn('fav');
}
function initFav() {
  const box = $('#favList'); $('#favQ').addEventListener('input', debounce(renderFav, 150)); $('#favCats').onclick = () => openCats('place'); $('#favFold').onclick = () => foldAll('fav');
  box.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
    if (a === 'fold') { const s = b.closest('.sec'), id = s.dataset.cat; S.fold[id] = !S.fold[id]; saveS(); s.classList.toggle('fold', !!S.fold[id]); foldBtn('fav'); return; }
    const p = DB.places.find(x => x.id === b.closest('.pl').dataset.id); if (!p) return; if (a === 'open') openPlace(p.id); else if (a === 'nav') navTo(p); else if (a === 'map') selectPlace(p.id, true); });
  sortable(box, {item: '.sec[data-srt]', start: '.secHead', scroller: '.pgBody', onSort(from, to) { moveItem(DB.cats, from, to); saveCats(); refreshAll(); }});
  sortable(box, {item: '.pl', handle: '.plGrip', scope: '.sec', scroller: '.pgBody', onSort(from, to, sec) { if ($('#favQ').value.trim()) return; const cat = sec.dataset.cat, ids = placesIn(cat).map(p => p.id); moveItem(ids, from, to);
    const idx = []; DB.places.forEach((p, i) => { if (ids.includes(p.id)) idx.push(i); }); const by = new Map(DB.places.map(p => [p.id, p])); idx.forEach((i, k) => { DB.places[i] = by.get(ids[k]); });
    DB.places.forEach((p, i) => { if (p.ord !== i) { p.ord = i; savePlace(p); } }); renderFav(); }});
}
function updCounts() { $('#favSub').textContent = `共 ${DB.places.length} 間收藏 · ${DB.cats.length} 個分類`; $('#recSub').textContent = `共 ${DB.recipes.length} 道食譜`; }
