// ============================================================================
// 檔案名稱：核心_報表產生器.gs
// 所屬層級：平台核心／共用元件（各模組的整理副本共用）
// 檔案版本：v1.0.0（2026-11-04）
// 用途說明：
//   整理副本裡的「報表產生器」選單的後端（2026-10-30／11-04 定案：平台執行、選單＋儲存格下拉、不用面板）。
//   副本中的「報表分頁」版面：
//     第 1 列   來源分頁｜條件關係｜排序 1～3（欄位＋遞增／遞減）            ← 設定區（列印時隱藏）
//     第 2～3 列 條件 1～6（欄位｜比較｜值）                                  ← 設定區（列印時隱藏）
//     第 4 列   報表名稱（合併置中、標楷體 24）
//     第 5 列   人數
//     第 6 列   序號＋欄位標題（「來源欄 → 顯示名稱」可改名；來源找不到的標題＝空白欄，例如「簽到」）
//     第 7 列起 報表資料
//   設定區每一格都是下拉選單（欄名、比較方式、實際出現過的值），承辦人點選即可。
//   版面與「報表.gs V5.6」相同，所以副本原有的「列印報表」「下載列印用 PDF」可以直接使用。
//
//   動作（action，皆不需網頁登入，以使用者本人的 Google 存取權杖驗證）：
//     report.新增分頁、report.產生、report.重新產生全部、report.存成範本、report.套用範本、report.更新下拉
//   權限：這份副本所屬精舍的精舍管理員，或副本清單中被指派的人員（承辦人）。
//   副本必須是平台建立的（副本清單有登記）；模組不限，法會活動以外的副本也能使用。
//
//   報表分頁以開發人員中繼資料「報表產生器」標記；產生報表只寫入有標記的分頁，資料分頁永遠不會被改動。
//   報表範本存在副本的隱藏分頁「報表範本」（範本名稱｜設定 JSON｜建立者｜更新時間）。
//
//   ※ 本檔頂層常數自給自足，不引用其他檔案的常數（GAS 依檔名順序載入）。
//
// 相依檔案：核心_錯誤、核心_工具、核心_試算表存取、核心_副本管理、核心_驗證、核心_日誌
// ============================================================================


// ----------------------------------------------------------------------------
// 甲、設定
// ----------------------------------------------------------------------------
const obj報表產生器設定 = Object.freeze({
  str中繼鍵: '報表產生器',            // 報表分頁的開發人員中繼資料鍵
  str範本分頁: '報表範本',            // 隱藏分頁
  arr範本欄位: ['範本名稱', '設定', '建立者', '更新時間'],
  str預設來源: '有效資料',
  str分頁名前綴: '報表',
  // 不列入「來源分頁」下拉的分頁
  arr非來源分頁: ['說明', '報表範本', '重複檢查', '點名欄位設定', '領隊代號'],
  int條件數: 6,
  int每列條件數: 3,
  int排序數: 3,
  int標題列: 6,
  int資料起始列: 7,
  int預留欄位數: 20,                 // 第 6 列預先設定下拉的欄數（B 欄起）
  int候選值上限: 300,
  str字型: '標楷體',
  int主標題字級: 24,
  int內文字級: 14,
  str設定底色: '#FFFBEA',
  str標籤色: '#5F6368',
  str空白欄底色: '#EEEEEE',
  str備註前綴: '來源欄：',
  str空白欄備註: '空白欄（來源沒有這個欄位，報表中留空，例如簽到、備註）',
  arr比較方式: ['等於', '不等於', '包含', '不包含', '開頭是', '空白', '有填', '大於', '大於等於', '小於', '小於等於', '介於', 'Excel寫法'],
  arr不需要值: ['空白', '有填'],
  arr條件關係: ['全部符合', '任一符合'],
  arr排序方向: ['遞增', '遞減'],
  str標籤_來源: '來源分頁',
  str標籤_關係: '條件關係'
});


// ============================================================================
// 乙、版面位置（全部由這裡計算，其他函式不直接寫死欄號）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_條件位置_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：第 i 個條件（0 起算）在設定區的位置：第 2、3 列，每列 3 個，每個佔 4 欄（標籤｜欄位｜比較｜值）。
 * 參數：int序 {number} 0～5
 * 傳回：{Object} { int列, int標籤欄, int欄位欄, int比較欄, int值欄 }
 * ============================================================================
 */
function 報表_條件位置_(int序) {
  const cfg = obj報表產生器設定;
  const int列 = 2 + Math.floor(int序 / cfg.int每列條件數);
  const int起欄 = 1 + (int序 % cfg.int每列條件數) * 4;
  return { int列: int列, int標籤欄: int起欄, int欄位欄: int起欄 + 1, int比較欄: int起欄 + 2, int值欄: int起欄 + 3 };
}


/**
 * ============================================================================
 * 函式名稱：報表_排序位置_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：第 j 個排序（0 起算）在第 1 列的位置：E 欄起每個佔 3 欄（標籤｜欄位｜方向）。
 * 參數：int序 {number} 0～2
 * 傳回：{Object} { int標籤欄, int欄位欄, int方向欄 }
 * ============================================================================
 */
function 報表_排序位置_(int序) {
  const int起欄 = 5 + int序 * 3;
  return { int標籤欄: int起欄, int欄位欄: int起欄 + 1, int方向欄: int起欄 + 2 };
}


/**
 * ============================================================================
 * 函式名稱：報表_設定區欄數_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：設定區用到的最右欄（排序 3 的方向欄＝M 欄＝13；條件佔到 L 欄＝12）。
 * 參數：無
 * 傳回：{number}
 * ============================================================================
 */
function 報表_設定區欄數_() {
  return Math.max(報表_排序位置_(obj報表產生器設定.int排序數 - 1).int方向欄,
    報表_條件位置_(obj報表產生器設定.int每列條件數 - 1).int值欄);
}


// ============================================================================
// 丙、純計算：標題、條件、排序（不碰檔案，可單獨測試）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_解析標題_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：
 *   第 6 列一格的意思：
 *     · 「護七_組別 → 組別」（也可用 > ＞ ->）：來源欄「護七_組別」，報表顯示「組別」
 *     · 已產生過的標題：備註「來源欄：護七_組別」記著來源，格子顯示「組別」
 *     · 其他：格子文字就是來源欄名，也是顯示名稱
 *   來源欄在來源分頁找不到 → 空白欄（例如「簽到」），由呼叫端判斷。
 * 參數：
 *   str文字   {string} 格子內容
 *   str備註   {string} 格子的備註
 * 傳回：{Object|null} { str來源欄, str顯示名稱 }；格子空白時為 null
 * ============================================================================
 */
function 報表_解析標題_(str文字, str備註) {
  const str格 = String(str文字 == null ? '' : str文字).trim();
  if (str格 === '') return null;
  const arr箭頭 = str格.split(/\s*(?:→|->|＞|>)\s*/);
  if (arr箭頭.length >= 2 && arr箭頭[0] !== '' && arr箭頭[arr箭頭.length - 1] !== '') {
    return { str來源欄: arr箭頭[0], str顯示名稱: arr箭頭[arr箭頭.length - 1] };
  }
  const str註 = String(str備註 == null ? '' : str備註).trim();
  const str前綴 = obj報表產生器設定.str備註前綴;
  if (str註.indexOf(str前綴) === 0 && str註.length > str前綴.length) {
    return { str來源欄: str註.substring(str前綴.length).trim(), str顯示名稱: str格 };
  }
  return { str來源欄: str格, str顯示名稱: str格 };
}


/**
 * ============================================================================
 * 函式名稱：報表_是日期_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：是否為有效日期物件（試算表的日期儲存格）。
 * 參數：any值 {*}
 * 傳回：{boolean}
 * ============================================================================
 */
function 報表_是日期_(any值) {
  return Object.prototype.toString.call(any值) === '[object Date]' && !isNaN(any值.getTime());
}


/**
 * ============================================================================
 * 函式名稱：報表_轉數字_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：數字儲存格直接用；看起來像數字的文字（可含千分位逗號）也轉成數字；其他傳回 null。
 * 參數：any值 {*}
 * 傳回：{number|null}
 * ============================================================================
 */
function 報表_轉數字_(any值) {
  if (typeof any值 === 'number' && !isNaN(any值)) return any值;
  if (typeof any值 !== 'string') return null;
  const str = any值.replace(/,/g, '').trim();
  return (str !== '' && !isNaN(Number(str))) ? Number(str) : null;
}


/**
 * ============================================================================
 * 函式名稱：報表_解析日期文字_（內部使用）
 * 版本：v1.0.0（2026-11-04）（沿用報表.gs V5.6 的規則）
 * ----------------------------------------------------------------------------
 * 用途：日期文字轉成毫秒：2026/11/1、2026-11-01、2026.11.1、2026年11月1日、11/1（年份取今年），
 *       可再接時間 8:30 或 8:30:00。不存在的日期（2/30）傳回 null。
 * 參數：str文字 {string}
 * 傳回：{number|null}
 * ============================================================================
 */
function 報表_解析日期文字_(str文字) {
  const arr = String(str文字).trim().match(
    /^(?:(\d{4})\s*[\/\-.年]\s*)?(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})\s*日?(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!arr) return null;
  const int年 = arr[1] ? Number(arr[1]) : new Date().getFullYear();
  const int月 = Number(arr[2]);
  const int日 = Number(arr[3]);
  const int時 = arr[4] ? Number(arr[4]) : 0;
  const int分 = arr[5] ? Number(arr[5]) : 0;
  const int秒 = arr[6] ? Number(arr[6]) : 0;
  const dat = new Date(int年, int月 - 1, int日, int時, int分, int秒);
  if (dat.getFullYear() !== int年 || dat.getMonth() !== int月 - 1 || dat.getDate() !== int日
    || int時 > 23 || int分 > 59 || int秒 > 59) return null;
  return dat.getTime();
}


/**
 * ============================================================================
 * 函式名稱：報表_萬用字元規則_（內部使用）
 * 版本：v1.0.0（2026-11-04）（沿用報表.gs V5.6）
 * ----------------------------------------------------------------------------
 * 用途：Excel 萬用字元轉正規表示式：* 任意字、? 單一字、~* ~? ~~ 為字面字元；整段比對、不分大小寫。
 * 參數：str樣式 {string}
 * 傳回：{RegExp}
 * ============================================================================
 */
function 報表_萬用字元規則_(str樣式) {
  let str規則 = '';
  const fn跳脫 = function (s) { return s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); };
  for (let i = 0; i < str樣式.length; i++) {
    const s = str樣式[i];
    const s下 = str樣式[i + 1];
    if (s === '~' && (s下 === '*' || s下 === '?' || s下 === '~')) { str規則 += fn跳脫(s下); i++; continue; }
    if (s === '*') str規則 += '[\\s\\S]*';
    else if (s === '?') str規則 += '[\\s\\S]';
    else str規則 += fn跳脫(s);
  }
  return new RegExp('^' + str規則 + '$', 'i');
}


/**
 * ============================================================================
 * 函式名稱：報表_比較結果_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：差值（儲存格 − 條件）依運算子判斷。
 * 參數：num差 {number}；str運算子 {string} = <> > < >= <=
 * 傳回：{boolean}
 * ============================================================================
 */
function 報表_比較結果_(num差, str運算子) {
  const bool相等 = Math.abs(num差) < 1e-9;
  switch (str運算子) {
    case '=': return bool相等;
    case '<>': return !bool相等;
    case '>': return !bool相等 && num差 > 0;
    case '<': return !bool相等 && num差 < 0;
    case '>=': return bool相等 || num差 > 0;
    case '<=': return bool相等 || num差 < 0;
    default: return false;
  }
}


/**
 * ============================================================================
 * 函式名稱：報表_解析Excel條件_（內部使用）
 * 版本：v1.0.0（2026-11-04）（沿用報表.gs V5.6 的 解析條件_）
 * ----------------------------------------------------------------------------
 * 用途：「Excel寫法」的條件值：可寫 >=5、<>自行、=、<>、*蓮*、2026/11/1 等，規則同 Excel 進階篩選。
 *       沒寫運算子時視為「=」；文字條件沒寫運算子時是「開頭符合」。
 * 參數：str條件 {string}
 * 傳回：{Object} { str類型: 全部|空白|有填|無效|數字|日期|文字, str運算子, num值, re規則, str文字 }
 * ============================================================================
 */
function 報表_解析Excel條件_(str條件) {
  const str = String(str條件 == null ? '' : str條件).trim();
  if (str === '') return { str類型: '全部' };
  const arr = str.match(/^(>=|<=|<>|>|<|=)([\s\S]*)$/);
  const bool無運算子 = !arr;
  const str運算子 = bool無運算子 ? '=' : arr[1];
  const str值 = bool無運算子 ? str : arr[2].trim();
  if (!bool無運算子 && str值 === '') {
    if (str運算子 === '=') return { str類型: '空白' };
    if (str運算子 === '<>') return { str類型: '有填' };
    return { str類型: '無效' };
  }
  const num = 報表_轉數字_(str值);
  if (num !== null) return { str類型: '數字', str運算子: str運算子, num值: num };
  const num日期 = 報表_解析日期文字_(str值);
  if (num日期 !== null) return { str類型: '日期', str運算子: str運算子, num值: num日期 };
  return { str類型: '文字', str運算子: str運算子, re規則: 報表_萬用字元規則_(bool無運算子 ? str值 + '*' : str值), str文字: str值 };
}


/**
 * ============================================================================
 * 函式名稱：報表_符合Excel條件_（內部使用）
 * 版本：v1.0.0（2026-11-04）（沿用報表.gs V5.6 的 判斷符合條件_）
 * ----------------------------------------------------------------------------
 * 用途：一格是否符合已解析的 Excel 條件。數字條件只比數字格、日期條件只比日期格；
 *       「<>」時類型不同或空白都算不等於。
 * 參數：any原值 {*}；str顯示值 {string}；obj條件 {Object}
 * 傳回：{boolean}
 * ============================================================================
 */
function 報表_符合Excel條件_(any原值, str顯示值, obj條件) {
  const str值 = String(str顯示值 == null ? '' : str顯示值).trim();
  switch (obj條件.str類型) {
    case '全部': return true;
    case '空白': return str值 === '';
    case '有填': return str值 !== '';
    case '數字': {
      const num = 報表_轉數字_(any原值);
      if (num === null) return obj條件.str運算子 === '<>';
      return 報表_比較結果_(num - obj條件.num值, obj條件.str運算子);
    }
    case '日期': {
      const num = 報表_是日期_(any原值) ? any原值.getTime() : (typeof any原值 === 'string' ? 報表_解析日期文字_(any原值) : null);
      if (num === null) return obj條件.str運算子 === '<>';
      return 報表_比較結果_(num - obj條件.num值, obj條件.str運算子);
    }
    case '文字': {
      if (obj條件.str運算子 === '=') return obj條件.re規則.test(str值);
      if (obj條件.str運算子 === '<>') return !obj條件.re規則.test(str值);
      if (str值 === '' || 報表_轉數字_(any原值) !== null || 報表_是日期_(any原值)) return false;
      return 報表_比較結果_(str值.localeCompare(obj條件.str文字, 'zh-Hant'), obj條件.str運算子);
    }
    default: return false;
  }
}


/**
 * ============================================================================
 * 函式名稱：報表_條件值轉日期_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：比較日期格時，把條件值轉成「當天 0 點」的毫秒；沒寫年份時用該格的年份。
 * 參數：str值 {string}；dat格 {Date}
 * 傳回：{number|null}
 * ============================================================================
 */
function 報表_條件值轉日期_(str值, dat格) {
  const str = String(str值).trim();
  let num = 報表_解析日期文字_(str);
  if (num === null) return null;
  if (!/^\d{4}/.test(str)) {   // 沒寫年份：改用該格的年份
    const dat = new Date(num);
    num = new Date(dat格.getFullYear(), dat.getMonth(), dat.getDate(), dat.getHours(), dat.getMinutes(), dat.getSeconds()).getTime();
  }
  return num;
}


/**
 * ============================================================================
 * 函式名稱：報表_比較大小_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：一格與條件值比大小，傳回差值的正負：數字格（或像數字的文字）比數值、日期格比日期（只比到日）、
 *       其餘傳回 null（不比較，視為不符合）。
 * 參數：any原值 {*}；str值 {string}
 * 傳回：{number|null}
 * ============================================================================
 */
function 報表_比較大小_(any原值, str值) {
  if (報表_是日期_(any原值)) {
    const num條件 = 報表_條件值轉日期_(str值, any原值);
    if (num條件 === null) return null;
    const dat格日 = new Date(any原值.getFullYear(), any原值.getMonth(), any原值.getDate()).getTime();
    const dat條件 = new Date(num條件);
    return dat格日 - new Date(dat條件.getFullYear(), dat條件.getMonth(), dat條件.getDate()).getTime();
  }
  const num格 = 報表_轉數字_(any原值);
  const num條件 = 報表_轉數字_(String(str值));
  if (num格 === null || num條件 === null) return null;
  return num格 - num條件;
}


/**
 * ============================================================================
 * 函式名稱：報表_相等_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：「等於」的判斷：數字比數值、日期比到日；其餘比畫面文字（去頭尾空白、不分大小寫）。
 * 參數：any原值 {*}；str顯示值 {string}；str值 {string}
 * 傳回：{boolean}
 * ============================================================================
 */
function 報表_相等_(any原值, str顯示值, str值) {
  const num差 = 報表_比較大小_(any原值, str值);
  if (num差 !== null) return Math.abs(num差) < 1e-9;
  return String(str顯示值).trim().toLowerCase() === String(str值).trim().toLowerCase();
}


/**
 * ============================================================================
 * 函式名稱：報表_符合條件_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：一格是否符合一個條件（下拉選的比較方式）。
 *   等於／不等於、包含／不包含、開頭是（不分大小寫）、空白／有填、
 *   大於／大於等於／小於／小於等於（數字、日期才比較）、介於（「a~b」「a～b」「a至b」，含頭尾）、
 *   Excel寫法（值照 Excel 進階篩選寫法）。
 * 參數：
 *   any原值     {*}      getValues 的值
 *   str顯示值   {string} getDisplayValues 的文字
 *   obj條件     {Object} { str比較, str值, obj預解析（Excel寫法用，可省略） }
 * 傳回：{boolean}
 * ============================================================================
 */
function 報表_符合條件_(any原值, str顯示值, obj條件) {
  const str顯示 = String(str顯示值 == null ? '' : str顯示值).trim();
  const str值 = String(obj條件.str值 == null ? '' : obj條件.str值).trim();
  const str小顯示 = str顯示.toLowerCase();
  const str小值 = str值.toLowerCase();
  switch (obj條件.str比較) {
    case '空白': return str顯示 === '';
    case '有填': return str顯示 !== '';
    case '等於': return 報表_相等_(any原值, str顯示, str值);
    case '不等於': return !報表_相等_(any原值, str顯示, str值);
    case '包含': return str小顯示.indexOf(str小值) !== -1;
    case '不包含': return str小顯示.indexOf(str小值) === -1;
    case '開頭是': return str小顯示.indexOf(str小值) === 0;
    case '大於': case '大於等於': case '小於': case '小於等於': {
      const num差 = 報表_比較大小_(any原值, str值);
      if (num差 === null) return false;
      const str運算子 = { 大於: '>', 大於等於: '>=', 小於: '<', 小於等於: '<=' }[obj條件.str比較];
      return 報表_比較結果_(num差, str運算子);
    }
    case '介於': {
      const arr = str值.split(/\s*(?:~|～|至)\s*/);
      if (arr.length !== 2 || arr[0] === '' || arr[1] === '') return false;
      const num下 = 報表_比較大小_(any原值, arr[0]);
      const num上 = 報表_比較大小_(any原值, arr[1]);
      return num下 !== null && num上 !== null && 報表_比較結果_(num下, '>=') && 報表_比較結果_(num上, '<=');
    }
    case 'Excel寫法':
      return 報表_符合Excel條件_(any原值, str顯示, obj條件.obj預解析 || 報表_解析Excel條件_(str值));
    default: return false;
  }
}


/**
 * ============================================================================
 * 函式名稱：報表_排序比較_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：兩格排序：空白一律排最後；兩邊都是數字比數值、都是日期比時間，其餘比文字（中文依筆畫）。
 * 參數：any甲 {*}；str甲 {string}；any乙 {*}；str乙 {string}；bool遞減 {boolean}
 * 傳回：{number}
 * ============================================================================
 */
function 報表_排序比較_(any甲, str甲, any乙, str乙, bool遞減) {
  const s甲 = String(str甲 == null ? '' : str甲).trim();
  const s乙 = String(str乙 == null ? '' : str乙).trim();
  if (s甲 === '' && s乙 === '') return 0;
  if (s甲 === '') return 1;           // 空白排最後（不論遞增或遞減）
  if (s乙 === '') return -1;
  let int結果;
  const num甲 = 報表_轉數字_(any甲);
  const num乙 = 報表_轉數字_(any乙);
  if (報表_是日期_(any甲) && 報表_是日期_(any乙)) int結果 = any甲.getTime() - any乙.getTime();
  else if (num甲 !== null && num乙 !== null) int結果 = num甲 - num乙;
  else {
    try { int結果 = s甲.localeCompare(s乙, 'zh-Hant-TW-u-co-stroke'); } catch (err) { int結果 = s甲 < s乙 ? -1 : (s甲 > s乙 ? 1 : 0); }
  }
  return bool遞減 ? -int結果 : int結果;
}


/**
 * ============================================================================
 * 函式名稱：報表_篩選排序_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：
 *   依設定從來源資料挑出符合的列、排序，並依報表欄位取出要顯示的文字。
 *   欄位名稱都已由呼叫端換成來源欄索引（找不到的條件與排序欄在呼叫端就已報錯）。
 * 參數：
 *   obj來源   {Object} { arr原值: Array[], arr顯示: string[][] }（不含標題列）
 *   obj計畫   {Object} { bool任一, arr條件: [{ int欄, str比較, str值, obj預解析 }],
 *                         arr排序: [{ int欄, bool遞減 }], arr輸出欄: [int欄｜-1 空白欄] }
 * 傳回：{string[][]} 每列為報表 B 欄起的文字
 * ============================================================================
 */
function 報表_篩選排序_(obj來源, obj計畫) {
  const arr索引 = [];
  obj來源.arr顯示.forEach(function (arr列, i) {
    // 整列空白（表單刪除後留下的空列）略過
    if (arr列.every(function (s) { return String(s).trim() === ''; })) return;
    if (obj計畫.arr條件.length > 0) {
      const fn符合 = function (o) { return 報表_符合條件_(obj來源.arr原值[i][o.int欄], arr列[o.int欄], o); };
      const bool = obj計畫.bool任一 ? obj計畫.arr條件.some(fn符合) : obj計畫.arr條件.every(fn符合);
      if (!bool) return;
    }
    arr索引.push(i);
  });

  if (obj計畫.arr排序.length > 0) {
    arr索引.sort(function (a, b) {
      for (let k = 0; k < obj計畫.arr排序.length; k++) {
        const o = obj計畫.arr排序[k];
        const int = 報表_排序比較_(obj來源.arr原值[a][o.int欄], obj來源.arr顯示[a][o.int欄],
          obj來源.arr原值[b][o.int欄], obj來源.arr顯示[b][o.int欄], o.bool遞減);
        if (int !== 0) return int;
      }
      return a - b;   // 相同時維持原本順序
    });
  }

  return arr索引.map(function (i) {
    return obj計畫.arr輸出欄.map(function (int欄) { return int欄 < 0 ? '' : String(obj來源.arr顯示[i][int欄]); });
  });
}


// ============================================================================
// 丁、讀取來源與報表分頁
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_讀取來源_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：讀來源分頁：第 1 列標題（去頭尾空白，同名只取第一個），第 2 列起原值與顯示文字。
 * 參數：obj副本 {Spreadsheet}；str來源 {string}
 * 傳回：{Object} { arr標題, obj欄索引: { 欄名: 索引 }, arr原值, arr顯示 }
 * ============================================================================
 */
function 報表_讀取來源_(obj副本, str來源) {
  const obj分頁 = obj副本.getSheetByName(str來源);
  if (!obj分頁) {
    throw new 平台錯誤(obj錯誤代碼.工作表不存在, `找不到來源分頁「${str來源}」，請在報表第 1 列的「來源分頁」重新選擇。`);
  }
  const int末列 = obj分頁.getLastRow();
  const int末欄 = obj分頁.getLastColumn();
  if (int末列 < 1 || int末欄 < 1) {
    throw new 平台錯誤(obj錯誤代碼.欄位缺漏, `來源分頁「${str來源}」是空白的，沒有標題列可以使用。`);
  }
  const obj範圍 = obj分頁.getRange(1, 1, int末列, int末欄);
  const arr原值 = obj範圍.getValues();
  const arr顯示 = obj範圍.getDisplayValues();
  const arr標題 = arr顯示[0].map(function (s) { return String(s).trim(); });
  const obj欄索引 = {};
  arr標題.forEach(function (s, i) { if (s !== '' && !(s in obj欄索引)) obj欄索引[s] = i; });
  return { arr標題: arr標題, obj欄索引: obj欄索引, arr原值: arr原值.slice(1), arr顯示: arr顯示.slice(1) };
}


/**
 * ============================================================================
 * 函式名稱：報表_是報表分頁_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：分頁是否有「報表產生器」標記（只有這種分頁會被寫入）。
 * 參數：obj分頁 {Sheet}
 * 傳回：{boolean}
 * ============================================================================
 */
function 報表_是報表分頁_(obj分頁) {
  return obj分頁.createDeveloperMetadataFinder().withKey(obj報表產生器設定.str中繼鍵).find()
    .some(function (o) { return String(o.getLocation().getLocationType()) === 'SHEET'; });
}


/**
 * ============================================================================
 * 函式名稱：報表_取得報表分頁_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：依分頁 ID 找出報表分頁；不是報表分頁時白話說明。
 * 參數：obj副本 {Spreadsheet}；any分頁ID {number|string}
 * 傳回：{Sheet}
 * ============================================================================
 */
function 報表_取得報表分頁_(obj副本, any分頁ID) {
  const int = Number(any分頁ID);
  const obj分頁 = obj副本.getSheets().filter(function (o) { return o.getSheetId() === int; })[0];
  if (!obj分頁) {
    throw new 平台錯誤(obj錯誤代碼.工作表不存在, '找不到目前的分頁，可能剛被刪除或改名，請重新整理試算表後再試。');
  }
  if (!報表_是報表分頁_(obj分頁)) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤,
      `「${obj分頁.getName()}」不是報表分頁。請切換到報表分頁，或先用「報表產生器 → 新增報表分頁」建立一張。`);
  }
  return obj分頁;
}


/**
 * ============================================================================
 * 函式名稱：報表_列出報表分頁_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：副本中所有報表分頁（依分頁順序）。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{Sheet[]}
 * ============================================================================
 */
function 報表_列出報表分頁_(obj副本) {
  return obj副本.getSheets().filter(報表_是報表分頁_);
}


/**
 * ============================================================================
 * 函式名稱：報表_讀取設定_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：讀報表分頁的設定區與第 6 列，整理成設定物件（範本也用這個格式）。
 * 參數：obj分頁 {Sheet}
 * 傳回：{Object} { v, str來源分頁, str條件關係, arr條件: [{ str欄位, str比較, str值, int序 }],
 *                  arr排序: [{ str欄位, bool遞減 }], arr欄位: [{ str來源欄, str顯示名稱 }], str報表名稱 }
 * ============================================================================
 */
function 報表_讀取設定_(obj分頁) {
  const cfg = obj報表產生器設定;
  const int欄數 = Math.max(obj分頁.getLastColumn(), 報表_設定區欄數_(), 2);
  const arr設定 = obj分頁.getRange(1, 1, 4, int欄數).getDisplayValues();
  const fn取 = function (int列, int欄) { return String((arr設定[int列 - 1] || [])[int欄 - 1] || '').trim(); };

  const arr條件 = [];
  for (let i = 0; i < cfg.int條件數; i++) {
    const p = 報表_條件位置_(i);
    const str欄位 = fn取(p.int列, p.int欄位欄);
    if (str欄位 === '' || /^（.*）$/.test(str欄位)) continue;
    arr條件.push({ int序: i + 1, str欄位: str欄位, str比較: fn取(p.int列, p.int比較欄), str值: fn取(p.int列, p.int值欄) });
  }
  const arr排序 = [];
  for (let j = 0; j < cfg.int排序數; j++) {
    const p = 報表_排序位置_(j);
    const str欄位 = fn取(1, p.int欄位欄);
    if (str欄位 === '' || /^（.*）$/.test(str欄位)) continue;
    arr排序.push({ str欄位: str欄位, bool遞減: fn取(1, p.int方向欄) === '遞減' });
  }

  // 第 6 列：B 欄起，遇到空白格停止
  const arr欄位 = [];
  const int末欄 = obj分頁.getLastColumn();
  if (int末欄 >= 2) {
    const obj標題範圍 = obj分頁.getRange(cfg.int標題列, 2, 1, int末欄 - 1);
    const arr文字 = obj標題範圍.getDisplayValues()[0];
    const arr備註 = obj標題範圍.getNotes()[0];
    for (let k = 0; k < arr文字.length; k++) {
      const obj = 報表_解析標題_(arr文字[k], arr備註[k]);
      if (!obj) break;
      arr欄位.push(obj);
    }
  }

  return {
    v: 1,
    str來源分頁: fn取(1, 2) || cfg.str預設來源,
    str條件關係: fn取(1, 4) === '任一符合' ? '任一符合' : '全部符合',
    arr條件: arr條件,
    arr排序: arr排序,
    arr欄位: arr欄位,
    str報表名稱: fn取(4, 1)
  };
}


// ============================================================================
// 戊、版面與下拉選單
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_清單驗證_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：建立下拉清單的資料驗證；清單空白時傳回 null（呼叫端清除驗證）。
 * 參數：arr清單 {string[]}；bool允許其他 {boolean} true＝也可以自己輸入
 * 傳回：{DataValidation|null}
 * ============================================================================
 */
function 報表_清單驗證_(arr清單, bool允許其他) {
  const arr = (arr清單 || []).filter(function (s) { return String(s).trim() !== ''; }).slice(0, 500);
  if (arr.length === 0) return null;
  return SpreadsheetApp.newDataValidation().requireValueInList(arr, true).setAllowInvalid(!!bool允許其他).build();
}


/**
 * ============================================================================
 * 函式名稱：報表_套用驗證_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：在一格套用（或清除）下拉清單。
 * 參數：obj格 {Range}；obj驗證 {DataValidation|null}
 * 傳回：無
 * ============================================================================
 */
function 報表_套用驗證_(obj格, obj驗證) {
  if (obj驗證) obj格.setDataValidation(obj驗證);
  else obj格.clearDataValidations();
}


/**
 * ============================================================================
 * 函式名稱：報表_取得候選值_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：某欄實際出現過的值（不重複、去空白、依筆畫排序），最多 300 個，給「值」的下拉選單。
 * 參數：obj來源 {Object} 報表_讀取來源_ 的結果；str欄名 {string}
 * 傳回：{string[]}
 * ============================================================================
 */
function 報表_取得候選值_(obj來源, str欄名) {
  const int欄 = obj來源.obj欄索引[str欄名];
  if (int欄 === undefined) return [];
  const obj已有 = {};
  const arr = [];
  obj來源.arr顯示.forEach(function (arr列) {
    const s = String(arr列[int欄] == null ? '' : arr列[int欄]).trim();
    if (s === '' || obj已有[s]) return;
    obj已有[s] = true;
    arr.push(s);
  });
  arr.sort(function (a, b) { return 報表_排序比較_(a, a, b, b, false); });
  return arr.slice(0, obj報表產生器設定.int候選值上限);
}


/**
 * ============================================================================
 * 函式名稱：報表_可選來源分頁_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：「來源分頁」下拉的選項：副本中的資料分頁（排除報表分頁、隱藏分頁、說明與系統分頁）。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{string[]}
 * ============================================================================
 */
function 報表_可選來源分頁_(obj副本) {
  return obj副本.getSheets().filter(function (o) {
    return obj報表產生器設定.arr非來源分頁.indexOf(o.getName()) === -1 && !報表_是報表分頁_(o)
      && !(typeof o.isSheetHidden === 'function' && o.isSheetHidden());
  }).map(function (o) { return o.getName(); });
}


/**
 * ============================================================================
 * 函式名稱：報表_設定下拉_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：
 *   依目前的來源分頁，替設定區與第 6 列設定下拉選單：
 *     · 來源分頁、條件關係、比較方式、排序方向：固定清單
 *     · 條件欄位、排序欄位、第 6 列標題：來源的欄名（第 6 列允許自己輸入，用來改名或加空白欄）
 *     · 條件值：該條件所選欄位實際出現過的值（允許自己輸入）
 *   承辦人在副本改選欄位時，副本程式會即時更新該條件的值清單（不經平台）。
 * 參數：obj副本 {Spreadsheet}；obj分頁 {Sheet}
 * 傳回：{Object} { int欄位數 }
 * ============================================================================
 */
function 報表_設定下拉_(obj副本, obj分頁) {
  const cfg = obj報表產生器設定;
  const obj設定 = 報表_讀取設定_(obj分頁);
  let obj來源 = null;
  try { obj來源 = 報表_讀取來源_(obj副本, obj設定.str來源分頁); } catch (err) { obj來源 = null; }
  const arr欄名 = obj來源 ? obj來源.arr標題.filter(function (s, i, a) { return s !== '' && a.indexOf(s) === i; }) : [];

  報表_套用驗證_(obj分頁.getRange(1, 2), 報表_清單驗證_(報表_可選來源分頁_(obj副本), false));
  報表_套用驗證_(obj分頁.getRange(1, 4), 報表_清單驗證_(cfg.arr條件關係, false));
  const obj欄位驗證 = 報表_清單驗證_(arr欄名, false);
  for (let j = 0; j < cfg.int排序數; j++) {
    const p = 報表_排序位置_(j);
    報表_套用驗證_(obj分頁.getRange(1, p.int欄位欄), obj欄位驗證);
    報表_套用驗證_(obj分頁.getRange(1, p.int方向欄), 報表_清單驗證_(cfg.arr排序方向, false));
  }
  for (let i = 0; i < cfg.int條件數; i++) {
    const p = 報表_條件位置_(i);
    報表_套用驗證_(obj分頁.getRange(p.int列, p.int欄位欄), obj欄位驗證);
    報表_套用驗證_(obj分頁.getRange(p.int列, p.int比較欄), 報表_清單驗證_(cfg.arr比較方式, false));
    const str欄位 = String(obj分頁.getRange(p.int列, p.int欄位欄).getDisplayValue()).trim();
    const arr值 = obj來源 && str欄位 ? 報表_取得候選值_(obj來源, str欄位) : [];
    報表_套用驗證_(obj分頁.getRange(p.int列, p.int值欄), 報表_清單驗證_(arr值, true));
  }
  // 第 6 列 B 欄起（已有標題的格子＋預留欄數）
  const int標題數 = Math.max(obj設定.arr欄位.length + cfg.int預留欄位數, cfg.int預留欄位數);
  if (1 + int標題數 > obj分頁.getMaxColumns()) obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), 1 + int標題數 - obj分頁.getMaxColumns());
  報表_套用驗證_(obj分頁.getRange(cfg.int標題列, 2, 1, int標題數), 報表_清單驗證_(arr欄名, true));
  return { int欄位數: arr欄名.length };
}


/**
 * ============================================================================
 * 函式名稱：報表_建立版面_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：在一張空白分頁寫入報表產生器的版面：設定區標籤與底色、預設值（來源、全部符合、遞增）、
 *       第 4 列報表名稱、第 6 列「序號」、欄寬，並加上「報表產生器」標記。
 * 參數：obj分頁 {Sheet}；str來源 {string}；str報表名稱 {string}
 * 傳回：無
 * ============================================================================
 */
function 報表_建立版面_(obj分頁, str來源, str報表名稱) {
  const cfg = obj報表產生器設定;
  const int欄數 = 報表_設定區欄數_();
  if (int欄數 > obj分頁.getMaxColumns()) obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), int欄數 - obj分頁.getMaxColumns());

  // 設定區底色與字型
  obj分頁.getRange(1, 1, 3, int欄數).setBackground(cfg.str設定底色).setFontSize(10);
  const fn標籤 = function (int列, int欄, str) {
    obj分頁.getRange(int列, int欄).setValue(str).setFontWeight('bold').setFontColor(cfg.str標籤色);
  };
  fn標籤(1, 1, cfg.str標籤_來源);
  obj分頁.getRange(1, 2).setValue(str來源 || cfg.str預設來源);
  fn標籤(1, 3, cfg.str標籤_關係);
  obj分頁.getRange(1, 4).setValue('全部符合');
  for (let j = 0; j < cfg.int排序數; j++) {
    const p = 報表_排序位置_(j);
    fn標籤(1, p.int標籤欄, `排序${j + 1}`);
    obj分頁.getRange(1, p.int方向欄).setValue('遞增');
  }
  for (let i = 0; i < cfg.int條件數; i++) {
    const p = 報表_條件位置_(i);
    fn標籤(p.int列, p.int標籤欄, `條件${i + 1}`);
  }
  obj分頁.getRange(1, 1).setNote('報表產生器的設定區（第 1～3 列，列印時隱藏）。每一格都可以下拉選擇；設定好後按選單「報表產生器 → 產生報表」。');

  // 第 4～6 列
  obj分頁.getRange(4, 1).setValue(str報表名稱 || obj分頁.getName());
  obj分頁.getRange(5, 1).setValue('人數：（按「產生報表」後計算）').setFontColor(cfg.str標籤色);
  obj分頁.getRange(cfg.int標題列, 1).setValue('序號').setFontWeight('bold');
  obj分頁.getRange(cfg.int標題列, 2).setNote('用選單「報表產生器 → 加入欄位」加入要顯示的欄位，也可以在這一列下拉選擇。\n改顯示名稱：輸入「護七_組別 → 組別」。\n輸入來源沒有的名稱（例如「簽到」）＝空白欄。');

  // 欄寬
  obj分頁.setColumnWidth(1, 70);
  for (let c = 2; c <= int欄數; c++) obj分頁.setColumnWidth(c, 130);

  // 標記為報表分頁
  obj分頁.addDeveloperMetadata(cfg.str中繼鍵, '1');
}


// ============================================================================
// 己、產生報表
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_建立計畫_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：把設定換成欄索引；欄位找不到、條件缺值時以白話說明丟錯（指出是第幾個條件）。
 * 參數：obj設定 {Object}；obj來源 {Object}
 * 傳回：{Object} { bool任一, arr條件, arr排序, arr輸出欄, arr空白欄, arr說明 }
 * ============================================================================
 */
function 報表_建立計畫_(obj設定, obj來源) {
  const cfg = obj報表產生器設定;
  const fn欄 = function (str欄名, str位置) {
    if (!(str欄名 in obj來源.obj欄索引)) {
      throw new 平台錯誤(obj錯誤代碼.欄位缺漏,
        `${str位置}的欄位「${str欄名}」在來源分頁「${obj設定.str來源分頁}」第 1 列找不到，請重新選擇（名稱要完全相同）。`);
    }
    return obj來源.obj欄索引[str欄名];
  };

  const arr說明 = [];
  const arr條件 = obj設定.arr條件.map(function (o) {
    const str比較 = o.str比較 || '等於';
    if (cfg.arr比較方式.indexOf(str比較) === -1) {
      throw new 平台錯誤(obj錯誤代碼.參數錯誤, `條件${o.int序 || ''}的比較方式「${str比較}」看不懂，請從下拉選單選擇。`);
    }
    if (cfg.arr不需要值.indexOf(str比較) === -1 && String(o.str值 || '').trim() === '') {
      throw new 平台錯誤(obj錯誤代碼.參數錯誤,
        `條件${o.int序 || ''}（${o.str欄位} ${str比較}）的「值」是空白的。要找空白的資料請把比較方式改成「空白」。`);
    }
    arr說明.push(`${o.str欄位} ${str比較}${cfg.arr不需要值.indexOf(str比較) === -1 ? `「${o.str值}」` : ''}`);
    return {
      int欄: fn欄(o.str欄位, `條件${o.int序 || ''}`), str比較: str比較, str值: o.str值,
      obj預解析: str比較 === 'Excel寫法' ? 報表_解析Excel條件_(o.str值) : null
    };
  });
  const arr排序 = obj設定.arr排序.map(function (o, j) {
    return { int欄: fn欄(o.str欄位, `排序${j + 1}`), bool遞減: !!o.bool遞減 };
  });
  if (obj設定.arr欄位.length === 0) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, '第 6 列還沒有任何欄位。請用選單「報表產生器 → 加入欄位」加入要顯示的欄位。');
  }
  const arr空白欄 = [];
  const arr輸出欄 = obj設定.arr欄位.map(function (o) {
    if (o.str來源欄 in obj來源.obj欄索引) return obj來源.obj欄索引[o.str來源欄];
    arr空白欄.push(o.str顯示名稱);
    return -1;
  });
  return {
    bool任一: obj設定.str條件關係 === '任一符合', arr條件: arr條件, arr排序: arr排序,
    arr輸出欄: arr輸出欄, arr空白欄: arr空白欄,
    str條件說明: arr說明.length === 0 ? '（沒有條件，全部列出）' : arr說明.join(obj設定.str條件關係 === '任一符合' ? '，或 ' : '，且 ')
  };
}


/**
 * ============================================================================
 * 函式名稱：報表_寫入結果_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：
 *   清除第 7 列以下舊資料與格式，寫入第 4～6 列與資料，並美化（同報表.gs V5.6）：
 *     第 4 列報表名稱合併置中、標楷體 24；第 5 列人數；第 6 列序號＋顯示名稱（來源與顯示不同時加備註）；
 *     資料純文字寫入（保留 0911-000000、前導 0）、標楷體 14、置中、框線、自動換行。
 * 參數：
 *   obj分頁   {Sheet}
 *   obj設定   {Object}   報表_讀取設定_ 的結果
 *   obj計畫   {Object}   報表_建立計畫_ 的結果
 *   arr結果   {string[][]}
 * 傳回：無
 * ============================================================================
 */
function 報表_寫入結果_(obj分頁, obj設定, obj計畫, arr結果) {
  const cfg = obj報表產生器設定;
  const int欄數 = 1 + obj設定.arr欄位.length;
  const int清除欄數 = Math.max(obj分頁.getMaxColumns(), int欄數);
  const int起 = cfg.int資料起始列;

  // ① 清除舊資料（第 6 列 B 欄起多出來的舊標題也清掉）
  if (obj分頁.getMaxRows() >= int起) obj分頁.getRange(int起, 1, obj分頁.getMaxRows() - int起 + 1, int清除欄數).clear();
  if (int清除欄數 > int欄數) obj分頁.getRange(cfg.int標題列, int欄數 + 1, 1, int清除欄數 - int欄數).clearContent().clearNote();
  const int需要列 = int起 + arr結果.length - 1;
  if (int需要列 > obj分頁.getMaxRows()) obj分頁.insertRowsAfter(obj分頁.getMaxRows(), int需要列 - obj分頁.getMaxRows());
  if (int欄數 > obj分頁.getMaxColumns()) obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), int欄數 - obj分頁.getMaxColumns());

  // ② 第 4 列報表名稱：先解除舊合併再合併
  const str名稱 = obj設定.str報表名稱 || obj分頁.getName();
  obj分頁.getRange(4, 1, 1, Math.max(int清除欄數, int欄數)).breakApart();
  obj分頁.getRange(4, 1, 1, Math.max(int欄數, 2)).merge().setValue(str名稱)
    .setFontFamily(cfg.str字型).setFontSize(cfg.int主標題字級).setHorizontalAlignment('center').setFontColor('#000000');

  // ③ 第 5 列人數
  obj分頁.getRange(5, 1).setValue(`人數：${arr結果.length} 人`)
    .setFontFamily(cfg.str字型).setFontSize(cfg.int內文字級).setFontColor('#000000').setHorizontalAlignment('left');

  // ④ 第 6 列：序號＋顯示名稱；來源欄與顯示名稱不同時，備註記住來源欄（下次產生仍找得到）
  const obj標題 = obj分頁.getRange(cfg.int標題列, 1, 1, int欄數);
  obj標題.setValues([['序號'].concat(obj設定.arr欄位.map(function (o) { return o.str顯示名稱; }))]);
  obj標題.setNotes([[''].concat(obj設定.arr欄位.map(function (o, k) {
    if (obj計畫.arr輸出欄[k] < 0) return cfg.str空白欄備註;
    return o.str來源欄 !== o.str顯示名稱 ? cfg.str備註前綴 + o.str來源欄 : '';
  }))]);
  obj標題.setBackgrounds([['#ffffff'].concat(obj計畫.arr輸出欄.map(function (int) { return int < 0 ? cfg.str空白欄底色 : '#ffffff'; }))]);
  obj標題.setFontFamily(cfg.str字型).setFontSize(cfg.int內文字級).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true);

  // ⑤ 資料
  if (arr結果.length > 0) {
    const obj資料 = obj分頁.getRange(int起, 1, arr結果.length, int欄數);
    obj資料.setNumberFormat('@');
    obj資料.setValues(arr結果.map(function (arr列, i) { return [String(i + 1)].concat(arr列); }));
    obj資料.setFontFamily(cfg.str字型).setFontSize(cfg.int內文字級).setHorizontalAlignment('center')
      .setVerticalAlignment('middle').setWrap(true).setBorder(true, true, true, true, true, true);
  }
}


/**
 * ============================================================================
 * 函式名稱：報表_產生_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：產生一張報表：讀設定 → 讀來源 → 換成欄索引 → 篩選排序 → 寫入。
 * 參數：obj副本 {Spreadsheet}；obj分頁 {Sheet}
 * 傳回：{Object} { str分頁名稱, int筆數, str來源分頁, str條件說明, arr空白欄 }
 * ============================================================================
 */
function 報表_產生_(obj副本, obj分頁) {
  const obj設定 = 報表_讀取設定_(obj分頁);
  const obj來源 = 報表_讀取來源_(obj副本, obj設定.str來源分頁);
  const obj計畫 = 報表_建立計畫_(obj設定, obj來源);
  const arr結果 = 報表_篩選排序_(obj來源, obj計畫);
  報表_寫入結果_(obj分頁, obj設定, obj計畫, arr結果);
  return {
    str分頁名稱: obj分頁.getName(), int筆數: arr結果.length, str來源分頁: obj設定.str來源分頁,
    str條件說明: obj計畫.str條件說明, arr空白欄: obj計畫.arr空白欄
  };
}


/**
 * ============================================================================
 * 函式名稱：報表_新分頁名稱_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：產生不重複的分頁名稱：指定名稱可用就用（去掉分頁名稱不允許的符號），否則「報表1」「報表2」…
 * 參數：obj副本 {Spreadsheet}；str希望 {string} 選填
 * 傳回：{string}
 * ============================================================================
 */
function 報表_新分頁名稱_(obj副本, str希望) {
  const str淨 = String(str希望 || '').replace(/[\[\]\*\?\/\\:']/g, '').trim().substring(0, 90);
  if (str淨 !== '' && !obj副本.getSheetByName(str淨)) return str淨;
  const str基底 = str淨 || obj報表產生器設定.str分頁名前綴;
  let int = 1;
  while (obj副本.getSheetByName(str淨 ? `${str基底}${int + 1}` : `${str基底}${int}`)) int++;
  return str淨 ? `${str基底}${int + 1}` : `${str基底}${int}`;
}


// ============================================================================
// 庚、報表範本（副本隱藏分頁「報表範本」）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_範本分頁_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：取得「報表範本」隱藏分頁；沒有時依需要建立（標題列、隱藏）。
 * 參數：obj副本 {Spreadsheet}；bool建立 {boolean}
 * 傳回：{Sheet|null}
 * ============================================================================
 */
function 報表_範本分頁_(obj副本, bool建立) {
  const cfg = obj報表產生器設定;
  let obj分頁 = obj副本.getSheetByName(cfg.str範本分頁);
  if (!obj分頁 && bool建立) {
    obj分頁 = obj副本.insertSheet(cfg.str範本分頁);
    obj分頁.getRange(1, 1, 1, cfg.arr範本欄位.length).setValues([cfg.arr範本欄位.slice()]).setFontWeight('bold');
    obj分頁.setColumnWidth(2, 400);
    obj分頁.hideSheet();
  }
  return obj分頁;
}


/**
 * ============================================================================
 * 函式名稱：報表_讀取範本們_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：讀出所有範本（設定 JSON 壞掉的略過並記下）。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{Object[]} [ { str名稱, obj設定, int列 } ]
 * ============================================================================
 */
function 報表_讀取範本們_(obj副本) {
  const obj分頁 = 報表_範本分頁_(obj副本, false);
  if (!obj分頁 || obj分頁.getLastRow() < 2) return [];
  return obj分頁.getRange(2, 1, obj分頁.getLastRow() - 1, 2).getValues().map(function (arr, i) {
    let obj設定 = null;
    try { obj設定 = JSON.parse(String(arr[1])); } catch (err) { obj設定 = null; }
    return { str名稱: String(arr[0]).trim(), obj設定: obj設定, int列: i + 2 };
  }).filter(function (o) { return o.str名稱 !== '' && o.obj設定; });
}


/**
 * ============================================================================
 * 函式名稱：報表_寫入設定_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：把範本設定寫回報表分頁的設定區與第 6 列（套用範本用）。原有設定與第 6 列先清除。
 * 參數：obj分頁 {Sheet}；obj設定 {Object}
 * 傳回：無
 * ============================================================================
 */
function 報表_寫入設定_(obj分頁, obj設定) {
  const cfg = obj報表產生器設定;
  obj分頁.getRange(1, 2).setValue(obj設定.str來源分頁 || cfg.str預設來源);
  obj分頁.getRange(1, 4).setValue(obj設定.str條件關係 === '任一符合' ? '任一符合' : '全部符合');
  for (let j = 0; j < cfg.int排序數; j++) {
    const p = 報表_排序位置_(j);
    const o = (obj設定.arr排序 || [])[j];
    obj分頁.getRange(1, p.int欄位欄).setValue(o ? o.str欄位 : '');
    obj分頁.getRange(1, p.int方向欄).setValue(o && o.bool遞減 ? '遞減' : '遞增');
  }
  for (let i = 0; i < cfg.int條件數; i++) {
    const p = 報表_條件位置_(i);
    const o = (obj設定.arr條件 || [])[i];
    obj分頁.getRange(p.int列, p.int欄位欄, 1, 3).setValues([[o ? o.str欄位 : '', o ? o.str比較 : '', o ? o.str值 : '']]);
  }
  obj分頁.getRange(4, 1).setValue(obj設定.str報表名稱 || obj分頁.getName());
  const arr欄位 = obj設定.arr欄位 || [];
  const int清 = Math.max(obj分頁.getLastColumn() - 1, 1);
  obj分頁.getRange(cfg.int標題列, 2, 1, int清).clearContent().clearNote();
  if (arr欄位.length > 0) {
    const obj格 = obj分頁.getRange(cfg.int標題列, 2, 1, arr欄位.length);
    obj格.setValues([arr欄位.map(function (o) { return o.str顯示名稱 || o.str來源欄; })]);
    obj格.setNotes([arr欄位.map(function (o) {
      return (o.str來源欄 && o.str來源欄 !== o.str顯示名稱) ? cfg.str備註前綴 + o.str來源欄 : '';
    })]);
  }
}


// ============================================================================
// 辛、身分驗證（副本選單送來使用者本人的 Google 存取權杖）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表_驗證權杖_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：向 Google 查出存取權杖屬於哪個帳號（權杖要有效、信箱已驗證）。權杖只用來查帳號，不保存。
 * 參數：str存取權杖 {string}
 * 傳回：{string} 正規化的 Google 帳號
 * ============================================================================
 */
function 報表_驗證權杖_(str存取權杖) {
  const str權杖 = String(str存取權杖 || '').trim();
  if (str權杖 === '' || str權杖.length > 4096) {
    throw new 平台錯誤(obj錯誤代碼.登入失敗, '報表產生器沒有送出您的 Google 身分，請關閉試算表後重新開啟再試。');
  }
  let obj回應;
  try {
    obj回應 = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(str權杖),
      { muteHttpExceptions: true });
  } catch (err) {
    throw new 平台錯誤(obj錯誤代碼.未預期錯誤, '目前無法連線到 Google 確認身分，請稍後再試。',
      { str原始訊息: err && err.message ? err.message : String(err) });
  }
  if (obj回應.getResponseCode() !== 200) {
    throw new 平台錯誤(obj錯誤代碼.登入失敗, 'Google 身分確認失敗（可能已過期），請關閉試算表後重新開啟再試。');
  }
  let obj內容 = {};
  try { obj內容 = JSON.parse(obj回應.getContentText()); } catch (err) { obj內容 = {}; }
  const bool已驗證 = obj內容.email_verified === true || obj內容.email_verified === 'true';
  if (!obj內容.email || !bool已驗證 || !(Number(obj內容.expires_in) > 0)) {
    throw new 平台錯誤(obj錯誤代碼.登入失敗, '無法確認您的 Google 帳號。請先完成授權（第一次使用時按「繼續 → 允許」），再試一次。');
  }
  return 正規化帳號(obj內容.email);
}


/**
 * ============================================================================
 * 函式名稱：報表_開啟情境_（內部使用）
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：每個動作共用的前置：驗證帳號 → 副本必須是平台建立的 → 必須是該精舍的精舍管理員，
 *       或副本清單中被指派的人員 → 開啟副本。
 * 參數：obj參數 {Object} { str存取權杖, str副本ID }；str作業名稱 {string}
 * 傳回：{Object} { obj身分, obj副本, obj副本資訊 }
 * ============================================================================
 */
function 報表_開啟情境_(obj參數, str作業名稱) {
  檢查必要參數(obj參數, ['str存取權杖', 'str副本ID'], str作業名稱);
  const str帳號 = 報表_驗證權杖_(obj參數.str存取權杖);
  const obj資訊 = 讀取副本資訊(String(obj參數.str副本ID).trim());
  const obj身分 = 判定身分_(str帳號, obj資訊.str精舍代號);
  const bool管理員 = obj身分.str角色 === obj角色.精舍管理員;
  if (!bool管理員 && obj資訊.arr指派帳號.indexOf(str帳號) === -1) {
    throw new 平台錯誤(obj錯誤代碼.權限不足,
      `您（${str帳號}）不是這份副本的承辦人，不能使用「${str作業名稱}」。如需使用，請洽精舍管理員指派。`);
  }
  return { obj身分: obj身分, obj副本: 開啟試算表(obj資訊.str副本ID, `「${obj資訊.str名稱}」副本`), obj副本資訊: obj資訊 };
}


// ============================================================================
// 壬、動作（action）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：報表產生器_新增分頁
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：action「report.新增分頁」。在副本最後建立一張報表分頁（版面、下拉選單、標記）。
 * 參數：obj工作階段 {null}；obj參數 {Object} { str存取權杖, str副本ID, str分頁名稱（選填）, str來源分頁（選填） }
 * 傳回：{Object} { str分頁名稱, int分頁ID, str訊息 }
 * ============================================================================
 */
function 報表產生器_新增分頁(obj工作階段, obj參數) {
  const obj = 報表_開啟情境_(obj參數, '新增報表分頁');
  const arr來源 = 報表_可選來源分頁_(obj.obj副本);
  const str來源 = obj參數.str來源分頁 && arr來源.indexOf(obj參數.str來源分頁) !== -1 ? obj參數.str來源分頁
    : (arr來源.indexOf(obj報表產生器設定.str預設來源) !== -1 ? obj報表產生器設定.str預設來源 : (arr來源[0] || obj報表產生器設定.str預設來源));
  const str名稱 = 報表_新分頁名稱_(obj.obj副本, obj參數.str分頁名稱);
  const obj分頁 = obj.obj副本.insertSheet(str名稱, obj.obj副本.getSheets().length);
  報表_建立版面_(obj分頁, str來源, str名稱);
  const obj下拉 = 報表_設定下拉_(obj.obj副本, obj分頁);
  return {
    str分頁名稱: str名稱, int分頁ID: obj分頁.getSheetId(),
    str訊息: `已新增報表分頁「${str名稱}」（來源：${str來源}，${obj下拉.int欄位數} 個欄位可選）。\n請用「報表產生器 → 加入欄位」加入要顯示的欄位，在上方下拉選條件，再按「產生報表」。`
  };
}


/**
 * ============================================================================
 * 函式名稱：報表產生器_產生
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：action「report.產生」。依目前報表分頁的設定產生報表。
 * 參數：obj工作階段 {null}；obj參數 {Object} { str存取權杖, str副本ID, int分頁ID }
 * 傳回：{Object} { str訊息, int筆數, str分頁名稱 }
 * ============================================================================
 */
function 報表產生器_產生(obj工作階段, obj參數) {
  const obj = 報表_開啟情境_(obj參數, '產生報表');
  const obj分頁 = 報表_取得報表分頁_(obj.obj副本, obj參數.int分頁ID);
  const r = 報表_產生_(obj.obj副本, obj分頁);
  return {
    int筆數: r.int筆數, str分頁名稱: r.str分頁名稱,
    str訊息: `報表「${r.str分頁名稱}」已產生：${r.int筆數} 筆。\n來源：${r.str來源分頁}\n條件：${r.str條件說明}`
      + (r.arr空白欄.length > 0 ? `\n空白欄（來源沒有這些欄位，報表中留空）：${r.arr空白欄.join('、')}` : '')
  };
}


/**
 * ============================================================================
 * 函式名稱：報表產生器_重新產生全部
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：action「report.重新產生全部」。同步新報名後，一次更新副本中所有報表分頁；
 *       某張失敗不影響其他張，最後一併回報。
 * 參數：obj工作階段 {null}；obj參數 {Object} { str存取權杖, str副本ID }
 * 傳回：{Object} { str訊息, arr明細 }
 * ============================================================================
 */
function 報表產生器_重新產生全部(obj工作階段, obj參數) {
  const obj = 報表_開啟情境_(obj參數, '重新產生全部報表');
  const arr分頁 = 報表_列出報表分頁_(obj.obj副本);
  if (arr分頁.length === 0) {
    return { str訊息: '這份副本還沒有報表分頁。請先用「報表產生器 → 新增報表分頁」建立。', arr明細: [] };
  }
  const arr明細 = [];
  let int失敗 = 0;
  arr分頁.forEach(function (o) {
    try {
      const r = 報表_產生_(obj.obj副本, o);
      arr明細.push(`✔ ${o.getName()}：${r.int筆數} 筆`);
    } catch (err) {
      int失敗 += 1;
      arr明細.push(`✘ ${o.getName()}：${轉換為平台錯誤(err, '產生報表').str使用者訊息}`);
    }
  });
  return {
    str訊息: `已重新產生 ${arr分頁.length - int失敗} 張報表${int失敗 > 0 ? `，${int失敗} 張沒有成功（請看明細）` : ''}。`,
    arr明細: arr明細
  };
}


/**
 * ============================================================================
 * 函式名稱：報表產生器_更新下拉
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：action「report.更新下拉」。來源分頁改變或同步新報名後，重新設定目前報表分頁的下拉選單。
 * 參數：obj工作階段 {null}；obj參數 {Object} { str存取權杖, str副本ID, int分頁ID }
 * 傳回：{Object} { str訊息 }
 * ============================================================================
 */
function 報表產生器_更新下拉(obj工作階段, obj參數) {
  const obj = 報表_開啟情境_(obj參數, '更新下拉選項');
  const obj分頁 = 報表_取得報表分頁_(obj.obj副本, obj參數.int分頁ID);
  const r = 報表_設定下拉_(obj.obj副本, obj分頁);
  return { str訊息: `「${obj分頁.getName()}」的下拉選單已更新（${r.int欄位數} 個欄位）。` };
}


/**
 * ============================================================================
 * 函式名稱：報表產生器_存成範本
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：action「report.存成範本」。把目前報表分頁的設定存成範本；同名範本會被更新。
 * 參數：obj工作階段 {null}；obj參數 {Object} { str存取權杖, str副本ID, int分頁ID, str範本名稱 }
 * 傳回：{Object} { str訊息, bool更新 }
 * ============================================================================
 */
function 報表產生器_存成範本(obj工作階段, obj參數) {
  const obj = 報表_開啟情境_(obj參數, '存成範本');
  檢查必要參數(obj參數, ['str範本名稱'], '存成範本');
  const str名稱 = String(obj參數.str範本名稱).trim().substring(0, 60);
  if (str名稱 === '') throw new 平台錯誤(obj錯誤代碼.參數錯誤, '請輸入範本名稱。');
  const obj分頁 = 報表_取得報表分頁_(obj.obj副本, obj參數.int分頁ID);
  const obj設定 = 報表_讀取設定_(obj分頁);
  if (obj設定.arr欄位.length === 0) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, '第 6 列還沒有任何欄位，沒有東西可以存。請先加入欄位。');
  }
  const obj範本分頁 = 報表_範本分頁_(obj.obj副本, true);
  const obj既有 = 報表_讀取範本們_(obj.obj副本).filter(function (o) { return o.str名稱 === str名稱; })[0];
  const arr列 = [str名稱, JSON.stringify(obj設定), obj.obj身分.str帳號, new Date()];
  if (obj既有) obj範本分頁.getRange(obj既有.int列, 1, 1, arr列.length).setValues([arr列]);
  else obj範本分頁.getRange(obj範本分頁.getLastRow() + 1, 1, 1, arr列.length).setValues([arr列]);
  寫入操作日誌(obj.obj身分, '報表產生器存成範本', `${obj.obj副本資訊.str名稱}：${str名稱}`, obj.obj副本資訊.str精舍代號);
  return { bool更新: !!obj既有, str訊息: obj既有 ? `已更新範本「${str名稱}」。` : `已存成範本「${str名稱}」，之後可從「報表產生器 → 套用範本」選用。` };
}


/**
 * ============================================================================
 * 函式名稱：報表產生器_套用範本
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：action「report.套用範本」。把範本設定寫進報表分頁並立即產生：
 *       有給 int分頁ID（目前是報表分頁）→ 覆蓋該分頁；否則新增一張以範本命名的報表分頁。
 * 參數：obj工作階段 {null}；obj參數 {Object} { str存取權杖, str副本ID, str範本名稱, int分頁ID（選填） }
 * 傳回：{Object} { str訊息, str分頁名稱, int分頁ID, int筆數 }
 * ============================================================================
 */
function 報表產生器_套用範本(obj工作階段, obj參數) {
  const obj = 報表_開啟情境_(obj參數, '套用範本');
  檢查必要參數(obj參數, ['str範本名稱'], '套用範本');
  const str名稱 = String(obj參數.str範本名稱).trim();
  const obj範本 = 報表_讀取範本們_(obj.obj副本).filter(function (o) { return o.str名稱 === str名稱; })[0];
  if (!obj範本) throw new 平台錯誤(obj錯誤代碼.資料列不存在, `找不到範本「${str名稱}」，可能已被刪除。請重新開啟試算表更新選單。`);

  let obj分頁;
  if (obj參數.int分頁ID) {
    obj分頁 = 報表_取得報表分頁_(obj.obj副本, obj參數.int分頁ID);
  } else {
    obj分頁 = obj.obj副本.insertSheet(報表_新分頁名稱_(obj.obj副本, str名稱), obj.obj副本.getSheets().length);
    報表_建立版面_(obj分頁, obj範本.obj設定.str來源分頁, obj範本.obj設定.str報表名稱);
  }
  報表_寫入設定_(obj分頁, obj範本.obj設定);
  報表_設定下拉_(obj.obj副本, obj分頁);
  const r = 報表_產生_(obj.obj副本, obj分頁);
  return {
    str分頁名稱: r.str分頁名稱, int分頁ID: obj分頁.getSheetId(), int筆數: r.int筆數,
    str訊息: `已套用範本「${str名稱}」到「${r.str分頁名稱}」並產生報表：${r.int筆數} 筆。`
  };
}


/**
 * ============================================================================
 * 函式名稱：路由定義_report
 * 版本：v1.0.0（2026-11-04）
 * ----------------------------------------------------------------------------
 * 用途：報表產生器的 action（核心_路由 依分類「report」自動找到本函式）。
 *       皆不需網頁登入，改以使用者本人的 Google 存取權杖驗證（見 報表_開啟情境_）。
 * 參數：無
 * 傳回：{Object}
 * ============================================================================
 */
function 路由定義_report() {
  return {
    'report.新增分頁': { fn: 報表產生器_新增分頁, bool需登入: false },
    'report.產生': { fn: 報表產生器_產生, bool需登入: false },
    'report.重新產生全部': { fn: 報表產生器_重新產生全部, bool需登入: false },
    'report.更新下拉': { fn: 報表產生器_更新下拉, bool需登入: false },
    'report.存成範本': { fn: 報表產生器_存成範本, bool需登入: false },
    'report.套用範本': { fn: 報表產生器_套用範本, bool需登入: false }
  };
}
