// ============================================================================
// 檔案名稱：event/報到表格.js
// 所屬模組：法會活動（event）
// 所屬層級：前端／共用元件
// 檔案版本：v1.3.0（2026-11-07）
//   v1.3.0：備註欄加上用齋（名冊合併用齋登記時：大寮・午齋×2）
//   v1.2.0：取消（決策 AS～AU）：
//           · 「已報到」「未報到」畫面最右邊加「取消」勾選欄（可全選）：
//               勾已報到的人 →「還原成未報到」（點錯報到者）；勾還沒報到的人 →「取消參加」（學員請假，可填原因）
//           · 「未報到」打勾後那一列先保留（淡綠底），可再勾「取消」還原，換標籤或時段才移除
//           · 請假的人在「未報到」最下方「取消參加」區（灰底），勾選後可「恢復參加」；「全部」畫面備註顯示取消參加
//           · 場次取消時頂端顯示紅色說明，不能打勾報到（已勾的仍可點一下取消）
//   v1.1.0：索引標籤「全部｜已報到｜未報到」（依選的時段篩選，標籤顯示人數）；報到頁可直接指定篩選（bool篩選標籤: false 時不顯示內部標籤）
// 用途說明：
//   「表格打勾報到」元件（決策 AH～AK），報到頁 checkin.html（報到志工）與法會活動網頁補登（承辦人）共用。
//     · 欄位、排序、灰底與紙本報到表相同（排序由後端算好，序號一致）
//     · 點時段格：先在畫面打勾，同時在背景寫入；失敗的格子變紅，再點一次重試
//     · 點已打勾的格：確認後取消（報到紀錄新增一筆「取消報到」）；已報到／未報到畫面另有「取消」勾選欄（v1.2.0）
//     · 姓名搜尋框、各時段「報名／已到」人數
//     · 索引標籤「全部｜已報到｜未報到」（v1.1.0）：
//         已報到＝選的時段已打勾的人；未報到＝報了這個時段（名冊上的人）但還沒打勾的人；
//         分時段的活動可選要看哪一個時段（預設目前時段）。
//     · 「取消」勾選欄（v1.2.0，已報到／未報到畫面）：
//         還原成未報到：逐筆寫入「取消報到」；取消參加／恢復參加：一次送出（event.取消參加）
//     · 每 15 秒讀取異動（其他電腦打的勾、新增的現場報到者）
//     · 「＋ 新增未報名者」：輸入姓名或編號搜尋 → 表格已有同名就跳到那一列；
//       找到學員就用他的編號；都找不到就填姓名報到（後端當場配發臨時編號）
//
// 使用方式：
//   const obj表格 = 建立報到表格({
//     el容器: 取得元素('表格區'),
//     fn呼叫: function (str動作, obj參數) { return 呼叫平台(str動作, obj參數); },   // 補登時由呼叫端加上 str活動ID
//     str場次: '欲參加時段 [11/15 (日)]',
//     int目前時段: 0,                        // 新增未報名者預先勾的時段
//     arr方式: ['紙本', '表格'],             // 補登才給：可選的報到方式（第一個為預設）；志工不給
//     str篩選: '全部',                        // 選填：'全部'｜'已報到'｜'未報到'
//     bool篩選標籤: true,                     // 選填：false＝不顯示內部的索引標籤（報到頁用自己的標籤切換）
//     fn登入逾時: function (str訊息) {…}     // 選填
//   });
//   obj表格.載入();      // 讀取並畫出
//   obj表格.停止();      // 離開畫面時停止自動更新
//   obj表格.設定篩選('未報到');   // 切換篩選（不重新讀取）
//
// 相依檔案：core/shared/ui.js（跳脫HTML、取得錯誤訊息）、event/報到表格.css
// ============================================================================

/* global 跳脫HTML, 取得錯誤訊息 */
/* exported 建立報到表格 */

// 自動更新間隔（毫秒）
const int報到表格更新毫秒_ = 15000;


/**
 * ============================================================================
 * 函式名稱：建立報到表格
 * 版本：v1.0.0（2026-11-07）
 * ----------------------------------------------------------------------------
 * 用途：在指定容器建立一個報到表格元件。
 * 參數：obj設定 {Object} 見檔頭「使用方式」
 * 傳回：{Object} { 載入(), 停止(), 設定目前時段(int), 設定篩選(str) }
 * v1.2.0：已報到／未報到畫面加「取消」勾選欄與批次取消
 * ============================================================================
 */
function 建立報到表格(obj設定) {
  // ── 元件狀態 ──
  const obj狀態 = {
    obj資料: null,           // 後端 event.讀取報到表格 的結果
    obj寫入中: {},           // '鍵|時段' → true（背景寫入中，畫面已先改）
    obj失敗: {},             // '鍵|時段' → 失敗訊息
    str搜尋: '',
    str方式: (obj設定.arr方式 && obj設定.arr方式[0]) || '',
    int計時: null,
    bool更新中: false,
    str更新時間: '',
    bool顯示新增: false,
    int目前時段: Number(obj設定.int目前時段) || 0,
    bool已停止: false,
    str篩選: obj設定.str篩選 || '全部',                      // v1.1.0：全部｜已報到｜未報到
    int篩選時段: Number(obj設定.int目前時段) || 0,           // 已報到／未報到看哪一個時段
    bool篩選標籤: obj設定.bool篩選標籤 !== false,
    obj保留: {},             // v1.2.0：在「未報到」剛打勾、先留在清單的人（人員鍵 → true）
    obj取消選: {},           // v1.2.0：「取消」欄勾選的人（人員鍵 → true）
    bool批次中: false        // v1.2.0：還原／取消參加／恢復參加 送出中
  };
  const el容器 = obj設定.el容器;
  const str裝置 = (navigator.userAgent || '').replace(/\s+/g, ' ').slice(0, 60);

  // ── 小工具 ──
  const fn格鍵 = function (str鍵, int時段) { return `${str鍵}|${int時段}`; };
  const fn找列 = function (str鍵) { return (obj狀態.obj資料.arr列 || []).filter(function (o) { return o.str鍵 === str鍵; })[0] || null; };
  const fn時段數 = function () { return (obj狀態.obj資料.arr時段 || []).length || 1; };
  const fn現在時分 = function () { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  /**
   * 這一列在目前的篩選（全部／已報到／未報到）中要不要顯示（v1.1.0）
   *   寫入中、寫入失敗的列一律顯示（剛打勾的人不會在結果出來前消失）
   */
  function 符合篩選(o, str篩選) {
    const str = str篩選 || obj狀態.str篩選;
    if (str === '全部') return true;
    const int時段 = obj狀態.int篩選時段;
    for (let j = 0; j < fn時段數(); j++) {
      if (obj狀態.obj寫入中[fn格鍵(o.str鍵, j)] || obj狀態.obj失敗[fn格鍵(o.str鍵, j)]) return str === obj狀態.str篩選;
    }
    const bool已到 = !!(o.obj勾 || {})[int時段];
    if (str === '已報到') return bool已到;
    // 未報到：名冊上報了這個時段的人（不分時段＝名冊上的人；報名內容對不到時段的也算）
    //   v1.2.0：在這個畫面剛打勾的人（obj保留）先留著，方便撤回
    if (str === '未報到' && str === obj狀態.str篩選 && obj狀態.obj保留[o.str鍵]) return true;
    if (bool已到 || o.bool現場 || o.obj取消參加) return false;     // 請假的人另列在「取消參加」區
    return fn時段數() < 2 || (o.arr報名序 || []).length === 0 || o.arr報名序.indexOf(int時段) !== -1;
  }

  /**
   * 「取消」欄可以對這一列做哪一種取消（v1.2.0）
   *   '還原'＝篩選時段已報到（點錯報到者 → 還原成未報到）
   *   '請假'＝名冊上的人、還沒報到任何時段、沒有取消參加（→ 取消參加），只在「未報到」畫面
   *   '恢復'＝已登記取消參加（→ 恢復參加），只在「未報到」畫面
   *   ''＝不能勾
   */
  function 取消種類(o) {
    const int時段 = obj狀態.int篩選時段;
    if (obj狀態.obj寫入中[fn格鍵(o.str鍵, int時段)]) return '';
    if ((o.obj勾 || {})[int時段]) return '還原';
    if (obj狀態.str篩選 !== '未報到' || o.bool現場) return '';
    if (o.obj取消參加) return '恢復';
    return Object.keys(o.obj勾 || {}).length === 0 ? '請假' : '';
  }

  /**
   * 「取消」欄目前勾選、而且是某一種取消的人員鍵（v1.2.0）
   */
  function 取消選清單(str種類) {
    return Object.keys(obj狀態.obj取消選).filter(function (str鍵) { const o = fn找列(str鍵); return !!o && 取消種類(o) === str種類; });
  }

  /**
   * 清掉保留列與取消勾選（換標籤、換時段時呼叫）（v1.2.0）
   */
  function 清除選取() {
    obj狀態.obj保留 = {};
    obj狀態.obj取消選 = {};
  }

  function 符合搜尋(o) {
    return obj狀態.str搜尋 === '' || `${o.str姓名}${o.str法名}${o.str學員編號}`.indexOf(obj狀態.str搜尋) !== -1;
  }

  /**
   * 「未報到」畫面最下方的「取消參加」區：報了這個時段、請假、沒報到的人（v1.2.0）
   */
  function 請假列() {
    if (obj狀態.str篩選 !== '未報到') return [];
    const int時段 = obj狀態.int篩選時段;
    return (obj狀態.obj資料.arr列 || []).filter(function (o) {
      return o.obj取消參加 && !(o.obj勾 || {})[int時段] && !obj狀態.obj保留[o.str鍵]
        && (fn時段數() < 2 || (o.arr報名序 || []).length === 0 || o.arr報名序.indexOf(int時段) !== -1);
    });
  }

  function 篩選人數(str篩選) {
    return (obj狀態.obj資料.arr列 || []).filter(function (o) { return 符合篩選(o, str篩選); }).length;
  }

  /**
   * 呼叫後端；登入逾時交給呼叫端處理
   */
  async function 呼叫(str動作, obj參數) {
    try {
      return await obj設定.fn呼叫(str動作, obj參數);
    } catch (err) {
      if (err && err.str錯誤代碼 === 'SESSION_EXPIRED') {
        停止();
        if (typeof obj設定.fn登入逾時 === 'function') obj設定.fn登入逾時(err.str訊息);
      }
      throw err;
    }
  }

  // ==========================================================================
  // 畫面
  // ==========================================================================

  /**
   * 畫出整個元件（保留搜尋框焦點與新增區內容）
   */
  function 畫() {
    const obj = obj狀態.obj資料;
    if (!obj) return;
    const el舊新增 = el容器.querySelector('.新增區');
    const obj舊值 = el舊新增 ? { 關鍵: (el舊新增.querySelector('[name=關鍵]') || {}).value, 姓名: (el舊新增.querySelector('[name=姓名]') || {}).value,
      法名: (el舊新增.querySelector('[name=法名]') || {}).value, 結果: (el舊新增.querySelector('.新增結果') || {}).innerHTML } : null;
    const bool搜尋焦點 = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.報到 === '搜尋';

    const arr時段 = obj.arr時段 || [];
    const bool分時段 = arr時段.length >= 2;

    // 頂端：日期、人數、更新時間、補登方式
    let str = `<div class="表格頂"><span class="表格標題">${跳脫HTML(obj.str日期 || '')}　${跳脫HTML(obj.str場次 || '')}</span>
      <span class="更新時間">${obj狀態.str更新時間 ? `${跳脫HTML(obj狀態.str更新時間)} 已更新` : ''}${obj狀態.bool更新中 ? '　更新中…' : ''}</span></div>`;
    if (obj.obj場次取消) {
      str += `<p class="訊息 場次取消" role="alert">${跳脫HTML(obj.obj場次取消.str說明)}。這個場次不能報到；已打勾的格子仍可點一下取消。如果照常舉行，請承辦人在法會活動網頁按「恢復場次」。</p>`;
    }
    if (!obj.bool有名冊) str += '<p class="訊息" role="status">這個場次還沒有下載名冊，表格中只有現場報到的人（全部記「未報名」）。</p>';
    str += `<div class="人數列">${(obj.arr人數 || []).map(function (o) {
      return `<span class="人數標">${跳脫HTML(o.str名稱)}　報名 <strong>${Number(o.int報名)}</strong>／已到 <strong>${Number(o.int已到)}</strong>${Number(o.int取消參加) > 0 ? `／取消參加 ${Number(o.int取消參加)}` : ''}</span>`;
    }).join('')}</div>`;

    // 索引標籤：全部｜已報到｜未報到（v1.1.0）
    if (obj狀態.bool篩選標籤) {
      str += `<div class="篩選列" role="tablist" aria-label="顯示哪些人">${['全部', '已報到', '未報到'].map(function (s) {
        const int數 = s === '全部' ? (obj.arr列 || []).length : 篩選人數(s);
        return `<button type="button" class="篩選" role="tab" data-報到="篩選" data-值="${s}" aria-selected="${s === obj狀態.str篩選 ? 'true' : 'false'}">${s}<span class="篩選數">${int數}</span></button>`;
      }).join('')}</div>`;
    }
    if (obj狀態.str篩選 !== '全部' && bool分時段) {
      str += `<div class="搜尋列"><label>時段 <select class="輸入" data-報到="篩選時段" style="width:auto">${arr時段.map(function (o, j) {
        return `<option value="${j}" ${j === obj狀態.int篩選時段 ? 'selected' : ''}>${跳脫HTML(o.str名稱)}　${跳脫HTML(o.str起迄 || '')}</option>`;
      }).join('')}</select></label>
        <span class="小字">${obj狀態.str篩選}：<strong>${篩選人數()}</strong> 人${obj狀態.str篩選 === '未報到' ? '（報了這個時段、還沒打勾的人；打勾後先保留，換標籤或時段才移除）' : ''}</span></div>`;
    } else if (obj狀態.str篩選 !== '全部') {
      str += `<p class="小字" style="margin:0 0 0.5rem">${obj狀態.str篩選}：<strong>${篩選人數()}</strong> 人</p>`;
    }

    str += `<div class="搜尋列"><input class="輸入" type="search" placeholder="搜尋姓名或法名（打一兩個字）" data-報到="搜尋" value="${跳脫HTML(obj狀態.str搜尋)}" aria-label="搜尋姓名">`;
    if (obj設定.arr方式 && obj設定.arr方式.length > 0) {
      str += `<label class="小字">報到方式 <select class="輸入" data-報到="方式" style="width:auto">${obj設定.arr方式.map(function (s) {
        return `<option ${s === obj狀態.str方式 ? 'selected' : ''}>${跳脫HTML(s)}</option>`;
      }).join('')}</select></label>`;
    }
    str += '<button type="button" class="按鈕 小" data-報到="重新整理">重新整理</button></div>';

    // 取消列（v1.2.0，已報到／未報到）
    const bool取消欄 = obj狀態.str篩選 !== '全部';
    if (bool取消欄) {
      const fn鈕 = function (str種類, str文字, str類別) {
        const int選 = 取消選清單(str種類).length;
        return `<button type="button" class="按鈕 小${str類別 ? " " + str類別 : ""}" data-報到="批次取消" data-種類="${str種類}" ${int選 === 0 || obj狀態.bool批次中 ? 'disabled' : ''}>${str文字}（${int選} 人）</button>`;
      };
      str += `<div class="取消列"><span class="小字">${obj狀態.bool批次中 ? '處理中…' : '勾右邊「取消」欄，再按：'}</span>
        ${fn鈕('還原', '還原成未報到', '')}
        ${obj狀態.str篩選 === '未報到' ? fn鈕('請假', '取消參加（請假）', '警示') + fn鈕('恢復', '恢復參加', '') : ''}</div>`;
    }

    // 表格
    str += '<div class="表格捲動"><table><thead><tr><th>序號</th><th>姓名</th><th>法名</th><th class="登記">報名登記</th>';
    arr時段.forEach(function (o) { str += `<th>${跳脫HTML(o.str名稱)}${o.str起迄 ? `<br><span class="小字">${跳脫HTML(o.str起迄)}</span>` : ''}</th>`; });
    str += '<th>備註</th>';
    if (bool取消欄) {
      const arr可 = (obj.arr列 || []).filter(function (o) { return 符合篩選(o) && 取消種類(o) !== '' && 取消種類(o) !== '恢復'; });
      const bool全選 = arr可.length > 0 && arr可.every(function (o) { return obj狀態.obj取消選[o.str鍵]; });
      str += `<th class="取消欄"><label>取消<br><input type="checkbox" data-報到="取消全選" ${bool全選 ? 'checked' : ''} ${arr可.length === 0 ? 'disabled' : ''} aria-label="全選要取消的報到"></label></th>`;
    }
    str += '</tr></thead><tbody>';
    const int欄數 = 5 + arr時段.length + (bool取消欄 ? 1 : 0);

    let bool已畫現場標 = false;
    const arr顯示列 = (obj.arr列 || []).filter(function (o) { return 符合篩選(o); });
    arr顯示列.forEach(function (o) {
      if (o.bool現場 && !bool已畫現場標) {
        str += `<tr class="區隔"><td colspan="${int欄數}">現場報到（未報名）</td></tr>`;
        bool已畫現場標 = true;
      }
      const bool符合 = 符合搜尋(o);
      const str列類別 = [o.str提醒 ? '提醒列' : '', obj狀態.str篩選 === '未報到' && obj狀態.obj保留[o.str鍵] ? '保留列' : '',
        o.obj取消參加 ? '請假列' : ''].join(' ').trim();
      str += `<tr data-鍵="${跳脫HTML(o.str鍵)}" class="${str列類別}" ${bool符合 ? '' : 'hidden'}>
        <td>${Number(o.int序號)}</td><td class="姓名">${跳脫HTML(o.str姓名 || '（待補姓名）')}</td><td class="法名">${跳脫HTML(o.str法名)}</td>
        <td class="登記">${跳脫HTML(String(o.str報名登記 || '').split('、').join('\n'))}</td>`;
      for (let j = 0; j < arr時段.length; j++) {
        const str格鍵 = fn格鍵(o.str鍵, j);
        const obj勾 = (o.obj勾 || {})[j];
        const bool灰 = bool分時段 && !o.bool現場 && (o.arr報名序 || []).length > 0 && o.arr報名序.indexOf(j) === -1;
        const str類別 = ['勾', obj勾 ? '已到' : '', obj狀態.obj寫入中[str格鍵] ? '寫入中' : '', obj狀態.obj失敗[str格鍵] ? '失敗' : ''].join(' ');
        const str說明 = obj狀態.obj失敗[str格鍵] ? `寫入失敗：${obj狀態.obj失敗[str格鍵]}（再點一次重試）`
          : (obj勾 ? `${obj勾.str時間} 報到（${obj勾.str方式 || ''}），再點一下可取消` : `${o.str姓名}「${arr時段[j].str名稱}」報到`);
        str += `<td class="格${bool灰 ? ' 灰' : ''}"><button type="button" class="${str類別}" data-報到="勾" data-鍵="${跳脫HTML(o.str鍵)}" data-時段="${j}"
          title="${跳脫HTML(str說明)}" aria-label="${跳脫HTML(str說明)}" aria-pressed="${obj勾 ? 'true' : 'false'}">${obj勾
          ? `✓ <span class="時間">${跳脫HTML(obj勾.str時間 || '')}</span>` : (obj狀態.obj失敗[str格鍵] ? '！' : '<span class="方框"></span>')}</button></td>`;
      }
      str += `<td class="備註">${跳脫HTML([o.str提醒 || '', o.str用齋 || '', 取消參加說明(o)].filter(Boolean).join('；'))}</td>`;   // v1.3.0：用齋
      if (bool取消欄) str += 取消格HTML(o);
      str += '</tr>';
    });
    str += 請假區HTML(arr時段, int欄數);
    if (arr顯示列.length === 0) {
      const str空 = obj狀態.str篩選 === '已報到' ? '這個時段還沒有人報到' : (obj狀態.str篩選 === '未報到' ? '報了這個時段的人都已報到 🙏' : '還沒有任何人');
      str += `<tr><td colspan="${int欄數}" class="小字">${str空}</td></tr>`;
    }
    str += '</tbody></table></div>';

    // 新增未報名者（只在「全部」顯示）
    if (obj狀態.str篩選 === '全部' && !obj.obj場次取消) str += obj狀態.bool顯示新增 ? 新增區HTML()
      : '<p style="margin:0.75rem 0 0"><button type="button" class="按鈕" data-報到="開新增">＋ 新增未報名者</button></p>';

    el容器.innerHTML = `<div class="報到表格">${str}</div>`;

    // 還原
    if (obj舊值 && obj狀態.bool顯示新增) {
      const el新 = el容器.querySelector('.新增區');
      ['關鍵', '姓名', '法名'].forEach(function (k) { if (obj舊值[k] !== undefined && el新.querySelector(`[name=${k}]`)) el新.querySelector(`[name=${k}]`).value = obj舊值[k]; });
      if (obj舊值.結果) el新.querySelector('.新增結果').innerHTML = obj舊值.結果;
    }
    if (bool搜尋焦點) {
      const el搜尋 = el容器.querySelector('[data-報到=搜尋]');
      el搜尋.focus();
      el搜尋.setSelectionRange(el搜尋.value.length, el搜尋.value.length);
    }
  }

  /**
   * 備註欄的取消參加說明（v1.2.0）
   */
  function 取消參加說明(o) {
    if (!o.obj取消參加) return '';
    return `取消參加${o.obj取消參加.str原因 ? `：${o.obj取消參加.str原因}` : ''}`;
  }

  /**
   * 「取消」欄的一格：可勾時放勾選框（說明依取消種類）（v1.2.0）
   */
  function 取消格HTML(o) {
    const str種類 = 取消種類(o);
    if (str種類 === '') return '<td class="取消欄"></td>';
    const str名 = o.str姓名 || '（待補姓名）';
    const str說明 = { 還原: `${str名}：還原成未報到`, 請假: `${str名}：取消參加（請假）`, 恢復: `${str名}：恢復參加` }[str種類];
    return `<td class="取消欄"><input type="checkbox" data-報到="取消選" data-鍵="${跳脫HTML(o.str鍵)}" ${obj狀態.obj取消選[o.str鍵] ? 'checked' : ''}
      title="${跳脫HTML(str說明)}" aria-label="${跳脫HTML(str說明)}"></td>`;
  }

  /**
   * 「未報到」最下方的「取消參加」區（v1.2.0）
   */
  function 請假區HTML(arr時段, int欄數) {
    const arr = 請假列();
    if (arr.length === 0) return '';
    let str = `<tr class="區隔 請假"><td colspan="${int欄數}">取消參加（請假）${arr.length} 人：勾「取消」欄後可按「恢復參加」；他們來了也可以直接打勾報到</td></tr>`;
    arr.forEach(function (o) {
      str += `<tr data-鍵="${跳脫HTML(o.str鍵)}" class="請假列" ${符合搜尋(o) ? '' : 'hidden'}>
        <td>${Number(o.int序號)}</td><td class="姓名">${跳脫HTML(o.str姓名)}</td><td class="法名">${跳脫HTML(o.str法名)}</td>
        <td class="登記">${跳脫HTML(String(o.str報名登記 || '').split('、').join('\n'))}</td>`;
      arr時段.forEach(function (t, j) {
        str += `<td class="格"><button type="button" class="勾" data-報到="勾" data-鍵="${跳脫HTML(o.str鍵)}" data-時段="${j}"
          aria-label="${跳脫HTML(`${o.str姓名}「${t.str名稱}」報到`)}"><span class="方框"></span></button></td>`;
      });
      str += `<td class="備註">${跳脫HTML([o.str用齋 || '', 取消參加說明(o) + (o.obj取消參加.str人員 ? `（${o.obj取消參加.str人員} ${o.obj取消參加.str時間}）` : '')].filter(Boolean).join('；'))}</td>${取消格HTML(o)}</tr>`;
    });
    return str;
  }

  /**
   * 新增未報名者的輸入區
   */
  function 新增區HTML() {
    const arr時段 = obj狀態.obj資料.arr時段 || [];
    return `<div class="新增區"><h4>新增未報名者</h4>
      <div class="列"><label class="欄位">先找找看（姓名或學員編號）<input class="輸入" name="關鍵" autocomplete="off"></label>
        <button type="button" class="按鈕 小" data-報到="找人">搜尋</button></div>
      <div class="新增結果"></div>
      <div class="列"><label class="欄位">姓名（必填）<input class="輸入" name="姓名" autocomplete="off"></label>
        <label class="欄位">法名<input class="輸入" name="法名" autocomplete="off"></label></div>
      <div class="時段勾選" role="group" aria-label="報到時段">${arr時段.map(function (o, j) {
        return `<label><input type="checkbox" name="時段" value="${j}" ${j === obj狀態.int目前時段 ? 'checked' : ''}> ${跳脫HTML(o.str名稱)}</label>`;
      }).join('')}</div>
      <p class="小字" style="margin:0 0 0.5rem">名冊沒有這個人時才在這裡新增；學員名冊也找不到時，系統會配發臨時編號。</p>
      <div class="列"><button type="button" class="按鈕 主要" data-報到="新增" data-編號="">報到</button>
        <button type="button" class="按鈕" data-報到="關新增">取消</button></div></div>`;
  }

  /**
   * 只更新人數（打勾後不必整個重畫）
   */
  function 重算人數() {
    const obj = obj狀態.obj資料;
    (obj.arr人數 || []).forEach(function (o, j) {
      o.int已到 = obj.arr列.filter(function (r) { return (r.obj勾 || {})[j]; }).length;
    });
  }

  // ==========================================================================
  // 讀取與自動更新
  // ==========================================================================

  /**
   * 讀取整份表格並畫出；開始自動更新
   */
  async function 載入() {
    obj狀態.bool已停止 = false;
    el容器.innerHTML = '<p class="載入中">正在讀取報到表格…</p>';
    try {
      obj狀態.obj資料 = await 呼叫('event.讀取報到表格', { str場次: obj設定.str場次 });
      obj狀態.str更新時間 = fn現在時分();
      畫();
      排定更新();
    } catch (err) {
      el容器.innerHTML = `<p class="訊息" role="alert">${跳脫HTML(取得錯誤訊息(err))}</p>
        <button type="button" class="按鈕 小" data-報到="重新整理">重新讀取</button>`;
    }
  }

  function 排定更新() {
    if (obj狀態.int計時) clearTimeout(obj狀態.int計時);
    if (obj狀態.bool已停止) return;
    obj狀態.int計時 = setTimeout(更新, int報到表格更新毫秒_);
  }

  /**
   * 讀取異動：紀錄筆數不同才換新資料；背景寫入中的格子保留畫面上的狀態
   */
  async function 更新() {
    if (obj狀態.bool已停止 || !el容器.isConnected) { 停止(); return; }
    if (document.hidden || obj狀態.bool更新中) { 排定更新(); return; }
    obj狀態.bool更新中 = true;
    try {
      const obj結果 = await 呼叫('event.讀取報到異動', { str場次: obj狀態.obj資料.str場次, int紀錄數: obj狀態.obj資料.int紀錄數 });
      if (obj結果.bool有異動) {
        const obj舊 = obj狀態.obj資料;
        obj狀態.obj資料 = obj結果;
        // 寫入中的格子：沿用舊畫面的狀態，等寫入結果
        Object.keys(obj狀態.obj寫入中).forEach(function (k) {
          const arr = k.split('|');
          const str鍵 = arr.slice(0, -1).join('|');
          const int時段 = Number(arr[arr.length - 1]);
          const o舊 = (obj舊.arr列 || []).filter(function (r) { return r.str鍵 === str鍵; })[0];
          const o新 = fn找列(str鍵);
          if (o舊 && o新) { o新.obj勾 = Object.assign({}, o新.obj勾); if ((o舊.obj勾 || {})[int時段]) o新.obj勾[int時段] = o舊.obj勾[int時段]; else delete o新.obj勾[int時段]; }
        });
        重算人數();
      }
      obj狀態.str更新時間 = fn現在時分();
    } catch (err) {
      obj狀態.str更新時間 = `${fn現在時分()} 更新失敗（${取得錯誤訊息(err)}），`;
    } finally {
      obj狀態.bool更新中 = false;
      if (!obj狀態.bool已停止) { 畫(); 排定更新(); }
    }
  }

  function 停止() {
    obj狀態.bool已停止 = true;
    if (obj狀態.int計時) clearTimeout(obj狀態.int計時);
    obj狀態.int計時 = null;
  }

  // ==========================================================================
  // 打勾
  // ==========================================================================

  /**
   * 點一格：未勾 → 報到；已勾 → 確認後取消。畫面先改，背景寫入。
   */
  async function 點格(str鍵, int時段) {
    const str格鍵 = fn格鍵(str鍵, int時段);
    if (obj狀態.obj寫入中[str格鍵]) return;
    const o = fn找列(str鍵);
    if (!o) return;
    const obj原 = (o.obj勾 || {})[int時段] || null;
    const bool取消 = !!obj原 && !obj狀態.obj失敗[str格鍵];
    if (!bool取消 && obj狀態.obj資料.obj場次取消) {
      window.alert(`${obj狀態.obj資料.obj場次取消.str說明}，不能報到。`);
      return;
    }
    if (bool取消) {
      const str時段 = obj狀態.obj資料.arr時段[int時段].str名稱;
      if (!window.confirm(`取消「${o.str姓名 || '（待補姓名）'}」${fn時段數() > 1 ? `「${str時段}」` : ''}的報到？`)) return;
    }

    // 在「未報到」打勾：先保留這一列（v1.2.0）
    if (!bool取消 && obj狀態.str篩選 === '未報到' && int時段 === obj狀態.int篩選時段) obj狀態.obj保留[str鍵] = true;
    await 寫入格(str鍵, int時段, bool取消);
  }

  /**
   * 寫入一格（報到或取消）：畫面先改，背景寫入；失敗還原並標紅（v1.2.0 由 點格 拆出，批次取消共用）
   * 傳回：{Promise<boolean>} 是否成功
   */
  async function 寫入格(str鍵, int時段, bool取消) {
    const str格鍵 = fn格鍵(str鍵, int時段);
    const o = fn找列(str鍵);
    if (!o || obj狀態.obj寫入中[str格鍵]) return false;
    const obj原 = (o.obj勾 || {})[int時段] || null;
    let bool成功 = false;

    // 先改畫面
    o.obj勾 = Object.assign({}, o.obj勾);
    if (bool取消) delete o.obj勾[int時段];
    else o.obj勾[int時段] = { str時間: fn現在時分(), str方式: obj狀態.str方式 || '表格' };
    delete obj狀態.obj失敗[str格鍵];
    obj狀態.obj寫入中[str格鍵] = true;
    重算人數();
    畫();

    try {
      const obj結果 = await 呼叫('event.表格報到', {
        str場次: obj狀態.obj資料.str場次, str人員鍵: str鍵, int時段: int時段, bool取消: bool取消,
        str方式: obj狀態.str方式, str裝置: str裝置
      });
      const o新 = fn找列(str鍵);
      if (o新) {
        o新.obj勾 = Object.assign({}, o新.obj勾);
        if (obj結果.bool已報到) o新.obj勾[int時段] = { str時間: obj結果.str時間, str方式: obj結果.str方式 };
        else delete o新.obj勾[int時段];
      }
      bool成功 = true;
    } catch (err) {
      // 失敗：還原並標紅
      const o新 = fn找列(str鍵);
      if (o新) { o新.obj勾 = Object.assign({}, o新.obj勾); if (obj原) o新.obj勾[int時段] = obj原; else delete o新.obj勾[int時段]; }
      if (!(err && err.str錯誤代碼 === 'SESSION_EXPIRED')) obj狀態.obj失敗[str格鍵] = 取得錯誤訊息(err);
    } finally {
      delete obj狀態.obj寫入中[str格鍵];
      if (!obj狀態.bool已停止) { 重算人數(); 畫(); }
    }
    return bool成功;
  }

  /**
   * 「取消」欄的按鈕（v1.2.0）：
   *   還原＝確認一次後逐筆寫入「取消報到」（不同時送，避免同時執行太多 Apps Script；失敗的格子變紅，可再點一次重試）
   *   請假／恢復＝確認（請假可填原因）後一次送出 event.取消參加，再重新讀取表格
   * 參數：str種類 {string} '還原'｜'請假'｜'恢復'
   */
  async function 批次取消(str種類) {
    const arr鍵 = 取消選清單(str種類);
    if (arr鍵.length === 0 || obj狀態.bool批次中) return;
    const int時段 = obj狀態.int篩選時段;
    const str時段 = fn時段數() > 1 ? `「${obj狀態.obj資料.arr時段[int時段].str名稱}」` : '';
    const arr名 = arr鍵.map(function (k) { return (fn找列(k) || {}).str姓名 || '（待補姓名）'; });
    const str名單 = arr名.slice(0, 10).join('、') + (arr名.length > 10 ? ` 等 ${arr名.length} 人` : '');
    let str原因 = '';
    if (str種類 === '還原') {
      if (!window.confirm(`把 ${arr鍵.length} 人${str時段}還原成未報到？\n${str名單}`)) return;
    } else if (str種類 === '請假') {
      const any = window.prompt(`${arr鍵.length} 人取消參加這個場次（請假）：\n${str名單}\n\n原因（可空白，例如：生病、出國）：`, '');
      if (any === null) return;
      str原因 = String(any).trim();
    } else if (!window.confirm(`${arr鍵.length} 人恢復參加？\n${str名單}`)) {
      return;
    }

    obj狀態.bool批次中 = true;
    畫();
    let str訊息 = '';
    let bool成功 = true;
    try {
      if (str種類 === '還原') {
        let int失敗 = 0;
        for (let i = 0; i < arr鍵.length; i++) {
          if (obj狀態.bool已停止) break;
          delete obj狀態.obj取消選[arr鍵[i]];
          if (!(await 寫入格(arr鍵[i], int時段, true))) int失敗++;
        }
        bool成功 = int失敗 === 0;
        str訊息 = bool成功 ? `已把 ${arr鍵.length} 人還原成未報到` : `有 ${int失敗} 人還原失敗（紅色格子），請再點一次重試`;
      } else {
        const obj結果 = await 呼叫('event.取消參加', {
          str場次: obj狀態.obj資料.str場次, arr人員鍵: arr鍵, bool恢復: str種類 === '恢復', str原因: str原因, str裝置: str裝置
        });
        // 送出後清掉勾選；請假的人不再保留在未報到清單（改列在最下方「取消參加」區）
        arr鍵.forEach(function (k) { delete obj狀態.obj取消選[k]; delete obj狀態.obj保留[k]; });
        str訊息 = obj結果.str訊息;
        bool成功 = obj結果.arr略過.length === 0;
        obj狀態.obj資料 = await 呼叫('event.讀取報到表格', { str場次: obj狀態.obj資料.str場次 });
        obj狀態.str更新時間 = fn現在時分();
      }
    } catch (err) {
      bool成功 = false;
      str訊息 = 取得錯誤訊息(err);
    } finally {
      obj狀態.bool批次中 = false;
      if (!obj狀態.bool已停止) 畫();
    }
    if (typeof obj設定.fn通知 === 'function') obj設定.fn通知(str訊息, bool成功);
    else if (!bool成功) window.alert(str訊息);
  }

  /**
   * 捲到某一列並閃一下
   */
  function 跳到列(str鍵) {
    obj狀態.str搜尋 = '';
    if (obj狀態.bool篩選標籤) obj狀態.str篩選 = '全部';
    畫();
    const el列 = Array.prototype.filter.call(el容器.querySelectorAll('tr[data-鍵]'), function (el) { return el.dataset.鍵 === str鍵; })[0];
    if (!el列) return;
    el列.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el列.classList.remove('閃爍');
    void el列.offsetWidth;
    el列.classList.add('閃爍');
  }

  // ==========================================================================
  // 新增未報名者
  // ==========================================================================

  async function 找人(el按鈕) {
    const el區 = el容器.querySelector('.新增區');
    const str關鍵 = el區.querySelector('[name=關鍵]').value.trim();
    const el結果 = el區.querySelector('.新增結果');
    if (str關鍵 === '') { el結果.innerHTML = '<p class="訊息" role="alert">請輸入姓名或學員編號。</p>'; return; }
    el按鈕.disabled = true;
    el結果.innerHTML = '<p class="載入中">搜尋中…</p>';
    try {
      const obj = await 呼叫('event.查詢報到人員', { str場次: obj狀態.obj資料.str場次, str關鍵字: str關鍵 });
      let str = '';
      if (obj.arr表格.length > 0) {
        str += '<p class="小字" style="margin:0.25rem 0">表格上已經有（直接在那一列打勾）：</p><ul class="候選清單">' + obj.arr表格.map(function (o) {
          return `<li><span>第 ${Number(o.int序號)} 列　${跳脫HTML(o.str姓名 || '（待補姓名）')}<span class="小字">${跳脫HTML(o.str法名)}${o.bool現場 ? '（現場報到）' : ''}</span></span>
            <button type="button" class="按鈕 小" data-報到="跳到" data-鍵="${跳脫HTML(o.str鍵)}">跳到這一列</button></li>`;
        }).join('') + '</ul>';
      }
      if (obj.arr其他.length > 0) {
        str += '<p class="小字" style="margin:0.25rem 0">不在表格上（選擇後直接報到，沿用學員編號）：</p><ul class="候選清單">' + obj.arr其他.map(function (o) {
          return `<li><span>${跳脫HTML(o.str姓名)}<span class="小字">${跳脫HTML(o.str法名)}　${跳脫HTML(o.str學員編號)}（${跳脫HTML(o.str來源)}）</span></span>
            <button type="button" class="按鈕 小" data-報到="新增" data-編號="${跳脫HTML(o.str學員編號)}" data-姓名="${跳脫HTML(o.str姓名)}" data-法名="${跳脫HTML(o.str法名)}">選擇並報到</button></li>`;
        }).join('') + '</ul>';
      }
      if (str === '') str = '<p class="小字">都找不到。請在下方填姓名（法名可空白）後按「報到」，系統會配發臨時編號。</p>';
      el結果.innerHTML = str;
      if (obj.arr表格.length === 0 && obj.arr其他.length === 0 && el區.querySelector('[name=姓名]').value.trim() === '' && !/\d/.test(str關鍵)) {
        el區.querySelector('[name=姓名]').value = str關鍵;
      }
    } catch (err) {
      el結果.innerHTML = `<p class="訊息" role="alert">${跳脫HTML(取得錯誤訊息(err))}</p>`;
    } finally {
      el按鈕.disabled = false;
    }
  }

  async function 新增(el按鈕) {
    const el區 = el容器.querySelector('.新增區');
    const el結果 = el區.querySelector('.新增結果');
    const str姓名 = el按鈕.dataset.姓名 || el區.querySelector('[name=姓名]').value.trim();
    const str法名 = el按鈕.dataset.姓名 ? (el按鈕.dataset.法名 || '') : el區.querySelector('[name=法名]').value.trim();
    const arr時段 = Array.prototype.map.call(el區.querySelectorAll('[name=時段]:checked'), function (el) { return Number(el.value); });
    if (str姓名 === '') { el結果.innerHTML = '<p class="訊息" role="alert">請填姓名，或從搜尋結果選擇。</p>'; el區.querySelector('[name=姓名]').focus(); return; }
    if (arr時段.length === 0 && fn時段數() > 1) { el結果.innerHTML = '<p class="訊息" role="alert">請勾選要報到的時段。</p>'; return; }
    el按鈕.disabled = true;
    try {
      const obj = await 呼叫('event.新增現場報到', {
        str場次: obj狀態.obj資料.str場次, str姓名: str姓名, str法名: str法名, str學員編號: el按鈕.dataset.編號 || '',
        arr時段: fn時段數() > 1 ? arr時段 : [0], str方式: obj狀態.str方式, str裝置: str裝置
      });
      if (obj.bool完成) {
        obj狀態.bool顯示新增 = false;
        obj狀態.obj資料 = await 呼叫('event.讀取報到表格', { str場次: obj狀態.obj資料.str場次 });
        obj狀態.str更新時間 = fn現在時分();
        跳到列(obj.str鍵);
        if (typeof obj設定.fn通知 === 'function') obj設定.fn通知(obj.str訊息, true);
        return;
      }
      if (obj.bool已在表格) {
        el結果.innerHTML = `<p class="訊息" role="status">${跳脫HTML(obj.str訊息)}</p>
          <button type="button" class="按鈕 小" data-報到="跳到" data-鍵="${跳脫HTML(obj.str鍵)}">跳到第 ${Number(obj.int序號)} 列</button>`;
        return;
      }
      if (obj.arr候選) {
        el結果.innerHTML = `<p class="訊息" role="status">${跳脫HTML(obj.str訊息)}</p><ul class="候選清單">${obj.arr候選.map(function (o) {
          return `<li><span>${跳脫HTML(o.str姓名)}<span class="小字">${跳脫HTML(o.str法名)}　${跳脫HTML(o.str學員編號)}</span></span>
            <button type="button" class="按鈕 小" data-報到="新增" data-編號="${跳脫HTML(o.str學員編號)}" data-姓名="${跳脫HTML(o.str姓名)}" data-法名="${跳脫HTML(o.str法名)}">是這位，報到</button></li>`;
        }).join('')}</ul>`;
      }
    } catch (err) {
      el結果.innerHTML = `<p class="訊息" role="alert">${跳脫HTML(取得錯誤訊息(err))}</p>`;
    } finally {
      if (el按鈕.isConnected) el按鈕.disabled = false;
    }
  }

  // ==========================================================================
  // 事件（委派在容器上）
  // ==========================================================================
  el容器.addEventListener('click', function (e) {
    const el = e.target.closest('[data-報到]');
    if (!el || !el容器.contains(el)) return;
    switch (el.dataset.報到) {
      case '勾': 點格(el.dataset.鍵, Number(el.dataset.時段)); break;
      case '重新整理': 載入(); break;
      case '開新增': obj狀態.bool顯示新增 = true; 畫(); el容器.querySelector('.新增區 [name=關鍵]').focus(); break;
      case '關新增': obj狀態.bool顯示新增 = false; 畫(); break;
      case '找人': 找人(el); break;
      case '新增': 新增(el); break;
      case '跳到': 跳到列(el.dataset.鍵); break;
      case '篩選': 設定篩選(el.dataset.值); break;
      case '批次取消': 批次取消(el.dataset.種類); break;
      default: break;
    }
  });
  el容器.addEventListener('input', function (e) {
    if (e.target.dataset.報到 !== '搜尋') return;
    obj狀態.str搜尋 = e.target.value.trim();
    // 只切換列的顯示，不重畫（輸入不中斷）
    el容器.querySelectorAll('tr[data-鍵]').forEach(function (el列) {
      const o = fn找列(el列.dataset.鍵);
      el列.hidden = !!o && !符合搜尋(o);
    });
  });
  el容器.addEventListener('change', function (e) {
    if (e.target.dataset.報到 === '方式') obj狀態.str方式 = e.target.value;
    if (e.target.dataset.報到 === '篩選時段') { obj狀態.int篩選時段 = Number(e.target.value) || 0; 清除選取(); 畫(); }
    // 取消欄勾選（v1.2.0）：只改狀態，再重畫取消列的人數
    if (e.target.dataset.報到 === '取消選') {
      if (e.target.checked) obj狀態.obj取消選[e.target.dataset.鍵] = true; else delete obj狀態.obj取消選[e.target.dataset.鍵];
      畫();
    }
    if (e.target.dataset.報到 === '取消全選') {
      const bool勾 = e.target.checked;
      (obj狀態.obj資料.arr列 || []).forEach(function (o) {
        const str種類 = 取消種類(o);
        if (!符合篩選(o) || str種類 === '' || str種類 === '恢復' || !符合搜尋(o)) return;   // 全選不含「恢復參加」
        if (bool勾) obj狀態.obj取消選[o.str鍵] = true; else delete obj狀態.obj取消選[o.str鍵];
      });
      畫();
    }
  });
  el容器.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.name === '關鍵') { e.preventDefault(); 找人(el容器.querySelector('[data-報到=找人]')); }
  });

  /**
   * 切換篩選（全部／已報到／未報到），不重新讀取
   */
  function 設定篩選(str篩選) {
    const str新 = ['全部', '已報到', '未報到'].indexOf(str篩選) !== -1 ? str篩選 : '全部';
    if (str新 !== obj狀態.str篩選) 清除選取();
    obj狀態.str篩選 = str新;
    if (obj狀態.str篩選 !== '全部') obj狀態.bool顯示新增 = false;
    if (obj狀態.obj資料) 畫();
  }

  return {
    載入: 載入,
    停止: 停止,
    設定目前時段: function (int) {
      // 篩選時段跟著目前時段走（使用者在篩選畫面自己選過時段就不動）
      if (obj狀態.int篩選時段 === obj狀態.int目前時段 && obj狀態.int篩選時段 !== (Number(int) || 0)) { obj狀態.int篩選時段 = Number(int) || 0; 清除選取(); }
      obj狀態.int目前時段 = Number(int) || 0;
      if (obj狀態.obj資料 && obj狀態.str篩選 !== '全部') 畫();
    },
    設定篩選: 設定篩選
  };
}
