/* ============================================================
   使用說明：真實畫面截圖（虛構資料）＋操作動畫
   ============================================================ */
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="54 54 324 324"><defs> <linearGradient id="gicv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0844B"/><stop offset=".55" stop-color="#C2633A"/><stop offset="1" stop-color="#9A4226"/></linearGradient> <linearGradient id="gisp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7E321C"/><stop offset="1" stop-color="#9C4527"/></linearGradient> <linearGradient id="gipl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF9EC"/><stop offset="1" stop-color="#F2E2C2"/></linearGradient> <linearGradient id="gicn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7D27A"/><stop offset="1" stop-color="#DB9A33"/></linearGradient> <radialGradient id="gigl" cx=".35" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient> <filter id="gish" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#5A2410" flood-opacity=".35"/></filter></defs><rect width="432" height="432" fill="url(#gicv)"/> <g opacity=".10" stroke="#FFF3DC" stroke-width="10" fill="none"><path d="M-10 120 L442 70"/><path d="M-10 350 L442 380"/><path d="M330 -10 L360 442"/></g> <rect x="0" y="0" width="112" height="432" fill="url(#gisp)"/><rect x="112" y="0" width="7" height="432" fill="#6E2A16" opacity=".45"/> <g stroke="#F4D9B6" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 14" opacity=".75"><path d="M96 -6 V440"/></g> <path d="M286 0 h44 v150 l-22 -20 l-22 20z" fill="#7C8B4E"/><path d="M286 0 h44 v8 h-44z" fill="#5F6C39"/> <rect width="432" height="432" fill="url(#gigl)"/><g filter="url(#gish)"><circle cx="222" cy="210" r="102" fill="url(#gipl)"/><circle cx="222" cy="210" r="84" fill="none" stroke="#E4CDA4" stroke-width="4"/> <g fill="#A3482A"><path d="M178 150 h9 v46 h7 v-46 h9 v46 h7 v-46 h9 v55 a21 21 0 0 1 -16 20 v66 a8 8 0 0 1 -16 0 v-66 a21 21 0 0 1 -16 -20z"/> <ellipse cx="262" cy="182" rx="21" ry="31"/><rect x="254" y="206" width="16" height="85" rx="8"/></g></g> <g filter="url(#gish)"><circle cx="296" cy="290" r="40" fill="url(#gicn)" stroke="#FFF1CF" stroke-width="6"/><circle cx="296" cy="290" r="28" fill="none" stroke="#B5741C" stroke-width="3" opacity=".55"/> <text x="296" y="305" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="700" font-size="40" fill="#8A5310">$</text></g></svg>';
/* ---------- 示意圖：真實畫面截圖（虛構資料）＋手指點擊動畫 ----------
   截圖放在 guide.json（APK 內建一份，GitHub 上也有一份），第一次打開說明時讀進來並存在手機裡 */
const GUIDE_V = '__GV__', GUIDE_META = __GMETA__;
const GImg = {d: null, p: null,
  async load() { if (this.d) return this.d; if (this.p) return this.p;
    this.p = (async () => { let old = null; try { old = await IDB.get('kv', 'guideImg'); } catch (e) {} if (old && old.v === GUIDE_V) return (this.d = old.img);
      for (const u of ['guide.json?v=' + GUIDE_V, GH.pages + 'guide.json?v=' + GUIDE_V]) { try { const r = await fetch(u, {cache: 'no-store'}); if (!r.ok) continue; const j = await r.json(); if (j && j.img) { if (j.v === GUIDE_V || !old) { try { await IDB.put('kv', 'guideImg', j); } catch (e) {} } if (j.v === GUIDE_V) return (this.d = j.img); old = old || j; } } catch (e) {} }
      if (old) return (this.d = old.img); this.p = null; return null; })();
    return this.p; }};
/* 一組畫面：[[圖片id, 點擊位置 x%, y%], …]；有點擊位置的那張會播放「手指移過去 → 按下 → 換下一張」 */
const gShot = (...F) => `<div class="gPh" data-f='${JSON.stringify(F)}'><div class="gScr"><div class="gLoad">示意圖載入中…</div></div><span class="gFg"><svg viewBox="0 0 32 40"><path d="M12 3.5a3 3 0 0 1 6 0V17l7.2 1.6a3.6 3.6 0 0 1 2.8 4.1l-1.6 10A6 6 0 0 1 20.5 38h-6.3a6 6 0 0 1-4.9-2.6L3.6 27a2.8 2.8 0 0 1 4.3-3.5l4.1 3.6z" fill="#fff" stroke="#3a2c22" stroke-width="2" stroke-linejoin="round"/></svg></span><span class="gRp"></span></div>`;
const gCap = (...L) => `<ul class="gCap">${L.map(t => `<li>${t}</li>`).join('')}</ul>`;
/* 從 guide.json 的點擊位置組成畫面序列 */
const GS = (...ids) => gShot(...ids.flatMap(id => { const L = (GUIDE_META[id] || []); return L.map(f => [f.i, f.t ? f.t[0] : null, f.t ? f.t[1] : null]); }));
function guideAnim(root) { const T = []; const stop = () => T.forEach(clearTimeout);
  $$('.gPh', root).forEach(ph => { const F = JSON.parse(ph.dataset.f || '[]'), scr = $('.gScr', ph), fg = $('.gFg', ph), rp = $('.gRp', ph); if (!F.length) return;
    GImg.load().then(D => { if (!D || !document.body.contains(ph)) { $('.gLoad', ph).textContent = '示意圖要連上網路下載一次，之後離線也能看'; return; }
      scr.innerHTML = F.map(f => D[f[0]] ? `<img src="${D[f[0]]}" alt="">` : '<i class="gMiss"></i>').join(''); const im = $$('img, .gMiss', scr);
      let k = 0; const show = n => im.forEach((e, j) => e.classList.toggle('on', j === n));
      const step = () => { if (!document.body.contains(ph)) return; const f = F[k]; show(k); scr.style.transformOrigin = '50% 50%'; scr.classList.remove('zm');
        if (f[1] != null) { fg.style.transition = 'none'; fg.style.left = Math.min(92, f[1] + 18) + '%'; fg.style.top = Math.min(96, f[2] + 16) + '%'; fg.classList.remove('dn', 'on'); fg.offsetWidth;
          T.push(setTimeout(() => { fg.style.transition = ''; fg.classList.add('on'); fg.style.left = f[1] + '%'; fg.style.top = f[2] + '%'; }, 450));
          T.push(setTimeout(() => { fg.classList.add('dn'); rp.style.left = f[1] + '%'; rp.style.top = f[2] + '%'; rp.classList.remove('go'); rp.offsetWidth; rp.classList.add('go'); scr.style.transformOrigin = f[1] + '% ' + f[2] + '%'; scr.classList.add('zm'); }, 1350));
          T.push(setTimeout(() => { fg.classList.remove('dn'); }, 1650));
          T.push(setTimeout(() => { k = (k + 1) % F.length; if (k === 0) fg.classList.remove('on'); step(); }, k === F.length - 1 ? 3000 : 2100)); }
        else { fg.classList.remove('on'); T.push(setTimeout(() => { k = (k + 1) % F.length; step(); }, F.length > 1 ? 2600 : 99999)); } };
      step(); }); });
  return stop; }
const GKEYS = `<div class="gKeys"><div><i>🔑</i><b>AI 辨識金鑰（建議）</b><small>菜單照片、消費明細變成表格都靠它。免費申請，不用信用卡。</small><button class="btn sm pri" data-tut="ai">📘 看教學</button></div>
  <div><i>🗺️</i><b>Google 搜尋金鑰（選用）</b><small>搜尋店家、停車場、加油站最齊全，自動帶入地址電話。</small><button class="btn sm" data-tut="maps">📘 看教學</button></div></div>`;
const gHeroH = (t, L) => `<div class="gHero"><div class="gIcon">${APP_ICON}</div><b>${t}</b></div><div class="gGrid">${L.map(([i, b, s]) => `<div><i>${i}</i><b>${b}</b>${s}</div>`).join('')}</div>`;
const GUIDE = {
  food: {title: '🍽️ 地圖・日常・食譜 使用說明', steps: [
    {t: '歡迎使用日日帳本', h: () => gHeroH('收藏地點・菜單・點餐・分帳・記帳', [['🗺️', '地圖', '定位、找地點、收藏'], ['📋', '菜單', '照片 AI 變表格'], ['📒', '日常', '記一餐、點餐'], ['🧾', '分帳', '誰付多少'], ['🎫', '發票', '條碼、掃描'], ['💰', '記帳', '收支、資產、對帳']])},
    {t: '① 打開就定位', h: () => GS('f_home') + gCap('一打開就飛到<b>你的位置</b>、轉回朝北', '按 <b>◎</b> 重新定位，自動選好所在的鄉鎮', '下面列出這一區的收藏，依分類排好')},
    {t: '② 搜尋地點', h: () => GS('f_search') + gCap('打<b>名稱</b>，或打「停車場、加油站」這類關鍵字', '結果都標在地圖上，點一下就看得到')},
    {t: '③ 地點卡片', h: () => GS('f_card') + gCap('點地圖上的旗子 → 下方出現卡片', '<b>詳細資料</b>：營業時間、電話、導航、菜單')},
    {t: '④ 一個地點放多個分類', h: () => GS('f_cat') + gCap('<b>主要分類</b>決定旗子的顏色', '<b>也放在這些分類</b>可以複選（午餐、晚餐都會去）', '每個分類都找得到它，「全部」只算一次')},
    {t: '⑤ 菜單變成表格', h: () => GS('f_menu') + gCap('先「加入菜單圖片」', '<b>✨ Gemini 辨識</b>：免費金鑰，App 自動完成', '<b>🤖 Claude 辨識</b>：用 Claude 月租方案')},
    {t: '⑥ 用 Claude 月租辨識', h: () => GS('f_claude') + gCap('照片和指令一起<b>傳到 Claude App</b>，按送出', '複製 Claude 的回覆，回來會<b>自動貼上</b>', '按「帶入表格」')},
    {t: '⑦ 記一餐', h: () => GS('f_meal') + gCap('<b>日常 → 🍱 記一餐</b>', '選餐別 → 選店家（依分類收合）')},
    {t: '⑧ 點餐：誰吃了什麼？', h: () => GS('f_order') + gCap('上方先選<b>誰</b>，再點品項', '大小、口味直接按價格按鈕', '下方即時算出每個人的金額')},
    {t: '⑨ 匯出，貼到 LINE', h: () => GS('f_export') + gCap('選整天或單一餐、選格式', '<b>複製文字</b>貼 LINE，或存成 <b>Excel</b>')},
    {t: '⑩ 購物清單', h: () => GS('f_list') + gCap('<b>🛒 購物清單</b>：選店家、寫要買的東西', '勾一下＝買到了，移到「已買」')},
    {t: '⑪ 食譜', h: () => GS('f_rec') + gCap('在<b>設定 → 我的食譜</b>', '照片匯入可以用 AI 讀出食材和步驟', '可以「另存新檔」改成新食譜')},
    {t: '⑫ 備份與更新', h: () => GS('f_set') + gCap('<b>匯出備份</b>：全部資料、圖片、金鑰一起', '雲端、QR 換機在 <b>記帳 → 設定</b>', '有新版本會自動提醒')},
    {t: '⑬ 先設定金鑰（只要一次）', h: () => GS('f_keys') + GKEYS}]},
  shop: {title: '🧾 分帳 使用說明', steps: [
    {t: '分帳是什麼？', h: () => GS('s_disc') + gCap('一張明細，每一項是誰的', '折扣、福利扣點、運費自動平均分', '最後算出<b>每個人要付多少</b>')},
    {t: '① 上傳明細', h: () => GS('s_home') + gCap('<b>📷 上傳明細</b>：拍收據或外送截圖，AI 讀出品項', '<b>✏️ 手動輸入</b>：自己一項一項加')},
    {t: '② 修改品項', h: () => GS('s_bill') + gCap('點品項可以改名稱、單價、數量', '下面選<b>誰付</b>，選好幾個人＝平分')},
    {t: '③ 每一項是誰的？', h: () => GS('s_who') + gCap('每一列右邊點人名', '「大家一起分」一次選全部的人')},
    {t: '④ 折扣、費用、結果', h: () => GS('s_disc') + gCap('品項折扣、整單折扣、平台費都能加', '<b>✅ 和明細實付金額一致</b>就代表沒算錯')},
    {t: '⑤ 匯出', h: () => GS('s_exp') + gCap('複製文字貼 LINE，或存成 Excel', '每個人買了什麼、要付多少都列出來')},
    {t: '⑥ 先設定 AI 金鑰', h: () => GKEYS}]},
  inv: {title: '🎫 發票 使用說明', steps: [
    {t: '發票區可以做什麼？', h: () => GS('i_cal') + gCap('手機條碼、掃描紙本發票、截圖匯入', '月曆看每天有幾張發票', '一鍵拿去分帳或記帳')},
    {t: '① 我的手機條碼', h: () => GS('i_home') + gCap('點條碼放大給店員掃', '螢幕亮度會自動調到最亮')},
    {t: '② 掃描紙本發票', h: () => GS('i_scan') + gCap('<b>📷 掃描</b>左邊的 QR Code', '品項、金額、店家自動帶入')},
    {t: '③ 截圖匯入', h: () => GS('i_shot') + gCap('<b>🖼️ 截圖</b>：發票 App 的明細截圖', 'AI 讀出發票號碼和品項')},
    {t: '④ 協助工具', h: () => GS('i_acc') + gCap('<b>🤖 協助工具</b>：直接讀取發票 App 畫面', '第一次要到手機設定開啟權限')},
    {t: '⑤ 修改發票明細', h: () => GS('i_edit') + gCap('點任何欄位或品項就能修改', '可以設定購物方式、加折扣')},
    {t: '⑥ 拿去分帳', h: () => GS('i_bill') + gCap('<b>拿去分帳</b>：品項直接變成分帳明細', '再選每一項是誰的就好')}]},
  acc: {title: '💰 記帳 使用說明', steps: [
    {t: '記帳區可以做什麼？', h: () => gHeroH('收支・資產・分帳欠款・對帳', [['📒', '記帳', '月曆、記一筆、常用'], ['🏛️', '資產', '每個帳戶剩多少'], ['📊', '分析', '圖表、匯出報告'], ['🗺️', '地圖', '在哪裡花的錢'], ['🤝', '對帳', '誰欠誰、結清'], ['⚙️', '設定', '上鎖、備份']]) + gCap('從 <b>設定 → 記帳・對帳</b> 進入', '記帳的 <b>設定 → 回到日日帳本</b> 切回來')},
    {t: '① 記一筆', h: () => GS('a_home', 'a_new') + gCap('按 <b>＋ 記一筆</b>', '計算機輸入金額，可以 + − × ÷', '選類別、付款帳戶就能儲存')},
    {t: '② 分帳：誰付的、誰要分', h: () => GS('a_split') + gCap('<b>誰付的錢</b>選一個人', '<b>誰要分</b>點選，平均分或自己填金額', '自動算出誰欠誰')},
    {t: '③ 常用紀錄', h: () => GS('a_tpl') + gCap('每月房租、停車費存成常用', '點一下就帶好內容，確認後儲存', '金額可以不填，用的時候再輸入')},
    {t: '④ 欠款和對帳', h: () => GS('a_owe') + gCap('首頁列出<b>還沒結清的欠款</b>', '按<b>對帳</b> → 勾選要結清的幾筆 → 結清', '「歷史」看已完成的對帳')},
    {t: '⑤ 資產', h: () => GS('a_asset') + gCap('每個帳戶的餘額自動計算', '右上角可以隱藏金額', '按住拖曳可以排序')},
    {t: '⑥ 消費分析與報告', h: () => GS('a_stat') + gCap('日／週／月／半年／年切換', '必要、非必要分類佔比圓餅圖', '<b>📤 匯出報告</b>：PDF、圖片、Excel')},
    {t: '⑦ 地點地圖', h: () => GS('a_map') + gCap('在哪裡花的錢都標在地圖上', '上方搜尋停車場、加油站，一鍵收藏', '下方依分類列出，可以篩選鄉鎮')},
    {t: '⑧ 商家資料', h: () => GS('a_store') + gCap('點商家看地址和每一筆記帳', '可以改名稱、更改位置')},
    {t: '⑨ 分帳的人', h: () => GS('a_ppl') + gCap('新增、改名、換圖示、拖曳排序', '設定頁可以把兩個綽號設成<b>同一個人</b>')},
    {t: '⑩ 上鎖、防止誤刪', h: () => GS('a_cfg') + gCap('<b>設定密碼</b>：可以用指紋解鎖', '<b>防止誤刪 App</b>：不能直接解除安裝', '最可靠的還是定期備份')},
    {t: '⑪ 小工具、通知欄', h: () => `<div class="gWid"><div class="gWidC"><b>📒 日日帳本　11月</b><small>本月支出 $8,420・收入 $36,000</small><div class="gWidB"><span class="pri">＋ 支出</span><span>＋ 收入</span><span>⭐ 常用</span></div></div><div class="gWidC n"><b>🔔 日日帳本・快速記帳</b><small>今天 $185</small></div></div>` + gCap('<b>桌面小工具</b>：長按桌面 → 小工具 → 日日帳本', '<b>通知欄</b>：記帳 → 設定 → 快速記帳', '<b>控制中心</b>：把「記一筆」拖進快速設定')}]}
};
function openGuide(kind) {
  const G = GUIDE[kind]; let i = 0, dir = 1, stop = () => {}; buzz(10);
  const sh = sheet({title: G.title, full: true, foot: '<button class="btn" data-a="prev">‹ 上一步</button><button class="btn pri" data-a="next">下一步 ›</button>', onClose() { stop(); }});
  const render = () => { stop(); const s = G.steps[i], last = i === G.steps.length - 1;
    sh.body.innerHTML = `<div class="tut gd ${dir < 0 ? 'back' : 'fwd'}"><div class="tutDots">${G.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}" data-k="${k}"></i>`).join('')}</div><div class="tutStep">${i + 1} / ${G.steps.length}</div><h2>${s.t}</h2>${typeof s.h === 'function' ? s.h() : s.h}</div>`;
    stop = guideAnim(sh.body); sh.body.scrollTop = 0; $('[data-a="prev"]', sh.foot).disabled = i === 0; $('[data-a="next"]', sh.foot).textContent = last ? '完成 ✓' : '下一步 ›'; };
  render(); GImg.load();
  sh.foot.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(8); if (b.dataset.a === 'prev') { if (i > 0) i--; dir = -1; render(); } else if (i < G.steps.length - 1) { i++; dir = 1; render(); } else sh.close(); });
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-tut],[data-k]'); if (!t) return; if (t.dataset.tut) openTutorial(t.dataset.tut); else { const k = +t.dataset.k; dir = k < i ? -1 : 1; i = k; buzz(8); render(); } });
  let x0 = null; sh.body.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true});
  sh.body.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) < 60) return; if (dx < 0 && i < G.steps.length - 1) i++; else if (dx > 0 && i > 0) i--; else return; buzz(8); render(); }, {passive: true});
}
