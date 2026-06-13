# Agent Harness

底層框架，用於開發 AI Agent 應用程式。

## 定位

Agent Harness 不是最終產品，而是提供給新專案使用的基礎框架：

- **UMP 記憶層**：Universal Memory Protocol 的完整實作
- **Agent 偵測**：系統級 Agent 自動發現和管理
- **Electron 模組**：可重用的 UI 組件和 IPC 架構

## 技術棧

- Electron 28 + React 18 + TypeScript + Vite
- Tailwind CSS（暗色主題）
- sql.js（SQLite 記憶持久化）

## 快速開始

```bash
npm install
npm run dev      # 開發模式
npm run test     # TypeScript 檢查
npm run build    # 完整打包
```

## 架構

詳見 [ARCHITECTURE.md](./ARCHITECTURE.md)

## 狀態

- [x] UMP 記憶層（sql.js 持久化）
- [x] Agent 偵測（三層偵測）
- [x] 設定系統（i18n + 自動更新框架）
- [ ] 商城功能（Phase 2 - 新專案負責）
- [ ] 線上更新（Phase 2）

## 授權

MIT
