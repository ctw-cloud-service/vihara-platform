// ============================================================================
// 檔案名稱：core/shared/config.js
// 所屬層級：前端／共用設定
// 檔案版本：v1.3.0（2026-10-26）
//   v1.3.0：精舍設定頁（core/site/）完成，改為已上線；新增 str系統帳號（登記外部檔案時提示共享對象）
//   v1.2.0：總管理頁（core/admin/）完成，改為已上線
//   v1.1.0：repo 改為每模組一個頂層資料夾；頁面路徑改為「相對於網站根目錄」，
//           網站根目錄由本檔位置自動推算（本機測試與 GitHub Pages 都適用）
//   v1.0.0：初版
// 用途說明：
//   前端唯一需要依環境修改的地方：後端網址、Google 登入用戶端 ID、各模組頁面。
//   這些值本來就會出現在瀏覽器中，不是機密。
//   日後某個模組搬到獨立的 GAS 專案時，只要在 obj模組後端網址 加一行。
//
//   repo 結構：每個模組一個頂層資料夾
//     core/   平台核心（入口頁、共用程式、總管理、精舍設定、核心 GAS）
//     event/  法會活動模組
//     …       日後新增的模組
// ============================================================================

/* exported obj平台設定, 取得頁面網址 */

// 網站根目錄：本檔位於「根目錄/core/shared/config.js」，往上兩層即是根目錄
const str網站根目錄_ = new URL('../../', document.currentScript.src).href;

const obj平台設定 = Object.freeze({
  // 平台名稱（未指定精舍時，匾額顯示這個名稱）
  str平台名稱: '精舍雲端服務平台',

  // 系統帳號：精舍自有的檔案（學員名冊、大車點名試算表）要共享給這個帳號
  str系統帳號: 'ctw.cloud.service@gmail.com',

  // Google 登入用的 OAuth 用戶端 ID
  strOAuth用戶端ID: '902061096910-i5eeploiu9h0jmj3uuddpspr0fo0cop6.apps.googleusercontent.com',

  // 平台核心的 GAS 網頁應用程式網址（所有模組預設都送到這裡）
  str預設後端網址: 'https://script.google.com/macros/s/AKfycby_S6Aj7tWu_Yo6_JvfiZMDyrh3M1chlOtrxmYmjj2J4RpRkLGqiJBSgxiE6A6IttJ2dA/exec',

  // 個別模組改用其他 GAS 時填在這裡，例：{ inventory: 'https://script.google.com/macros/s/…/exec' }
  obj模組後端網址: {},

  // 等候後端回應的上限（毫秒）；GAS 單次最長可執行 6 分鐘，一般操作數秒內完成
  int請求逾時毫秒: 90000,

  // 入口頁的功能清單：模組代號 → 頁面資訊
  //   str路徑：相對於網站根目錄（模組就是頂層資料夾）；bool已上線：完成前顯示「建置中」
  obj模組頁面: {
    event: { str路徑: 'event/', str說明: '報名資料整理、大車點名、法會報到', bool已上線: false }
  },

  // 依角色出現在入口頁的管理功能（屬於平台核心，放在 core/ 底下）
  obj管理頁面: {
    精舍設定: { str路徑: 'core/site/', str說明: '功能開通、人員與權限、學員名冊、共用主檔', bool已上線: true },
    總管理: { str路徑: 'core/admin/', str說明: '開通精舍、登記精舍管理員', bool已上線: true }
  }
});


/**
 * ============================================================================
 * 函式名稱：取得頁面網址
 * 版本：v1.0.0（2026-10-25）
 * ----------------------------------------------------------------------------
 * 用途：把「相對於網站根目錄」的路徑轉成完整網址，並帶上精舍代號。
 * 參數：
 *   str路徑         {string} 例如 'event/'、'core/site/'
 *   str精舍代號     {string} 選填；有值時加上 ?site=代號
 * 傳回：{string} 完整網址
 * 範例：取得頁面網址('event/', 'TC') → https://ctw-cloud-service.github.io/vihara-platform/event/?site=TC
 * ============================================================================
 */
function 取得頁面網址(str路徑, str精舍代號) {
  const obj網址 = new URL(str路徑, str網站根目錄_);
  if (str精舍代號) obj網址.searchParams.set('site', str精舍代號);
  return obj網址.href;
}
