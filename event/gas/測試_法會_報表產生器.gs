// ============================================================================
// 檔案名稱：測試_法會_報表產生器.gs
// 所屬模組：法會活動（event）——測試平台共用元件「報表產生器」在法會副本上的實際操作
// 所屬層級：測試（上線後可保留，不影響正式功能）
// 檔案版本：v1.0.0（2026-11-04）
// 用途說明：
//   在 Apps Script 編輯器執行「測試_法會_報表產生器」（約 1～2 分鐘）：
//   以「執行測試的帳號」本人的存取權杖（同副本選單）測試
//     權限 → 新增報表分頁與下拉 → 產生（條件、改名、空白欄、排序、手機 0 保留）→ 錯誤提示
//     → 任一符合 → 更新下拉 → 範本存／套用 → 重新產生全部 → 不會改到資料分頁 → 路由。
//   使用 測試_法會_活動與同步.gs 的共用測試環境，測完全部移到垃圾桶。
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：設定報表條件_（測試共用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：模擬承辦人在設定區下拉選擇：第 int序 個條件（1 起算）填欄位、比較、值。
 * 參數：obj分頁 {Sheet}；int序 {number}；str欄位、str比較、str值 {string}
 * 傳回：無
 * ============================================================================
 */
function 設定報表條件_(obj分頁, int序, str欄位, str比較, str值) {
  const p = 報表_條件位置_(int序 - 1);
  obj分頁.getRange(p.int列, p.int欄位欄, 1, 3).setValues([[str欄位, str比較, str值]]);
}


/**
 * ============================================================================
 * 函式名稱：讀取報表資料_（測試共用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：讀出報表第 6 列標題與第 7 列起的資料（顯示文字）。
 * 參數：obj分頁 {Sheet}
 * 傳回：{Object} { arr標題, arr資料 }
 * ============================================================================
 */
function 讀取報表資料_(obj分頁) {
  const int末欄 = Math.max(obj分頁.getLastColumn(), 1);
  const arr標題 = obj分頁.getRange(6, 1, 1, int末欄).getDisplayValues()[0].filter(function (s) { return s !== ''; });
  const int末列 = obj分頁.getLastRow();
  const arr資料 = int末列 >= 7
    ? obj分頁.getRange(7, 1, int末列 - 6, arr標題.length).getDisplayValues().filter(function (r) { return r.join('') !== ''; })
    : [];
  return { arr標題: arr標題, arr資料: arr資料 };
}


/**
 * ============================================================================
 * 函式名稱：測試_法會_報表產生器
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：自動測試報表產生器的完整流程。
 * 參數：無
 * 傳回：{Object} { int通過, int失敗, arr失敗項目 }
 * ============================================================================
 */
function 測試_法會_報表產生器() {
  const t = 建立法會測試記錄器_();
  let obj環境 = null;

  try {
    obj環境 = 建立法會測試環境_();
    const obj住持 = obj環境.obj住持;
    const obj主控台 = 開啟法會主控台_('TC');

    // 準備：一場活動與整理好的有效資料
    const obj表單 = 建立法會測試表單_(obj環境, '報表測試');
    送出法會測試回應_(obj表單, [{ 姓名: '王小明', 法名: '傳甲', 手機號碼: '0912345678', 參加日期: ['11/28'] }]);
    const str活動ID = 新增法會活動(obj住持, { str活動名稱: '測試報表法會', str活動類型: '對內', str來源網址: obj表單.obj回覆表.getUrl() }).obj活動.str活動ID;
    const str副本ID = String(取得法會活動_(obj主控台, str活動ID).obj值['副本ID']);
    const obj副本 = SpreadsheetApp.openById(str副本ID);
    obj環境.arr暫存檔.push(str副本ID);

    const arr標題 = ['時間戳記', '姓名', '法名', '性別', '護七_組別', '護七_行程 [11/30 (一) 起七日]', '手機號碼', '年齡'];
    const arr資料 = [arr標題,
      [new Date(2026, 9, 20, 9, 30, 0), '王小明', '傳乙', '男', '香積組', '是', '', 70],
      [new Date(2026, 9, 20, 9, 31, 0), '李大華', '傳甲', '男', '香積組內場', '是', '', 45],
      [new Date(2026, 9, 20, 9, 32, 0), '陳美麗', '傳丙', '女', '知客組', '是', '', 52],
      [new Date(2026, 9, 20, 9, 33, 0), '林志明', '', '男', '香積組', '', '', 38],
      [new Date(2026, 9, 20, 9, 34, 0), '吳大同', '傳丁', '女', '香積組', '是', '', '']];
    寫入測試有效資料_(obj副本, arr資料);
    const obj有效 = obj副本.getSheetByName('有效資料');
    obj有效.getRange(2, 7, 5, 1).setNumberFormat('@').setValues([['0912345678'], ['0922333444'], ['0933444555'], ['0944555666'], ['0955666777']]);
    const str有效前 = JSON.stringify(obj有效.getRange(1, 1, obj有效.getLastRow(), obj有效.getLastColumn()).getDisplayValues());

    // ── 一、身分與權限 ──
    const str本人 = 正規化帳號(Session.getEffectiveUser().getEmail());
    const str權杖 = ScriptApp.getOAuthToken();
    const fn參 = function (obj) { return Object.assign({ str存取權杖: str權杖, str副本ID: str副本ID }, obj || {}); };
    t.預期錯誤('權杖錯誤', obj錯誤代碼.登入失敗, function () { 報表產生器_新增分頁(null, { str存取權杖: 'abc', str副本ID: str副本ID }); });
    t.預期錯誤('不是本精舍人員', obj錯誤代碼.登入失敗, function () { 報表產生器_新增分頁(null, fn參()); });
    新增人員(obj住持, { str帳號: str本人, str姓名: '測試執行者' });
    t.預期錯誤('本精舍人員但不是這份副本的承辦人', obj錯誤代碼.權限不足, function () { 報表產生器_新增分頁(null, fn參()); });
    設定法會承辦人(obj住持, { str活動ID: str活動ID, arr承辦人: [str本人] });
    try {
      報表產生器_新增分頁(null, { str存取權杖: str權杖, str副本ID: obj表單.obj回覆表.getId() });
      t.記錄('不是平台建立的副本不能使用', false, '應該要出錯');
    } catch (err) {
      t.記錄('不是平台建立的副本不能使用', err instanceof 平台錯誤 && err.str錯誤代碼 !== obj錯誤代碼.未預期錯誤, err.message);
    }

    // ── 二、新增報表分頁 ──
    const obj新增 = 報表產生器_新增分頁(null, fn參({ str分頁名稱: '香積組名冊' }));
    const obj報表 = obj副本.getSheetByName('香積組名冊');
    t.記錄('新增：分頁建立並有報表標記', !!obj報表 && 報表_是報表分頁_(obj報表) && obj新增.int分頁ID === obj報表.getSheetId(), obj新增.str訊息);
    t.記錄('新增：A1 來源分頁、B1 有效資料、D1 全部符合', obj報表.getRange(1, 1).getValue() === '來源分頁' && obj報表.getRange(1, 2).getValue() === '有效資料'
      && obj報表.getRange(1, 4).getValue() === '全部符合' && obj報表.getRange(2, 1).getValue() === '條件1');
    const v來源 = obj報表.getRange(1, 2).getDataValidation();
    t.記錄('下拉：來源分頁只列資料分頁', v來源 && v來源.清單 ? (v來源.清單.indexOf('有效資料') !== -1 && v來源.清單.indexOf('香積組名冊') === -1 && v來源.清單.indexOf('說明') === -1) : true,
      v來源 && v來源.清單 ? v來源.清單.join('、') : '（實機不檢查清單內容）');
    const v欄位 = obj報表.getRange(2, 2).getDataValidation();
    t.記錄('下拉：條件欄位列出來源欄名', !!v欄位 && (!v欄位.清單 || v欄位.清單.indexOf('護七_組別') !== -1));
    t.記錄('下拉：比較方式', !!obj報表.getRange(2, 3).getDataValidation());
    t.記錄('新增：不指定名稱自動命名報表1', 報表產生器_新增分頁(null, fn參()).str分頁名稱 === '報表1');
    t.記錄('新增：同名再新增改成香積組名冊2', 報表產生器_新增分頁(null, fn參({ str分頁名稱: '香積組名冊' })).str分頁名稱 === '香積組名冊2');

    const int報表ID = obj報表.getSheetId();
    t.預期錯誤('產生：第 6 列還沒有欄位', obj錯誤代碼.參數錯誤, function () { 報表產生器_產生(null, fn參({ int分頁ID: int報表ID })); });
    t.預期錯誤('產生：不是報表分頁（有效資料）', obj錯誤代碼.參數錯誤, function () { 報表產生器_產生(null, fn參({ int分頁ID: obj有效.getSheetId() })); });

    // ── 三、設定並產生 ──
    obj報表.getRange(6, 2, 1, 5).setValues([['姓名', '法名', '護七_組別 → 組別', '手機號碼', '簽到']]);
    設定報表條件_(obj報表, 1, '護七_組別', '包含', '香積');
    設定報表條件_(obj報表, 2, '護七_行程 [11/30 (一) 起七日]', '等於', '是');
    obj報表.getRange(1, 6).setValue('法名');            // 排序1：法名 遞增
    obj報表.getRange(4, 1).setValue('香積組 11/30 報到名冊');
    const obj產生 = 報表產生器_產生(null, fn參({ int分頁ID: int報表ID }));
    let r = 讀取報表資料_(obj報表);
    t.記錄('產生：3 筆（香積、11/30 有參加）', obj產生.int筆數 === 3 && r.arr資料.length === 3, obj產生.str訊息);
    t.記錄('產生：依法名排序（三筆都在）', r.arr資料.map(function (a) { return a[2]; }).slice().sort().join(',') === ['傳乙', '傳甲', '傳丁'].sort().join(','),
      '順序：' + r.arr資料.map(function (a) { return a[2]; }).join(','));
    t.記錄('產生：第 6 列顯示名稱、序號', r.arr標題.join('|') === '序號|姓名|法名|組別|手機號碼|簽到', r.arr標題.join('|'));
    t.記錄('產生：改名的欄有「來源欄：」備註', obj報表.getRange(6, 4).getNote() === '來源欄：護七_組別');
    t.記錄('產生：空白欄有備註、內容空白', obj報表.getRange(6, 6).getNote().indexOf('空白欄') === 0 && r.arr資料.every(function (a) { return a[5] === ''; }));
    t.記錄('產生：手機開頭 0 保留', r.arr資料.every(function (a) { return /^09\d{8}$/.test(a[4]); }), r.arr資料.map(function (a) { return a[4]; }).join(','));
    t.記錄('產生：序號 1～3', r.arr資料.map(function (a) { return a[0]; }).join(',') === '1,2,3');
    t.記錄('產生：第 5 列人數', obj報表.getRange(5, 1).getDisplayValue() === '人數：3 人', obj報表.getRange(5, 1).getDisplayValue());
    t.記錄('產生：報表名稱標楷體', obj報表.getRange(4, 1).getDisplayValue() === '香積組 11/30 報到名冊' && obj報表.getRange(7, 2).getFontFamily() === '標楷體');
    t.記錄('產生：訊息說明空白欄', obj產生.str訊息.indexOf('簽到') !== -1);
    t.記錄('產生：不會改到有效資料', JSON.stringify(obj有效.getRange(1, 1, obj有效.getLastRow(), obj有效.getLastColumn()).getDisplayValues()) === str有效前);

    // 再產生一次：改名欄靠備註仍找得到來源；資料少時舊列清掉
    設定報表條件_(obj報表, 3, '姓名', '等於', '王小明');
    const obj再產生 = 報表產生器_產生(null, fn參({ int分頁ID: int報表ID }));
    r = 讀取報表資料_(obj報表);
    t.記錄('再產生：靠備註找回「組別」來源、舊列清除', obj再產生.int筆數 === 1 && r.arr資料.length === 1 && r.arr資料[0][3] === '香積組', JSON.stringify(r.arr資料));

    // 遞減排序＋年齡
    設定報表條件_(obj報表, 3, '', '', '');
    obj報表.getRange(1, 6, 1, 2).setValues([['年齡', '遞減']]);
    obj報表.getRange(6, 7).setValue('年齡');
    報表產生器_產生(null, fn參({ int分頁ID: int報表ID }));
    r = 讀取報表資料_(obj報表);
    t.記錄('排序：年齡遞減、空白最後', r.arr資料.map(function (a) { return a[2 - 1]; }).join(',') === '王小明,李大華,吳大同', r.arr資料.map(function (a) { return a[1] + a[6]; }).join(','));

    // ── 四、錯誤提示 ──
    設定報表條件_(obj報表, 4, '組別名稱', '等於', '香積組');
    t.預期錯誤('條件欄位不存在（指出條件4）', obj錯誤代碼.欄位缺漏, function () { 報表產生器_產生(null, fn參({ int分頁ID: int報表ID })); });
    設定報表條件_(obj報表, 4, '性別', '等於', '');
    t.預期錯誤('條件少了值', obj錯誤代碼.參數錯誤, function () { 報表產生器_產生(null, fn參({ int分頁ID: int報表ID })); });
    設定報表條件_(obj報表, 4, '', '', '');
    obj報表.getRange(1, 2).setValue('不存在的分頁');
    t.預期錯誤('來源分頁不存在', obj錯誤代碼.工作表不存在, function () { 報表產生器_產生(null, fn參({ int分頁ID: int報表ID })); });
    obj報表.getRange(1, 2).setValue('有效資料');

    // ── 五、任一符合 ──
    obj報表.getRange(1, 4).setValue('任一符合');
    設定報表條件_(obj報表, 1, '性別', '等於', '女');
    設定報表條件_(obj報表, 2, '年齡', '大於等於', '65');
    t.記錄('任一符合：女眾或 65 歲以上 3 筆', 報表產生器_產生(null, fn參({ int分頁ID: int報表ID })).int筆數 === 3);
    obj報表.getRange(1, 4).setValue('全部符合');

    // ── 六、更新下拉 ──
    設定報表條件_(obj報表, 1, '護七_組別', '包含', '香積');
    設定報表條件_(obj報表, 2, '護七_行程 [11/30 (一) 起七日]', '等於', '是');
    報表產生器_更新下拉(null, fn參({ int分頁ID: int報表ID }));
    const v值 = obj報表.getRange(2, 4).getDataValidation();
    t.記錄('更新下拉：條件1 的值列出實際組別', !!v值 && (!v值.清單 || (v值.清單.indexOf('香積組內場') !== -1 && v值.清單.indexOf('知客組') !== -1)),
      v值 && v值.清單 ? v值.清單.join('、') : '');

    // ── 七、範本 ──
    const obj存 = 報表產生器_存成範本(null, fn參({ int分頁ID: int報表ID, str範本名稱: '香積組報到' }));
    const obj範本分頁 = obj副本.getSheetByName('報表範本');
    t.記錄('存範本：建立隱藏分頁', !!obj範本分頁 && obj範本分頁.isSheetHidden() && obj存.bool更新 === false, obj存.str訊息);
    t.記錄('再存同名：更新而不是新增', 報表產生器_存成範本(null, fn參({ int分頁ID: int報表ID, str範本名稱: '香積組報到' })).bool更新 === true && obj範本分頁.getLastRow() === 2);
    t.記錄('報表範本不是報表分頁、也不在來源清單', !報表_是報表分頁_(obj範本分頁) && 報表_可選來源分頁_(obj副本).indexOf('報表範本') === -1);
    t.記錄('範本內容可讀回', 報表_讀取範本們_(obj副本).length === 1 && 報表_讀取範本們_(obj副本)[0].obj設定.arr欄位.length === 6);
    const int原筆數 = 報表產生器_產生(null, fn參({ int分頁ID: int報表ID })).int筆數;
    const obj套新 = 報表產生器_套用範本(null, fn參({ str範本名稱: '香積組報到' }));
    const obj套新分頁 = obj副本.getSheetByName(obj套新.str分頁名稱);
    t.記錄('套用範本（新增分頁）：結果與原報表相同', !!obj套新分頁 && obj套新.int筆數 === int原筆數
      && JSON.stringify(讀取報表資料_(obj套新分頁)) === JSON.stringify(讀取報表資料_(obj報表)), obj套新.str訊息);
    const obj空白報表 = obj副本.getSheetByName('報表1');
    const obj套覆蓋 = 報表產生器_套用範本(null, fn參({ str範本名稱: '香積組報到', int分頁ID: obj空白報表.getSheetId() }));
    t.記錄('套用範本（覆蓋報表1）', obj套覆蓋.str分頁名稱 === '報表1' && 讀取報表資料_(obj空白報表).arr資料.length === int原筆數
      && obj空白報表.getRange(6, 4).getNote() === '來源欄：護七_組別');
    t.預期錯誤('套用不存在的範本', obj錯誤代碼.資料列不存在, function () { 報表產生器_套用範本(null, fn參({ str範本名稱: '沒有這個' })); });

    // ── 八、重新產生全部（新報名後） ──
    obj有效.appendRow([new Date(2026, 9, 21, 8, 0, 0), '張三', '傳戊', '男', '香積組', '是', '', 60]);
    obj有效.getRange(obj有效.getLastRow(), 7).setNumberFormat('@').setValue('0966777888');
    const obj壞 = obj副本.getSheetByName('香積組名冊2');
    obj壞.getRange(6, 2).setValue('姓名');
    設定報表條件_(obj壞, 1, '不存在欄', '等於', 'x');
    const obj全部 = 報表產生器_重新產生全部(null, fn參());
    t.記錄('重新產生全部：一張失敗不影響其他張', obj全部.arr明細.length === 4 && obj全部.arr明細.filter(function (s) { return s.indexOf('✘') === 0; }).length === 1,
      obj全部.str訊息 + ' ' + obj全部.arr明細.join('｜'));
    t.記錄('重新產生全部：新報名已加入', 讀取報表資料_(obj報表).arr資料.length === int原筆數 + 1);

    // ── 九、路由 ──
    const obj路由結果 = 處理請求({ action: 'report.產生', token: '', 參數: fn參({ int分頁ID: int報表ID }) });
    t.記錄('路由：report.產生 不需網頁登入', obj路由結果.bool成功 === true && obj路由結果.int筆數 === int原筆數 + 1, JSON.stringify(obj路由結果).substring(0, 120));
    const obj路由錯 = 處理請求({ action: 'report.產生', token: '', 參數: fn參({ int分頁ID: obj有效.getSheetId() }) });
    t.記錄('路由：錯誤回白話訊息', obj路由錯.bool成功 === false && obj路由錯.str訊息.indexOf('不是報表分頁') !== -1, obj路由錯.str訊息);
  } catch (err) {
    t.記錄('測試過程發生未預期錯誤', false, err && err.stack ? err.stack : String(err));
  } finally {
    清除法會測試環境_(obj環境);
  }
  return t.結算();
}
