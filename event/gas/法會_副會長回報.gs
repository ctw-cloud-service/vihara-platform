// ============================================================================
// 檔案名稱：法會_副會長回報.gs
// 所屬模組：法會活動（event）
// 所屬層級：模組／服務層＋控制層
// 檔案版本：v1.0.0（2026-11-08）
// 用途說明：
//   精舍的「副會長-法會回報」Google 試算表：副會長回報組員每場法會出席（V 椰墊／V 靠背椅／V 有執事）、
//   不參加（X 不參加＋原因）或待確認（?）。下載對內活動的場次名冊時合併（決策 BA～BD）：
//     · V 出席：已在名冊的補上「座位」「執事」；沒報名的加入名冊、算已報名（報名內容「副會長回報出席」）
//     · X 不參加：已在名冊的人自動登記「取消參加」（原因帶入，報到人員記「副會長回報」），不列在未報到；
//                 沒報名的不加入。之後回報改成出席（或刪掉這列）時，自動「恢復參加」
//     · ? 待確認：已在名冊的人黃底提醒；沒報名的不加入
//   回報表格式：
//     ① 一場一頁；**日期寫在分頁名稱（例如「11/14」）或欄名上方的標題列（例如「11/14 三昧水懺」）**，
//        標題列優先；看不出日期的頁不合併（設定時與下載結果會提醒）
//     ② 欄名列含「姓名」「出席」；另外讀「法名」「備註」「不參加原因」（欄名含「原因」）
//     ③ 姓名前的職稱（總監、會長…）自動去掉，取最後一段姓名
//   設定：
//     · 精舍：主控台「模組設定」項目「副會長回報表」＝試算表 ID（精舍管理員設定）
//     · 活動：活動清單「合併副會長回報」欄＝合併／不合併（空白＝合併）
//   ※ 回報表要讓部署網頁應用程式的帳號可以檢視；Excel 檔（.xlsx）不能讀，請存成 Google 試算表。
//   ※ 本檔頂層常數只在本檔使用。
//
// 相依檔案：
//   平台核心（核心_錯誤、核心_工具 正規化人名、核心_日誌）
//   法會_模組定義、法會_活動管理（讀取模組設定值_）、法會_報到名冊（取得對內活動_）
//   法會_用齋登記（解析試算表ID_、儲存合併來源設定_）、法會_報到（報到紀錄：取消參加）
// ============================================================================

const obj回報格式 = Object.freeze({
  str設定項目: '副會長回報表',
  str活動欄: '合併副會長回報',
  arr設定值: Object.freeze(['合併', '不合併']),
  str預設: '合併',
  str報到人員: '副會長回報',               // 自動取消參加時，報到紀錄的「報到人員」
  str原因前綴: '副會長回報：',
  re日期: /(\d{1,2})\s*[/／.]\s*(\d{1,2})/,
  re姓名: /^[一-鿿]{2,5}$/
});


// ============================================================================
// 甲、判讀（純計算）
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：解析回報出席_（內部使用）
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：「出席」欄：V 椰墊／V 靠背椅／V 有執事 → 出席；X 不參加 → 不參加；? 待確認 → 待確認；空白 → ''。
 * 參數：str {string}
 * 傳回：{Object} { str出席: '出席'｜'不參加'｜'待確認'｜'', str座位: '椰墊'｜'靠背椅'｜'', bool執事 }
 * ============================================================================
 */
function 解析回報出席_(str) {
  const s = String(str || '').replace(/\s+/g, '');
  const obj = { str出席: '', str座位: '', bool執事: false };
  if (s === '') return obj;
  const c = s.charAt(0).toUpperCase();
  if (c === 'X' || c === '✗' || c === '×' || s.indexOf('不參加') !== -1) { obj.str出席 = '不參加'; return obj; }
  if (c === '?' || c === '？' || s.indexOf('待確認') !== -1) { obj.str出席 = '待確認'; return obj; }
  if (c === 'V' || c === '✓' || c === '✔' || c === 'O' || s.indexOf('出席') !== -1 || s.indexOf('參加') !== -1
    || s.indexOf('椰墊') !== -1 || s.indexOf('靠背椅') !== -1 || s.indexOf('執事') !== -1) {
    obj.str出席 = '出席';
    obj.str座位 = s.indexOf('靠背椅') !== -1 || s.indexOf('椅') !== -1 ? '靠背椅' : (s.indexOf('椰墊') !== -1 ? '椰墊' : '');
    obj.bool執事 = s.indexOf('執事') !== -1;
  }
  return obj;
}


/**
 * ============================================================================
 * 函式名稱：去除職稱_（內部使用）
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：「總監 簡宣和」「會長 隋濟美」→ 取最後一段姓名；只有一段時照原樣（去空白）。
 * 參數：str {string}
 * 傳回：{string}
 * ============================================================================
 */
function 去除職稱_(str) {
  const arr = String(str || '').trim().split(/[\s　]+/).filter(Boolean);
  if (arr.length === 0) return '';
  return 正規化人名(arr[arr.length - 1]);
}


/**
 * ============================================================================
 * 函式名稱：解析回報分頁_
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：判讀回報表的一頁（規則見檔頭）。
 * 參數：str分頁名 {string}；arr值 {Array[]} 顯示文字
 * 傳回：{Object} {
 *   str分頁名, str標題, int月, int日（看不出日期時 0）, bool有欄名,
 *   arr人員: [ { str姓名, str法名, str出席, str座位, str執事, str原因, str備註, str提醒 } ]
 * }
 * ============================================================================
 */
function 解析回報分頁_(str分頁名, arr值) {
  const cfg = obj回報格式;
  const arr列 = (arr值 || []).map(function (r) { return (r || []).map(function (v) { return String(v === null || v === undefined ? '' : v).trim(); }); });
  const obj結果 = { str分頁名: String(str分頁名 || ''), str標題: '', int月: 0, int日: 0, bool有欄名: false, arr人員: [] };

  // ① 欄名列：同一列有「姓名」與「出席」
  const int欄名列 = arr列.findIndex(function (r) {
    return r.some(function (v) { return v.replace(/\s/g, '') === '姓名'; }) && r.some(function (v) { return v.indexOf('出席') !== -1; });
  });
  if (int欄名列 < 0) return obj結果;
  obj結果.bool有欄名 = true;
  const arr欄名 = arr列[int欄名列].map(function (v) { return v.replace(/\s/g, ''); });
  const fn欄 = function (fn) { return arr欄名.findIndex(fn); };
  const i姓名 = fn欄(function (v) { return v === '姓名'; });
  const i法名 = fn欄(function (v) { return v === '法名'; });
  const i出席 = fn欄(function (v) { return v.indexOf('出席') !== -1; });
  const i原因 = fn欄(function (v) { return v.indexOf('原因') !== -1; });
  const i備註 = fn欄(function (v) { return v === '備註'; });

  // ② 日期：欄名上方的標題列優先，其次分頁名稱
  obj結果.str標題 = arr列.slice(0, int欄名列).map(function (r) { return r.filter(Boolean).join(' '); }).filter(Boolean).join(' ');
  const m = obj結果.str標題.match(cfg.re日期) || obj結果.str分頁名.match(cfg.re日期);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31) {
    obj結果.int月 = Number(m[1]);
    obj結果.int日 = Number(m[2]);
  }

  // ③ 每一列
  const obj已有 = {};
  arr列.slice(int欄名列 + 1).forEach(function (r) {
    const str姓名 = 去除職稱_(r[i姓名]);
    if (!cfg.re姓名.test(str姓名) || obj已有[str姓名]) return;
    const obj出席 = 解析回報出席_(r[i出席]);
    if (obj出席.str出席 === '') return;            // 沒回報的人不處理
    obj已有[str姓名] = true;
    const str備註 = i備註 >= 0 ? r[i備註] : '';
    const str原因欄 = i原因 >= 0 ? r[i原因] : '';
    const o = {
      str姓名: str姓名,
      str法名: i法名 >= 0 ? 正規化人名(r[i法名]) : '',
      str出席: obj出席.str出席, str座位: obj出席.str座位, str執事: '', str原因: '', str備註: str備註, str提醒: ''
    };
    if (o.str出席 === '出席') o.str執事 = str備註;                       // 出席者的備註多為執事（梵唄、照客、福田…）
    if (o.str出席 === '不參加') o.str原因 = [str備註, str原因欄].filter(Boolean).filter(function (s, i, a) { return a.indexOf(s) === i; }).join('；');
    if (/\+\s*\d/.test(str備註 + str原因欄)) o.str提醒 = `副會長回報有額外人數：${[str備註, str原因欄].filter(Boolean).join('；')}`;
    obj結果.arr人員.push(o);
  });
  return obj結果;
}


/**
 * ============================================================================
 * 函式名稱：篩選回報人員_
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：找出月日相同的頁，合併成一份（同名以先出現的頁為準）。
 * 參數：arr分頁 {Object[]}；int月 {number}；int日 {number}
 * 傳回：{Object} { arr人員, arr分頁名 }
 * ============================================================================
 */
function 篩選回報人員_(arr分頁, int月, int日) {
  const arr符合 = (arr分頁 || []).filter(function (o) { return o.int月 === int月 && o.int日 === int日; });
  const arr人員 = [];
  const obj已有 = {};
  arr符合.forEach(function (p) {
    p.arr人員.forEach(function (o) {
      if (obj已有[o.str姓名]) return;
      obj已有[o.str姓名] = true;
      arr人員.push(Object.assign({ str分頁名: p.str分頁名 }, o));
    });
  });
  return { arr人員: arr人員, arr分頁名: arr符合.map(function (o) { return o.str分頁名; }) };
}


/**
 * ============================================================================
 * 函式名稱：合併回報人員_
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：把回報合併進場次名冊列（會直接修改 arr名冊列）：
 *   出席 → 已在名冊：obj回報；沒有：新增一列（算已報名，法名用回報的）
 *   不參加 → 已在名冊：obj回報（之後自動取消參加）；沒有：略過
 *   待確認 → 已在名冊：obj回報＋提醒；沒有：略過
 *   同名但兩邊法名都有且不同 → 提醒（仍視為同一人，與決策 E 相同）
 * 參數：arr名冊列 {Object[]}；arr回報 {Object[]}；obj場次 {Object} { str場次, dat日期 }；arr時段 {Object[]}
 * 傳回：{Object} { int出席已在, int出席新增, int不參加, int待確認, int略過不參加（沒報名又不參加）, arr略過: [姓名（待確認）] }
 * ============================================================================
 */
function 合併回報人員_(arr名冊列, arr回報, obj場次, arr時段) {
  const obj名冊 = {};
  arr名冊列.forEach(function (o, i) { obj名冊[正規化人名(o.str姓名)] = i; });
  const arr全部時段 = (arr時段 && arr時段.length >= 2) ? arr時段.map(function (t, i) { return i; }) : [];
  const obj統計 = { int出席已在: 0, int出席新增: 0, int不參加: 0, int待確認: 0, int略過不參加: 0, arr略過: [] };

  (arr回報 || []).forEach(function (u) {
    const obj回報 = { str出席: u.str出席, str座位: u.str座位, str執事: u.str執事, str原因: u.str原因 };
    if (u.str姓名 in obj名冊) {
      const o = arr名冊列[obj名冊[u.str姓名]];
      o.obj回報 = obj回報;
      o.arr提醒 = o.arr提醒 || [];
      if (!o.str法名 && u.str法名) o.str法名 = u.str法名;
      else if (o.str法名 && u.str法名 && 正規化人名(o.str法名) !== u.str法名) o.arr提醒.push(`副會長回報的法名是「${u.str法名}」，請確認是否同一人`);
      if (u.str出席 === '待確認') { o.arr提醒.push('副會長回報待確認'); obj統計.int待確認 += 1; }
      if (u.str出席 === '不參加') obj統計.int不參加 += 1;
      if (u.str出席 === '出席') obj統計.int出席已在 += 1;
      if (u.str提醒) o.arr提醒.push(u.str提醒);
      return;
    }
    if (u.str出席 === '不參加') { obj統計.int略過不參加 += 1; return; }    // 沒報名又不參加：不必列名
    if (u.str出席 !== '出席') { obj統計.arr略過.push(`${u.str姓名}（${u.str出席}）`); return; }
    arr名冊列.push({
      str場次: obj場次.str場次, dat場次日期: obj場次.dat日期,
      str姓名: u.str姓名, str法名: u.str法名,
      str報名內容: `副會長回報出席${u.str執事 ? `（${u.str執事}）` : ''}`,
      int來源列: '副會長回報', any報名時間: '',
      arr提醒: u.str提醒 ? [u.str提醒] : [], obj帶入: {},
      arr報名序: arr全部時段.slice(),
      obj回報: obj回報
    });
    obj名冊[u.str姓名] = arr名冊列.length - 1;
    obj統計.int出席新增 += 1;
  });
  return obj統計;
}


/**
 * ============================================================================
 * 函式名稱：組合回報說明_
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：報到表與表格備註的字樣：出席「靠背椅・梵唄」（椰墊是一般座位不寫）；不參加「不參加：請假」；待確認「待確認」。
 * 參數：str出席 {string}；str座位 {string}；str執事 {string}；str原因 {string}
 * 傳回：{string}
 * ============================================================================
 */
function 組合回報說明_(str出席, str座位, str執事, str原因) {
  const s = String(str出席 || '').trim();
  if (s === '出席') return [String(str座位 || '').trim() === '靠背椅' ? '靠背椅' : '', String(str執事 || '').trim()].filter(Boolean).join('・');
  if (s === '不參加') return `不參加${str原因 ? `：${String(str原因).trim()}` : ''}`;
  if (s === '待確認') return '待確認';
  return '';
}


/**
 * ============================================================================
 * 函式名稱：取得活動回報設定_（內部使用）
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：活動的「合併副會長回報」：合併／不合併；空白或看不懂時合併（決策 BD：預設合併）。
 * 參數：obj活動值 {Object}
 * 傳回：{string}
 * ============================================================================
 */
function 取得活動回報設定_(obj活動值) {
  const str = String((obj活動值 || {})[obj回報格式.str活動欄] || '').trim();
  return obj回報格式.arr設定值.indexOf(str) !== -1 ? str : obj回報格式.str預設;
}


// ============================================================================
// 乙、讀取回報表、自動取消參加
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：讀取回報表_（內部使用）
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：開啟精舍設定的副會長回報表，判讀每一頁。
 * 參數：obj主控台 {Spreadsheet}；str試算表ID {string=}（設定時傳入新的 ID；省略時讀設定）
 * 傳回：{Object} { str試算表ID, str名稱, arr分頁 }
 * 例外：打不開 → 平台錯誤（白話）
 * ============================================================================
 */
function 讀取回報表_(obj主控台, str試算表ID) {
  const strID = str試算表ID || 解析試算表ID_(讀取模組設定值_(obj主控台, obj回報格式.str設定項目, '').str值);
  if (!strID) return { str試算表ID: '', str名稱: '', arr分頁: [] };
  let obj表;
  try { obj表 = SpreadsheetApp.openById(strID); } catch (err) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, '副會長回報表打不開：請確認是 Google 試算表（不是 Excel 檔），並分享給部署平台的帳號（至少「檢視者」）。');
  }
  const arr分頁 = obj表.getSheets().map(function (sh) {
    const int列 = sh.getLastRow();
    const int欄 = sh.getLastColumn();
    return 解析回報分頁_(sh.getName(), int列 > 0 && int欄 > 0 ? sh.getRange(1, 1, int列, int欄).getDisplayValues() : []);
  });
  return { str試算表ID: strID, str名稱: obj表.getName(), arr分頁: arr分頁 };
}


/**
 * ============================================================================
 * 函式名稱：取得場次回報人員_
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：下載場次名冊時使用：依活動設定，找出這個場次日期的副會長回報。不合併、沒設定、打不開都不中斷下載。
 * 參數：obj主控台 {Spreadsheet}；obj活動值 {Object}；int月 {number}；int日 {number}
 * 傳回：{Object} { arr人員, arr分頁名, str說明 }
 * ============================================================================
 */
function 取得場次回報人員_(obj主控台, obj活動值, int月, int日) {
  const obj空 = { arr人員: [], arr分頁名: [], str說明: '' };
  if (取得活動回報設定_(obj活動值) === '不合併') return obj空;
  let obj表;
  try { obj表 = 讀取回報表_(obj主控台); } catch (err) {
    return Object.assign(obj空, { str說明: `${err.message || err}（這次沒有合併副會長回報）` });
  }
  if (!obj表.str試算表ID) return obj空;                // 沒設定回報表：不提醒（很多精舍不用）
  const obj篩選 = 篩選回報人員_(obj表.arr分頁, int月, int日);
  if (obj篩選.arr分頁名.length === 0) {
    const arr沒日期 = obj表.arr分頁.filter(function (o) { return o.bool有欄名 && !o.int月; }).map(function (o) { return o.str分頁名; });
    return Object.assign(obj空, {
      str說明: `副會長回報表沒有 ${int月}/${int日} 的頁，這次沒有合併副會長回報`
        + (arr沒日期.length > 0 ? `（「${arr沒日期.join('」「')}」看不出日期：請把分頁名稱改成日期，例如「${int月}/${int日}」，或在欄名上方加一列標題）` : '')
    });
  }
  return { arr人員: obj篩選.arr人員, arr分頁名: obj篩選.arr分頁名, str說明: '' };
}


/**
 * ============================================================================
 * 函式名稱：同步回報取消參加_
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：
 *   名冊寫好後執行（決策 BB）。依副會長回報：
 *     · 回報「不參加」、目前沒有取消參加、也還沒報到 → 記「取消參加」（原因「副會長回報：請假」，報到人員「副會長回報」）
 *     · 目前的取消參加是副會長回報記的、但現在回報不是「不參加」 → 記「恢復參加」
 *   承辦人或志工自己記的取消參加不動。
 * 參數：obj副本 {Spreadsheet}；obj場次 {Object} { str場次, int月, int日 }；arr名冊 {Object[]} 寫入後的名冊物件（含學員編號、副會長回報欄）
 * 傳回：{Object} { int取消, int恢復 }
 * ============================================================================
 */
function 同步回報取消參加_(obj副本, obj場次, arr名冊) {
  const arr紀錄 = 讀取報到紀錄_(obj副本, []);
  const obj狀態 = 計算報到狀態_(arr紀錄, obj場次.str場次);
  const str日期 = `${obj場次.int月}/${obj場次.int日}`;
  const obj統計 = { int取消: 0, int恢復: 0 };
  arr名冊.forEach(function (o) {
    const str鍵 = 取得人員鍵_(o['學員編號'], o['姓名']);
    if (!str鍵) return;
    const bool不參加 = String(o['副會長回報'] || '').trim() === '不參加';
    const obj目前 = obj狀態.obj取消參加[str鍵];
    const bool已報到 = Object.keys(obj狀態.obj格[str鍵] || {}).length > 0;
    let str動作 = '';
    if (bool不參加 && !obj目前 && !bool已報到) str動作 = obj報到格式.obj動作.取消參加;
    if (!bool不參加 && obj目前 && obj目前.str人員 === obj回報格式.str報到人員) str動作 = obj報到格式.obj動作.恢復參加;
    if (!str動作) return;
    附加報到紀錄_(obj副本, {
      '場次': obj場次.str場次, '場次日期': str日期, '時段': '', '人員鍵': str鍵,
      '學員編號': o['學員編號'] || '', '姓名': o['姓名'] || '', '法名': o['法名'] || '',
      '報名狀態': obj報到格式.obj報名狀態.已報名, '報到方式': '', '動作': str動作,
      '報到時間': new Date(), '報到人員': obj回報格式.str報到人員, '使用裝置': '名冊下載',
      '備註': str動作 === obj報到格式.obj動作.取消參加 ? 整理取消原因_(obj回報格式.str原因前綴 + (o['不參加原因'] || '')) : '副會長回報已改'
    });
    if (str動作 === obj報到格式.obj動作.取消參加) obj統計.int取消 += 1; else obj統計.int恢復 += 1;
  });
  return obj統計;
}


// ============================================================================
// 丙、動作
// ============================================================================

/**
 * ============================================================================
 * 函式名稱：設定副會長回報表
 * 版本：v1.0.0（2026-11-08）
 * ----------------------------------------------------------------------------
 * 用途：action「event.設定副會長回報表」（限精舍管理員）。試著開啟並判讀，成功才儲存；空字串＝不使用。
 * 參數：obj工作階段 {Object}；obj參數 {Object} { str網址 }
 * 傳回：{Object} { bool成功, str訊息, arr明細 }
 * ============================================================================
 */
function 設定副會長回報表(obj工作階段, obj參數) {
  檢查權限(obj工作階段, obj法會權限.管理活動, '設定副會長回報表');
  const str原文 = String((obj參數 && obj參數.str網址) || '').trim();
  const strID = 解析試算表ID_(str原文);
  if (str原文 !== '' && !strID) {
    throw new 平台錯誤(obj錯誤代碼.參數錯誤, str原文.indexOf('drive.google.com/file') !== -1
      ? '這是 Excel 檔的連結，系統讀不到；請在 Google 試算表開啟後「檔案 → 另存為 Google 試算表」，再貼上新的網址。'
      : '看不出試算表的網址，請從瀏覽器網址列整段複製（https://docs.google.com/spreadsheets/d/…）。');
  }
  const obj主控台 = 開啟法會主控台_(obj工作階段.str精舍代號);
  const arr明細 = [];
  let str名稱 = '';
  if (strID) {
    const obj表 = 讀取回報表_(obj主控台, strID);
    str名稱 = obj表.str名稱;
    const arr有 = obj表.arr分頁.filter(function (o) { return o.bool有欄名 && o.int月; });
    const arr沒日期 = obj表.arr分頁.filter(function (o) { return o.bool有欄名 && !o.int月; });
    arr明細.push(`看得出日期的頁 ${arr有.length} 頁：` + (arr有.map(function (o) {
      const fn數 = function (s) { return o.arr人員.filter(function (x) { return x.str出席 === s; }).length; };
      return `${o.int月}/${o.int日} 出席 ${fn數('出席')}、不參加 ${fn數('不參加')}${fn數('待確認') ? `、待確認 ${fn數('待確認')}` : ''}`;
    }).join('；') || '（沒有）'));
    if (arr沒日期.length > 0) {
      arr明細.push(`看不出日期、不會合併的頁：「${arr沒日期.map(function (o) { return o.str分頁名; }).join('」「')}」。請把分頁名稱改成日期（例如「11/14」），或在欄名上方加一列標題（例如「11/14 三昧水懺」）`);
    }
  }
  儲存合併來源設定_(obj工作階段, obj主控台, obj回報格式.str設定項目, strID);
  寫入操作日誌(obj工作階段, '設定副會長回報表', strID ? `${str名稱}（${strID}）` : '（不使用）');
  return {
    bool成功: true,
    str訊息: strID ? `已設定副會長回報表「${str名稱}」。下載場次名冊時會合併日期相同的回報。` : '已取消副會長回報表，下載場次名冊時不再合併。',
    arr明細: arr明細
  };
}
