// ============================================================================
// 檔案名稱：測試_核心_路由.gs
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.0.0（2026-10-25）
// 用途說明：
//   在 Apps Script 編輯器中執行「測試_核心_路由」。
//   模擬前端送來的請求，測試請求解析、登入檢查、權限、模組路由與回應格式。
//   使用暫存的系統主控與精舍，最後移到垃圾桶。不會讀寫正式資料。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：路由定義_testroute
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：測試專用的模組路由，示範模組如何登記自己的 action。
 * 參數：無
 * 傳回：{Object} 路由表
 * ============================================================================
 */
function 路由定義_testroute() {
  return {
    'testroute.打招呼': {
      fn: function (obj工作階段, obj參數) { return { str回覆: `您好，${obj工作階段.str姓名}` }; }
    },
    'testroute.公開資訊': {
      fn: function (obj工作階段, obj參數) { return { str回覆: '不需登入' }; },
      bool需登入: false
    }
  };
}


/**
 * ============================================================================
 * 函式名稱：測試_核心_路由
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：自動測試核心_路由。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_核心_路由() {
  const arr結果 = [];
  const arr暫存檔 = [];
  let obj暫存根資料夾 = null;

  const str系統管理員 = 'admin.test@example.com';
  const str住持 = 'abbot.test@example.com';
  const str承辦人 = 'staff.test@example.com';

  function 記錄(str項目, bool通過, str補充) {
    arr結果.push({ str項目: str項目, bool通過: bool通過 });
    console.log(`${bool通過 ? '✔' : '✘'} ${str項目}${str補充 ? '：' + str補充 : ''}`);
  }
  // 模擬前端送出 JSON 文字
  function 送出(str動作, str代碼, obj參數) {
    return 處理請求文字(JSON.stringify({ action: str動作, token: str代碼, 參數: obj參數 || {} }));
  }
  // 回應是否為指定的錯誤
  function 是錯誤(obj回應, str代碼) {
    return obj回應.bool成功 === false && obj回應.str錯誤代碼 === str代碼 && typeof obj回應.str訊息 === 'string';
  }

  try {
    // ── 準備：系統主控、精舍、承辦人、測試模組開通 ──
    const obj主控 = SpreadsheetApp.create(`平台測試_系統主控_${new Date().getTime()}`);
    arr暫存檔.push(obj主控.getId());
    建立整份結構(obj主控, obj系統主控結構);
    obj暫存根資料夾 = DriveApp.createFolder(`平台測試_精舍資料_${new Date().getTime()}`);
    設定測試用系統主控_(obj主控.getId());
    str測試用系統管理員帳號_ = str系統管理員;
    str測試用精舍資料根ID_ = obj暫存根資料夾.getId();

    const obj系統 = 判定身分_(str系統管理員, '');
    開通精舍(obj系統, { str精舍代號: 'TC', str精舍名稱: '測試台中精舍', str管理員帳號: str住持, str管理員姓名: '測試住持' });
    新增人員(判定身分_(str住持, 'TC'), { str帳號: str承辦人, str姓名: '測試承辦人' });
    新增資料列(obj主控.getSheetByName('模組清單'), { '模組代號': 'testroute', '模組名稱': '測試路由模組', '型態': '持續型', '狀態': '啟用' });
    新增資料列(obj主控.getSheetByName('精舍模組開通'), { '精舍代號': 'TC', '模組代號': 'testroute', '主控台ID': 'x', '狀態': '啟用' });

    // 以工作階段代表已登入（Google 憑證本身需真實登入，於前端測試）
    const str住持代碼 = 建立工作階段(判定身分_(str住持, 'TC'));
    const str承辦代碼 = 建立工作階段(判定身分_(str承辦人, 'TC'));
    const str系統代碼 = 建立工作階段(obj系統);

    // ── 請求格式 ──
    記錄('空的請求', 是錯誤(處理請求文字(''), obj錯誤代碼.參數錯誤));
    記錄('不是 JSON 的請求', 是錯誤(處理請求文字('這不是JSON'), obj錯誤代碼.參數錯誤));
    記錄('沒有 action', 是錯誤(處理請求文字('{}'), obj錯誤代碼.參數錯誤));
    記錄('action 格式不對', 是錯誤(送出('沒有分隔符號', ''), obj錯誤代碼.參數錯誤));
    const obj不認得 = 送出('精舍.不存在的功能', str住持代碼);
    記錄('不認得的 action', 是錯誤(obj不認得, obj錯誤代碼.參數錯誤), obj不認得.str訊息);

    // ── 登入檢查 ──
    記錄('需要登入的功能沒帶代碼', 是錯誤(送出('精舍.列出人員', ''), obj錯誤代碼.登入逾時));
    記錄('代碼無效視為逾時', 是錯誤(送出('精舍.列出人員', '假的代碼'), obj錯誤代碼.登入逾時));
    記錄('Google 登入不需代碼（沒有憑證時拒絕）', 是錯誤(送出('驗證.Google登入', '', {}), obj錯誤代碼.參數錯誤));

    // ── 正常執行與回應格式 ──
    const obj人員 = 送出('精舍.列出人員', str住持代碼);
    記錄('精舍管理員列出人員', obj人員.bool成功 === true && obj人員.arr人員.length === 1);
    const obj我的 = 送出('驗證.我的資訊', str承辦代碼);
    記錄('我的資訊含身分與模組',
      obj我的.bool成功 && obj我的.obj身分.str角色 === '承辦人' && obj我的.arr模組.length === 1
      && obj我的.arr模組[0].str主控台ID === undefined, `模組：${obj我的.arr模組.map(function (o) { return o.str模組名稱; }).join('、')}`);
    const obj系統我的 = 送出('驗證.我的資訊', str系統代碼);
    記錄('系統管理員沒有模組', obj系統我的.bool成功 && obj系統我的.arr模組.length === 0);
    const obj精舍清單 = 送出('系統.列出精舍', str系統代碼);
    記錄('系統管理員列出精舍', obj精舍清單.bool成功 && obj精舍清單.arr精舍.length === 1);

    // ── 權限 ──
    記錄('承辦人不能開通精舍', 是錯誤(送出('系統.開通精舍', str承辦代碼, { str精舍代號: 'KH' }), obj錯誤代碼.權限不足));
    記錄('承辦人不能列出人員', 是錯誤(送出('精舍.列出人員', str承辦代碼), obj錯誤代碼.權限不足));
    記錄('系統管理員不能讀精舍人員', 是錯誤(送出('精舍.列出人員', str系統代碼), obj錯誤代碼.權限不足));

    // ── 函式內的錯誤也會變成白話回應 ──
    const obj缺資料 = 送出('精舍.新增人員', str住持代碼, { str帳號: '' });
    記錄('缺少資料時回傳白話訊息', 是錯誤(obj缺資料, obj錯誤代碼.參數錯誤), obj缺資料.str訊息);

    // ── 模組路由 ──
    const obj招呼 = 送出('testroute.打招呼', str承辦代碼);
    記錄('模組自行登記的 action', obj招呼.bool成功 && obj招呼.str回覆 === '您好，測試承辦人', obj招呼.str回覆);
    記錄('模組 action 也檢查登入', 是錯誤(送出('testroute.打招呼', ''), obj錯誤代碼.登入逾時));
    記錄('模組可設定不需登入的 action', 送出('testroute.公開資訊', '').str回覆 === '不需登入');
    記錄('模組沒有登記的 action', 是錯誤(送出('testroute.沒有這個', str承辦代碼), obj錯誤代碼.參數錯誤));
    記錄('模組代號格式不對', 是錯誤(送出('Test-Route.打招呼', str承辦代碼), obj錯誤代碼.參數錯誤));

    // ── 登出 ──
    記錄('登出', 送出('驗證.登出', str承辦代碼).bool成功 === true);
    記錄('登出後代碼失效', 是錯誤(送出('驗證.我的資訊', str承辦代碼), obj錯誤代碼.登入逾時));

    // ── doPost／doGet（Google 實際呼叫的入口）──
    const obj輸出 = doPost({ postData: { contents: JSON.stringify({ action: '驗證.我的資訊', token: str住持代碼 }) } });
    const obj解析 = JSON.parse(obj輸出.getContent());
    記錄('doPost 回傳 JSON', obj解析.bool成功 === true && obj解析.obj身分.str角色 === '精舍管理員');
    記錄('doPost 沒有內容也不會當掉', JSON.parse(doPost({}).getContent()).bool成功 === false);
    記錄('doGet 健康檢查', JSON.parse(doGet({}).getContent()).str版本 === str平台版本);

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
