// ============================================================================
// 檔案名稱：法會_大車匯出.gs
// 所屬模組：法會活動（event）
// 所屬層級：模組／服務層＋控制層
// 檔案版本：v1.0.0（2026-10-27）
// 用途說明：
//   對外活動的大車點名（沿用舊系統 18、09、19 號檔已定案的規則）：
//     ① 產生點名資料：依副本「點名欄位設定」把「有效資料」每人拆成一趟或多趟，
//        合併寫入副本「大車報到點名資料」（一趟一列）。系統欄位每次重算，承辦人填的欄位保留，
//        新趟次加在最後，消失的趟次加刪除線不自動刪除。第一次只建立「點名欄位設定」並停下請承辦人確認。
//     ② 匯出：整份覆蓋到大車點名試算表「大車名單-活動名稱」。首次匯出建立名單與報到紀錄分頁、
//        活動配置設為啟用、活動進入「演練」；再次匯出先備份原名單。
//     ③ 轉為正式（精舍管理員）：最後一次匯出 → 備份並清空演練期報到紀錄 → 鎖定。
//        退回演練（精舍管理員）：正式 → 演練。
//     ④ 清除點名資料（精舍管理員，活動結束後）：刪除點名試算表中這場活動的分頁、備份與活動配置列。
//   活動結束／重新開啟時，由 法會_活動管理 呼叫「設定大車活動配置狀態_」停用／啟用點名系統的活動。
//
//   大車點名試算表由精舍在「精舍設定 → 學員名冊與外部檔案」登記（共享給系統帳號為編輯者）；
//   第一次匯出時記到活動清單「匯出試算表ID」，之後這場活動一直使用同一份。
//   點名試算表是精舍自有、欄位固定的外部檔案，依標題文字讀寫（與學員名冊相同）。
//
//   ※ 本檔依檔名排序會比 法會_模組定義.gs 先載入，頂層常數一律自給自足，不引用其他檔案的常數。
//
// 相依檔案：平台核心、法會_模組定義、法會_重複檢查（轉為欄位字母_、尋找副本欄位索引_）
// ============================================================================


// ----------------------------------------------------------------------------
// 大車點名系統的固定格式（活動配置／大車名單-活動／報到紀錄-活動）
// ----------------------------------------------------------------------------
const obj大車點名格式 = Object.freeze({
  str外部檔案項目: '大車點名試算表',
  str活動配置分頁: '活動配置',
  arr活動配置必要欄位: ['活動名稱', '大車名單工作表', '報到紀錄工作表', '狀態'],
  str名單分頁前綴: '大車名單-',
  str報到分頁前綴: '報到紀錄-',
  // 點名系統的名單欄位與順序
  arr名單欄位: ['姓名', '法名', '手機號碼', '身份別', '領隊', '日期-起', '日期-迄', '去程', '回程', '去程時段',
    '義工組別', '去程狀態', '回程狀態', '車號', '車號說明', '狀態'],
  // 由點名系統填寫，產生與匯出時一律空白
  arr點名系統欄位: ['去程狀態', '回程狀態', '狀態'],
  arr報到紀錄欄位: ['日期', '方向', '點名時機', '去程時段', '車次', '學員編號', '姓名', '法名', '手機號碼', '身份別', '報到時間', '狀態'],
  str啟用: '啟用',
  str停用: '停用'
});

// 副本中的點名資料設定
const obj大車點名設定 = Object.freeze({
  str點名分頁名: '大車報到點名資料',
  str設定分頁名: '點名欄位設定',
  str領隊代號分頁名: '領隊代號',
  arr領隊代號標題: ['領隊代號', '名稱'],
  str鍵欄名: '系統_趟次鍵',          // 隱藏欄：辨識同一趟，重新產生時靠它保留承辦人填的資料
  str狀態欄名: '系統_狀態',          // 隱藏欄：空白＝正常；「已消失」＝這一趟已不在有效資料中
  str已消失: '已消失',
  // 每次重新計算的欄位（領隊以活動為單位，每人各趟相同）
  arr系統欄位: ['姓名', '法名', '手機號碼', '領隊', '日期-起', '日期-迄', '義工組別'],
  // 有效資料有「完全同名」欄位且有值時，直接寫入此人每一趟（優先於系統判斷與點名資料中已填的值）
  arr同名寫入欄位: ['身份別', '去程', '回程', '去程時段', '車號', '車號說明'],
  arr同名日期欄位: ['日期-起', '日期-迄'],          // 只在日期型態＝無時採用
  str問題底色: '#f9eeda',          // 系統判斷不出的格子（手機格式、日期、領隊代號）
  str待分車底色: '#e7f1fb',        // 去程或回程尚未填（條件式格式，填好自動消失）
  str已消失文字色: '#9e9e9e',
  arr日期型態: ['逐日勾選', '梯次', '無'],
  str日期格式: 'M/d',              // 點名系統用「月/日」，例如 11/30
  // 預設領隊代號（副本沒有「領隊代號」分頁時使用）
  obj預設領隊代號: Object.freeze({ '1': '法師', '2': '總領隊', '3': '副總領隊', '4': '領隊', '5': '副領隊', '6': '貴賓資料' })
});

// 「點名欄位設定」分頁的項目：[項目, 種類, 說明]（種類：型態／欄位／文字）
const arr大車點名設定項目 = Object.freeze([
  ['日期型態', '型態', '逐日勾選：多個日期欄打「是」，連續日期算一趟；梯次：每個梯次欄各一趟；無：一人一趟、日期留空'],
  ['日期欄關鍵字', '文字', '標題含這段文字的欄位視為日期欄，例如「護七_行程」「梯」'],
  ['交通方式欄', '欄位', '去程、回程寫在同一欄時填這裡（例如「去程、回程(自行)」）'],
  ['去程交通欄', '欄位', '去程、回程分兩欄時：去程那一欄'],
  ['回程交通欄', '欄位', '去程、回程分兩欄時：回程那一欄'],
  ['義工組別欄', '欄位', '對應點名系統的「義工組別」'],
  ['領隊欄', '欄位', '有效資料中填領隊代號的欄位；產生時換算成名稱，此人每一趟都相同。對照表：有「領隊代號」分頁就用它，沒有就用預設（1 法師、2 總領隊、3 副總領隊、4 領隊、5 副領隊、6 貴賓資料）；要自訂請按選單「大車點名 → 領隊代號對照表」'],
  ['手機號碼欄', '欄位', '報名者本人的手機（不要選緊急聯絡人的電話）'],
  ['姓名欄', '欄位', '報名者姓名'],
  ['法名欄', '欄位', '報名者法名'],
  ['時間戳記欄', '欄位', '表單時間戳記：用來推算日期的年份，並辨識同一筆報名']
]);

// 大車點名可產生與匯出的活動狀態
const arr大車可匯出狀態 = Object.freeze(['收件中', '演練']);


// ============================================================================
// 甲、小工具（純計算，不碰檔案）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：是日期值_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：判斷是不是有效的日期（用 Object.prototype.toString，比 instanceof 穩定）。
 * 參數：any值 {*}
 * 傳回：{boolean}
 * ============================================================================
 */
function 是日期值_(any值) {
  return Object.prototype.toString.call(any值) === '[object Date]' && !isNaN(any值.getTime());
}


/**
 * ============================================================================
 * 函式名稱：擷取月日_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：找出文字中所有「月/日」，例如「11/28 (六)、11/29」。
 * 參數：any文字 {*}
 * 傳回：{Object[]} [ { int月, int日 } ]
 * ============================================================================
 */
function 擷取月日_(any文字) {
  const arr結果 = [];
  const reg月日 = /(\d{1,2})\s*\/\s*(\d{1,2})/g;
  let arr比對;
  while ((arr比對 = reg月日.exec(String(any文字 || ''))) !== null) {
    const int月 = Number(arr比對[1]);
    const int日 = Number(arr比對[2]);
    if (int月 >= 1 && int月 <= 12 && int日 >= 1 && int日 <= 31) arr結果.push({ int月: int月, int日: int日 });
  }
  return arr結果;
}


/**
 * ============================================================================
 * 函式名稱：推算月日日期_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：表單日期沒有年份：用報名時間的年份；月份比報名月份早超過 6 個月視為隔年
 *       （例如 12 月報名、1 月出發）。
 * 參數：
 *   obj月日     {Object} { int月, int日 }
 *   dat基準     {Date}   報名時間
 * 傳回：{Date}
 * ============================================================================
 */
function 推算月日日期_(obj月日, dat基準) {
  let int年 = dat基準.getFullYear();
  if (obj月日.int月 < dat基準.getMonth() + 1 - 6) int年 += 1;
  return new Date(int年, obj月日.int月 - 1, obj月日.int日);
}


/**
 * ============================================================================
 * 函式名稱：相差天數_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：兩個日期（只看年月日）相差幾天。
 * 參數：dat甲 {Date}；dat乙 {Date}
 * 傳回：{number}
 * ============================================================================
 */
function 相差天數_(dat甲, dat乙) {
  return Math.round((Date.UTC(dat乙.getFullYear(), dat乙.getMonth(), dat乙.getDate())
    - Date.UTC(dat甲.getFullYear(), dat甲.getMonth(), dat甲.getDate())) / 86400000);
}


/**
 * ============================================================================
 * 函式名稱：是否勾選_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：非空白、且不是「否／不／no／false／0」即視為有勾選或有填。
 * 參數：any值 {*}
 * 傳回：{boolean}
 * ============================================================================
 */
function 是否勾選_(any值) {
  if (any值 === true) return true;
  const str值 = String(any值 == null ? '' : any值).trim();
  return str值 !== '' && !/^(否|不|no|n|false|0)$/i.test(str值);
}


/**
 * ============================================================================
 * 函式名稱：格式化點名手機_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：統一為 0911-000000。9 碼且 9 開頭（開頭 0 被吃掉）補回 0；
 *       不是 09 開頭的 10 碼 → 保留原樣並標為有問題；空白不算問題。
 * 參數：any值 {*}
 * 傳回：{Object} { str值, bool有問題 }
 * ============================================================================
 */
function 格式化點名手機_(any值) {
  const str原 = String(any值 == null ? '' : any值).trim();
  if (str原 === '') return { str值: '', bool有問題: false };
  let str數字 = str原.replace(/\D/g, '');
  if (str數字.length === 9 && str數字.charAt(0) === '9') str數字 = '0' + str數字;
  if (/^09\d{8}$/.test(str數字)) return { str值: `${str數字.slice(0, 4)}-${str數字.slice(4)}`, bool有問題: false };
  return { str值: str原, bool有問題: true };
}


/**
 * ============================================================================
 * 函式名稱：換算領隊_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：有效資料的領隊代號依對照表換算成名稱。數字 2、文字「2」「2.0」都可；
 *       已填名稱也接受；空白＝不是領隊；找不到的保留原樣並標為有問題（黃底）。
 * 參數：
 *   any值         {*}      有效資料的值
 *   obj領隊代號   {Object} { 代號: 名稱 }
 * 傳回：{Object} { str值, bool有問題 }
 * ============================================================================
 */
function 換算領隊_(any值, obj領隊代號) {
  const str原 = String(any值 == null ? '' : any值).trim();
  if (str原 === '') return { str值: '', bool有問題: false };
  const str代號 = str原.replace(/\.0+$/, '');
  if (Object.prototype.hasOwnProperty.call(obj領隊代號, str代號)) return { str值: obj領隊代號[str代號], bool有問題: false };
  const arr名稱 = Object.keys(obj領隊代號).map(function (k) { return obj領隊代號[k]; });
  if (arr名稱.indexOf(str原) !== -1) return { str值: str原, bool有問題: false };
  return { str值: str原, bool有問題: true };
}


/**
 * ============================================================================
 * 函式名稱：列出領隊代號_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：對照表轉成「1 法師、2 總領隊…」。
 * 參數：obj領隊代號 {Object}
 * 傳回：{string}
 * ============================================================================
 */
function 列出領隊代號_(obj領隊代號) {
  const arr = Object.keys(obj領隊代號).map(function (k) { return `${k} ${obj領隊代號[k]}`; });
  return arr.length ? arr.join('、') : '（尚未設定）';
}


/**
 * ============================================================================
 * 函式名稱：判斷交通模式_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：含「自行／自己開車／自駕／自理／不搭」＝自行；含「搭／專車／大車／遊覽車／巴士」
 *       或寫了日期、時間＝搭車；其餘空白。
 * 參數：any文字 {*}
 * 傳回：{string} '自行'｜'搭車'｜''
 * ============================================================================
 */
function 判斷交通模式_(any文字) {
  const str = String(any文字 || '');
  if (/自行|自己開車|自駕|自理|不(需|用|要)?搭|免搭/.test(str)) return '自行';
  if (/搭|專車|大車|遊覽車|巴士|\d{1,2}\s*\/\s*\d{1,2}|\d{1,2}\s*[:：]\s*\d{2}/.test(str)) return '搭車';
  return '';
}


/**
 * ============================================================================
 * 函式名稱：判斷去程時段_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：有時間（如 15:00）→ 12 點前「上午」、之後「下午」；寫了上午／早上、下午／晚上也可判斷。
 * 參數：any文字 {*}
 * 傳回：{string} '上午'｜'下午'｜''
 * ============================================================================
 */
function 判斷去程時段_(any文字) {
  const str = String(any文字 || '');
  const arr時 = str.match(/(\d{1,2})\s*[:：]\s*\d{2}/);
  if (arr時) return Number(arr時[1]) < 12 ? '上午' : '下午';
  if (/上午|早上/.test(str)) return '上午';
  if (/下午|晚上/.test(str)) return '下午';
  return '';
}


/**
 * ============================================================================
 * 函式名稱：解析交通文字_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   拆出去程、回程各自的「模式、時段、日期」。
 *     · 合併一欄：以「去」「回」的位置切成兩段；「來回／往返」兩方向相同；
 *       某段自己看不出模式時（如「去程、回程(自行)」的「去程、」），沿用整段文字的模式
 *     · 分兩欄：各欄整段就是該方向
 * 參數：
 *   str合併   {string|null} 合併一欄的內容；分兩欄時傳 null
 *   str去程   {string|null}
 *   str回程   {string|null}
 * 傳回：{Object} { obj去程: { str模式, str時段, arr月日 }, obj回程: {…} }
 * ============================================================================
 */
function 解析交通文字_(str合併, str去程, str回程) {
  let str去段 = '';
  let str回段 = '';
  let str整段 = '';
  if (str合併 !== null) {
    const t = String(str合併 || '').trim();
    str整段 = t;
    const int去 = t.indexOf('去');
    const int回 = t.indexOf('回');
    if (/來回|往返/.test(t)) {
      str去段 = t; str回段 = t;
    } else if (int去 >= 0 && int回 >= 0) {
      if (int去 < int回) { str去段 = t.slice(int去, int回); str回段 = t.slice(int回); } else { str回段 = t.slice(int回, int去); str去段 = t.slice(int去); }
    } else if (int去 >= 0) {
      str去段 = t;
    } else if (int回 >= 0) {
      str回段 = t;
    } else {
      str去段 = t; str回段 = t;   // 沒寫去回（例如只寫「自行」）：兩方向相同
    }
  } else {
    str去段 = String(str去程 || '').trim();
    str回段 = String(str回程 || '').trim();
  }
  const str整段模式 = 判斷交通模式_(str整段);
  const fn組 = function (str段) {
    let str模式 = 判斷交通模式_(str段);
    if (str模式 === '' && str段 !== '' && str合併 !== null) str模式 = str整段模式;
    return { str模式: str模式, str時段: 判斷去程時段_(str段), arr月日: 擷取月日_(str段) };
  };
  return { obj去程: fn組(str去段), obj回程: fn組(str回段) };
}


/**
 * ============================================================================
 * 函式名稱：套用交通到趟_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：交通文字寫了日期、且這人有多趟時，只套用到日期落在範圍內的那一趟；否則每趟都套用。
 * 參數：
 *   obj方向   {Object} 解析交通文字_ 的 obj去程 或 obj回程
 *   obj趟     {Object} { dat起, dat迄 }
 *   int趟數   {number}
 *   dat基準   {Date}
 * 傳回：{Object} { str模式, str時段 }
 * ============================================================================
 */
function 套用交通到趟_(obj方向, obj趟, int趟數, dat基準) {
  if (int趟數 > 1 && obj方向.arr月日.length > 0 && obj趟.dat起) {
    const bool符合 = obj方向.arr月日.some(function (o) {
      const dat = 推算月日日期_(o, dat基準);
      return dat >= obj趟.dat起 && dat <= obj趟.dat迄;
    });
    if (!bool符合) return { str模式: '', str時段: '' };
  }
  return { str模式: obj方向.str模式, str時段: obj方向.str時段 };
}


/**
 * ============================================================================
 * 函式名稱：拆趟_逐日勾選_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：日期欄有勾的日期排序後，連續的日期併成一趟，中間空一天以上就拆開。
 * 參數：
 *   arr列       {Array}    有效資料一列
 *   arr日期欄   {Object[]} [ { int索引, str標題 } ]
 *   dat基準     {Date}
 * 傳回：{Object[]} [ { dat起, dat迄 } ]
 * ============================================================================
 */
function 拆趟_逐日勾選_(arr列, arr日期欄, dat基準) {
  const arr日期 = [];
  arr日期欄.forEach(function (obj欄) {
    if (!是否勾選_(arr列[obj欄.int索引])) return;
    const arr月日 = 擷取月日_(obj欄.str標題);
    if (arr月日.length > 0) arr日期.push(推算月日日期_(arr月日[0], dat基準));
  });
  const arr排序 = arr日期.sort(function (a, b) { return a - b; })
    .filter(function (d, i, a) { return i === 0 || d.getTime() !== a[i - 1].getTime(); });
  const arr趟 = [];
  arr排序.forEach(function (d) {
    const obj最後 = arr趟[arr趟.length - 1];
    if (obj最後 && 相差天數_(obj最後.dat迄, d) === 1) obj最後.dat迄 = d;   // 連續：延長這一趟
    else arr趟.push({ dat起: d, dat迄: d });                              // 有空檔：新的一趟
  });
  return arr趟;
}


/**
 * ============================================================================
 * 函式名稱：拆趟_梯次_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：每個有填的梯次欄各一趟；起訖取欄位內容中第一個與最後一個日期，內容沒有日期就用標題的日期。
 * 參數：同 拆趟_逐日勾選_
 * 傳回：{Object[]} [ { dat起, dat迄 } ]
 * ============================================================================
 */
function 拆趟_梯次_(arr列, arr日期欄, dat基準) {
  const arr趟 = [];
  arr日期欄.forEach(function (obj欄) {
    const any值 = arr列[obj欄.int索引];
    if (!是否勾選_(any值)) return;
    let arr月日 = 擷取月日_(String(any值));
    if (arr月日.length === 0) arr月日 = 擷取月日_(obj欄.str標題);
    if (arr月日.length === 0) return;   // 判斷不出日期：不成趟（全部判斷不出時由呼叫者標「日期」問題）
    const arr日期 = arr月日.map(function (o) { return 推算月日日期_(o, dat基準); }).sort(function (a, b) { return a - b; });
    arr趟.push({ dat起: arr日期[0], dat迄: arr日期[arr日期.length - 1] });
  });
  return arr趟.sort(function (a, b) { return a.dat起 - b.dat起; });
}


/**
 * ============================================================================
 * 函式名稱：解析點名日期值_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：同名「日期-起／日期-迄」欄的值轉成日期：日期格式直接用；「2026/11/30」含年份；
 *       「11/30」依報名時間推算年份。判斷不出傳回 null。
 * 參數：any值 {*}；dat基準 {Date}
 * 傳回：{Date|null}
 * ============================================================================
 */
function 解析點名日期值_(any值, dat基準) {
  if (是日期值_(any值)) return new Date(any值.getFullYear(), any值.getMonth(), any值.getDate());
  const str = String(any值 == null ? '' : any值).trim();
  if (str === '') return null;
  const arr = str.match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (arr) return new Date(Number(arr[1]), Number(arr[2]) - 1, Number(arr[3]));
  const arr月日 = 擷取月日_(str);
  return arr月日.length > 0 ? 推算月日日期_(arr月日[0], dat基準) : null;
}


/**
 * ============================================================================
 * 函式名稱：點名同名欄位轉文字_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：有效資料同名欄位的值轉成寫入點名資料的文字：數字 1 或 1.0 →「1」；日期 → 月/日；其餘去空白。
 * 參數：any值 {*}
 * 傳回：{string}
 * ============================================================================
 */
function 點名同名欄位轉文字_(any值) {
  if (是日期值_(any值)) return `${any值.getMonth() + 1}/${any值.getDate()}`;
  return String(any值 == null ? '' : any值).trim().replace(/^(\d+)\.0+$/, '$1');
}


/**
 * ============================================================================
 * 函式名稱：建立趟次鍵_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：時間戳記＋姓名＋法名＋趟次開始日，辨識同一趟（重新產生時保留承辦人填的資料）。
 * 參數：any時間 {*}；str姓名 {string}；str法名 {string}；dat起 {Date|null}
 * 傳回：{string}
 * ============================================================================
 */
function 建立趟次鍵_(any時間, str姓名, str法名, dat起) {
  const str時間 = 是日期值_(any時間) ? 格式化日期(any時間, 'yyyyMMddHHmmss') : String(any時間 == null ? '' : any時間).trim();
  const str起 = dat起 ? 格式化日期(dat起, 'yyyyMMdd') : '無日期';
  return [str時間, str姓名, str法名, str起].join('|');
}


// ============================================================================
// 乙、點名欄位設定（副本「點名欄位設定」分頁）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：推測大車點名設定_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   依「有效資料」的標題自動判斷各設定項目，判斷不出為空字串。
 *   有完全同名的欄位（如「手機號碼」「義工組別」「領隊」）優先使用；緊急聯絡人欄位一律排除。
 *   日期：標題有「梯」＝梯次；否則找「標題含月/日」最多的同一前綴（至少 2 欄）＝逐日勾選；都沒有＝無。
 * 參數：
 *   arr標題   {string[]} 有效資料第 1 列
 * 傳回：{Object} { 設定項目: 值 }
 * ============================================================================
 */
function 推測大車點名設定_(arr標題) {
  const obj結果 = {};
  const fn找第一個 = function (fn條件) {
    for (let i = 0; i < arr標題.length; i++) { if (arr標題[i] && fn條件(arr標題[i])) return arr標題[i]; }
    return '';
  };
  const fn非緊急 = function (s) { return s.indexOf('緊急') < 0 && s.indexOf('聯絡人') < 0; };
  const fn同名 = function (s) { return arr標題.indexOf(s) >= 0 ? s : ''; };

  // 姓名、法名、時間戳記：用別名對照（與重複檢查相同）
  ['姓名', '法名', '時間戳記'].forEach(function (str名) {
    const int索引 = 尋找副本欄位索引_(arr標題, str名);
    obj結果[`${str名}欄`] = int索引 >= 0 ? arr標題[int索引] : '';
  });
  obj結果['手機號碼欄'] = fn同名('手機號碼') || fn找第一個(function (s) { return s.indexOf('手機') >= 0 && fn非緊急(s); })
    || fn找第一個(function (s) { return s.indexOf('電話') >= 0 && fn非緊急(s); });
  obj結果['義工組別欄'] = fn同名('義工組別') || fn找第一個(function (s) { return s.indexOf('組別') >= 0 && fn非緊急(s); });
  obj結果['領隊欄'] = fn同名('領隊') || fn找第一個(function (s) { return s.indexOf('領隊') >= 0; });

  // 交通方式：一欄＝合併；兩欄以上＝去程／回程各一欄
  const arr交通 = arr標題.filter(function (s) { return s && s.indexOf('交通') >= 0; });
  obj結果['交通方式欄'] = '';
  obj結果['去程交通欄'] = '';
  obj結果['回程交通欄'] = '';
  if (arr交通.length === 1) {
    obj結果['交通方式欄'] = arr交通[0];
  } else if (arr交通.length >= 2) {
    obj結果['去程交通欄'] = arr交通.filter(function (s) { return s.indexOf('去') >= 0; })[0] || arr交通[0];
    obj結果['回程交通欄'] = arr交通.filter(function (s) { return s.indexOf('回') >= 0; })[0] || arr交通[1];
  }

  // 日期
  const arr候選 = arr標題.filter(function (s) { return s && s.indexOf('交通') < 0 && s.indexOf('時間戳記') < 0; });
  if (arr候選.some(function (s) { return s.indexOf('梯') >= 0; })) {
    obj結果['日期型態'] = '梯次';
    obj結果['日期欄關鍵字'] = '梯';
  } else {
    const obj前綴計數 = {};
    arr候選.forEach(function (s) {
      if (擷取月日_(s).length === 0) return;
      const str前綴 = s.split(/[\[［(（]|\d{1,2}\s*\/\s*\d{1,2}/)[0].trim();
      if (str前綴) obj前綴計數[str前綴] = (obj前綴計數[str前綴] || 0) + 1;
    });
    const arr排序 = Object.keys(obj前綴計數).sort(function (a, b) { return obj前綴計數[b] - obj前綴計數[a]; });
    if (arr排序.length > 0 && obj前綴計數[arr排序[0]] >= 2) {
      obj結果['日期型態'] = '逐日勾選';
      obj結果['日期欄關鍵字'] = arr排序[0];
    } else {
      obj結果['日期型態'] = '無';
      obj結果['日期欄關鍵字'] = '';
    }
  }
  return obj結果;
}


/**
 * ============================================================================
 * 函式名稱：說明大車點名設定_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：第一次產生時，把推測結果整理成給承辦人看的幾行文字。
 * 參數：obj設定 {Object} 推測大車點名設定_ 的結果
 * 傳回：{string[]}
 * ============================================================================
 */
function 說明大車點名設定_(obj設定) {
  const arr = [`日期型態：${obj設定['日期型態'] || '（判斷不出）'}${obj設定['日期欄關鍵字'] ? `（日期欄：標題含「${obj設定['日期欄關鍵字']}」）` : ''}`];
  if (obj設定['交通方式欄']) arr.push(`交通方式：${obj設定['交通方式欄']}`);
  if (obj設定['去程交通欄']) arr.push(`去程交通：${obj設定['去程交通欄']}；回程交通：${obj設定['回程交通欄'] || '（無）'}`);
  if (!obj設定['交通方式欄'] && !obj設定['去程交通欄']) arr.push('交通方式：找不到，去程／回程會全部留空');
  arr.push(`義工組別：${obj設定['義工組別欄'] || '（找不到，將留空）'}`);
  arr.push(`領隊代號：${obj設定['領隊欄'] || '（找不到，領隊將留空）'}；換算用預設對照表（${列出領隊代號_(obj大車點名設定.obj預設領隊代號)}）`);
  arr.push(`手機號碼：${obj設定['手機號碼欄'] || '（找不到，將留空）'}`);
  return arr;
}


/**
 * ============================================================================
 * 函式名稱：建立大車點名設定分頁_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：建立「點名欄位設定」分頁：A 設定項目｜B 設定值｜C 說明。
 *       欄位類設下拉選單（有效資料的欄名），日期型態三選一；判斷不出的必要項目標黃。
 * 參數：
 *   obj副本   {Spreadsheet}
 *   arr標題   {string[]} 有效資料標題
 *   obj推測   {Object}   推測大車點名設定_ 的結果
 * 傳回：{Sheet}
 * ============================================================================
 */
function 建立大車點名設定分頁_(obj副本, arr標題, obj推測) {
  const obj分頁 = obj副本.insertSheet(obj大車點名設定.str設定分頁名);
  const arr列 = [['設定項目', '設定值', '說明']].concat(arr大車點名設定項目.map(function (arr) {
    return [arr[0], obj推測[arr[0]] || '', arr[2]];
  }));
  obj分頁.getRange(1, 1, arr列.length, 3).setValues(arr列);
  obj分頁.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#f3e8d6');
  obj分頁.setFrozenRows(1);
  obj分頁.setColumnWidth(1, 110);
  obj分頁.setColumnWidth(2, 260);
  obj分頁.setColumnWidth(3, 520);

  const arr欄位清單 = arr標題.filter(function (s) { return s !== ''; });
  arr大車點名設定項目.forEach(function (arr, i) {
    const obj格 = obj分頁.getRange(i + 2, 2);
    if (arr[1] === '型態') {
      obj格.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(obj大車點名設定.arr日期型態, true).build());
    } else if (arr[1] === '欄位' && arr欄位清單.length > 0) {
      // 允許清單外的值（欄位日後改名時不會被擋）；清單最多 500 項
      obj格.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(arr欄位清單.slice(0, 500), true).setAllowInvalid(true).build());
    }
    const bool必要 = ['日期型態', '姓名欄', '時間戳記欄'].indexOf(arr[0]) >= 0;
    if (bool必要 && !obj推測[arr[0]]) obj格.setBackground(obj大車點名設定.str問題底色);
  });
  return obj分頁;
}


/**
 * ============================================================================
 * 函式名稱：讀取大車點名設定_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：讀「點名欄位設定」A、B 欄成 { 設定項目: 值 }。
 * 參數：obj分頁 {Sheet}
 * 傳回：{Object}
 * ============================================================================
 */
function 讀取大車點名設定_(obj分頁) {
  const obj設定 = {};
  const int列 = obj分頁.getLastRow();
  if (int列 < 2) return obj設定;
  obj分頁.getRange(2, 1, int列 - 1, 2).getValues().forEach(function (arr) {
    const str項 = String(arr[0]).trim();
    if (str項) obj設定[str項] = String(arr[1] == null ? '' : arr[1]).trim();
  });
  return obj設定;
}


/**
 * ============================================================================
 * 函式名稱：補齊大車點名設定_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：系統新增設定項目後，舊副本的設定分頁缺那幾列：補在最後（值用推測結果），已有的項目不動。
 * 參數：obj分頁 {Sheet}；arr標題 {string[]}
 * 傳回：無
 * ============================================================================
 */
function 補齊大車點名設定_(obj分頁, arr標題) {
  const obj現有 = 讀取大車點名設定_(obj分頁);
  const arr缺少 = arr大車點名設定項目.filter(function (arr) { return !(arr[0] in obj現有); });
  if (arr缺少.length === 0) return;
  const obj推測 = 推測大車點名設定_(arr標題);
  const int起始 = obj分頁.getLastRow() + 1;
  obj分頁.getRange(int起始, 1, arr缺少.length, 3).setValues(arr缺少.map(function (arr) {
    return [arr[0], obj推測[arr[0]] || '', arr[2]];
  }));
}


/**
 * ============================================================================
 * 函式名稱：解析大車設定欄位_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：把設定中的欄位名稱轉成欄索引（0 起算），並找出日期欄與同名欄位。
 *       設定的欄位在「有效資料」找不到時，以白話說明丟錯（例如欄位被改名）。
 * 參數：
 *   obj設定   {Object}   讀取大車點名設定_ 的結果
 *   arr標題   {string[]} 有效資料標題
 * 傳回：{Object} { int姓名, int法名, int時間戳記, int手機, int組別, int領隊, int交通, int去程交通, int回程交通,
 *                  str日期型態, arr日期欄: [ { int索引, str標題 } ], obj同名索引: { 點名欄位: 索引 } }（找不到的選用欄位為 -1）
 * ============================================================================
 */
function 解析大車設定欄位_(obj設定, arr標題) {
  const str設定分頁 = obj大車點名設定.str設定分頁名;
  const fn取索引 = function (str項目, bool必要) {
    const str欄名 = obj設定[str項目] || '';
    if (str欄名 === '') {
      if (bool必要) throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${str設定分頁}」的「${str項目}」是空白的，請選擇對應的欄位。`);
      return -1;
    }
    const int索引 = arr標題.indexOf(str欄名);
    if (int索引 < 0) {
      throw new 平台錯誤(obj錯誤代碼.欄位缺漏,
        `「${str設定分頁}」的「${str項目}」設為「${str欄名}」，但有效資料中找不到這個欄位（可能被改名），請重新選擇。`);
    }
    return int索引;
  };

  const str型態 = obj設定['日期型態'] || '無';
  if (obj大車點名設定.arr日期型態.indexOf(str型態) < 0) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「日期型態」只能是：${obj大車點名設定.arr日期型態.join('、')}（目前是「${str型態}」）。`);
  }
  const str關鍵字 = obj設定['日期欄關鍵字'] || '';
  const arr日期欄 = [];
  if (str型態 !== '無') {
    if (str關鍵字 === '') {
      throw new 平台錯誤(obj錯誤代碼.參數錯誤, `日期型態是「${str型態}」，但「日期欄關鍵字」是空白的，請填入日期欄標題共同的文字。`);
    }
    arr標題.forEach(function (s, i) {
      if (!s || s.indexOf(str關鍵字) < 0 || s.indexOf('交通') >= 0) return;
      if (str型態 === '逐日勾選' && 擷取月日_(s).length === 0) return;   // 逐日勾選：標題必須含日期
      arr日期欄.push({ int索引: i, str標題: s });
    });
    if (arr日期欄.length === 0) {
      throw new 平台錯誤(obj錯誤代碼.欄位缺漏, `有效資料中找不到標題含「${str關鍵字}」的日期欄，請檢查「日期欄關鍵字」。`);
    }
  }

  // 同名欄位：日期-起／日期-迄 只在日期型態＝無時納入
  const obj同名索引 = {};
  obj大車點名設定.arr同名寫入欄位.concat(str型態 === '無' ? obj大車點名設定.arr同名日期欄位 : []).forEach(function (str欄) {
    const i = arr標題.indexOf(str欄);
    if (i >= 0) obj同名索引[str欄] = i;
  });

  return {
    int姓名: fn取索引('姓名欄', true), int法名: fn取索引('法名欄', false), int時間戳記: fn取索引('時間戳記欄', false),
    int手機: fn取索引('手機號碼欄', false), int組別: fn取索引('義工組別欄', false), int領隊: fn取索引('領隊欄', false),
    int交通: fn取索引('交通方式欄', false), int去程交通: fn取索引('去程交通欄', false), int回程交通: fn取索引('回程交通欄', false),
    str日期型態: str型態, arr日期欄: arr日期欄, obj同名索引: obj同名索引
  };
}


/**
 * ============================================================================
 * 函式名稱：讀取領隊代號_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：副本有「領隊代號」分頁 → 讀 A:B 成 { 代號: 名稱 }；沒有就用預設。
 *       分頁是空的、代號沒填名稱、同代號兩個名稱時以白話說明丟錯。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{Object} { obj表, bool自訂 }
 * ============================================================================
 */
function 讀取領隊代號_(obj副本) {
  const str分頁名 = obj大車點名設定.str領隊代號分頁名;
  const obj分頁 = obj副本.getSheetByName(str分頁名);
  if (!obj分頁) return { obj表: Object.assign({}, obj大車點名設定.obj預設領隊代號), bool自訂: false };

  const obj表 = {};
  const int列 = obj分頁.getLastRow();
  if (int列 >= 2) {
    obj分頁.getRange(2, 1, int列 - 1, 2).getValues().forEach(function (arr) {
      const str代號 = String(arr[0] == null ? '' : arr[0]).trim().replace(/\.0+$/, '');
      const str名稱 = String(arr[1] == null ? '' : arr[1]).trim();
      if (str代號 === '') return;
      if (str名稱 === '') throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${str分頁名}」分頁的代號「${str代號}」沒有填名稱，請補上名稱或刪除這個代號。`);
      if ((str代號 in obj表) && obj表[str代號] !== str名稱) {
        throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${str分頁名}」分頁的代號「${str代號}」出現兩次（${obj表[str代號]}、${str名稱}），請保留一個。`);
      }
      obj表[str代號] = str名稱;
    });
  }
  if (Object.keys(obj表).length === 0) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${str分頁名}」分頁是空的。請填入代號與名稱；若要改回預設，直接刪除這個分頁即可。`);
  }
  return { obj表: obj表, bool自訂: true };
}


/**
 * ============================================================================
 * 函式名稱：建立領隊代號分頁_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：建立「領隊代號」分頁並填入預設 1～6，讓承辦人依本活動修改。已存在時不覆蓋，只回報目前內容。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{Object} { bool新建, str訊息 }
 * ============================================================================
 */
function 建立領隊代號分頁_(obj副本) {
  const str分頁名 = obj大車點名設定.str領隊代號分頁名;
  if (obj副本.getSheetByName(str分頁名)) {
    let str目前 = '';
    try { str目前 = 列出領隊代號_(讀取領隊代號_(obj副本).obj表); } catch (err) { str目前 = `（目前內容有誤：${err.message}）`; }
    return { bool新建: false, str訊息: `「${str分頁名}」分頁已經存在，請直接修改。目前代號：${str目前}\n要改回預設，刪除這個分頁即可。` };
  }
  const obj預設 = obj大車點名設定.obj預設領隊代號;
  const obj分頁 = obj副本.insertSheet(str分頁名);
  const arr列 = [obj大車點名設定.arr領隊代號標題.slice()].concat(Object.keys(obj預設).map(function (k) { return [k, obj預設[k]]; }));
  obj分頁.getRange(1, 1, arr列.length, 2).setNumberFormat('@').setValues(arr列);   // 代號存成文字，「01」不會變成 1
  obj分頁.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3e8d6');
  obj分頁.getRange(1, 1).setNote('有效資料「領隊」欄填代號，產生點名資料時換算成 B 欄的名稱。可新增、刪除、改名；代號不可重複。刪除這個分頁＝改回系統預設。');
  obj分頁.setFrozenRows(1);
  return { bool新建: true, str訊息: `已建立「${str分頁名}」分頁，並填入預設代號：${列出領隊代號_(obj預設)}。\n可依本活動新增、刪除或改名；之後產生點名資料就照這個分頁換算。要改回預設，刪除這個分頁即可。` };
}


// ============================================================================
// 丙、拆趟與合併寫入
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：計算個人趟次_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   把「有效資料」的一列（一個人）拆成一趟或多趟，並算出系統欄位與預填值：
 *     · 系統欄位：姓名、法名、手機（0911-000000）、領隊（代號→名稱）、日期-起／迄、義工組別
 *     · 預填（空白時才填）：去程／回程「自行」、去程時段「上午／下午」
 *     · 覆寫：有效資料同名欄位有值者，寫入此人每一趟
 * 參數：
 *   arr列   {Array}  有效資料一列
 *   obj欄   {Object} 解析大車設定欄位_ 的結果（另含 obj領隊代號）
 * 傳回：{Object[]} [ { str鍵, obj值, obj預填, obj覆寫, arr問題欄 } ]
 * ============================================================================
 */
function 計算個人趟次_(arr列, obj欄) {
  const fn取 = function (int索引) { return int索引 >= 0 ? arr列[int索引] : ''; };
  const any時間 = fn取(obj欄.int時間戳記);
  const dat基準 = 是日期值_(any時間) ? any時間 : new Date();
  const str姓名 = String(fn取(obj欄.int姓名)).trim();
  const str法名 = String(fn取(obj欄.int法名)).trim();
  const obj手機 = 格式化點名手機_(fn取(obj欄.int手機));
  const str組別 = String(fn取(obj欄.int組別)).trim();
  const obj領隊 = 換算領隊_(fn取(obj欄.int領隊), obj欄.obj領隊代號);

  // ① 拆趟
  let arr趟 = [];
  if (obj欄.str日期型態 === '逐日勾選') arr趟 = 拆趟_逐日勾選_(arr列, obj欄.arr日期欄, dat基準);
  else if (obj欄.str日期型態 === '梯次') arr趟 = 拆趟_梯次_(arr列, obj欄.arr日期欄, dat基準);

  // 日期型態「無」且有同名「日期-起／日期-迄」→ 用它們作為這一趟的日期
  let bool同名日期有問題 = false;
  if (obj欄.str日期型態 === '無' && ('日期-起' in obj欄.obj同名索引)) {
    const any起 = fn取(obj欄.obj同名索引['日期-起']);
    const any迄 = ('日期-迄' in obj欄.obj同名索引) ? fn取(obj欄.obj同名索引['日期-迄']) : '';
    const dat起 = 解析點名日期值_(any起, dat基準);
    const dat迄 = 解析點名日期值_(any迄, dat基準) || dat起;
    if (dat起) arr趟 = [{ dat起: dat起, dat迄: dat迄 }];
    else if (String(any起).trim() !== '') bool同名日期有問題 = true;
  }
  const bool無日期 = arr趟.length === 0;
  if (bool無日期) arr趟 = [{ dat起: null, dat迄: null }];

  // ② 同名欄位覆寫
  const obj覆寫 = {};
  obj大車點名設定.arr同名寫入欄位.forEach(function (k) {
    if (!(k in obj欄.obj同名索引)) return;
    const str值 = 點名同名欄位轉文字_(fn取(obj欄.obj同名索引[k]));
    if (str值 !== '') obj覆寫[k] = str值;
  });

  // ③ 交通方式
  const obj交通 = obj欄.int交通 >= 0
    ? 解析交通文字_(String(fn取(obj欄.int交通)), null, null)
    : 解析交通文字_(null, String(fn取(obj欄.int去程交通)), String(fn取(obj欄.int回程交通)));

  // ④ 每趟一列
  return arr趟.map(function (obj趟) {
    const obj去 = 套用交通到趟_(obj交通.obj去程, obj趟, arr趟.length, dat基準);
    const obj回 = 套用交通到趟_(obj交通.obj回程, obj趟, arr趟.length, dat基準);
    const arr問題欄 = [];
    if (obj手機.bool有問題) arr問題欄.push('手機號碼');
    if (obj領隊.bool有問題) arr問題欄.push('領隊');
    if ((bool無日期 && obj欄.str日期型態 !== '無') || bool同名日期有問題) arr問題欄.push('日期-起', '日期-迄');
    return {
      str鍵: 建立趟次鍵_(any時間, str姓名, str法名, obj趟.dat起),
      obj值: {
        '姓名': str姓名, '法名': str法名, '手機號碼': obj手機.str值, '領隊': obj領隊.str值,
        '日期-起': obj趟.dat起 || '', '日期-迄': obj趟.dat迄 || '', '義工組別': str組別
      },
      obj預填: { '去程': obj去.str模式 === '自行' ? '自行' : '', '回程': obj回.str模式 === '自行' ? '自行' : '', '去程時段': obj去.str時段 || '' },
      obj覆寫: obj覆寫,
      arr問題欄: arr問題欄
    };
  });
}


/**
 * ============================================================================
 * 函式名稱：合併寫入點名分頁_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   ① 分頁不存在 → 建立；存在但沒有「系統_趟次鍵」欄（舊格式）→ 改名保留，另建新分頁
 *   ② 既有列依標題讀成物件，以趟次鍵對應：仍存在 → 更新系統欄位、承辦人欄位空白才預填、同名欄位覆寫；
 *      已不存在 → 標「已消失」；沒有鍵（承辦人自己加的列）→ 原樣保留
 *   ③ 新趟次加在最後
 *   ④ 依標準欄序整批寫回（16 欄＋2 個隱藏系統欄）；系統欄位的問題格標黃
 *   ⑤ 條件式格式：待分車（淡藍）、已消失（灰色刪除線）
 * 參數：
 *   obj副本         {Spreadsheet}
 *   arr趟次         {Object[]}    計算個人趟次_ 的結果
 *   obj領隊代號     {Object}
 *   bool自訂代號    {boolean}
 * 傳回：{Object} { int趟數, int新增, int已消失, int待分車, int問題格, int領隊問題, str舊版備份 }
 * ============================================================================
 */
function 合併寫入點名分頁_(obj副本, arr趟次, obj領隊代號, bool自訂代號) {
  const cfg = obj大車點名設定;
  const arr輸出標題 = obj大車點名格式.arr名單欄位.concat([cfg.str鍵欄名, cfg.str狀態欄名]);
  const int欄數 = arr輸出標題.length;
  let str舊版備份 = '';

  // ① 取得分頁（舊格式改名保留）
  let obj分頁 = obj副本.getSheetByName(cfg.str點名分頁名);
  if (obj分頁 && obj分頁.getLastRow() >= 1 && obj分頁.getLastColumn() >= 1) {
    const arr現有標題 = obj分頁.getRange(1, 1, 1, obj分頁.getLastColumn()).getValues()[0].map(function (v) { return String(v).trim(); });
    if (arr現有標題.indexOf(cfg.str鍵欄名) < 0) {
      str舊版備份 = `${cfg.str點名分頁名}_舊版_${格式化日期(new Date(), 'yyyyMMdd_HHmm')}`;
      obj分頁.setName(str舊版備份);
      obj分頁 = null;
    }
  }
  if (!obj分頁) obj分頁 = obj副本.insertSheet(cfg.str點名分頁名);

  // ② 讀既有列
  const arr既有 = [];
  const int既有列 = obj分頁.getLastRow();
  if (int既有列 >= 2) {
    const arr值 = obj分頁.getRange(1, 1, int既有列, Math.max(obj分頁.getLastColumn(), 1)).getValues();
    const arr舊標題 = arr值[0].map(function (v) { return String(v).trim(); });
    arr值.slice(1).forEach(function (arr列) {
      const obj = {};
      arr輸出標題.forEach(function (str欄) {
        const i = arr舊標題.indexOf(str欄);
        obj[str欄] = i >= 0 ? arr列[i] : '';
      });
      const bool全空 = arr輸出標題.every(function (k) { return String(obj[k]).trim() === ''; });
      if (!bool全空) arr既有.push({ obj值: obj, arr問題欄: [] });
    });
  }

  // 對應更新
  const obj新對照 = {};
  arr趟次.forEach(function (o) { obj新對照[o.str鍵] = o; });
  const obj已用 = {};
  let int已消失 = 0;
  arr既有.forEach(function (o列) {
    const str鍵 = String(o列.obj值[cfg.str鍵欄名] || '').trim();
    if (str鍵 === '') return;                          // 承辦人自己加的列：原樣保留
    const o新 = obj新對照[str鍵];
    if (!o新 || obj已用[str鍵]) {                       // 已不在有效資料（或重複鍵）
      o列.obj值[cfg.str狀態欄名] = cfg.str已消失;
      int已消失 += 1;
      return;
    }
    obj已用[str鍵] = true;
    cfg.arr系統欄位.forEach(function (k) { o列.obj值[k] = o新.obj值[k]; });
    Object.keys(o新.obj預填).forEach(function (k) {
      if (String(o列.obj值[k]).trim() === '' && o新.obj預填[k]) o列.obj值[k] = o新.obj預填[k];
    });
    Object.keys(o新.obj覆寫 || {}).forEach(function (k) { o列.obj值[k] = o新.obj覆寫[k]; });
    o列.obj值[cfg.str狀態欄名] = '';
    o列.arr問題欄 = o新.arr問題欄;
  });

  // ③ 新趟次
  let int新增 = 0;
  arr趟次.forEach(function (o) {
    if (obj已用[o.str鍵]) return;
    obj已用[o.str鍵] = true;
    const obj = {};
    arr輸出標題.forEach(function (k) { obj[k] = ''; });
    cfg.arr系統欄位.forEach(function (k) { obj[k] = o.obj值[k]; });
    Object.keys(o.obj預填).forEach(function (k) { obj[k] = o.obj預填[k]; });
    Object.keys(o.obj覆寫 || {}).forEach(function (k) { obj[k] = o.obj覆寫[k]; });
    obj[cfg.str鍵欄名] = o.str鍵;
    arr既有.push({ obj值: obj, arr問題欄: o.arr問題欄 });
    int新增 += 1;
  });

  // ④ 整批寫回
  const int資料列 = arr既有.length;
  const int需要列 = int資料列 + 1;
  if (int需要列 > obj分頁.getMaxRows()) obj分頁.insertRowsAfter(obj分頁.getMaxRows(), int需要列 - obj分頁.getMaxRows());
  if (int欄數 > obj分頁.getMaxColumns()) obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), int欄數 - obj分頁.getMaxColumns());
  if (int既有列 > int需要列) obj分頁.getRange(int需要列 + 1, 1, int既有列 - int需要列, int欄數).clearContent();
  const fn欄號 = function (k) { return arr輸出標題.indexOf(k) + 1; };
  // 手機、領隊、去程、回程、去程時段為純文字（車次「1」不會變成數字）；日期為「月/日」
  ['手機號碼', '領隊', '去程', '回程', '去程時段', cfg.str鍵欄名].forEach(function (k) {
    obj分頁.getRange(2, fn欄號(k), Math.max(int資料列, 1), 1).setNumberFormat('@');
  });
  ['日期-起', '日期-迄'].forEach(function (k) {
    obj分頁.getRange(2, fn欄號(k), Math.max(int資料列, 1), 1).setNumberFormat(cfg.str日期格式);
  });
  obj分頁.getRange(1, 1, 1, int欄數).setValues([arr輸出標題]).setFontWeight('bold');
  obj分頁.getRange(1, fn欄號('領隊')).setNote(`由有效資料「領隊」代號換算，每人各趟相同；要修改請改有效資料後重新產生。代號：${列出領隊代號_(obj領隊代號 || {})}`
    + (bool自訂代號 ? `（來自「${cfg.str領隊代號分頁名}」分頁）` : '（系統預設；要自訂請按選單「大車點名 → 領隊代號對照表」）'));
  if (int資料列 > 0) {
    obj分頁.getRange(2, 1, int資料列, int欄數).setValues(arr既有.map(function (o) {
      return arr輸出標題.map(function (k) { const v = o.obj值[k]; return (v === null || v === undefined) ? '' : v; });
    }));
  }

  // 系統欄位的問題格標黃（只動系統欄位，承辦人欄位的底色不碰）
  let int問題格 = 0;
  if (int資料列 > 0) {
    cfg.arr系統欄位.forEach(function (k) {
      obj分頁.getRange(2, fn欄號(k), int資料列, 1).setBackgrounds(arr既有.map(function (o) {
        const bool問題 = o.arr問題欄.indexOf(k) >= 0 && o.obj值[cfg.str狀態欄名] !== cfg.str已消失;
        if (bool問題) int問題格 += 1;
        return [bool問題 ? cfg.str問題底色 : null];
      }));
    });
  }

  // ⑤ 條件式格式、隱藏系統欄、凍結標題
  套用點名條件格式_(obj分頁, fn欄號, int欄數);
  obj分頁.hideColumns(fn欄號(cfg.str鍵欄名), 2);
  obj分頁.setFrozenRows(1);

  // 統計
  let int趟數 = 0;
  let int待分車 = 0;
  let int領隊問題 = 0;
  arr既有.forEach(function (o) {
    if (o.obj值[cfg.str狀態欄名] === cfg.str已消失) return;
    if (String(o.obj值['姓名']).trim() === '') return;
    int趟數 += 1;
    if (String(o.obj值['去程']).trim() === '' || String(o.obj值['回程']).trim() === '') int待分車 += 1;
    if (o.arr問題欄.indexOf('領隊') >= 0) int領隊問題 += 1;
  });
  return { int趟數: int趟數, int新增: int新增, int已消失: int已消失, int待分車: int待分車, int問題格: int問題格,
    int領隊問題: int領隊問題, str舊版備份: str舊版備份 };
}


/**
 * ============================================================================
 * 函式名稱：套用點名條件格式_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：兩條規則（可重複執行，不疊加）：
 *   ① 去程或回程空白（且有姓名、未消失）→ 整列淡藍＝待分車；填好自動消失
 *   ② 系統_狀態＝已消失 → 整列灰字刪除線
 *   以公式文字辨識本系統的舊規則；承辦人自己加的規則不動。
 * 參數：obj分頁 {Sheet}；fn欄號 {Function}；int欄數 {number}
 * 傳回：無
 * ============================================================================
 */
function 套用點名條件格式_(obj分頁, fn欄號, int欄數) {
  const cfg = obj大車點名設定;
  const fn字母 = function (k) { return 轉為欄位字母_(fn欄號(k)); };
  const str姓 = fn字母('姓名');
  const str狀 = fn字母(cfg.str狀態欄名);
  const str公式待分車 = `=AND($${str姓}2<>"",$${str狀}2<>"${cfg.str已消失}",OR($${fn字母('去程')}2="",$${fn字母('回程')}2=""))`;
  const str公式已消失 = `=$${str狀}2="${cfg.str已消失}"`;
  const arr保留 = obj分頁.getConditionalFormatRules().filter(function (obj規則) {
    const obj條件 = obj規則.getBooleanCondition();
    if (!obj條件) return true;
    const arr值 = obj條件.getCriteriaValues();
    const str = (arr值 && arr值[0]) ? String(arr值[0]) : '';
    return str !== str公式待分車 && str !== str公式已消失;
  });
  const obj範圍 = obj分頁.getRange(2, 1, Math.max(obj分頁.getMaxRows() - 1, 1), int欄數);
  arr保留.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(str公式已消失)
    .setFontColor(cfg.str已消失文字色).setStrikethrough(true).setRanges([obj範圍]).build());
  arr保留.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(str公式待分車)
    .setBackground(cfg.str待分車底色).setRanges([obj範圍]).build());
  obj分頁.setConditionalFormatRules(arr保留);
}


/**
 * ============================================================================
 * 函式名稱：產生大車點名資料_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   只處理副本本身（不碰主控台，方便測試）。第一次（副本沒有「點名欄位設定」）
 *   只建立設定分頁並停下，請承辦人確認後再產生，避免猜錯日期欄而產生一批之後又「已消失」的趟次。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{Object} { bool需確認設定, str訊息, arr明細, int趟數, int新增, int已消失, int待分車, int問題格 }
 * ============================================================================
 */
function 產生大車點名資料_(obj副本) {
  // ① 讀有效資料
  const obj來源 = 取得副本分頁_(obj副本, '有效資料');
  const int最後列 = obj來源.getLastRow();
  const int最後欄 = obj來源.getLastColumn();
  if (int最後列 < 2 || int最後欄 < 1) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, '「有效資料」沒有任何資料，無法產生點名資料。');
  }
  const arr全部 = obj來源.getRange(1, 1, int最後列, int最後欄).getValues();
  const arr標題 = arr全部[0].map(function (v) { return String(v).trim(); });
  const arr資料 = arr全部.slice(1);

  // ② 點名欄位設定：沒有就建立並停下
  const str設定分頁名 = obj大車點名設定.str設定分頁名;
  const obj設定分頁 = obj副本.getSheetByName(str設定分頁名);
  if (!obj設定分頁) {
    const obj推測 = 推測大車點名設定_(arr標題);
    建立大車點名設定分頁_(obj副本, arr標題, obj推測);
    return {
      bool需確認設定: true,
      str訊息: `這是第一次產生，系統已依「有效資料」的欄位自動建立「${str設定分頁名}」分頁。請先確認每一項是否正確（黃底＝系統判斷不出），確認後再按一次「產生點名資料」。`,
      arr明細: 說明大車點名設定_(obj推測)
    };
  }
  補齊大車點名設定_(obj設定分頁, arr標題);
  const obj欄 = 解析大車設定欄位_(讀取大車點名設定_(obj設定分頁), arr標題);
  const obj代號 = 讀取領隊代號_(obj副本);
  obj欄.obj領隊代號 = obj代號.obj表;

  // ③ 逐人拆趟
  const arr趟次 = [];
  arr資料.forEach(function (arr列) {
    if (String(arr列[obj欄.int姓名]).trim() === '') return;   // 空白列、小計列略過
    Array.prototype.push.apply(arr趟次, 計算個人趟次_(arr列, obj欄));
  });
  if (arr趟次.length === 0) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, '「有效資料」中沒有任何填了姓名的資料列，無法產生點名資料。');
  }

  // ④ 合併寫入
  const obj摘要 = 合併寫入點名分頁_(obj副本, arr趟次, obj欄.obj領隊代號, obj代號.bool自訂);

  const arr明細 = [];
  const arr同名 = Object.keys(obj欄.obj同名索引);
  if (arr同名.length > 0) arr明細.push(`已從有效資料的同名欄位帶入：${arr同名.join('、')}（有填值者以有效資料為準）`);
  if (obj摘要.int新增 > 0) arr明細.push(`新增 ${obj摘要.int新增} 趟（加在最後）`);
  if (obj摘要.int已消失 > 0) arr明細.push(`${obj摘要.int已消失} 趟已不在有效資料中，已加刪除線（不會匯出），確認後請自行刪除該列`);
  if (obj摘要.int待分車 > 0) arr明細.push(`${obj摘要.int待分車} 趟的去程或回程還沒填（淡藍底），搭車請填車次 1、2…，自行請填「自行」`);
  if (obj摘要.int問題格 - obj摘要.int領隊問題 > 0) arr明細.push(`${obj摘要.int問題格 - obj摘要.int領隊問題} 格系統判斷不出（黃底：手機格式或日期），請檢查`);
  if (obj摘要.int領隊問題 > 0) {
    arr明細.push(`${obj摘要.int領隊問題} 趟的領隊代號在對照表中找不到（黃底）。請更正有效資料`
      + (obj代號.bool自訂 ? `，或在「${obj大車點名設定.str領隊代號分頁名}」分頁新增這個代號` : '，或按選單「大車點名 → 領隊代號對照表」自訂代號')
      + `。目前代號：${列出領隊代號_(obj欄.obj領隊代號)}`);
  }
  if (obj摘要.str舊版備份) arr明細.push(`舊格式的點名資料已改名保留為「${obj摘要.str舊版備份}」`);
  return {
    bool需確認設定: false, int趟數: obj摘要.int趟數, int新增: obj摘要.int新增, int已消失: obj摘要.int已消失,
    int待分車: obj摘要.int待分車, int問題格: obj摘要.int問題格,
    str訊息: `已產生 ${obj摘要.int趟數} 趟點名資料（${obj大車點名設定.str點名分頁名}）。承辦人填過的欄位都已保留。`,
    arr明細: arr明細
  };
}


// ============================================================================
// 丁、大車點名試算表（外部檔案）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：取得點名表標題索引_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：大車點名試算表是精舍自有、欄位固定的外部檔案：依第 1 列標題找欄號（1 起算）。
 * 參數：obj分頁 {Sheet}
 * 傳回：{Object} { 標題: 欄號 }
 * ============================================================================
 */
function 取得點名表標題索引_(obj分頁) {
  return 取得副本標題索引_(obj分頁);
}


/**
 * ============================================================================
 * 函式名稱：檢查大車點名試算表格式_
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   確認是大車點名系統的試算表：有「活動配置」分頁且具備必要欄位。
 *   匯出前一定先檢查；平台核心登記外部檔案時也可呼叫（見專案摘要待辦）。
 * 參數：obj試算表 {Spreadsheet}
 * 傳回：{Object} { str訊息, obj配置分頁 }
 * ============================================================================
 */
function 檢查大車點名試算表格式_(obj試算表) {
  const str配置 = obj大車點名格式.str活動配置分頁;
  const obj配置分頁 = obj試算表.getSheetByName(str配置);
  if (!obj配置分頁) {
    throw new 平台錯誤(obj錯誤代碼.工作表不存在,
      `「${obj試算表.getName()}」裡沒有「${str配置}」分頁，看起來不是大車點名系統的試算表。請精舍管理員到精舍設定重新登記。`);
  }
  const obj索引 = 取得點名表標題索引_(obj配置分頁);
  const arr缺少 = obj大車點名格式.arr活動配置必要欄位.filter(function (s) { return !obj索引[s]; });
  if (arr缺少.length > 0) {
    throw new 平台錯誤(obj錯誤代碼.欄位缺漏, `「${str配置}」分頁缺少欄位：${arr缺少.join('、')}，請確認是大車點名系統的試算表。`);
  }
  return { str訊息: '是大車點名系統的試算表。', obj配置分頁: obj配置分頁 };
}


/**
 * ============================================================================
 * 函式名稱：取得大車匯出目標_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   這場活動要匯出到哪一份點名試算表、哪個分頁：
 *     活動清單已記錄「匯出試算表ID」（曾匯出）→ 沿用；否則用精舍登記的大車點名試算表。
 * 參數：
 *   str精舍代號   {string}
 *   obj活動值     {Object} 活動清單一列
 * 傳回：{Object} { str目標ID, obj點名表, obj配置分頁, str名單分頁名, str報到分頁名, bool首次 }
 * ============================================================================
 */
function 取得大車匯出目標_(str精舍代號, obj活動值) {
  const str目標ID = String(obj活動值['匯出試算表ID'] || '').trim()
    || 取得精舍外部檔案ID(str精舍代號, obj大車點名格式.str外部檔案項目);
  const obj點名表 = 開啟試算表(str目標ID, '大車點名試算表');
  const obj配置分頁 = 檢查大車點名試算表格式_(obj點名表).obj配置分頁;
  const str名單分頁名 = String(obj活動值['匯出分頁名稱'] || '').trim()
    || (obj大車點名格式.str名單分頁前綴 + String(obj活動值['活動名稱']).trim());
  const str報到分頁名 = obj大車點名格式.str報到分頁前綴 + str名單分頁名.replace(obj大車點名格式.str名單分頁前綴, '');
  return {
    str目標ID: str目標ID, obj點名表: obj點名表, obj配置分頁: obj配置分頁,
    str名單分頁名: str名單分頁名, str報到分頁名: str報到分頁名, bool首次: !obj點名表.getSheetByName(str名單分頁名)
  };
}


/**
 * ============================================================================
 * 函式名稱：讀取點名匯出資料_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：讀副本「大車報到點名資料」，依點名系統 16 欄順序整理：略過姓名空白與「已消失」的列；
 *       去程狀態、回程狀態、狀態一律空白；同時算出還有幾趟去程或回程沒填。
 * 參數：obj副本 {Spreadsheet}
 * 傳回：{Object} { arr資料: string[][], int待分車 }
 * ============================================================================
 */
function 讀取點名匯出資料_(obj副本) {
  const str分頁名 = obj大車點名設定.str點名分頁名;
  const obj來源 = obj副本.getSheetByName(str分頁名);
  if (!obj來源 || obj來源.getLastRow() < 2) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `副本中還沒有「${str分頁名}」資料，請先按「產生點名資料」。`);
  }
  const obj索引 = 取得點名表標題索引_(obj來源);
  if (!obj索引['姓名']) {
    throw new 平台錯誤(obj錯誤代碼.欄位缺漏, `「${str分頁名}」第 1 列找不到「姓名」欄，可能標題被改動，請重新產生點名資料。`);
  }
  const int狀態欄 = obj索引[obj大車點名設定.str狀態欄名] || 0;
  const arr列們 = obj來源.getRange(2, 1, obj來源.getLastRow() - 1, obj來源.getLastColumn()).getDisplayValues()
    .filter(function (arr列) { return String(arr列[obj索引['姓名'] - 1]).trim() !== ''; })
    .filter(function (arr列) { return !int狀態欄 || String(arr列[int狀態欄 - 1]).trim() !== obj大車點名設定.str已消失; });

  let int待分車 = 0;
  const arr欄位 = obj大車點名格式.arr名單欄位;
  const arr資料 = arr列們.map(function (arr列) {
    const arr輸出 = arr欄位.map(function (str欄) {
      if (obj大車點名格式.arr點名系統欄位.indexOf(str欄) >= 0 || !obj索引[str欄]) return '';
      return arr列[obj索引[str欄] - 1];
    });
    if (String(arr輸出[arr欄位.indexOf('去程')]).trim() === '' || String(arr輸出[arr欄位.indexOf('回程')]).trim() === '') int待分車 += 1;
    return arr輸出;
  });
  if (arr資料.length === 0) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${str分頁名}」中沒有可以匯出的資料（全部是空白或已消失的列）。`);
  }
  return { arr資料: arr資料, int待分車: int待分車 };
}


/**
 * ============================================================================
 * 函式名稱：備份點名分頁_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：在同一份試算表複製分頁，命名「原名_備份_yyyyMMdd_HHmm」；同一分鐘重複時加序號。
 * 參數：obj試算表 {Spreadsheet}；obj分頁 {Sheet}
 * 傳回：{string} 備份分頁名稱
 * ============================================================================
 */
function 備份點名分頁_(obj試算表, obj分頁) {
  const str基底 = `${obj分頁.getName()}_備份_${格式化日期(new Date(), 'yyyyMMdd_HHmm')}`;
  let str名稱 = str基底;
  let int序號 = 2;
  while (obj試算表.getSheetByName(str名稱)) { str名稱 = `${str基底}_${int序號}`; int序號 += 1; }
  obj分頁.copyTo(obj試算表).setName(str名稱);
  return str名稱;
}


/**
 * ============================================================================
 * 函式名稱：寫入點名名單分頁_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：清空分頁內容（不刪分頁，點名系統的參照不受影響）後寫入標題與資料；手機欄設為純文字。
 * 參數：obj分頁 {Sheet}；arr資料 {string[][]}
 * 傳回：無
 * ============================================================================
 */
function 寫入點名名單分頁_(obj分頁, arr資料) {
  const arr標題 = obj大車點名格式.arr名單欄位;
  obj分頁.clearContents();
  const int欄數 = arr標題.length;
  const int需要列 = arr資料.length + 1;
  if (int需要列 > obj分頁.getMaxRows()) obj分頁.insertRowsAfter(obj分頁.getMaxRows(), int需要列 - obj分頁.getMaxRows());
  if (int欄數 > obj分頁.getMaxColumns()) obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), int欄數 - obj分頁.getMaxColumns());
  obj分頁.getRange(1, arr標題.indexOf('手機號碼') + 1, int需要列, 1).setNumberFormat('@');
  obj分頁.getRange(1, 1, 1, int欄數).setValues([arr標題]).setFontWeight('bold');
  if (arr資料.length > 0) obj分頁.getRange(2, 1, arr資料.length, int欄數).setValues(arr資料);
  obj分頁.setFrozenRows(1);
}


/**
 * ============================================================================
 * 函式名稱：找活動配置列_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：在「活動配置」找「大車名單工作表」等於指定分頁名的所有列號。
 * 參數：obj配置分頁 {Sheet}；str名單分頁名 {string}
 * 傳回：{number[]} 列號
 * ============================================================================
 */
function 找活動配置列_(obj配置分頁, str名單分頁名) {
  const obj索引 = 取得點名表標題索引_(obj配置分頁);
  const int最後列 = obj配置分頁.getLastRow();
  const arr列號 = [];
  if (!obj索引['大車名單工作表'] || int最後列 < 2) return arr列號;
  obj配置分頁.getRange(2, obj索引['大車名單工作表'], int最後列 - 1, 1).getValues().forEach(function (arr, i) {
    if (String(arr[0]).trim() === str名單分頁名) arr列號.push(i + 2);
  });
  return arr列號;
}


/**
 * ============================================================================
 * 函式名稱：寫入活動配置狀態_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：在「活動配置」找這場活動的列並更新狀態；找不到就新增一列。
 * 參數：
 *   obj配置分頁   {Sheet}
 *   str名單分頁名 {string}
 *   str報到分頁名 {string}
 *   str活動名稱   {string}
 *   str狀態       {string} 啟用／停用
 * 傳回：{boolean} true＝原本就有這一列
 * ============================================================================
 */
function 寫入活動配置狀態_(obj配置分頁, str名單分頁名, str報到分頁名, str活動名稱, str狀態) {
  const obj索引 = 取得點名表標題索引_(obj配置分頁);
  const arr列號 = 找活動配置列_(obj配置分頁, str名單分頁名);
  if (arr列號.length > 0) {
    arr列號.forEach(function (int列) { obj配置分頁.getRange(int列, obj索引['狀態']).setValue(str狀態); });
    return true;
  }
  const arr新列 = new Array(Math.max(obj配置分頁.getLastColumn(), 1)).fill('');
  arr新列[obj索引['活動名稱'] - 1] = str活動名稱;
  arr新列[obj索引['大車名單工作表'] - 1] = str名單分頁名;
  arr新列[obj索引['報到紀錄工作表'] - 1] = str報到分頁名;
  arr新列[obj索引['狀態'] - 1] = str狀態;
  obj配置分頁.getRange(obj配置分頁.getLastRow() + 1, 1, 1, arr新列.length).setValues([arr新列]);
  return false;
}


/**
 * ============================================================================
 * 函式名稱：設定大車活動配置狀態_
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   法會_活動管理 的「設為結束」「重新開啟」呼叫：把點名系統「活動配置」中這場活動
 *   改為停用或啟用。活動沒有匯出紀錄時不做事。打不開時丟錯，由呼叫端提醒手動處理。
 * 參數：
 *   obj活動值   {Object} 活動清單一列
 *   str狀態     {string} '啟用'｜'停用'
 * 傳回：無
 * ============================================================================
 */
function 設定大車活動配置狀態_(obj活動值, str狀態) {
  const str目標ID = String(obj活動值['匯出試算表ID'] || '').trim();
  const str名單 = String(obj活動值['匯出分頁名稱'] || '').trim();
  if (!str目標ID || !str名單) return;
  const obj點名表 = 開啟試算表(str目標ID, '大車點名試算表');
  const obj配置分頁 = 檢查大車點名試算表格式_(obj點名表).obj配置分頁;
  寫入活動配置狀態_(obj配置分頁, str名單, obj大車點名格式.str報到分頁前綴 + str名單.replace(obj大車點名格式.str名單分頁前綴, ''),
    String(obj活動值['活動名稱']).trim(), str狀態);
}


/**
 * ============================================================================
 * 函式名稱：執行大車匯出_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   匯出的實際步驟（呼叫端負責權限、狀態與活動作業鎖），供匯出與轉為正式共用：
 *     ① 讀副本點名資料 ② 找目標並檢查格式 ③ 首次建名單分頁／再次先備份
 *     ④ 確認報到紀錄分頁與活動配置列存在（缺少就補）⑤ 整份覆蓋
 *     ⑥ 回填活動清單；首次匯出且收件中 → 演練
 * 參數：
 *   str精舍代號   {string}
 *   obj主控台     {Spreadsheet}
 *   obj活動值     {Object}
 *   obj副本       {Spreadsheet}
 * 傳回：{Object} { int筆數, str說明, obj目標 }
 * ============================================================================
 */
function 執行大車匯出_(str精舍代號, obj主控台, obj活動值, obj副本) {
  const str活動名稱 = String(obj活動值['活動名稱']).trim();
  const obj資料 = 讀取點名匯出資料_(obj副本);
  const obj目標 = 取得大車匯出目標_(str精舍代號, obj活動值);
  const obj點名表 = obj目標.obj點名表;

  // ③ 名單分頁
  let obj名單分頁 = obj點名表.getSheetByName(obj目標.str名單分頁名);
  let str備份說明 = '';
  if (!obj名單分頁) obj名單分頁 = obj點名表.insertSheet(obj目標.str名單分頁名);
  else str備份說明 = `，原名單已備份為「${備份點名分頁_(obj點名表, obj名單分頁)}」`;

  // ④ 報到紀錄分頁、活動配置列（被誤刪就補建）
  let str補建說明 = '';
  if (!obj點名表.getSheetByName(obj目標.str報到分頁名)) {
    const obj報到 = obj點名表.insertSheet(obj目標.str報到分頁名);
    const arr欄 = obj大車點名格式.arr報到紀錄欄位;
    obj報到.getRange(1, 1, 1, arr欄.length).setValues([arr欄]).setFontWeight('bold');
    obj報到.setFrozenRows(1);
    if (!obj目標.bool首次) str補建說明 += `；「${obj目標.str報到分頁名}」分頁不見了，已補建`;
  }
  const bool配置已有 = 寫入活動配置狀態_(obj目標.obj配置分頁, obj目標.str名單分頁名, obj目標.str報到分頁名, str活動名稱, obj大車點名格式.str啟用);
  if (!obj目標.bool首次 && !bool配置已有) str補建說明 += `；「${obj大車點名格式.str活動配置分頁}」少了這場活動的列，已補上`;

  // ⑤ 整份覆蓋
  寫入點名名單分頁_(obj名單分頁, obj資料.arr資料);

  // ⑥ 回填活動清單
  const dat現在 = new Date();
  const obj回填 = { '匯出試算表ID': obj目標.str目標ID, '匯出分頁名稱': obj目標.str名單分頁名, '上次匯出時間': dat現在 };
  if (obj目標.bool首次 || String(obj活動值['首次匯出時間'] || '').trim() === '') obj回填['首次匯出時間'] = dat現在;
  if (String(obj活動值['活動狀態']).trim() === '收件中') obj回填['活動狀態'] = '演練';
  更新法會活動_(obj主控台, obj活動值['活動ID'], obj回填);

  const str說明 = `已匯出 ${obj資料.arr資料.length} 筆到「${obj目標.str名單分頁名}」`
    + (obj目標.bool首次 ? `（首次匯出：已在「${obj大車點名格式.str活動配置分頁}」新增「${str活動名稱}」並建立「${obj目標.str名單分頁名}」「${obj目標.str報到分頁名}」兩個分頁，狀態「啟用」，活動進入「演練」）` : str備份說明)
    + str補建說明 + '。';
  return { int筆數: obj資料.arr資料.length, str說明: str說明, obj目標: obj目標 };
}


// ============================================================================
// 戊、動作（網頁與副本選單共用）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：取得對外活動_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：網頁動作共用的前置：找活動、必須是對外活動、檢查權限與狀態。
 * 參數：
 *   obj工作階段   {Object}
 *   str活動ID     {string}
 *   str權限項目   {string}
 *   str作業名稱   {string}
 *   arr允許狀態   {string[]|null}
 * 傳回：{Object} { obj主控台, obj活動值 }
 * ============================================================================
 */
function 取得對外活動_(obj工作階段, str活動ID, str權限項目, str作業名稱, arr允許狀態) {
  const obj主控台 = 開啟法會主控台_(obj工作階段.str精舍代號);
  const obj活動值 = 取得法會活動_(obj主控台, str活動ID).obj值;
  檢查活動權限_(obj工作階段, obj活動值, str權限項目, str作業名稱);
  檢查是對外活動_(obj活動值);
  if (arr允許狀態) 檢查活動狀態_(obj活動值, arr允許狀態, str作業名稱);
  return { obj主控台: obj主控台, obj活動值: obj活動值 };
}


/**
 * ============================================================================
 * 函式名稱：檢查是對外活動_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：大車點名只限對外活動。
 * 參數：obj活動值 {Object}
 * 傳回：無
 * ============================================================================
 */
function 檢查是對外活動_(obj活動值) {
  if (String(obj活動值['活動類型']).trim() !== '對外') {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${obj活動值['活動名稱']}」是對內活動，不需要大車點名。`);
  }
}


/**
 * ============================================================================
 * 函式名稱：處理產生點名_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：產生點名資料的共用處理（網頁與副本選單）：活動作業鎖 → 產生 → 回填上次產生時間 → 日誌。
 * 參數：obj身分 {Object}；obj主控台 {Spreadsheet}；obj活動值 {Object}；obj副本 {Spreadsheet}（選填，副本選單已開啟時傳入）
 * 傳回：{Object} 產生大車點名資料_ 的結果
 * ============================================================================
 */
function 處理產生點名_(obj身分, obj主控台, obj活動值, obj副本) {
  const str活動ID = String(obj活動值['活動ID']).trim();
  const obj結果 = 以活動作業鎖執行_(obj身分.str精舍代號, str活動ID, '產生點名資料', function () {
    return 產生大車點名資料_(obj副本 || 開啟活動副本_(obj活動值));
  });
  if (!obj結果.bool需確認設定) 更新法會活動_(obj主控台, str活動ID, { '上次產生點名時間': new Date() });
  寫入操作日誌(obj身分, '產生點名資料', `${str活動ID}：${obj結果.str訊息}`);
  return obj結果;
}


/**
 * ============================================================================
 * 函式名稱：處理匯出點名_（內部使用）
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：匯出的共用處理（網頁與副本選單）：
 *       預覽 → 只回報筆數、分頁、是否首次、待分車數；正式 → 活動作業鎖中匯出。
 * 參數：obj身分 {Object}；obj主控台 {Spreadsheet}；obj活動值 {Object}；bool僅預覽 {boolean}；obj副本 {Spreadsheet}（選填）
 * 傳回：{Object} 預覽 { bool預覽, int筆數, int待分車, str名單分頁名, bool首次, str活動名稱, str點名表名稱 }；
 *                正式 { str訊息, int筆數 }
 * ============================================================================
 */
function 處理匯出點名_(obj身分, obj主控台, obj活動值, bool僅預覽, obj副本) {
  const str精舍代號 = obj身分.str精舍代號;
  const str活動ID = String(obj活動值['活動ID']).trim();
  if (bool僅預覽) {
    const obj資料 = 讀取點名匯出資料_(obj副本 || 開啟活動副本_(obj活動值));
    const obj目標 = 取得大車匯出目標_(str精舍代號, obj活動值);
    return {
      bool預覽: true, int筆數: obj資料.arr資料.length, int待分車: obj資料.int待分車,
      str名單分頁名: obj目標.str名單分頁名, bool首次: obj目標.bool首次,
      str活動名稱: String(obj活動值['活動名稱']).trim(), str點名表名稱: obj目標.obj點名表.getName()
    };
  }
  const obj結果 = 以活動作業鎖執行_(str精舍代號, str活動ID, '匯出大車點名', function () {
    return 執行大車匯出_(str精舍代號, obj主控台, obj活動值, obj副本 || 開啟活動副本_(obj活動值));
  });
  寫入操作日誌(obj身分, '匯出大車點名', `${str活動ID}：${obj結果.str說明}`);
  return { str訊息: obj結果.str說明, int筆數: obj結果.int筆數 };
}


/**
 * ============================================================================
 * 函式名稱：產生法會點名資料
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：action「event.產生點名」。限對外活動、收件中或演練、權限 event.匯出大車點名。
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str活動ID }
 * 傳回：{Object} { bool成功, bool需確認設定, str訊息, arr明細, … }
 * ============================================================================
 */
function 產生法會點名資料(obj工作階段, obj參數) {
  檢查必要參數(obj參數, ['str活動ID'], '產生點名資料');
  const obj = 取得對外活動_(obj工作階段, obj參數.str活動ID, obj法會權限.匯出大車點名, '產生點名資料', arr大車可匯出狀態);
  return Object.assign({ bool成功: true }, 處理產生點名_(obj工作階段, obj.obj主控台, obj.obj活動值));
}


/**
 * ============================================================================
 * 函式名稱：建立法會領隊代號表
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：action「event.領隊代號表」。在副本建立可自訂的「領隊代號」分頁（已存在不覆蓋）。
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str活動ID }
 * 傳回：{Object} { bool成功, bool新建, str訊息 }
 * ============================================================================
 */
function 建立法會領隊代號表(obj工作階段, obj參數) {
  檢查必要參數(obj參數, ['str活動ID'], '領隊代號對照表');
  const obj = 取得對外活動_(obj工作階段, obj參數.str活動ID, obj法會權限.匯出大車點名, '領隊代號對照表', arr法會副本可整理狀態);
  return Object.assign({ bool成功: true }, 建立領隊代號分頁_(開啟活動副本_(obj.obj活動值)));
}


/**
 * ============================================================================
 * 函式名稱：匯出法會點名
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：action「event.匯出點名」。畫面先以 bool僅預覽＝true 顯示確認內容，再以 false 匯出。
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str活動ID, bool僅預覽 }
 * 傳回：{Object} 見 處理匯出點名_
 * ============================================================================
 */
function 匯出法會點名(obj工作階段, obj參數) {
  檢查必要參數(obj參數, ['str活動ID'], '匯出大車點名');
  const obj = 取得對外活動_(obj工作階段, obj參數.str活動ID, obj法會權限.匯出大車點名, '匯出大車點名', arr大車可匯出狀態);
  return Object.assign({ bool成功: true }, 處理匯出點名_(obj工作階段, obj.obj主控台, obj.obj活動值, obj參數.bool僅預覽 !== false));
}


/**
 * ============================================================================
 * 函式名稱：轉法會點名為正式
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   action「event.轉為正式」（精舍管理員）。只能在「演練」時執行：
 *     ① 最後一次匯出（含備份）
 *     ② 備份並清空「報到紀錄-活動」中的演練資料（保留標題列）
 *     ③ 活動改為「正式」：之後不再同步、匯出，名單改在大車點名系統維護
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str活動ID }
 * 傳回：{Object} { bool成功, str訊息 }
 * ============================================================================
 */
function 轉法會點名為正式(obj工作階段, obj參數) {
  檢查必要參數(obj參數, ['str活動ID'], '轉為正式');
  const obj = 取得對外活動_(obj工作階段, obj參數.str活動ID, obj法會權限.管理活動, '轉為正式', ['演練']);
  const str精舍代號 = obj工作階段.str精舍代號;
  const str活動ID = String(obj.obj活動值['活動ID']).trim();

  const str訊息 = 以活動作業鎖執行_(str精舍代號, str活動ID, '轉為正式', function () {
    const obj匯出 = 執行大車匯出_(str精舍代號, obj.obj主控台, obj.obj活動值, 開啟活動副本_(obj.obj活動值));

    // 清空演練期的報到紀錄（先備份）
    let str報到說明 = '報到紀錄分頁不存在，略過清空';
    const obj報到 = obj匯出.obj目標.obj點名表.getSheetByName(obj匯出.obj目標.str報到分頁名);
    if (obj報到) {
      if (obj報到.getLastRow() >= 2) {
        const str備份 = 備份點名分頁_(obj匯出.obj目標.obj點名表, obj報到);
        obj報到.getRange(2, 1, obj報到.getLastRow() - 1, Math.max(obj報到.getLastColumn(), 1)).clearContent();
        str報到說明 = `演練報到紀錄已清空（備份為「${str備份}」）`;
      } else {
        str報到說明 = '報到紀錄原本就是空的';
      }
    }
    更新法會活動_(obj.obj主控台, str活動ID, { '活動狀態': '正式', '轉正式時間': new Date() });
    return `「${obj.obj活動值['活動名稱']}」已轉為正式：${obj匯出.str說明}${str報到說明}。之後名單如有異動，請直接在大車點名系統修改。`;
  });
  寫入操作日誌(obj工作階段, '轉為正式', `${str活動ID}：${str訊息}`);
  return { bool成功: true, str訊息: str訊息 };
}


/**
 * ============================================================================
 * 函式名稱：退回法會演練
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：action「event.退回演練」（精舍管理員）。正式 → 演練（例如誤按轉為正式），並清掉轉正式時間。
 *       不會還原已清空的報到紀錄（備份分頁仍在）。
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str活動ID }
 * 傳回：{Object} { bool成功, str訊息 }
 * ============================================================================
 */
function 退回法會演練(obj工作階段, obj參數) {
  檢查必要參數(obj參數, ['str活動ID'], '退回演練');
  const obj = 取得對外活動_(obj工作階段, obj參數.str活動ID, obj法會權限.管理活動, '退回演練', ['正式']);
  // 清掉轉正式時間：之後「結束 → 重新開啟」才會回到演練而不是正式
  更新法會活動_(obj.obj主控台, obj.obj活動值['活動ID'], { '活動狀態': '演練', '轉正式時間': '' });
  寫入操作日誌(obj工作階段, '退回演練', String(obj.obj活動值['活動ID']));
  return { bool成功: true, str訊息: `「${obj.obj活動值['活動名稱']}」已退回演練，可再次匯出。注意：下次匯出會覆蓋點名系統中已修改的名單。` };
}


/**
 * ============================================================================
 * 函式名稱：清除法會點名資料
 * 版本：v1.0.0（2026-10-27）
 * ----------------------------------------------------------------------------
 * 用途：
 *   action「event.清除點名資料」（精舍管理員；對外、結束且曾匯出的活動）。
 *   刪除大車點名試算表中這場活動的名單、報到紀錄、所有備份分頁，以及活動配置列。
 *   刪除後無法復原，所以：
 *     · 預覽（bool僅預覽＝true）：列出將刪除的分頁與活動配置列數，不改資料
 *     · 執行：必須輸入完整活動名稱（str確認名稱）才進行
 *   某項刪除失敗不中斷，最後一併回報；全部成功才清空活動清單的匯出紀錄（有失敗可再按一次）。
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str活動ID, bool僅預覽, str確認名稱 }
 * 傳回：{Object} { bool成功, str訊息, arr明細, arr分頁（預覽）, int配置列數（預覽） }
 * ============================================================================
 */
function 清除法會點名資料(obj工作階段, obj參數) {
  檢查必要參數(obj參數, ['str活動ID'], '清除點名資料');
  const obj = 取得對外活動_(obj工作階段, obj參數.str活動ID, obj法會權限.管理活動, '清除點名資料', ['結束']);
  const obj活動值 = obj.obj活動值;
  const str活動名稱 = String(obj活動值['活動名稱']).trim();
  const str目標ID = String(obj活動值['匯出試算表ID'] || '').trim();
  const str名單 = String(obj活動值['匯出分頁名稱'] || '').trim();
  if (!str目標ID || !str名單) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `「${str活動名稱}」沒有匯出到大車點名試算表的紀錄（可能從未匯出，或已經清除過），不需要清除。`);
  }

  // 找出要刪的分頁與活動配置列
  const str報到 = obj大車點名格式.str報到分頁前綴 + str名單.replace(obj大車點名格式.str名單分頁前綴, '');
  const obj點名表 = 開啟試算表(str目標ID, '大車點名試算表');
  const arr分頁 = obj點名表.getSheets().filter(function (o) {
    const str名 = o.getName();
    return [str名單, str報到].some(function (str基底) { return str名 === str基底 || str名.indexOf(`${str基底}_備份_`) === 0; });
  });
  const obj配置分頁 = obj點名表.getSheetByName(obj大車點名格式.str活動配置分頁);
  const arr配置列號 = obj配置分頁 ? 找活動配置列_(obj配置分頁, str名單) : [];
  if (arr分頁.length > 0 && arr分頁.length >= obj點名表.getSheets().length) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, '這份試算表只剩這場活動的分頁，Google 試算表不能把分頁全部刪光，請確認登記的是大車點名系統的試算表。');
  }

  // 預覽
  if (obj參數.bool僅預覽 !== false) {
    return {
      bool成功: true, bool預覽: true, str點名表名稱: obj點名表.getName(),
      arr分頁: arr分頁.map(function (o) { return o.getName(); }), int配置列數: arr配置列號.length,
      str訊息: `將從「${obj點名表.getName()}」刪除 ${arr分頁.length} 個分頁與「活動配置」${arr配置列號.length} 列，刪除後無法復原。`
    };
  }

  // 執行：再確認一次名稱
  if (String(obj參數.str確認名稱 || '').trim() !== str活動名稱) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, `確認用的活動名稱不符，沒有刪除任何資料。請完整輸入「${str活動名稱}」。`);
  }
  const arr明細 = [];
  let int失敗 = 0;
  arr分頁.forEach(function (o) {
    const str名 = o.getName();
    try { obj點名表.deleteSheet(o); arr明細.push(`✔ 已刪除分頁「${str名}」`); } catch (err) { int失敗 += 1; arr明細.push(`✘ 分頁「${str名}」刪除失敗：${err.message}`); }
  });
  if (arr分頁.length === 0) arr明細.push('・點名試算表中已經沒有這場活動的分頁');
  arr配置列號.slice().sort(function (a, b) { return b - a; }).forEach(function (int列) {
    try { obj配置分頁.deleteRow(int列); arr明細.push(`✔ 已刪除「活動配置」第 ${int列} 列`); } catch (err) { int失敗 += 1; arr明細.push(`✘ 「活動配置」第 ${int列} 列刪除失敗：${err.message}`); }
  });
  if (arr配置列號.length === 0) arr明細.push('・「活動配置」中已經沒有這場活動');

  if (int失敗 === 0) 更新法會活動_(obj.obj主控台, obj活動值['活動ID'], { '匯出試算表ID': '', '匯出分頁名稱': '' });
  寫入操作日誌(obj工作階段, '清除點名資料', `${obj活動值['活動ID']}：點名試算表 ${str目標ID}、名單 ${str名單}、刪除分頁 ${arr分頁.length} 個、活動配置 ${arr配置列號.length} 列${int失敗 ? `、失敗 ${int失敗} 項` : ''}`);
  if (int失敗 > 0) {
    return { bool成功: true, bool有失敗: true, arr明細: arr明細,
      str訊息: `「${str活動名稱}」的點名資料有 ${int失敗} 項沒有刪除成功，請看明細。處理後可再按一次，已刪除的部分會自動略過。` };
  }
  return { bool成功: true, arr明細: arr明細, str訊息: `「${str活動名稱}」的點名資料已從大車點名試算表清除。` };
}
