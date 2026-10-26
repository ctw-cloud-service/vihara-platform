// ============================================================================
// 檔案名稱：法會_表單與副本.gs
// 所屬模組：法會活動（event）
// 所屬層級：模組／服務層
// 檔案版本：v1.0.0（2026-10-26）
// 用途說明：
//   報名表單與整理副本之間的資料搬運（沿用舊系統 04、05、06 號檔已驗證的做法）：
//     · 由回覆試算表找出連結的 Google 表單與接收回應的分頁
//     · 把一筆表單回應轉成「與回覆試算表相同」的欄名與文字
//     · 建立副本時，把原始回覆整份貼進副本「有效資料」
//     · 同步時，依欄名把新回應追加到「有效資料」最後（不碰承辦人自己加的欄位）
//
//   副本是承辦人可以直接整理的試算表（可插欄、排序、刪列），
//   因此一律「依第 1 列標題文字」找欄位，不依欄位位置。
//   原始回覆試算表與表單由精舍自有，系統只讀不寫。
//
// 相依檔案：平台核心（核心_錯誤、核心_試算表存取、核心_外部檔案）、法會_模組定義
// ============================================================================


/**
 * ============================================================================
 * 函式名稱：表單網址轉ID_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   getFormUrl() 有時是編輯網址 /forms/d/{表單ID}/…，有時是發布網址 /forms/d/e/{發布ID}/…
 *   （發布 ID 不是表單 ID）。能直接擷取就擷取；否則實際開啟表單取得真正 ID。
 * 參數：
 *   str網址   {string} 表單網址
 * 傳回：{string} 表單 ID；打不開時為空字串
 * ============================================================================
 */
function 表單網址轉ID_(str網址) {
  const arr比對 = String(str網址 || '').match(/\/forms\/d\/(?!e\/)([a-zA-Z0-9_-]{20,})/);
  if (arr比對) return arr比對[1];
  try {
    return FormApp.openByUrl(str網址).getId();
  } catch (err) {
    return '';
  }
}


/**
 * ============================================================================
 * 函式名稱：取得連結表單_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   由回覆試算表反查它連結的 Google 表單，並找出接收回應的分頁。
 *   系統帳號必須是表單的「編輯者」才讀得到回應 ID（2026-10-26 定案）。
 *
 * 參數：
 *   obj試算表   {Spreadsheet} 原始回覆試算表
 * 傳回：
 *   {Object} { obj表單, str表單ID, str回覆分頁 }
 * ============================================================================
 */
function 取得連結表單_(obj試算表) {
  // ① 試算表要連結著表單
  const str表單網址 = obj試算表.getFormUrl();
  if (!str表單網址) {
    throw new 平台錯誤(
      obj錯誤代碼.參數錯誤,
      `「${obj試算表.getName()}」沒有連結 Google 表單。請到表單的「回覆」頁籤，按試算表圖示開啟正確的回覆試算表，再複製它的網址。`
    );
  }

  // ② 系統帳號要打得開表單（需要「編輯者」權限）
  let obj表單;
  try {
    obj表單 = FormApp.openByUrl(str表單網址);
  } catch (err) {
    throw new 平台錯誤(
      obj錯誤代碼.檔案無法開啟,
      `系統打不開這份回覆試算表連結的 Google 表單。請在表單右上角「更多 → 新增協作者」，把 ${取得系統帳號文字_()} 加為「編輯者」後再試。`,
      { str原始訊息: err && err.message ? err.message : String(err) }
    );
  }

  // ③ 哪一個分頁在接收這份表單的回應
  const str表單ID = obj表單.getId();
  const obj回覆分頁 = obj試算表.getSheets().filter(function (obj分頁) {
    const str網址 = obj分頁.getFormUrl();
    return str網址 && 表單網址轉ID_(str網址) === str表單ID;
  })[0];
  if (!obj回覆分頁) {
    throw new 平台錯誤(obj錯誤代碼.工作表不存在, `「${obj試算表.getName()}」中找不到接收表單回應的分頁。`);
  }

  return { obj表單: obj表單, str表單ID: str表單ID, str回覆分頁: obj回覆分頁.getName() };
}


/**
 * ============================================================================
 * 函式名稱：取得系統帳號文字_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：錯誤訊息中要提示「共享給哪個帳號」時使用（即系統管理員帳號＝系統帳號）。
 *       讀不到設定時改用固定說法，不讓錯誤訊息本身再出錯。
 * 參數：無
 * 傳回：{string}
 * ============================================================================
 */
function 取得系統帳號文字_() {
  try {
    return 取得系統設定值(obj設定名稱.系統管理員帳號, false) || '系統帳號';
  } catch (err) {
    return '系統帳號';
  }
}


/**
 * ============================================================================
 * 函式名稱：開啟報名來源_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   新增活動時檢查承辦人貼上的回覆試算表：網址看得懂、打得開、有連結表單、
 *   表單打得開、找得到回覆分頁且有標題列。全部通過才傳回。
 *
 * 參數：
 *   str網址   {string} 回覆試算表的網址或檔案代號
 * 傳回：
 *   {Object} { str來源ID, obj來源, obj來源分頁, obj連結: { obj表單, str表單ID, str回覆分頁 } }
 * ============================================================================
 */
function 開啟報名來源_(str網址) {
  const str來源ID = 解析檔案代號(str網址);
  const obj來源 = 開啟試算表(str來源ID, '報名回覆試算表');
  const obj連結 = 取得連結表單_(obj來源);
  const obj來源分頁 = 取得工作表(obj來源, obj連結.str回覆分頁);
  if (obj來源分頁.getLastRow() < 1 || obj來源分頁.getLastColumn() < 1) {
    throw new 平台錯誤(obj錯誤代碼.欄位缺漏, `回覆分頁「${obj連結.str回覆分頁}」是空白的（連標題列都沒有），請確認表單已連結。`);
  }
  return { str來源ID: str來源ID, obj來源: obj來源, obj來源分頁: obj來源分頁, obj連結: obj連結 };
}


/**
 * ============================================================================
 * 函式名稱：轉換回應為欄值_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   把一筆表單回應轉成 { 欄名: 值 }，欄名規則與 Google 回覆試算表相同：
 *     · 一般題目：欄名＝題目標題
 *     · 單選方格／核取方塊方格：每一列各一欄，欄名＝「題目標題 [列名稱]」
 *   答案：核取方塊以「, 」串接；上傳檔案轉成雲端硬碟連結；其他轉成文字。
 *   單一題目轉換失敗不影響整筆，改寫入「【轉換失敗】原始值」。
 *
 * 參數：
 *   obj回應   {FormResponse} 表單回應
 * 傳回：{Object} 例：{ 時間戳記: Date, 姓名: '王小明', '參加日期': '9/5 (六), 9/6 (日)' }
 * ============================================================================
 */
function 轉換回應為欄值_(obj回應) {
  const obj欄值 = {};

  // 時間戳記寫入日期物件；表單有收集電子郵件時才會有信箱
  obj欄值[obj法會設定.str時間戳記欄名] = obj回應.getTimestamp();
  const str信箱 = obj回應.getRespondentEmail();
  if (str信箱) obj欄值[obj法會設定.str電子郵件欄名] = str信箱;

  obj回應.getItemResponses().forEach(function (obj題目回應) {
    const obj題目 = obj題目回應.getItem();
    const str標題 = obj題目.getTitle().trim();
    const any答案 = obj題目回應.getResponse();
    const enum題型 = obj題目.getType();
    try {
      if (enum題型 === FormApp.ItemType.GRID || enum題型 === FormApp.ItemType.CHECKBOX_GRID) {
        // 方格題：每一列拆成一欄
        const arr列名 = (enum題型 === FormApp.ItemType.GRID)
          ? obj題目.asGridItem().getRows()
          : obj題目.asCheckboxGridItem().getRows();
        arr列名.forEach(function (str列名, i) {
          const any格 = (any答案 && any答案.length > i) ? any答案[i] : null;
          obj欄值[`${str標題} [${str列名}]`] = Array.isArray(any格) ? any格.join(', ') : (any格 || '');
        });
      } else if (enum題型 === FormApp.ItemType.FILE_UPLOAD) {
        // 上傳檔案：回應是檔案 ID 陣列，轉成可點擊的連結
        const arr檔案 = Array.isArray(any答案) ? any答案 : [];
        obj欄值[str標題] = arr檔案.map(function (str檔案ID) {
          return 'https://drive.google.com/open?id=' + str檔案ID;
        }).join(', ');
      } else if (Array.isArray(any答案)) {
        // 核取方塊等多選題
        obj欄值[str標題] = any答案.join(', ');
      } else {
        obj欄值[str標題] = (any答案 === null || any答案 === undefined) ? '' : String(any答案);
      }
    } catch (err) {
      obj欄值[str標題] = '【轉換失敗】' + String(any答案);
      console.warn(`題目「${str標題}」轉換失敗：${err}`);
    }
  });

  return obj欄值;
}


/**
 * ============================================================================
 * 函式名稱：取得所有題目欄名_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：列出表單目前所有題目對應的欄名（含方格題拆出的欄）；
 *       標題、說明、圖片、影片、分頁等非題目項目不列入。
 * 參數：
 *   obj表單   {Form} 表單
 * 傳回：{string[]}
 * ============================================================================
 */
function 取得所有題目欄名_(obj表單) {
  const arr非題目 = [FormApp.ItemType.SECTION_HEADER, FormApp.ItemType.PAGE_BREAK,
    FormApp.ItemType.IMAGE, FormApp.ItemType.VIDEO];
  const arr欄名 = [];
  obj表單.getItems().forEach(function (obj題目) {
    const enum題型 = obj題目.getType();
    if (arr非題目.indexOf(enum題型) !== -1) return;
    const str標題 = obj題目.getTitle().trim();
    if (enum題型 === FormApp.ItemType.GRID) {
      obj題目.asGridItem().getRows().forEach(function (str列) { arr欄名.push(`${str標題} [${str列}]`); });
    } else if (enum題型 === FormApp.ItemType.CHECKBOX_GRID) {
      obj題目.asCheckboxGridItem().getRows().forEach(function (str列) { arr欄名.push(`${str標題} [${str列}]`); });
    } else {
      arr欄名.push(str標題);
    }
  });
  return arr欄名;
}


/**
 * ============================================================================
 * 函式名稱：取得回應摘要名稱_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：提醒訊息用的簡短識別，例如「王小明（傳慈）」。
 *       找標題含「姓名」「法名」的題目（排除緊急聯絡人、填寫人）；都沒有時用送出時間。
 * 參數：
 *   obj回應   {FormResponse} 表單回應
 * 傳回：{string}
 * ============================================================================
 */
function 取得回應摘要名稱_(obj回應) {
  let str姓名 = '';
  let str法名 = '';
  obj回應.getItemResponses().forEach(function (obj題目回應) {
    const str標題 = obj題目回應.getItem().getTitle();
    const any答案 = obj題目回應.getResponse();
    if (str姓名 === '' && str標題.indexOf('姓名') !== -1 && str標題.indexOf('緊急') === -1 && str標題.indexOf('填寫') === -1) {
      str姓名 = String(any答案 || '').trim();
    }
    if (str法名 === '' && str標題.indexOf('法名') !== -1) str法名 = String(any答案 || '').trim();
  });
  if (str姓名 === '') return `${格式化日期(obj回應.getTimestamp(), 'yyyy/MM/dd HH:mm:ss')} 送出的回應`;
  return str法名 ? `${str姓名}（${str法名}）` : str姓名;
}


/**
 * ============================================================================
 * 函式名稱：取得副本標題索引_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：讀副本分頁第 1 列，建立「標題文字 → 欄號（1 起算）」對照。
 *       同名標題只記第一次出現的位置。
 * 參數：
 *   obj分頁   {Sheet} 副本分頁
 * 傳回：{Object} { 標題: 欄號 }
 * ============================================================================
 */
function 取得副本標題索引_(obj分頁) {
  const obj索引 = {};
  const int最後欄 = obj分頁.getLastColumn();
  if (int最後欄 < 1) return obj索引;
  obj分頁.getRange(1, 1, 1, int最後欄).getValues()[0].forEach(function (any標題, i) {
    const str標題 = String(any標題).trim();
    if (str標題 !== '' && !(str標題 in obj索引)) obj索引[str標題] = i + 1;
  });
  return obj索引;
}


/**
 * ============================================================================
 * 函式名稱：是否為文字格式欄_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：標題含「電話、手機」的欄位要設為純文字，避免開頭的 0 被試算表吃掉。
 * 參數：
 *   str標題   {string} 欄位標題
 * 傳回：{boolean}
 * ============================================================================
 */
function 是否為文字格式欄_(str標題) {
  return obj法會設定.arr文字格式欄關鍵字.some(function (str關鍵字) {
    return String(str標題).indexOf(str關鍵字) !== -1;
  });
}


/**
 * ============================================================================
 * 函式名稱：確保副本欄位存在_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：副本第 1 列缺少某些欄名時，依序補在最右側（通常是表單後來新增題目）。
 * 參數：
 *   obj分頁   {Sheet}    副本「有效資料」分頁
 *   arr欄名   {string[]} 需要存在的欄名
 * 傳回：{string[]} 這次新增的欄名
 * ============================================================================
 */
function 確保副本欄位存在_(obj分頁, arr欄名) {
  const obj索引 = 取得副本標題索引_(obj分頁);
  const arr缺少 = [];
  arr欄名.forEach(function (str欄名) {
    const str標題 = String(str欄名).trim();
    if (str標題 !== '' && !(str標題 in obj索引) && arr缺少.indexOf(str標題) === -1) arr缺少.push(str標題);
  });

  if (arr缺少.length > 0) {
    const int起始欄 = obj分頁.getLastColumn() + 1;
    // 欄數不夠時先加欄，避免寫入超出範圍
    const int需要欄數 = int起始欄 + arr缺少.length - 1;
    if (int需要欄數 > obj分頁.getMaxColumns()) {
      obj分頁.insertColumnsAfter(obj分頁.getMaxColumns(), int需要欄數 - obj分頁.getMaxColumns());
    }
    obj分頁.getRange(1, int起始欄, 1, arr缺少.length).setValues([arr缺少]).setFontWeight('bold');
  }
  return arr缺少;
}


/**
 * ============================================================================
 * 函式名稱：取得副本最後資料列_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   以指定欄（通常是時間戳記）由下往上找第一個有值的列。
 *   不直接用 getLastRow()，因為承辦人可能在其他欄放了公式或註記。
 * 參數：
 *   obj分頁   {Sheet}  副本分頁
 *   int欄號   {number} 1 起算
 * 傳回：{number} 列號；只有標題列時為 1
 * ============================================================================
 */
function 取得副本最後資料列_(obj分頁, int欄號) {
  const int最後列 = obj分頁.getLastRow();
  if (int最後列 < 2) return 1;
  const arr值 = obj分頁.getRange(1, int欄號, int最後列, 1).getValues();
  for (let i = arr值.length - 1; i >= 1; i--) {
    if (arr值[i][0] !== '' && arr值[i][0] !== null) return i + 1;
  }
  return 1;
}


/**
 * ============================================================================
 * 函式名稱：追加回應到副本_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   把多筆回應（已轉成 { 欄名: 值 }）追加到副本「有效資料」最後：
 *     ① 補齊缺少的欄位（含「系統_追加時間」）
 *     ② 以時間戳記欄找出最後一筆資料的位置
 *     ③ 逐「欄」寫入：只寫有對應的欄，承辦人自己加的欄位（含公式）完全不碰
 *     ④ 電話、手機類欄位先設為純文字
 *     ⑤ 新列加上淺黃底色，方便辨認尚未整理的資料
 *
 * 參數：
 *   obj分頁   {Sheet}    副本「有效資料」分頁
 *   arr欄值   {Object[]} 由 轉換回應為欄值_ 產生
 * 傳回：
 *   {Object} { int新增筆數, arr新增欄位, int起始列 }
 * ============================================================================
 */
function 追加回應到副本_(obj分頁, arr欄值) {
  if (!arr欄值 || arr欄值.length === 0) return { int新增筆數: 0, arr新增欄位: [], int起始列: 0 };

  const str追加欄 = obj法會設定.str系統追加時間欄名;

  // ① 這批回應用到的所有欄名，補齊副本缺少的欄位
  const arr需要欄 = [];
  arr欄值.forEach(function (obj) {
    Object.keys(obj).forEach(function (str) { if (arr需要欄.indexOf(str) === -1) arr需要欄.push(str); });
  });
  const arr全部欄 = arr需要欄.concat([str追加欄]);
  const arr新增欄位 = 確保副本欄位存在_(obj分頁, arr全部欄);
  const obj索引 = 取得副本標題索引_(obj分頁);

  // ② 寫入起始列：以時間戳記欄為準；找不到時間戳記欄才用 getLastRow()
  const int時間欄 = obj索引[obj法會設定.str時間戳記欄名];
  const int最後列 = int時間欄 ? 取得副本最後資料列_(obj分頁, int時間欄) : Math.max(obj分頁.getLastRow(), 1);
  const int起始列 = int最後列 + 1;
  const int筆數 = arr欄值.length;
  const int需要列數 = int起始列 + int筆數 - 1;
  if (int需要列數 > obj分頁.getMaxRows()) {
    obj分頁.insertRowsAfter(obj分頁.getMaxRows(), int需要列數 - obj分頁.getMaxRows());
  }

  // ③ 逐欄寫入
  const dat現在 = new Date();
  arr全部欄.forEach(function (str欄名) {
    const int欄號 = obj索引[String(str欄名).trim()];
    if (!int欄號) return;   // 理論上不會發生（上面已補欄），保險起見略過
    const arr欄資料 = arr欄值.map(function (obj) {
      if (str欄名 === str追加欄) return [dat現在];
      const any值 = obj[str欄名];
      return [(any值 === undefined || any值 === null) ? '' : any值];
    });
    const obj範圍 = obj分頁.getRange(int起始列, int欄號, int筆數, 1);
    // ④ 電話、手機類欄位：先設純文字，避免 0912… 變成 912…
    if (是否為文字格式欄_(str欄名)) {
      obj範圍.setNumberFormat('@');
      arr欄資料.forEach(function (arr) { arr[0] = String(arr[0]); });
    }
    obj範圍.setValues(arr欄資料);
  });

  // ⑤ 新列上底色
  obj分頁.getRange(int起始列, 1, int筆數, obj分頁.getLastColumn()).setBackground(obj法會設定.str新列底色);

  return { int新增筆數: int筆數, arr新增欄位: arr新增欄位, int起始列: int起始列 };
}


/**
 * ============================================================================
 * 函式名稱：貼入原始資料_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：
 *   建立副本時，把原始回覆分頁的全部內容（標題列＋資料列）貼到副本「有效資料」A1 起。
 *     ① 清除「有效資料」原有內容（範本應為空白；只清內容，保留範本設定的格式）
 *     ② 列數、欄數不足時自動補足
 *     ③ 先套數值格式再寫值：手機開頭的 0、時間戳記的日期格式都會保留
 *     ④ 標題含「電話、手機」的欄位一律設為純文字
 *     ⑤ 標題列粗體並凍結
 *   只複製「值」不複製公式。
 *
 * 參數：
 *   obj來源分頁   {Sheet} 原始回覆分頁
 *   obj有效分頁   {Sheet} 副本「有效資料」分頁
 * 傳回：{number} 貼入的資料筆數（不含標題列）
 * ============================================================================
 */
function 貼入原始資料_(obj來源分頁, obj有效分頁) {
  const int列數 = obj來源分頁.getLastRow();
  const int欄數 = obj來源分頁.getLastColumn();

  // 一次讀取值與數值格式（大量資料也只呼叫兩次）
  const obj來源範圍 = obj來源分頁.getRange(1, 1, int列數, int欄數);
  const arr值 = obj來源範圍.getValues();
  const arr格式 = obj來源範圍.getNumberFormats();

  // ④ 電話、手機類欄位：格式設為純文字，值轉為文字
  //    表單寫入回覆試算表時，0912345678 常被當成數字而變成 912345678；
  //    9 碼且 9 開頭的數字是被吃掉 0 的手機號碼，補回開頭的 0
  arr值[0].forEach(function (any標題, int欄) {
    if (!是否為文字格式欄_(String(any標題))) return;
    for (let int列 = 1; int列 < int列數; int列++) {
      arr格式[int列][int欄] = '@';
      const any值 = arr值[int列][int欄];
      let str值 = (any值 === null || any值 === undefined) ? '' : String(any值);
      if (typeof any值 === 'number' && /^9\d{8}$/.test(str值)) str值 = '0' + str值;
      arr值[int列][int欄] = str值;
    }
  });

  // ① 清除既有內容
  obj有效分頁.clearContents();

  // ② 列數、欄數不足時補足
  if (int列數 > obj有效分頁.getMaxRows()) {
    obj有效分頁.insertRowsAfter(obj有效分頁.getMaxRows(), int列數 - obj有效分頁.getMaxRows());
  }
  if (int欄數 > obj有效分頁.getMaxColumns()) {
    obj有效分頁.insertColumnsAfter(obj有效分頁.getMaxColumns(), int欄數 - obj有效分頁.getMaxColumns());
  }

  // ③ 先套格式、再寫值
  const obj目的範圍 = obj有效分頁.getRange(1, 1, int列數, int欄數);
  obj目的範圍.setNumberFormats(arr格式);
  obj目的範圍.setValues(arr值);

  // ⑤ 標題列粗體並凍結
  obj有效分頁.getRange(1, 1, 1, int欄數).setFontWeight('bold');
  obj有效分頁.setFrozenRows(1);
  SpreadsheetApp.flush();   // 確保寫入完成，接著才讀時間戳記做登記

  return int列數 - 1;
}


/**
 * ============================================================================
 * 函式名稱：讀取副本時間戳記集合_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：讀出副本時間戳記欄所有時間，轉成「精確到秒」的集合，
 *       建立副本時用來判斷哪些表單回應已在副本中。
 * 參數：
 *   obj分頁   {Sheet} 副本「有效資料」分頁
 * 傳回：{Object} { '秒數': true }
 * ============================================================================
 */
function 讀取副本時間戳記集合_(obj分頁) {
  const obj集合 = {};
  const int欄號 = 取得副本標題索引_(obj分頁)[obj法會設定.str時間戳記欄名];
  if (!int欄號 || obj分頁.getLastRow() < 2) return obj集合;
  obj分頁.getRange(2, int欄號, obj分頁.getLastRow() - 1, 1).getValues().forEach(function (arr) {
    if (Object.prototype.toString.call(arr[0]) === '[object Date]' && !isNaN(arr[0].getTime())) {
      obj集合[String(Math.floor(arr[0].getTime() / 1000))] = true;
    }
  });
  return obj集合;
}


/**
 * ============================================================================
 * 函式名稱：時間在集合中_（內部使用）
 * 版本：v1.0.0（2026-10-26）
 * ----------------------------------------------------------------------------
 * 用途：表單回應時間是否出現在副本中（容許 ±1 秒誤差，避免精度差異誤判）。
 * 參數：
 *   obj集合   {Object} 讀取副本時間戳記集合_ 的結果
 *   dat時間   {Date}   表單回應的時間
 * 傳回：{boolean}
 * ============================================================================
 */
function 時間在集合中_(obj集合, dat時間) {
  const int秒 = Math.floor(dat時間.getTime() / 1000);
  return !!(obj集合[String(int秒)] || obj集合[String(int秒 - 1)] || obj集合[String(int秒 + 1)]);
}
