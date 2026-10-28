// ============================================================================
// 檔案名稱：測試_法會_活動與同步.gs
// 所屬模組：法會活動（event）
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v2.1.0（2026-10-28）　加測活動期間
//   v2.0.0（2026-10-27）改測回覆試算表同步（列號登記、修改提醒、排序偵測）
//   舊版：v1.0.3（2026-10-26）
//   v1.0.3：淺黃底改檢查不重名的第 5 列（重名列顯示重複的淡橘色）
//   v1.0.2：新列底色檢查前先 flush，並顯示實際列數與底色
//   v1.0.1：送出測試回應改為直接呼叫 createResponse（實機 TextItem 沒有 asTextItem）
// 用途說明：
//   在 Apps Script 編輯器執行「測試_法會_活動與同步」（約 2～4 分鐘）。
//   建立暫存的系統主控、精舍、Google 表單與副本範本，完整跑一次第①批流程：
//     開通法會活動 → 新增活動（建副本、貼資料、登記回應、重複標示、共享）→
//     列出活動（承辦人只看指派的）→ 同步新報名 → 表單新增題目的提醒 →
//     承辦人刪掉的列不會被加回 → 重複查詢與移除 → 活動作業鎖 → 承辦人異動 →
//     結束與重新開啟 → 路由 → 副本選單（以本人存取權杖）
//   測完把所有暫存檔移到垃圾桶。不會讀寫正式資料。
//   ※「填寫人修改報名」的提醒無法以程式模擬，列在實機測試案例中。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：建立法會測試環境_（測試共用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：暫存系統主控、精舍 TC（住持＋兩位承辦人）、開通法會活動、暫存副本範本。
 * 參數：無
 * 傳回：{Object} { arr暫存檔, obj根資料夾, obj住持, str承辦甲, str承辦乙, str住持帳號, 重新判定(帳號) }
 * ============================================================================
 */
function 建立法會測試環境_() {
  const obj環境 = { arr暫存檔: [], obj根資料夾: null };
  const int時間 = new Date().getTime();

  // 暫存系統主控與精舍資料根
  const obj主控 = SpreadsheetApp.create(`法會測試_系統主控_${int時間}`);
  obj環境.arr暫存檔.push(obj主控.getId());
  建立整份結構(obj主控, obj系統主控結構);
  obj環境.obj根資料夾 = DriveApp.createFolder(`法會測試_精舍資料_${int時間}`);
  設定測試用系統主控_(obj主控.getId());
  str測試用系統管理員帳號_ = 'admin.test@example.com';
  str測試用精舍資料根ID_ = obj環境.obj根資料夾.getId();

  // 精舍與人員
  obj環境.str住持帳號 = 'abbot.test@example.com';
  obj環境.str承辦甲 = 'staff.a.test@example.com';
  obj環境.str承辦乙 = 'staff.b.test@example.com';
  開通精舍(判定身分_('admin.test@example.com', ''), {
    str精舍代號: 'TC', str精舍名稱: '測試法會精舍', str管理員帳號: obj環境.str住持帳號, str管理員姓名: '測試住持'
  });
  obj環境.obj住持 = 判定身分_(obj環境.str住持帳號, 'TC');
  新增人員(obj環境.obj住持, { str帳號: obj環境.str承辦甲, str姓名: '承辦甲' });
  新增人員(obj環境.obj住持, { str帳號: obj環境.str承辦乙, str姓名: '承辦乙' });
  obj環境.重新判定 = function (str帳號) { return 判定身分_(str帳號, 'TC'); };

  // 登記並開通法會活動
  登記所有模組(true);
  開通模組(obj環境.obj住持, { str模組代號: 'event' });
  obj環境.arr暫存檔.push(取得模組主控台ID('TC', 'event'));

  // 暫存副本範本
  const obj範本 = 建立法會副本範本檔_(obj環境.obj根資料夾);
  obj環境.arr暫存檔.push(obj範本.getId());
  str測試用法會範本ID_ = obj範本.getId();
  return obj環境;
}


/**
 * ============================================================================
 * 函式名稱：建立法會測試表單_（測試共用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：建立一份報名表單（姓名、法名、手機號碼、參加日期）與回覆試算表。
 * 參數：
 *   obj環境   {Object} 建立法會測試環境_ 的結果
 *   str名稱   {string} 表單名稱
 * 傳回：{Object} { obj表單, obj回覆表, obj題目: { 姓名, 法名, 手機號碼, 參加日期 } }
 * ============================================================================
 */
function 建立法會測試表單_(obj環境, str名稱) {
  const obj表單 = FormApp.create(`法會測試_${str名稱}`);
  const obj題目 = {
    姓名: obj表單.addTextItem().setTitle('姓名'),
    法名: obj表單.addTextItem().setTitle('法名'),
    手機號碼: obj表單.addTextItem().setTitle('手機號碼'),
    參加日期: obj表單.addCheckboxItem().setTitle('參加日期').setChoiceValues(['11/28', '11/29'])
  };
  const obj回覆表 = SpreadsheetApp.create(`法會測試_${str名稱}_回覆`);
  obj表單.setDestination(FormApp.DestinationType.SPREADSHEET, obj回覆表.getId());
  [obj表單.getId(), obj回覆表.getId()].forEach(function (str) {
    obj環境.arr暫存檔.push(str);
    DriveApp.getFileById(str).moveTo(obj環境.obj根資料夾);
  });
  return { obj表單: obj表單, obj回覆表: obj回覆表, obj題目: obj題目 };
}


/**
 * ============================================================================
 * 函式名稱：送出法會測試回應_（測試共用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：以程式送出多筆表單回應，送完稍等讓回覆試算表寫入。
 * 參數：
 *   obj測試表單   {Object}   建立法會測試表單_ 的結果
 *   arr回應       {Object[]} [ { 姓名, 法名, 手機號碼, 參加日期: [] , 其他題目標題: 值 } ]
 * 傳回：無
 * ============================================================================
 */
function 送出法會測試回應_(obj測試表單, arr回應) {
  arr回應.forEach(function (obj答) {
    const obj回應 = obj測試表單.obj表單.createResponse();
    Object.keys(obj答).forEach(function (str題) {
      const obj題目 = obj測試表單.obj題目[str題];
      if (!obj題目) return;
      // addTextItem()、addCheckboxItem() 傳回的已是 TextItem／CheckboxItem，直接 createResponse
      const obj項 = obj題目.createResponse(obj答[str題]);
      obj回應.withItemResponse(obj項);
    });
    obj回應.submit();
    Utilities.sleep(1100);   // 讓每筆送出時間不同
  });
  Utilities.sleep(3000);
  SpreadsheetApp.flush();
}


/**
 * ============================================================================
 * 函式名稱：清除法會測試環境_（測試共用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：還原測試設定，暫存檔與資料夾移到垃圾桶（含建立副本產生的副本與資料夾）。
 * 參數：
 *   obj環境   {Object} 建立法會測試環境_ 的結果（可為 null）
 * 傳回：無
 * ============================================================================
 */
function 清除法會測試環境_(obj環境) {
  設定測試用系統主控_(null);
  str測試用系統管理員帳號_ = null;
  str測試用精舍資料根ID_ = null;
  str測試用法會範本ID_ = null;
  if (!obj環境) return;
  obj環境.arr暫存檔.forEach(function (str檔案ID) {
    try { DriveApp.getFileById(str檔案ID).setTrashed(true); } catch (err) { /* 略過 */ }
  });
  if (obj環境.obj根資料夾) {
    try { obj環境.obj根資料夾.setTrashed(true); } catch (err) { /* 略過 */ }
  }
  console.log('（暫存試算表、表單與資料夾已移到垃圾桶）');
}


/**
 * ============================================================================
 * 函式名稱：測試_法會_活動與同步
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：自動測試第①批後端的完整流程。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_法會_活動與同步() {
  const t = 建立法會測試記錄器_();
  let obj環境 = null;

  try {
    obj環境 = 建立法會測試環境_();
    const obj住持 = obj環境.obj住持;
    let obj甲 = obj環境.重新判定(obj環境.str承辦甲);
    const obj主控台 = 開啟法會主控台_('TC');
    t.記錄('開通法會活動：主控台三個分頁',
      ['活動清單', '已同步紀錄', '修改提醒'].every(function (s) { return obj主控台.getSheetByName(s) !== null; }));

    // ── 一、新增活動 ──
    const obj表單一 = 建立法會測試表單_(obj環境, '觀音法會');
    送出法會測試回應_(obj表單一, [
      { 姓名: '王小明', 法名: '傳甲', 手機號碼: '0912345678', 參加日期: ['11/28'] },
      { 姓名: '李大華', 法名: '傳乙', 手機號碼: '0922333444', 參加日期: ['11/28', '11/29'] },
      { 姓名: '陳美麗', 法名: '', 手機號碼: '0933444555', 參加日期: ['11/29'] }
    ]);
    const obj新增 = 新增法會活動(obj住持, {
      str活動名稱: '測試觀音法會', str活動類型: '對內', str活動日期: '2026-11-28',
      str來源網址: obj表單一.obj回覆表.getUrl(), arr承辦人: [obj環境.str承辦甲]
    });
    const str活動ID = obj新增.obj活動.str活動ID;
    t.記錄('新增活動成功、活動ID 為 A0001', obj新增.bool成功 && str活動ID === 'A0001', obj新增.str訊息);
    const obj活動值 = 取得法會活動_(obj主控台, str活動ID).obj值;
    obj環境.arr暫存檔.push(obj活動值['副本ID']);
    const obj回覆分頁 = 找出回覆分頁_(obj表單一.obj回覆表, '');
    t.記錄('活動清單：狀態收件中、報到範圍不限、記錄回覆分頁', obj活動值['活動狀態'] === '收件中'
      && obj活動值['報到範圍'] === '不限' && String(obj活動值['來源分頁']) === obj回覆分頁.getName(), String(obj活動值['來源分頁']));
    const obj副本 = SpreadsheetApp.openById(obj活動值['副本ID']);
    const obj有效 = obj副本.getSheetByName('有效資料');
    t.記錄('副本：有效資料貼入 3 筆', obj有效.getLastRow() === 4, `目前 ${obj有效.getLastRow() - 1} 筆`);
    const int手機欄 = 取得副本標題索引_(obj有效)['手機號碼'];
    t.記錄('副本：手機開頭的 0 保留', String(obj有效.getRange(2, int手機欄).getValue()) === '0912345678',
      String(obj有效.getRange(2, int手機欄).getValue()));
    t.記錄('副本：有重複檢查分頁', obj副本.getSheetByName('重複檢查') !== null);
    const obj紀錄 = 讀取法會已同步紀錄_(obj主控台)[str活動ID] || {};
    t.記錄('已同步紀錄：以列號登記 3 筆', Object.keys(obj紀錄).sort().join(',') === '列2,列3,列4', Object.keys(obj紀錄).join(','));
    const arr編輯者 = DriveApp.getFileById(obj活動值['副本ID']).getEditors().map(function (o) { return o.getEmail().toLowerCase(); });
    t.記錄('副本共享給住持與承辦甲，不含承辦乙', arr編輯者.indexOf(obj環境.str住持帳號) !== -1
      && arr編輯者.indexOf(obj環境.str承辦甲) !== -1 && arr編輯者.indexOf(obj環境.str承辦乙) === -1, arr編輯者.join('、'));
    const obj副本資訊 = 讀取副本資訊(obj活動值['副本ID']);
    t.記錄('副本清單登記模組與活動', obj副本資訊.str模組代號 === 'event' && obj副本資訊.str記錄ID === str活動ID);

    // ── 二、新增活動的檢查 ──
    t.預期錯誤('活動名稱重複（忽略空白）', obj錯誤代碼.參數錯誤, function () {
      新增法會活動(obj住持, { str活動名稱: '測試 觀音法會', str活動類型: '對外', str來源網址: obj表單一.obj回覆表.getUrl() });
    });
    t.預期錯誤('同一份回覆試算表不能登錄兩次', obj錯誤代碼.參數錯誤, function () {
      新增法會活動(obj住持, { str活動名稱: '另一場', str活動類型: '對外', str來源網址: obj表單一.obj回覆表.getUrl() });
    });
    t.預期錯誤('活動類型不對', obj錯誤代碼.參數錯誤, function () {
      新增法會活動(obj住持, { str活動名稱: '另一場', str活動類型: '內部', str來源網址: obj表單一.obj回覆表.getUrl() });
    });
    t.預期錯誤('指派的不是本精舍承辦人', obj錯誤代碼.參數錯誤, function () {
      新增法會活動(obj住持, { str活動名稱: '另一場', str活動類型: '對外', str來源網址: obj表單一.obj回覆表.getUrl(), arr承辦人: ['nobody@example.com'] });
    });
    t.預期錯誤('承辦人不能新增活動', obj錯誤代碼.權限不足, function () {
      新增法會活動(obj甲, { str活動名稱: '另一場', str活動類型: '對外', str來源網址: obj表單一.obj回覆表.getUrl() });
    });
    const obj沒連表單 = SpreadsheetApp.create('法會測試_沒有表單');
    obj環境.arr暫存檔.push(obj沒連表單.getId());
    t.預期錯誤('沒有表單回應分頁的試算表', obj錯誤代碼.工作表不存在, function () {
      新增法會活動(obj住持, { str活動名稱: '另一場', str活動類型: '對外', str來源網址: obj沒連表單.getUrl() });
    });
    const str原範本 = str測試用法會範本ID_;
    str測試用法會範本ID_ = '';
    t.預期錯誤('尚未建立副本範本', obj錯誤代碼.設定缺漏, function () {
      新增法會活動(obj住持, { str活動名稱: '另一場', str活動類型: '對外', str來源網址: 建立法會測試表單_(obj環境, '範本測試').obj回覆表.getUrl() });
    });
    str測試用法會範本ID_ = str原範本;

    // 第二場：不指派承辦人
    const obj表單二 = 建立法會測試表單_(obj環境, '朝山');
    送出法會測試回應_(obj表單二, [{ 姓名: '張三', 法名: '', 手機號碼: '0944555666', 參加日期: ['11/28'] }]);
    t.預期錯誤('期間：結束早於開始', obj錯誤代碼.參數錯誤, function () {
      新增法會活動(obj住持, { str活動名稱: '測試朝山', str活動類型: '對外', str來源網址: obj表單二.obj回覆表.getUrl(), str活動日期: '2026-12-02', str結束日期: '2026-11-28' });
    });
    t.預期錯誤('期間：只填結束日期', obj錯誤代碼.參數錯誤, function () {
      新增法會活動(obj住持, { str活動名稱: '測試朝山', str活動類型: '對外', str來源網址: obj表單二.obj回覆表.getUrl(), str結束日期: '2026-11-28' });
    });
    const obj新增二 = 新增法會活動(obj住持, { str活動名稱: '測試朝山', str活動類型: '對外', str來源網址: obj表單二.obj回覆表.getUrl(),
      str活動日期: '2026-11-28', str結束日期: '2026-12-02' });
    obj環境.arr暫存檔.push(取得法會活動_(obj主控台, obj新增二.obj活動.str活動ID).obj值['副本ID']);
    t.記錄('第二場活動 A0002、對外沒有報到範圍', obj新增二.obj活動.str活動ID === 'A0002' && obj新增二.obj活動.str報到範圍 === '');
    t.記錄('期間活動：顯示 2026-11-28～12-02、單日活動只顯示開始日', obj新增二.obj活動.str日期顯示 === '2026-11-28～12-02'
      && obj新增二.obj活動.str結束日期 === '2026-12-02' && 列出法會活動(obj住持, {}).arr活動[1].str日期顯示 === '2026-11-28',
      obj新增二.obj活動.str日期顯示);
    t.記錄('日期文字：跨年顯示完整年份、同一天視為單日', 組合活動日期文字_(new Date(2026, 11, 30), new Date(2027, 0, 2)) === '2026-12-30～2027-01-02'
      && 解析活動期間_('2026-11-28', '2026-11-28').dat結束 === '');

    // ── 三、列出活動 ──
    const obj列出住持 = 列出法會活動(obj住持, {});
    t.記錄('住持看到 2 場、可管理、新的在前', obj列出住持.arr活動.length === 2 && obj列出住持.bool可管理
      && obj列出住持.arr活動[0].str活動ID === 'A0002');
    const obj列出甲 = 列出法會活動(obj甲, {});
    t.記錄('承辦甲只看到被指派的 1 場、不可管理', obj列出甲.arr活動.length === 1 && obj列出甲.arr活動[0].str活動ID === 'A0001' && !obj列出甲.bool可管理);
    t.記錄('承辦甲沒有整理權限時不能同步', obj列出甲.arr活動[0].obj可做.bool同步 === false);
    t.記錄('承辦人姓名有顯示', obj列出住持.arr活動[1].arr承辦人[0].str姓名 === '承辦甲');

    // ── 四、同步 ──
    t.預期錯誤('承辦甲沒有權限時同步被擋', obj錯誤代碼.權限不足, function () { 同步法會資料(obj甲, { str活動ID: str活動ID }); });
    設定人員權限(obj住持, { str帳號: obj環境.str承辦甲, arr權限: ['event.整理資料'] });
    obj甲 = obj環境.重新判定(obj環境.str承辦甲);
    t.記錄('指派整理權限後可同步', 列出法會活動(obj甲, {}).arr活動[0].obj可做.bool同步 === true);
    t.預期錯誤('承辦甲不能同步沒指派的活動', obj錯誤代碼.權限不足, function () { 同步法會資料(obj甲, { str活動ID: 'A0002' }); });

    const obj沒有新 = 同步法會資料(obj甲, { str活動ID: str活動ID });
    t.記錄('沒有新報名：新增 0 筆', obj沒有新.int新增筆數 === 0, obj沒有新.str訊息);
    送出法會測試回應_(obj表單一, [
      { 姓名: '林志明', 法名: '傳丙', 手機號碼: '0955666777', 參加日期: ['11/28'] },
      { 姓名: '王小明', 法名: '傳甲', 手機號碼: '0912345678', 參加日期: ['11/29'] }
    ]);
    const obj檢查 = 檢查法會新回應(obj甲, {});
    t.記錄('檢查新回應：2 筆待下載', obj檢查.obj待同步[str活動ID] === 2, obj檢查.str訊息);
    const obj同步 = 同步法會資料(obj甲, { str活動ID: str活動ID });
    t.記錄('同步：新增 2 筆', obj同步.int新增筆數 === 2, obj同步.str訊息);
    SpreadsheetApp.flush();   // 同步是另一個試算表物件寫入的，先確保寫入完成再讀
    // 第 5 列林志明（不重複）應為淺黃底；第 6 列王小明與第 2 列重名，重複標示的淡橘色優先顯示
    const str新列底色 = String(obj有效.getRange(5, 1).getBackground()).toUpperCase();
    const str重複列底色 = String(obj有效.getRange(6, 1).getBackground()).toUpperCase();
    t.記錄('副本：共 5 筆', obj有效.getLastRow() === 6, `目前最後一列 ${obj有效.getLastRow()}`);
    t.記錄('副本：新列淺黃底', str新列底色 === '#FFF2CC', `第 5 列底色 ${str新列底色}`);
    t.記錄('副本：新列若重名，顯示重複的淡橘色', str重複列底色 === '#FDE2C4' || str重複列底色 === '#FFF2CC', `第 6 列底色 ${str重複列底色}`);
    const int追加欄 = 取得副本標題索引_(obj有效)['系統_追加時間'];
    t.記錄('副本：有系統_追加時間欄', int追加欄 > 0 && String(obj有效.getRange(6, int追加欄).getValue()) !== '');
    t.記錄('副本：新列手機的 0 保留', String(obj有效.getRange(6, 取得副本標題索引_(obj有效)['手機號碼']).getValue()) === '0912345678');
    t.記錄('再同步一次：新增 0 筆', 同步法會資料(obj甲, { str活動ID: str活動ID }).int新增筆數 === 0);
    t.記錄('活動清單：已同步筆數 5', Number(取得法會活動_(obj主控台, str活動ID).obj值['已同步筆數']) === 5);

    // 承辦人在副本刪掉一列，再有新報名時不會被加回
    obj有效.deleteRow(3);
    送出法會測試回應_(obj表單一, [{ 姓名: '周小芳', 法名: '', 手機號碼: '0966777888', 參加日期: ['11/28'] }]);
    同步法會資料(obj甲, { str活動ID: str活動ID });
    t.記錄('刪掉的列不會被加回、只新增 1 筆', obj有效.getLastRow() === 6, `目前 ${obj有效.getLastRow() - 1} 筆`);

    // 表單新增題目 → 副本加欄＋提醒
    obj表單一.obj題目.身份別 = obj表單一.obj表單.addTextItem().setTitle('身份別');
    送出法會測試回應_(obj表單一, [{ 姓名: '吳大同', 法名: '', 手機號碼: '0977888999', 參加日期: ['11/28'], 身份別: '義工' }]);
    const obj加題 = 同步法會資料(obj甲, { str活動ID: str活動ID });
    t.記錄('表單新增題目：副本加「身份別」欄', 取得副本標題索引_(obj有效)['身份別'] > 0 && obj加題.int提醒筆數 === 1, obj加題.str訊息);
    const obj提醒 = 列出法會提醒(obj甲, {});
    t.記錄('提醒：1 則表單新增題目', obj提醒.arr提醒.length === 1 && obj提醒.arr提醒[0].str類型 === '表單新增題目');
    t.記錄('活動卡片顯示 1 則待處理提醒', 列出法會活動(obj甲, {}).arr活動[0].int待處理提醒 === 1);
    處理法會提醒(obj甲, { str提醒ID: obj提醒.arr提醒[0].str提醒ID, str處理狀態: '已處理' });
    t.記錄('提醒標為已處理後不再列出', 列出法會提醒(obj甲, {}).arr提醒.length === 0
      && 列出法會提醒(obj甲, { bool含已處理: true }).arr提醒[0].str處理人 === '承辦甲');
    t.預期錯誤('提醒狀態只能已處理或忽略', obj錯誤代碼.參數錯誤, function () {
      處理法會提醒(obj甲, { str提醒ID: obj提醒.arr提醒[0].str提醒ID, str處理狀態: '刪除' });
    });

    // 填寫人修改報名：回覆試算表同一列的時間戳記變新（以改時間模擬 Google 表單的行為）
    const int來源時間欄 = 取得副本標題索引_(obj回覆分頁)['時間戳記'];
    obj回覆分頁.getRange(2, int來源時間欄).setValue(new Date(new Date().getTime() + 60000));
    SpreadsheetApp.flush();
    const obj改 = 同步法會資料(obj甲, { str活動ID: str活動ID });
    const arr改提醒 = 列出法會提醒(obj甲, {}).arr提醒;
    t.記錄('填寫人修改：不新增、提醒 1 則「回應已修改」', obj改.int新增筆數 === 0 && obj改.int提醒筆數 === 1
      && arr改提醒[0].str類型 === '回應已修改' && arr改提醒[0].str說明.indexOf('王小明') === 0, arr改提醒.length ? arr改提醒[0].str說明 : obj改.str訊息);
    t.記錄('同一次修改只提醒一次', 同步法會資料(obj甲, { str活動ID: str活動ID }).int提醒筆數 === 0);
    處理法會提醒(obj甲, { str提醒ID: arr改提醒[0].str提醒ID, str處理狀態: '已處理' });

    // 回覆試算表被排序（第 3、4 列對調）→ 停止同步並說明
    const int來源欄數 = obj回覆分頁.getLastColumn();
    const arr第3列 = obj回覆分頁.getRange(3, 1, 1, int來源欄數).getValues();
    const arr第4列 = obj回覆分頁.getRange(4, 1, 1, int來源欄數).getValues();
    obj回覆分頁.getRange(3, 1, 1, int來源欄數).setValues(arr第4列);
    obj回覆分頁.getRange(4, 1, 1, int來源欄數).setValues(arr第3列);
    SpreadsheetApp.flush();
    t.預期錯誤('回覆試算表被排序：停止同步並說明', obj錯誤代碼.參數錯誤, function () { 同步法會資料(obj甲, { str活動ID: str活動ID }); });
    t.記錄('檢查新報名也列出原因', 檢查法會新回應(obj甲, {}).arr明細.some(function (s) { return s.indexOf('✘') === 0 && s.indexOf('排序') !== -1; }));
    obj回覆分頁.getRange(3, 1, 1, int來源欄數).setValues(arr第3列);
    obj回覆分頁.getRange(4, 1, 1, int來源欄數).setValues(arr第4列);
    SpreadsheetApp.flush();
    t.記錄('還原後恢復正常、沒有多加資料', 同步法會資料(obj甲, { str活動ID: str活動ID }).int新增筆數 === 0 && obj有效.getLastRow() === 7);

    // ── 五、活動作業鎖 ──
    const str鎖鍵 = `${str法會作業鎖前綴}TC_${str活動ID}`;
    CacheService.getScriptCache().put(str鎖鍵, JSON.stringify({ str識別: 'x', str作業名稱: '移除重複' }), 60);
    t.預期錯誤('有人正在處理時同步被擋', obj錯誤代碼.系統忙碌, function () { 同步法會資料(obj甲, { str活動ID: str活動ID }); });
    const obj全部 = 同步法會資料(obj住持, {});
    t.記錄('同步全部：忙碌的活動略過、其他照常', obj全部.arr明細.some(function (s) { return s.indexOf('✘ 測試觀音法會') === 0; })
      && obj全部.arr明細.some(function (s) { return s.indexOf('✔ 測試朝山') === 0; }), obj全部.arr明細.join('｜'));
    CacheService.getScriptCache().remove(str鎖鍵);
    t.記錄('作業完成後自動解除', CacheService.getScriptCache().get(`${str法會作業鎖前綴}TC_A0002`) === null);

    // ── 六、承辦人異動 ──
    const obj設定 = 設定法會承辦人(obj住持, { str活動ID: str活動ID, arr承辦人: [obj環境.str承辦乙] });
    const arr新編輯者 = DriveApp.getFileById(obj活動值['副本ID']).getEditors().map(function (o) { return o.getEmail().toLowerCase(); });
    t.記錄('改派承辦乙：副本共享隨之調整', arr新編輯者.indexOf(obj環境.str承辦乙) !== -1 && arr新編輯者.indexOf(obj環境.str承辦甲) === -1, obj設定.str訊息);
    t.記錄('承辦甲看不到被移除的活動', 列出法會活動(obj甲, {}).arr活動.length === 0);
    t.記錄('承辦人選項列出兩位與權限', 列出法會承辦人選項(obj住持, {}).arr承辦人.length === 2);
    t.預期錯誤('承辦人不能列出承辦人選項', obj錯誤代碼.權限不足, function () { 列出法會承辦人選項(obj甲, {}); });

    // ── 七、結束與重新開啟 ──
    const obj結束 = 結束法會活動(obj住持, { str活動ID: str活動ID });
    t.記錄('設為結束', obj結束.bool成功 && 取得法會活動_(obj主控台, str活動ID).obj值['活動狀態'] === '結束', obj結束.str訊息);
    t.記錄('結束後副本停用', 讀取副本資訊(obj活動值['副本ID']).str狀態 === '停用');
    t.預期錯誤('結束後不能同步', obj錯誤代碼.參數錯誤, function () { 同步法會資料(obj住持, { str活動ID: str活動ID }); });
    t.預期錯誤('結束後不能再結束', obj錯誤代碼.參數錯誤, function () { 結束法會活動(obj住持, { str活動ID: str活動ID }); });
    const obj重開 = 重新開啟法會活動(obj住持, { str活動ID: str活動ID });
    t.記錄('重新開啟回到收件中、副本啟用', 取得法會活動_(obj主控台, str活動ID).obj值['活動狀態'] === '收件中'
      && 讀取副本資訊(obj活動值['副本ID']).str狀態 === '啟用', obj重開.str訊息);
    t.預期錯誤('收件中不能重新開啟', obj錯誤代碼.參數錯誤, function () { 重新開啟法會活動(obj住持, { str活動ID: str活動ID }); });

    // ── 八、經由路由呼叫 ──
    const str住持代碼 = 建立工作階段(obj住持);
    const obj路由 = 處理請求文字(JSON.stringify({ action: 'event.列出活動', token: str住持代碼, 參數: {} }));
    t.記錄('路由：event.列出活動', obj路由.bool成功 === true && obj路由.arr活動.length === 2);
    const obj路由錯 = 處理請求文字(JSON.stringify({ action: 'event.新增活動', token: str住持代碼, 參數: {} }));
    t.記錄('路由：缺資料時回白話錯誤', obj路由錯.bool成功 === false && obj路由錯.str訊息.indexOf('活動名稱') !== -1, obj路由錯.str訊息);
    const obj路由未登入 = 處理請求文字(JSON.stringify({ action: 'event.列出活動', token: '', 參數: {} }));
    t.記錄('路由：未登入回登入逾時', obj路由未登入.str錯誤代碼 === obj錯誤代碼.登入逾時);

  } catch (err) {
    t.記錄('測試流程中斷', false, (err && err.message ? err.message : err) + (err && err.stack ? '\n' + err.stack : ''));
  } finally {
    清除法會測試環境_(obj環境);
  }
  return t.結算();
}
