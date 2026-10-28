// ============================================================================
// 檔案名稱：測試_核心_精舍設定共享.gs
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.0.0（2026-10-28）
// 用途說明：
//   在 Apps Script 編輯器中執行「測試_核心_精舍設定共享」。
//   測試 核心_精舍管理 v1.3.0：精舍設定試算表以「檢視者」共享給啟用中的精舍管理員，
//   開通精舍、新增／停用管理員、停用／啟用精舍時自動同步。
//   使用暫存的系統主控與精舍資料夾，最後移到垃圾桶。不會讀寫正式資料。
//
//   ※ 測試帳號使用 @example.com，Google 雲端硬碟可能不接受加入共享。
//     因此「加入」只檢查「應加入的帳號，不是已加入、就是列在失敗清單中並有說明」；
//     「應有名單」則精確比對。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：測試_核心_精舍設定共享
 * 版本：v1.0.0（2026-10-28）
 * ----------------------------------------------------------------------------
 * 用途：自動測試精舍設定的檢視者共享。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_核心_精舍設定共享() {
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
  function 排序後相同(arr甲, arr乙) {
    return JSON.stringify(arr甲.slice().sort()) === JSON.stringify(arr乙.slice().sort());
  }
  // 應加入的帳號：不是已是檢視者、就是在失敗清單中
  function 已處理(obj檔案, obj同步, arr預期) {
    const arr檢視者 = obj檔案.getViewers().map(function (o) { return 正規化帳號(o.getEmail()); });
    const arr失敗 = obj同步.arr失敗.map(function (o) { return o.str帳號; });
    return arr預期.every(function (str) { return arr檢視者.indexOf(str) !== -1 || arr失敗.indexOf(str) !== -1; });
  }
  // 目前沒有任何（非擁有者的）編輯者
  function 無編輯者(obj檔案) {
    const str擁有者 = obj檔案.getOwner() ? 正規化帳號(obj檔案.getOwner().getEmail()) : '';
    return obj檔案.getEditors().every(function (o) { return 正規化帳號(o.getEmail()) === str擁有者; });
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

    // ── 一、開通精舍：共享給第一位精舍管理員 ──
    const obj開通 = 開通精舍(obj系統, { str精舍代號: 'TC', str精舍名稱: '測試台中精舍', str管理員帳號: str住持, str管理員姓名: '測試住持' });
    記錄('開通精舍成功（共享失敗也不影響開通）', obj開通.bool成功 === true, obj開通.str訊息);
    const obj檔案 = DriveApp.getFileById(取得精舍資訊('TC').str精舍設定ID);
    記錄('應有檢視者＝第一位精舍管理員', 排序後相同(計算精舍設定應有檢視者_(取得精舍資訊('TC', true)), [str住持]));
    const obj同步一 = 同步精舍設定共享('TC');
    記錄('同步後住持已是檢視者或列為失敗', 已處理(obj檔案, obj同步一, [str住持]),
      `已加入：${obj同步一.arr新增.join('、') || '（先前已加入）'}；未成功：${obj同步一.arr失敗.length} 筆`);
    記錄('沒有任何人有編輯權', 無編輯者(obj檔案));

    // ── 二、承辦人不在共享名單 ──
    新增人員(判定身分_(str住持, 'TC'), { str帳號: str承辦人, str姓名: '測試承辦人' });
    記錄('承辦人不在應有檢視者中', 計算精舍設定應有檢視者_(取得精舍資訊('TC', true)).indexOf(str承辦人) === -1);

    // ── 三、新增與停用精舍管理員 ──
    新增精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持二, str姓名: '第二位' });
    記錄('新增管理員後加入應有檢視者', 排序後相同(計算精舍設定應有檢視者_(取得精舍資訊('TC', true)), [str住持, str住持二]));
    記錄('新增管理員後已同步', 已處理(obj檔案, 同步精舍設定共享('TC'), [str住持, str住持二]));

    停用精舍管理員(obj系統, { str精舍代號: 'TC', str帳號: str住持二 });
    記錄('停用管理員後移出應有檢視者', 排序後相同(計算精舍設定應有檢視者_(取得精舍資訊('TC', true)), [str住持]));
    const arr停用後 = obj檔案.getViewers().map(function (o) { return 正規化帳號(o.getEmail()); });
    記錄('停用的管理員已不是檢視者', arr停用後.indexOf(str住持二) === -1);

    // ── 四、停用與重新啟用精舍 ──
    更新精舍(obj系統, { str精舍代號: 'TC', str狀態: '停用' });
    記錄('精舍停用：應有檢視者為空', 計算精舍設定應有檢視者_(取得精舍資訊('TC', true)).length === 0);
    記錄('精舍停用：所有檢視者已移除', obj檔案.getViewers().filter(function (o) {
      return 正規化帳號(o.getEmail()) !== 正規化帳號(obj檔案.getOwner().getEmail());
    }).length === 0);
    更新精舍(obj系統, { str精舍代號: 'TC', str狀態: '啟用' });
    記錄('精舍重新啟用：住持恢復', 已處理(obj檔案, 同步精舍設定共享('TC'), [str住持]));

    // ── 五、手動加入的編輯者會被移除 ──
    let bool可加入 = true;
    try { obj檔案.addEditor('manual.test@example.com'); } catch (err) { bool可加入 = false; }
    if (bool可加入) {
      const obj同步五 = 同步精舍設定共享('TC');
      記錄('手動加入的編輯者已移除', 無編輯者(obj檔案) && obj同步五.arr移除.indexOf('manual.test@example.com') !== -1);
    } else {
      記錄('手動加入的編輯者已移除（略過：測試帳號無法加入共享）', true);
    }

    // ── 六、其他 ──
    const obj第二次 = 同步精舍設定共享('TC');
    記錄('重複同步不會再異動', obj第二次.arr新增.length === 0 && obj第二次.arr移除.length === 0);
    預期錯誤('不存在的精舍', obj錯誤代碼.參數錯誤, function () { 同步精舍設定共享('NOSUCH'); });
    const obj補齊 = 補齊所有精舍結構();
    記錄('補齊所有精舍結構一併同步、無失敗', obj補齊.int成功數 === 1 && obj補齊.arr失敗.length === 0);

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
