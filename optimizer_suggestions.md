# Optimizer Suggestions — 待處理問題清單

> 記錄全面審計中發現但尚未修正的問題，待排優先順序處理。

---

## 🟠 高優先（建議盡快處理）

### ~~H1: TypeScript `strict: false`~~ ✅ 已修正
- **修正:** 分三階段啟用：`noImplicitAny` → `strictNullChecks` → `strict: true`，全部 0 errors

### ~~H2: Type duplicates in electron.d.ts~~ ✅ 已修正
- **修正:** MCP 三型別統一到 `shared/types.ts`，`electron.d.ts` 改為 import，`McpPage.tsx` 直接 import `shared/types`

### ~~H5: `asar: false` 矛盾~~ ✅ 已修正
- **修正:** 移除 `main.ts` 中 asar.unpacked fallback dead code

### ~~H6: Vite externals 不完整~~ ✅ 已修正
- **修正:** 新增 `electron-store`, `electron-updater`, `systeminformation`, `chokidar`, `@modelcontextprotocol/sdk`, `pdf-parse`, `node-fetch` 至 externals

---

## 🟡 中等優先

### ~~M1: 主進程同步 I/O~~ ✅ 已修正
- **修正:** `main.ts` 中 `readFileSync` 改為 `fs.promises.readFile`（get-agent-logs, get-agent-docs, get-agent-catalog）

### ~~M2: `shell: true` in spawn~~ ✅ 已修正
- **修正:** 所有 `shell: true` 改為 `shell: false`（agent-manager, hermes, installer-github, ollama, stability）

### ~~M3: IPC 無輸入驗證~~ ✅ 已修正
- **修正:** 新增 `electron/ipc/validate.ts`，使用 Zod 4 為所有 IPC handler 建立 schema 驗證（agent ID、file path、chat message、settings、MCP config、GitHub URL 等）

### ~~M4: 元件過大~~ ✅ 已修正（進行中）
- **修正:** 建立 `src/features/notebook/` feature-first 架構，NotebookPage 從 801 行拆分為 12 個檔案（hooks/services/components），index.tsx 154 行
- **下一步:** v0.1.7 LibraryPage、v0.1.8 CouncilPage、v0.1.9 App.tsx feature-first 整理

### M5: 大量 polling
- **位置:** LibraryPage(15s), LogsTab(5s), AgentPanel(5s)
- **問題:** 獨立 polling 造成大量 IPC 調用
- **建議:** 使用 WebSocket 或合併 polling 邏輯

### ~~M6: console.log 殘留~~ ✅ 已修正
- **修正:** 移除 frontend (NotebookPage, CurrentTimeButton) 及 backend (main.ts, notebook.ts) 中的 debug console.log

### ~~M7: Streaming listener 未 cleanup~~ ✅ 已修正
- **修正:** LibraryPage 加入 `streamingCleanupRef`，component unmount 時自動清理所有 listener

### ~~M8: 記憶體路徑硬編碼~~ ✅ 已修正
- **修正:** `main.ts` default `memoryPath` 改為 `path.join(os.homedir(), 'AgentOS', 'Memory')`

### ~~M9: 報告路徑硬編碼~~ ✅ 已修正（原本即用 homedir()）
- **確認:** `report-generator.ts` 已使用 `homedir()`，無需修正

### ~~M10: 硬編碼預設模型~~ ✅ 已確認（合理預設值）
- **確認:** `installer.ts` 中的模型名稱是偏好模式的合理預設值（speed→llama3.1:8b, memory→qwen2.5:1.5b）；`model-providers.ts` 是模型目錄；無需修正

---

## 🟢 低優先

### ~~L1: Dead code~~ ✅ 已修正
- **修正:** 移除 `CouncilState` 介面、`calculateBordaScores()` 函數

### L2: i18n 不一致
- 多數頁面用硬編碼中文，僅 SettingsPage 用 `useTranslation`
- 建議：統一使用 i18n

### L3: 無 CSS modules
- 所有 .tsx 用 inline style
- 建議：逐步遷移至 CSS modules 或 Tailwind

### L4: 無 a11y
- 無 `aria-*` 屬性，無鍵盤導航
- 建議：加入基本 a11y 支援

### ~~L5: package name 不一致~~ ✅ 已修正
- **修正:** `package.json` name 改為 `agentos`

### ~~L6: `test` 腳本誤導~~ ✅ 已修正
- **修正:** 保留 `test` 腳本（tsc --noEmit），新增 `typecheck` 別名

### ~~L7: 無 lint/format 腳本~~ ✅ 已修正
- **修正:** 安裝 ESLint 9 (flat config) + Prettier，加入 `lint`/`lint:fix`/`format`/`format:check` scripts

### L9: 無 macOS/Linux 支援
- `electron-builder.json` 僅 Windows x64
- 建議：依需求加入其他平台

### ~~L10: Tailwind 重複色值~~ ✅ 已修正
- **修正:** `surface-container-highest` 色值改為 `#344355`

### ~~L11: knip 遺漏~~ ✅ 已修正
- **修正:** `knip.json` project globs 加入 `"shared/**/*.ts"`

### ~~L12: Duplicated detection logic~~ ✅ 已修正
- **修正:** 三層偵測邏輯提取到 `electron/services/agent-detection.ts`，`agent-manager.ts` 和 `system-detector.ts` 改為 import 使用

### ~~L13: `callOllama` 重複~~ ✅ 已過時（不存在）
- **確認:** `LocalFusionRouter.ts` 和 `SelfRefinementLoop.ts` 不存在於 codebase 中，此問題已過時

---

## 建議修正順序

1. ~~Phase 1 (安全): H1 (strict), H6 (externals)~~ ✅ H6 已修正
2. ~~Phase 2 (品質): M1 (async I/O), M6 (console.log), L1 (dead code)~~ ✅ 全部已修正
3. ~~Phase 3 (架構): M4 (元件拆分), M5 (polling), H5 (asar)~~ ✅ H5 已修正
4. ~~Phase 4 (DX): L7 (lint), L6 (test rename), L2 (i18n)~~ ✅ L6 已修正

## 剩餘待處理

| 項目 | 優先級 | 說明 |
|------|--------|------|
| M4 | 中 | ~~NotebookPage done~~ → LibraryPage (v0.1.7), CouncilPage (v0.1.8) |
| M5 | 中 | polling → WebSocket（架構變更） |
| L2 | 低 | i18n 統一 |
| L3 | 低 | CSS modules |
| L4 | 低 | a11y |
| L9 | 低 | macOS/Linux 支援 |
