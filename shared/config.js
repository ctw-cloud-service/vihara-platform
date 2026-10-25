// ============================================================================
// 檔案名稱：shared/config.js
// 所屬層級：前端／共用設定
// 檔案版本：v1.1.0（2026-10-25）
//   v1.1.0：總管理頁（admin/）完成，改為已上線
//   v1.0.0：初版
// 用途說明：
//   前端唯一需要依環境修改的地方：後端網址、Google 登入用戶端 ID、各模組頁面。
//   這些值本來就會出現在瀏覽器中，不是機密。
//   日後某個模組搬到獨立的 GAS 專案時，只要在 obj模組後端網址 加一行。
// ============================================================================

/* exported obj平台設定 */
const obj平台設定 = Object.freeze({
  // 平台名稱（未指定精舍時，匾額顯示這個名稱）
  str平台名稱: '精舍雲端服務平台',

  // Google 登入用的 OAuth 用戶端 ID
  strOAuth用戶端ID: '902061096910-i5eeploiu9h0jmj3uuddpspr0fo0cop6.apps.googleusercontent.com',

  // 平台核心的 GAS 網頁應用程式網址（所有模組預設都送到這裡）
  str預設後端網址: 'https://script.google.com/macros/s/AKfycby_S6Aj7tWu_Yo6_JvfiZMDyrh3M1chlOtrxmYmjj2J4RpRkLGqiJBSgxiE6A6IttJ2dA/exec',

  // 個別模組改用其他 GAS 時填在這裡，例：{ inventory: 'https://script.google.com/macros/s/…/exec' }
  obj模組後端網址: {},

  // 等候後端回應的上限（毫秒）；GAS 單次最長可執行 6 分鐘，一般操作數秒內完成
  int請求逾時毫秒: 90000,

  // 入口頁的功能清單：模組代號 → 頁面資訊
  //   str路徑：相對於網站根目錄的資料夾；bool已上線：頁面完成前顯示為「建置中」
  obj模組頁面: {
    event: { str路徑: 'event/', str說明: '報名資料整理、大車點名、法會報到', bool已上線: false }
  },

  // 依角色出現在入口頁的管理功能
  obj管理頁面: {
    精舍設定: { str路徑: 'site/', str說明: '人員與權限、共用主檔、學員名冊', bool已上線: false },
    總管理: { str路徑: 'admin/', str說明: '開通精舍、登記精舍管理員', bool已上線: true }
  }
});
