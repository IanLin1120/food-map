/* ============================================================
   使用說明：給第一次用的人看的圖解（手機畫面示意圖＋白話說明）
   ============================================================ */
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs> <linearGradient id="gibg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7EDDA"/><stop offset="1" stop-color="#EAD6B0"/></linearGradient> <linearGradient id="gicv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9773F"/><stop offset="1" stop-color="#A3482A"/></linearGradient> <linearGradient id="gisp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8E3B22"/><stop offset="1" stop-color="#A9502E"/></linearGradient> <linearGradient id="gicn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4C766"/><stop offset="1" stop-color="#DE9E36"/></linearGradient> <filter id="gish" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#6B3A1E" flood-opacity=".28"/></filter></defs><clipPath id="gir"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#gir)"><rect width="512" height="512" fill="url(#gibg)"/><g stroke="#FFF8EA" stroke-width="30" fill="none" stroke-linecap="round" opacity=".9"><path d="M-20 150 L540 90"/><path d="M-20 400 L540 440"/><path d="M90 -20 L60 540"/><path d="M440 -20 L470 540"/></g><path d="M300 0 L520 0 L520 70 L290 100Z" fill="#D9DDB0" opacity=".55"/><g transform="translate(0,8)"><g filter="url(#gish)"> <rect x="150" y="104" width="250" height="324" rx="26" fill="#FFF8EA"/> <rect x="150" y="104" width="250" height="324" rx="26" fill="none" stroke="#E2CDA6" stroke-width="3"/> <path d="M384 120 v292" stroke="#E7D5B2" stroke-width="3"/><path d="M372 116 v300" stroke="#EADCBF" stroke-width="3"/> <rect x="118" y="88" width="256" height="336" rx="30" fill="url(#gicv)"/> <path d="M148 88 h18 v336 h-18 a30 30 0 0 1 -30 -30 v-276 a30 30 0 0 1 30 -30z" fill="url(#gisp)"/> <rect x="166" y="88" width="5" height="336" fill="#7E321C" opacity=".35"/> <path d="M318 74 h34 v118 l-17 -16 l-17 16z" fill="#7C8B4E"/> <circle cx="262" cy="236" r="84" fill="#FFF8EA"/> <g fill="#9E4626"><path d="M224 186 h8 v40 h6 v-40 h8 v40 h6 v-40 h8 v48 a18 18 0 0 1 -14 17 v62 a7 7 0 0 1 -14 0 v-62 a18 18 0 0 1 -14 -17z"/> <ellipse cx="298" cy="214" rx="19" ry="28"/><rect x="291" y="236" width="14" height="78" rx="7"/></g> <rect x="190" y="346" width="120" height="12" rx="6" fill="#FFF8EA" opacity=".85"/><rect x="190" y="372" width="84" height="12" rx="6" fill="#FFF8EA" opacity=".6"/> <circle cx="340" cy="362" r="44" fill="url(#gicn)" stroke="#FFF3D6" stroke-width="6"/><circle cx="340" cy="362" r="31" fill="none" stroke="#B9791F" stroke-width="3" opacity=".6"/> <text x="340" y="378" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="700" font-size="44" fill="#8A5310">$</text></g></g></g></svg>';
const PHT = {food: [['🗺️', '地圖'], ['🔖', '收藏'], ['🍱', '點餐'], ['📖', '食譜'], ['⚙️', '設定']], shop: [['🗺️', '地圖'], ['🔖', '店家'], ['🧾', '分帳'], ['⚙️', '設定']]};
/* 一支小手機：title 標題、body 內容、tab 亮起哪一個分頁、area 美食或購物 */
const phone = (title, body, tab, area) => `<div class="ph"><div class="phIn"><div class="phNotch"></div><div class="phTop">${title}</div><div class="phBd">${body}</div>
  <div class="phTab">${PHT[area || 'food'].map(([i, t]) => `<span class="${t === tab ? 'on' : ''}"><i>${i}</i>${t}</span>`).join('')}</div></div></div>`;
const tap = '<span class="phTap">👆</span>';
const pc = (h, cls) => `<div class="pc ${cls || ''}">${h}</div>`, pb = (t, cls) => `<span class="pb ${cls || ''}">${t}</span>`;
const pRow = (a, b, cls) => `<div class="pr ${cls || ''}"><span>${a}</span><b>${b}</b></div>`;
const tip = t => `<div class="gTip">💡 ${t}</div>`;
const GUIDE = {
  food: {title: '🍽️ 美食點餐 使用說明', steps: [
    {t: '歡迎使用食光帳本', h: `<div class="gHero"><div class="gIcon">${APP_ICON}</div><b>收藏愛店 × 菜單 × 點餐分帳 × 購物分帳</b></div>
      <div class="gGrid"><div><i>🗺️</i><b>地圖</b>找店、插旗收藏</div><div><i>🔖</i><b>收藏</b>店家資料和菜單</div><div><i>🍱</i><b>點餐</b>誰吃什麼、各付多少</div><div><i>📖</i><b>食譜</b>記錄拿手菜</div></div>
      <p>跟著這份說明走一遍，大約 2 分鐘。看完可以隨時到 <b>設定 → 使用說明</b> 再打開。</p>`},
    {t: '① 找到店家，按收藏', h: phone('🔍 搜尋店家', `<div class="pin">🔍 晨曦早午餐</div><div class="pMap"><span class="flag">🚩</span><span class="flag f2">🚩</span></div>${pc(`<b>晨曦早午餐 幸福店</b><small>早午餐・距離 350 公尺</small><div class="pBtns">${pb('導航')}${pb('⭐ 收藏', 'pri hl') + tap}</div>`)}`, '地圖') +
      `<ul><li>在地圖頁上方的搜尋框輸入店名</li><li>點選搜尋結果，按 <b>⭐ 收藏</b>，選一個分類（早餐、飲料…）</li><li>也可以<b>長按地圖</b>任何地方直接插旗</li></ul>${tip('有填 Google 金鑰的話，地址、電話、營業時間會自動帶入。')}`},
    {t: '② 拍菜單，AI 自動整理成表格', h: phone('晨曦早午餐 幸福店', `${pc('<b>📋 菜單</b><div class="pImgs"><i>🖼️</i><i>🖼️</i></div>' + pb('✨ AI 辨識成表格', 'pri hl') + tap)}<div class="pTable"><div><b>品名</b><b>小</b><b>大</b></div><div><span>玉米濃湯</span><span>35</span><span>50</span></div><div><span>雞腿蛋堡</span><span>65</span><span>-</span></div></div>`, '收藏') +
      `<ul><li>打開收藏的店家，在「菜單」加入菜單照片</li><li>按 <b>✨ AI 辨識成表格</b>，等一下就會變成價格表</li><li>大小杯、冰熱、加購選項都會自動分欄</li></ul>${tip('菜單照片也可以在 Google 地圖截圖後，用「分享」傳給食光帳本。')}`},
    {t: '③ 點餐：選日期、新增一餐', h: phone('點餐', `<div class="pCal">${Array.from({length: 14}, (_, i) => `<i class="${i === 9 ? 'on' : ''}">${i + 10}${i === 4 || i === 9 ? '<em></em>' : ''}</i>`).join('')}</div>${pb('＋ 新增一餐', 'pri wide hl') + tap}${pc('<b>🍱 午餐・晨曦早午餐</b><small>我、媽媽　共 $230</small>')}`, '點餐') +
      `<ul><li>點月曆上的日期（有<b>紅點</b>代表那天有紀錄）</li><li>按 <b>＋ 新增一餐</b>，選餐別（早餐、午餐…）和店家</li></ul>`},
    {t: '④ 誰吃了什麼？', h: phone('午餐・晨曦早午餐', `<div class="pWho"><i class="on">🙂 我</i><i>👩 媽媽</i><i>👦 弟弟</i></div>${pc(pRow('雞腿蛋堡(辣)', '$65') + pRow('玉米濃湯(大)', '$50') + `<div class="pBtns">${pb('＋ 從菜單選', 'pri hl') + tap}${pb('👥 一起吃')}</div>`)}`, '點餐') +
      `<ul><li>先點上面的人名，再按 <b>＋ 從菜單選</b>，價格會自動帶入</li><li>菜單上沒有的，可以自己輸入品名和價格</li><li>好幾個人<b>一起吃</b>的，選 👥 一起吃，價格會平均分</li></ul>`},
    {t: '⑤ 匯出，貼到 LINE', h: phone('📤 匯出', `<div class="pSeg"><i>模板一</i><i class="on">模板二</i><i>模板三</i></div><div class="pText">2026/11/19(四)<br>午餐：晨曦早午餐<br>我：<br>雞腿蛋堡[NT$ 65]×1<br>小計：NT$ 65</div><div class="pBtns">${pb('📊 Excel')}${pb('📋 複製文字', 'pri hl') + tap}</div>`, '點餐') +
      `<ul><li>按 <b>📤 匯出</b>，選一種格式</li><li>按 <b>📋 複製文字</b>，到 LINE 長按貼上就好</li><li>要記帳的話也可以匯出 Excel</li></ul>`},
    {t: '⑥ 搜尋和設定', h: phone('點餐', `<div class="pBtns" style="justify-content:flex-end">${pb('🔍', 'hl') + tap}${pb('⚙️ 設定')}</div>${pc('<b>🏪 晨曦早午餐</b><small>11/19 午餐 $230・11/12 早餐 $95</small>')}${pc('<b>⚙️ 點餐設定</b><small>餐別、人名、自訂餐點都可以改、拖曳排序</small>')}`, '點餐') +
      `<ul><li><b>🔍</b>：輸入店名，看哪幾天吃過、吃什麼、花多少</li><li><b>⚙️ 設定</b>：新增人名（媽媽、同事…）、餐別和圖示</li></ul>`},
    {t: '⑦ 先設定金鑰（只要一次）', h: `<div class="gKeys"><div><i>🔑</i><b>AI 辨識金鑰（建議）</b><small>菜單照片、購物明細變成表格都靠它。免費申請，不用信用卡。</small><button class="btn sm pri" data-tut="ai">📘 看教學</button></div>
        <div><i>🗺️</i><b>Google 搜尋金鑰（選用）</b><small>讓搜尋店家更準，自動帶入地址電話。</small><button class="btn sm" data-tut="maps">📘 看教學</button></div></div>
      <p>不設定也能先用，之後到 <b>設定</b> 頁再補上就可以。</p>`}]},
  shop: {title: '🛒 購物分帳 使用說明', steps: [
    {t: '購物分帳是什麼？', h: `<div class="gHero"><div class="gIcon">${APP_ICON}</div><b>一張明細，自動算出每個人要付多少</b></div>
      <div class="gFlow"><span>🧾<small>拍明細</small></span><em>➜</em><span>🤖<small>AI 讀出品項</small></span><em>➜</em><span>👥<small>選誰付</small></span><em>➜</em><span>💰<small>每人金額</small></span></div>
      <p>適合全聯、量販店、超商一起買東西，或 Foodpanda 一起訂外送的時候。</p>`},
    {t: '① 切換到購物分帳', h: phone('設定', `${pc('<b>功能區</b><small>量販店、超商、Foodpanda 的購物明細…</small>' + pb('🛒 切換到購物分帳', 'pri wide hl') + tap)}${pc('<b>🔑 AI 辨識金鑰</b><small>已設定 ✅</small>')}`, '設定') +
      `<ul><li>到 <b>設定</b> 頁，第一張卡片「功能區」</li><li>按 <b>🛒 切換到購物分帳</b>，下面的分頁會換成「分帳」</li><li>想回去點餐，同一個位置按 <b>🍽️ 切換到美食點餐</b></li></ul>${tip('兩個區的地圖收藏是分開的，美食的店家不會跑到購物這邊。')}`},
    {t: '② 收藏常去的店', h: phone('🔍 搜尋', `<div class="pin">🔍 好鄰居超市</div><div class="pMap"><span class="flag">🛒</span><span class="flag f2">🏪</span></div>${pc(`<b>好鄰居超市 中央店</b><small>量販店</small><div class="pBtns">${pb('⭐ 收藏', 'pri hl') + tap}</div>`)}`, '地圖', 'shop') +
      `<ul><li>和美食區一樣，在地圖搜尋全聯、全家、金大鑫…按收藏</li><li>分類預設有量販店、超市、超商、外送，可以自己改</li></ul>${tip('Foodpanda 的餐廳也可以收藏在「外送」分類。')}`},
    {t: '③ 上傳明細，AI 幫你讀', h: phone('購物分帳', `<div class="pCal">${Array.from({length: 7}, (_, i) => `<i class="${i === 3 ? 'on' : ''}">${i + 5}</i>`).join('')}</div><div class="pBtns">${pb('📷 上傳明細（AI 辨識）', 'pri hl') + tap}${pb('✏️ 手動')}</div><div class="pImgs"><i>🧾</i><i>📱</i></div>`, '分帳', 'shop') +
      `<ul><li>按 <b>📷 上傳明細</b>，選全聯 App 交易明細的截圖、發票照片或 Foodpanda 訂單截圖</li><li>一筆明細太長，可以<b>一次選好幾張</b></li><li>AI 會讀出店名、日期、品項、折扣、平台費，自動放到明細上的日期</li></ul>${tip('也可以在 Foodpanda 或相簿按「分享」→ 食光帳本。')}`},
    {t: '④ 每一項是誰的？', h: phone('🧾 好鄰居超市 中央店', `<div class="pQuick">還沒選人的全部給：<i>🙂 我</i><i>👩 媽媽</i></div>${pc(pRow('礦泉水1500 ×2', '$50') + '<div class="pTag">🙂 我</div>')}${pc(pRow('衛生紙', '$199') + '<div class="pTag hl">🙂 我　👩 媽媽　👦 弟弟</div>' + tap)}${pc(pRow('餅乾禮盒', '$120') + '<div class="pTag warn">選誰付</div>', 'warn')}`, '分帳', 'shop') +
      `<ul><li>點每一項右邊的人名，選<b>誰付</b></li><li>選 <b>1 個人</b> = 這個人自己付；選 <b>好幾個人</b> = 平均分攤</li><li>紅框代表還沒選人；可以用「還沒選人的全部給」一次選好</li></ul>`},
    {t: '⑤ 折扣會自動分到品項', h: phone('🏷️ 品項折扣', `${pc('<b>洗衣精 任買2組229元</b><small class="g">-$138</small><div class="pTag">洗衣精補充包</div>')}${pc('<b>餅乾禮盒 第2件</b><small class="g">-$20</small><div class="pTag warn hl">勾選品項</div>' + tap, 'warn')}${pc('<b>🎟️ 整單折扣・優惠券</b><small class="g">-$45 → 選誰均攤</small>')}`, '分帳', 'shop') +
      `<ul><li>AI 會依品牌、品名猜折扣是哪一項的，<b>請確認一下</b></li><li>猜不到的會顯示紅框，點「勾選品項」自己勾</li><li>一個折扣勾好幾項，會<b>平均分到勾選的品項</b></li><li>整單折扣、優惠券：選哪些人一起均攤</li></ul>${tip('全聯的「紅利抵現」會自動忽略，不會算進去。')}`},
    {t: '⑥ 外送費用自己選誰分', h: phone('🛵 費用', `${pc(pRow('平台費', '$5') + '<div class="pTag">🙂 我　👩 媽媽</div>')}${pc(pRow('包材費', '$10') + '<div class="pTag warn hl">選誰付</div>' + tap, 'warn')}${pc(pRow('外送服務費', '$29') + '<div class="pTag">👩 媽媽</div>')}`, '分帳', 'shop') +
      `<ul><li>Foodpanda 的平台費、外送費、包材費會放在「費用」</li><li>每一筆都由你<b>自己選誰分攤</b>，選好幾人就平均分</li><li>常用的費用名稱可以在 ⚙️ 設定裡新增</li></ul>`},
    {t: '⑦ 看結果，對一下金額', h: phone('🧾 好鄰居超市 中央店', `${pc(pRow('品項合計', '$736') + pRow('品項折扣', '-$158') + pRow('應付合計', '$578', 'tot') + '<div class="pOk">✅ 和明細上的實付金額一致</div>')}${pc(pRow('🙂 我', '$345.33') + pRow('👩 媽媽', '$166.33') + pRow('👦 弟弟', '$66.33'))}`, '分帳', 'shop') +
      `<ul><li>最下面會算出<b>每個人要付多少</b></li><li>看到 <b>✅</b> 代表和明細上的金額一樣；<b>⚠️</b> 代表有差，檢查一下有沒有漏掉的品項或折扣</li></ul>`},
    {t: '⑧ 匯出、搜尋、設定', h: phone('📤 匯出購物分帳', `<div class="pText">2026/11/08(日)<br>好鄰居超市 中央店 15:42<br>我：<br>礦泉水1500[NT$ 25]×2<br>衛生紙[NT$ 199]×0.33<br>小計：NT$ 345.33</div><div class="pBtns">${pb('📊 Excel')}${pb('📋 複製文字', 'pri hl') + tap}</div>`, '分帳', 'shop') +
      `<ul><li><b>📤 匯出</b>：整天或單一筆，複製文字貼 LINE，或存成 Excel</li><li><b>🔍</b>：搜尋店名或商品，例如「衛生紙」，看哪天買、多少錢</li><li><b>⚙️ 設定</b>：人名（和點餐共用）、費用名稱</li></ul>`}]}
};
function openGuide(kind) {
  const G = GUIDE[kind]; let i = 0; buzz(10);
  const sh = sheet({title: G.title, full: true, foot: '<button class="btn" data-a="prev">‹ 上一步</button><button class="btn pri" data-a="next">下一步 ›</button>'});
  const render = () => { const s = G.steps[i], last = i === G.steps.length - 1;
    sh.body.innerHTML = `<div class="tut gd"><div class="tutDots">${G.steps.map((_, k) => `<i class="${k === i ? 'on' : ''}" data-k="${k}"></i>`).join('')}</div><div class="tutStep">${i + 1} / ${G.steps.length}</div><h2>${s.t}</h2>${s.h}</div>`;
    sh.body.scrollTop = 0; $('[data-a="prev"]', sh.foot).disabled = i === 0; $('[data-a="next"]', sh.foot).textContent = last ? '完成 ✓' : '下一步 ›'; };
  render();
  sh.foot.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; buzz(8); if (b.dataset.a === 'prev') { if (i > 0) i--; render(); } else if (i < G.steps.length - 1) { i++; render(); } else sh.close(); });
  sh.body.addEventListener('click', e => { const t = e.target.closest('[data-tut],[data-k]'); if (!t) return; if (t.dataset.tut) openTutorial(t.dataset.tut); else { i = +t.dataset.k; render(); } });
  let x0 = null; sh.body.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive: true});
  sh.body.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) < 60) return; if (dx < 0 && i < G.steps.length - 1) i++; else if (dx > 0 && i > 0) i--; else return; buzz(8); render(); }, {passive: true});
}
