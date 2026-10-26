// ============================================================================
// 檔案名稱：測試_核心_模組開通.gs
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.0.0（2026-10-25）
// 用途說明：
//   在 Apps Script 編輯器中執行「測試_核心_模組開通」。
//   測試 核心_工具 v1.1.0（列出具名函式）、核心_模組管理 v1.1.0（登記、列出、
//   開通、關閉、重新開通）、核心_人員管理 v1.2.0（關閉模組後權限保留）、
//   核心_共用主檔 v1.1.0（列出主檔種類）、核心_外部檔案 v1.2.0（檔名與分頁）、
//   核心_路由 v1.1.0（新路由）。
//   使用暫存的系統主控與精舍資料夾，最後移到垃圾桶。不會讀寫正式資料。
//
//   ※ 本檔的模組代號都以 test 開頭，正式掃描會自動排除，不會出現在精舍設定頁。
// ============================================================================


// 「開通後處理_testopen」被執行的次數（每次執行測試時從 0 開始）
let int開通後處理次數_testopen_ = 0;


/**
 * ============================================================================
 * 函式名稱：模組定義_testopen ／ 主控台結構_testopen ／ 開通後處理_testopen
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用的完整模組：有定義、有主控台結構、有開通後處理（寫入一列預設資料）。
 * ============================================================================
 */
function 模組定義_testopen() {
  return {
    str模組名稱: '測試開通模組', str說明: '測試用的說明文字', str型態: '持續型', str版本: '0.0.1',
    arr可指派權限: [{ str項目: '處理', str說明: '測試權限' }]
  };
}
function 主控台結構_testopen() {
  return {
    清單: { str分頁: '測試清單', arr欄位: ['編號', '名稱', '狀態'] },
    設定: { str分頁: '測試設定', arr欄位: ['項目', '值'] }
  };
}
function 開通後處理_testopen(str精舍代號, obj主控台) {
  int開通後處理次數_testopen_ += 1;
  新增資料列(obj主控台.getSheetByName('測試設定'), { '項目': '開通精舍', '值': str精舍代號 });
}


/**
 * ============================================================================
 * 函式名稱：模組定義_testnostruct
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用：沒有主控台結構的模組，開通時應被擋下且不建立任何檔案。
 * ============================================================================
 */
function 模組定義_testnostruct() {
  return { str模組名稱: '測試無結構模組', str型態: '持續型', arr可指派權限: [] };
}


/**
 * ============================================================================
 * 函式名稱：模組定義_testhookfail ／ 主控台結構_testhookfail ／ 開通後處理_testhookfail
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用：開通後處理會失敗的模組，主控台應被移到垃圾桶、不留紀錄。
 * ============================================================================
 */
function 模組定義_testhookfail() {
  return { str模組名稱: '測試處理失敗模組', str型態: '持續型', arr可指派權限: [] };
}
function 主控台結構_testhookfail() {
  return { 清單: { str分頁: '清單', arr欄位: ['編號'] } };
}
function 開通後處理_testhookfail(str精舍代號, obj主控台) {
  throw new 平台錯誤(obj錯誤代碼.參數錯誤, '模擬開通後處理失敗');
}


/**
 * ============================================================================
 * 函式名稱：模組定義_testclosed ／ 主控台結構_testclosed
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用：登記後由系統管理員在模組清單改為「停用」，精舍不可開通。
 * ============================================================================
 */
function 模組定義_testclosed() {
  return { str模組名稱: '測試未開放模組', str型態: '持續型', arr可指派權限: [] };
}
function 主控台結構_testclosed() {
  return { 清單: { str分頁: '清單', arr欄位: ['編號'] } };
}


/**
 * ============================================================================
 * 函式名稱：測試_核心_模組開通
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：自動測試功能開通相關的後端。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_核心_模組開通() {
  const arr結果 = [];
  const arr暫存檔 = [];
  let obj暫存根資料夾 = null;
  int開通後處理次數_testopen_ = 0;

  const str系統管理員 = 'admin.test@example.com';
  const str住持 = 'abbot.test@example.com';
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
  // 精舍資料夾中，某名稱且未在垃圾桶的檔案數
  function 有效檔案數(obj資料夾, str檔名) {
    let int數 = 0;
    const it = obj資料夾.getFilesByName(str檔名);
    while (it.hasNext()) { if (!it.next().isTrashed()) int數 += 1; }
    return int數;
  }
  // 從列出模組的結果找出某模組
  function 找模組(obj列出, str代號) {
    return obj列出.arr模組.filter(function (o) { return o.str模組代號 === str代號; })[0] || null;
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

    const obj系統 = 判定身分_(str系統管理員, '');
    開通精舍(obj系統, { str精舍代號: 'TC', str精舍名稱: '測試台中精舍', str管理員帳號: str住持, str管理員姓名: '測試住持' });
    const obj住持 = 判定身分_(str住持, 'TC');
    新增人員(obj住持, { str帳號: str承辦人, str姓名: '測試承辦人' });
    const obj承辦 = 判定身分_(str承辦人, 'TC');
    const obj精舍資料夾 = DriveApp.getFolderById(取得精舍資訊('TC').str精舍資料夾ID);

    // ── 一、列出具名函式（核心_工具 v1.1.0） ──
    const arr正式 = 列出具名函式('模組定義_');
    const arr含測試 = 列出具名函式('模組定義_', true);
    記錄('正式掃描排除 test 開頭的模組', arr正式.every(function (s) { return s.indexOf('test') !== 0; }),
      `正式：${arr正式.join('、') || '（無）'}`);
    記錄('測試模式找得到本檔的模組', arr含測試.indexOf('testopen') !== -1 && arr含測試.indexOf('testhookfail') !== -1);
    預期錯誤('沒給開頭文字時拒絕', obj錯誤代碼.參數錯誤, function () { 列出具名函式(''); });

    // ── 二、登記所有模組 ──
    const obj第一次 = 登記所有模組(true);
    記錄('第一次登記：新增測試模組', obj第一次.arr新增.indexOf('testopen') !== -1 && obj第一次.arr更新.length === 0,
      `新增：${obj第一次.arr新增.join('、')}`);
    const obj清單分頁 = obj主控.getSheetByName('模組清單');
    const obj清單列 = 依條件尋找資料列(obj清單分頁, obj系統主控結構.模組清單.arr欄位, function (v) { return v['模組代號'] === 'testopen'; })[0];
    記錄('模組清單寫入名稱、型態、版本、狀態',
      obj清單列 && obj清單列.obj值['模組名稱'] === '測試開通模組' && obj清單列.obj值['版本'] === '0.0.1' && obj清單列.obj值['狀態'] === '啟用');

    // 系統管理員手動把 testclosed 改為停用，重新登記不可把它打開
    const obj停用列 = 依條件尋找資料列(obj清單分頁, obj系統主控結構.模組清單.arr欄位, function (v) { return v['模組代號'] === 'testclosed'; })[0];
    更新資料列(obj清單分頁, obj停用列.int列號, { '狀態': '停用' });
    const obj第二次 = 登記所有模組(true);
    const str停用後狀態 = 依條件尋找資料列(obj清單分頁, obj系統主控結構.模組清單.arr欄位, function (v) { return v['模組代號'] === 'testclosed'; })[0].obj值['狀態'];
    記錄('重新登記：只更新不重複新增', obj第二次.arr新增.length === 0 && obj第二次.arr更新.indexOf('testopen') !== -1);
    記錄('重新登記：手動停用的模組維持停用', str停用後狀態 === '停用');

    // ── 三、列出模組 ──
    const obj列出一 = 列出模組(obj住持, {});
    const obj開通前 = 找模組(obj列出一, 'testopen');
    記錄('列出模組：未開通、含說明', obj開通前 && obj開通前.str狀態 === '未開通' && obj開通前.str說明 === '測試用的說明文字');
    記錄('列出模組：模組清單停用的不列出', 找模組(obj列出一, 'testclosed') === null);
    預期錯誤('承辦人不能列出模組', obj錯誤代碼.權限不足, function () { 列出模組(obj承辦, {}); });

    // ── 四、開通模組 ──
    const str主控台檔名 = '測試開通模組主控台－測試台中精舍';
    const obj開通 = 開通模組(obj住持, { str模組代號: 'testopen' });
    記錄('開通成功', obj開通.bool成功 && obj開通.bool重新開通 === false, obj開通.str訊息);
    const str主控台ID = 取得模組主控台ID('TC', 'testopen');
    arr暫存檔.push(str主控台ID);
    const obj主控台 = SpreadsheetApp.openById(str主控台ID);
    記錄('主控台建在精舍資料夾、名稱正確', 有效檔案數(obj精舍資料夾, str主控台檔名) === 1);
    記錄('主控台依結構建立分頁', obj主控台.getSheetByName('測試清單') !== null && obj主控台.getSheetByName('測試設定') !== null
      && obj主控台.getSheets().length === 2, obj主控台.getSheets().map(function (o) { return o.getName(); }).join('、'));
    記錄('開通後處理執行一次並寫入資料', int開通後處理次數_testopen_ === 1
      && obj主控台.getSheetByName('測試設定').getRange(2, 2).getValue() === 'TC');
    const obj開通後 = 找模組(列出模組(obj住持, {}), 'testopen');
    記錄('列出模組：已開通並有開通日期', obj開通後.str狀態 === '啟用' && /^\d{4}-\d{2}-\d{2}$/.test(obj開通後.str開通日期));
    記錄('入口頁看得到已開通模組', 取得已開通模組('TC').some(function (o) { return o.str模組代號 === 'testopen'; }));
    預期錯誤('重複開通', obj錯誤代碼.參數錯誤, function () { 開通模組(obj住持, { str模組代號: 'testopen' }); });

    // ── 五、開通失敗的情況 ──
    預期錯誤('沒有主控台結構的模組不能開通', obj錯誤代碼.設定缺漏, function () { 開通模組(obj住持, { str模組代號: 'testnostruct' }); });
    記錄('沒有主控台結構：沒有建立任何檔案', 有效檔案數(obj精舍資料夾, '測試無結構模組主控台－測試台中精舍') === 0);
    預期錯誤('開通後處理失敗會取消開通', obj錯誤代碼.參數錯誤, function () { 開通模組(obj住持, { str模組代號: 'testhookfail' }); });
    記錄('開通後處理失敗：主控台已移到垃圾桶', 有效檔案數(obj精舍資料夾, '測試處理失敗模組主控台－測試台中精舍') === 0);
    記錄('開通後處理失敗：沒有留下開通紀錄', 找模組(列出模組(obj住持, {}), 'testhookfail').str狀態 === '未開通');
    預期錯誤('模組清單停用的模組不能開通', obj錯誤代碼.權限不足, function () { 開通模組(obj住持, { str模組代號: 'testclosed' }); });
    預期錯誤('程式中沒有的模組', obj錯誤代碼.參數錯誤, function () { 開通模組(obj住持, { str模組代號: 'nomodule' }); });
    預期錯誤('模組代號格式不對', obj錯誤代碼.參數錯誤, function () { 開通模組(obj住持, { str模組代號: 'Bad-Code' }); });
    預期錯誤('沒給模組代號', obj錯誤代碼.參數錯誤, function () { 開通模組(obj住持, {}); });
    預期錯誤('承辦人不能開通', obj錯誤代碼.權限不足, function () { 開通模組(obj承辦, { str模組代號: 'testhookfail' }); });

    // ── 六、關閉模組與權限保留 ──
    設定人員權限(obj住持, { str帳號: str承辦人, arr權限: ['testopen.處理'] });
    const obj關閉 = 關閉模組(obj住持, { str模組代號: 'testopen' });
    記錄('關閉成功', obj關閉.bool成功, obj關閉.str訊息);
    記錄('關閉後列出為停用', 找模組(列出模組(obj住持, {}), 'testopen').str狀態 === '停用');
    記錄('關閉後入口頁看不到', !取得已開通模組('TC').some(function (o) { return o.str模組代號 === 'testopen'; }));
    預期錯誤('關閉後無法取得主控台', obj錯誤代碼.權限不足, function () { 取得模組主控台ID('TC', 'testopen'); });
    記錄('關閉後權限選項不含此模組', !取得權限選項(obj住持, {}).arr模組.some(function (o) { return o.str模組代號 === 'testopen'; }));
    設定人員權限(obj住持, { str帳號: str承辦人, arr權限: [] });
    記錄('關閉期間改權限：已關閉模組的指派保留', 讀取承辦人權限('TC', str承辦人).indexOf('testopen.處理') !== -1);
    預期錯誤('重複關閉', obj錯誤代碼.參數錯誤, function () { 關閉模組(obj住持, { str模組代號: 'testopen' }); });
    預期錯誤('承辦人不能關閉', obj錯誤代碼.權限不足, function () { 關閉模組(obj承辦, { str模組代號: 'testopen' }); });

    // ── 七、重新開通 ──
    const obj重開 = 開通模組(obj住持, { str模組代號: 'testopen' });
    記錄('重新開通沿用原主控台', obj重開.bool重新開通 === true && 取得模組主控台ID('TC', 'testopen') === str主控台ID, obj重開.str訊息);
    記錄('重新開通不再執行開通後處理、不另建檔案', int開通後處理次數_testopen_ === 1 && 有效檔案數(obj精舍資料夾, str主控台檔名) === 1);
    記錄('重新開通後權限恢復', 取得權限選項(obj住持, {}).arr模組.some(function (o) { return o.str模組代號 === 'testopen'; })
      && 讀取承辦人權限('TC', str承辦人).indexOf('testopen.處理') !== -1);

    // 原主控台不見時：關閉 → 把主控台代號改成不存在 → 重新開通應說明原因
    關閉模組(obj住持, { str模組代號: 'testopen' });
    const obj開通分頁 = obj主控.getSheetByName('精舍模組開通');
    const obj開通列 = 依條件尋找資料列(obj開通分頁, obj系統主控結構.精舍模組開通.arr欄位, function (v) { return v['模組代號'] === 'testopen'; })[0];
    更新資料列(obj開通分頁, obj開通列.int列號, { '主控台ID': '1不存在的檔案代號0000000000000000' });
    預期錯誤('原主控台不見時無法重新開通', obj錯誤代碼.檔案無法開啟, function () { 開通模組(obj住持, { str模組代號: 'testopen' }); });
    更新資料列(obj開通分頁, obj開通列.int列號, { '主控台ID': str主控台ID });   // 還原

    // ── 八、列出主檔種類 ──
    const obj主檔種類 = 列出主檔種類(obj住持, {});
    記錄('列出主檔種類：不含 test 開頭的主檔', obj主檔種類.bool成功
      && obj主檔種類.arr主檔.every(function (o) { return o.str主檔代號.indexOf('test') !== 0; }),
      `主檔：${obj主檔種類.arr主檔.map(function (o) { return o.str主檔名稱; }).join('、') || '（目前沒有）'}`);
    預期錯誤('承辦人不能列出主檔種類', obj錯誤代碼.權限不足, function () { 列出主檔種類(obj承辦, {}); });

    // ── 九、列出外部檔案多傳回檔名與分頁 ──
    const obj大車 = SpreadsheetApp.create(`平台測試_大車點名_${new Date().getTime()}`);
    arr暫存檔.push(obj大車.getId());
    登記外部檔案(obj住持, { str項目: '大車點名試算表', str檔案: obj大車.getUrl(), str分頁名稱: '點名' });
    const obj外部 = 列出外部檔案(obj住持, {}).arr項目.filter(function (o) { return o.str項目 === '大車點名試算表'; })[0];
    記錄('列出外部檔案含檔名與分頁', obj外部.bool已登記 && obj外部.str檔名 === obj大車.getName() && obj外部.str分頁名稱 === '點名');
    const obj名冊 = 列出外部檔案(obj住持, {}).arr項目.filter(function (o) { return o.str項目 === '學員名冊'; })[0];
    記錄('未登記項目的檔名與分頁為空白', obj名冊.bool已登記 === false && obj名冊.str檔名 === '' && obj名冊.str分頁名稱 === '');

    // ── 十、經由路由呼叫 ──
    const str住持代碼 = 建立工作階段(obj住持);
    const obj路由列出 = 處理請求文字(JSON.stringify({ action: '精舍.列出模組', token: str住持代碼, 參數: {} }));
    記錄('路由：精舍.列出模組', obj路由列出.bool成功 === true && Array.isArray(obj路由列出.arr模組));
    const obj路由種類 = 處理請求文字(JSON.stringify({ action: '精舍.列出主檔種類', token: str住持代碼, 參數: {} }));
    記錄('路由：精舍.列出主檔種類', obj路由種類.bool成功 === true && Array.isArray(obj路由種類.arr主檔));
    const obj路由開通 = 處理請求文字(JSON.stringify({ action: '精舍.開通模組', token: str住持代碼, 參數: { str模組代號: 'testopen' } }));
    記錄('路由：精舍.開通模組（重新開通）', obj路由開通.bool成功 === true && obj路由開通.bool重新開通 === true);
    const obj路由關閉 = 處理請求文字(JSON.stringify({ action: '精舍.關閉模組', token: str住持代碼, 參數: { str模組代號: 'testopen' } }));
    記錄('路由：精舍.關閉模組', obj路由關閉.bool成功 === true);

  } catch (err) {
    記錄('測試流程中斷', false, err.message);
  } finally {
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
