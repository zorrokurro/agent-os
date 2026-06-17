# 貢獻指南

感謝你對 AgentOS 有興趣。這份文件說明怎麼參與這個專案。

## 開始之前

AgentOS 是一個還在快速迭代的個人專案，架構可能會有較大調整。建議在開始大改動前先開一個 Issue 討論方向，避免做完之後方向不合而浪費時間。

## 開發環境設置

```bash
git clone https://github.com/zorrokurro/agent-os.git
cd agent-os
npm install
npm run dev
```

需要先安裝並啟動 [Ollama](https://ollama.com)，AgentOS 的本地推理功能依賴它。

## 專案結構

```
electron/           Electron main process
├── main.ts          所有 IPC handler
├── preload.ts        renderer 對外的安全橋接
└── services/         核心服務（ollama, aiRouter, ump/, installer-github 等）

src/
├── components/       各頁面元件（LibraryPage, NotebookPage, InstallPage 等）
├── components/brain/ Fusion-Loop 大腦 UI
├── agents/fusion/     Fusion + Self-Refinement Loop 核心邏輯
├── hooks/             共用 hook（useModelConfig 等）
└── core/              BrainService 等前端服務層
```

## 提交 PR 前

```bash
npx tsc --noEmit          # 確認 type-check 通過
npx knip                  # 確認沒有新增 dead code
npm run build              # 確認能正常打包
```

## 程式碼風格

- TypeScript strict mode，避免使用 `any`
- 新的 IPC channel 要同時更新三個地方：`electron/main.ts`（handler）、`electron/preload.ts`（wrapper）、`src/types/electron.d.ts`（型別）
- UI 顏色使用 CSS variables（`var(--color-background-primary)` 等），避免 hardcode hex，除非是品牌色（如 `#7F77DD`）
- 不引入新的 UI 套件，現有的 Tabler icons 已經足夠

## 哪些貢獻最有幫助

- **Agent manifest 範例**：如果你把自己的 Agent 包裝成符合 `docs/agent-manifest-schema.json` 的格式並能被 AgentOS 正確匯入，歡迎開 PR 把它加進文件當範例
- **跨平台支援**：目前只支援 Windows，如果你願意處理 macOS / Linux 的相容性問題非常歡迎
- **Bug 回報**：請附上你的 Ollama 版本、AgentOS 版本、重現步驟
- **文件改善**：README、CONTRIBUTING、程式碼註解的修正都歡迎

## 回報 Bug

請在 Issue 裡包含：
- AgentOS 版本（設定頁面可查）
- 作業系統版本
- 是否使用本地模型或雲端 API，用的是哪個模型
- 重現步驟
- 如果方便，附上 `electron/main.ts` console 的錯誤訊息

## 行為準則

保持基本的尊重，討論技術問題對事不對人。
