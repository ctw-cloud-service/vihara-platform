/**
 * ============================================================================
 * 檔案名稱：報表產生器.gs（整理副本範本的綁定指令碼）
 * 所屬層級：平台共用元件「報表產生器」的副本端（法會活動副本範本先使用）
 * 檔案版本：v1.0.0（2026-11-04）
 * 放置位置：「法會活動副本範本」→ 擴充功能 → Apps Script（與 Code.gs、報表.gs 放一起）
 * ----------------------------------------------------------------------------
 * 用途：
 *   在副本上方多一個「報表產生器」選單，承辦人不用寫條件，直接點選：
 *     新增報表分頁        建立一張報表分頁（上方設定區每格都是下拉選單）
 *     加入欄位 ▸          列出來源分頁的所有欄名，點一下就加到第 6 列（✓＝已加入）
 *     套用範本 ▸          把存過的報表設定套到報表分頁並立即產生
 *     產生報表            依目前報表分頁的設定產生
 *     重新產生全部報表    下載新報名後，一次更新所有報表分頁
 *     更新下拉選項        來源有新欄位或新值時，重新整理下拉選單與「加入欄位」清單
 *     存成範本            把目前報表分頁的設定存起來，下次直接套用
 *     報表產生器說明
 *
 *   報表分頁版面（與「報表.gs」相同，所以「報表 → 列印報表／下載列印用 PDF」可直接使用）：
 *     第 1 列   來源分頁｜條件關係｜排序 1～3（欄位＋遞增／遞減）
 *     第 2～3 列 條件 1～6（欄位｜比較｜值）
 *     第 4 列   報表名稱    第 5 列 人數    第 6 列 序號＋欄位標題    第 7 列起 資料
 *
 * 架構：
 *   本檔只負責選單、對話框與「儲存格下拉」的即時更新；產生報表、範本、建立分頁都交給平台
 *   （平台以系統帳號執行，並確認您是這份副本的精舍管理員或承辦人）。
 *   日後改良產生規則只要更新平台，所有副本立即生效。
 *
 * 安裝（範本只要做一次，之後複製出的副本都會有）：
 *   1. 範本 → 擴充功能 → Apps Script → 新增指令碼檔案「報表產生器」，貼上本檔全部內容。
 *   2. Code.gs 的 onOpen() 最後已有：if (typeof 建立報表產生器選單 === 'function') 建立報表產生器選單();
 *      （Code.gs v3.1.0 起內建；不要再新增第二個 onOpen）
 *   3. 本檔有 onEdit()：整份專案只能有一個 onEdit，若其他檔案也有，請合併。
 *
 * 相依：Code.gs 的 str平台網址、提示()、處理中()
 * ============================================================================
 */


/* ==================== 設定（須與平台 核心_報表產生器.gs 一致） ==================== */

const obj報表產生器 = Object.freeze({
  str選單名稱: '報表產生器',
  str標籤_來源: '來源分頁',
  str標籤_條件1: '條件1',
  str預設來源: '有效資料',
  str範本分頁: '報表範本',
  str屬性_欄位: '報表產生器_欄位清單',
  str屬性_範本: '報表產生器_範本清單',
  int欄位樁數: 80,           // 「加入欄位」子選單最多列出的欄位數（下方要有同樣數量的樁函式）
  int範本樁數: 30,           // 「套用範本」子選單最多列出的範本數
  int條件數: 6,
  int每列條件數: 3,
  int標題列: 6,
  int候選值上限: 300,
  str備註前綴: '來源欄：',
  arr非來源分頁: ['說明', '報表範本', '重複檢查', '點名欄位設定', '領隊代號']
});


/* ==================== 選單 ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：建立報表產生器選單
 * 版本：v1.0.0（2026-11-04）
 * 用途：
 *   建立「報表產生器」選單。「加入欄位」「套用範本」是動態子選單：
 *   開檔時讀目前分頁（是報表分頁就用它的來源，否則用「有效資料」）的欄名與「報表範本」分頁，
 *   存到文件屬性，點選時由樁函式依序號找回欄名／範本名稱。
 *   由 Code.gs 的 onOpen() 呼叫；加入欄位、更新下拉後也會重建（更新 ✓）。
 *   開檔時（簡易觸發條件）不能連線平台，所以這裡只讀本試算表。
 * 參數：無
 * 傳回：無
 * ----------------------------------------------------------------------------
 */
function 建立報表產生器選單() {
  const obj介面 = SpreadsheetApp.getUi();
  const obj選單 = obj介面.createMenu(obj報表產生器.str選單名稱)
    .addItem('新增報表分頁', '選單_報表產生器新增分頁');

  // ── 加入欄位 ▸ ──
  const obj欄位選單 = obj介面.createMenu('加入欄位');
  let arr欄位 = [];
  let arr已加入 = [];
  let str來源 = obj報表產生器.str預設來源;
  try {
    const obj試算表 = SpreadsheetApp.getActiveSpreadsheet();
    const obj分頁 = obj試算表.getActiveSheet();
    if (報表產生器_是報表分頁_(obj分頁)) {
      str來源 = String(obj分頁.getRange(1, 2).getDisplayValue()).trim() || str來源;
      arr已加入 = 報表產生器_已加入欄位_(obj分頁);
    }
    arr欄位 = 報表產生器_來源欄名_(obj試算表, str來源);
  } catch (err) {
    console.warn('讀取欄位清單失敗：' + (err && err.message ? err.message : err));
  }
  報表產生器_存屬性_(obj報表產生器.str屬性_欄位, arr欄位.slice(0, obj報表產生器.int欄位樁數));
  if (arr欄位.length === 0) {
    obj欄位選單.addItem('（來源「' + str來源 + '」沒有欄位）', '選單_報表產生器說明');
  } else {
    arr欄位.slice(0, obj報表產生器.int欄位樁數).forEach(function (str, i) {
      obj欄位選單.addItem((arr已加入.indexOf(str) !== -1 ? '✓ ' : '　 ') + str, '報表產生器加入欄位' + 報表產生器_兩位數_(i + 1));
    });
    if (arr欄位.length > obj報表產生器.int欄位樁數) {
      obj欄位選單.addItem('（其餘 ' + (arr欄位.length - obj報表產生器.int欄位樁數) + ' 個欄位請在第 6 列下拉選擇）', '選單_報表產生器說明');
    }
  }
  obj選單.addSubMenu(obj欄位選單);

  // ── 套用範本 ▸ ──
  const obj範本選單 = obj介面.createMenu('套用範本');
  let arr範本 = [];
  try { arr範本 = 報表產生器_範本名稱們_(SpreadsheetApp.getActiveSpreadsheet()); } catch (err) { arr範本 = []; }
  報表產生器_存屬性_(obj報表產生器.str屬性_範本, arr範本.slice(0, obj報表產生器.int範本樁數));
  if (arr範本.length === 0) {
    obj範本選單.addItem('（還沒有範本，可用「存成範本」建立）', '選單_報表產生器說明');
  } else {
    arr範本.slice(0, obj報表產生器.int範本樁數).forEach(function (str, i) {
      obj範本選單.addItem(str, '報表產生器套用範本' + 報表產生器_兩位數_(i + 1));
    });
  }
  obj選單.addSubMenu(obj範本選單);

  obj選單.addSeparator()
    .addItem('產生報表', '選單_報表產生器產生')
    .addItem('重新產生全部報表', '選單_報表產生器重新產生全部')
    .addItem('更新下拉選項', '選單_報表產生器更新下拉')
    .addSeparator()
    .addItem('存成範本', '選單_報表產生器存成範本')
    .addItem('報表產生器說明', '選單_報表產生器說明')
    .addToUi();
}


/* ==================== 選單動作 ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_報表產生器新增分頁
 * 版本：v1.0.0（2026-11-04）
 * 用途：詢問報表名稱（可留空＝報表1、報表2…）→ 平台建立報表分頁 → 切換過去並重建選單。
 * ----------------------------------------------------------------------------
 */
function 選單_報表產生器新增分頁() {
  const obj介面 = SpreadsheetApp.getUi();
  const obj回覆 = obj介面.prompt('新增報表分頁',
    '請輸入報表名稱（也是分頁名稱，例如「香積組名冊」）。\n留空會自動命名為「報表1」「報表2」…', obj介面.ButtonSet.OK_CANCEL);
  if (obj回覆.getSelectedButton() !== obj介面.Button.OK) return;

  處理中('正在建立報表分頁…');
  const obj結果 = 呼叫報表平台_('新增分頁', { str分頁名稱: String(obj回覆.getResponseText() || '').trim() });
  if (!obj結果.bool成功) { 提示('無法新增報表分頁', obj結果.str訊息); return; }
  報表產生器_切換分頁_(obj結果.int分頁ID);
  報表產生器_安全重建選單_();
  提示('已新增報表分頁', obj結果.str訊息);
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_報表產生器產生
 * 版本：v1.0.0（2026-11-04）
 * 用途：產生目前報表分頁。完成後選取 A4 起的列印範圍（同「報表」選單）。
 * ----------------------------------------------------------------------------
 */
function 選單_報表產生器產生() {
  const obj分頁 = 報表產生器_目前報表分頁_();
  if (!obj分頁) return;
  if (typeof 還原列印設定_ === 'function') { try { 還原列印設定_(obj分頁); } catch (err) { /* 沒有列印記錄時略過 */ } }
  處理中('正在產生報表…');
  const obj結果 = 呼叫報表平台_('產生', { int分頁ID: obj分頁.getSheetId() });
  if (obj結果.bool成功 && typeof 取得列印範圍_ === 'function') {
    try { SpreadsheetApp.flush(); obj分頁.setActiveRange(取得列印範圍_(obj分頁)); } catch (err) { /* 選取失敗不影響報表 */ }
  }
  提示(obj結果.bool成功 ? '報表已產生' : '無法產生報表',
    obj結果.str訊息 + (obj結果.bool成功 ? '\n\n列印：「報表 → 列印報表」或「下載列印用 PDF」。' : ''));
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_報表產生器重新產生全部
 * 版本：v1.0.0（2026-11-04）
 * 用途：一次重新產生副本中所有報表分頁（下載新報名後使用）。
 * ----------------------------------------------------------------------------
 */
function 選單_報表產生器重新產生全部() {
  處理中('正在重新產生全部報表…');
  const obj結果 = 呼叫報表平台_('重新產生全部', {});
  提示(obj結果.bool成功 ? '重新產生完成' : '無法重新產生',
    obj結果.str訊息 + (obj結果.arr明細 && obj結果.arr明細.length ? '\n\n' + obj結果.arr明細.join('\n') : ''));
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_報表產生器更新下拉
 * 版本：v1.0.0（2026-11-04）
 * 用途：重新設定目前報表分頁的下拉選單，並重建「加入欄位」「套用範本」子選單。
 * ----------------------------------------------------------------------------
 */
function 選單_報表產生器更新下拉() {
  const obj分頁 = 報表產生器_目前報表分頁_();
  if (!obj分頁) return;
  處理中('正在更新下拉選項…');
  const obj結果 = 呼叫報表平台_('更新下拉', { int分頁ID: obj分頁.getSheetId() });
  報表產生器_安全重建選單_();
  提示(obj結果.bool成功 ? '已更新' : '無法更新', obj結果.str訊息);
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_報表產生器存成範本
 * 版本：v1.0.0（2026-11-04）
 * 用途：把目前報表分頁的設定存成範本（同名會更新）。
 * ----------------------------------------------------------------------------
 */
function 選單_報表產生器存成範本() {
  const obj分頁 = 報表產生器_目前報表分頁_();
  if (!obj分頁) return;
  const obj介面 = SpreadsheetApp.getUi();
  const obj回覆 = obj介面.prompt('存成範本',
    '請輸入範本名稱（例如「香積組報到名冊」）。\n與既有範本同名時會更新該範本。', obj介面.ButtonSet.OK_CANCEL);
  if (obj回覆.getSelectedButton() !== obj介面.Button.OK) return;
  const str名稱 = String(obj回覆.getResponseText() || '').trim();
  if (str名稱 === '') { 提示('沒有存檔', '範本名稱不可空白。'); return; }

  處理中('正在存成範本…');
  const obj結果 = 呼叫報表平台_('存成範本', { int分頁ID: obj分頁.getSheetId(), str範本名稱: str名稱 });
  報表產生器_安全重建選單_();
  提示(obj結果.bool成功 ? '已存成範本' : '無法存成範本', obj結果.str訊息);
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：報表產生器_套用範本_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * 用途：套用第 int序 個範本：目前是報表分頁時詢問「覆蓋目前分頁」或「新增一張」。
 * 參數：int序 {number} 1 起算
 * ----------------------------------------------------------------------------
 */
function 報表產生器_套用範本_(int序) {
  const str名稱 = 報表產生器_讀屬性_(obj報表產生器.str屬性_範本)[int序 - 1];
  if (!str名稱) { 提示('找不到範本', '範本清單已變更，請重新開啟試算表後再選一次。'); return; }

  const obj介面 = SpreadsheetApp.getUi();
  const obj分頁 = SpreadsheetApp.getActiveSheet();
  const obj參數 = { str範本名稱: str名稱 };
  if (報表產生器_是報表分頁_(obj分頁)) {
    const obj回覆 = obj介面.alert('套用範本「' + str名稱 + '」',
      '要套用到哪裡？\n\n「是」＝覆蓋目前的報表分頁「' + obj分頁.getName() + '」\n「否」＝新增一張報表分頁', obj介面.ButtonSet.YES_NO_CANCEL);
    if (obj回覆 === obj介面.Button.CANCEL || obj回覆 === obj介面.Button.CLOSE) return;
    if (obj回覆 === obj介面.Button.YES) obj參數.int分頁ID = obj分頁.getSheetId();
  }

  處理中('正在套用範本並產生報表…');
  const obj結果 = 呼叫報表平台_('套用範本', obj參數);
  if (obj結果.bool成功) { 報表產生器_切換分頁_(obj結果.int分頁ID); 報表產生器_安全重建選單_(); }
  提示(obj結果.bool成功 ? '已套用範本' : '無法套用範本', obj結果.str訊息);
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：報表產生器_加入欄位_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * 用途：把第 int序 個欄名加到目前報表分頁第 6 列第一個空格（已加入時提醒，不重複加）。
 *       只改本試算表，不連線平台。
 * 參數：int序 {number} 1 起算
 * ----------------------------------------------------------------------------
 */
function 報表產生器_加入欄位_(int序) {
  const obj分頁 = 報表產生器_目前報表分頁_();
  if (!obj分頁) return;
  const str欄名 = 報表產生器_讀屬性_(obj報表產生器.str屬性_欄位)[int序 - 1];
  if (!str欄名) { 提示('找不到欄位', '欄位清單已變更，請按「報表產生器 → 更新下拉選項」後再選一次。'); return; }
  if (報表產生器_已加入欄位_(obj分頁).indexOf(str欄名) !== -1) {
    SpreadsheetApp.getActiveSpreadsheet().toast('「' + str欄名 + '」已經在報表中。', '報表產生器', 4);
    return;
  }
  const int欄 = 報表產生器_第六列下一空欄_(obj分頁);
  if (int欄 > obj分頁.getMaxColumns()) obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), int欄 - obj分頁.getMaxColumns());
  obj分頁.getRange(obj報表產生器.int標題列, int欄).setValue(str欄名).clearNote();
  obj分頁.getRange(obj報表產生器.int標題列, int欄).activate();
  報表產生器_安全重建選單_();
  SpreadsheetApp.getActiveSpreadsheet().toast('已加入「' + str欄名 + '」。要改顯示名稱，請把格子改成「' + str欄名 + ' → 新名稱」。', '報表產生器', 6);
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_報表產生器說明
 * 版本：v1.0.0（2026-11-04）
 * 用途：顯示操作說明。
 * ----------------------------------------------------------------------------
 */
function 選單_報表產生器說明() {
  提示('報表產生器說明',
    '【建立報表】\n' +
    '1. 報表產生器 → 新增報表分頁（輸入報表名稱）\n' +
    '2. 報表產生器 → 加入欄位，依序點選要顯示的欄位（也可在第 6 列下拉選）\n' +
    '3. 上方黃色設定區（列印時不會印出）：\n' +
    '   · 來源分頁：通常是「有效資料」\n' +
    '   · 條件 1～6：選欄位 → 選比較方式 → 選值（值會列出該欄實際出現過的內容）\n' +
    '   · 條件關係：全部符合（且）／任一符合（或）\n' +
    '   · 排序 1～3：選欄位與遞增／遞減\n' +
    '4. 報表產生器 → 產生報表\n\n' +
    '【小技巧】\n' +
    '· 改欄位顯示名稱：第 6 列輸入「護七_組別 → 組別」\n' +
    '· 要空白欄（例如簽到）：第 6 列直接輸入「簽到」\n' +
    '· 介於：值寫「1~5」或「2026/11/1~2026/11/30」\n' +
    '· Excel寫法：值照 Excel 進階篩選寫，例如 >=5、<>自行、*蓮*\n' +
    '· 下載新報名後：報表產生器 → 重新產生全部報表\n' +
    '· 常用的報表：存成範本，下次「套用範本」一鍵產生\n\n' +
    '【列印】用「報表 → 列印報表」或「下載列印用 PDF」（從第 4 列起列印）。');
}


/* ==================== 儲存格下拉的即時更新（簡易觸發條件） ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：onEdit
 * 版本：v1.0.0（2026-11-04）
 * 用途：
 *   只處理報表分頁：
 *     · 改了來源分頁（B1）→ 條件、排序、第 6 列的欄位下拉改成新來源的欄名
 *     · 改了某個條件的欄位 → 該條件「值」的下拉改成這個欄位實際出現過的值；比較方式空白時填「等於」
 *     · 改了第 6 列 → 清掉該格舊的「來源欄：」備註（以新輸入為準）
 *   簡易觸發條件不能連線平台，只改本試算表；失敗時靜默略過（不影響輸入）。
 * 參數：e {Object} 編輯事件
 * ----------------------------------------------------------------------------
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const obj格 = e.range;
    const obj分頁 = obj格.getSheet();
    if (!報表產生器_是報表分頁_(obj分頁)) return;
    const int列 = obj格.getRow();
    const int欄 = obj格.getColumn();
    const obj試算表 = obj分頁.getParent();

    // ① 來源分頁
    if (int列 === 1 && int欄 === 2) {
      const arr欄名 = 報表產生器_來源欄名_(obj試算表, String(obj格.getDisplayValue()).trim());
      報表產生器_設定欄位下拉_(obj分頁, arr欄名);
      return;
    }

    // ② 條件的欄位（第 2～3 列，欄位欄＝2、6、10）
    if ((int列 === 2 || int列 === 3) && (int欄 - 2) % 4 === 0 && int欄 <= 10) {
      const str欄位 = String(obj格.getDisplayValue()).trim();
      const obj值格 = obj分頁.getRange(int列, int欄 + 2);
      const obj比較格 = obj分頁.getRange(int列, int欄 + 1);
      if (str欄位 === '') { obj值格.clearDataValidations(); return; }
      if (String(obj比較格.getDisplayValue()).trim() === '') obj比較格.setValue('等於');
      const str來源 = String(obj分頁.getRange(1, 2).getDisplayValue()).trim() || obj報表產生器.str預設來源;
      const arr值 = 報表產生器_欄位候選值_(obj試算表, str來源, str欄位);
      if (arr值.length > 0) {
        obj值格.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(arr值, true).setAllowInvalid(true).build());
      } else {
        obj值格.clearDataValidations();
      }
      return;
    }

    // ③ 第 6 列標題
    if (int列 === obj報表產生器.int標題列 && int欄 >= 2) {
      obj格.clearNote();
    }
  } catch (err) {
    console.warn('報表產生器 onEdit 略過：' + (err && err.message ? err.message : err));
  }
}


/* ==================== 與平台連線 ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：呼叫報表平台_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * 用途：送出 { action: 'report.' + 動作, 參數: { str存取權杖, str副本ID, … } }；
 *       網路或伺服器錯誤一律轉成 { bool成功: false, str訊息 }。
 * 參數：str動作 {string}；obj額外參數 {Object}
 * 傳回：{Object}
 * ----------------------------------------------------------------------------
 */
function 呼叫報表平台_(str動作, obj額外參數) {
  const obj參數 = Object.assign({
    str存取權杖: ScriptApp.getOAuthToken(),
    str副本ID: SpreadsheetApp.getActiveSpreadsheet().getId()
  }, obj額外參數 || {});
  try {
    const obj回應 = UrlFetchApp.fetch(str平台網址, {
      method: 'post', contentType: 'text/plain',
      payload: JSON.stringify({ action: 'report.' + str動作, token: '', 參數: obj參數 }),
      muteHttpExceptions: true, followRedirects: true
    });
    if (obj回應.getResponseCode() !== 200) {
      return { bool成功: false, str訊息: '系統暫時沒有回應（代碼 ' + obj回應.getResponseCode() + '），請稍後再試。若一直發生，請聯絡精舍管理員。' };
    }
    try { return JSON.parse(obj回應.getContentText()); } catch (err) {
      return { bool成功: false, str訊息: '系統回傳的內容無法辨識，可能平台尚未更新報表產生器，請聯絡系統管理員。' };
    }
  } catch (err) {
    return { bool成功: false, str訊息: '連線到系統失敗：' + (err && err.message ? err.message : err) + '\n請確認網路正常後再試。' };
  }
}


/* ==================== 小工具 ==================== */

/** 函式名稱：報表產生器_是報表分頁_　版本：v1.0.0　用途：A1＝「來源分頁」且 A2＝「條件1」即為報表分頁（簡易觸發條件也能判斷） */
function 報表產生器_是報表分頁_(obj分頁) {
  if (!obj分頁 || obj分頁.getMaxRows() < 2) return false;
  const arr = obj分頁.getRange(1, 1, 2, 1).getDisplayValues();
  return String(arr[0][0]).trim() === obj報表產生器.str標籤_來源 && String(arr[1][0]).trim() === obj報表產生器.str標籤_條件1;
}

/** 函式名稱：報表產生器_目前報表分頁_　版本：v1.0.0　用途：目前分頁是報表分頁就傳回，否則提示並傳回 null */
function 報表產生器_目前報表分頁_() {
  const obj分頁 = SpreadsheetApp.getActiveSheet();
  if (報表產生器_是報表分頁_(obj分頁)) return obj分頁;
  提示('請先切換到報表分頁', '「' + obj分頁.getName() + '」不是報表分頁。\n請切換到報表分頁，或先用「報表產生器 → 新增報表分頁」建立一張。');
  return null;
}

/** 函式名稱：報表產生器_來源欄名_　版本：v1.0.0　用途：來源分頁第 1 列的欄名（去空白、去重複）；找不到分頁傳回 [] */
function 報表產生器_來源欄名_(obj試算表, str來源) {
  const obj來源 = obj試算表.getSheetByName(str來源);
  if (!obj來源 || obj來源.getLastColumn() < 1) return [];
  return obj來源.getRange(1, 1, 1, obj來源.getLastColumn()).getDisplayValues()[0]
    .map(function (s) { return String(s).trim(); })
    .filter(function (s, i, a) { return s !== '' && a.indexOf(s) === i; });
}

/** 函式名稱：報表產生器_欄位候選值_　版本：v1.0.0　用途：某欄實際出現過的值（不重複，最多 300 個） */
function 報表產生器_欄位候選值_(obj試算表, str來源, str欄名) {
  const obj來源 = obj試算表.getSheetByName(str來源);
  if (!obj來源 || obj來源.getLastRow() < 2) return [];
  const arr標題 = obj來源.getRange(1, 1, 1, obj來源.getLastColumn()).getDisplayValues()[0].map(function (s) { return String(s).trim(); });
  const int欄 = arr標題.indexOf(str欄名);
  if (int欄 === -1) return [];
  const obj已有 = {};
  const arr = [];
  obj來源.getRange(2, int欄 + 1, obj來源.getLastRow() - 1, 1).getDisplayValues().forEach(function (r) {
    const s = String(r[0]).trim();
    if (s !== '' && !obj已有[s]) { obj已有[s] = true; arr.push(s); }
  });
  arr.sort(function (a, b) { return a.localeCompare(b, 'zh-Hant'); });
  return arr.slice(0, obj報表產生器.int候選值上限);
}

/** 函式名稱：報表產生器_設定欄位下拉_　版本：v1.0.0　用途：條件、排序、第 6 列的欄位下拉改成指定欄名 */
function 報表產生器_設定欄位下拉_(obj分頁, arr欄名) {
  const obj驗證 = arr欄名.length > 0 ? SpreadsheetApp.newDataValidation().requireValueInList(arr欄名.slice(0, 500), true).setAllowInvalid(false).build() : null;
  const obj可輸入 = arr欄名.length > 0 ? SpreadsheetApp.newDataValidation().requireValueInList(arr欄名.slice(0, 500), true).setAllowInvalid(true).build() : null;
  const fn套 = function (obj格, o) { if (o) obj格.setDataValidation(o); else obj格.clearDataValidations(); };
  [6, 9, 12].forEach(function (c) { fn套(obj分頁.getRange(1, c), obj驗證); });                       // 排序 1～3 欄位
  [2, 3].forEach(function (r) { [2, 6, 10].forEach(function (c) { fn套(obj分頁.getRange(r, c), obj驗證); }); });   // 條件欄位
  const int數 = Math.max(obj分頁.getLastColumn() - 1, 20);
  fn套(obj分頁.getRange(obj報表產生器.int標題列, 2, 1, Math.min(int數, obj分頁.getMaxColumns() - 1)), obj可輸入);
}

/** 函式名稱：報表產生器_已加入欄位_　版本：v1.0.0　用途：第 6 列已加入的來源欄名（看「→」與「來源欄：」備註） */
function 報表產生器_已加入欄位_(obj分頁) {
  const int末欄 = obj分頁.getLastColumn();
  if (int末欄 < 2) return [];
  const obj範圍 = obj分頁.getRange(obj報表產生器.int標題列, 2, 1, int末欄 - 1);
  const arr文字 = obj範圍.getDisplayValues()[0];
  const arr備註 = obj範圍.getNotes()[0];
  const arr = [];
  for (let i = 0; i < arr文字.length; i++) {
    const s = String(arr文字[i]).trim();
    if (s === '') break;
    const arr箭頭 = s.split(/\s*(?:→|->|＞|>)\s*/);
    const str註 = String(arr備註[i] || '');
    if (arr箭頭.length >= 2 && arr箭頭[0] !== '') arr.push(arr箭頭[0]);
    else if (str註.indexOf(obj報表產生器.str備註前綴) === 0) arr.push(str註.substring(obj報表產生器.str備註前綴.length).trim());
    else arr.push(s);
  }
  return arr;
}

/** 函式名稱：報表產生器_第六列下一空欄_　版本：v1.0.0　用途：第 6 列 B 欄起第一個空格的欄號 */
function 報表產生器_第六列下一空欄_(obj分頁) {
  const int末欄 = Math.max(obj分頁.getLastColumn(), 2);
  const arr = obj分頁.getRange(obj報表產生器.int標題列, 2, 1, int末欄).getDisplayValues()[0];
  for (let i = 0; i < arr.length; i++) if (String(arr[i]).trim() === '') return i + 2;
  return int末欄 + 2;
}

/** 函式名稱：報表產生器_範本名稱們_　版本：v1.0.0　用途：隱藏分頁「報表範本」A 欄的範本名稱 */
function 報表產生器_範本名稱們_(obj試算表) {
  const obj分頁 = obj試算表.getSheetByName(obj報表產生器.str範本分頁);
  if (!obj分頁 || obj分頁.getLastRow() < 2) return [];
  return obj分頁.getRange(2, 1, obj分頁.getLastRow() - 1, 1).getDisplayValues()
    .map(function (r) { return String(r[0]).trim(); }).filter(function (s) { return s !== ''; });
}

/** 函式名稱：報表產生器_切換分頁_　版本：v1.0.0　用途：依分頁 ID 切換到該分頁並選 A4 */
function 報表產生器_切換分頁_(int分頁ID) {
  const obj試算表 = SpreadsheetApp.getActiveSpreadsheet();
  const obj分頁 = obj試算表.getSheets().filter(function (o) { return o.getSheetId() === Number(int分頁ID); })[0];
  if (obj分頁) { obj試算表.setActiveSheet(obj分頁); obj分頁.getRange('B6').activate(); }
}

/** 函式名稱：報表產生器_安全重建選單_　版本：v1.0.0　用途：重建選單（更新 ✓ 與範本清單）；失敗不影響操作 */
function 報表產生器_安全重建選單_() {
  try { 建立報表產生器選單(); } catch (err) { console.warn('重建報表產生器選單失敗：' + err.message); }
}

/** 函式名稱：報表產生器_存屬性_／報表產生器_讀屬性_　版本：v1.0.0　用途：文件屬性存取清單（JSON） */
function 報表產生器_存屬性_(str鍵, arr) {
  try { PropertiesService.getDocumentProperties().setProperty(str鍵, JSON.stringify(arr || [])); } catch (err) { console.warn('存屬性失敗：' + err.message); }
}
function 報表產生器_讀屬性_(str鍵) {
  try { return JSON.parse(PropertiesService.getDocumentProperties().getProperty(str鍵) || '[]'); } catch (err) { return []; }
}

/** 函式名稱：報表產生器_兩位數_　版本：v1.0.0　用途：1 → '01' */
function 報表產生器_兩位數_(int) { return (int < 10 ? '0' : '') + int; }


/* ==================== 動態子選單的樁函式（選單只能呼叫有名字的函式，所以逐一列出） ==================== */
/* 「加入欄位」01～80 */
function 報表產生器加入欄位01() { 報表產生器_加入欄位_(1); }
function 報表產生器加入欄位02() { 報表產生器_加入欄位_(2); }
function 報表產生器加入欄位03() { 報表產生器_加入欄位_(3); }
function 報表產生器加入欄位04() { 報表產生器_加入欄位_(4); }
function 報表產生器加入欄位05() { 報表產生器_加入欄位_(5); }
function 報表產生器加入欄位06() { 報表產生器_加入欄位_(6); }
function 報表產生器加入欄位07() { 報表產生器_加入欄位_(7); }
function 報表產生器加入欄位08() { 報表產生器_加入欄位_(8); }
function 報表產生器加入欄位09() { 報表產生器_加入欄位_(9); }
function 報表產生器加入欄位10() { 報表產生器_加入欄位_(10); }
function 報表產生器加入欄位11() { 報表產生器_加入欄位_(11); }
function 報表產生器加入欄位12() { 報表產生器_加入欄位_(12); }
function 報表產生器加入欄位13() { 報表產生器_加入欄位_(13); }
function 報表產生器加入欄位14() { 報表產生器_加入欄位_(14); }
function 報表產生器加入欄位15() { 報表產生器_加入欄位_(15); }
function 報表產生器加入欄位16() { 報表產生器_加入欄位_(16); }
function 報表產生器加入欄位17() { 報表產生器_加入欄位_(17); }
function 報表產生器加入欄位18() { 報表產生器_加入欄位_(18); }
function 報表產生器加入欄位19() { 報表產生器_加入欄位_(19); }
function 報表產生器加入欄位20() { 報表產生器_加入欄位_(20); }
function 報表產生器加入欄位21() { 報表產生器_加入欄位_(21); }
function 報表產生器加入欄位22() { 報表產生器_加入欄位_(22); }
function 報表產生器加入欄位23() { 報表產生器_加入欄位_(23); }
function 報表產生器加入欄位24() { 報表產生器_加入欄位_(24); }
function 報表產生器加入欄位25() { 報表產生器_加入欄位_(25); }
function 報表產生器加入欄位26() { 報表產生器_加入欄位_(26); }
function 報表產生器加入欄位27() { 報表產生器_加入欄位_(27); }
function 報表產生器加入欄位28() { 報表產生器_加入欄位_(28); }
function 報表產生器加入欄位29() { 報表產生器_加入欄位_(29); }
function 報表產生器加入欄位30() { 報表產生器_加入欄位_(30); }
function 報表產生器加入欄位31() { 報表產生器_加入欄位_(31); }
function 報表產生器加入欄位32() { 報表產生器_加入欄位_(32); }
function 報表產生器加入欄位33() { 報表產生器_加入欄位_(33); }
function 報表產生器加入欄位34() { 報表產生器_加入欄位_(34); }
function 報表產生器加入欄位35() { 報表產生器_加入欄位_(35); }
function 報表產生器加入欄位36() { 報表產生器_加入欄位_(36); }
function 報表產生器加入欄位37() { 報表產生器_加入欄位_(37); }
function 報表產生器加入欄位38() { 報表產生器_加入欄位_(38); }
function 報表產生器加入欄位39() { 報表產生器_加入欄位_(39); }
function 報表產生器加入欄位40() { 報表產生器_加入欄位_(40); }
function 報表產生器加入欄位41() { 報表產生器_加入欄位_(41); }
function 報表產生器加入欄位42() { 報表產生器_加入欄位_(42); }
function 報表產生器加入欄位43() { 報表產生器_加入欄位_(43); }
function 報表產生器加入欄位44() { 報表產生器_加入欄位_(44); }
function 報表產生器加入欄位45() { 報表產生器_加入欄位_(45); }
function 報表產生器加入欄位46() { 報表產生器_加入欄位_(46); }
function 報表產生器加入欄位47() { 報表產生器_加入欄位_(47); }
function 報表產生器加入欄位48() { 報表產生器_加入欄位_(48); }
function 報表產生器加入欄位49() { 報表產生器_加入欄位_(49); }
function 報表產生器加入欄位50() { 報表產生器_加入欄位_(50); }
function 報表產生器加入欄位51() { 報表產生器_加入欄位_(51); }
function 報表產生器加入欄位52() { 報表產生器_加入欄位_(52); }
function 報表產生器加入欄位53() { 報表產生器_加入欄位_(53); }
function 報表產生器加入欄位54() { 報表產生器_加入欄位_(54); }
function 報表產生器加入欄位55() { 報表產生器_加入欄位_(55); }
function 報表產生器加入欄位56() { 報表產生器_加入欄位_(56); }
function 報表產生器加入欄位57() { 報表產生器_加入欄位_(57); }
function 報表產生器加入欄位58() { 報表產生器_加入欄位_(58); }
function 報表產生器加入欄位59() { 報表產生器_加入欄位_(59); }
function 報表產生器加入欄位60() { 報表產生器_加入欄位_(60); }
function 報表產生器加入欄位61() { 報表產生器_加入欄位_(61); }
function 報表產生器加入欄位62() { 報表產生器_加入欄位_(62); }
function 報表產生器加入欄位63() { 報表產生器_加入欄位_(63); }
function 報表產生器加入欄位64() { 報表產生器_加入欄位_(64); }
function 報表產生器加入欄位65() { 報表產生器_加入欄位_(65); }
function 報表產生器加入欄位66() { 報表產生器_加入欄位_(66); }
function 報表產生器加入欄位67() { 報表產生器_加入欄位_(67); }
function 報表產生器加入欄位68() { 報表產生器_加入欄位_(68); }
function 報表產生器加入欄位69() { 報表產生器_加入欄位_(69); }
function 報表產生器加入欄位70() { 報表產生器_加入欄位_(70); }
function 報表產生器加入欄位71() { 報表產生器_加入欄位_(71); }
function 報表產生器加入欄位72() { 報表產生器_加入欄位_(72); }
function 報表產生器加入欄位73() { 報表產生器_加入欄位_(73); }
function 報表產生器加入欄位74() { 報表產生器_加入欄位_(74); }
function 報表產生器加入欄位75() { 報表產生器_加入欄位_(75); }
function 報表產生器加入欄位76() { 報表產生器_加入欄位_(76); }
function 報表產生器加入欄位77() { 報表產生器_加入欄位_(77); }
function 報表產生器加入欄位78() { 報表產生器_加入欄位_(78); }
function 報表產生器加入欄位79() { 報表產生器_加入欄位_(79); }
function 報表產生器加入欄位80() { 報表產生器_加入欄位_(80); }
/* 「套用範本」01～30 */
function 報表產生器套用範本01() { 報表產生器_套用範本_(1); }
function 報表產生器套用範本02() { 報表產生器_套用範本_(2); }
function 報表產生器套用範本03() { 報表產生器_套用範本_(3); }
function 報表產生器套用範本04() { 報表產生器_套用範本_(4); }
function 報表產生器套用範本05() { 報表產生器_套用範本_(5); }
function 報表產生器套用範本06() { 報表產生器_套用範本_(6); }
function 報表產生器套用範本07() { 報表產生器_套用範本_(7); }
function 報表產生器套用範本08() { 報表產生器_套用範本_(8); }
function 報表產生器套用範本09() { 報表產生器_套用範本_(9); }
function 報表產生器套用範本10() { 報表產生器_套用範本_(10); }
function 報表產生器套用範本11() { 報表產生器_套用範本_(11); }
function 報表產生器套用範本12() { 報表產生器_套用範本_(12); }
function 報表產生器套用範本13() { 報表產生器_套用範本_(13); }
function 報表產生器套用範本14() { 報表產生器_套用範本_(14); }
function 報表產生器套用範本15() { 報表產生器_套用範本_(15); }
function 報表產生器套用範本16() { 報表產生器_套用範本_(16); }
function 報表產生器套用範本17() { 報表產生器_套用範本_(17); }
function 報表產生器套用範本18() { 報表產生器_套用範本_(18); }
function 報表產生器套用範本19() { 報表產生器_套用範本_(19); }
function 報表產生器套用範本20() { 報表產生器_套用範本_(20); }
function 報表產生器套用範本21() { 報表產生器_套用範本_(21); }
function 報表產生器套用範本22() { 報表產生器_套用範本_(22); }
function 報表產生器套用範本23() { 報表產生器_套用範本_(23); }
function 報表產生器套用範本24() { 報表產生器_套用範本_(24); }
function 報表產生器套用範本25() { 報表產生器_套用範本_(25); }
function 報表產生器套用範本26() { 報表產生器_套用範本_(26); }
function 報表產生器套用範本27() { 報表產生器_套用範本_(27); }
function 報表產生器套用範本28() { 報表產生器_套用範本_(28); }
function 報表產生器套用範本29() { 報表產生器_套用範本_(29); }
function 報表產生器套用範本30() { 報表產生器_套用範本_(30); }
