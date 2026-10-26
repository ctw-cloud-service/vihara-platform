// ============================================================================
// 檔案名稱：法會_重複檢查.gs
// 所屬模組：法會活動（event）
// 所屬層級：模組／服務層＋控制層
// 檔案版本：v1.0.0（2026-10-26）
// 用途說明：
//   整理副本「有效資料」的重複報名（以「姓名」為鍵，沿用舊系統 14、16 號檔）：
//     · 重複標示：條件式格式把姓名重複的整列標淡橘色，並建立「重複檢查」分頁
//       （公式即時列出重複者，點「前往」跳到該列）。只設定一次，之後由試算表自己運算
//     · 查詢重複：伺服器端算出每組重複的列號（副本選單「查詢重複」用）
//     · 移除重複：每組保留時間戳記最晚的一筆，其餘整列移到「無效資料」
//       （先寫入無效資料、再刪原列，中途中斷資料也不會遺失）；一律先預覽再執行
//   比對規則：全形英數轉半形、去掉所有空白、英文不分大小寫；姓名空白的列不算。
//   同名不一定是同一人，畫面都會提醒承辦人自行判斷。
//
//   ※ 條件式格式與公式只能用欄位字母（試算表本身的限制），這是本模組唯一使用欄位字母之處；
//     資料讀寫仍一律依標題文字。
//
// 相依檔案：平台核心、法會_模組定義、法會_表單與副本
// ============================================================================


// 重複檢查的設定
const obj法會重複設定 = Object.freeze({
  str鍵欄名: '姓名',
  str重複底色: '#fde2c4',
  int公式最大列: 2000,                    // 條件式格式與公式涵蓋的列數
  str原因欄名: '無效原因',
  str移入時間欄名: '移入時間',
  int查詢顯示上限: 300,
  // 各法會表單的欄位名稱不一：標準名稱 → 可能出現的名稱（比對時忽略空白與全半形括號）
  obj欄位別名: {
    '姓名': ['姓名', '報名者姓名', '學員姓名', '中文姓名', '俗名', '名字'],
    '法名': ['法名', '學員法名'],
    '時間戳記': ['時間戳記', 'Timestamp', '填表時間', '報名時間', '提交時間']
  }
});


/**
 * ============================================================================
 * 函式名稱：尋找副本欄位索引_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   依欄位名稱找出欄索引（0 起算），找不到傳回 -1。
 *   先找完全相同，再找別名；比對前移除空白、統一全半形括號。
 *   刻意不採「包含」比對，避免把「緊急聯絡人(姓名)」誤認成報名者姓名。
 * 參數：
 *   arr標題   {string[]} 第 1 列標題
 *   str欄名   {string}   標準名稱，例如「姓名」
 * 傳回：{number}
 * ============================================================================
 */
function 尋找副本欄位索引_(arr標題, str欄名) {
  const fn正規化 = function (s) {
    return String(s == null ? '' : s).replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase();
  };
  const arr正規標題 = arr標題.map(fn正規化);

  // ① 完全相同
  let int索引 = arr正規標題.indexOf(fn正規化(str欄名));
  if (int索引 >= 0) return int索引;

  // ② 別名
  const obj別名 = obj法會重複設定.obj欄位別名;
  for (const str標準名 in obj別名) {
    const arr群組 = [str標準名].concat(obj別名[str標準名]).map(fn正規化);
    if (arr群組.indexOf(fn正規化(str欄名)) < 0) continue;
    for (let i = 0; i < arr群組.length; i++) {
      int索引 = arr正規標題.indexOf(arr群組[i]);
      if (int索引 >= 0) return int索引;
    }
  }
  return -1;
}


/**
 * ============================================================================
 * 函式名稱：正規化比對鍵_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：姓名比對前的統一處理：全形英數轉半形（NFKC）、移除所有空白、英文轉小寫。
 * 參數：
 *   any值   {*} 儲存格的值
 * 傳回：{string}
 * ============================================================================
 */
function 正規化比對鍵_(any值) {
  return String(any值 == null ? '' : any值).normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}


/**
 * ============================================================================
 * 函式名稱：解析副本時間戳記_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   把時間戳記轉成毫秒以便比較。通常是日期物件；被改成文字
 *   （如「2026/10/8 下午 5:07:52」）也能判讀上午／下午。判讀不出傳回負無限大（視為最早）。
 * 參數：
 *   any值   {*} 儲存格的值
 * 傳回：{number}
 * ============================================================================
 */
function 解析副本時間戳記_(any值) {
  if (Object.prototype.toString.call(any值) === '[object Date]' && !isNaN(any值.getTime())) return any值.getTime();
  const str值 = String(any值 == null ? '' : any值).trim();
  if (str值 === '') return -Infinity;

  const arr = str值.match(
    /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\s*(上午|下午|AM|PM|am|pm)?\s*(\d{1,2})?:?(\d{2})?(?::(\d{2}))?\s*(AM|PM|am|pm)?$/
  );
  if (!arr) return -Infinity;
  let int時 = Number(arr[5] || 0);
  const str午別 = (arr[4] || arr[8] || '').toUpperCase();
  if ((str午別 === '下午' || str午別 === 'PM') && int時 < 12) int時 += 12;   // 下午 1～11 點加 12
  if ((str午別 === '上午' || str午別 === 'AM') && int時 === 12) int時 = 0;   // 上午 12 點是 0 點
  const dat = new Date(Number(arr[1]), Number(arr[2]) - 1, Number(arr[3]), int時, Number(arr[6] || 0), Number(arr[7] || 0));
  return isNaN(dat.getTime()) ? -Infinity : dat.getTime();
}


/**
 * ============================================================================
 * 函式名稱：分析重複群組_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   依比對鍵分組，找出 2 筆以上的群組；每組保留時間最晚的一筆，
 *   時間相同或判讀不出時保留位置較下方（較晚寫入）的一筆。
 * 參數：
 *   arr全部值       {Array[]}  含標題列的二維陣列
 *   int鍵索引       {number}   姓名欄索引（0 起算）
 *   int時間索引     {number}   時間戳記欄索引（0 起算；-1 表示沒有）
 * 傳回：
 *   {Object[]} [ { str顯示鍵值, int保留索引, num保留時間, arr移出索引, arr全部索引 } ]
 *              （索引為陣列索引；0 是標題列，所以試算表列號＝索引＋1）
 * ============================================================================
 */
function 分析重複群組_(arr全部值, int鍵索引, int時間索引) {
  const obj分組 = {};
  const obj顯示名 = {};
  const arr鍵值順序 = [];

  for (let int列 = 1; int列 < arr全部值.length; int列++) {
    const str鍵 = 正規化比對鍵_(arr全部值[int列][int鍵索引]);
    if (str鍵 === '') continue;   // 姓名空白不比對
    if (!obj分組[str鍵]) {
      obj分組[str鍵] = [];
      arr鍵值順序.push(str鍵);
      obj顯示名[str鍵] = String(arr全部值[int列][int鍵索引]).trim();
    }
    const num時間 = int時間索引 >= 0 ? 解析副本時間戳記_(arr全部值[int列][int時間索引]) : -Infinity;
    obj分組[str鍵].push({ int索引: int列, num時間: num時間 });
  }

  const arr結果 = [];
  arr鍵值順序.forEach(function (str鍵) {
    const arr成員 = obj分組[str鍵];
    if (arr成員.length < 2) return;
    let obj保留 = arr成員[0];
    arr成員.forEach(function (obj目前) {
      if (obj目前.num時間 > obj保留.num時間 || (obj目前.num時間 === obj保留.num時間 && obj目前.int索引 > obj保留.int索引)) {
        obj保留 = obj目前;
      }
    });
    arr結果.push({
      str顯示鍵值: obj顯示名[str鍵],
      int保留索引: obj保留.int索引,
      num保留時間: obj保留.num時間,
      arr移出索引: arr成員.filter(function (m) { return m.int索引 !== obj保留.int索引; }).map(function (m) { return m.int索引; }),
      arr全部索引: arr成員.map(function (m) { return m.int索引; })
    });
  });
  return arr結果;
}


/**
 * ============================================================================
 * 函式名稱：讀取有效資料_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：讀出副本「有效資料」的全部值與格式，並找出姓名欄、時間戳記欄。
 * 參數：
 *   obj副本   {Spreadsheet} 副本
 * 傳回：
 *   {Object} { obj分頁, arr全部值, arr全部格式, arr標題, int鍵索引, int時間索引 }
 * ============================================================================
 */
function 讀取有效資料_(obj副本) {
  const obj分頁 = 取得副本分頁_(obj副本, obj法會副本分頁.有效資料);
  const int最後列 = obj分頁.getLastRow();
  const int最後欄 = obj分頁.getLastColumn();
  if (int最後列 < 1 || int最後欄 < 1) {
    throw new 平台錯誤(obj錯誤代碼.欄位缺漏, '「有效資料」是空白的，沒有可檢查的資料。');
  }
  const obj範圍 = obj分頁.getRange(1, 1, int最後列, int最後欄);
  const arr全部值 = obj範圍.getValues();
  const arr標題 = arr全部值[0].map(function (v) { return String(v).trim(); });
  const int鍵索引 = 尋找副本欄位索引_(arr標題, obj法會重複設定.str鍵欄名);
  if (int鍵索引 < 0) {
    throw new 平台錯誤(
      obj錯誤代碼.欄位缺漏,
      `「有效資料」第 1 列找不到「姓名」欄，無法檢查重複。目前的欄位有：${arr標題.filter(String).join('、')}`
    );
  }
  return {
    obj分頁: obj分頁, obj範圍: obj範圍, arr全部值: arr全部值, arr標題: arr標題,
    int鍵索引: int鍵索引, int時間索引: 尋找副本欄位索引_(arr標題, '時間戳記')
  };
}


/**
 * ============================================================================
 * 函式名稱：轉為欄位字母_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：欄號轉 A1 字母（2 → B、27 → AA），只供條件式格式與公式使用。
 * 參數：
 *   int欄號   {number} 1 起算
 * 傳回：{string}
 * ============================================================================
 */
function 轉為欄位字母_(int欄號) {
  let str字母 = '';
  let int數 = int欄號;
  while (int數 > 0) {
    const int餘 = (int數 - 1) % 26;
    str字母 = String.fromCharCode(65 + int餘) + str字母;
    int數 = Math.floor((int數 - 1) / 26);
  }
  return str字母;
}


/**
 * ============================================================================
 * 函式名稱：是否為重複標示規則_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：判斷一條條件式格式是不是本系統設的「姓名重複標示」。
 *       以公式的固定樣式比對（不比欄字母與列數），刪列、移欄後仍認得；
 *       承辦人自己加的規則不會被誤判。
 * 參數：
 *   obj規則   {ConditionalFormatRule}
 * 傳回：{boolean}
 * ============================================================================
 */
function 是否為重複標示規則_(obj規則) {
  const obj條件 = obj規則.getBooleanCondition();
  if (!obj條件) return false;
  const arr值 = obj條件.getCriteriaValues();
  const str公式 = (arr值 && arr值[0]) ? String(arr值[0]) : '';
  return /SUMPRODUCT\(--\(LOWER\(SUBSTITUTE\(SUBSTITUTE\(\$[A-Z]+\$2:\$[A-Z]+\$\d+," ",""\),"　",""\)\)=/.test(str公式);
}


/**
 * ============================================================================
 * 函式名稱：套用重複標示_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   在副本設定姓名重複標示（可重複執行，不會疊加）：
 *     ① 先移除本系統先前設的同類規則，再加一條條件式格式（姓名重複整列淡橘色）
 *     ② 建立／重建「重複檢查」分頁：公式即時列出重複者，「前往」可跳到該列
 *   承辦人自己加的格式不動。
 * 參數：
 *   obj副本   {Spreadsheet} 副本
 * 傳回：{string} 結果說明
 * ============================================================================
 */
function 套用重複標示_(obj副本) {
  const obj分頁 = 取得副本分頁_(obj副本, obj法會副本分頁.有效資料);
  const int最後欄 = obj分頁.getLastColumn();
  const arr標題 = int最後欄 > 0 ? obj分頁.getRange(1, 1, 1, int最後欄).getValues()[0].map(function (v) { return String(v).trim(); }) : [];
  const int鍵索引 = 尋找副本欄位索引_(arr標題, obj法會重複設定.str鍵欄名);
  if (int鍵索引 < 0) {
    throw new 平台錯誤(obj錯誤代碼.欄位缺漏, `「有效資料」找不到「姓名」欄，無法設定重複標示。目前的欄位有：${arr標題.filter(String).join('、')}`);
  }
  const str字母 = 轉為欄位字母_(int鍵索引 + 1);
  const int末列 = obj法會重複設定.int公式最大列;

  // 正規化：去半形／全形空白、轉小寫
  const fn正規化 = function (str範圍) { return `LOWER(SUBSTITUTE(SUBSTITUTE(${str範圍}," ",""),"　",""))`; };

  // ① 條件式格式
  const str公式 = `=AND($${str字母}2<>"",SUMPRODUCT(--(${fn正規化(`$${str字母}$2:$${str字母}$${int末列}`)}=${fn正規化(`$${str字母}2`)}))>1)`;
  const arr規則 = obj分頁.getConditionalFormatRules().filter(function (obj規則) { return !是否為重複標示規則_(obj規則); });
  arr規則.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied(str公式)
    .setBackground(obj法會重複設定.str重複底色)
    .setRanges([obj分頁.getRange(2, 1, Math.max(obj分頁.getMaxRows() - 1, 1), Math.max(obj分頁.getMaxColumns(), 1))])
    .build());
  obj分頁.setConditionalFormatRules(arr規則);

  // ② 重複檢查分頁（公式即時運算；承辦人可自行隱藏）
  const str清單名 = obj法會副本分頁.重複檢查;
  const obj清單 = obj副本.getSheetByName(str清單名) || obj副本.insertSheet(str清單名);
  obj清單.clear();
  const str分頁名 = obj分頁.getName();
  const str來源 = `'${str分頁名.replace(/'/g, "''")}'!${str字母}2:${str字母}${int末列}`;
  obj清單.getRange('A1').setValue('重複資料檢查（以「姓名」為鍵）').setFontWeight('bold').setFontSize(13);
  obj清單.getRange('A2').setValue(`本頁由公式自動產生，請勿手動修改。去除空白、英文不分大小寫；姓名空白的列不算。同名不一定是同一人，請自行判斷。重複的列在「${str分頁名}」會標淡橘色。`);
  obj清單.getRange('A4:D4').setValues([['列號', '姓名', '重複次數', '前往']]).setFontWeight('bold').setBackground('#f3e8d6');
  obj清單.getRange('A5').setFormula(`=IFERROR(LET(r,${str來源},k,${fn正規化('r')},c,MMULT(--(k=TRANSPOSE(k)),SEQUENCE(ROWS(k),1,1,0)),SORT(FILTER({ROW(r),r,c},k<>"",c>1),2,TRUE)),"沒有發現重複")`);
  obj清單.getRange('D5').setFormula(`=ARRAYFORMULA(IF(A5:A="","",HYPERLINK("#gid=${obj分頁.getSheetId()}&range=A"&A5:A,"前往第"&A5:A&"列")))`);
  obj清單.setFrozenRows(4);
  obj清單.setColumnWidth(1, 70);
  obj清單.setColumnWidth(2, 160);
  obj清單.setColumnWidth(3, 90);
  obj清單.setColumnWidth(4, 110);

  return `已設定姓名重複標示（第 ${str字母} 欄）與「${str清單名}」分頁`;
}


/**
 * ============================================================================
 * 函式名稱：清除重複標示_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：只移除本系統設的姓名重複標示；其他格式（含承辦人自己加的）不動。
 *       「重複檢查」分頁保留（只是即時公式，不影響資料）。
 * 參數：
 *   obj副本   {Spreadsheet} 副本
 * 傳回：{number} 移除的規則數
 * ============================================================================
 */
function 清除重複標示_(obj副本) {
  const obj分頁 = 取得副本分頁_(obj副本, obj法會副本分頁.有效資料);
  const arr全部 = obj分頁.getConditionalFormatRules();
  const arr保留 = arr全部.filter(function (obj規則) { return !是否為重複標示規則_(obj規則); });
  if (arr保留.length !== arr全部.length) obj分頁.setConditionalFormatRules(arr保留);
  return arr全部.length - arr保留.length;
}


/**
 * ============================================================================
 * 函式名稱：查詢重複_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：只查看不修改：列出「有效資料」中姓名重複的各組與列號（最多 300 組）。
 * 參數：
 *   obj副本   {Spreadsheet} 副本
 * 傳回：
 *   {Object} { str分頁名, str鍵欄名, int鍵欄（1 起算）, int資料列數, int空白筆數,
 *              arr重複組: [ { str姓名, arr列號 } ], int重複組數, int多出筆數, bool已截斷 }
 * ============================================================================
 */
function 查詢重複_(obj副本) {
  const obj資料 = 讀取有效資料_(obj副本);
  const arr組 = 分析重複群組_(obj資料.arr全部值, obj資料.int鍵索引, obj資料.int時間索引);

  // 姓名空白的列（有其他資料、但姓名沒填）
  let int空白 = 0;
  for (let i = 1; i < obj資料.arr全部值.length; i++) {
    const arr列 = obj資料.arr全部值[i];
    const bool有資料 = arr列.some(function (v) { return String(v == null ? '' : v).trim() !== ''; });
    if (bool有資料 && 正規化比對鍵_(arr列[obj資料.int鍵索引]) === '') int空白 += 1;
  }

  const int上限 = obj法會重複設定.int查詢顯示上限;
  return {
    str分頁名: obj資料.obj分頁.getName(),
    str鍵欄名: obj資料.arr標題[obj資料.int鍵索引],
    int鍵欄: obj資料.int鍵索引 + 1,
    int資料列數: Math.max(obj資料.arr全部值.length - 1, 0),
    int空白筆數: int空白,
    int重複組數: arr組.length,
    int多出筆數: arr組.reduce(function (n, o) { return n + o.arr移出索引.length; }, 0),
    bool已截斷: arr組.length > int上限,
    arr重複組: arr組.slice(0, int上限).map(function (o) {
      return { str姓名: o.str顯示鍵值, arr列號: o.arr全部索引.map(function (i) { return i + 1; }) };
    })
  };
}


/**
 * ============================================================================
 * 函式名稱：移除重複_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   每組姓名重複保留時間戳記最晚的一筆，其餘整列移至「無效資料」（呼叫者負責權限與活動作業鎖）。
 *     · 預覽：只回報會保留哪列、移出哪幾列，不改資料
 *     · 執行：先寫入無效資料（附無效原因、移入時間，保留數值格式），確認寫入後
 *       才由下往上刪除原列
 * 參數：
 *   obj副本       {Spreadsheet} 副本
 *   bool僅預覽    {boolean}     true＝只預覽
 * 傳回：
 *   {Object} { str訊息, str分頁名, int重複組數, int移出筆數,
 *              arr明細: [ { str鍵值, int保留列號, str保留時間, arr移出列號 } ] }
 * ============================================================================
 */
function 移除重複_(obj副本, bool僅預覽) {
  const obj資料 = 讀取有效資料_(obj副本);
  const str分頁名 = obj資料.obj分頁.getName();
  const str提醒 = obj資料.int時間索引 < 0 ? '（找不到時間戳記欄，改以列的先後判斷，保留最下方一筆）' : '';
  const arr組 = 分析重複群組_(obj資料.arr全部值, obj資料.int鍵索引, obj資料.int時間索引);

  const arr明細 = arr組.map(function (o) {
    return {
      str鍵值: o.str顯示鍵值,
      int保留列號: o.int保留索引 + 1,
      str保留時間: 格式化副本時間_(o.num保留時間),
      arr移出列號: o.arr移出索引.map(function (i) { return i + 1; })
    };
  });
  const arr待移出 = [];
  arr組.forEach(function (o) { Array.prototype.push.apply(arr待移出, o.arr移出索引); });
  const obj結果 = { str分頁名: str分頁名, int重複組數: arr組.length, int移出筆數: arr待移出.length, arr明細: arr明細 };

  if (arr待移出.length === 0) {
    obj結果.str訊息 = `檢查完成，「${str分頁名}」沒有發現姓名重複。${str提醒}`;
    return obj結果;
  }
  if (bool僅預覽) {
    obj結果.str訊息 = `【預覽】發現 ${arr組.length} 組姓名重複，將保留每組時間最晚的一筆，其餘 ${arr待移出.length} 筆移至「無效資料」（尚未移動）。${str提醒}`;
    return obj結果;
  }

  // 先寫入無效資料，確認後才刪除原列
  arr待移出.sort(function (a, b) { return a - b; });
  寫入無效資料_(obj副本, obj資料, arr待移出, arr組);
  SpreadsheetApp.flush();
  刪除副本列_由下往上_(obj資料.obj分頁, arr待移出);
  SpreadsheetApp.flush();

  obj結果.str訊息 = `整理完成：${arr組.length} 組姓名重複，已把 ${arr待移出.length} 筆較早的資料移至「無效資料」。需要時可從「無效資料」複製回來。${str提醒}`;
  return obj結果;
}


/**
 * ============================================================================
 * 函式名稱：格式化副本時間_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：毫秒轉「yyyy/MM/dd HH:mm:ss」；判讀不出時為「時間不明」。
 * 參數：
 *   num毫秒   {number}
 * 傳回：{string}
 * ============================================================================
 */
function 格式化副本時間_(num毫秒) {
  if (!isFinite(num毫秒)) return '時間不明';
  return 格式化日期(new Date(num毫秒), 'yyyy/MM/dd HH:mm:ss');
}


/**
 * ============================================================================
 * 函式名稱：建立欄位對應鍵_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：標題轉為「欄名#第幾次出現」，例如兩個「備註」欄成為 備註#1、備註#2，
 *       讓同名欄位也能正確對應。
 * 參數：
 *   arr標題   {string[]}
 * 傳回：{string[]}
 * ============================================================================
 */
function 建立欄位對應鍵_(arr標題) {
  const obj計數 = {};
  return arr標題.map(function (str欄名) {
    obj計數[str欄名] = (obj計數[str欄名] || 0) + 1;
    return `${str欄名}#${obj計數[str欄名]}`;
  });
}


/**
 * ============================================================================
 * 函式名稱：寫入無效資料_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   把待移出的列寫到「無效資料」最後，並附上「無效原因」「移入時間」：
 *     · 分頁不存在 → 建立，標題＝有效資料標題＋兩個附加欄
 *     · 分頁已存在 → 依欄名對應寫入（承辦人調整過欄位順序也不會錯位）；缺少的欄補在最右側
 *     · 同時複製數值格式，保留手機開頭的 0 與日期格式
 * 參數：
 *   obj副本       {Spreadsheet} 副本
 *   obj資料       {Object}      讀取有效資料_ 的結果
 *   arr待移出     {number[]}    陣列索引（已排序）
 *   arr組         {Object[]}    分析重複群組_ 的結果
 * 傳回：無
 * ============================================================================
 */
function 寫入無效資料_(obj副本, obj資料, arr待移出, arr組) {
  const str原因欄 = obj法會重複設定.str原因欄名;
  const str移入欄 = obj法會重複設定.str移入時間欄名;
  const arr全部格式 = obj資料.obj範圍.getNumberFormats();

  const obj無效 = obj副本.getSheetByName(obj法會副本分頁.無效資料) || obj副本.insertSheet(obj法會副本分頁.無效資料);
  const int現有欄 = obj無效.getLastColumn();
  const arr目的標題 = int現有欄 > 0
    ? obj無效.getRange(1, 1, 1, int現有欄).getValues()[0].map(function (v) { return String(v).trim(); })
    : [];

  // 補齊缺少的欄位（有效資料欄位＋兩個附加欄）
  const arr來源鍵 = 建立欄位對應鍵_(obj資料.arr標題);
  const arr目的鍵 = 建立欄位對應鍵_(arr目的標題);
  const arr應有標題 = obj資料.arr標題.concat([str原因欄, str移入欄]);
  建立欄位對應鍵_(arr應有標題).forEach(function (str鍵, i) {
    if (arr目的鍵.indexOf(str鍵) === -1) {
      arr目的標題.push(arr應有標題[i]);
      arr目的鍵.push(str鍵);
    }
  });
  if (arr目的標題.length > obj無效.getMaxColumns()) {
    obj無效.insertColumnsAfter(obj無效.getMaxColumns(), arr目的標題.length - obj無效.getMaxColumns());
  }
  obj無效.getRange(1, 1, 1, arr目的標題.length).setValues([arr目的標題]).setFontWeight('bold');
  obj無效.setFrozenRows(1);

  // 每一列的無效原因
  const obj原因 = {};
  arr組.forEach(function (o) {
    const str原因 = `姓名重複，保留第 ${o.int保留索引 + 1} 列（${格式化副本時間_(o.num保留時間)}）的資料`;
    o.arr移出索引.forEach(function (i) { obj原因[i] = str原因; });
  });

  // 依目的標題組出值與格式
  const dat現在 = new Date();
  const arr值 = [];
  const arr格式 = [];
  arr待移出.forEach(function (int來源) {
    const arr值列 = [];
    const arr格式列 = [];
    arr目的鍵.forEach(function (str鍵) {
      const int來源欄 = arr來源鍵.indexOf(str鍵);
      if (int來源欄 >= 0) {
        arr值列.push(obj資料.arr全部值[int來源][int來源欄]);
        arr格式列.push(arr全部格式[int來源][int來源欄]);
      } else if (str鍵 === `${str原因欄}#1`) {
        arr值列.push(obj原因[int來源] || '姓名重複');
        arr格式列.push('@');
      } else if (str鍵 === `${str移入欄}#1`) {
        arr值列.push(dat現在);
        arr格式列.push('yyyy/MM/dd HH:mm:ss');
      } else {
        arr值列.push('');
        arr格式列.push('General');
      }
    });
    arr值.push(arr值列);
    arr格式.push(arr格式列);
  });

  // 一次寫入（先格式後值）
  const int起始列 = Math.max(obj無效.getLastRow(), 1) + 1;
  const int需要列 = int起始列 + arr值.length - 1;
  if (int需要列 > obj無效.getMaxRows()) obj無效.insertRowsAfter(obj無效.getMaxRows(), int需要列 - obj無效.getMaxRows());
  const obj範圍 = obj無效.getRange(int起始列, 1, arr值.length, arr目的標題.length);
  obj範圍.setNumberFormats(arr格式);
  obj範圍.setValues(arr值);
}


/**
 * ============================================================================
 * 函式名稱：刪除副本列_由下往上_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：把陣列索引轉成列號，由下往上刪除；連續的列合併成一次刪除，速度較快。
 * 參數：
 *   obj分頁     {Sheet}    副本分頁
 *   arr索引     {number[]} 陣列索引（0＝標題列）
 * 傳回：無
 * ============================================================================
 */
function 刪除副本列_由下往上_(obj分頁, arr索引) {
  const arr列號 = arr索引.map(function (i) { return i + 1; }).sort(function (a, b) { return b - a; });
  let int底 = arr列號[0];
  let int頂 = arr列號[0];
  for (let i = 1; i <= arr列號.length; i++) {
    const int下一列 = arr列號[i];
    if (int下一列 === int頂 - 1) {
      int頂 = int下一列;   // 連續，擴大區段
    } else {
      obj分頁.deleteRows(int頂, int底 - int頂 + 1);
      int底 = int下一列;
      int頂 = int下一列;
    }
  }
}


/**
 * ============================================================================
 * 函式名稱：取得可整理活動_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：網頁三個重複動作共用的前置：找活動、檢查整理權限、活動未結束、開啟副本。
 * 參數：
 *   obj工作階段   {Object} 工作階段
 *   obj參數       {Object} { str活動ID }
 *   str作業名稱   {string} 給使用者看的動作名稱
 * 傳回：{Object} { obj活動值, obj副本 }
 * ============================================================================
 */
function 取得可整理活動_(obj工作階段, obj參數, str作業名稱) {
  檢查必要參數(obj參數, ['str活動ID'], str作業名稱);
  const obj主控台 = 開啟法會主控台_(obj工作階段.str精舍代號);
  const obj活動值 = 取得法會活動_(obj主控台, obj參數.str活動ID).obj值;
  檢查活動權限_(obj工作階段, obj活動值, obj法會權限.整理資料, str作業名稱);
  檢查活動狀態_(obj活動值, arr法會副本可整理狀態, str作業名稱);
  return { obj活動值: obj活動值, obj副本: 開啟活動副本_(obj活動值) };
}


/**
 * ============================================================================
 * 函式名稱：設定法會重複標示
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：action「event.設定重複標示」。替副本（重新）設定姓名重複標示與「重複檢查」分頁。
 * 參數：
 *   obj工作階段   {Object} 工作階段
 *   obj參數       {Object} { str活動ID }
 * 傳回：{Object} { bool成功, str訊息 }
 * ============================================================================
 */
function 設定法會重複標示(obj工作階段, obj參數) {
  const obj = 取得可整理活動_(obj工作階段, obj參數, '設定重複標示');
  const str說明 = 套用重複標示_(obj.obj副本);
  return { bool成功: true, str訊息: `「${obj.obj活動值['活動名稱']}」${str說明}。開啟副本即可看到淡橘色標示。` };
}


/**
 * ============================================================================
 * 函式名稱：查詢法會重複
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：action「event.查詢重複」。列出姓名重複的各組與列號（只查看）。
 * 參數：
 *   obj工作階段   {Object} 工作階段
 *   obj參數       {Object} { str活動ID }
 * 傳回：{Object} { bool成功, …查詢重複_ 的結果 }
 * ============================================================================
 */
function 查詢法會重複(obj工作階段, obj參數) {
  const obj = 取得可整理活動_(obj工作階段, obj參數, '查詢重複');
  return Object.assign({ bool成功: true }, 查詢重複_(obj.obj副本));
}


/**
 * ============================================================================
 * 函式名稱：移除法會重複
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   action「event.移除重複」。畫面先以 bool僅預覽＝true 顯示將移出的列，
 *   使用者確認後再以 false 執行（執行時以最新資料重新計算）。
 * 參數：
 *   obj工作階段   {Object} 工作階段
 *   obj參數       {Object} { str活動ID, bool僅預覽 }
 * 傳回：{Object} { bool成功, …移除重複_ 的結果 }
 * ============================================================================
 */
function 移除法會重複(obj工作階段, obj參數) {
  const obj = 取得可整理活動_(obj工作階段, obj參數, '移除重複');
  const bool僅預覽 = obj參數.bool僅預覽 !== false;   // 沒有明確說「不是預覽」就只預覽，避免誤刪
  const obj結果 = bool僅預覽
    ? 移除重複_(obj.obj副本, true)
    : 以活動作業鎖執行_(obj工作階段.str精舍代號, obj.obj活動值['活動ID'], '移除重複', function () {
      return 移除重複_(obj.obj副本, false);
    });
  if (!bool僅預覽 && obj結果.int移出筆數 > 0) {
    寫入操作日誌(obj工作階段, '移除法會重複', `${obj.obj活動值['活動ID']}：移出 ${obj結果.int移出筆數} 筆`);
  }
  return Object.assign({ bool成功: true }, obj結果);
}
