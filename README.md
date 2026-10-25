# 精舍雲端服務平台（vihara-platform）

多個精舍共用的雲端服務平台。前端放在 GitHub Pages，後端是一個 Google Apps Script 網頁應用程式，資料存在系統帳號 ctw.cloud.service 的 Google 試算表。各精舍的資料彼此獨立，程式全平台共用，更新一次所有精舍同步生效。

## 資料夾結構

每個模組一個頂層資料夾，網頁與 GAS 程式放在一起：

```
vihara-platform/
├─ index.html         轉址到 core/（保留 ?site=精舍代號）
├─ appsscript.json    GAS 專案設定
├─ .clasp.json        clasp 設定（填入指令碼 ID 後可用指令推送 GAS）
├─ .claspignore       只推送 appsscript.json 與各模組 gas/ 內的程式
├─ core/              平台核心
│   ├─ index.html     入口頁：Google 登入、身分、可進入的功能
│   ├─ shared/        全站共用：config.js、api.js、auth.js、base.css
│   ├─ admin/         總管理頁（系統管理員）
│   ├─ site/          精舍設定頁（精舍管理員）
│   └─ gas/           核心_*.gs、測試_*.gs
└─ event/             法會活動模組
    ├─ index.html …   模組頁面
    └─ gas/           法會_*.gs
```

新增模組時，建立一個新的頂層資料夾（資料夾名稱＝模組代號），模組頁面以 `../core/shared/` 引用共用程式，並在 `core/shared/config.js` 的 `obj模組頁面` 加入一行。

## 網址

| 用途 | 網址 |
|---|---|
| 精舍人員入口 | `https://ctw-cloud-service.github.io/vihara-platform/?site=精舍代號` |
| 系統管理員入口 | `https://ctw-cloud-service.github.io/vihara-platform/` |

## 後端（GAS）

所有模組共用同一個 Apps Script 專案與部署網址。
更新程式後：部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署（網址不變）。
