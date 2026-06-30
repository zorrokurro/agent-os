# Optimizer Suggestions — 待處理問題清單

> 記錄全面審計中發現但尚未修正的問題，待排優先順序處理。

---

## 🟠 高優先（建議盡快處理）

### H1: TypeScript `strict: false`
- **位置:** `tsconfig.json:6`
- **問題:** 關閉所有嚴格檢查（noImplicitAny, strictNullChecks 等），隱藏大量 bug
- **影響:** 開啟後可能有數十個型別錯誤需修正
- **建議:** 分階段開啟，先開 `strictNullChecks`，再開 `noImplicitAny`

### H2: Type duplicates in electron.d.ts
- **位置:** `src/types/electron.d.ts` — `McpServerConfig`, `McpToolInfo`, `McpServerStatus`
- **問題:** 與 `electron/services/mcp/client.ts` 重複定義
- **建議:** 統一到 `shared/types.ts`

### H5: `asar: false` 矛盾
- **位置:** `electron-builder.json` + `electron/main.ts:97-104`
- **問題:** 關閉 asar 但仍有 asar.unpacked fallback 邏輯（dead code）
- **建議:** 要麼啟用 asar + asarUnpack，要麼移除 fallback 邏輯

### H6: Vite externals 不完整
- **位置:** `vite.config.ts:21`
- **問題:** `electron-store`, `electron-updater`, `systeminformation`, `chokidar`, `@modelcontextprotocol/sdk` 未 externalize
- **影響:** Vite 可能嘗試 bundle native modules，導致 build 失敗或 runtime 錯誤
- **建議:** 將所有 native/electron 模組加入 externals

---

## 🟡 中等優先

### M1: 主進程同步 I/O
- **位置:** `main.ts:330,346,654` — `readFileSync`
- **問題:** 阻塞主進程，影響 UI 響應
- **建議:** 改用 `fs.promises.readFile` 或 `readFile` (callback)

### M2: `shell: true` in spawn
- **位置:** agent-manager.ts, hermes.ts, ollama.ts, stability.ts, installer-github.ts
- **問題:** 潛在 shell injection 風險
- **建議:** 改用 `shell: false` + 陣列參數

### M3: IPC 無輸入驗證
- **位置:** `main.ts` 多數 IPC handler
- **問題:** 接受任意參數，無型別/範圍驗證
- **建議:** 加入 zod 或手動驗證

### M4: 元件過大
- **位置:** NotebookPage(804), LibraryPage(564), InstallPage(539), CouncilPage(631)
- **問題:** 單一元件超過 500 行，難以維護
- **建議:** 拆分為子元件

### M5: 大量 polling
- **位置:** LibraryPage(15s), LogsTab(5s), AgentPanel(5s)
- **問題:** 獨立 polling 造成大量 IPC 調用
- **建議:** 使用 WebSocket 或合併 polling 邏輯

### M6: console.log 殘留
- **位置:** LocalFusionRouter, NotebookPage, CurrentTimeButton, hermes-controller
- **問題:** Debug 代碼留在 production
- **建議:** 移除或替換為 logger

### M7: Streaming listener 未 cleanup
- **位置:** LibraryPage ControlsTab
- **問題:** 組件卸載後 onChatToken/onChatDone/onChatError 回調仍會觸發
- **建議:** 在 useEffect cleanup 中取消訂閱

### M8: 記憶體路徑硬編碼
- **位置:** `main.ts:81` — `C:\AgentOS\Memory`
- **問題:** Windows 專用，不跨平台
- **建議:** 改用 `app.getPath('home') + '/AgentOS/Memory'`

### M9: 報告路徑硬編碼
- **位置:** `report-generator.ts:426`
- **問題:** `~/AgentOS/Memory/outputs/research/`
- **建議:** 同 M8

### M10: 硬編碼預設模型
- **位置:** 多個檔案 — `qwen2.5:14b`, `deepseek-r1:14b`, `llama3.1:8b`
- **問題:** 模型名稱寫死，無法配置
- **建議:** 從設定或 Provider 動態取得

---

## 🟢 低優先

### L1: Dead code
- `src/types/council.ts` — `CouncilState` 介面、`calculateBordaScores()` 函數從未使用
- 建議：移除

### L2: i18n 不一致
- 多數頁面用硬編碼中文，僅 SettingsPage 用 `useTranslation`
- 建議：統一使用 i18n

### L3: 無 CSS modules
- 所有 .tsx 用 inline style
- 建議：逐步遷移至 CSS modules 或 Tailwind

### L4: 無 a11y
- 無 `aria-*` 屬性，無鍵盤導航
- 建議：加入基本 a11y 支援

### L5: package name 不一致
- `package.json` name: `agent-harness` ≠ 產品名 `AgentOS`
- 建議：統一

### L6: `test` 腳本誤導
- `npm test` 只是 `tsc --noEmit`，不是真正測試
- 建議：改名為 `typecheck`，或加入真正測試

### L7: 無 lint/format 腳本
- 缺少 ESLint、Prettier 設定
- 建議：加入 lint 腳本

### L9: 無 macOS/Linux 支援
- `electron-builder.json` 僅 Windows x64
- 建議：依需求加入其他平台

### L10: Tailwind 重複色值
- `tailwind.config.js:19` — `surface-container-high` = `surface-container-highest`
- 建議：修正色值

### L11: knip 遺漏
- `knip.json` — `shared/` 未在 project globs 中
- 建議：加入 `"shared/**/*.ts"`

### L12: Duplicated detection logic
- `agent-manager.ts` vs `system-detector.ts` — 三層偵測邏輯重複
- 建議：提取共用函數

### L13: `callOllama` 重複
- `LocalFusionRouter.ts` + `SelfRefinementLoop.ts` — 相同函數
- 建議：提取到共用模組

---

## 建議修正順序

1. **Phase 1 (安全):** H1 (strict), H6 (externals)
2. **Phase 2 (品質):** M1 (async I/O), M6 (console.log), L1 (dead code)
3. **Phase 3 (架構):** M4 (元件拆分), M5 (polling), H5 (asar)
4. **Phase 4 (DX):** L7 (lint), L6 (test rename), L2 (i18n)
