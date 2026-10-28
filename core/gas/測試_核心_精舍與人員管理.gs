// ============================================================================
// 檔案名稱：測試_核心_精舍與人員管理.gs
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.2.0（2026-10-28）
//   v1.2.0：日誌筆數只計算業務操作，不計「同步精舍設定共享」（是否寫入依共享是否異動而定，各環境不同）
//   v1.1.0：新增精舍名稱不可重複的測試（開通、改名、忽略空白、含已停用、改回原名）
//   v1.0.1：精舍設定分頁數改依結構定義計算（因應新增「副本清單」分頁）
//   v1.0.0：初版
// 用途說明：
//   在 Apps Script 編輯器中執行「測試_核心_精舍與人員管理」。
//   會建立暫存的系統主控與「精舍資料」資料夾，模擬系統管理員開通精舍、
//   精舍管理員增修人員與指派權限，最後把暫存檔與資料夾移到垃圾桶。
//   不會讀寫正式資料，也不會改動指令碼屬性。
//   ※「初始化平台」會建立正式資料夾，不在此測試，請依使用說明另外執行。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：模組定義_testmod
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用的假模組，示範模組定義的寫法。正式模組不會用到它。
 * 參數：無
 * 傳回：{Object} 模組定義
 * ============================================================================
 */
function 模組定義_testmod() {
  return {
    str模組代號: 'testmod',
    str模組名稱: '測試模組',
    str型態: '持續型',
    arr可指派權限: [
      { str項目: '整理資料', str說明: '測試用項目' }
    ]
  };
}


/**
 * ============================================================================
 * 函式名稱：測試_核心_精舍與人員管理
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：自動測試核心_精舍管理、核心_人員管理、核心_模組管理、核心_日誌。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_核心_精舍與人員管理() {
  const arr結果 = [];
  const arr暫存檔 = [];
  let obj暫存根資料夾 = null;

  const str系統管理員 = 'admin.test@example.com';
  const str住持 = 'abbot.test@example.com';
  const str住持二 = 'abbot2.test@example.com';
  const str承辦人 = 'staff.test@example.com';

  function 記錄(str項目, bool通過, str補充) {
    arr結果.push({ str項目: str項目, bool通過: bool通過 });
    console.log(`${bool通過 ? '✔' : '✘'} ${str項目}${str補充 ? '：' + str補充 : ''}`);
  }
  function 預期錯誤(str項目, str預期代碼, fn執行) {
    try {
      fn執行();
      記錄(str項目, false, '應該要出錯，但沒有出錯');
    } catch (err) {
      記錄(str項目, (err instanceof 平台錯誤) && err.str錯誤代碼 === str預期代碼, err.message);
    }
  }

  try {
    // ── 準備暫存環境 ──
    const obj主控 = SpreadsheetApp.create(`平台測試_系統主控_${new Date().getTime()}`);
    arr暫存檔.push(obj主控.getId());
    建立整份結構(obj主控, obj系統主控結構);
    obj暫存根資料夾 = DriveApp.createFolder(`平台測試_精舍資料_${new Date().getTime()}`);

    設定測試用系統主控_(obj主控.getId());
    str測試用系統管理員帳號_ = str系統管理員;
    str測試用精舍資料根ID_ = obj暫存根資料夾.getId();

    // 系統管理員的工作階段
    const obj系統 = 判定身分_(str系統管理員, '');

    // ── 開通精舍 ──
    const obj開通 = 開通精舍(obj系統, { str精舍代號: 'tc', str精舍名稱: '測試台中精舍', str管理員帳號: 'Abbot.Test@Example.com', str管理員姓名: '測試住持' });
    記錄('開通精舍', obj開通.bool成功 && obj開通.str精舍代號 === 'TC', obj開通.str訊息);
    const obj精舍 = 取得精舍資訊('TC');
    arr暫存檔.push(obj精舍.str精舍設定ID);
    const obj設定 = SpreadsheetApp.openById(obj精舍.str精舍設定ID);
    記錄('精舍設定試算表已建立全部分頁',
      obj設定.getSheets().length === Object.keys(obj精舍設定結構).length);
    記錄('精舍資料夾名稱為「代號 名稱」', DriveApp.getFolderById(obj精舍.str精舍資料夾ID).getName() === 'TC 測試台中精舍');

    預期錯誤('精舍代號不可重複（不分大小寫）', obj錯誤代碼.參數錯誤, function () {
      開通精舍(obj系統, { str精舍代號: 'TC', str精舍名稱: '重複', str管理員帳號: 'x@example.com', str管理員姓名: 'x' });
    });
    預期錯誤('管理員帳號格式錯誤', obj錯誤代碼.參數錯誤, function () {
      開通精舍(obj系統, { str精舍代號: 'KH', str精舍名稱: '高雄', str管理員帳號: 'not-an-email', str管理員姓名: 'x' });
    });
    預期錯誤('開通資料不齊全', obj錯誤代碼.參數錯誤, function () {
      開通精舍(obj系統, { str精舍代號: 'KH' });
    });
    預期錯誤('精舍名稱不可重複', obj錯誤代碼.參數錯誤, function () {
      開通精舍(obj系統, { str精舍代號: 'KH', str精舍名稱: '測試台中精舍', str管理員帳號: 'k@example.com', str管理員姓名: 'k' });
    });
    預期錯誤('精舍名稱不可重複（忽略空白）', obj錯誤代碼.參數錯誤, function () {
      開通精舍(obj系統, { str精舍代號: 'KH', str精舍名稱: '測試台中　精舍', str管理員帳號: 'k@example.com', str管理員姓名: 'k' });
    });

    // ── 列出、修改精舍 ──
    const arr精舍 = 列出精舍(obj系統, {}).arr精舍;
    記錄('列出精舍含管理員', arr精舍.length === 1 && arr精舍[0].arr管理員[0].str帳號 === str住持);
    更新精舍(obj系統, { str精舍代號: 'TC', str精舍名稱: '測試台中精舍（新名）' });
    記錄('修改精舍名稱', 取得精舍資訊('TC').str精舍名稱 === '測試台中精舍（新名）');
    預期錯誤('狀態只能是啟用或停用', obj錯誤代碼.參數錯誤, function () {
      更新精舍(obj系統, { str精舍代號: 'TC', str狀態: '暫停' });
    });

    // ── 精舍管理員 ──
    新增精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持二, str姓名: '第二位管理員' });
    記錄('新增第二位精舍管理員', 判定身分_(str住持二, 'TC').str角色 === obj角色.精舍管理員);
    預期錯誤('重複新增精舍管理員', obj錯誤代碼.參數錯誤, function () {
      新增精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持二, str姓名: 'x' });
    });
    停用精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持二 });
    預期錯誤('停用後無法登入', obj錯誤代碼.登入失敗, function () { 判定身分_(str住持二, 'TC'); });
    預期錯誤('不可停用最後一位精舍管理員', obj錯誤代碼.參數錯誤, function () {
      停用精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持 });
    });

    // ── 權限隔離 ──
    const obj住持 = 判定身分_(str住持, 'TC');
    預期錯誤('精舍管理員不能開通精舍', obj錯誤代碼.權限不足, function () {
      開通精舍(obj住持, { str精舍代號: 'KH', str精舍名稱: '高雄', str管理員帳號: 'k@example.com', str管理員姓名: 'k' });
    });
    預期錯誤('系統管理員不能管理精舍人員', obj錯誤代碼.權限不足, function () {
      新增人員(obj系統, { str帳號: str承辦人, str姓名: 'x' });
    });

    // ── 人員管理 ──
    新增人員(obj住持, { str帳號: str承辦人, str姓名: '測試承辦人' });
    記錄('新增承辦人', 判定身分_(str承辦人, 'TC').str角色 === obj角色.承辦人);
    預期錯誤('重複新增承辦人', obj錯誤代碼.參數錯誤, function () {
      新增人員(obj住持, { str帳號: str承辦人, str姓名: 'x' });
    });
    預期錯誤('精舍管理員不需加為承辦人', obj錯誤代碼.參數錯誤, function () {
      新增人員(obj住持, { str帳號: str住持, str姓名: 'x' });
    });

    // ── 模組與權限指派（用測試模組 testmod） ──
    新增資料列(obj主控.getSheetByName('模組清單'), { '模組代號': 'testmod', '模組名稱': '測試模組', '型態': '持續型', '狀態': '啟用' });
    新增資料列(obj主控.getSheetByName('精舍模組開通'), { '精舍代號': 'TC', '模組代號': 'testmod', '主控台ID': 'console-test', '狀態': '啟用' });

    記錄('讀取模組定義', 取得模組定義('testmod').str模組名稱 === '測試模組');
    記錄('不存在的模組定義傳回 null', 取得模組定義('nomodule') === null);
    const arr選項 = 取得權限選項(obj住持, {}).arr模組;
    記錄('取得權限選項', arr選項.length === 1 && arr選項[0].arr可指派權限[0].str權限項目 === 'testmod.整理資料');

    設定人員權限(obj住持, { str帳號: str承辦人, arr權限: ['testmod.整理資料', 'testmod.整理資料'] });
    const obj承辦 = 判定身分_(str承辦人, 'TC');
    記錄('指派權限後登入即擁有該權限', obj承辦.arr權限.length === 1 && 是否具備權限(obj承辦, 'testmod.整理資料'));
    預期錯誤('不可指派模組沒有的項目', obj錯誤代碼.參數錯誤, function () {
      設定人員權限(obj住持, { str帳號: str承辦人, arr權限: ['testmod.不存在的項目'] });
    });
    預期錯誤('不可指派平台權限給承辦人', obj錯誤代碼.參數錯誤, function () {
      設定人員權限(obj住持, { str帳號: str承辦人, arr權限: ['平台.管理人員'] });
    });
    預期錯誤('不可指派未開通模組的權限', obj錯誤代碼.參數錯誤, function () {
      設定人員權限(obj住持, { str帳號: str承辦人, arr權限: ['event.整理資料'] });
    });
    預期錯誤('承辦人不能管理人員', obj錯誤代碼.權限不足, function () {
      新增人員(obj承辦, { str帳號: 'y@example.com', str姓名: 'y' });
    });

    const arr人員 = 列出人員(obj住持, {}).arr人員;
    記錄('人員清單顯示權限', arr人員.length === 1 && arr人員[0].arr權限[0] === 'testmod.整理資料');

    設定人員權限(obj住持, { str帳號: str承辦人, arr權限: [] });
    記錄('清空權限', 判定身分_(str承辦人, 'TC').arr權限.length === 0);

    更新人員(obj住持, { str帳號: str承辦人, str狀態: '停用' });
    預期錯誤('停用承辦人後無法登入', obj錯誤代碼.登入失敗, function () { 判定身分_(str承辦人, 'TC'); });

    // ── 停用精舍 ──
    更新精舍(obj系統, { str精舍代號: 'TC', str狀態: '停用' });
    預期錯誤('精舍停用後無法登入', obj錯誤代碼.權限不足, function () { 判定身分_(str住持, 'TC'); });

    // ── 操作日誌 ──
    // 預期 9 筆：開通精舍 1、修改精舍 2、新增與停用精舍管理員 2、新增人員 1、指派權限 2、修改人員 1
    // 「同步精舍設定共享」只在共享有異動時才寫，測試帳號能否加入共享各環境不同，因此不計入
    const int日誌筆數 = 讀取全部資料列(obj主控.getSheetByName('操作日誌'), ['動作'])
      .filter(function (obj列) { return String(obj列.obj值['動作']).trim() !== '同步精舍設定共享'; }).length;
    記錄('操作都有寫入日誌', int日誌筆數 === 9, `共 ${int日誌筆數} 筆`);

    // ── 改名不可與其他精舍同名（放在日誌檢查之後，避免影響上方的日誌筆數） ──
    開通精舍(obj系統, { str精舍代號: 'KH', str精舍名稱: '測試高雄精舍', str管理員帳號: 'k@example.com', str管理員姓名: 'k' });
    arr暫存檔.push(取得精舍資訊('KH').str精舍設定ID);
    預期錯誤('改名不可與其他精舍同名（含已停用的精舍）', obj錯誤代碼.參數錯誤, function () {
      更新精舍(obj系統, { str精舍代號: 'KH', str精舍名稱: '測試台中精舍（新名）' });
    });
    try {
      更新精舍(obj系統, { str精舍代號: 'KH', str精舍名稱: '測試高雄精舍' });
      記錄('改為自己原本的名稱不算重複', true);
    } catch (err) {
      記錄('改為自己原本的名稱不算重複', false, err.message);
    }

  } catch (err) {
    記錄('測試流程中斷', false, err.message);
  } finally {
    // 恢復正式設定，清除暫存檔與資料夾
    設定測試用系統主控_(null);
    str測試用系統管理員帳號_ = null;
    str測試用精舍資料根ID_ = null;
    arr暫存檔.forEach(function (str檔案ID) {
      try { DriveApp.getFileById(str檔案ID).setTrashed(true); } catch (err) { /* 略過 */ }
    });
    if (obj暫存根資料夾) {
      try { obj暫存根資料夾.setTrashed(true); } catch (err) { /* 略過 */ }
    }
    console.log('（暫存試算表與資料夾已移到垃圾桶）');
  }

  const arr失敗 = arr結果.filter(function (obj) { return !obj.bool通過; });
  console.log(`==== 測試完成：通過 ${arr結果.length - arr失敗.length} 項，失敗 ${arr失敗.length} 項 ====`);
  return {
    int通過: arr結果.length - arr失敗.length,
    int失敗: arr失敗.length,
    arr失敗項目: arr失敗.map(function (obj) { return obj.str項目; })
  };
}
