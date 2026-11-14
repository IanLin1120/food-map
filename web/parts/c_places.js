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

/* 菜單辨識：用精簡的「分類|品名|價格」一行一項輸出，比 JSON 少很多字，速度快很多 */
const MENU_PROMPT = `你是台灣餐飲店的菜單辨識助手。請把這張菜單照片上「所有」可以點的餐點逐項列出。
輸出格式：每行一個品項，用半形直線 | 分成三欄：分類|品名|價格
規則：
1. 分類＝菜單上的區塊標題（例如 漢堡、吐司、蛋餅、中式餐點、麵類、飯類、湯品、小菜、飲料、套餐）；沒有標題就寫「其他」。
2. 價格只寫阿拉伯數字（不要 $ 或「元」）；看不清楚就留空，但品項仍要列出。
3. 同一個品項有好幾個價格欄（例如 L/XL、中/大、小碗/大碗、薄片/厚片、一般量/加大、原味/辣味），每個價格各寫一行，品名後面用括號註明欄名，例如：飲料|紅茶 (L)|25 與 飲料|紅茶 (XL)|30。
4. 表格是「口味 × 種類」的對照表時（例如每一列是 起司、火腿、鮪魚，每一欄是 吐司、漢堡、蛋餅），每一格各寫一行：分類寫欄名，品名寫「列名＋欄名」，例如：吐司|起司吐司|30、漢堡|起司漢堡|35。
5. 套餐把內容寫在品名，例如：套餐|1 原味蛋餅＋蘿蔔糕(2片)|55。
6. 加價選項（例如 加蛋+10、加起司+10、飯換菜+10、大份+10）寫成：加價|加蛋|10。
7. 不要列出：店名、電話、地址、營業時間、公休日、外帶/內用、桌號、數量欄、勾選框、合計欄。
8. 依照菜單由左到右、由上到下的順序，不可遺漏，也不可以自己編造。文字照抄菜單原文（繁體中文）。
9. 只輸出品項行，不要標題列、不要編號、不要說明文字、不要 markdown。`;
function parseMenu(t) {
  const out = []; String(t || '').split(/\r?\n/).forEach(l => { l = l.replace(/^[\s>*\-•`]+/, '').trim(); if (!l || /^```/.test(l)) return;
    const f = l.split(/\s*[|｜]\s*/); if (f.length < 2) return; let [c, n, pr] = f.length >= 3 ? [f[0], f.slice(1, f.length - 1).join(' '), f[f.length - 1]] : ['其他', f[0], f[1]];
    if (/^(分類|類別|category)$/i.test(c) && /^(品名|名稱|name)$/i.test(n)) return; n = (n || '').trim(); if (!n) return;
    out.push({c: (c || '其他').trim() || '其他', n, p: normPrice(pr)}); });
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

async function aiMenu(p, prefer) {
  if (!S.aikey) { needAiKey(); return; } if (AIJ.jobs[p.id]) { toast('這間店的 AI 工作還在進行中'); return; }
  const al = albumsOf(p)[0]; if (!al || !al.imgs.length) { toast('請先在「管理圖檔」加入菜單圖片'); return; }
  let replace = true; if ((p.menu || []).length) { replace = await ask(`目前表格已有 ${p.menu.length} 個品項。\n要用「${al.name}」這個版本的辨識結果「取代」原本的表格嗎？\n（選取消＝保留原本的，把新結果加在後面）`, '取代'); }
  const imgs = al.imgs.slice(), res = []; let fail = '', okN = 0, partial = false, models = new Set(); const t0 = Date.now(), cnt = {};
  const show = () => { const n = Object.values(cnt).reduce((a, b) => a + b, 0); AIJ.msg(p.id, `辨識中${imgs.length > 1 ? `（${okN}/${imgs.length} 張）` : ''}… 已讀到 ${n} 項`); };
  AIJ.set(p.id, {kind: 'img', msg: '準備圖片…'}); toast('已在背景開始辨識，完成後會自動帶入表格，可以先做別的事', 3000);
  let i = 0; const worker = async () => { while (i < imgs.length) { const k = i++;
    try { const b = await imgBlob(imgs[k]); if (!b) continue; cnt[k] = 0; show();
      const r = await aiRun({contents: [{role: 'user', parts: [{text: MENU_PROMPT}, await imgPart(b)]}], generationConfig: {temperature: 0, maxOutputTokens: 16384}, _hiRes: true},
        {prefer, keepPartial: true, onText: t => { cnt[k] = parseMenu(t).length; show(); }, onWait: s => AIJ.msg(p.id, `Google 限制每分鐘次數，${s} 秒後自動繼續…`), onModel: (m, n) => { if (n) AIJ.msg(p.id, `${aiShort(m)} 重試中…`); }});
      const rows = parseMenu(r.text); models.add(r.model); if (r.finish === 'MAX_TOKENS' || r.finish === 'IDLE') partial = true;
      if (!rows.length) throw Object.assign(new Error('這張圖片沒有辨識到品項（可能太模糊或不是菜單）'), {model: r.model});
      res[k] = rows; okN++; AILOG.add({kind: '菜單辨識', place: p.name, model: r.model, ms: r.ms, ok: true, n: rows.length, note: partial ? '結果可能不完整' : ''}); }
    catch (e) { fail = aiErrText(e); AILOG.add({kind: '菜單辨識', place: p.name, model: e.model || '', ms: Date.now() - t0, ok: false, err: fail + (e.raw && e.raw !== fail ? '（' + e.raw.slice(0, 160) + '）' : '')}); if (e.fatal || e.message === 'NOKEY' || (e.code === 429 && e.perDay)) { i = imgs.length; } }
    show(); } };
  await Promise.all(imgs.length > 1 ? [worker(), worker()] : [worker()]);
  const rows = res.filter(Boolean).flat(); AIJ.set(p.id, null);
  if (!DB.places.includes(p)) return;
  if (!rows.length) { menuDone(p, '❌ 菜單辨識失敗：' + (fail || '沒有辨識到任何品項')); return; }
  p.menu = replace ? rows : (p.menu || []).concat(rows); p.menuSrc = {kind: 'ai', t: Date.now(), ver: al.name, model: [...models].join('、'), partial};
  await savePlace(p);
  menuDone(p, `✅「${p.name}」辨識完成：${rows.length} 個品項，用時 ${Math.round((Date.now() - t0) / 1000)} 秒${fail ? '（有圖片失敗：' + fail + '）' : partial ? '（結果可能不完整，請核對）' : ''}`);
}

/* ---------- 上網找菜單 ----------
   1. Google 地圖上的店家相片（用 Google Maps 金鑰）：很多人會拍菜單上傳，挑出來存成新的菜單版本，再用 AI 辨識
   2. AI 網路文字搜尋：Gemini 的 Google 搜尋功能只有「已開通付費」的專案能用，免費金鑰會失敗 */
async function fetchImgBlob(url) {
  try { const r = await fetch(url, {mode: 'cors'}); if (r.ok) { const b = await r.blob(); if (b.size > 500) return b; } } catch (e) {}
  if (IS_APP && NB.fetchB64) return new Promise((res, rej) => { const id = 'b' + uid(), tm = setTimeout(() => { delete NBCB[id]; rej(new Error('下載相片逾時')); }, 45000);
    NBCB[id] = r => { clearTimeout(tm); if (!r.status) { rej(new Error('下載相片失敗')); return; } const bin = atob(r.text), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); res(new Blob([u], {type: r.mime || 'image/jpeg'})); };
    NB.fetchB64(id, url); });
  throw new Error(IS_APP ? '需要 APK v1.3.0 以上才能存入 Google 地圖相片' : '網頁版無法存入 Google 地圖相片，請在 App 裡使用');
}
window.__nbB64 = (id, ok, mime, b64) => { const f = NBCB[id]; if (f) { delete NBCB[id]; f({status: ok ? 200 : 0, text: b64 || '', mime}); } };
async function gPhotoList(p) {
  if (!p.gid) { await gFill(p); await savePlace(p); }
  const d = await jfetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.gid)}`, {headers: gHead('photos')}, 15000); gThrow(d);
  return (d.photos || []).map(x => ({name: x.name, w: x.widthPx, h: x.heightPx, by: ((x.authorAttributions || [])[0] || {}).displayName || ''}));
}
async function gPhotoUri(name, w) { const j = await jfetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true`, {headers: {'X-Goog-Api-Key': S.gkey}}, 15000); gThrow(j); if (!j.photoUri) throw new Error('Google 沒有提供這張相片'); return j.photoUri; }
function webMenu(p) {
  const sh = sheet({title: '上網找菜單 · ' + p.name, html: `<div class="setC">
    <button class="setR" data-a="gp" style="width:100%;text-align:left"><span style="font-size:1.5rem">🖼️</span><span class="t"><b>從 Google 地圖相片找菜單（推薦）</b><small>列出這家店在 Google 地圖上的相片（最多 10 張），挑出菜單照片存成新的菜單版本，再用 AI 辨識。${S.gkey ? '' : '<br>⚠️ 需要先設定 Google Maps 金鑰。'}</small></span><span class="muted">›</span></button>
    <button class="setR" data-a="web" style="width:100%;text-align:left"><span style="font-size:1.5rem">🌐</span><span class="t"><b>AI 網路文字搜尋</b><small>請 Gemini 用 Google 搜尋網頁上的菜單文字。⚠️ Google 規定這個功能只有「已開通付費」的 Gemini 專案能用，免費金鑰一定會失敗；小店家也很少把菜單打成文字放在網路上。</small></span><span class="muted">›</span></button></div>`});
  sh.body.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; sh.close(); if (b.dataset.a === 'gp') gPhotoPicker(p); else webTextMenu(p); });
}
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
  catch (e) { err = e.grounding || (e.code === 429 && e.zero) || (e.code === 400 && /search|tool/i.test(e.raw || '')) ? '免費版 Gemini 不能使用 Google 搜尋，請改用「從 Google 地圖相片找菜單」' : aiErrText(e); AILOG.add({kind: '網路文字搜尋', place: p.name, model: e.model || '', ms: Date.now() - t0, ok: false, err: err + (e.raw && e.raw !== err ? '（' + e.raw.slice(0, 160) + '）' : '')}); }
  AIJ.set(p.id, null); if (!DB.places.includes(p)) return;
  if (!res || !res.rows.length) { menuDone(p, err ? '❌ ' + err : `網路上找不到「${p.name}」的菜單文字${res && res.note ? '（' + res.note + '）' : ''}，建議改用 Google 地圖相片`); return; }
  const src = {kind: 'web', t: Date.now(), note: res.note, links: []}, apply = async rep => { p.menu = rep ? res.rows : (p.menu || []).concat(res.rows); p.menuSrc = src; await savePlace(p); menuDone(p, `✅ 已帶入網路上找到的 ${res.rows.length} 個品項`); };
  if (!(p.menu || []).length) { await apply(true); return; }
  buzz(40); dialog(`網路上找到「${p.name}」的 ${res.rows.length} 個品項`, `${esc(res.note)}<br><span class="small muted">網路資料可能不是最新，請以店家為準。</span><br><br>目前表格已有 ${p.menu.length} 個品項，要怎麼處理？`, [['取代原本的表格', () => apply(true)], ['加在原本的後面', () => apply(false)], ['不要帶入', null]]);
}

/* ---------- 菜單圖檔管理：每個版本一個資料夾（可放多張、可自訂名稱），最新的排最前面 ---------- */
function openAlbums(p, onChange) {
  const sh = sheet({title: '菜單圖檔 · ' + p.name, full: true, foot: '<button class="btn pri" data-a="new">＋ 新增版本（新菜單）</button>', onClose() { onChange && onChange(); }});
  const add = async (al) => { const fs = await pickImages(true); if (!fs.length) return false; busy('處理圖片中…'); try { for (const f of fs) al.imgs.push(await imgStore(f)); } catch (e) { toast('❌ ' + e.message); } busy(false); return true; };
  const render = async () => { const L = albumsOf(p); const th = await Promise.all(L.map(a => Promise.all(a.imgs.map(imgURL))));
    sh.body.innerHTML = `<div class="small muted" style="margin-bottom:.7rem">每次菜單改版就「新增版本」，舊菜單會保留。打開菜單圖檔時先顯示最新版本，往左滑是較舊的版本。版本名稱可以自己改（例如 2026 春季、第 3 版）。</div>` +
      (L.map((a, i) => `<div class="album" data-id="${a.id}"><div class="row"><span class="vTag" style="background:${i ? '#8a7a66' : '#5f9a5a'}">${i ? '舊' : '最新'}</span><input class="grow" data-k="name" value="${esc(a.name)}" maxlength="24" aria-label="版本名稱"><button class="ic" data-a="del" style="color:var(--danger)" aria-label="刪除這個版本">🗑</button></div>
        <div class="small muted" style="margin:.25rem 0 .4rem">建立於 ${dateName(a.t)} · ${a.imgs.length} 張</div>
        <div class="thumbs">${a.imgs.map((im, k) => `<div class="th"><img src="${th[i][k]}" data-a="view" data-i="${k}" alt=""><button class="rm" data-a="rm" data-i="${k}" aria-label="移除">✕</button></div>`).join('')}<button class="th addTh" data-a="add">＋<small>加圖片</small></button></div></div>`).join('') || '<div class="empty"><span class="big">🖼️</span>還沒有菜單圖片<br><span class="small">按下方「新增版本」從相簿選擇或拍照</span></div>'); };
  render();
  sh.body.addEventListener('change', e => { const t = e.target; if (t.dataset.k !== 'name') return; const a = p.albums.find(x => x.id === t.closest('.album').dataset.id); if (a) { a.name = t.value.trim() || dateName(a.t); savePlace(p); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = p.albums.find(x => x.id === b.closest('.album').dataset.id), i = +b.dataset.i; if (!a) return;
    if (b.dataset.a === 'add') { if (await add(a)) { await savePlace(p); render(); } }
    else if (b.dataset.a === 'view') Viewer.open(a.imgs.map((id, k) => ({id, label: a.name + ' · 第 ' + (k + 1) + ' 張'})), i, p.name);
    else if (b.dataset.a === 'rm') { if (!await ask('要移除這張圖片嗎？', '移除', true)) return; const [im] = a.imgs.splice(i, 1); await imgDel(im); await savePlace(p); render(); }
    else if (b.dataset.a === 'del') { if (!await ask(`確定要刪除版本「${a.name}」和裡面的 ${a.imgs.length} 張圖片嗎？`, '刪除', true)) return; for (const im of a.imgs) await imgDel(im); p.albums.splice(p.albums.indexOf(a), 1); await savePlace(p); render(); } });
  sh.foot.onclick = async () => { const n = (p.albums || []).length + 1, a = {id: 'a' + uid(), name: dateName() + ((p.albums || []).some(x => x.name === dateName()) ? ' #' + n : ''), t: Date.now(), imgs: []}; if (!await add(a) || !a.imgs.length) return; p.albums = p.albums || []; p.albums.push(a); await savePlace(p); await render();
    if (S.aikey && !AIJ.jobs[p.id] && await ask('新版本已加入。\n要用 AI 把這個版本辨識成表格嗎？（在背景執行）', '開始辨識')) aiMenu(p); };
  if (!(p.albums || []).length) setTimeout(() => sh.foot.onclick(), 350);
}
function openMenuImgs(p) { const items = []; albumsOf(p).forEach((a, i) => a.imgs.forEach((id, k) => items.push({id, label: (i ? '舊版本：' : '最新版本：') + a.name + (a.imgs.length > 1 ? ' · 第 ' + (k + 1) + '/' + a.imgs.length + ' 張' : '')}))); if (!items.length) { toast('還沒有菜單圖片'); return; } Viewer.open(items, 0, p.name); }

/* ---------- 收藏地點：明細 ---------- */
function openPlace(id, toMenu) {
  const p = DB.places.find(x => x.id === id); if (!p) return; let editT = false, mq = '', mc = '';
  const onJob = e => { if (e.detail === p.id && !editT) render(); };
  const sh = sheet({title: p.name, full: true, onClose() { document.removeEventListener('fm:job', onJob); }}); sh.tools.innerHTML = '<button class="btn sm" data-a="edit">✎ 編輯</button>';
  document.addEventListener('fm:job', onJob);
  sh.tools.onclick = () => editPlace(p, false, del => { if (del) sh.close(); else render(); });
  const save = debounce(() => savePlace(p), 400);
  const cats = () => { const s = []; (p.menu || []).forEach(r => { if (!s.includes(r.c)) s.push(r.c); }); return s; };
  function rowsHtml() { const q = mq.trim().toLowerCase(), list = (p.menu || []).filter(r => (!mc || r.c === mc) && (!q || (r.c + ' ' + r.n).toLowerCase().includes(q))); let last = null;
    return list.map(r => { const g = r.c !== last; last = r.c; return `<tr class="${g ? 'g' : ''}"><td class="c">${g ? esc(r.c) : ''}</td><td>${esc(r.n)}</td><td class="p">${r.p !== '' && !isNaN(+r.p) ? '$' + esc(r.p) : esc(r.p)}</td></tr>`; }).join('') || '<tr><td colspan="3" class="muted" style="text-align:center">找不到符合的品項</td></tr>'; }
  function tableHtml() {
    const rows = p.menu || []; if (!rows.length && !editT) return `<div class="empty" style="padding:1.2rem"><span class="muted">還沒有菜單表格。<br>可以用菜單照片「✨ AI 辨識」、「🌐 上網找菜單」，或手動建立。</span><div style="margin-top:.7rem"><button class="btn sm" data-a="tEdit">✎ 手動建立表格</button></div></div>`;
    if (editT) return `<table class="mtable"><thead><tr><th style="width:26%">品項</th><th>品名</th><th style="width:22%" class="p">價格</th><th></th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><input data-i="${i}" data-k="c" value="${esc(r.c)}"></td><td><input data-i="${i}" data-k="n" value="${esc(r.n)}"></td><td><input data-i="${i}" data-k="p" value="${esc(r.p)}" inputmode="decimal" style="text-align:right"></td><td class="x"><button class="ic" data-a="tDel" data-i="${i}" style="color:var(--danger);width:2rem;height:2rem">✕</button></td></tr>`).join('')}</tbody></table>
      <div class="row wrap" style="margin-top:.6rem"><button class="btn sm" data-a="tAdd">＋ 新增一列</button><button class="btn sm danger" data-a="tClear">清空表格</button><span class="grow"></span><button class="btn sm pri" data-a="tEdit">完成</button></div>`;
    const cs = cats(); if (mc && !cs.includes(mc)) mc = ''; const src = p.menuSrc;
    return `<div class="mcats noSel"><button class="chip ${mc ? '' : 'on'}" data-a="mc" data-c="">全部 <span class="n">${rows.length}</span></button>${cs.map(c => `<button class="chip ${mc === c ? 'on' : ''}" data-a="mc" data-c="${esc(c)}">${esc(c)} <span class="n">${rows.filter(r => r.c === c).length}</span></button>`).join('')}</div>
      <div class="row" style="margin-bottom:.55rem"><div class="searchBox grow"><input id="mq" type="search" placeholder="搜尋品名…" value="${esc(mq)}"></div><button class="btn sm" data-a="tEdit">✎ 編輯表格</button></div>
      <table class="mtable"><thead><tr><th>品項</th><th>品名</th><th class="p">價格</th></tr></thead><tbody id="mtb">${rowsHtml()}</tbody></table>
      ${src && src.kind === 'web' ? `<div class="callout warn small" style="margin-top:.6rem">🌐 這份表格是 ${dateName(src.t)} 從網路搜尋整理的，可能不是最新，請以店家為準。${src.note ? '<br>' + esc(src.note) : ''}${(src.links || []).length ? '<br>來源：' + src.links.map((l, i) => `<a href="#" data-a="lnk" data-i="${i}">${esc(l.title || '連結 ' + (i + 1))}</a>`).join('、') : ''}</div>` : src && src.kind === 'ai' ? `<div class="small muted" style="margin-top:.5rem">✨ 由菜單圖檔「${esc(src.ver || '')}」辨識（${dateName(src.t)}${src.model ? '・' + esc(aiShort(src.model.split('、')[0])) : ''}），請核對價格是否正確。${src.partial ? '<br>⚠️ 這次結果可能不完整。' : ''}${src.model && /lite/.test(src.model) ? '<br><button class="btn sm" data-a="aiF" style="margin-top:.4rem">用較準的 Flash 重新辨識（每天約 20 次）</button>' : ''}</div>` : ''}`;
  }
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
  sh.body.addEventListener('input', e => { const t = e.target; if (t.id === 'mq') { mq = t.value; $('#mtb', sh.body).innerHTML = rowsHtml(); return; }
    if (t.dataset.k) { p.menu[+t.dataset.i][t.dataset.k] = t.value; save(); } });
  sh.body.addEventListener('click', async e => { const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, i = +b.dataset.i;
    if (a === 'nav') navTo(p); else if (a === 'gm') openUrl(gmUrl(p)); else if (a === 'tel') openUrl('tel:' + p.phone.replace(/[^\d+]/g, '')); else if (a === 'web') openUrl(p.web);
    else if (a === 'show') { while (sheets.length) sheets[sheets.length - 1].close(); selectPlace(p.id, true); }
    else if (a === 'copyAddr') { if (p.addr) copyText(p.addr); }
    else if (a === 'lnk') { e.preventDefault(); const l = (p.menuSrc.links || [])[i]; if (l) openUrl(l.uri); }
    else if (a === 'gfill') { busy('向 Google 更新資訊…'); try { await gFill(p); await savePlace(p); refreshAll(); toast('已更新營業時間等資訊'); } catch (er) { toast('❌ ' + er.message, 4000); } busy(false); render(); }
    else if (a === 'imgs') openMenuImgs(p); else if (a === 'albums') openAlbums(p, () => { render(); refreshAll(); });
    else if (a === 'ai') aiMenu(p); else if (a === 'aiF') aiMenu(p, 'flash'); else if (a === 'webm') webMenu(p);
    else if (a === 'mc') { mc = b.dataset.c; $('#mtWrap', sh.body).innerHTML = tableHtml(); }
    else if (a === 'tEdit') { editT = !editT; p.menu = (p.menu || []).filter(r => (r.c + r.n + r.p).trim()); if (editT && !p.menu.length) p.menu.push({c: '', n: '', p: ''}); await savePlace(p); render(); refreshAll(); }
    else if (a === 'tAdd') { const l = p.menu[p.menu.length - 1]; p.menu.push({c: l ? l.c : '', n: '', p: ''}); $('#mtWrap', sh.body).innerHTML = tableHtml(); const ins = $$('#mtWrap input[data-k="n"]', sh.body); ins[ins.length - 1].focus(); }
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
