// ============================================================================
// 檔案名稱：event/法會報到.js
// 所屬模組：法會活動（event）
// 所屬層級：前端／法會活動頁「四、法會報到」分頁
// 檔案版本：v1.4.1（2026-11-08）
//   v1.4.1：兩份合併來源都是選填：場次區只顯示精舍有設定的來源；都沒設定時只說明「名冊只用報名資料」
//   v1.4.0：名冊合併三個來源：精舍設定加「副會長回報表」（卡片改名「名冊合併來源」）；場次區的合併設定加「副會長回報：合併／不合併」
//   v1.3.0：合併用齋登記：精舍管理員設定「用齋登記表」連結（說明卡片下方）；每場活動選「合併用齋：午齋／藥石／不合併」（場次區）
//   v1.2.0：每場活動有自己的報到連結（網址帶報到碼 &code=），複製文字與 QR Code 都用這個連結；
//           同一天多場活動時，志工開哪個連結就進哪一場（報到頁依連結的報到碼分開保存登入）
//   v1.1.0：場次清單加「取消場次」「恢復場次」（某一天不舉行；權限 event.開放報到），已取消的場次標紅並說明；
//           補登表格的「已報到」「未報到」有取消欄（還原成未報到、取消參加、恢復參加）
// 用途說明：
//   法會活動頁的第四個分頁（對內活動），放在 event.js 之前載入，由 event.js 的分頁與事件呼叫：
//     · 報到碼：開放報到（產生 6 位數報到碼）、暫停報到、更換報到碼；顯示報到網址、複製、QR Code
//     · 場次名冊、報到時段、列印與補登（展開時才讀取）：
//         設定報到時段、下載場次名冊、列印紙本報到表（PDF）、補登（報到表格元件，預設報到方式「紙本」）
//   權限由後端檢查：開放／暫停／更換報到碼 event.開放報到；其餘 event.整理資料（皆須為承辦人）。
//
// 相依檔案：core/shared/config.js、api.js、ui.js；event/報到表格.js；event/event.js（頁面狀態、共用小工具）
// ============================================================================

/* global obj頁面狀態, 呼叫平台, 取得頁面網址, 取得網址精舍代號, 取得元素, 跳脫HTML, 顯示區塊訊息, 執行操作,
          取得錯誤訊息, 顯示並捲到訊息, 完成卡片操作, 組合結果訊息, 狀態標HTML, obj狀態樣式, 找活動, 載入活動資料,
          畫活動清單, 確認對話框, 建立報到表格 */
/* exported 載入法會報到, 畫法會報到, 處理報到按鈕, 綁定法會報到事件 */

// 本分頁的狀態
const obj報到分頁 = {
  obj場次: {},        // 活動ID → event.列出場次 的結果
  obj展開: {},        // 活動ID → true（「場次名冊…」展開中）
  obj補登: {},        // 活動ID → { str場次, obj元件 }
  obj列印: {},        // 活動ID → { str場次, str網址 }
  obj顯示QR: {}       // 活動ID → true
};

// QR Code 程式庫（第一次按「顯示 QR Code」時才載入）
const strQR程式庫網址_ = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
let objQR載入中_ = null;


/**
 * ============================================================================
 * 函式名稱：報到網址
 * 版本：v1.1.0（2026-11-07）　v1.1.0：可帶報到碼（活動專屬連結）
 * ----------------------------------------------------------------------------
 * 用途：報到頁網址。不給報到碼＝本精舍共用的報到頁（志工自己輸入報到碼）；
 *       給報到碼＝這場活動的專屬連結（?site=…&code=報到碼），志工開啟後只要輸入本人姓名。
 * 參數：str報到碼 {string=}
 * 傳回：{string}
 * ============================================================================
 */
function 報到網址(str報到碼) {
  const obj網址 = new URL(取得頁面網址('event/checkin.html', 取得網址精舍代號()));
  if (str報到碼) obj網址.searchParams.set('code', str報到碼);
  return obj網址.href;
}


/**
 * ============================================================================
 * 函式名稱：載入法會報到
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：讀取活動並重畫「法會報到」分頁（報到碼隨 event.列出活動 一起傳回）。
 * 參數：無
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 載入法會報到() {
  await 載入活動資料();
  畫法會報到();
  if (obj頁面狀態.obj已載入['活動清單']) 畫活動清單();
}


/**
 * ============================================================================
 * 函式名稱：報到相關活動
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：本分頁列出的活動：未結束的對內活動中，登入者可以開放報到或整理資料的。
 * 參數：無
 * 傳回：{Object[]}
 * ============================================================================
 */
function 報到相關活動() {
  return obj頁面狀態.arr活動.filter(function (o) {
    return o.str活動類型 === '對內' && !是否已停止(o.str活動狀態) && (o.obj可做.bool報到 || o.obj可做.bool整理);
  });
}


/**
 * ============================================================================
 * 函式名稱：畫法會報到
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：畫出步驟說明與每場對內活動的報到卡片；展開中的場次區、補登表格重畫後還原。
 * 參數：無
 * 傳回：無
 * ============================================================================
 */
function 畫法會報到() {
  // 重畫會移除補登表格，先停止自動更新
  Object.keys(obj報到分頁.obj補登).forEach(function (k) { if (obj報到分頁.obj補登[k].obj元件) obj報到分頁.obj補登[k].obj元件.停止(); });

  const arr = 報到相關活動();
  取得元素('摘要_法會報到').textContent = arr.length === 0 ? '目前沒有您可以處理的對內活動' : `您可以處理 ${arr.length} 場對內活動的報到`;

  let str = `<section class="卡片" id="卡片_報到說明">
    <h3>法會報到的步驟</h3>
    <ol class="明細">
      <li><strong>下載場次名冊</strong>：展開活動的「場次名冊、報到時段、列印與補登」，選場次下載（一支香第一次下載時確認報到時段）。</li>
      <li><strong>開放報到</strong>：產生 6 位數報到碼。把<strong>報到網址</strong>（或 QR Code）和報到碼交給報到志工；志工輸入報到碼與本人姓名後，可以刷碼或用表格打勾報到。</li>
      <li><strong>紙本</strong>：按「列印報到表」印出，現場人工打勾；事後按「補登」照紙本打勾（報到方式記「紙本」）。</li>
      <li>報到結束按<strong>暫停報到</strong>，報到碼立即失效；報到紀錄都保留在整理副本的「報到紀錄」分頁。</li>
    </ol>
    <p class="小字" style="margin:0.5rem 0 0">每場活動有自己的<strong>報到連結</strong>（網址含報到碼）：志工開啟後只要輸入本人姓名。同一天有多場活動時，各場的連結分開給；
      同一台裝置開哪個連結就進哪一場，可以開兩個分頁同時報到。</p>
  </section>`;
  if (obj頁面狀態.bool可管理) str += 產生用齋登記表HTML();

  str += arr.length === 0
    ? `<p class="空白提示">${obj頁面狀態.arr活動.some(function (o) { return o.str活動類型 === '對內' && !是否已停止(o.str活動狀態); })
      ? '您沒有被指派這些對內活動的「開放報到」或「整理資料」權限。如需處理，請洽精舍管理員。'
      : '目前沒有進行中的對內活動。法會報到用在一支香、共修、培訓等「對內」活動。'}</p>`
    : `<ul class="卡片清單">${arr.map(產生報到卡片HTML).join('')}</ul>`;
  取得元素('內容_法會報到').innerHTML = str;

  // 還原 QR Code、展開的場次區與補登
  arr.forEach(function (o) {
    if (obj報到分頁.obj顯示QR[o.str活動ID]) 畫QR(o.str活動ID);
    if (obj報到分頁.obj展開[o.str活動ID] && obj報到分頁.obj場次[o.str活動ID]) 畫場次區(o.str活動ID);
    const obj補 = obj報到分頁.obj補登[o.str活動ID];
    if (obj補 && obj報到分頁.obj展開[o.str活動ID]) 開始補登(o.str活動ID, obj補.str場次);
  });
}


/**
 * ============================================================================
 * 函式名稱：產生報到卡片HTML
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：一場對內活動的報到卡片：狀態、報到碼與網址、開放／暫停／更換、可展開的場次區。
 * 參數：obj活動 {Object} event.列出活動 的一筆
 * 傳回：{string} HTML
 * ============================================================================
 */
function 產生報到卡片HTML(obj活動) {
  const str編號 = 跳脫HTML(obj活動.str活動ID);
  const obj報到 = obj活動.obj報到 || {};
  const bool報到中 = obj活動.str活動狀態 === '報到中';
  const bool可開放 = obj活動.obj可做.bool報到;

  let str報到 = '';
  if (bool報到中) {
    str報到 = `<div class="報到碼區">
      <div>報到碼 <span class="報到碼大字">${跳脫HTML(obj報到.str報到碼 || '（請洽開放報到的人）')}</span>
        <span class="小字">${obj報到.str報到碼產生時間 ? `${跳脫HTML(obj報到.str報到碼產生時間)} 產生` : ''}</span></div>
      <div class="小字">報到連結：<span class="程式碼">${跳脫HTML(報到網址((obj活動.obj報到 || {}).str報到碼))}</span></div>
      <div class="活動操作" style="margin-top:0.4rem">
        <button type="button" class="按鈕 小" data-動作="複製報到網址" data-活動="${str編號}">複製報到連結</button>
        <button type="button" class="按鈕 小" data-動作="顯示QR" data-活動="${str編號}">${obj報到分頁.obj顯示QR[obj活動.str活動ID] ? '隱藏' : '顯示'} QR Code</button>
        ${bool可開放 ? `<button type="button" class="按鈕 小" data-動作="更換報到碼" data-活動="${str編號}">更換報到碼…</button>
        <button type="button" class="按鈕 小 警示" data-動作="暫停報到" data-活動="${str編號}">暫停報到…</button>` : ''}
      </div>
      <div class="QR區" id="QR_${str編號}"></div>
    </div>`;
  } else {
    str報到 = `<p class="卡片提示">尚未開放報到。${bool可開放 ? '開放後會產生 6 位數報到碼，交給報到志工使用。' : '請洽有「開放報到」權限的承辦人或精舍管理員。'}</p>
      ${bool可開放 ? `<div class="活動操作"><button type="button" class="按鈕 小 主要" data-動作="開放報到" data-活動="${str編號}">開放報到</button></div>` : ''}`;
  }

  const str時段 = obj報到.str報到時段 ? `報到時段：${obj報到.str報到時段}` : '不分時段';
  return `<li class="卡片" id="報到卡_${str編號}">
    <div class="活動標題列">
      <span class="活動名稱">${跳脫HTML(obj活動.str活動名稱)}</span>
      <span class="活動代號">${str編號}</span>
      ${狀態標HTML(obj活動.str活動狀態, obj狀態樣式[obj活動.str活動狀態] || '')}
    </div>
    <div class="活動資訊"><span>${跳脫HTML(obj活動.str日期顯示 || '')}</span><span>${跳脫HTML(str時段)}</span>
      ${obj活動.str副本網址 ? `<a href="${跳脫HTML(obj活動.str副本網址)}" target="_blank" rel="noopener">開啟整理副本</a>` : ''}</div>
    ${str報到}
    ${obj活動.obj可做.bool整理 ? `<details class="展開" data-報到展開="${str編號}" ${obj報到分頁.obj展開[obj活動.str活動ID] ? 'open' : ''} style="margin-top:0.75rem">
      <summary><span class="按鈕 小">場次名冊、報到時段、列印與補登</span></summary>
      <div class="展開內容" id="場次區_${str編號}"><p class="載入中">正在讀取場次…</p></div>
    </details>` : ''}
  </li>`;
}


/**
 * ============================================================================
 * 函式名稱：載入場次區
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：讀取場次（含已下載的名冊、報到時段與建議）並畫出。
 * 參數：str活動ID {string}
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 載入場次區(str活動ID) {
  const el = 取得元素(`場次區_${str活動ID}`);
  if (!el) return;
  el.innerHTML = '<p class="載入中">正在讀取場次…</p>';
  try {
    obj報到分頁.obj場次[str活動ID] = await 呼叫平台('event.列出場次', { str活動ID: str活動ID });
    畫場次區(str活動ID);
  } catch (err) {
    el.innerHTML = `<p class="訊息" role="alert">${跳脫HTML(取得錯誤訊息(err))}</p>
      <button type="button" class="按鈕 小" data-動作="重讀場次" data-活動="${跳脫HTML(str活動ID)}">重新讀取</button>`;
  }
}


/**
 * ============================================================================
 * 函式名稱：畫場次區
 * 版本：v1.1.0（2026-11-07）　v1.1.0：取消場次／恢復場次、已取消標示
 * ----------------------------------------------------------------------------
 * 用途：報到時段（可修改）、場次清單（下載名冊、列印報到表、補登）、列印連結、補登表格位置。
 * 參數：str活動ID {string}
 * 傳回：無
 * ============================================================================
 */
function 畫場次區(str活動ID) {
  const el = 取得元素(`場次區_${str活動ID}`);
  const obj = obj報到分頁.obj場次[str活動ID];
  if (!el || !obj) return;
  const str編號 = 跳脫HTML(str活動ID);
  const obj活動 = 找活動(str活動ID) || { obj可做: {} };
  const bool可取消場次 = !!obj活動.obj可做.bool報到;      // 權限 event.開放報到
  const o時段 = obj.obj時段 || {};
  const str預填 = o時段.bool已設定 ? o時段.str報到時段 : (o時段.str建議時段 || '');

  let str = `<h4 style="margin:0 0 0.4rem;font-size:0.9375rem">報到時段</h4>
    <form data-報到表單="時段" data-活動="${str編號}">
      ${o時段.bool已設定 ? '' : (o時段.str建議時段
        ? '<p class="小字" style="margin:0 0 0.3rem;color:#7A5F2B">尚未設定。以下是系統從報名內容找到的時段，可修改名稱後儲存；下載名冊時也會一併儲存。</p>'
        : '<p class="小字" style="margin:0 0 0.3rem">目前不分時段（每個場次報到一次）。一支香這類分時段報到的活動請填入時段。</p>')}
      <textarea class="輸入" name="報到時段" rows="2" style="width:100%">${跳脫HTML(str預填)}</textarea>
      <p class="小字" style="margin:0.2rem 0 0.4rem">寫法：名稱 空格 開始-結束（24 小時制），以「；」分隔；清空＝不分時段。改了之後請重新下載要用的場次。</p>
      <button type="submit" class="按鈕 小">儲存報到時段</button>
    </form>`;

  // 名冊合併來源（v1.3.0 用齋；v1.4.0 加副會長回報；v1.4.1 只顯示精舍有設定的來源）
  const o用齋 = obj.obj用齋 || { str餐別: '午齋', bool有登記表: false, str副會長回報: '合併', bool有回報表: false };
  str += '<h4 style="margin:1rem 0 0.4rem;font-size:0.9375rem">名冊合併來源</h4>';
  if (!o用齋.bool有回報表 && !o用齋.bool有登記表) {
    str += '<p class="小字" style="margin:0">名冊只用報名資料。（精舍若設定副會長回報表或用齋登記表，這裡會出現合併選項。）</p>';
  } else {
    // 沒設定的來源用隱藏欄位帶目前值，儲存時不會改到
    const str回報欄 = o用齋.bool有回報表
      ? `<label class="小字">副會長回報
          <select class="輸入" name="副會長回報" style="width:auto" aria-label="合併副會長回報">
            ${['合併', '不合併'].map(function (s) { return `<option value="${s}" ${(o用齋.str副會長回報 || '合併') === s ? 'selected' : ''}>${s}</option>`; }).join('')}
          </select></label>`
      : `<input type="hidden" name="副會長回報" value="${跳脫HTML(o用齋.str副會長回報 || '合併')}">`;
    const str用齋欄 = o用齋.bool有登記表
      ? `<label class="小字">用齋登記
          <select class="輸入" name="用齋" style="width:auto" aria-label="合併用齋">
            ${['午齋', '藥石', '不合併'].map(function (s) { return `<option value="${s}" ${o用齋.str餐別 === s ? 'selected' : ''}>${s === '不合併' ? '不合併' : '合併' + s}</option>`; }).join('')}
          </select></label>`
      : `<input type="hidden" name="用齋" value="${跳脫HTML(o用齋.str餐別 || '午齋')}">`;
    const arr說明 = [];
    if (o用齋.bool有回報表) arr說明.push('副會長回報：出席但沒報名的人加入名冊（座位、執事印在備註），不參加的人自動登記取消參加');
    if (o用齋.bool有登記表) arr說明.push('用齋登記：所選餐別的義工加入名冊，備註印「大寮・午齋×2」');
    str += `<form data-報到表單="用齋" data-活動="${str編號}" class="工具列" style="flex-wrap:wrap;gap:0.5rem;align-items:center">
        ${str回報欄}${str用齋欄}
        <button type="submit" class="按鈕 小">儲存</button>
      </form>
      <p class="小字" style="margin:0.3rem 0 0">下載名冊時，除了報名資料，再合併<strong>同一天</strong>的${arr說明.join('；')}。改了之後請重新下載要用的場次。</p>`;
  }

  str += '<h4 style="margin:1rem 0 0.4rem;font-size:0.9375rem">場次</h4>';
  if ((obj.arr欄位提醒 || []).length > 0) str += `<p class="小字" style="color:#7A5F2B">${obj.arr欄位提醒.map(跳脫HTML).join('<br>')}</p>`;
  str += `<table class="重複表"><thead><tr><th>日期</th><th>場次</th><th>名冊</th><th></th></tr></thead><tbody>${(obj.arr場次 || []).map(function (o) {
    const str場 = 跳脫HTML(o.str場次);
    const str取消 = o.obj取消 ? `<div class="小字" style="color:var(--色-警示);font-weight:700">${跳脫HTML(o.obj取消.str說明)}</div>` : '';
    const str取消鈕 = bool可取消場次 && o.str分頁名
      ? (o.obj取消 ? `<button type="button" class="按鈕 小" data-動作="恢復場次" data-活動="${str編號}" data-場次="${str場}">恢復場次</button>`
        : `<button type="button" class="按鈕 小 警示" data-動作="取消場次" data-活動="${str編號}" data-場次="${str場}">取消場次</button>`) : '';
    return `<tr><td>${跳脫HTML(o.str日期)}</td><td>${str場}<div class="小字">有填 ${Number(o.int有填筆數)} 筆</div>${str取消}</td>
      <td>${o.str分頁名 ? `${跳脫HTML(o.str分頁名)}<div class="小字">${Number(o.int已下載人數)} 人</div>` : '<span class="小字">未下載</span>'}</td>
      <td><div class="活動操作">
        <button type="button" class="按鈕 小" data-動作="下載場次" data-活動="${str編號}" data-場次="${str場}">${o.str分頁名 ? '重新下載' : '下載名冊'}</button>
        ${o.str分頁名 ? `<button type="button" class="按鈕 小" data-動作="列印報到表" data-活動="${str編號}" data-場次="${str場}">列印報到表</button>
        <button type="button" class="按鈕 小 主要" data-動作="補登" data-活動="${str編號}" data-場次="${str場}">補登</button>` : ''}
        ${str取消鈕}
      </div></td></tr>`;
  }).join('')}</tbody></table>`;

  const obj印 = obj報到分頁.obj列印[str活動ID];
  if (obj印) {
    str += `<p style="margin:0.6rem 0 0"><a href="${跳脫HTML(obj印.str網址)}" target="_blank" rel="noopener" style="font-weight:700">🖨 開啟 PDF 列印（A4 直式）</a>
      <span class="小字">　${跳脫HTML(obj印.str場次)}；印表機請選「實際大小／100%」</span></p>`;
  }
  str += `<div id="補登區_${str編號}" style="margin-top:1rem"></div>`;
  el.innerHTML = str;
}


/**
 * ============================================================================
 * 函式名稱：開始補登
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：在場次區下方放入報到表格元件（補登：任一已下載場次，報到方式可選紙本／表格）。
 * 參數：str活動ID {string}；str場次 {string}
 * 傳回：無
 * ============================================================================
 */
function 開始補登(str活動ID, str場次) {
  const el區 = 取得元素(`補登區_${str活動ID}`);
  if (!el區) return;
  const obj舊 = obj報到分頁.obj補登[str活動ID];
  if (obj舊 && obj舊.obj元件) obj舊.obj元件.停止();
  el區.innerHTML = `<div class="工具列" style="justify-content:space-between"><strong>補登：${跳脫HTML(str場次)}</strong>
    <button type="button" class="按鈕 小" data-動作="關閉補登" data-活動="${跳脫HTML(str活動ID)}">關閉補登</button></div>
    <p class="小字" style="margin:0 0 0.5rem">照紙本報到表打勾；紙本手寫的未報名者用最下方「＋ 新增未報名者」。報到時間記補登當下、備註「補登」。</p>
    <div class="補登表格"></div>`;
  const obj元件 = 建立報到表格({
    el容器: el區.querySelector('.補登表格'),
    fn呼叫: function (str動作, obj參數) { return 呼叫平台(str動作, Object.assign({ str活動ID: str活動ID }, obj參數)); },
    str場次: str場次,
    int目前時段: 0,
    arr方式: ['紙本', '表格']
  });
  obj報到分頁.obj補登[str活動ID] = { str場次: str場次, obj元件: obj元件 };
  obj元件.載入();
}


/**
 * ============================================================================
 * 函式名稱：畫QR
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：在卡片顯示報到網址的 QR Code（志工用手機或平板掃描開啟）；程式庫載入失敗時只顯示網址。
 * 參數：str活動ID {string}
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 畫QR(str活動ID) {
  const el = 取得元素(`QR_${str活動ID}`);
  if (!el) return;
  el.innerHTML = '<p class="載入中 小字">產生 QR Code…</p>';
  try {
    if (!window.QRCode) {
      objQR載入中_ = objQR載入中_ || new Promise(function (fn完成, fn失敗) {
        const el程式 = document.createElement('script');
        el程式.src = strQR程式庫網址_;
        el程式.onload = fn完成;
        el程式.onerror = function () { objQR載入中_ = null; fn失敗(new Error('載入失敗')); };
        document.head.appendChild(el程式);
      });
      await objQR載入中_;
    }
    el.innerHTML = '';
    // eslint-disable-next-line no-new, no-undef
    const obj活動 = 找活動(str活動ID) || {};
    new QRCode(el, { text: 報到網址((obj活動.obj報到 || {}).str報到碼), width: 168, height: 168 });
    const el說明 = document.createElement('p');
    el說明.className = '小字';
    el說明.textContent = '掃描開啟這場活動的報到頁後，輸入本人姓名即可（報到碼已帶入）。';
    el.appendChild(el說明);
  } catch (err) {
    el.innerHTML = '<p class="小字">無法產生 QR Code（網路或擋廣告外掛），請改用複製網址。</p>';
  }
}


/**
 * ============================================================================
 * 函式名稱：處理報到按鈕
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：本分頁所有按鈕（由 event.js 的事件委派呼叫）。
 * 參數：el按鈕 {HTMLElement}
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 處理報到按鈕(el按鈕) {
  const str活動ID = el按鈕.dataset.活動;
  const obj活動 = 找活動(str活動ID);
  if (!obj活動) return;
  const fn位置 = function () { return 取得元素(`報到卡_${str活動ID}`); };
  const arr重載 = ['法會報到', '活動清單'];
  顯示區塊訊息(fn位置(), '');

  switch (el按鈕.dataset.動作) {
    case '開放報到':
      完成卡片操作(el按鈕, 'event.開放報到', { str活動ID: str活動ID }, arr重載, fn位置);
      break;

    case '暫停報到': {
      const bool = await 確認對話框(`暫停「${obj活動.str活動名稱}」報到？`,
        '<p>報到碼立即失效，報到志工無法再報到；報到紀錄都保留。</p><p>要再報到時按「開放報到」，會產生<strong>新的</strong>報到碼。</p>', '暫停報到');
      if (bool) 完成卡片操作(el按鈕, 'event.暫停報到', { str活動ID: str活動ID }, arr重載, fn位置);
      break;
    }

    case '更換報到碼': {
      const bool = await 確認對話框(`更換「${obj活動.str活動名稱}」的報到碼？`,
        '<p>報到碼外流時使用。換了之後，用舊報到碼登入的志工要重新輸入新的報到碼。</p>', '更換');
      if (bool) 完成卡片操作(el按鈕, 'event.更換報到碼', { str活動ID: str活動ID }, arr重載, fn位置);
      break;
    }

    case '複製報到網址': {
      const str碼 = (obj活動.obj報到 || {}).str報到碼 || '';
      const str文字 = `「${obj活動.str活動名稱}」報到\n報到連結（開啟後輸入本人姓名）：${報到網址(str碼)}\n報到碼：${str碼}`;
      try {
        await navigator.clipboard.writeText(str文字);
        顯示區塊訊息(fn位置(), '已複製這場活動的報到連結，可以貼到 LINE 給報到志工（開啟後輸入本人姓名即可）。', true);
      } catch (err) {
        顯示區塊訊息(fn位置(), `無法自動複製，請手動複製：\n${str文字}`, true);
      }
      break;
    }

    case '顯示QR':
      obj報到分頁.obj顯示QR[str活動ID] = !obj報到分頁.obj顯示QR[str活動ID];
      el按鈕.textContent = `${obj報到分頁.obj顯示QR[str活動ID] ? '隱藏' : '顯示'} QR Code`;
      if (obj報到分頁.obj顯示QR[str活動ID]) 畫QR(str活動ID);
      else 取得元素(`QR_${str活動ID}`).innerHTML = '';
      break;

    case '重讀場次':
      載入場次區(str活動ID);
      break;

    case '下載場次': {
      const str場次 = el按鈕.dataset.場次;
      const obj場 = obj報到分頁.obj場次[str活動ID] || {};
      const el時段 = 取得元素(`場次區_${str活動ID}`).querySelector('[name=報到時段]');
      const obj參數 = { str活動ID: str活動ID, str場次: str場次 };
      // 尚未設定時段時，連同畫面上的（系統建議或已修改的）時段一起儲存
      if (obj場.obj時段 && !obj場.obj時段.bool已設定 && el時段) obj參數.str報到時段 = el時段.value;
      await 執行操作(el按鈕, async function () {
        const obj結果 = await 呼叫平台('event.下載場次名冊', obj參數);
        if (obj參數.str報到時段 !== undefined) await 載入活動資料();
        obj報到分頁.obj場次[str活動ID] = await 呼叫平台('event.列出場次', { str活動ID: str活動ID });
        畫場次區(str活動ID);
        if (obj報到分頁.obj補登[str活動ID]) 開始補登(str活動ID, obj報到分頁.obj補登[str活動ID].str場次);
        顯示並捲到訊息(fn位置(), 組合結果訊息(obj結果), true);
      }, function (str訊息) { 顯示並捲到訊息(fn位置(), str訊息); });
      break;
    }

    case '列印報到表': {
      const str場次 = el按鈕.dataset.場次;
      await 執行操作(el按鈕, async function () {
        const obj結果 = await 呼叫平台('event.列印報到表', { str活動ID: str活動ID, str場次: str場次 });
        obj報到分頁.obj列印[str活動ID] = { str場次: str場次, str網址: obj結果.str列印網址 };
        畫場次區(str活動ID);
        if (obj報到分頁.obj補登[str活動ID]) 開始補登(str活動ID, obj報到分頁.obj補登[str活動ID].str場次);
        顯示並捲到訊息(fn位置(), 組合結果訊息(obj結果), true);
      }, function (str訊息) { 顯示並捲到訊息(fn位置(), str訊息); });
      break;
    }

    case '取消場次':
    case '恢復場次': {
      // v1.1.0：某一場次不舉行（例如颱風停課）／照常舉行
      const str場次 = el按鈕.dataset.場次;
      const bool恢復 = el按鈕.dataset.動作 === '恢復場次';
      const bool確定 = await 確認對話框(bool恢復 ? `恢復場次「${str場次}」？` : `取消場次「${str場次}」？`,
        bool恢復 ? '<p>恢復後這個場次可以照常報到。</p>'
          : `<p>取消後這個場次<strong>不能再報到</strong>（刷碼、打勾、補登都會擋下）；已有的報到紀錄保留，誤按可「恢復場次」。</p>
             <p>其他場次不受影響。整場活動不辦請到「一、活動清單」按「取消活動」；個別學員請假請在報到表格「未報到」勾「取消參加」。</p>
             <label class="欄位">取消原因（選填，例如：颱風停課）<input class="輸入" id="取消場次原因" maxlength="50" autocomplete="off"></label>`,
        bool恢復 ? '恢復場次' : '取消場次');
      const el原因 = 取得元素('取消場次原因');
      const str原因 = !bool恢復 && el原因 ? el原因.value.trim() : '';
      if (!bool確定) break;
      await 執行操作(el按鈕, async function () {
        const obj結果 = await 呼叫平台('event.取消場次', { str活動ID: str活動ID, str場次: str場次, bool恢復: bool恢復, str原因: str原因 });
        obj報到分頁.obj場次[str活動ID] = await 呼叫平台('event.列出場次', { str活動ID: str活動ID });
        畫場次區(str活動ID);
        if (obj報到分頁.obj補登[str活動ID]) 開始補登(str活動ID, obj報到分頁.obj補登[str活動ID].str場次);
        顯示並捲到訊息(fn位置(), obj結果.str訊息, true);
      }, function (str訊息) { 顯示並捲到訊息(fn位置(), str訊息); });
      break;
    }

    case '補登':
      開始補登(str活動ID, el按鈕.dataset.場次);
      取得元素(`補登區_${str活動ID}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;

    case '關閉補登': {
      const obj補 = obj報到分頁.obj補登[str活動ID];
      if (obj補 && obj補.obj元件) obj補.obj元件.停止();
      delete obj報到分頁.obj補登[str活動ID];
      取得元素(`補登區_${str活動ID}`).innerHTML = '';
      break;
    }

    default:
      break;
  }
}


/**
 * ============================================================================
 * 函式名稱：處理報到時段表單
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：儲存報到時段（event.儲存時段），成功後重讀場次與活動。
 * 參數：el表單 {HTMLFormElement}
 * 傳回：{Promise<void>}
 * ============================================================================
 */
/**
 * ============================================================================
 * 函式名稱：產生用齋登記表HTML
 * 版本：v1.1.0（2026-11-08）　v1.1.0：改為「名冊合併來源」卡片，加副會長回報表
 * ----------------------------------------------------------------------------
 * 用途：精舍管理員設定名冊的附加來源（每個精舍一份，所有活動共用）：用齋登記表、副會長回報表。
 *       目前值來自 event.讀取編號設定。
 * 參數：無
 * 傳回：{string}
 * ============================================================================
 */
function 產生用齋登記表HTML() {
  const obj設定 = obj頁面狀態.obj編號設定 || {};
  const fn網址 = function (str編號) { return str編號 ? `https://docs.google.com/spreadsheets/d/${str編號}/edit` : ''; };
  const fn表單 = function (str表單, str編號, str說明) {
    const str網址 = fn網址(str編號);
    return `<form data-報到表單="${str表單}" class="工具列" style="flex-wrap:wrap;gap:0.5rem;margin-top:0.4rem">
      <input class="輸入" name="網址" style="flex:1;min-width:16rem" placeholder="${str說明}" value="${跳脫HTML(str網址)}">
      <button type="submit" class="按鈕 小">${str編號 ? '更新並檢查' : '設定並檢查'}</button>
      ${str編號 ? `<a class="小字" href="${跳脫HTML(str網址)}" target="_blank" rel="noopener">開啟</a>` : ''}
    </form>`;
  };
  return `<section class="卡片" id="卡片_用齋登記表">
    <h3>名冊合併來源</h3>
    <p class="小字" style="margin:0 0 0.4rem">兩份都是<strong>選填</strong>：有設定哪一份，下載對內活動的場次名冊時就合併哪一份同一天的資料（每場活動可在場次區各自開關）；
      都不設定時名冊只用報名資料。試算表要分享給部署平台的帳號（檢視者即可）；清空網址再按「更新並檢查」＝不再使用。</p>
    <h4 style="margin:0.6rem 0 0;font-size:0.9375rem">副會長回報表 <span class="小字">（選填）</span></h4>
    <p class="小字" style="margin:0.2rem 0 0">一場一頁；日期寫在分頁名稱（例如「11/14」）或欄名上方的標題列。出席的人加入名冊（座位、執事印在備註）；不參加的人自動登記取消參加。</p>
    ${fn表單('副會長回報表', obj設定.str副會長回報表ID || '', '貼上副會長回報表網址（Google 試算表）')}
    <h4 style="margin:0.8rem 0 0;font-size:0.9375rem">用齋登記表 <span class="小字">（選填）</span></h4>
    <p class="小字" style="margin:0.2rem 0 0">每頁第一列寫日期與餐別（例如「11/9(一)午齋」）。義工加入名冊，備註印「大寮・午齋×2」。</p>
    ${fn表單('用齋登記表', obj設定.str用齋登記表ID || '', '貼上用齋登記表網址（https://docs.google.com/spreadsheets/d/…）')}
  </section>`;
}


/**
 * 用齋登記表表單：送出 event.設定用齋登記表（清空＝不使用），結果顯示在卡片（v1.3.0）
 */
async function 處理用齋登記表表單(el表單) {
  const fn位置 = function () { return 取得元素('卡片_用齋登記表'); };
  const el按鈕 = el表單.querySelector('button[type=submit]');
  // v1.4.0：同一個處理函式處理兩種登記表
  const str動作 = el表單.dataset.報到表單 === '副會長回報表' ? 'event.設定副會長回報表' : 'event.設定用齋登記表';
  await 執行操作(el按鈕, async function () {
    const obj結果 = await 呼叫平台(str動作, { str網址: el表單.querySelector('[name=網址]').value });
    try { obj頁面狀態.obj編號設定 = await 呼叫平台('event.讀取編號設定'); } catch (err) { /* 卡片仍可顯示 */ }
    畫法會報到();
    // 已展開過的場次區重新讀取，合併來源選項才會跟著出現或消失（v1.4.1）
    for (const str活動ID of Object.keys(obj報到分頁.obj場次 || {})) {
      try { obj報到分頁.obj場次[str活動ID] = await 呼叫平台('event.列出場次', { str活動ID: str活動ID }); 畫場次區(str活動ID); } catch (err) { /* 下次展開再讀 */ }
    }
    顯示並捲到訊息(fn位置(), 組合結果訊息(obj結果), true);
  }, function (str訊息) { 顯示並捲到訊息(fn位置(), str訊息); });
}


/**
 * 合併用齋表單：送出 event.設定合併用齋，重新讀取場次（v1.3.0）
 */
async function 處理合併用齋表單(el表單) {
  const str活動ID = el表單.dataset.活動;
  const fn位置 = function () { return 取得元素(`報到卡_${str活動ID}`); };
  const el按鈕 = el表單.querySelector('button[type=submit]');
  await 執行操作(el按鈕, async function () {
    const obj結果 = await 呼叫平台('event.設定合併用齋', {
      str活動ID: str活動ID, str用齋: el表單.querySelector('[name=用齋]').value,
      str副會長回報: el表單.querySelector('[name=副會長回報]').value      // v1.4.0
    });
    obj報到分頁.obj場次[str活動ID] = await 呼叫平台('event.列出場次', { str活動ID: str活動ID });
    畫場次區(str活動ID);
    顯示並捲到訊息(fn位置(), obj結果.str訊息, true);
  }, function (str訊息) { 顯示並捲到訊息(fn位置(), str訊息); });
}


async function 處理報到時段表單(el表單) {
  const str活動ID = el表單.dataset.活動;
  const fn位置 = function () { return 取得元素(`報到卡_${str活動ID}`); };
  const el按鈕 = el表單.querySelector('button[type=submit]');
  await 執行操作(el按鈕, async function () {
    const obj結果 = await 呼叫平台('event.儲存時段', { str活動ID: str活動ID, str報到時段: el表單.querySelector('[name=報到時段]').value });
    await 載入活動資料();
    obj報到分頁.obj場次[str活動ID] = await 呼叫平台('event.列出場次', { str活動ID: str活動ID });
    畫法會報到();
    顯示並捲到訊息(fn位置(), 組合結果訊息(obj結果), true);
  }, function (str訊息) { 顯示並捲到訊息(fn位置(), str訊息); });
}


/**
 * ============================================================================
 * 函式名稱：綁定法會報到事件
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：展開「場次名冊…」時讀取場次；報到時段表單送出。按鈕由 event.js 的委派呼叫 處理報到按鈕。
 * 參數：el清單 {HTMLElement} event.js 的「區塊清單」
 * 傳回：無
 * ============================================================================
 */
function 綁定法會報到事件(el清單) {
  el清單.addEventListener('toggle', function (e) {
    const el = e.target;
    if (!el.matches || !el.matches('details[data-報到展開]')) return;
    const str活動ID = el.dataset.報到展開;
    obj報到分頁.obj展開[str活動ID] = el.open;
    if (el.open && !obj報到分頁.obj場次[str活動ID]) 載入場次區(str活動ID);
    else if (el.open) 畫場次區(str活動ID);
    if (!el.open && obj報到分頁.obj補登[str活動ID]) {
      if (obj報到分頁.obj補登[str活動ID].obj元件) obj報到分頁.obj補登[str活動ID].obj元件.停止();
      delete obj報到分頁.obj補登[str活動ID];
    }
  }, true);
  el清單.addEventListener('submit', function (e) {
    const el表單 = e.target.closest('form[data-報到表單]');
    if (!el表單) return;
    e.preventDefault();
    if (el表單.dataset.報到表單 === '時段') 處理報到時段表單(el表單);
    if (el表單.dataset.報到表單 === '用齋') 處理合併用齋表單(el表單);
    if (el表單.dataset.報到表單 === '用齋登記表' || el表單.dataset.報到表單 === '副會長回報表') 處理用齋登記表表單(el表單);
  });
}
