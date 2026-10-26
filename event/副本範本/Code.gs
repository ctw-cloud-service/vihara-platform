/**
 * ============================================================================
 * 檔案名稱：Code.gs（法會活動副本範本的綁定指令碼「副本工具」）
 * 所屬模組：法會活動（event）
 * 檔案版本：v3.0.0（2026-10-26）
 *   v3.0.0：改接「精舍雲端服務平台」：以使用者本人的 Google 身分呼叫平台
 *           （不再使用副本下載權杖）；動作名稱改為 event.副本…
 *   v2.4.0（舊系統）：新增「報表」選單；v2.0.0 改為薄殼
 * 放置位置：「法會活動副本範本」→ 擴充功能 → Apps Script（與 報表.gs、appsscript.json 一起）
 * ----------------------------------------------------------------------------
 * 架構：
 *   本程式只負責「選單、確認視窗、顯示結果、跳到某一列」；實際的下載、查詢、
 *   標示、移除重複、大車點名，全部交給平台（系統帳號執行）。
 *   → 日後功能修改只更新平台，所有副本立即生效；只有新增選單項目才需要更新範本。
 *
 * 身分：
 *   每次呼叫都附上「使用者本人的 Google 存取權杖」（ScriptApp.getOAuthToken），
 *   平台據此確認您是這場活動的精舍管理員或承辦人。權杖只用來確認帳號。
 *   第一次使用時 Google 會要求授權：按「繼續」→ 選帳號 →「進階」→「前往…」→「允許」。
 *
 * 選單：
 *   下載資料 → 下載新資料
 *   檢查重複 → 查詢重複／跳到下一個重複／標示重複／清除標示／移除重複
 *   大車點名 → 領隊代號對照表／產生點名資料／匯出到大車點名試算表（對外活動）
 *   報表     → 由「報表.gs」建立
 * ============================================================================
 */

/** @OnlyCurrentDoc */

/** 平台的 GAS 網頁應用程式網址（部署網址不變；若平台改了網址，請更新範本與既有副本的這一行） */
const str平台網址 = 'https://script.google.com/macros/s/AKfycby_S6Aj7tWu_Yo6_JvfiZMDyrh3M1chlOtrxmYmjj2J4RpRkLGqiJBSgxiE6A6IttJ2dA/exec';
/** 查詢結果視窗最多列出的組數 */
const int視窗顯示上限 = 300;
/** 報名資料分頁名稱 */
const str有效資料分頁 = '有效資料';


/* ==================== 選單 ==================== */

/**
 * 函式名稱：onOpen
 * 版本：v3.0.0（2026-10-26）
 * 用途：開啟試算表時建立選單：下載資料｜檢查重複｜大車點名｜報表。
 */
function onOpen() {
  const obj介面 = SpreadsheetApp.getUi();
  obj介面.createMenu('下載資料')
    .addItem('下載新資料（從表單）', '選單_下載新資料')
    .addToUi();
  obj介面.createMenu('檢查重複')
    .addItem('查詢重複（以「姓名」為鍵）', '查詢重複')
    .addItem('跳到下一個重複', '跳到下一個重複')
    .addSeparator()
    .addItem('標示重複（淡橘色）', '標示重複')
    .addItem('清除標示', '清除標示')
    .addSeparator()
    .addItem('移除重複（移至「無效資料」）', '選單_移除重複資料')
    .addToUi();
  obj介面.createMenu('大車點名')
    .addItem('領隊代號對照表（可自訂）', '選單_領隊代號對照表')
    .addSeparator()
    .addItem('產生點名資料', '選單_產生點名資料')
    .addItem('匯出到大車點名試算表', '選單_匯出點名')
    .addToUi();
  // 「報表」選單定義在 報表.gs；沒有貼報表.gs 時略過
  if (typeof 建立報表選單 === 'function') 建立報表選單();
}


/* ==================== 與平台連線 ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：呼叫系統
 * 版本：v3.0.0（2026-10-26）
 * 用途：
 *   送出 { action: 'event.' + 動作, 參數: { str存取權杖, str副本ID, …額外參數 } } 到平台。
 *   網路或伺服器錯誤一律轉成 { bool成功: false, str訊息: 白話說明 }。
 * 參數：
 *   str動作       {string}  例如 '副本下載'
 *   obj額外參數   {Object=} 例如 { bool僅預覽: true }
 * 傳回：{Object} 平台的回應（bool成功、str訊息、其他資料）
 * ----------------------------------------------------------------------------
 */
function 呼叫系統(str動作, obj額外參數) {
  const obj參數 = Object.assign({
    str存取權杖: ScriptApp.getOAuthToken(),
    str副本ID: SpreadsheetApp.getActiveSpreadsheet().getId()
  }, obj額外參數 || {});

  try {
    const obj回應 = UrlFetchApp.fetch(str平台網址, {
      method: 'post',
      contentType: 'text/plain',   // 與平台網頁相同的送法
      payload: JSON.stringify({ action: 'event.' + str動作, token: '', 參數: obj參數 }),
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (obj回應.getResponseCode() !== 200) {
      return { bool成功: false, str訊息: '系統暫時沒有回應（代碼 ' + obj回應.getResponseCode() + '），請稍後再試。若一直發生，請聯絡精舍管理員。' };
    }
    try {
      return JSON.parse(obj回應.getContentText());
    } catch (err) {
      return { bool成功: false, str訊息: '系統回傳的內容無法辨識，可能平台網址已變更，請聯絡系統管理員。' };
    }
  } catch (err) {
    return { bool成功: false, str訊息: '連線到系統失敗：' + (err && err.message ? err.message : err) + '\n請確認網路正常後再試。' };
  }
}

/** 函式名稱：提示　版本：v2.0.0　用途：跳出只有「確定」的訊息視窗 */
function 提示(str標題, str內容) {
  const obj介面 = SpreadsheetApp.getUi();
  obj介面.alert(str標題, String(str內容 || ''), obj介面.ButtonSet.OK);
}

/** 函式名稱：處理中　版本：v2.0.0　用途：右下角顯示「請稍候」小提示 */
function 處理中(str文字) {
  SpreadsheetApp.getActiveSpreadsheet().toast(str文字, '請稍候', 30);
}


/* ==================== 下載資料 ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_下載新資料
 * 版本：v3.0.0（2026-10-26）
 * 用途：① 問平台還有幾筆沒下載（0 筆直接告知）② 確認 ③ 下載 ④ 跳到最後一列。
 * ----------------------------------------------------------------------------
 */
function 選單_下載新資料() {
  處理中('正在檢查表單的新報名…');
  const obj檢查 = 呼叫系統('副本檢查');
  if (!obj檢查.bool成功) { 提示('無法檢查新報名', obj檢查.str訊息); return; }
  if (!(obj檢查.int未下載 > 0)) { 提示('已是最新', '表單沒有尚未下載的新報名。'); return; }

  const obj介面 = SpreadsheetApp.getUi();
  const obj回覆 = obj介面.alert('下載新資料',
    '「' + obj檢查.str活動名稱 + '」有 ' + obj檢查.int未下載 + ' 筆新報名尚未下載。\n\n' +
    '要下載並加在「有效資料」最後嗎？（新資料以淺黃底色標示，原有資料不會被改動）', obj介面.ButtonSet.YES_NO);
  if (obj回覆 !== obj介面.Button.YES) { 提示('已取消', '沒有下載任何資料。'); return; }

  處理中('正在下載新報名…');
  const obj結果 = 呼叫系統('副本下載');
  提示(obj結果.bool成功 ? '下載完成' : '下載失敗', obj結果.str訊息);
  if (obj結果.bool成功 && obj結果.int新增筆數 > 0) {
    const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(str有效資料分頁);
    if (obj分頁) { obj分頁.activate(); obj分頁.getRange(Math.max(obj分頁.getLastRow(), 1), 1).activate(); }
  }
}


/* ==================== 檢查重複 ==================== */

/** 函式名稱：安全文字　版本：v2.0.0　用途：轉成可放進 HTML 的文字，避免姓名中的符號破壞畫面 */
function 安全文字(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 函式名稱：跳到列　版本：v2.0.0
 * 用途：查詢視窗點「第N列」或「跳到下一個重複」時呼叫；只移動游標，不改資料。
 * 參數：int列號 {number}；str分頁名 {string}；int鍵欄 {number} 1 起算
 */
function 跳到列(int列號, str分頁名, int鍵欄) {
  const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(str分頁名 || str有效資料分頁);
  if (!obj分頁) { 提示('找不到分頁', '找不到「' + str分頁名 + '」分頁，可能被改名了。'); return; }
  obj分頁.activate();
  obj分頁.getRange(Number(int列號), Number(int鍵欄) || 1).activate();
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：查詢重複
 * 版本：v3.0.0（2026-10-26）
 * 用途：向平台查詢重複的姓名並在視窗中列出；點「第N列」可跳過去。只查看，不改資料。
 * ----------------------------------------------------------------------------
 */
function 查詢重複() {
  處理中('正在查詢重複資料…');
  const obj結果 = 呼叫系統('副本查詢重複');
  if (!obj結果.bool成功) { 提示('無法查詢重複', obj結果.str訊息); return; }

  const arr組 = obj結果.arr重複組 || [];
  let str內容 = '<div style="font-family:sans-serif;font-size:14px">';
  str內容 += '<p>「' + 安全文字(obj結果.str分頁名) + '」共 ' + obj結果.int資料列數 + ' 列資料，以「' + 安全文字(obj結果.str鍵欄名) + '」比對：' +
    (arr組.length === 0 ? '<b>沒有發現重複</b>' : '<b>' + obj結果.int重複組數 + ' 組重複</b>（多出 ' + obj結果.int多出筆數 + ' 筆）') + '</p>';
  if (obj結果.int空白筆數 > 0) {
    str內容 += '<p style="color:#666">另有 ' + obj結果.int空白筆數 + ' 列姓名空白，未納入比對。</p>';
  }
  if (arr組.length > 0) {
    str內容 += '<p style="color:#666;font-size:12px">同名不一定是同一人，請自行判斷。點「第N列」跳到該列；要移除請用「檢查重複 → 移除重複」。</p>' +
      '<table style="border-collapse:collapse;width:100%">';
    arr組.forEach(function (o) {
      str內容 += '<tr><td style="border-bottom:1px solid #ddd;padding:6px"><b>' + 安全文字(o.str姓名) + '</b>（' + o.arr列號.length + ' 筆）</td>' +
        '<td style="border-bottom:1px solid #ddd;padding:6px">' +
        o.arr列號.map(function (n) { return '<a href="#" onclick="跳(' + Number(n) + ');return false;">第' + Number(n) + '列</a>'; }).join('　') +
        '</td></tr>';
    });
    str內容 += '</table>';
    if (obj結果.bool已截斷) { str內容 += '<p>僅顯示前 ' + int視窗顯示上限 + ' 組。</p>'; }
  }
  str內容 += '</div>';
  // 分頁名與姓名欄號放在 script 變數裡（JSON 編碼、「<」轉義），避免分頁名含引號時破壞連結
  str內容 += '<script>var 分頁=' + JSON.stringify(String(obj結果.str分頁名)).replace(/</g, '\\u003c') +
    ',鍵欄=' + Number(obj結果.int鍵欄) + ';function 跳(n){google.script.run.跳到列(n,分頁,鍵欄);}</script>';
  SpreadsheetApp.getUi().showModelessDialog(
    HtmlService.createHtmlOutput(str內容).setWidth(460).setHeight(480), '重複資料（以「姓名」為鍵）');
}

/**
 * 函式名稱：跳到下一個重複　版本：v3.0.0
 * 用途：從目前選取的列往下找下一列重複資料；到底後從頭再找。只移動游標，不改資料。
 */
function 跳到下一個重複() {
  const obj結果 = 呼叫系統('副本查詢重複');
  if (!obj結果.bool成功) { 提示('無法查詢重複', obj結果.str訊息); return; }
  const arr全部列 = [];
  (obj結果.arr重複組 || []).forEach(function (o) { o.arr列號.forEach(function (n) { arr全部列.push(n); }); });
  if (arr全部列.length === 0) { 提示('沒有重複', '沒有發現重複資料。'); return; }
  arr全部列.sort(function (a, b) { return a - b; });
  const obj目前分頁 = SpreadsheetApp.getActiveSheet();
  const int目前列 = obj目前分頁.getName() === obj結果.str分頁名 ? SpreadsheetApp.getActiveRange().getRow() : 1;
  const int下一列 = arr全部列.filter(function (n) { return n > int目前列; })[0] || arr全部列[0];
  跳到列(int下一列, obj結果.str分頁名, obj結果.int鍵欄);
}

/** 函式名稱：標示重複　版本：v3.0.0　用途：請平台把姓名重複的整列標淡橘色（可重複執行） */
function 標示重複() {
  處理中('正在設定重複標示…');
  const obj結果 = 呼叫系統('副本標示重複');
  提示(obj結果.bool成功 ? '已標示' : '標示失敗', obj結果.str訊息);
}

/** 函式名稱：清除標示　版本：v3.0.0　用途：請平台移除重複標示（自己加的格式不受影響） */
function 清除標示() {
  處理中('正在清除重複標示…');
  const obj結果 = 呼叫系統('副本清除標示');
  提示(obj結果.bool成功 ? '已清除' : '清除失敗', obj結果.str訊息);
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_移除重複資料
 * 版本：v3.0.0（2026-10-26）
 * 用途：① 請平台預覽（保留哪一列、移出哪幾列；不改資料）② 確認 ③ 正式移除。
 * ----------------------------------------------------------------------------
 */
function 選單_移除重複資料() {
  處理中('正在檢查重複資料…');
  const obj預覽 = 呼叫系統('副本移除重複', { bool僅預覽: true });
  if (!obj預覽.bool成功) { 提示('無法檢查重複', obj預覽.str訊息); return; }
  if (!(obj預覽.int移出筆數 > 0)) { 提示('檢查完成', obj預覽.str訊息); return; }

  // 明細最多列 20 組，其餘以「另有 N 組」帶過
  const int上限 = 20;
  const arr行 = (obj預覽.arr明細 || []).slice(0, int上限).map(function (o) {
    return '・' + o.str鍵值 + '：保留第 ' + o.int保留列號 + ' 列（' + o.str保留時間 + '），移出第 ' + o.arr移出列號.join('、') + ' 列';
  });
  if ((obj預覽.arr明細 || []).length > int上限) { arr行.push('……另有 ' + (obj預覽.arr明細.length - int上限) + ' 組未列出'); }

  const obj介面 = SpreadsheetApp.getUi();
  const obj回覆 = obj介面.alert('確認移除重複資料',
    '在「' + obj預覽.str分頁名 + '」發現 ' + obj預覽.int重複組數 + ' 組姓名重複，將保留每組時間最晚的一筆，' +
    '其餘 ' + obj預覽.int移出筆數 + ' 筆整列移至「無效資料」分頁：\n\n' + arr行.join('\n') +
    '\n\n提醒：同名不一定是同一人，請先確認。移出的資料仍保留在「無效資料」分頁，需要時可複製回來。\n\n確定要移除嗎？',
    obj介面.ButtonSet.YES_NO);
  if (obj回覆 !== obj介面.Button.YES) { 提示('已取消', '沒有移動任何資料。'); return; }

  處理中('正在移除重複資料…');
  const obj結果 = 呼叫系統('副本移除重複', { bool僅預覽: false });
  提示(obj結果.bool成功 ? '完成' : '執行失敗', obj結果.str訊息);
}


/* ==================== 大車點名（對外活動） ==================== */

/**
 * 函式名稱：選單_產生點名資料　版本：v3.0.0
 * 用途：請平台依「點名欄位設定」把有效資料拆成一趟一列，合併寫入「大車報到點名資料」。
 *       第一次只建立「點名欄位設定」分頁，跳過去請承辦人確認。
 */
function 選單_產生點名資料() {
  處理中('正在產生點名資料…');
  const obj結果 = 呼叫系統('副本產生點名');
  const arr明細 = obj結果.arr明細 || [];
  提示(obj結果.bool成功 ? (obj結果.bool需確認設定 ? '請先確認點名欄位設定' : '點名資料已產生') : '產生失敗',
    obj結果.str訊息 + (arr明細.length ? '\n\n・' + arr明細.join('\n・') : ''));
  if (obj結果.bool成功) {
    const str分頁 = obj結果.bool需確認設定 ? '點名欄位設定' : '大車報到點名資料';
    const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(str分頁);
    if (obj分頁) { obj分頁.activate(); }
  }
}

/**
 * 函式名稱：選單_領隊代號對照表　版本：v3.0.0
 * 用途：請平台建立「領隊代號」分頁並填入預設代號，承辦人可依本活動修改。
 */
function 選單_領隊代號對照表() {
  處理中('正在準備領隊代號對照表…');
  const obj結果 = 呼叫系統('副本領隊代號表');
  提示(obj結果.bool成功 ? '領隊代號對照表' : '無法建立對照表', obj結果.str訊息);
  if (obj結果.bool成功) {
    const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('領隊代號');
    if (obj分頁) { obj分頁.activate(); }
  }
}

/**
 * 函式名稱：選單_匯出點名　版本：v3.0.0
 * 用途：① 請平台預覽（筆數、分頁、是否首次、待分車數）② 確認 ③ 匯出。
 */
function 選單_匯出點名() {
  處理中('正在檢查要匯出的點名資料…');
  const obj預覽 = 呼叫系統('副本匯出點名', { bool僅預覽: true });
  if (!obj預覽.bool成功) { 提示('無法匯出', obj預覽.str訊息); return; }

  let str說明 = '將「' + obj預覽.str活動名稱 + '」的 ' + obj預覽.int筆數 + ' 筆點名資料匯出到大車點名試算表的「' +
    obj預覽.str名單分頁名 + '」分頁。\n\n';
  str說明 += obj預覽.bool首次
    ? '這是第一次匯出：會建立名單與報到紀錄分頁，活動配置設為「啟用」，活動進入「演練」。'
    : '這個分頁已有名單：會先備份原名單，再整份覆蓋。';
  if (obj預覽.int待分車 > 0) {
    str說明 += '\n\n⚠ 還有 ' + obj預覽.int待分車 + ' 趟的去程或回程沒填（點名資料中淡藍底的列），匯出後點名系統會看到空白。';
  }
  str說明 += '\n\n確定要匯出嗎？';

  const obj介面 = SpreadsheetApp.getUi();
  if (obj介面.alert('匯出到大車點名試算表', str說明, obj介面.ButtonSet.YES_NO) !== obj介面.Button.YES) {
    提示('已取消', '沒有匯出任何資料。');
    return;
  }
  處理中('正在匯出到大車點名試算表…');
  const obj結果 = 呼叫系統('副本匯出點名', { bool僅預覽: false });
  提示(obj結果.bool成功 ? '匯出完成' : '匯出失敗', obj結果.str訊息);
}
