// ============================================================================
// 檔案名稱：測試_法會_重複與副本選單.gs
// 所屬模組：法會活動（event）
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.1.0（2026-10-27）
//   v1.1.0：副本選單大車點名三項改測實際處理
// 用途說明：
//   在 Apps Script 編輯器執行「測試_法會_重複與副本選單」（約 1～3 分鐘）。
//     · 網頁的重複檢查：查詢、預覽（不改資料）、移除（移到無效資料、保留最晚一筆）
//     · 副本選單的後端：以「執行測試的帳號」本人的存取權杖驗證身分；
//       測試時暫時把這個帳號加為測試精舍的承辦人（測完整個測試精舍移到垃圾桶）
//   使用 測試_法會_活動與同步.gs 的共用測試環境。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：測試_法會_重複與副本選單
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：自動測試重複檢查與副本選單後端。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_法會_重複與副本選單() {
  const t = 建立法會測試記錄器_();
  let obj環境 = null;

  try {
    obj環境 = 建立法會測試環境_();
    const obj住持 = obj環境.obj住持;
    const obj主控台 = 開啟法會主控台_('TC');

    // 準備：一場有重複報名的活動
    const obj表單 = 建立法會測試表單_(obj環境, '重複測試');
    送出法會測試回應_(obj表單, [
      { 姓名: '王小明', 法名: '傳甲', 手機號碼: '0912000001', 參加日期: ['11/28'] },   // 第 2 列（較早）
      { 姓名: '李大華', 法名: '', 手機號碼: '0912000002', 參加日期: ['11/28'] },       // 第 3 列
      { 姓名: '王 小明', 法名: '傳甲', 手機號碼: '0912000003', 參加日期: ['11/29'] },  // 第 4 列（最晚，保留）
      { 姓名: '陳美麗', 法名: '', 手機號碼: '0912000004', 參加日期: ['11/29'] }        // 第 5 列
    ]);
    const obj新增 = 新增法會活動(obj住持, { str活動名稱: '測試重複法會', str活動類型: '對外', str來源網址: obj表單.obj回覆表.getUrl() });
    const str活動ID = obj新增.obj活動.str活動ID;
    const str副本ID = 取得法會活動_(obj主控台, str活動ID).obj值['副本ID'];
    obj環境.arr暫存檔.push(str副本ID);
    const obj副本 = SpreadsheetApp.openById(str副本ID);
    const obj有效 = obj副本.getSheetByName('有效資料');

    // ── 一、網頁：查詢、預覽、移除 ──
    const obj查詢 = 查詢法會重複(obj住持, { str活動ID: str活動ID });
    t.記錄('查詢：1 組重複（第 2、4 列）', obj查詢.int重複組數 === 1 && obj查詢.arr重複組[0].arr列號.join(',') === '2,4',
      JSON.stringify(obj查詢.arr重複組));
    t.記錄('查詢：資料 4 列、姓名欄是第 2 欄', obj查詢.int資料列數 === 4 && obj查詢.int鍵欄 === 2);
    const obj預覽 = 移除法會重複(obj住持, { str活動ID: str活動ID, bool僅預覽: true });
    t.記錄('預覽：保留第 4 列、移出第 2 列，資料不動', obj預覽.int移出筆數 === 1 && obj預覽.arr明細[0].int保留列號 === 4
      && obj預覽.arr明細[0].arr移出列號.join(',') === '2' && obj有效.getLastRow() === 5, obj預覽.str訊息);
    const obj沒說 = 移除法會重複(obj住持, { str活動ID: str活動ID });
    t.記錄('沒有明確說不是預覽時只預覽', obj有效.getLastRow() === 5 && obj沒說.str訊息.indexOf('預覽') !== -1);
    const obj移除 = 移除法會重複(obj住持, { str活動ID: str活動ID, bool僅預覽: false });
    t.記錄('移除：有效資料剩 3 筆', obj移除.int移出筆數 === 1 && obj有效.getLastRow() === 4, obj移除.str訊息);
    const obj無效 = obj副本.getSheetByName('無效資料');
    const obj無效索引 = 取得副本標題索引_(obj無效);
    t.記錄('無效資料：移入 1 筆、附無效原因與移入時間', obj無效.getLastRow() === 2 && obj無效索引['無效原因'] > 0 && obj無效索引['移入時間'] > 0);
    t.記錄('無效資料：移出的是較早那筆、手機的 0 保留',
      String(obj無效.getRange(2, obj無效索引['手機號碼']).getValue()) === '0912000001',
      String(obj無效.getRange(2, obj無效索引['手機號碼']).getValue()));
    t.記錄('有效資料：保留較晚那筆', obj有效.getRange(2, 取得副本標題索引_(obj有效)['手機號碼']).getValue() !== '0912000001'
      && 查詢法會重複(obj住持, { str活動ID: str活動ID }).int重複組數 === 0);
    t.記錄('再移除一次：沒有重複', 移除法會重複(obj住持, { str活動ID: str活動ID, bool僅預覽: false }).int移出筆數 === 0);
    const obj標示 = 設定法會重複標示(obj住持, { str活動ID: str活動ID });
    const int規則數 = obj有效.getConditionalFormatRules().filter(是否為重複標示規則_).length;
    t.記錄('重複標示可重複設定、不會疊加', obj標示.bool成功 && int規則數 === 1, `規則數 ${int規則數}`);
    t.記錄('清除標示只移除系統規則', 清除重複標示_(obj副本) === 1 && obj有效.getConditionalFormatRules().filter(是否為重複標示規則_).length === 0);
    const obj甲 = obj環境.重新判定(obj環境.str承辦甲);
    t.預期錯誤('沒被指派的承辦人不能查詢重複', obj錯誤代碼.權限不足, function () { 查詢法會重複(obj甲, { str活動ID: str活動ID }); });

    // ── 二、副本選單：以本人存取權杖驗證 ──
    const str本人 = 正規化帳號(Session.getEffectiveUser().getEmail());
    const str權杖 = ScriptApp.getOAuthToken();
    t.預期錯誤('副本選單：權杖錯誤', obj錯誤代碼.登入失敗, function () {
      副本選單_查詢重複(null, { str存取權杖: 'abc', str副本ID: str副本ID });
    });
    t.預期錯誤('副本選單：不是本精舍人員', obj錯誤代碼.登入失敗, function () {
      副本選單_查詢重複(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    });

    // 把執行測試的帳號加為承辦人並指派到這場活動
    新增人員(obj住持, { str帳號: str本人, str姓名: '測試執行者' });
    設定法會承辦人(obj住持, { str活動ID: str活動ID, arr承辦人: [str本人] });
    t.預期錯誤('副本選單：沒有整理權限', obj錯誤代碼.權限不足, function () {
      副本選單_查詢重複(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    });
    設定人員權限(obj住持, { str帳號: str本人, arr權限: ['event.整理資料'] });

    const obj選單查詢 = 副本選單_查詢重複(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    t.記錄('副本選單：查詢重複', obj選單查詢.int重複組數 === 0 && obj選單查詢.str分頁名 === '有效資料');
    t.記錄('副本選單：標示重複', 副本選單_標示重複(null, { str存取權杖: str權杖, str副本ID: str副本ID }).str訊息.indexOf('已設定') === 0);
    t.記錄('副本選單：清除標示', 副本選單_清除標示(null, { str存取權杖: str權杖, str副本ID: str副本ID }).str訊息.indexOf('已清除') === 0);
    t.記錄('副本選單：檢查新資料 0 筆', 副本選單_檢查新資料(null, { str存取權杖: str權杖, str副本ID: str副本ID }).int未下載 === 0);
    送出法會測試回應_(obj表單, [{ 姓名: '李大華', 法名: '', 手機號碼: '0912000005', 參加日期: ['11/29'] }]);
    t.記錄('副本選單：檢查新資料 1 筆', 副本選單_檢查新資料(null, { str存取權杖: str權杖, str副本ID: str副本ID }).int未下載 === 1);
    const obj下載 = 副本選單_下載新資料(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    t.記錄('副本選單：下載 1 筆，與網頁同步共用紀錄', obj下載.int新增筆數 === 1
      && 同步法會資料(obj住持, { str活動ID: str活動ID }).int新增筆數 === 0, obj下載.str訊息);
    const obj選單預覽 = 副本選單_移除重複(null, { str存取權杖: str權杖, str副本ID: str副本ID, bool僅預覽: true });
    t.記錄('副本選單：移除重複預覽 1 組（李大華）', obj選單預覽.int重複組數 === 1 && obj選單預覽.arr明細[0].str鍵值 === '李大華');
    const obj選單移除 = 副本選單_移除重複(null, { str存取權杖: str權杖, str副本ID: str副本ID, bool僅預覽: false });
    t.記錄('副本選單：移除重複', obj選單移除.int移出筆數 === 1 && obj副本.getSheetByName('無效資料').getLastRow() === 3);
    t.預期錯誤('副本選單：沒有匯出權限不能產生點名', obj錯誤代碼.權限不足, function () {
      副本選單_產生點名(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    });
    設定人員權限(obj住持, { str帳號: str本人, arr權限: ['event.整理資料', 'event.匯出大車點名'] });
    const obj選單產生 = 副本選單_產生點名(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    t.記錄('副本選單：第一次產生點名先建立點名欄位設定', obj選單產生.bool需確認設定 === true && !!obj副本.getSheetByName('點名欄位設定'), obj選單產生.str訊息);
    const obj選單點名 = 副本選單_產生點名(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    t.記錄('副本選單：第二次產生點名資料', obj選單點名.int趟數 === 3 && !!obj副本.getSheetByName('大車報到點名資料'), obj選單點名.str訊息);
    t.記錄('副本選單：領隊代號對照表', 副本選單_領隊代號表(null, { str存取權杖: str權杖, str副本ID: str副本ID }).bool新建 === true);
    t.預期錯誤('副本選單：未登記點名試算表時匯出預覽說明原因', obj錯誤代碼.設定缺漏, function () {
      副本選單_匯出點名(null, { str存取權杖: str權杖, str副本ID: str副本ID, bool僅預覽: true });
    });

    // 不是平台建立的試算表、或副本已不是活動目前的副本
    const obj別的表 = SpreadsheetApp.create('法會測試_不是副本');
    obj環境.arr暫存檔.push(obj別的表.getId());
    t.預期錯誤('副本選單：不是平台建立的副本', obj錯誤代碼.參數錯誤, function () {
      副本選單_查詢重複(null, { str存取權杖: str權杖, str副本ID: obj別的表.getId() });
    });

    // 經由路由（不需網頁登入）
    const obj路由 = 處理請求文字(JSON.stringify({ action: 'event.副本查詢重複', token: '', 參數: { str存取權杖: str權杖, str副本ID: str副本ID } }));
    t.記錄('路由：副本選單動作不需網頁登入', obj路由.bool成功 === true && obj路由.int重複組數 === 0);

    // 活動結束後副本選單不能整理
    結束法會活動(obj住持, { str活動ID: str活動ID });
    t.預期錯誤('副本選單：活動結束後不能查詢', obj錯誤代碼.參數錯誤, function () {
      副本選單_查詢重複(null, { str存取權杖: str權杖, str副本ID: str副本ID });
    });

  } catch (err) {
    t.記錄('測試流程中斷', false, (err && err.message ? err.message : err) + (err && err.stack ? '\n' + err.stack : ''));
  } finally {
    清除法會測試環境_(obj環境);
  }
  return t.結算();
}
