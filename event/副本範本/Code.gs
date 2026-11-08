/**
 * ============================================================================
 * 檔案名稱：Code.gs（法會活動副本範本的綁定指令碼「副本工具」）
 * 所屬模組：法會活動（event）
 * 檔案版本：v3.6.0（2026-11-08）
 *   v3.6.0：下載場次名冊視窗加「名冊合併來源」：這場活動要不要合併副會長回報、用齋登記（午齋／藥石），
 *           隨下載一起儲存（每場對內活動各自指定，決策 BK）；精舍沒設定的來源不顯示
 *   v3.5.0：「法會報到」加入「設定報到時段」「列印報到表」；下載場次名冊視窗顯示報到時段，
 *           尚未設定時帶入系統建議的時段（可修改），隨下載一起儲存
 *   v3.4.0：新增「法會報到 → 下載場次名冊」（對內活動：選一個場次，平台產生該場次的名冊分頁「名冊_月日日」）；
 *           依副本內的「法會活動類型」標記只顯示該用的選單（對內：法會報到；對外：大車點名；
 *           沒有標記的舊副本兩個都顯示，系統管理員執行「補齊副本活動類型」後即依類型顯示）；
 *           對內活動的「檢查重複」不顯示「移除重複」（2026-11-06）
 *   v3.3.1：只改註解（缺欄改由平台留空白並提醒），已貼 v3.3.0 的副本不必重貼
 *   v3.3.0：「大車點名」改為「產生出車資料」（依欄名從有效資料直接產生），移除「領隊代號對照表」
 *   v3.2.0：移除「報表」選單（列印功能移到「報表產生器 → 列印」）
 *   v3.1.0：onOpen 加入「報表產生器」選單（由 報表產生器.gs 建立）
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
 *   大車點名 → 產生出車資料／匯出到大車點名試算表（只在對外活動顯示）
 *   法會報到 → 下載場次名冊／設定報到時段／列印報到表（只在對內活動顯示）
 *   報表     → 由「報表.gs」建立
 *   報表產生器 → 由「報表產生器.gs」建立（點選欄位與條件產生報表、報表範本）
 * ============================================================================
 */

/** @OnlyCurrentDoc */

/** 平台的 GAS 網頁應用程式網址（部署網址不變；若平台改了網址，請更新範本與既有副本的這一行） */
const str平台網址 = 'https://script.google.com/macros/s/AKfycby_S6Aj7tWu_Yo6_JvfiZMDyrh3M1chlOtrxmYmjj2J4RpRkLGqiJBSgxiE6A6IttJ2dA/exec';
/** 查詢結果視窗最多列出的組數 */
const int視窗顯示上限 = 300;
/** 報名資料分頁名稱 */
const str有效資料分頁 = '有效資料';
/** 副本內記錄活動類型的隱藏標記鍵名（須與平台 法會_模組定義 的 str副本類型鍵 相同） */
const str副本類型鍵 = '法會活動類型';


/* ==================== 選單 ==================== */

/**
 * 函式名稱：onOpen
 * 版本：v3.5.0（2026-11-06）　v3.5.0：法會報到加入設定報到時段、列印報到表；v3.4.0：加入「法會報到」選單；大車點名／法會報到依活動類型顯示
 * 用途：開啟試算表時建立選單：下載資料｜檢查重複｜大車點名（對外）｜法會報到（對內）｜報表產生器。
 */
function onOpen() {
  const obj介面 = SpreadsheetApp.getUi();
  // 依活動類型只顯示該用的選單（讀不到標記時全部顯示）
  const obj顯示 = 決定活動選單(讀取副本活動類型());
  obj介面.createMenu('下載資料')
    .addItem('下載新資料（從表單）', '選單_下載新資料')
    .addToUi();
  const obj重複選單 = obj介面.createMenu('檢查重複')
    .addItem('查詢重複（以「姓名」為鍵）', '查詢重複')
    .addItem('跳到下一個重複', '跳到下一個重複')
    .addSeparator()
    .addItem('標示重複（淡橘色）', '標示重複')
    .addItem('清除標示', '清除標示');
  // 對內活動不顯示「移除重複」：同一人常分次報名不同場次，移除會把較早報的場次刪掉
  if (obj顯示.bool移除重複) {
    obj重複選單.addSeparator().addItem('移除重複（移至「無效資料」）', '選單_移除重複資料');
  }
  obj重複選單.addToUi();
  if (obj顯示.bool大車點名) {
    obj介面.createMenu('大車點名')
      .addItem('產生出車資料（依欄名從有效資料產生）', '選單_產生出車資料')
      .addItem('匯出到大車點名試算表', '選單_匯出點名')
      .addToUi();
  }
  if (obj顯示.bool法會報到) {
    obj介面.createMenu('法會報到')
      .addItem('下載場次名冊（選一個場次，每場一個分頁）', '選單_下載場次名冊')
      .addItem('設定報到時段（一支香等分時段報到）', '選單_設定報到時段')
      .addSeparator()
      .addItem('列印報到表（A4 紙本，人工打勾）', '選單_列印報到表')
      .addToUi();
  }
  // 報表.gs 只做開檔還原列印設定（不再建立「報表」選單）；沒有貼報表.gs 時略過
  if (typeof 建立報表選單 === 'function') 建立報表選單();
  // 「報表產生器」選單定義在 報表產生器.gs；沒有貼時略過（讀取失敗也不影響其他選單）
  if (typeof 建立報表產生器選單 === 'function') {
    try { 建立報表產生器選單(); } catch (err) { console.warn('建立報表產生器選單失敗：' + err.message); }
  }
}


/**
 * 函式名稱：讀取副本活動類型　版本：v3.4.0（2026-11-05）
 * 用途：讀副本內的隱藏標記「法會活動類型」（平台建立副本或執行「補齊副本活動類型」時寫入）。
 *       沒有標記、或讀取失敗（例如權限不足）時傳回空字串，選單會兩個都顯示，不影響使用。
 * 傳回：{string} '對內'／'對外'／''
 */
function 讀取副本活動類型() {
  try {
    const arr標記 = SpreadsheetApp.getActiveSpreadsheet().createDeveloperMetadataFinder().withKey(str副本類型鍵).find();
    return arr標記.length > 0 ? String(arr標記[0].getValue() || '').trim() : '';
  } catch (err) {
    console.warn('讀取副本活動類型失敗，兩個選單都顯示：' + (err && err.message ? err.message : err));
    return '';
  }
}

/**
 * 函式名稱：決定活動選單　版本：v3.4.0（2026-11-05）
 * 用途：依活動類型決定要顯示哪些選單：
 *         對內 → 「法會報到」，「檢查重複」不含「移除重複」（同一人常分次報名不同場次）
 *         對外 → 「大車點名」，「檢查重複」含「移除重複」
 *         其他（舊副本沒有標記）→ 全部顯示（按錯時平台會說明）
 * 參數：str類型 {string}
 * 傳回：{Object} { bool大車點名, bool法會報到, bool移除重複 }
 */
function 決定活動選單(str類型) {
  const str = String(str類型 || '').trim();
  return { bool大車點名: str !== '對內', bool法會報到: str !== '對外', bool移除重複: str !== '對內' };
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
 * 函式名稱：選單_產生出車資料　版本：v3.3.0（2026-11-04）
 * 用途：請平台依出車點名範本的欄位，從「有效資料」同名欄位整份產生「出車資料」分頁。
 *       有效資料沒有的欄位留空白，平台在結果明細中列出；只有缺「姓名」欄時才會停止（不會動到出車資料）。
 *       成功後切換到「出車資料」分頁。
 */
function 選單_產生出車資料() {
  處理中('正在產生出車資料…');
  const obj結果 = 呼叫系統('副本產生點名');
  const arr明細 = obj結果.arr明細 || [];
  提示(obj結果.bool成功 ? '出車資料已產生' : '無法產生出車資料',
    obj結果.str訊息 + (arr明細.length ? '\n\n・' + arr明細.join('\n・') : ''));
  if (obj結果.bool成功) {
    const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('出車資料');
    if (obj分頁) { obj分頁.activate(); }
  }
}

/**
 * 函式名稱：選單_匯出點名　版本：v3.3.0（2026-11-04）　v3.3.0：來源改為「出車資料」，提示文字改為「筆」
 * 用途：① 請平台預覽（筆數、分頁、是否首次、待分車數）② 確認 ③ 匯出。
 */
function 選單_匯出點名() {
  處理中('正在檢查要匯出的點名資料…');
  const obj預覽 = 呼叫系統('副本匯出點名', { bool僅預覽: true });
  if (!obj預覽.bool成功) { 提示('無法匯出', obj預覽.str訊息); return; }

  let str說明 = '將「' + obj預覽.str活動名稱 + '」的 ' + obj預覽.int筆數 + ' 筆出車資料匯出到大車點名試算表的「' +
    obj預覽.str名單分頁名 + '」分頁。\n\n';
  str說明 += obj預覽.bool首次
    ? '這是第一次匯出：會建立名單與報到紀錄分頁，活動配置設為「啟用」，活動進入「演練」。'
    : '這個分頁已有名單：會先備份原名單，再整份覆蓋。';
  if (obj預覽.int待分車 > 0) {
    str說明 += '\n\n⚠ 還有 ' + obj預覽.int待分車 + ' 筆的去程或回程沒填（「出車資料」中淡藍底的列），匯出後點名系統會看到空白。';
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


/* ==================== 法會報到（對內活動） ==================== */

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：時段區塊內容
 * 版本：v3.5.0（2026-11-06）
 * 用途：下載場次名冊視窗上方的「報到時段」區塊：
 *         已設定 → 顯示目前的時段（要改請用「設定報到時段」）
 *         尚未設定、有建議 → 黃底提示＋可修改的文字框（id="時段"），下載時一併儲存
 *         尚未設定、沒有建議 → 不分時段
 * 參數：obj時段 {Object} 平台回傳的 { str報到時段, bool已設定, str建議時段 }
 * 傳回：{string} HTML
 * ----------------------------------------------------------------------------
 */
function 時段區塊內容(obj時段) {
  const o = obj時段 || {};
  if (o.bool已設定) {
    return '<p style="background:#f3efe6;padding:6px">報到時段：<b>' + 安全文字(o.str報到時段) + '</b>' +
      '<br><span style="color:#666;font-size:12px">名冊會依這些時段加上時段欄（有報名標 ✓）。要修改請用「法會報到 → 設定報到時段」。</span></p>';
  }
  if (o.str建議時段) {
    return '<div style="background:#fff2cc;padding:6px;margin-bottom:8px">尚未設定<b>報到時段</b>。系統從報名內容找到以下時段，' +
      '<b>下載時會一併儲存</b>；可以修改名稱（例如改成「第一支香」），或清空表示不分時段：' +
      '<textarea id="時段" style="width:100%;height:46px;margin-top:4px">' + 安全文字(o.str建議時段) + '</textarea>' +
      '<span style="color:#666;font-size:12px">寫法：名稱 空格 開始-結束（24 小時制），以「；」分隔。</span></div>';
  }
  return '<p style="color:#666;font-size:12px">報到時段：不分時段（每個場次報到一次）。一支香這類分時段報到的活動，請用「設定報到時段」設定。</p>';
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：合併區塊內容
 * 版本：v3.6.0（2026-11-08）
 * 用途：下載場次名冊視窗的「名冊合併來源」區塊（決策 BK）：
 *         精舍有設定副會長回報表 → 下拉「合併／不合併」（id="合併回報"）
 *         精舍有設定用齋登記表   → 下拉「合併午齋／合併藥石／不合併」（id="合併用齋"）
 *         兩份都沒設定           → 一行說明「名冊只用報名資料」
 *       選的值隨下載送給平台，存成這場活動的設定（之後網頁與下次下載都沿用）。
 * 參數：obj用齋 {Object} 平台回傳的 { str餐別, bool有登記表, str副會長回報, bool有回報表 }（舊版平台沒有時當成都沒設定）
 * 傳回：{string} HTML
 * ----------------------------------------------------------------------------
 */
function 合併區塊內容(obj用齋) {
  const o = obj用齋 || {};
  if (!o.bool有回報表 && !o.bool有登記表) {
    return '<p style="color:#666;font-size:12px">名冊合併來源：只用報名資料（精舍設定副會長回報表或用齋登記表後，這裡可以選擇合併）。</p>';
  }
  const fn選單 = function (str編號, arr值, str目前, fn文字) {
    return '<select id="' + str編號 + '">' + arr值.map(function (s) {
      return '<option value="' + s + '"' + (s === str目前 ? ' selected' : '') + '>' + fn文字(s) + '</option>';
    }).join('') + '</select>';
  };
  let str = '<div style="background:#f3efe6;padding:6px;margin-bottom:8px"><b>名冊合併來源</b>（這場活動）：';
  if (o.bool有回報表) str += ' 副會長回報 ' + fn選單('合併回報', ['合併', '不合併'], o.str副會長回報 || '合併', function (s) { return s; });
  if (o.bool有登記表) str += ' 用齋登記 ' + fn選單('合併用齋', ['午齋', '藥石', '不合併'], o.str餐別 || '午齋', function (s) { return s === '不合併' ? s : '合併' + s; });
  str += '<br><span style="color:#666;font-size:12px">合併<b>同一天</b>的資料：出席或用齋但沒報名的人加入名冊；不參加的人自動登記取消參加；' +
    '執事、組別寫在「義工組別」，坐椅子、用齋等寫在「備註」。選擇會存成這場活動的設定。</span></div>';
  return str;
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_下載場次名冊
 * 版本：v3.6.0（2026-11-08）　v3.6.0：加「名冊合併來源」選擇；v3.5.0：視窗上方顯示報到時段（尚未設定時帶入建議，隨下載儲存）
 * 用途：
 *   ① 請平台列出「有效資料」的場次（欄名含日期的欄）與各場次筆數、已下載的名冊分頁、報到時段
 *   ② 顯示選擇視窗（一次選一個場次）；按「下載」後在視窗中呼叫 選單_執行下載場次名冊
 *   每個場次有自己的分頁（例如「名冊_10月18日」）。對外活動或沒有權限時，平台會回覆白話說明。
 * ----------------------------------------------------------------------------
 */
function 選單_下載場次名冊() {
  處理中('正在讀取場次…');
  const obj結果 = 呼叫系統('副本列出場次');
  if (!obj結果.bool成功) { 提示('無法列出場次', obj結果.str訊息); return; }
  const arr場次 = obj結果.arr場次 || [];

  // 視窗內容：每個場次一個單選鈕（以序號對應，場次名稱放在 script 變數中，避免特殊符號破壞畫面）
  const str格 = 'border-bottom:1px solid #ddd;padding:4px';
  let str內容 = '<div style="font-family:sans-serif;font-size:14px">';
  str內容 += 時段區塊內容(obj結果.obj時段);
  str內容 += 合併區塊內容(obj結果.obj用齋);
  str內容 += '<p>「' + 安全文字(obj結果.str活動名稱) + '」共 ' + arr場次.length + ' 個場次。請選一個要下載的場次：</p>';
  str內容 += '<table style="border-collapse:collapse;width:100%">' +
    '<tr style="background:#f3efe6"><th></th><th style="text-align:left;padding:4px">日期</th><th style="text-align:left;padding:4px">場次</th>' +
    '<th style="padding:4px">有填</th><th style="text-align:left;padding:4px">已下載</th></tr>';
  arr場次.forEach(function (o, i) {
    str內容 += '<tr><td style="' + str格 + '"><input type="radio" name="場次" id="c' + i + '"></td>' +
      '<td style="' + str格 + '">' + 安全文字(o.str日期) + '</td>' +
      '<td style="' + str格 + '"><label for="c' + i + '">' + 安全文字(o.str場次) + '</label></td>' +
      '<td style="' + str格 + ';text-align:center">' + Number(o.int有填筆數) + ' 筆</td>' +
      '<td style="' + str格 + '">' + (o.str分頁名 ? 安全文字(o.str分頁名) + '（' + Number(o.int已下載人數) + ' 人）' : '—') + '</td></tr>';
  });
  str內容 += '</table>';
  (obj結果.arr欄位提醒 || []).forEach(function (s) { str內容 += '<p style="color:#8a5a00;font-size:12px">⚠ ' + 安全文字(s) + '</p>'; });
  str內容 += '<p style="color:#666;font-size:12px">每個場次一個分頁，同一姓名取時間最晚的報名。已下載的場次再下載會整頁重建' +
    '（舊的自動備份並隱藏，保留 1 份；您自己加的欄位如「座位」會依姓名帶回）。</p>' +
    '<p><button id="btn下載" onclick="下載()" style="font-weight:bold">下載</button> ' +
    '<button onclick="google.script.host.close()">關閉</button></p><div id="結果" style="white-space:pre-wrap"></div></div>';
  str內容 += '<script>var 場次=' + JSON.stringify(arr場次.map(function (o) { return o.str場次; })).replace(/</g, '\\u003c') + ';' +
    'function 下載(){var str="";場次.forEach(function(s,i){if(document.getElementById("c"+i).checked)str=s;});' +
    'if(str===""){document.getElementById("結果").textContent="請先選一個場次。";return;}' +
    'document.getElementById("btn下載").disabled=true;document.getElementById("結果").textContent="正在下載，請稍候…";' +
    'google.script.run.withSuccessHandler(function(s){document.getElementById("結果").textContent=s;document.getElementById("btn下載").disabled=false;})' +
    '.withFailureHandler(function(e){document.getElementById("結果").textContent="執行失敗："+(e&&e.message?e.message:e);document.getElementById("btn下載").disabled=false;})' +
    '.選單_執行下載場次名冊(str,document.getElementById("時段")?document.getElementById("時段").value:null,' +
    'document.getElementById("合併用齋")?document.getElementById("合併用齋").value:null,' +
    'document.getElementById("合併回報")?document.getElementById("合併回報").value:null);}</script>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(str內容).setWidth(600).setHeight(580), '下載場次名冊');
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_執行下載場次名冊
 * 版本：v3.6.0（2026-11-08）　v3.6.0：可一併送出合併設定；v3.5.0：可一併送出報到時段
 * 用途：選擇視窗按「下載」時呼叫：請平台產生這個場次的名冊分頁，成功後切換到那一頁。
 * 參數：
 *   str場次       {string}      選擇的場次名稱
 *   str報到時段   {string|null} 視窗中確認的報到時段（尚未設定時才有；null＝沿用平台設定）
 *   str用齋       {string|null} 合併用齋：午齋／藥石／不合併（精舍沒設定用齋登記表時 null）
 *   str副會長回報 {string|null} 合併副會長回報：合併／不合併（精舍沒設定回報表時 null）
 * 傳回：{string} 顯示在視窗中的結果文字
 * ----------------------------------------------------------------------------
 */
function 選單_執行下載場次名冊(str場次, str報到時段, str用齋, str副會長回報) {
  const obj參數 = { str場次: str場次 };
  if (typeof str報到時段 === 'string') obj參數.str報到時段 = str報到時段;
  if (typeof str用齋 === 'string' && str用齋 !== '') obj參數.str用齋 = str用齋;              // v3.6.0
  if (typeof str副會長回報 === 'string' && str副會長回報 !== '') obj參數.str副會長回報 = str副會長回報;
  const obj結果 = 呼叫系統('副本下載場次名冊', obj參數);
  const arr明細 = obj結果.arr明細 || [];
  if (obj結果.bool成功 && obj結果.str分頁名) {
    const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(obj結果.str分頁名);
    if (obj分頁) { obj分頁.activate(); }
  }
  return (obj結果.bool成功 ? '✔ ' : '✘ 無法下載：') + obj結果.str訊息 + (arr明細.length ? '\n\n・' + arr明細.join('\n・') : '');
}


/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_設定報到時段
 * 版本：v3.5.0（2026-11-06）
 * 用途：
 *   一支香這類「一個場次分幾個時段、每個時段各自報到」的活動，設定報到時段。
 *   視窗帶入目前的設定（尚未設定時帶入系統從報名內容找到的建議），修改後按「儲存」。
 *   清空＝不分時段（共修、培訓）。已下載的名冊要重新下載，時段欄才會跟著改。
 * ----------------------------------------------------------------------------
 */
function 選單_設定報到時段() {
  處理中('正在讀取報到時段…');
  const obj結果 = 呼叫系統('副本讀取時段');
  if (!obj結果.bool成功) { 提示('無法讀取報到時段', obj結果.str訊息); return; }
  const o = obj結果.obj時段 || {};
  const str預填 = o.bool已設定 ? o.str報到時段 : (o.str建議時段 || '');

  let str內容 = '<div style="font-family:sans-serif;font-size:14px">';
  str內容 += '<p>「' + 安全文字(obj結果.str活動名稱) + '」的報到時段：' +
    (o.bool已設定 ? '' : '<span style="color:#8a5a00">尚未設定' + (o.str建議時段 ? '，以下是系統從報名內容找到的建議' : '（目前不分時段）') + '</span>') + '</p>';
  str內容 += '<textarea id="時段" style="width:100%;height:70px">' + 安全文字(str預填) + '</textarea>';
  str內容 += '<p style="color:#666;font-size:12px">寫法：名稱 空格 開始-結束（24 小時制），以「；」分隔，例如<br>' +
    '第一支香 14:00-14:40；第二支香 14:50-15:30；第三支香 15:40-16:20<br>' +
    '名稱可省略（自動用「第一時段」…）；名稱是「第N支香」時，三個都報的人顯示「三支香」。<br>' +
    '<b>清空＝不分時段</b>（共修、培訓：每個場次報到一次）。<br>' +
    '已下載的場次名冊不會自動改，儲存後請重新下載要用的場次。</p>' +
    '<p><button id="btn儲存" onclick="儲存()" style="font-weight:bold">儲存</button> ' +
    '<button onclick="google.script.host.close()">關閉</button></p><div id="結果" style="white-space:pre-wrap"></div></div>';
  str內容 += '<script>function 儲存(){document.getElementById("btn儲存").disabled=true;' +
    'document.getElementById("結果").textContent="正在儲存，請稍候…";' +
    'google.script.run.withSuccessHandler(function(s){document.getElementById("結果").textContent=s;document.getElementById("btn儲存").disabled=false;})' +
    '.withFailureHandler(function(e){document.getElementById("結果").textContent="執行失敗："+(e&&e.message?e.message:e);document.getElementById("btn儲存").disabled=false;})' +
    '.選單_執行儲存時段(document.getElementById("時段").value);}</script>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(str內容).setWidth(560).setHeight(400), '設定報到時段');
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_執行儲存時段
 * 版本：v3.5.0（2026-11-06）
 * 用途：設定視窗按「儲存」時呼叫：請平台檢查並儲存報到時段。
 * 參數：str報到時段 {string}
 * 傳回：{string} 顯示在視窗中的結果文字
 * ----------------------------------------------------------------------------
 */
function 選單_執行儲存時段(str報到時段) {
  const obj結果 = 呼叫系統('副本儲存時段', { str報到時段: String(str報到時段 || '') });
  return (obj結果.bool成功 ? '✔ ' : '✘ 無法儲存：') + obj結果.str訊息;
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_列印報到表
 * 版本：v3.5.0（2026-11-06）
 * 用途：
 *   ① 請平台列出場次，只留下已下載名冊的場次
 *   ② 選一個場次 → 平台依名冊產生「報到表_月日日」分頁（A4 直式；沒報名的時段灰底；
 *      空白列補滿最後一頁）→ 視窗出現「開啟 PDF 列印」
 *   每次列印整頁重建，在報到表分頁打的勾不會保留；紙本打勾後請到法會活動網頁「補登」。
 * ----------------------------------------------------------------------------
 */
function 選單_列印報到表() {
  處理中('正在讀取場次…');
  const obj結果 = 呼叫系統('副本列出場次');
  if (!obj結果.bool成功) { 提示('無法列出場次', obj結果.str訊息); return; }
  const arr場次 = (obj結果.arr場次 || []).filter(function (o) { return o.str分頁名; });
  if (arr場次.length === 0) {
    提示('還沒有場次名冊', '請先用「法會報到 → 下載場次名冊」下載要報到的場次，再列印報到表。');
    return;
  }

  const str格 = 'border-bottom:1px solid #ddd;padding:4px';
  let str內容 = '<div style="font-family:sans-serif;font-size:14px">';
  str內容 += '<p>請選一個場次，依名冊產生紙本報到表：</p>';
  str內容 += '<table style="border-collapse:collapse;width:100%">' +
    '<tr style="background:#f3efe6"><th></th><th style="text-align:left;padding:4px">日期</th><th style="text-align:left;padding:4px">場次</th>' +
    '<th style="text-align:left;padding:4px">名冊</th></tr>';
  arr場次.forEach(function (o, i) {
    str內容 += '<tr><td style="' + str格 + '"><input type="radio" name="場次" id="c' + i + '"></td>' +
      '<td style="' + str格 + '">' + 安全文字(o.str日期) + '</td>' +
      '<td style="' + str格 + '"><label for="c' + i + '">' + 安全文字(o.str場次) + '</label></td>' +
      '<td style="' + str格 + '">' + 安全文字(o.str分頁名) + '（' + Number(o.int已下載人數) + ' 人）</td></tr>';
  });
  str內容 += '</table>';
  const o時段 = obj結果.obj時段 || {};
  str內容 += '<p style="color:#666;font-size:12px">' +
    (o時段.bool已設定 ? '報到時段：' + 安全文字(o時段.str報到時段) + '。' : '不分時段（每人一個「報到」格）。') +
    '依名冊的 ✓ 標灰底（沒報名的時段）；最後一頁補滿空白列供手寫。每次產生整頁重建。</p>' +
    '<p><button id="btn產生" onclick="產生()" style="font-weight:bold">產生報到表</button> ' +
    '<button onclick="google.script.host.close()">關閉</button></p>' +
    '<p id="列印" style="display:none"><a id="連結" target="_blank" style="font-weight:bold;font-size:16px">🖨 開啟 PDF 列印（A4 直式）</a></p>' +
    '<div id="結果" style="white-space:pre-wrap"></div></div>';
  str內容 += '<script>var 場次=' + JSON.stringify(arr場次.map(function (o) { return o.str場次; })).replace(/</g, '\\u003c') + ';' +
    'function 產生(){var str="";場次.forEach(function(s,i){if(document.getElementById("c"+i).checked)str=s;});' +
    'if(str===""){document.getElementById("結果").textContent="請先選一個場次。";return;}' +
    'document.getElementById("btn產生").disabled=true;document.getElementById("列印").style.display="none";' +
    'document.getElementById("結果").textContent="正在產生，請稍候…";' +
    'google.script.run.withSuccessHandler(function(o){document.getElementById("結果").textContent=o.str文字;' +
    'if(o.str網址){document.getElementById("連結").href=o.str網址;document.getElementById("列印").style.display="block";}' +
    'document.getElementById("btn產生").disabled=false;})' +
    '.withFailureHandler(function(e){document.getElementById("結果").textContent="執行失敗："+(e&&e.message?e.message:e);document.getElementById("btn產生").disabled=false;})' +
    '.選單_執行列印報到表(str);}</script>';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(str內容).setWidth(600).setHeight(520), '列印報到表');
}

/**
 * ----------------------------------------------------------------------------
 * 函式名稱：選單_執行列印報到表
 * 版本：v3.5.0（2026-11-06）
 * 用途：列印視窗按「產生報到表」時呼叫：請平台產生報到表分頁，成功後切換到那一頁，並傳回 PDF 網址。
 * 參數：str場次 {string}
 * 傳回：{Object} { str文字（顯示在視窗中）, str網址（PDF；失敗時空字串） }
 * ----------------------------------------------------------------------------
 */
function 選單_執行列印報到表(str場次) {
  const obj結果 = 呼叫系統('副本列印報到表', { str場次: str場次 });
  const arr明細 = obj結果.arr明細 || [];
  if (obj結果.bool成功 && obj結果.str分頁名) {
    const obj分頁 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(obj結果.str分頁名);
    if (obj分頁) { obj分頁.activate(); }
  }
  return {
    str文字: (obj結果.bool成功 ? '✔ ' : '✘ 無法產生：') + obj結果.str訊息 + (arr明細.length ? '\n\n・' + arr明細.join('\n・') : ''),
    str網址: obj結果.bool成功 ? String(obj結果.str列印網址 || '') : ''
  };
}
