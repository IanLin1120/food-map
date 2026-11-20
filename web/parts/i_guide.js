/* ============================================================
   使用說明：給第一次用的人看的圖解（手機畫面示意圖＋白話說明）
   ============================================================ */
const APP_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="54 54 324 324"><defs> <linearGradient id="gicv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0844B"/><stop offset=".55" stop-color="#C2633A"/><stop offset="1" stop-color="#9A4226"/></linearGradient> <linearGradient id="gisp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7E321C"/><stop offset="1" stop-color="#9C4527"/></linearGradient> <linearGradient id="gipl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF9EC"/><stop offset="1" stop-color="#F2E2C2"/></linearGradient> <linearGradient id="gicn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7D27A"/><stop offset="1" stop-color="#DB9A33"/></linearGradient> <radialGradient id="gigl" cx=".35" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient> <filter id="gish" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#5A2410" flood-opacity=".35"/></filter></defs><rect width="432" height="432" fill="url(#gicv)"/> <g opacity=".10" stroke="#FFF3DC" stroke-width="10" fill="none"><path d="M-10 120 L442 70"/><path d="M-10 350 L442 380"/><path d="M330 -10 L360 442"/></g> <rect x="0" y="0" width="112" height="432" fill="url(#gisp)"/><rect x="112" y="0" width="7" height="432" fill="#6E2A16" opacity=".45"/> <g stroke="#F4D9B6" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 14" opacity=".75"><path d="M96 -6 V440"/></g> <path d="M286 0 h44 v150 l-22 -20 l-22 20z" fill="#7C8B4E"/><path d="M286 0 h44 v8 h-44z" fill="#5F6C39"/> <rect width="432" height="432" fill="url(#gigl)"/><g filter="url(#gish)"><circle cx="222" cy="210" r="102" fill="url(#gipl)"/><circle cx="222" cy="210" r="84" fill="none" stroke="#E4CDA4" stroke-width="4"/> <g fill="#A3482A"><path d="M178 150 h9 v46 h7 v-46 h9 v46 h7 v-46 h9 v55 a21 21 0 0 1 -16 20 v66 a8 8 0 0 1 -16 0 v-66 a21 21 0 0 1 -16 -20z"/> <ellipse cx="262" cy="182" rx="21" ry="31"/><rect x="254" y="206" width="16" height="85" rx="8"/></g></g> <g filter="url(#gish)"><circle cx="296" cy="290" r="40" fill="url(#gicn)" stroke="#FFF1CF" stroke-width="6"/><circle cx="296" cy="290" r="28" fill="none" stroke="#B5741C" stroke-width="3" opacity=".55"/> <text x="296" y="305" text-anchor="middle" font-family="DejaVu Sans, Arial" font-weight="700" font-size="40" fill="#8A5310">$</text></g></svg>';
const PHT = {food: [['🗺️', '地圖'], ['🔖', '收藏'], ['🍱', '點餐'], ['📖', '食譜'], ['⚙️', '設定']], shop: [['🗺️', '地圖'], ['🔖', '收藏'], ['🧾', '分帳'], ['🎫', '發票'], ['⚙️', '設定']]};
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
      <p>跟著這份說明走一遍，大約 2 分鐘。看完可以隨時到 <b>設定 → 使用說明</b> 再打開。購物分帳和發票另外有自己的說明。</p>`},
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
    {t: '⑦ 食譜', h: phone('食譜', `<div class="pWho"><i class="on">全部</i><i>🍳 煎</i><i>🥘 炒</i><i>🍚 電鍋</i></div>${pc('<b>電鍋蒸飯</b><small>米 1 杯：水 1 杯・外鍋 1 杯水</small>')}${pc('<b>番茄炒蛋</b><small>2 人份・5 個步驟</small>')}${pb('＋ 新增食譜', 'pri wide hl') + tap}`, '食譜') +
      `<ul><li>記錄拿手菜：食材表格＋自己的步驟</li><li>可以用「比例表」模板（例如電鍋蒸飯幾杯米配幾杯水）</li><li>自訂資料夾（煎、炒、電鍋、湯…），按住拖曳排序或移到其他資料夾</li></ul>`},
    {t: '⑧ 備份和外觀', h: phone('設定', `${pc('<b>外觀</b><small>主題：跟隨系統／淺色／深色・重點顏色・介面大小・震動強度</small>')}${pc('<b>資料</b><div class="pBtns">' + pb('📤 匯出備份', 'pri hl') + pb('📥 匯入備份') + '</div>' + tap)}`, '設定') +
      `<ul><li><b>匯出備份</b>：收藏、菜單、點餐、購物分帳、發票、食譜全部存成一個檔案，換手機時再<b>匯入備份</b></li><li>外觀可以換主題、重點顏色、介面大小和震動強度</li><li>有新版本時 App 會提醒，按一下就能更新</li></ul>`},
    {t: '⑨ 先設定金鑰（只要一次）', h: `<div class="gKeys"><div><i>🔑</i><b>AI 辨識金鑰（建議）</b><small>菜單照片、購物明細變成表格都靠它。免費申請，不用信用卡。</small><button class="btn sm pri" data-tut="ai">📘 看教學</button></div>
        <div><i>🗺️</i><b>Google 搜尋金鑰（選用）</b><small>讓搜尋店家更準，自動帶入地址電話。</small><button class="btn sm" data-tut="maps">📘 看教學</button></div></div>
      <p>不設定也能先用，之後到 <b>設定</b> 頁再補上就可以。</p>`}]},
  shop: {title: '🛒 購物分帳 使用說明', steps: [
    {t: '購物分帳是什麼？', h: `<div class="gHero"><div class="gIcon">${APP_ICON}</div><b>一張明細，自動算出每個人要付多少</b></div>
      <div class="gFlow"><span>🧾<small>拍明細</small></span><em>➜</em><span>🤖<small>AI 讀出品項</small></span><em>➜</em><span>👥<small>選誰付</small></span><em>➜</em><span>💰<small>每人金額</small></span></div>
      <p>適合全聯、量販店、超商一起買東西，或 Foodpanda 一起訂外送的時候。</p>`},
    {t: '① 切換到購物分帳', h: phone('設定', `${pc('<b>功能區</b><small>量販店、超商、Foodpanda 的購物明細…</small>' + pb('🛒 切換到購物分帳', 'pri wide hl') + tap)}${pc('<b>📘 使用說明</b><small>美食點餐・購物分帳・發票</small>')}`, '設定') +
      `<ul><li>到 <b>設定</b> 頁最上面的「功能區」，按 <b>🛒 切換到購物分帳</b></li><li>下面的分頁會換成 <b>地圖、收藏、分帳、發票、設定</b></li><li>想回去點餐，同一個位置按 <b>🍽️ 切換到美食點餐</b>；關掉 App 再打開會回到上次的功能區</li></ul>${tip('美食點餐和購物分帳<b>共用同一份收藏</b>，分類也是同一份（早餐、午餐、晚餐、量販店、超市、超商…）。')}`},
    {t: '② 收藏常去的店', h: phone('🔍 搜尋', `<div class="pin">🔍 好鄰居超市</div><div class="pMap"><span class="flag">🛒</span><span class="flag f2">🍱</span></div>${pc(`<b>好鄰居超市 中央店</b><small>量販店</small><div class="pBtns">${pb('🧾 購物紀錄')}${pb('⭐ 收藏', 'pri hl') + tap}</div>`)}`, '地圖', 'shop') +
      `<ul><li>在地圖搜尋全聯、全家、常叫外送的餐廳…按收藏，選一個分類</li><li>外送的餐廳就照早餐、午餐、晚餐分類；是不是外送，改在每一筆明細選「購物方式」</li><li>店家卡片上的 <b>🧾 購物紀錄</b> 可以看這家店所有的明細</li></ul>`},
    {t: '③ 上傳明細，AI 幫你讀', h: phone('購物分帳', `<div class="pBtns">${pb('📷 上傳明細', 'pri hl') + tap}${pb('✏️ 手動輸入')}</div><div class="pc" style="border-color:var(--accent)"><b>🤖 AI 辨識中・11/08</b><small>Flash-Lite 已讀到 5 項…（12 秒）</small></div><div class="pCal">${Array.from({length: 7}, (_, i) => `<i class="${i === 3 ? 'on' : ''}">${i + 5}${i === 3 ? '<em></em>' : ''}</i>`).join('')}</div>`, '分帳', 'shop') +
      `<ul><li>按最上面的 <b>📷 上傳明細</b>，選全聯 App 明細截圖、發票照片或 Foodpanda 訂單截圖（可以一次選好幾張）</li><li>辨識進度會<b>固定顯示在頁首</b>，不管看哪一天都看得到，點一下直接打開那筆</li><li>AI 會讀出店名、日期、時間、品項、折扣、平台費，自動放到明細上的日期</li></ul>${tip('也可以在 Foodpanda 或相簿按「分享」→ 食光帳本。')}`},
    {t: '④ 日期、時間、購物方式', h: phone('🧾 森林小廚房', `${pc('<b>店家</b><small>森林小廚房</small>')}${pc(`<b>購物方式</b><div class="pWho" style="margin-top:.2rem"><i>🏬 實體店購物</i><i class="on hl">🐼 Foodpanda</i><i>🛵 Uber Eats</i><i>🛵 店家外送</i><i>＋ 自訂</i></div>` + tap)}${pc('<b>日期</b><small>2026/10/04(日)　到月曆 ›　更改 ▾</small>')}${pc('<b>時間</b><small>🕒 11:15</small>')}`, '分帳', 'shop') +
      `<ul><li><b>購物方式</b>：實體店購物、Foodpanda、Uber Eats、店家外送，也可以按「＋ 自訂」新增；明細卡片和匯出文字都會標示</li><li><b>日期</b>：點日期跳到月曆那一天；按「更改 ▾」用月曆面板改日期</li><li><b>時間</b>：用時間選擇器先選「時」再選「分」</li></ul>`},
    {t: '⑤ 每一項是誰的？', h: phone('🧾 好鄰居超市 中央店', `<div class="pQuick">還沒選人的全部給：<i>🙂 我</i><i>👩 媽媽</i></div>${pc(pRow('礦泉水1500 ×2', '$50') + '<div class="pTag">🙂 我</div>')}${pc(pRow('衛生紙', '$199') + '<div class="pTag hl">🙂 我　👩 媽媽　👦 弟弟</div>' + tap)}${pc(pRow('餅乾禮盒', '$120') + '<div class="pTag warn">選誰付</div>', 'warn')}`, '分帳', 'shop') +
      `<ul><li>點每一項右邊的人名，選<b>誰付</b></li><li>選 <b>1 個人</b> = 這個人自己付；選 <b>好幾個人</b> = 平均分攤</li><li>紅框代表還沒選人；可以用「還沒選人的全部給」一次選好</li><li>點品名可以改「單價｜數量｜總額」，會互相自動計算</li></ul>`},
    {t: '⑥ 折扣、福利扣點、費用', h: phone('🏷️ 折扣與費用', `${pc('<b>洗衣精 任買2組229元</b><small class="g">-$138</small><div class="pTag">洗衣精補充包</div>')}${pc('<b>餅乾禮盒 第2件</b><small class="g">-$20</small><div class="pTag warn hl">勾選品項</div>' + tap, 'warn')}${pc('<b>🎟️ 福利扣點</b><small class="g">-$3 → 選誰均攤</small>')}${pc(pRow('🛵 平台費', '$5') + '<div class="pTag">🙂 我　👩 媽媽</div>')}`, '分帳', 'shop') +
      `<ul><li>品項折扣：AI 會依品牌、品名猜套用哪一項，<b>請確認</b>；猜不到的點「勾選品項」，勾好幾項會平均分</li><li><b>福利扣點</b>會自動放進整單折扣，實付金額直接帶入扣完的金額；常用名稱可以按「＋ 自訂名稱」新增、長按刪除</li><li>平台費、外送費、包材費放在「費用」，每一筆自己選誰分攤</li></ul>${tip('全聯的「紅利抵現」會自動忽略。')}`},
    {t: '⑦ 看結果，對一下金額', h: phone('🧾 好鄰居超市 中央店', `${pc(pRow('品項合計', '$736') + pRow('品項折扣', '-$158') + pRow('應付合計', '$578', 'tot') + '<div class="pOk">✅ 和明細上的實付金額一致</div>')}${pc(pRow('🙂 我', '$345.33') + pRow('👩 媽媽', '$166.33') + pRow('👦 弟弟', '$66.33'))}`, '分帳', 'shop') +
      `<ul><li>最下面會算出<b>每個人要付多少</b></li><li>看到 <b>✅</b> 代表和明細上的金額一樣；<b>⚠️</b> 代表有差，檢查一下有沒有漏掉的品項或折扣</li></ul>`},
    {t: '⑧ 匯出、搜尋、設定', h: phone('📤 匯出購物分帳', `<div class="pText">2026/11/08(日)<br>好鄰居超市 中央店 15:42<br>我：<br>礦泉水1500[NT$ 25]×2<br>洗衣精[NT$ 107]×2<br>衛生紙[NT$ 199]×0.33<br>小計：NT$ 494.33</div><div class="pBtns">${pb('📊 Excel')}${pb('📋 複製文字', 'pri hl') + tap}</div>`, '分帳', 'shop') +
      `<ul><li><b>📤 匯出</b>：整天或單一筆，複製文字貼 LINE，或存成 Excel；單價是<b>扣完折扣後</b>的價格（例如 2 件 $298 折 $84 → [NT$ 107]×2）</li><li><b>🔍 搜尋</b>：店名或商品，例如「衛生紙」</li><li><b>⚙️ 設定</b>：人名（和點餐共用）、購物方式、費用名稱、整單折扣名稱</li></ul>${tip('發票（紙本 QR、發票大師）也可以直接拿去分帳，請看「🎫 發票」的說明。')}`}]},
  inv: {title: '🎫 發票 使用說明', steps: [
    {t: '發票區可以做什麼？', h: `<div class="gHero"><div class="gIcon">${APP_ICON}</div><b>把發票收進來，一鍵拿去分帳</b></div>
      <div class="gFlow"><span>📷<small>掃 QR</small></span><em>＋</em><span>🖼️<small>截圖</small></span><em>＋</em><span>🤖<small>協助工具</small></span><em>➜</em><span>🧾<small>拿去分帳</small></span></div>
      <p>在購物分帳功能區，下面的分頁按 <b>🎫 發票</b>。可以掃紙本電子發票的 QR Code、匯入發票大師的截圖，或用協助工具直接讀發票大師的畫面。</p>${tip('用手機條碼直接同步載具需要財政部核發的 API 帳號（只給營業人或組織），所以改用這些方式。')}`},
    {t: '① 我的手機條碼', h: phone('發票', `<div class="pc" style="background:#fff"><b>📱 我的手機條碼</b><div class="pBar"></div><small style="text-align:center;letter-spacing:.3em">/ABC+123</small></div>${pc('<b>2026/11/20(五)</b><small>月光拉麵・XY-20481357</small>')}`, '發票', 'shop') +
      `<ul><li>第一次按「📱 設定我的手機條碼」輸入載具號碼（斜線開頭共 8 碼）</li><li>之後發票區最上面會顯示條碼，<b>點一下放大</b>給店員掃，發票就會存進你的載具</li></ul>`},
    {t: '② 掃描紙本發票 QR Code', h: phone('📷 掃描發票', `<div class="pScan"><i></i><i></i></div><div class="pWho"><i class="on">左邊 QR ✓</i><i class="on">右邊 QR ✓</i></div>${pc('<b>✅ 已存入 QT-36925814</b><small>2026/11/18・5 項　$108</small>')}`, '發票', 'shop') +
      `<ul><li>按 <b>📷 掃描</b>，把發票左右兩個 QR Code 一起放進框裡</li><li>不用網路就能讀出發票號碼、日期、統編、金額和每個品項；可以連續掃好幾張</li><li>店名會用統編自動查；查不到可以自己改</li></ul>`},
    {t: '③ 匯入發票大師截圖', h: phone('發票', `<div class="pBtns">${pb('📷 掃描')}${pb('🖼️ 截圖', 'pri hl') + tap}${pb('🤖 協助工具')}</div><div class="pc" style="border-color:var(--accent)"><b>🤖 AI 讀取發票截圖 2/5</b><small>第 3 張・Flash-Lite 已讀到 6 行…</small></div><div class="pImgs"><i>📱</i><i>📱</i><i>📱</i></div>`, '發票', 'shop') +
      `<ul><li>在發票大師把「發票明細」或「發票列表」截圖</li><li>按 <b>🖼️ 截圖</b> 一次選好多張，AI 讀出號碼、日期、店家、金額、品項</li><li>同一張發票重複匯入會自動合併；列表截圖之後再補明細截圖，品項會補上</li></ul>`},
    {t: '④ 協助工具：直接讀發票大師', h: phone('發票大師', `${pc('<b>發票明細</b><small>XY-20481357　$435</small>')}${pc('<b>品名　數量　小計</b><small>豚骨拉麵　1　$245</small>')}<div class="pFab hl">🧾</div>${tap}`, '', 'shop') +
      `<ul><li>第一次：發票區按 <b>🤖 協助工具</b> →「⚙️ 協助工具設定」→ 開啟「食光帳本 發票讀取」</li><li>之後按 🤖 協助工具會<b>自動打開發票大師</b>，畫面上有一顆綠色圓形按鈕 🧾（可以拖曳）</li><li><b>按一下</b>：明細頁讀這一張；列表頁自動捲到底讀全部，讀完可以選「🔁 也讀取每張明細」</li><li><b>長按</b>：取消偵測並關閉按鈕；讀完按「✓ 返回食光帳本」就會存進發票區</li></ul>${tip('只有按 🧾 時才會讀取畫面上的文字，讀到的內容只存在這支手機裡。')}`},
    {t: '⑤ 月曆和搜尋', h: phone('發票', `<div class="pCal">${Array.from({length: 14}, (_, i) => `<i class="${i === 10 ? 'on' : ''}">${i + 10}${[7, 8, 10].includes(i) ? '<em></em>' : ''}</i>`).join('')}</div><div class="pc" style="border-color:var(--accent)"><b>2026/11/20(五) 的發票（1 張）</b><small>顯示整個月</small></div>${pc('<b>月光拉麵 星河店</b><small>🐼 Foodpanda・XY-20481357　$435</small>')}`, '發票', 'shop') +
      `<ul><li>月曆上有紅點和張數的日子代表有發票，<b>點日期只看那天</b>；再點一次或按「顯示整個月」恢復</li><li><b>🔍 搜尋</b>：店家、品項或發票號碼</li><li><b>📥 其他匯入</b>：財政部「載具消費明細」CSV、App 內讀取財政部網站（實驗性）</li></ul>`},
    {t: '⑥ 修改發票明細', h: phone('🧾 發票明細', `${pc('<b>XY-20481357 ✎</b><small>2026/11/20(五) ✎　19:40 ✎</small>')}${pc('<b>消費店家</b><small class="hl">🔍 星河 → 便利商店 星河二店</small>' + tap)}${pc(`<b>購物方式</b><div class="pWho"><i>🏬 實體店</i><i class="on">🐼 Foodpanda</i></div>`)}${pc(pRow('豚骨拉麵', '$278') + pRow('味噌拉麵', '$208'))}`, '發票', 'shop') +
      `<ul><li>點<b>發票號碼、日期、時間、店家、統編、金額</b>都可以改</li><li>改店家時輸入關鍵字（不用是開頭）就會列出以前用過的店名讓你點</li><li>可以選<b>購物方式</b>；品項點一下改品名、單價、數量、小計，或按「＋ 品項」新增</li></ul>`},
    {t: '⑦ 折扣：金額、組合價、打折', h: phone('新增折扣', `<div class="pSeg"><i>折扣金額</i><i class="on hl">組合價</i><i>打折</i></div>${pc('<b>組合優惠</b><small>組合價 $49</small>')}${pc('<b>☑ 罐裝拿鐵 $35</b><b>☑ 罐裝拿鐵 $35</b><small class="g">原價 $70 → 組合價 折扣 -$21</small>')}`, '發票', 'shop') +
      `<ul><li><b>折扣金額</b>：例如鮮食促 -21，直接填折掉多少</li><li><b>組合價</b>：例如任選 2 件 $49，勾 2 件填 49，自動算出折了多少</li><li><b>打折</b>：例如 8 折、6.5 折，勾選的品項乘上折數</li><li>勾好幾項會平均分；發票會自動驗算扣完折扣是否等於消費金額</li></ul>`},
    {t: '⑧ 拿去分帳', h: phone('🧾 發票明細', `${pc(pRow('消費金額', '$486', 'tot') + '<div class="pOk">✅ 品項扣掉折扣後合計和消費金額一致</div>')}<div class="pBtns">${pb('刪除')}${pb('🧾 拿去分帳', 'pri wide hl') + tap}</div>${pc('<b>✓ 已拿去分帳</b><small>2026/11/20(五) 月光拉麵　打開 ›</small>')}`, '發票', 'shop') +
      `<ul><li>按 <b>🧾 拿去分帳</b>，會在發票日期建立一筆分帳，品項、折扣（含勾選的品項）、購物方式都會帶過去</li><li>接著選每一項是誰付的就完成了</li><li>已分帳的發票會標示「✓ 已分帳」，點一下直接打開那筆分帳</li></ul>`}]}
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
