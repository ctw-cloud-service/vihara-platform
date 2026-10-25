// ============================================================================
// 檔案名稱：測試_核心_主檔與副本.gs
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.0.0（2026-10-25）
// 用途說明：
//   在 Apps Script 編輯器中執行「測試_核心_主檔與副本」。
//   建立暫存的系統主控、精舍資料夾與範本，測試流水號、共用主檔、副本建立與共享同步，
//   最後把暫存檔與資料夾移到垃圾桶。不會讀寫正式資料。
//
//   ※ 測試帳號使用 @example.com（保留給測試用的網域，不會寄到真人）。
//     Google 雲端硬碟可能不接受把非 Google 帳號加入共享，因此共享測試只檢查
//     「每個應加入的帳號，不是已加入、就是被列在失敗清單中並有說明」。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：主檔定義_testgroup
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用的假主檔，示範主檔定義的寫法。
 * 參數：無
 * 傳回：{Object} 主檔定義
 * ============================================================================
 */
function 主檔定義_testgroup() {
  return { str主檔名稱: '測試組別', str代號前綴: 'G', arr額外欄位: ['負責人'] };
}


/**
 * ============================================================================
 * 函式名稱：模組定義_testcopy
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用的假活動型模組。
 * 參數：無
 * 傳回：{Object} 模組定義
 * ============================================================================
 */
function 模組定義_testcopy() {
  return { str模組代號: 'testcopy', str模組名稱: '測試活動', str型態: '活動型', arr可指派權限: [] };
}


/**
 * ============================================================================
 * 函式名稱：測試_核心_主檔與副本
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：自動測試核心_流水號、核心_共用主檔、核心_副本管理與人員異動同步。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_核心_主檔與副本() {
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
  // 共享結果是否涵蓋所有應加入的帳號（加入成功或列在失敗清單中）
  function 已處理全部(obj同步, arr預期) {
    const arr已處理 = obj同步.arr新增.concat(obj同步.arr失敗.map(function (o) { return o.str帳號; }));
    return arr預期.every(function (str) { return arr已處理.indexOf(str) !== -1; });
  }
  function 排序後比較(arr甲, arr乙) {
    return JSON.stringify(arr甲.slice().sort()) === JSON.stringify(arr乙.slice().sort());
  }

  try {
    // ── 準備暫存環境：系統主控、精舍資料夾、開通精舍、新增承辦人、範本 ──
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

    const obj範本 = SpreadsheetApp.create(`平台測試_範本_${new Date().getTime()}`);
    arr暫存檔.push(obj範本.getId());

    // ── 流水號 ──
    const int第一段 = 執行並鎖定(function () { return 取得流水號區段('TC', '測試流水號', 1); }, '測試');
    const int第二段 = 執行並鎖定(function () { return 取得流水號區段('TC', '測試流水號', 3); }, '測試');
    const int第三段 = 執行並鎖定(function () { return 取得流水號區段('TC', '測試流水號', 1); }, '測試');
    記錄('流水號依序且區段不重疊', int第一段 === 1 && int第二段 === 2 && int第三段 === 5, `${int第一段}、${int第二段}、${int第三段}`);
    const arr臨時一 = 執行並鎖定(function () { return 產生臨時編號('tc', 2); }, '測試');
    const arr臨時二 = 執行並鎖定(function () { return 產生臨時編號('TC', 1); }, '測試');
    記錄('臨時編號格式 T-TC-0001',
      arr臨時一.join(',') === 'T-TC-0001,T-TC-0002' && arr臨時二[0] === 'T-TC-0003', arr臨時一.concat(arr臨時二).join('、'));

    // ── 共用主檔 ──
    const obj新增一 = 儲存主檔項目(obj住持, { str主檔代號: 'testgroup', str名稱: '香積組', obj額外: { '負責人': '甲' } });
    const obj新增二 = 儲存主檔項目(obj住持, { str主檔代號: 'testgroup', str名稱: '交通組' });
    記錄('新增主檔自動給代號', obj新增一.str代號 === 'G001' && obj新增二.str代號 === 'G002');
    預期錯誤('啟用中的名稱不可重複', obj錯誤代碼.參數錯誤, function () {
      儲存主檔項目(obj住持, { str主檔代號: 'testgroup', str名稱: '香積組' });
    });
    儲存主檔項目(obj住持, { str主檔代號: 'testgroup', str代號: 'G001', str名稱: '香積組（改名）', int排序: 9 });
    儲存主檔項目(obj住持, { str主檔代號: 'testgroup', str代號: 'G002', str名稱: '交通組', str狀態: '停用' });
    const arr啟用中 = 列出主檔(obj承辦, { str主檔代號: 'testgroup' }).arr項目;
    const arr含停用 = 列出主檔(obj承辦, { str主檔代號: 'testgroup', bool含停用: true }).arr項目;
    記錄('承辦人可讀取主檔；預設不含停用',
      arr啟用中.length === 1 && arr啟用中[0].str名稱 === '香積組（改名）' && arr啟用中[0].obj額外['負責人'] === '甲');
    記錄('含停用時依排序列出', arr含停用.length === 2 && arr含停用[0].str代號 === 'G002');
    const obj對照 = 取得主檔對照('TC', 'testgroup');
    記錄('代號對照含已停用項目', obj對照['G001'] === '香積組（改名）' && obj對照['G002'] === '交通組');
    預期錯誤('承辦人不能維護主檔', obj錯誤代碼.權限不足, function () {
      儲存主檔項目(obj承辦, { str主檔代號: 'testgroup', str名稱: '新組' });
    });
    預期錯誤('不可寫入定義外的欄位', obj錯誤代碼.參數錯誤, function () {
      儲存主檔項目(obj住持, { str主檔代號: 'testgroup', str名稱: '新組', obj額外: { '不存在': 1 } });
    });
    預期錯誤('不存在的主檔', obj錯誤代碼.參數錯誤, function () { 列出主檔(obj住持, { str主檔代號: 'nomaster' }); });

    // ── 建立副本 ──
    const obj副本 = 建立副本({
      str精舍代號: 'TC', str模組代號: 'testcopy', str記錄ID: 'EV001',
      str範本ID: obj範本.getId(), str副本名稱: '測試法會副本', arr指派帳號: [str承辦人]
    });
    arr暫存檔.push(obj副本.str副本ID);
    記錄('建立副本並設定共享（精舍管理員＋指派承辦人）', 已處理全部(obj副本.obj同步結果, [str住持, str承辦人]),
      `加入：${obj副本.obj同步結果.arr新增.join('、') || '無'}；未成功：${obj副本.obj同步結果.arr失敗.length} 筆`);

    const obj資訊 = 讀取副本資訊(obj副本.str副本ID);
    記錄('讀取副本資訊', obj資訊.str精舍代號 === 'TC' && obj資訊.str記錄ID === 'EV001' && obj資訊.arr指派帳號[0] === str承辦人);
    預期錯誤('非平台副本無法使用', obj錯誤代碼.參數錯誤, function () { 讀取副本資訊(obj範本.getId()); });

    記錄('應有名單＝精舍管理員＋指派承辦人', 排序後比較(計算應有編輯者_('TC', [str承辦人]), [str住持, str承辦人]));
    記錄('指派未在人員名單中的帳號會被忽略', 排序後比較(計算應有編輯者_('TC', ['nobody@example.com']), [str住持]));

    設定副本指派('TC', obj副本.str副本ID, []);
    記錄('取消指派後副本清單已更新', 讀取副本資訊(obj副本.str副本ID).arr指派帳號.length === 0);
    設定副本指派('TC', obj副本.str副本ID, [str承辦人]);

    // ── 人員異動自動同步 ──
    更新人員(obj住持, { str帳號: str承辦人, str狀態: '停用' });
    記錄('承辦人停用後不在應有名單', 排序後比較(計算應有編輯者_('TC', [str承辦人]), [str住持]));
    新增精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持二, str姓名: '第二位' });
    記錄('新增精舍管理員後加入應有名單', 計算應有編輯者_('TC', []).indexOf(str住持二) !== -1);

    const obj重新同步 = 重新同步副本共享(obj住持, {});
    記錄('重新同步副本共享', obj重新同步.bool成功, obj重新同步.str訊息);
    預期錯誤('承辦人不能重新同步副本', obj錯誤代碼.權限不足, function () { 重新同步副本共享(obj承辦, {}); });

    設定副本狀態('TC', obj副本.str副本ID, '停用');
    記錄('停用的副本不再列入同步', 同步精舍全部副本('TC').int副本數 === 0);

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
