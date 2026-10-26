/**
 * ======================================================================
 * 檔案：報表.gs（副本試算表 綁定指令碼）
 * 系統：自動進階篩選報表系統 — GAS 版 V5.6（由 VBA V4.5 改寫）
 * 日期：2026-10-21
 * ======================================================================
 *
 * 【安裝方式】
 *   1. 開啟「法會資料整理-範本」→ 擴充功能 → Apps Script。
 *   2. 新增指令碼檔案「報表」，貼上本檔全部內容。
 *   3. 範本已有 onOpen()（說明／下載資料／檢查重複／大車點名），
 *      請在既有 onOpen() 的最後加一行：
 *          建立報表選單();
 *      ⚠ 不要再新增第二個 onOpen()，否則只有其中一個會生效。
 *   4. 之後由範本複製出的副本都會自動帶有「報表」選單。
 *
 * 【報表工作表的版面（與 VBA 版相同）】
 *   模式一：預設來源（抓「有效資料」）
 *     A1 = 條件欄名（例：去程）   A2 = 條件值（例：1）
 *   模式二：指定來源
 *     A1 = 資料來源               A2 = 來源工作表名稱（例：無效資料）
 *     C1 = 條件欄名               C2 = 條件值
 *   A4 = 報表名稱（程式自動填：試算表名稱 - 分頁名稱）
 *   A5 = 參加人數（程式自動填）
 *   第 6 列：A6 自動填「序號」，B6 起填要顯示的欄位標題（需與來源第 1 列同名）
 *   第 7 列起：篩選結果（每次執行會先清空）
 *
 * 【條件值寫法（比照 Excel 進階篩選）】
 *   空白        → 全部列出
 *   王          → 以「王」開頭（文字）
 *   1           → 數值等於 1（不含 10、11；要「1 開頭」請寫 1*）
 *   2026/11/1   → 日期等於該日（也可寫 11/1，年份取今年）
 *   =王小明     → 完全等於
 *   *蓮*        → 含有「蓮」（* 任意字、? 單一字）
 *   <>自行      → 不等於「自行」（空白儲存格也算不等於）
 *   =           → 該欄空白者     <> → 該欄有填者
 *   >5、<=10    → 數字比較（只比對數字儲存格）
 *   >=2026/11/1 → 日期比較（只比對日期儲存格）
 *   ※ 判斷依據是儲存格的「實際值」（數字、日期、文字），與 Excel 相同。
 *   ※ 日期依指令碼專案時區解讀，請確認專案設定為 Asia/Taipei。
 *
 * 【與 VBA 版的差異】
 *   1. Google 試算表沒有「進階篩選」指令，改為程式依 Excel 規則自行比對條件
 *      （數字、日期依實際值比較，文字依開頭／萬用字元比對）。
 *   2. 沒有「縮小字型以適合欄寬」，資料區改為「自動換行」；
 *      第 5 列～最後一筆最少列高 24，需要換行時自動長高。
 *   3. Google 試算表沒有可存檔的「列印範圍」，改用以下方式從第 4 列開始列印：
 *      (1) 選單「列印報表」：自動隱藏第 1～3 列、凍結到第 6 列，列印「目前的工作表」；
 *          勾選「重複凍結的列」時每頁重印第 4～6 列（無法只重印第 6 列）。
 *          印完按視窗「列印完成」還原；Google 沒有列印完成事件，忘了按時
 *          於下次開檔或產生報表時自動還原。
 *      (2) 產生報表後自動選取 A4 到最後一筆，Ctrl+P 選「選取的儲存格」。
 *      (3) 選單「下載列印用 PDF」（A4 起、一頁寬、水平置中，不重印標題）。
 *   4. 報表名稱改為「試算表名稱 - 分頁名稱」（不再讀取「車輛資料」A3）。
 *   5. A4 主標題會跨欄合併置中（單一儲存格置中在試算表會被截斷）。
 *   6. 結果一律以「純文字」寫入，保留 0911-000000、前導 0 等格式。
 *
 * 【所需授權】
 *   只用到目前試算表與選單／對話框，不會新增額外的 Google 授權範圍。
 *
 * 【版本紀錄】
 *   V5.0（2026-10-21）由 VBA V4.5 改寫。
 *   V5.1（2026-10-21）第 4 列報表名稱改為「試算表名稱 - 分頁名稱」。
 *   V5.2（2026-10-21）條件比對改為與 Excel 相同：數字條件比數值（1 不含 10）、
 *                     日期條件比日期值；文字條件不比對數字／日期儲存格的大小。
 *   V5.3（2026-10-22）列印範圍從第 4 列開始：產生報表後自動選取 A4～最後一筆，
 *                     新增選單「選取列印範圍（A4 起）」；PDF 與選取共用同一範圍計算。
 *   V5.4（2026-10-22）第 5 列～最後一筆列高固定 24（第 4 列報表名稱維持自動），
 *                     資料區由「自動換行」改為「截斷」，避免換行撐高列高。
 *   V5.5（2026-10-22）資料區恢復自動換行；列高 24 改為「最少列高」，換行時自動長高。
 *   V5.6（2026-10-22）新增「列印報表」：列印前自動隱藏第 1～3 列並凍結到第 6 列，
 *                     列印完成按「列印完成」自動還原；另於開啟檔案、產生報表時自動還原（保險）。
 * ======================================================================
 */


// ======================================================================
// 共用設定（要調整字型、顏色、工作表名稱，改這裡即可）
// ======================================================================
const obj報表設定 = {
  str預設來源表: '有效資料',
  int條件標題列: 6,
  int資料起始列: 7,
  str字型: '標楷體',          // 電腦需安裝標楷體才會顯示，否則瀏覽器改用替代字型
  int主標題字級: 24,
  int內文字級: 14,
  int列高: 24,                // 第 5 列～最後一筆的最少列高（像素），換行時會自動長高
  int隱藏列數: 3,             // 列印時隱藏的條件區列數（第 1～3 列）
  str列印狀態鍵: '報表列印狀態_',   // 文件屬性鍵名前綴，後接工作表 ID，記錄列印前的原狀
  str警示底色: '#FFC8C8',     // 第 6 列找不到的標題（粉紅色）
  str自訂錯誤名稱: '使用者提示',
  // 這些是副本的資料工作表，不能拿來當報表（避免被清空）
  arr受保護工作表: ['有效資料', '無效資料', '重複檢查', '大車報到點名資料', '車輛資料']
};


// ======================================================================
// 選單
// ======================================================================

/**
 * 版本：V1.2（2026-10-22）
 * 名稱：建立報表選單
 * 用途：在試算表上方加入「報表」選單。
 * 呼叫：由既有的 onOpen() 呼叫，本身不是 onOpen。
 * 變更：V1.1 新增「選取列印範圍（A4 起）」。
 *       V1.2 新增「列印報表」「還原第 1～3 列」；開檔時自動還原未還原的列印設定。
 * 注意：選單要執行的函數名稱「不可」以底線結尾（底線結尾為私有函數，選單叫不到）。
 */
function 建立報表選單() {
  // 保險：上次列印後若沒按「列印完成」，開檔時把條件區還原
  // （放在 try 內，任何錯誤都不影響選單建立）
  try {
    還原全部列印設定_();
  } catch (err) {
    console.warn('開檔還原列印設定失敗：' + err.message);
  }

  SpreadsheetApp.getUi()
    .createMenu('報表')
    .addItem('產生篩選報表（目前工作表）', '選單_產生篩選報表')
    .addSeparator()
    .addItem('列印報表（自動隱藏第 1～3 列）', '選單_列印報表')
    .addItem('還原第 1～3 列（列印後）', '選單_還原列印設定')
    .addSeparator()
    .addItem('選取列印範圍（A4 起）', '選單_選取列印範圍')
    .addItem('下載列印用 PDF（目前工作表）', '選單_下載列印PDF')
    .addSeparator()
    .addItem('報表使用說明', '選單_報表使用說明')
    .addToUi();
}


/**
 * 版本：V1.1（2026-10-22）
 * 名稱：選單_產生篩選報表
 * 用途：選單入口。對「目前開著的工作表」產生篩選報表，完成後選取列印範圍並顯示彙整訊息。
 * 流程：取得鎖定 → 執行篩選報表_ → 選取 A4 起的列印範圍 → 顯示結果 → 釋放鎖定
 * 變更：V1.1 完成後自動選取列印範圍（取代 VBA 的「設定自動列印範圍」）。
 */
function 選單_產生篩選報表() {
  const ui = SpreadsheetApp.getUi();
  // 取得文件鎖，避免兩位承辦人同時按下造成資料互相覆蓋
  const objLock = LockService.getDocumentLock();
  if (!objLock.tryLock(10000)) {
    ui.alert('請稍候', '其他人正在產生報表，請過幾秒後再試一次。', ui.ButtonSet.OK);
    return;
  }

  try {
    const sheet目標 = SpreadsheetApp.getActiveSheet();

    // 若上次列印後還沒還原，先把第 1～3 列顯示回來，讓承辦人看得到條件區
    還原列印設定_(sheet目標);

    const obj結果 = 執行篩選報表_(sheet目標);

    // 對應 VBA [8]：選取 A4～最後一筆，方便直接按 Ctrl+P 列印「選取的儲存格」
    const rng列印 = 取得列印範圍_(sheet目標);
    sheet目標.setActiveRange(rng列印);

    // 組合完成訊息
    let str訊息 =
      '作業完成！\n' +
      '----------------------------------\n' +
      '【來源工作表】 : ' + obj結果.str來源名稱 + '\n' +
      '【條件區範圍】 : ' + obj結果.str條件區 + '\n' +
      '【篩選條件】   : ' + obj結果.str條件說明 + '\n' +
      '【篩選結果筆數】 : ' + obj結果.int筆數 + ' 筆\n' +
      '【列印範圍】   : ' + rng列印.getA1Notation() + '（已選取）\n\n' +
      '列印方式：請用「報表 → 列印報表」（自動隱藏第 1～3 列）。';

    // 若第 6 列有找不到的標題，一併提醒
    if (obj結果.arr找不到標題.length > 0) {
      str訊息 +=
        '\n\n⚠ 第 6 列以下標題在來源找不到（已標粉紅色，該欄留白）：\n' +
        obj結果.arr找不到標題.join('、');
    }
    ui.alert('系統通知', str訊息, ui.ButtonSet.OK);

  } catch (err) {
    顯示錯誤_(ui, err);
  } finally {
    objLock.releaseLock();
  }
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：選單_選取列印範圍
 * 用途：重新選取目前工作表 A4～最後一筆的範圍（例如手動調整過報表、或點到別處之後），
 *       並提示列印步驟。
 */
function 選單_選取列印範圍() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet目標 = SpreadsheetApp.getActiveSheet();
    const rng列印 = 取得列印範圍_(sheet目標);
    sheet目標.setActiveRange(rng列印);   // 選取後畫面會標出範圍
    ui.alert(
      '列印範圍已選取',
      '範圍：' + rng列印.getA1Notation() + '\n\n' +
      '請按 Ctrl+P，在右側「列印」選「選取的儲存格」，\n' +
      '「縮放」選「符合寬度」即可一頁寬列印。',
      ui.ButtonSet.OK
    );
  } catch (err) {
    顯示錯誤_(ui, err);
  }
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：選單_列印報表
 * 用途：列印前準備。自動隱藏第 1～3 列（條件區）、凍結到第 6 列，
 *       並開啟提示視窗；列印完成後按視窗中的「列印完成」即自動還原。
 * 說明：Google 不提供「列印完成」事件，程式無法自己知道何時印完，
 *       因此由提示視窗的按鈕觸發還原；若忘了按，下次開檔或產生報表時也會自動還原。
 */
function 選單_列印報表() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet目標 = SpreadsheetApp.getActiveSheet();

    // 防呆：資料工作表不做列印準備
    if (obj報表設定.arr受保護工作表.indexOf(sheet目標.getName()) !== -1) {
      拋出提示_('「' + sheet目標.getName() + '」是資料工作表，不是報表。\n請先切換到報表工作表再列印。');
    }

    // 確認這張是已產生的報表（沒有第 6 列標題會在這裡提示）
    const rng列印 = 取得列印範圍_(sheet目標);

    // 隱藏條件區、凍結標題（會先記錄原狀，供還原）
    準備列印_(sheet目標);
    SpreadsheetApp.flush();

    // 開啟非強制回應視窗：視窗開著時仍可操作試算表與列印
    const str畫面 =
      '<div style="font-family:sans-serif;font-size:14px;line-height:1.7">' +
      '<p>已隱藏第 1～3 列，列印範圍為 <b>' + rng列印.getA1Notation() + '</b>。</p>' +
      '<ol style="padding-left:20px;margin:0 0 10px">' +
      '<li>點上方選單「<b>檔案 → 列印</b>」（或點一下表格後按 Ctrl+P）</li>' +
      '<li>「列印」選 <b>目前的工作表</b></li>' +
      '<li>「縮放」選 <b>符合寬度</b></li>' +
      '<li>每頁要重印標題：「頁首和頁尾」勾選 <b>重複凍結的列</b></li>' +
      '<li>印完後，回來按下方按鈕</li>' +
      '</ol>' +
      '<button id="btn還原" onclick="還原()" ' +
      'style="padding:8px 18px;background:#1a73e8;color:#fff;border:0;border-radius:4px;font-size:14px;cursor:pointer">' +
      '列印完成，還原第 1～3 列</button>' +
      '<p id="訊息" style="color:#c5221f;font-size:13px"></p>' +
      '<script>' +
      'function 還原(){' +
      '  var btn=document.getElementById("btn還原");btn.disabled=true;btn.textContent="還原中…";' +
      '  google.script.run' +
      '    .withSuccessHandler(function(){google.script.host.close();})' +
      '    .withFailureHandler(function(e){' +
      '      btn.disabled=false;btn.textContent="再試一次";' +
      '      document.getElementById("訊息").textContent="還原失敗："+e.message+"。也可用選單「報表 → 還原第 1～3 列」。";' +
      '    })' +
      '    .對話框_還原列印設定(' + sheet目標.getSheetId() + ');' +
      '}' +
      '</script></div>';
    ui.showModelessDialog(
      HtmlService.createHtmlOutput(str畫面).setWidth(400).setHeight(330),
      '列印報表'
    );

  } catch (err) {
    顯示錯誤_(ui, err);
  }
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：選單_還原列印設定
 * 用途：備援。提示視窗被關掉、沒按到「列印完成」時，手動還原目前工作表的第 1～3 列與凍結設定。
 */
function 選單_還原列印設定() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet目標 = SpreadsheetApp.getActiveSheet();
    const bool有還原 = 還原列印設定_(sheet目標);
    if (!bool有還原) {
      // 沒有列印紀錄時，仍把第 1～3 列顯示出來（例如被手動隱藏）
      sheet目標.showRows(1, obj報表設定.int隱藏列數);
    }
    ui.alert('已還原', '第 1～3 列已重新顯示。', ui.ButtonSet.OK);
  } catch (err) {
    顯示錯誤_(ui, err);
  }
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：對話框_還原列印設定
 * 用途：給提示視窗的「列印完成」按鈕呼叫（google.script.run 不能呼叫底線結尾的函數）。
 * 參數：int工作表ID — 列印時的工作表 ID（使用者可能已切換到別的分頁，所以用 ID 找回）
 */
function 對話框_還原列印設定(int工作表ID) {
  const sheet目標 = 依ID取得工作表_(SpreadsheetApp.getActiveSpreadsheet(), int工作表ID);
  if (!sheet目標) {
    // 工作表已被刪除：清掉紀錄即可
    PropertiesService.getDocumentProperties().deleteProperty(obj報表設定.str列印狀態鍵 + int工作表ID);
    return;
  }
  還原列印設定_(sheet目標);
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：準備列印_
 * 用途：記錄原本的凍結列數與第 1～3 列的隱藏狀態，再隱藏第 1～3 列、凍結到第 6 列。
 *       若已在列印準備狀態（重複按），不覆蓋原紀錄，避免還原成錯誤狀態。
 */
function 準備列印_(sheet目標) {
  const objProps = PropertiesService.getDocumentProperties();
  const str鍵 = obj報表設定.str列印狀態鍵 + sheet目標.getSheetId();
  const int隱藏列數 = obj報表設定.int隱藏列數;

  // 第一次準備才記錄原狀
  if (!objProps.getProperty(str鍵)) {
    const arr原隱藏 = [];
    for (let i = 1; i <= int隱藏列數; i++) arr原隱藏.push(sheet目標.isRowHiddenByUser(i));
    objProps.setProperty(str鍵, JSON.stringify({
      int原凍結列: sheet目標.getFrozenRows(),
      arr原隱藏: arr原隱藏
    }));
  }

  // 隱藏條件區，凍結到第 6 列（勾選「重複凍結的列」時，每頁會重印第 4～6 列）
  sheet目標.hideRows(1, int隱藏列數);
  sheet目標.setFrozenRows(obj報表設定.int條件標題列);
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：還原列印設定_
 * 用途：依列印前的紀錄，顯示第 1～3 列（原本就隱藏的維持隱藏）、還原凍結列數，並刪除紀錄。
 * 回傳：true＝有紀錄並已還原；false＝沒有列印紀錄（不做任何事）
 */
function 還原列印設定_(sheet目標) {
  const objProps = PropertiesService.getDocumentProperties();
  const str鍵 = obj報表設定.str列印狀態鍵 + sheet目標.getSheetId();
  const str紀錄 = objProps.getProperty(str鍵);
  if (!str紀錄) return false;

  // 紀錄損壞時，以「全部顯示、不凍結」還原，確保條件區看得到
  let obj紀錄 = { int原凍結列: 0, arr原隱藏: [] };
  try {
    obj紀錄 = JSON.parse(str紀錄);
  } catch (err) {
    console.warn('列印紀錄格式錯誤，改用預設還原：' + str紀錄);
  }

  const int隱藏列數 = obj報表設定.int隱藏列數;
  sheet目標.showRows(1, int隱藏列數);
  // 原本就被使用者隱藏的列，維持隱藏
  (obj紀錄.arr原隱藏 || []).forEach(function (bool原隱藏, i) {
    if (bool原隱藏) sheet目標.hideRows(i + 1);
  });
  sheet目標.setFrozenRows(Number(obj紀錄.int原凍結列) || 0);

  objProps.deleteProperty(str鍵);
  return true;
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：還原全部列印設定_
 * 用途：開檔時呼叫。把所有留有列印紀錄的工作表一次還原（忘了按「列印完成」的保險）。
 */
function 還原全部列印設定_() {
  const objProps = PropertiesService.getDocumentProperties();
  const str前綴 = obj報表設定.str列印狀態鍵;
  const arr鍵 = objProps.getKeys().filter(function (k) { return k.indexOf(str前綴) === 0; });
  if (arr鍵.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  arr鍵.forEach(function (str鍵) {
    const sheet = 依ID取得工作表_(ss, Number(str鍵.substring(str前綴.length)));
    if (sheet) 還原列印設定_(sheet);
    else objProps.deleteProperty(str鍵);   // 工作表已刪除，清掉紀錄
  });
}


/** 版本：V1.0｜依工作表 ID 找工作表，找不到回傳 null */
function 依ID取得工作表_(ss, int工作表ID) {
  const arr符合 = ss.getSheets().filter(function (sh) { return sh.getSheetId() === Number(int工作表ID); });
  return arr符合.length > 0 ? arr符合[0] : null;
}


/**
 * 版本：V1.0（2026-10-22）
 * 名稱：取得列印範圍_
 * 用途：計算列印範圍：A4 起（報表名稱），寬到第 6 列最後一欄，高到 B 欄最後一筆（至少到第 6 列）。
 *       「選取列印範圍」與「下載列印用 PDF」共用，確保兩者範圍一致。
 * 參數：sheet目標 — 報表工作表
 * 回傳：Range（例：A4:H35）
 */
function 取得列印範圍_(sheet目標) {
  const int起始列 = 4;   // 第 4 列：報表名稱
  const int末欄 = 取得列末欄_(sheet目標, obj報表設定.int條件標題列);
  if (int末欄 < 2) {
    拋出提示_('這張工作表還沒有報表。\n請先執行「報表 → 產生篩選報表」。');
  }
  // 以 B 欄最後一筆為底；沒有資料時至少印到第 6 列標題
  const int末列 = Math.max(取得欄末列_(sheet目標, 2), obj報表設定.int條件標題列);
  return sheet目標.getRange(int起始列, 1, int末列 - int起始列 + 1, int末欄);
}


/**
 * 版本：V1.1（2026-10-22）
 * 名稱：選單_下載列印PDF
 * 用途：取代 VBA 的「設定自動列印範圍」。
 *       產生 A4 起至最後一筆資料的 PDF 下載連結（一頁寬、水平置中、直式 A4）。
 * 說明：用瀏覽器本身的登入狀態下載，不需額外授權。
 */
function 選單_下載列印PDF() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet目標 = ss.getActiveSheet();

    // 列印範圍與「選取列印範圍」共用同一計算（A4 起）
    const rng列印 = 取得列印範圍_(sheet目標);
    const int末列 = rng列印.getLastRow();
    const int末欄 = rng列印.getLastColumn();

    // 確保畫面上的變更都已寫入，再匯出
    SpreadsheetApp.flush();

    // 匯出參數：r1/c1 為 0 起算的起點（含），r2/c2 為終點（不含）
    const obj參數 = {
      format: 'pdf',
      gid: sheet目標.getSheetId(),
      r1: rng列印.getRow() - 1,   // 第 4 列（報表名稱），0 起算
      c1: 0,              // A 欄
      r2: int末列,
      c2: int末欄,
      size: 'A4',
      portrait: 'true',
      fitw: 'true',       // 一頁寬
      horizontal_alignment: 'CENTER',
      vertical_alignment: 'TOP',
      gridlines: 'false',
      printtitle: 'false',
      sheetnames: 'false',
      pagenum: 'CENTER',
      top_margin: '0.5',
      bottom_margin: '0.5',
      left_margin: '0.4',
      right_margin: '0.4'
    };
    const str網址 =
      'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' +
      Object.keys(obj參數)
        .map(function (strKey) { return strKey + '=' + encodeURIComponent(obj參數[strKey]); })
        .join('&');

    // 以對話框顯示下載按鈕
    const str畫面 =
      '<div style="font-family:sans-serif;font-size:14px;line-height:1.8">' +
      '<p>工作表：<b>' + 轉義HTML_(sheet目標.getName()) + '</b><br>' +
      '列印範圍：A4 ～ 第 ' + int末列 + ' 列，共 ' + int末欄 + ' 欄</p>' +
      '<p><a href="' + str網址 + '" target="_blank" ' +
      'style="display:inline-block;padding:8px 18px;background:#1a73e8;color:#fff;' +
      'border-radius:4px;text-decoration:none">下載 PDF</a></p>' +
      '<p style="color:#666;font-size:12px">註：第 2 頁起不會重印第 6 列標題。</p>' +
      '</div>';
    ui.showModalDialog(
      HtmlService.createHtmlOutput(str畫面).setWidth(380).setHeight(220),
      '下載列印用 PDF'
    );

  } catch (err) {
    顯示錯誤_(ui, err);
  }
}


/**
 * 版本：V1.0（2026-10-21）
 * 名稱：選單_報表使用說明
 * 用途：顯示報表工作表的版面與條件寫法，方便承辦人查閱。
 */
function 選單_報表使用說明() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '報表使用說明',
    '【建立報表】新增一張工作表，依下列方式填寫後，按「報表 → 產生篩選報表」。\n\n' +
    '■ 從「有效資料」篩選：\n' +
    '   A1 填條件欄名（例：去程），A2 填條件值（例：1）\n\n' +
    '■ 從其他工作表篩選：\n' +
    '   A1 填「資料來源」，A2 填工作表名稱\n' +
    '   C1 填條件欄名，C2 填條件值\n\n' +
    '■ 第 6 列從 B6 起，填要顯示的欄位（需與來源第 1 列同名）\n\n' +
    '【條件值寫法】\n' +
    '   空白＝全部　王＝王開頭　=王小明＝完全相同\n' +
    '   1＝數值等於 1（不含 10）　1*＝1 開頭\n' +
    '   2026/11/1 或 11/1＝該日期\n' +
    '   *蓮*＝含有蓮　<>自行＝不是自行\n' +
    '   =＝空白者　<>＝有填者\n' +
    '   >5、<=10＝數字比較　>=2026/11/1＝日期比較\n\n' +
    '【列印】按「報表 → 列印報表」，系統會自動隱藏第 1～3 列，\n' +
    '   再依視窗步驟列印（列印：目前的工作表）。\n' +
    '   印完按視窗中的「列印完成」即還原；忘了按，\n' +
    '   下次開檔或產生報表時也會自動還原。\n\n' +
    '【注意】第 7 列以下每次都會清空重寫，請勿在此手動填資料。',
    ui.ButtonSet.OK
  );
}


// ======================================================================
// 主流程
// ======================================================================

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：執行篩選報表_
 * 用途：報表主流程（對應 VBA 主程序 [1]～[7]）。
 * 參數：sheet目標 — 要產生報表的工作表
 * 回傳：{ str來源名稱, str條件區, str條件說明, int筆數, arr找不到標題 }
 */
function 執行篩選報表_(sheet目標) {
  const ss = sheet目標.getParent();

  // [0] 防呆：不可把資料工作表當成報表，否則第 7 列以下會被清空
  if (obj報表設定.arr受保護工作表.indexOf(sheet目標.getName()) !== -1) {
    拋出提示_(
      '「' + sheet目標.getName() + '」是資料工作表，不能拿來產生報表。\n' +
      '請先切換到報表用的工作表，再執行一次。'
    );
  }

  // [1][2] 判定資料來源模式與條件區
  const obj來源 = 判定資料來源與條件_(ss, sheet目標);

  // [3] 讀取來源資料（第 1 列為標題）
  const obj來源資料 = 讀取來源資料_(obj來源.sheet來源);

  // [4] 檢查第 6 列標題，找不到的標粉紅色
  const obj標題 = 檢查報表標題_(sheet目標, obj來源資料.map欄位);

  // [5] 清除第 7 列以下舊資料與格式
  清除舊報表資料_(sheet目標);

  // [6] 依條件篩選，並依第 6 列標題取出欄位
  const arr結果列 = 篩選來源資料_(obj來源資料, obj來源, obj標題.arr報表標題);
  寫入篩選結果_(sheet目標, arr結果列);

  // [7] 美化格式、填序號、回傳筆數
  const int筆數 = 執行報表美化與序號填寫_(ss, sheet目標, arr結果列.length, obj標題.int末欄);

  SpreadsheetApp.flush();

  return {
    str來源名稱: obj來源.sheet來源.getName(),
    str條件區: obj來源.str條件區,
    str條件說明: obj來源.str條件欄名 === ''
      ? '（未設定，全部列出）'
      : obj來源.str條件欄名 + '　' + (obj來源.str條件值 === '' ? '（空白＝全部）' : obj來源.str條件值),
    int筆數: int筆數,
    arr找不到標題: obj標題.arr找不到標題
  };
}


// ======================================================================
// 步驟函數
// ======================================================================

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：判定資料來源與條件_
 * 用途：對應 VBA [2]。
 *       A1 =「資料來源」→ 來源為 A2 指定工作表，條件區 C1:C2
 *       否則           → 來源為「有效資料」，條件區 A1:A2
 * 回傳：{ sheet來源, str條件區, str條件欄名, str條件值 }
 */
function 判定資料來源與條件_(ss, sheet目標) {
  const strA1 = String(sheet目標.getRange('A1').getDisplayValue()).trim();
  let sheet來源 = null;
  let str條件區 = '';

  if (strA1 === '資料來源') {
    // 模式二：指定來源
    const str來源名稱 = String(sheet目標.getRange('A2').getDisplayValue()).trim();
    if (str來源名稱 === '') {
      拋出提示_('A1 寫了「資料來源」，但 A2 沒有填工作表名稱。\n請在 A2 填入要抓資料的工作表名稱。');
    }
    sheet來源 = ss.getSheetByName(str來源名稱);
    if (!sheet來源) {
      拋出提示_(
        '找不到 A2 指定的工作表：「' + str來源名稱 + '」\n' +
        '請確認名稱與下方工作表分頁完全相同（包含空白、全形半形）。'
      );
    }
    str條件區 = 'C1:C2';
  } else {
    // 模式一：預設來源
    sheet來源 = ss.getSheetByName(obj報表設定.str預設來源表);
    if (!sheet來源) {
      拋出提示_(
        '找不到「' + obj報表設定.str預設來源表 + '」工作表。\n' +
        '這份檔案可能不是由範本建立的副本，或工作表被改名了。'
      );
    }
    str條件區 = 'A1:A2';
  }

  // 來源不能是報表自己（否則清空後就沒資料了）
  if (sheet來源.getSheetId() === sheet目標.getSheetId()) {
    拋出提示_('資料來源不能是這張報表本身，請修改 A2 的工作表名稱。');
  }

  // 讀取條件欄名與條件值
  const arr條件 = sheet目標.getRange(str條件區).getDisplayValues();
  const str條件欄名 = String(arr條件[0][0]).trim();
  const str條件值 = String(arr條件[1][0]).trim();

  // 有條件值卻沒有欄名，無法判斷要比對哪一欄
  if (str條件欄名 === '' && str條件值 !== '') {
    拋出提示_(
      '條件區 ' + str條件區 + ' 有填條件值「' + str條件值 + '」，但上方沒有填欄位名稱。\n' +
      '請在 ' + str條件區.split(':')[0] + ' 填入要比對的欄位名稱（例：去程）。'
    );
  }

  return { sheet來源: sheet來源, str條件區: str條件區, str條件欄名: str條件欄名, str條件值: str條件值 };
}


/**
 * 版本：V1.1（2026-10-21）
 * 名稱：讀取來源資料_
 * 用途：對應 VBA [3]。一次讀出來源工作表全部內容。
 *       同時保留「顯示值」（寫入報表用）與「實際值」（比對條件用，數字／日期與 Excel 一樣比實際值）。
 * 變更：V1.1 新增 arr原值。
 * 回傳：{ arr資料: 顯示值二維陣列, arr原值: 實際值二維陣列（兩者列數對應）, map欄位: 標題→欄索引 }
 */
function 讀取來源資料_(sheet來源) {
  const int末列 = sheet來源.getLastRow();
  const int末欄 = sheet來源.getLastColumn();
  if (int末列 < 1 || int末欄 < 1) {
    拋出提示_('來源工作表「' + sheet來源.getName() + '」是空的，沒有任何資料可以篩選。');
  }

  const rng來源 = sheet來源.getRange(1, 1, int末列, int末欄);
  const arr顯示全部 = rng來源.getDisplayValues();   // 畫面上看到的文字（電話、日期格式與畫面一致）
  const arr原值全部 = rng來源.getValues();          // 實際值：數字為 number、日期為 Date

  // 建立「標題 → 欄索引」對照表（同名標題以第一個為準）
  const map欄位 = new Map();
  arr顯示全部[0].forEach(function (str標題, int索引) {
    const str名稱 = String(str標題).trim();
    if (str名稱 !== '' && !map欄位.has(str名稱)) map欄位.set(str名稱, int索引);
  });

  // 取資料列，略過整列空白；顯示值與實際值同步收集，索引才會對應
  const arr資料 = [];
  const arr原值 = [];
  for (let i = 1; i < arr顯示全部.length; i++) {
    const bool有內容 = arr顯示全部[i].some(function (v) { return String(v).trim() !== ''; });
    if (!bool有內容) continue;
    arr資料.push(arr顯示全部[i]);
    arr原值.push(arr原值全部[i]);
  }

  return { arr資料: arr資料, arr原值: arr原值, map欄位: map欄位 };
}


/**
 * 版本：V1.0（2026-10-21）
 * 名稱：檢查報表標題_
 * 用途：對應 VBA [4]。檢查第 6 列 B 欄起的標題是否存在於來源，
 *       找不到者標粉紅色，找得到者清除底色。
 * 回傳：{ int末欄, arr報表標題, arr找不到標題 }
 */
function 檢查報表標題_(sheet目標, map欄位) {
  const int標題列 = obj報表設定.int條件標題列;
  const int末欄 = 取得列末欄_(sheet目標, int標題列);
  if (int末欄 < 2) {
    拋出提示_('請在第 6 列（從 B6 開始）填入要顯示的欄位標題，\n名稱需與來源工作表第 1 列相同。');
  }

  const rng標題 = sheet目標.getRange(int標題列, 2, 1, int末欄 - 1);
  const arr報表標題 = rng標題.getDisplayValues()[0].map(function (s) { return String(s).trim(); });
  const arr找不到標題 = [];

  // 逐欄決定底色
  const arr底色 = arr報表標題.map(function (str標題, int索引) {
    if (str標題 !== '' && map欄位.has(str標題)) return null;   // 找得到：清除底色
    arr找不到標題.push(str標題 === '' ? '（第 ' + 欄號轉英文_(int索引 + 2) + ' 欄空白）' : str標題);
    return obj報表設定.str警示底色;                              // 找不到：粉紅色
  });
  rng標題.setBackgrounds([arr底色]);

  return { int末欄: int末欄, arr報表標題: arr報表標題, arr找不到標題: arr找不到標題 };
}


/**
 * 版本：V1.0（2026-10-21）
 * 名稱：清除舊報表資料_
 * 用途：對應 VBA [5]。清除第 7 列以下所有內容、格式、框線，並解除合併儲存格。
 */
function 清除舊報表資料_(sheet目標) {
  const int起始列 = obj報表設定.int資料起始列;
  const int總列數 = sheet目標.getMaxRows();
  if (int總列數 < int起始列) return;   // 沒有第 7 列，不需清除

  const rng清除 = sheet目標.getRange(int起始列, 1, int總列數 - int起始列 + 1, sheet目標.getMaxColumns());
  rng清除.breakApart();   // 先解除合併，避免寫入時出錯
  rng清除.clear();        // 清除內容與格式（含框線）
}


/**
 * 版本：V1.1（2026-10-21）
 * 名稱：篩選來源資料_
 * 用途：對應 VBA [6] 的 AdvancedFilter。
 *       依條件篩出資料列，再依第 6 列標題順序取出欄位（找不到的欄位留白）。
 * 變更：V1.1 條件先解析一次，再以實際值逐列比對（與 Excel 相同）。
 * 回傳：二維陣列，每列對應報表 B 欄起的內容（顯示值）
 */
function 篩選來源資料_(obj來源資料, obj來源, arr報表標題) {
  const map欄位 = obj來源資料.map欄位;
  let int條件欄 = -1;

  // 有設定條件欄名時，確認該欄存在於來源
  if (obj來源.str條件欄名 !== '') {
    if (!map欄位.has(obj來源.str條件欄名)) {
      拋出提示_(
        '條件區 ' + obj來源.str條件區 + ' 的欄位名稱「' + obj來源.str條件欄名 + '」\n' +
        '在來源工作表「' + obj來源.sheet來源.getName() + '」第 1 列找不到。\n' +
        '請確認名稱完全相同（包含空白、全形半形）。'
      );
    }
    int條件欄 = map欄位.get(obj來源.str條件欄名);
  }

  // 條件只解析一次（判斷是數字、日期或文字條件）
  const obj條件 = int條件欄 < 0 ? null : 解析條件_(obj來源.str條件值);

  // 第 6 列每個標題對應來源的欄索引（找不到為 -1）
  const arr欄位索引 = arr報表標題.map(function (s) { return map欄位.has(s) ? map欄位.get(s) : -1; });

  const arr結果 = [];
  obj來源資料.arr資料.forEach(function (arr列, int列索引) {
    // 未設條件欄 → 全部保留；有條件 → 用實際值比對
    if (obj條件) {
      const any原值 = obj來源資料.arr原值[int列索引][int條件欄];
      if (!判斷符合條件_(any原值, arr列[int條件欄], obj條件)) return;
    }
    arr結果.push(arr欄位索引.map(function (i) { return i < 0 ? '' : arr列[i]; }));
  });
  return arr結果;
}


/**
 * 版本：V1.0（2026-10-21）
 * 名稱：寫入篩選結果_
 * 用途：把篩選結果一次寫入第 7 列 B 欄起，並設為純文字格式（保留電話、前導 0）。
 *       列數不足時自動新增列。
 */
function 寫入篩選結果_(sheet目標, arr結果列) {
  if (arr結果列.length === 0) return;   // 沒有符合的資料
  const int起始列 = obj報表設定.int資料起始列;
  const int欄數 = arr結果列[0].length;
  const int需要末列 = int起始列 + arr結果列.length - 1;

  // 工作表列數不夠時先補列，否則 setValues 會出錯
  const int現有列數 = sheet目標.getMaxRows();
  if (int需要末列 > int現有列數) {
    sheet目標.insertRowsAfter(int現有列數, int需要末列 - int現有列數);
  }

  const rng寫入 = sheet目標.getRange(int起始列, 2, arr結果列.length, int欄數);
  rng寫入.setNumberFormat('@');   // 純文字，避免 0911-000000 被轉成數字或日期
  rng寫入.setValues(arr結果列);
}


/**
 * 版本：V1.1（2026-10-21）
 * 名稱：執行報表美化與序號填寫_
 * 用途：對應 VBA 獨立函數。設定報表名稱、參加人數、標題列、序號與框線。
 * 變更：V1.1 報表名稱改為「試算表名稱 - 分頁名稱」，不再讀取「車輛資料」A3。
 *       V1.2 第 5 列～最後一筆列高固定為 obj報表設定.int列高（24）；資料區改為截斷不換行。
 *       V1.3 資料區恢復自動換行；列高改為最少 24，內容需要換行時自動長高。
 * 參數：ss、sheet目標、int筆數（篩選結果筆數）、int末欄（第 6 列最後一欄）
 * 回傳：參加人數（= 篩選結果筆數）
 */
function 執行報表美化與序號填寫_(ss, sheet目標, int筆數, int末欄) {
  const str字型 = obj報表設定.str字型;
  const int字級 = obj報表設定.int內文字級;

  // --- A. A4 報表名稱：試算表名稱 ＋ 分頁名稱 ---
  const str報表名稱 = ss.getName() + ' - ' + sheet目標.getName();

  const rng主標題 = sheet目標.getRange(4, 1, 1, int末欄);
  rng主標題.breakApart();
  rng主標題.merge();   // 跨欄合併，置中才會在整個報表寬度置中
  sheet目標.getRange('A4').setValue(str報表名稱);
  rng主標題
    .setFontFamily(str字型)
    .setFontSize(obj報表設定.int主標題字級)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // --- B. A5 參加人數 ---
  sheet目標.getRange('A5')
    .setValue('參加人數 : ' + int筆數 + ' 人')
    .setFontFamily(str字型)
    .setFontSize(int字級)
    .setHorizontalAlignment('left');

  // --- C. 第 6 列：序號標題、字型、框線 ---
  sheet目標.getRange('A6').setValue('序號').setBackground(null);
  sheet目標.getRange(obj報表設定.int條件標題列, 1, 1, int末欄)
    .setFontFamily(str字型)
    .setFontSize(int字級)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);

  // --- D. 資料區：序號、字型、框線、自動換行 ---
  if (int筆數 > 0) {
    const int起始列 = obj報表設定.int資料起始列;

    // 序號一次寫入（1、2、3…）
    const arr序號 = [];
    for (let i = 1; i <= int筆數; i++) arr序號.push([i]);
    sheet目標.getRange(int起始列, 1, int筆數, 1).setNumberFormat('0').setValues(arr序號);

    sheet目標.getRange(int起始列, 1, int筆數, int末欄)
      .setFontFamily(str字型)
      .setFontSize(int字級)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP)   // 自動換行（取代 Excel 的「縮小字型以適合欄寬」）
      .setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
  }

  // --- E. 列高：第 5 列（參加人數）～最後一筆最少 24；第 4 列報表名稱字大，維持自動 ---
  const int列高起始列 = 5;
  const int列高末列 = obj報表設定.int資料起始列 + Math.max(int筆數, 0) - 1;   // 無資料時到第 6 列
  const int列數 = Math.max(int列高末列, obj報表設定.int條件標題列) - int列高起始列 + 1;
  // 用 setRowHeights（非 Forced）：設定為 24，但內容換行需要更高時，Google 會自動長高
  sheet目標.setRowHeights(int列高起始列, int列數, obj報表設定.int列高);

  return int筆數;
}


// ======================================================================
// 條件比對（模擬 Excel 進階篩選規則）
// ======================================================================

/**
 * 版本：V2.0（2026-10-21）
 * 名稱：解析條件_
 * 用途：把條件字串拆成「運算子＋比較值」，並判斷比較值是數字、日期或文字（規則同 Excel）。
 *       沒寫運算子時視為「=」；但文字條件沒寫運算子時是「開頭符合」。
 * 參數：str條件 — 條件值（A2 或 C2）
 * 回傳：{ str類型: '全部'|'空白'|'有填'|'無效'|'數字'|'日期'|'文字', str運算子, num值, re規則, str文字 }
 */
function 解析條件_(str條件) {
  const str條件文字 = String(str條件).trim();

  // 條件空白 → 全部符合
  if (str條件文字 === '') return { str類型: '全部' };

  // 拆出運算子（先比對兩字元的，避免 >= 被當成 >）
  const arr拆解 = str條件文字.match(/^(>=|<=|<>|>|<|=)([\s\S]*)$/);
  const bool無運算子 = !arr拆解;
  const str運算子 = bool無運算子 ? '=' : arr拆解[1];
  const str比較值 = bool無運算子 ? str條件文字 : arr拆解[2].trim();

  // 只有運算子：「=」找空白、「<>」找有填，其他（如單獨的 >）無意義
  if (!bool無運算子 && str比較值 === '') {
    if (str運算子 === '=') return { str類型: '空白' };
    if (str運算子 === '<>') return { str類型: '有填' };
    return { str類型: '無效' };
  }

  // 數字條件：比數值（1 只等於 1，不含 10）
  if (是數字_(str比較值)) {
    return { str類型: '數字', str運算子: str運算子, num值: 轉數字_(str比較值) };
  }

  // 日期條件：比日期值
  const num日期 = 解析日期文字_(str比較值);
  if (num日期 !== null) {
    return { str類型: '日期', str運算子: str運算子, num值: num日期 };
  }

  // 文字條件：沒寫運算子時為「開頭符合」（等同後面加 *）
  return {
    str類型: '文字',
    str運算子: str運算子,
    re規則: 建立萬用字元規則_(bool無運算子 ? str比較值 + '*' : str比較值),
    str文字: str比較值
  };
}


/**
 * 版本：V2.0（2026-10-21）
 * 名稱：判斷符合條件_
 * 用途：判斷一個儲存格是否符合已解析的條件（規則同 Excel 進階篩選，不分大小寫）。
 *       數字條件只比對數字儲存格、日期條件只比對日期儲存格；
 *       「<>」時，類型不同或空白的儲存格都算「不等於」而保留。
 * 參數：any原值（getValues 的實際值）、str顯示值（getDisplayValues 的文字）、obj條件（解析條件_ 的結果）
 * 回傳：true（符合）／false（不符合）
 */
function 判斷符合條件_(any原值, str顯示值, obj條件) {
  const str值 = String(str顯示值).trim();

  switch (obj條件.str類型) {
    case '全部': return true;
    case '空白': return str值 === '';
    case '有填': return str值 !== '';
    case '無效': return false;

    case '數字': {
      const num值 = 取得數值_(any原值);
      if (num值 === null) return obj條件.str運算子 === '<>';   // 不是數字：只有「不等於」成立
      return 比較結果_(num值 - obj條件.num值, obj條件.str運算子);
    }

    case '日期': {
      const num日期 = 取得日期值_(any原值);
      if (num日期 === null) return obj條件.str運算子 === '<>';  // 不是日期：只有「不等於」成立
      return 比較結果_(num日期 - obj條件.num值, obj條件.str運算子);
    }

    case '文字': {
      // 等於／不等於：用萬用字元比對畫面文字
      if (obj條件.str運算子 === '=') return obj條件.re規則.test(str值);
      if (obj條件.str運算子 === '<>') return !obj條件.re規則.test(str值);
      // 大小比較：只比對文字儲存格（數字、日期、空白不列入，同 Excel）
      if (str值 === '' || 取得數值_(any原值) !== null || 是日期物件_(any原值)) return false;
      return 比較結果_(str值.localeCompare(obj條件.str文字, 'zh-Hant'), obj條件.str運算子);
    }
  }
  return false;
}


/** 版本：V1.0｜依運算子判斷差值（int差 = 儲存格 − 條件） */
function 比較結果_(num差, str運算子) {
  const bool相等 = Math.abs(num差) < 1e-9;   // 避免小數誤差
  switch (str運算子) {
    case '=':  return bool相等;
    case '<>': return !bool相等;
    case '>':  return !bool相等 && num差 > 0;
    case '<':  return !bool相等 && num差 < 0;
    case '>=': return bool相等 || num差 > 0;
    case '<=': return bool相等 || num差 < 0;
  }
  return false;
}

/** 版本：V1.0｜判斷是否為日期物件（試算表的日期儲存格） */
function 是日期物件_(any值) {
  return Object.prototype.toString.call(any值) === '[object Date]' && !isNaN(any值.getTime());
}

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：取得數值_
 * 用途：取得儲存格的數值；數字儲存格直接用，看起來像數字的文字也轉為數字（表單回覆常見），
 *       日期、布林、其他文字回傳 null。
 */
function 取得數值_(any原值) {
  if (typeof any原值 === 'number') return any原值;
  if (typeof any原值 === 'string' && 是數字_(any原值)) return 轉數字_(any原值);
  return null;
}

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：取得日期值_
 * 用途：取得儲存格的日期時間（毫秒）；日期儲存格直接用，日期樣式的文字也嘗試解讀，其餘回傳 null。
 */
function 取得日期值_(any原值) {
  if (是日期物件_(any原值)) return any原值.getTime();
  if (typeof any原值 === 'string') return 解析日期文字_(any原值);
  return null;
}

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：解析日期文字_
 * 用途：把日期文字轉成毫秒值；支援 2026/11/1、2026-11-01、2026.11.1、2026年11月1日、
 *       11/1（年份取今年，同 Excel），可再接時間 8:30 或 8:30:00。
 * 回傳：毫秒值；不是有效日期時回傳 null（例如 2026/2/30）
 */
function 解析日期文字_(str文字) {
  const arr符合 = String(str文字).trim().match(
    /^(?:(\d{4})\s*[\/\-.年]\s*)?(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!arr符合) return null;

  const int年 = arr符合[1] ? Number(arr符合[1]) : new Date().getFullYear();
  const int月 = Number(arr符合[2]);
  const int日 = Number(arr符合[3]);
  const int時 = arr符合[4] ? Number(arr符合[4]) : 0;
  const int分 = arr符合[5] ? Number(arr符合[5]) : 0;
  const int秒 = arr符合[6] ? Number(arr符合[6]) : 0;

  const dt日期 = new Date(int年, int月 - 1, int日, int時, int分, int秒);
  // 檢查日期是否真的存在（避免 2/30 被自動進位成 3/2）
  if (dt日期.getFullYear() !== int年 || dt日期.getMonth() !== int月 - 1 || dt日期.getDate() !== int日 ||
      int時 > 23 || int分 > 59 || int秒 > 59) {
    return null;
  }
  return dt日期.getTime();
}


/**
 * 版本：V1.0（2026-10-21）
 * 名稱：建立萬用字元規則_
 * 用途：把 Excel 萬用字元轉為正規表示式（* 任意字、? 單一字、~* ~? ~~ 為字面字元）。
 * 回傳：RegExp（整段比對、不分大小寫）
 */
function 建立萬用字元規則_(str樣式) {
  let str規則 = '';
  for (let i = 0; i < str樣式.length; i++) {
    const str字 = str樣式[i];
    const str下一字 = str樣式[i + 1];
    // ~ 後接 * ? ~ 時，代表該字元本身
    if (str字 === '~' && (str下一字 === '*' || str下一字 === '?' || str下一字 === '~')) {
      str規則 += 跳脫正規字元_(str下一字);
      i++;
      continue;
    }
    if (str字 === '*') str規則 += '[\\s\\S]*';
    else if (str字 === '?') str規則 += '[\\s\\S]';
    else str規則 += 跳脫正規字元_(str字);
  }
  return new RegExp('^' + str規則 + '$', 'i');
}


// ======================================================================
// 共用小工具
// ======================================================================

/** 版本：V1.0｜跳脫正規表示式特殊字元 */
function 跳脫正規字元_(str字) {
  return str字.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
}

/** 版本：V1.0｜判斷字串是否為數字（允許千分位逗號） */
function 是數字_(str值) {
  const str純 = String(str值).replace(/,/g, '').trim();
  return str純 !== '' && !isNaN(Number(str純));
}

/** 版本：V1.0｜字串轉數字（去除千分位逗號） */
function 轉數字_(str值) {
  return Number(String(str值).replace(/,/g, '').trim());
}

/** 版本：V1.0｜HTML 特殊字元轉義，避免工作表名稱破壞對話框 */
function 轉義HTML_(str文字) {
  return String(str文字)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 版本：V1.0｜欄號轉英文欄名（2 → B） */
function 欄號轉英文_(int欄號) {
  let str欄名 = '';
  while (int欄號 > 0) {
    const int餘數 = (int欄號 - 1) % 26;
    str欄名 = String.fromCharCode(65 + int餘數) + str欄名;
    int欄號 = Math.floor((int欄號 - 1) / 26);
  }
  return str欄名;
}

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：取得列末欄_
 * 用途：等同 VBA 的 Cells(列, Columns.Count).End(xlToLeft)，找某一列最後一個有值的欄。
 * 回傳：欄號（整列空白回傳 0）
 */
function 取得列末欄_(sheet, int列) {
  const int總欄 = sheet.getLastColumn();
  if (int總欄 < 1) return 0;
  const arr值 = sheet.getRange(int列, 1, 1, int總欄).getDisplayValues()[0];
  for (let i = arr值.length - 1; i >= 0; i--) {
    if (String(arr值[i]).trim() !== '') return i + 1;
  }
  return 0;
}

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：取得欄末列_
 * 用途：等同 VBA 的 Cells(Rows.Count, 欄).End(xlUp)，找某一欄最後一個有值的列。
 * 回傳：列號（整欄空白回傳 0）
 */
function 取得欄末列_(sheet, int欄) {
  const int總列 = sheet.getLastRow();
  if (int總列 < 1) return 0;
  const arr值 = sheet.getRange(1, int欄, int總列, 1).getDisplayValues();
  for (let i = arr值.length - 1; i >= 0; i--) {
    if (String(arr值[i][0]).trim() !== '') return i + 1;
  }
  return 0;
}

/**
 * 版本：V1.0（2026-10-21）
 * 名稱：拋出提示_／顯示錯誤_
 * 用途：區分「操作問題」（直接告訴使用者怎麼改）與「程式意外錯誤」（請交給管理者）。
 */
function 拋出提示_(str訊息) {
  const err = new Error(str訊息);
  err.name = obj報表設定.str自訂錯誤名稱;
  throw err;
}

function 顯示錯誤_(ui, err) {
  if (err && err.name === obj報表設定.str自訂錯誤名稱) {
    ui.alert('作業未完成', err.message, ui.ButtonSet.OK);
  } else {
    ui.alert(
      '發生未預期的錯誤',
      '程式執行時遇到問題，報表可能只完成一部分。\n' +
      '請將這個畫面截圖交給系統管理者。\n\n' +
      '技術訊息：' + (err && err.message ? err.message : String(err)),
      ui.ButtonSet.OK
    );
  }
}
