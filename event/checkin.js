// ============================================================================
// 檔案名稱：event/checkin.js
// 所屬模組：法會活動（event）
// 所屬層級：前端／報到頁
// 檔案版本：v1.2.0（2026-11-07）
//   v1.2.0：取消（決策 AS～AU）：場次已取消時場次清單標「已取消」、預設選沒取消的場次；
//           已報到／未報到畫面的「取消」欄（還原成未報到、取消參加、恢復參加）由報到表格元件提供
//   v1.1.0：標籤增加「已報到」「未報到」：與「表格打勾」共用同一個表格元件，只切換篩選（不重新讀取）
// 用途說明：
//   報到頁（checkin.html）的畫面控制。分六段：
//     A. 工作階段保存 — 報到志工的工作階段另外保存（不載入 auth.js，不會蓋掉承辦人的 Google 登入）
//     B. 登入         — 報到碼＋本人姓名（姓名記在這台裝置，下次自動帶入）
//     C. 報到資訊     — 活動、今天的場次、時段（依目前時間自動選，每分鐘重算，手動切換後不再自動換）
//     D. 刷碼報到     — 掃碼槍（輸入框＋Enter）或鏡頭（瀏覽器支援條碼偵測時）；結果大字顯示；最近報到清單
//     E. 搜尋姓名／臨時報到 — 刷碼對不到時：在名冊找人（報到方式「搜尋姓名」），或新增未報名者（「臨時」）
//     F. 表格打勾、已報到、未報到 — 報到表格.js 元件（三個標籤共用一個元件，切換篩選）
//   決策：法會活動_法會報到_規劃.md 決策 L、P、Q、R、S、T、AA、AG～AM
//
// 相依檔案：core/shared/config.js、api.js、ui.js、event/報到表格.js
// ============================================================================

/* global 呼叫平台, 設定登入逾時處理, 取得元素, 跳脫HTML, 切換狀態, 顯示訊息, 取得錯誤訊息, 建立報到表格 */
/* exported 讀取工作階段代碼, 清除工作階段代碼 */


// ============================================================================
// A. 工作階段保存（api.js 會呼叫 讀取工作階段代碼／清除工作階段代碼）
// ============================================================================

const arr報到頁狀態區塊 = Object.freeze(['載入', '登入', '報到']);
const obj報到記憶體_ = {};

/**
 * 網址上的精舍代號（?site=）
 */
function 報到頁精舍代號() {
  return (new URLSearchParams(window.location.search).get('site') || '').trim().toUpperCase();
}

function 報到保存鍵_(str種類) {
  return `法會報到${str種類}_${報到頁精舍代號()}`;
}

function 讀取保存_(str鍵) {
  try { return window.localStorage.getItem(str鍵) || obj報到記憶體_[str鍵] || ''; } catch (err) { return obj報到記憶體_[str鍵] || ''; }
}

function 寫入保存_(str鍵, str值) {
  obj報到記憶體_[str鍵] = str值;
  try { if (str值) window.localStorage.setItem(str鍵, str值); else window.localStorage.removeItem(str鍵); } catch (err) { /* 只存在記憶體 */ }
}

/**
 * ============================================================================
 * 函式名稱：讀取工作階段代碼
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：api.js 呼叫平台時自動帶上（本頁不載入 auth.js，改由這裡提供報到志工的代碼）。
 * 參數：無
 * 傳回：{string|null}
 * ============================================================================
 */
function 讀取工作階段代碼() {
  return 讀取保存_(報到保存鍵_('工作階段')) || null;
}

/**
 * ============================================================================
 * 函式名稱：清除工作階段代碼
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：登出或報到碼失效時清除。
 * 參數：無
 * 傳回：無
 * ============================================================================
 */
function 清除工作階段代碼() {
  寫入保存_(報到保存鍵_('工作階段'), '');
}


// ============================================================================
// 頁面狀態
// ============================================================================
const obj報到頁 = {
  obj資訊: null,            // event.報到資訊
  str場次: '',
  int時段: 0,
  bool手動時段: false,
  str模式: '刷碼',
  obj表格: null,            // 報到表格元件
  arr最近: [],
  int時段計時: null,
  obj鏡頭: null,            // { obj串流, obj偵測, bool執行 }
  str裝置: (navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 60)
};


// ============================================================================
// B. 登入
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：啟動報到頁
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：開頁時綁定事件；有保存的工作階段就直接進入，否則顯示報到碼輸入。
 * 參數：無
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 啟動報到頁() {
  if (!報到頁精舍代號()) {
    切換狀態('載入', arr報到頁狀態區塊);
    取得元素('區_載入').textContent = '網址缺少精舍代號（?site=），請向承辦人索取正確的報到網址。';
    return;
  }
  設定登入逾時處理(function (str訊息) { 顯示報到登入(str訊息); });
  綁定報到事件();
  取得元素('輸入志工姓名').value = 讀取保存_(報到保存鍵_('姓名'));

  if (!讀取工作階段代碼()) { 顯示報到登入(); return; }
  切換狀態('載入', arr報到頁狀態區塊);
  try {
    await 進入報到();
  } catch (err) {
    if (err.str錯誤代碼 !== 'SESSION_EXPIRED') 顯示報到登入(取得錯誤訊息(err));
  }
}

/**
 * 顯示報到碼輸入畫面
 */
function 顯示報到登入(str提醒, bool一般) {
  停止報到畫面();
  顯示訊息(str提醒 || '', bool一般);
  切換狀態('登入', arr報到頁狀態區塊);
  const el = 取得元素('輸入報到碼');
  el.value = '';
  setTimeout(function () { el.focus(); }, 0);
}

/**
 * 送出報到碼
 */
async function 處理報到登入(e) {
  e.preventDefault();
  const str碼 = 取得元素('輸入報到碼').value.replace(/\s/g, '');
  const str姓名 = 取得元素('輸入志工姓名').value.trim();
  if (!/^[0-9]{6}$/.test(str碼)) { 顯示訊息('報到碼是 6 位數字，請再確認一次。'); return; }
  if (str姓名 === '') { 顯示訊息('請輸入您的姓名。'); 取得元素('輸入志工姓名').focus(); return; }
  const el按鈕 = 取得元素('登入按鈕');
  el按鈕.disabled = true;
  el按鈕.textContent = '確認中…';
  顯示訊息('');
  try {
    const obj結果 = await 呼叫平台('event.報到碼登入', { str精舍代號: 報到頁精舍代號(), str報到碼: str碼, str姓名: str姓名 }, { bool不帶工作階段: true });
    寫入保存_(報到保存鍵_('工作階段'), obj結果.str工作階段代碼);
    寫入保存_(報到保存鍵_('姓名'), str姓名);
    await 進入報到();
  } catch (err) {
    if (err.str錯誤代碼 !== 'SESSION_EXPIRED') 顯示訊息(取得錯誤訊息(err));
  } finally {
    el按鈕.disabled = false;
    el按鈕.textContent = '開始報到';
  }
}

/**
 * 結束報到（登出）
 */
async function 結束報到() {
  if (!window.confirm('結束報到？下次要再輸入報到碼。')) return;
  try { await 呼叫平台('驗證.登出'); } catch (err) { /* 後端失敗也照樣登出 */ }
  清除工作階段代碼();
  顯示報到登入('已結束報到。', true);
}


// ============================================================================
// C. 報到資訊
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：進入報到
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：讀取報到資訊並畫出：活動名稱、今天的場次（兩個以上才讓志工選）、時段、提醒。
 * 參數：無
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 進入報到() {
  const obj = await 呼叫平台('event.報到資訊');
  obj報到頁.obj資訊 = obj;
  document.title = `法會報到｜${obj.str活動名稱}`;
  取得元素('活動標題').textContent = `${obj.str精舍名稱 ? obj.str精舍名稱.replace(/精舍$/, '') : ''} ${obj.str活動名稱}`;
  取得元素('報到人員').textContent = `報到人員：${obj.str報到人員}`;
  const el提醒 = 取得元素('報到提醒');
  el提醒.textContent = obj.str提醒 || '';
  el提醒.hidden = !obj.str提醒;

  // 場次
  const arr場次 = obj.arr場次 || [];
  // 預設選第一個沒有取消的場次（都取消時選第一個，表格會顯示取消說明）（v1.2.0）
  const obj預設 = arr場次.filter(function (o) { return !o.obj取消; })[0] || arr場次[0];
  obj報到頁.str場次 = obj預設 ? obj預設.str場次 : obj.str今天;
  取得元素('場次選擇區').hidden = arr場次.length < 2;
  取得元素('選擇場次').innerHTML = arr場次.map(function (o) {
    return `<option value="${跳脫HTML(o.str場次)}" ${o.str場次 === obj報到頁.str場次 ? 'selected' : ''}>${跳脫HTML(o.str日期)}　${跳脫HTML(o.str場次)}（${Number(o.int人數)} 人）${o.obj取消 ? '（已取消）' : ''}</option>`;
  }).join('');
  取得元素('場次文字').textContent = arr場次.length === 1 ? `今天場次：${arr場次[0].str日期}　${arr場次[0].str場次}（名冊 ${arr場次[0].int人數} 人）${arr場次[0].obj取消 ? '（已取消）' : ''}`
    : (arr場次.length === 0 ? `今天（${obj.str今天}）尚未下載名冊` : '');

  // 時段
  const bool分時段 = (obj.arr時段 || []).length >= 2;
  取得元素('時段選擇區').hidden = !bool分時段;
  取得元素('選擇時段').innerHTML = (obj.arr時段 || []).map(function (o, i) {
    return `<option value="${i}">${跳脫HTML(o.str名稱)}　${跳脫HTML(o.str起迄)}</option>`;
  }).join('');
  obj報到頁.bool手動時段 = false;
  設定時段(obj.int目前時段, false);
  if (obj報到頁.int時段計時) clearInterval(obj報到頁.int時段計時);
  obj報到頁.int時段計時 = setInterval(自動換時段, 60000);

  切換狀態('報到', arr報到頁狀態區塊);
  顯示訊息('');
  切換模式(obj報到頁.str模式, true);
}

/**
 * 設定目前的時段（刷碼、新增未報名者都用這個）
 */
function 設定時段(int時段, bool手動) {
  obj報到頁.int時段 = Number(int時段) || 0;
  if (bool手動) obj報到頁.bool手動時段 = true;
  取得元素('選擇時段').value = String(obj報到頁.int時段);
  const o = (obj報到頁.obj資訊.arr時段 || [])[obj報到頁.int時段];
  取得元素('時段說明').textContent = obj報到頁.bool手動時段 ? '（手動選擇）' : '（依目前時間自動選擇）';
  if (obj報到頁.obj表格) obj報到頁.obj表格.設定目前時段(obj報到頁.int時段);
  return o;
}

/**
 * 每分鐘依時間重算時段（決策 AA）；手動選過就不再自動換
 */
function 自動換時段() {
  if (obj報到頁.bool手動時段 || !obj報到頁.obj資訊) return;
  const arr = obj報到頁.obj資訊.arr時段 || [];
  if (arr.length < 2) return;
  const d = new Date();
  const int分 = d.getHours() * 60 + d.getMinutes();
  let int序 = arr.length - 1;
  for (let i = 0; i < arr.length; i++) {
    const m = String(arr[i].str起迄 || '').match(/-(\d{1,2}):(\d{2})$/);
    if (m && int分 < Number(m[1]) * 60 + Number(m[2])) { int序 = i; break; }
  }
  if (int序 !== obj報到頁.int時段) 設定時段(int序, false);
}

/**
 * ============================================================================
 * 函式名稱：切換模式
 * 版本：v1.1.0（2026-11-07）　v1.1.0：加入「已報到」「未報到」
 * ----------------------------------------------------------------------------
 * 用途：切換「刷碼報到」「表格打勾」「已報到」「未報到」四個標籤。
 *       後三個共用同一個表格元件：已經讀取過就只切換篩選，不重新讀取（bool重新建立 時才重建，例如換場次）。
 * 參數：str模式 {string}；bool重新建立 {boolean} 選填
 * 傳回：無
 * ============================================================================
 */
function 切換模式(str模式, bool重新建立) {
  const obj篩選 = { 表格: '全部', 已報到: '已報到', 未報到: '未報到' };
  obj報到頁.str模式 = str模式;
  ['刷碼', '表格', '已報到', '未報到'].forEach(function (s) {
    取得元素(`模式_${s}`).setAttribute('aria-selected', s === str模式 ? 'true' : 'false');
  });
  取得元素('面板_刷碼').hidden = str模式 !== '刷碼';
  取得元素('面板_表格').hidden = str模式 === '刷碼';
  if (obj篩選[str模式]) {
    停止鏡頭();
    if (obj報到頁.obj表格 && !bool重新建立) { obj報到頁.obj表格.設定篩選(obj篩選[str模式]); return; }
    if (obj報到頁.obj表格) obj報到頁.obj表格.停止();
    obj報到頁.obj表格 = 建立報到表格({
      el容器: 取得元素('表格區'),
      fn呼叫: function (str動作, obj參數) { return 呼叫平台(str動作, obj參數); },
      str場次: obj報到頁.str場次,
      int目前時段: obj報到頁.int時段,
      str篩選: obj篩選[str模式],
      bool篩選標籤: false,          // 報到頁用上方的標籤切換
      fn通知: function (str訊息) { 加入最近(str訊息); }
    });
    obj報到頁.obj表格.載入();
  } else {
    if (obj報到頁.obj表格) { obj報到頁.obj表格.停止(); obj報到頁.obj表格 = null; }
    取得元素('輸入學員編號').focus();
  }
}

function 停止報到畫面() {
  停止鏡頭();
  if (obj報到頁.obj表格) { obj報到頁.obj表格.停止(); obj報到頁.obj表格 = null; }
  if (obj報到頁.int時段計時) { clearInterval(obj報到頁.int時段計時); obj報到頁.int時段計時 = null; }
}


// ============================================================================
// D. 刷碼報到
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：刷碼
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：送出學員編號 → 顯示結果卡（綠：已報名；黃：未報名或已報到過；紅：失敗）。
 *       掃碼槍會在讀完後送出 Enter，輸入框保持焦點可連續刷。
 * 參數：str編號 {string}
 * 傳回：{Promise<void>}
 * ============================================================================
 */
async function 刷碼(str編號) {
  const str碼 = String(str編號 || '').trim();
  if (str碼 === '') return;
  const el結果 = 取得元素('刷碼結果');
  el結果.innerHTML = `<div class="結果卡"><div class="狀態">${跳脫HTML(str碼)}　報到中…</div></div>`;
  try {
    const o = await 呼叫平台('event.刷碼報到', { str場次: obj報到頁.str場次, str學員編號: str碼, int時段: obj報到頁.int時段, str裝置: obj報到頁.str裝置 });
    const str類 = o.bool重複 ? '注意' : (o.str報名狀態 === '已報名' ? '成功' : '注意');
    el結果.innerHTML = `<div class="結果卡 ${str類}" role="status">
      <div class="大字">${跳脫HTML(o.str姓名 || '（待補姓名）')} <span style="font-size:1.125rem;font-weight:500">${跳脫HTML(o.str法名 || '')}</span></div>
      <div class="狀態">${o.bool重複 ? `已報到過（${跳脫HTML(o.str時間)}）` : `✓ ${跳脫HTML(o.str時段)} 報到完成　${跳脫HTML(o.str報名狀態)}`}</div>
      <div class="小字">${跳脫HTML(o.str學員編號)}${o.str報名登記 ? `　報名：${跳脫HTML(o.str報名登記)}` : ''}${o.str提醒 ? `　提醒：${跳脫HTML(o.str提醒)}` : ''}</div>
      ${o.bool待補姓名 ? '<div class="小字">學員名冊查不到這個編號，已記錄，承辦人會事後補姓名。也可以改用「搜尋姓名／臨時報到」。</div>' : ''}
    </div>`;
    加入最近(o.str訊息);
  } catch (err) {
    if (err.str錯誤代碼 === 'SESSION_EXPIRED') return;
    el結果.innerHTML = `<div class="結果卡 錯誤" role="alert"><div class="狀態">${跳脫HTML(str碼)}：${跳脫HTML(取得錯誤訊息(err))}</div></div>`;
  }
}

/**
 * 最近報到清單（最多 10 筆）
 */
function 加入最近(str訊息) {
  const d = new Date();
  obj報到頁.arr最近.unshift(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}　${str訊息}`);
  obj報到頁.arr最近 = obj報到頁.arr最近.slice(0, 10);
  取得元素('最近清單').innerHTML = obj報到頁.arr最近.map(function (s) { return `<li>${跳脫HTML(s)}</li>`; }).join('');
}

/**
 * 鏡頭掃描：瀏覽器支援條碼偵測（BarcodeDetector）時才顯示按鈕
 */
async function 開關鏡頭() {
  if (obj報到頁.obj鏡頭) { 停止鏡頭(); return; }
  const el畫面 = 取得元素('鏡頭畫面');
  try {
    const obj串流 = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    // eslint-disable-next-line no-undef
    const obj偵測 = new BarcodeDetector();
    obj報到頁.obj鏡頭 = { obj串流: obj串流, obj偵測: obj偵測, bool執行: true, str上次: '', int上次時間: 0 };
    el畫面.srcObject = obj串流;
    el畫面.hidden = false;
    await el畫面.play();
    取得元素('鏡頭按鈕').textContent = '關閉鏡頭';
    掃描一次();
  } catch (err) {
    停止鏡頭();
    顯示訊息('無法開啟鏡頭：請允許瀏覽器使用相機，或改用掃碼槍／手動輸入。');
  }
}

async function 掃描一次() {
  const obj = obj報到頁.obj鏡頭;
  if (!obj || !obj.bool執行) return;
  try {
    const arr = await obj.obj偵測.detect(取得元素('鏡頭畫面'));
    if (arr.length > 0) {
      const str值 = String(arr[0].rawValue || '').trim();
      // 同一張證 3 秒內不重複送
      if (str值 && (str值 !== obj.str上次 || Date.now() - obj.int上次時間 > 3000)) {
        obj.str上次 = str值;
        obj.int上次時間 = Date.now();
        刷碼(str值);
      }
    }
  } catch (err) { /* 單次偵測失敗略過 */ }
  setTimeout(掃描一次, 400);
}

function 停止鏡頭() {
  const obj = obj報到頁.obj鏡頭;
  if (!obj) return;
  obj.bool執行 = false;
  try { obj.obj串流.getTracks().forEach(function (t) { t.stop(); }); } catch (err) { /* 略過 */ }
  obj報到頁.obj鏡頭 = null;
  const el畫面 = 取得元素('鏡頭畫面');
  el畫面.hidden = true;
  el畫面.srcObject = null;
  取得元素('鏡頭按鈕').textContent = '用鏡頭掃描';
}


// ============================================================================
// E. 搜尋姓名／臨時報到
// ============================================================================

/**
 * 打開搜尋區
 */
function 開搜尋區() {
  const el = 取得元素('搜尋區');
  if (!el.hidden) { el.hidden = true; return; }
  el.hidden = false;
  const o時段 = (obj報到頁.obj資訊.arr時段 || [])[obj報到頁.int時段] || {};
  el.innerHTML = `<div class="報到表格"><div class="新增區"><h4>搜尋姓名報到（報到時段：${跳脫HTML(o時段.str名稱 || '')}）</h4>
    <div class="列"><label class="欄位">姓名或學員編號<input class="輸入" name="搜尋關鍵" autocomplete="off"></label>
      <button type="button" class="按鈕 小" data-搜尋="找">搜尋</button></div>
    <div class="搜尋結果"></div>
    <details><summary class="小字" style="cursor:pointer">找不到：臨時報到（填姓名，系統配發臨時編號）</summary>
      <div class="列" style="margin-top:0.5rem"><label class="欄位">姓名<input class="輸入" name="臨時姓名" autocomplete="off"></label>
        <label class="欄位">法名<input class="輸入" name="臨時法名" autocomplete="off"></label>
        <button type="button" class="按鈕 主要" data-搜尋="臨時">臨時報到</button></div></details>
    <div class="搜尋訊息"></div></div></div>`;
  el.querySelector('[name=搜尋關鍵]').focus();
}

/**
 * 搜尋：表格上的人 → 「報到」（搜尋姓名）；不在表格上的 → 「選擇並報到」（沿用編號）
 */
async function 搜尋報到人員(el按鈕) {
  const el區 = 取得元素('搜尋區');
  const str關鍵 = el區.querySelector('[name=搜尋關鍵]').value.trim();
  const el結果 = el區.querySelector('.搜尋結果');
  if (str關鍵 === '') { el結果.innerHTML = '<p class="訊息" role="alert">請輸入姓名或學員編號。</p>'; return; }
  el按鈕.disabled = true;
  el結果.innerHTML = '<p class="載入中">搜尋中…</p>';
  try {
    const o = await 呼叫平台('event.查詢報到人員', { str場次: obj報到頁.str場次, str關鍵字: str關鍵 });
    let str = '';
    if (o.arr表格.length > 0) {
      str += '<ul class="候選清單">' + o.arr表格.map(function (r) {
        return `<li><span>${跳脫HTML(r.str姓名 || '（待補姓名）')}<span class="小字">${跳脫HTML(r.str法名)}　第 ${Number(r.int序號)} 列${r.bool現場 ? '（現場）' : ''}</span></span>
          <button type="button" class="按鈕 小 主要" data-搜尋="報到" data-鍵="${跳脫HTML(r.str鍵)}" data-姓名="${跳脫HTML(r.str姓名)}">報到</button></li>`;
      }).join('') + '</ul>';
    }
    if (o.arr其他.length > 0) {
      str += '<p class="小字" style="margin:0.25rem 0">名冊沒有、但找得到學員編號（未報名）：</p><ul class="候選清單">' + o.arr其他.map(function (r) {
        return `<li><span>${跳脫HTML(r.str姓名)}<span class="小字">${跳脫HTML(r.str法名)}　${跳脫HTML(r.str學員編號)}（${跳脫HTML(r.str來源)}）</span></span>
          <button type="button" class="按鈕 小" data-搜尋="選擇" data-編號="${跳脫HTML(r.str學員編號)}" data-姓名="${跳脫HTML(r.str姓名)}" data-法名="${跳脫HTML(r.str法名)}">選擇並報到</button></li>`;
      }).join('') + '</ul>';
    }
    el結果.innerHTML = str || '<p class="小字">都找不到，請用下方「臨時報到」。</p>';
    if (!str) { el區.querySelector('details').open = true; if (!/\d/.test(str關鍵)) el區.querySelector('[name=臨時姓名]').value = str關鍵; }
  } catch (err) {
    el結果.innerHTML = `<p class="訊息" role="alert">${跳脫HTML(取得錯誤訊息(err))}</p>`;
  } finally {
    el按鈕.disabled = false;
  }
}

/**
 * 搜尋結果的「報到」「選擇並報到」與「臨時報到」
 */
async function 搜尋區報到(el按鈕) {
  const el區 = 取得元素('搜尋區');
  const el訊息 = el區.querySelector('.搜尋訊息');
  el按鈕.disabled = true;
  try {
    let str訊息;
    if (el按鈕.dataset.搜尋 === '報到') {
      const o = await 呼叫平台('event.表格報到', { str場次: obj報到頁.str場次, str人員鍵: el按鈕.dataset.鍵, int時段: obj報到頁.int時段,
        str方式: '搜尋姓名', str裝置: obj報到頁.str裝置 });
      str訊息 = o.str訊息;
    } else {
      const bool選擇 = el按鈕.dataset.搜尋 === '選擇';
      const str姓名 = bool選擇 ? el按鈕.dataset.姓名 : el區.querySelector('[name=臨時姓名]').value.trim();
      const str法名 = bool選擇 ? el按鈕.dataset.法名 : el區.querySelector('[name=臨時法名]').value.trim();
      if (str姓名 === '') { el訊息.innerHTML = '<p class="訊息" role="alert">請填姓名。</p>'; return; }
      const o = await 呼叫平台('event.新增現場報到', { str場次: obj報到頁.str場次, str姓名: str姓名, str法名: str法名,
        str學員編號: bool選擇 ? el按鈕.dataset.編號 : '', arr時段: [obj報到頁.int時段], str裝置: obj報到頁.str裝置 });
      if (!o.bool完成) {
        if (o.bool已在表格) {
          el訊息.innerHTML = `<p class="訊息" role="status">${跳脫HTML(o.str訊息)}</p>
            <button type="button" class="按鈕 小 主要" data-搜尋="報到" data-鍵="${跳脫HTML(o.str鍵)}">為這位報到</button>`;
        } else if (o.arr候選) {
          el訊息.innerHTML = `<p class="訊息" role="status">${跳脫HTML(o.str訊息)}</p><ul class="候選清單">${o.arr候選.map(function (r) {
            return `<li><span>${跳脫HTML(r.str姓名)}<span class="小字">${跳脫HTML(r.str法名)}　${跳脫HTML(r.str學員編號)}</span></span>
              <button type="button" class="按鈕 小" data-搜尋="選擇" data-編號="${跳脫HTML(r.str學員編號)}" data-姓名="${跳脫HTML(r.str姓名)}" data-法名="${跳脫HTML(r.str法名)}">是這位，報到</button></li>`;
          }).join('')}</ul>`;
        }
        return;
      }
      str訊息 = o.str訊息;
    }
    取得元素('刷碼結果').innerHTML = `<div class="結果卡 成功" role="status"><div class="狀態">${跳脫HTML(str訊息)}</div></div>`;
    加入最近(str訊息);
    el區.hidden = true;
    取得元素('輸入學員編號').focus();
  } catch (err) {
    if (err.str錯誤代碼 !== 'SESSION_EXPIRED') el訊息.innerHTML = `<p class="訊息" role="alert">${跳脫HTML(取得錯誤訊息(err))}</p>`;
  } finally {
    if (el按鈕.isConnected) el按鈕.disabled = false;
  }
}


// ============================================================================
// G. 事件
// ============================================================================

function 綁定報到事件() {
  取得元素('登入表單').addEventListener('submit', 處理報到登入);
  取得元素('登出按鈕').addEventListener('click', 結束報到);
  取得元素('刷碼表單').addEventListener('submit', function (e) {
    e.preventDefault();
    const el = 取得元素('輸入學員編號');
    const str = el.value;
    el.value = '';
    el.focus();
    刷碼(str);
  });
  取得元素('選擇時段').addEventListener('change', function (e) { 設定時段(e.target.value, true); 取得元素('輸入學員編號').focus(); });
  取得元素('選擇場次').addEventListener('change', function (e) {
    obj報到頁.str場次 = e.target.value;
    if (obj報到頁.obj表格) { obj報到頁.obj表格.停止(); obj報到頁.obj表格 = null; }
    if (obj報到頁.str模式 !== '刷碼') 切換模式(obj報到頁.str模式, true);
  });
  document.querySelector('.模式列').addEventListener('click', function (e) {
    const el = e.target.closest('[data-模式]');
    if (el) 切換模式(el.dataset.模式);
  });
  if ('BarcodeDetector' in window && navigator.mediaDevices) {
    取得元素('鏡頭按鈕').hidden = false;
    取得元素('鏡頭按鈕').addEventListener('click', 開關鏡頭);
  }
  取得元素('搜尋姓名按鈕').addEventListener('click', 開搜尋區);
  取得元素('搜尋區').addEventListener('click', function (e) {
    const el = e.target.closest('[data-搜尋]');
    if (!el) return;
    if (el.dataset.搜尋 === '找') 搜尋報到人員(el);
    else 搜尋區報到(el);
  });
  取得元素('搜尋區').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.name === '搜尋關鍵') { e.preventDefault(); 搜尋報到人員(取得元素('搜尋區').querySelector('[data-搜尋=找]')); }
  });
}

// 開頁即啟動
啟動報到頁();
