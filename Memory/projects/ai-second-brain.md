# AI Second Brain 知識庫系統 - 客製化記憶

> 來源：Matt Wolfe - Build An AI Second Brain Knowledge Base (Step-By-Step)
> 影片：https://www.youtube.com/watch?v=yke4fLQUsh4
> 長度：33:56 | 觀看次數：82K+
> 日期：2026-05-27

---

## 系統概述

這個系統的核心概念是建立一個「AI 第二大腦」——一個可以自動整理、連結、查詢個人知識庫的 AI 系統。

**核心理念：**
- 將所有資訊（筆記、文章、對話、CRM）存入 Obsidian vault
- 用 AI Agent（OpenClaw/Codex）自動整理和連結資訊
- 透過 LLM Wiki 概念讓 AI 可以查詢所有個人知識
- 自動備份到 GitHub

---

## 系統架構

### 1. 知識收集層
- **Obsidian**：主要知識管理工具
- **Obsidian Web Clipper**：自動擷取網頁內容
- **Codex App**：AI 輔助寫作和整理

### 2. AI Agent 層
- **OpenClaw**：開源 AI Agent 框架（部署在 Hostinger）
- **Codex**：OpenAI 的 AI 程式碼助手
- Agent 會自動：
  - 整理新加入的筆記
  - 建立筆記之間的連結
  - 更新 CRM 和日誌
  - 建立 Wiki 頁面

### 3. 儲存與備份層
- **Obsidian Vault**：本地 Markdown 檔案
- **GitHub**：自動備份所有變更

---

## 關鍵概念：Karpathy LLM Wiki

來源：Andrej Karpathy 的推文和 GitHub Gist

**核心想法：**
- 將所有知識轉成 Markdown 格式
- 建立一個「Wiki」結構，讓 LLM 可以查詢
- 每個主題一個檔案，互相連結
- AI 可以自動更新和維護這個 Wiki

**實作方式：**
1. 建立 `knowledge/` 目錄
2. 每個主題一個 `.md` 檔案
3. 檔案間用 `[[連結]]` 互相連接
4. 用向量搜尋（Embedding）讓 AI 可以找到相關內容
5. Agent 自動維護和更新

---

## 工具清單

| 工具 | 用途 | 連結 |
|------|------|------|
| Obsidian | 知識管理 | https://obsidian.md/ |
| Obsidian Web Clipper | 網頁擷取 | https://obsidian.md/clipper |
| Codex | AI 寫作 | https://chatgpt.com/codex/ |
| OpenClaw | AI Agent 框架 | 部署在 Hostinger |
| GitHub | 備份 | 自動同步 |

---

## 建置步驟（依影片時間軸）

### Phase 1：系統規劃（0:00 - 6:14）
1. 定義知識庫的結構
2. 決定哪些資訊要納入
3. 規劃 Agent 的角色和任務

### Phase 2：部署 OpenClaw（6:14 - 8:03）
1. 在 Hostinger 上部署 OpenClaw
2. 設定 Agent 的基本配置
3. 連接到 Obsidian vault

### Phase 3：建立 LLM Wiki（8:03 - 9:41）
1. 建立知識庫目錄結構
2. 設定 Markdown 模板
3. 建立索引檔案

### Phase 4：實際建置（9:41 - 18:19）
1. 建立 Obsidian vault
2. 設定 Web Clipper
3. 建立筆記模板
4. 設定 Agent 自動整理規則

### Phase 5：查詢系統（18:19 - 21:25）
1. 建立搜尋介面
2. 設定向量搜尋
3. 測試查詢功能

### Phase 6：自動化（21:25 - 30:30）
1. Agent 自動更新 Wiki
2. 自動建立筆記連結
3. CRM 和日誌自動化
4. 自動備份到 GitHub

### Phase 7：備份（30:30 - 31:41）
1. 設定 GitHub 自動同步
2. 測試備份和還原

---

## 客製化建議（針對 AgentOS）

### 1. 記憶層整合
AgentOS 已經有記憶層系統（`C:\AgentOS\Memory\`），可以直接對應：
- `user_profile.md` → 使用者基本資料
- `projects/` → 專案知識庫
- `conversations/` → 對話摘要
- `outputs/` → 產出歸檔

### 2. 加入 Web Clipper 功能
在 AgentOS 中加入：
- 網頁擷取工具
- 自動分類存入記憶層
- AI 自動摘要和標籤

### 3. 加入 CRM 功能
- 聯絡人管理
- 互動記錄
- 提醒和跟進

### 4. 加入日誌系統
- 每日記錄
- AI 自動整理
- 週報/月報自動生成

### 5. 自動備份
- 將記憶層備份到 GitHub
- 版本控制
- 跨裝置同步

---

## 參考資源

- Karpathy Tweet: https://x.com/karpathy/status/2039805659525644595
- Karpathy GitHub Gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Obsidian: https://obsidian.md/
- Obsidian Web Clipper: https://obsidian.md/clipper
- Codex App: https://chatgpt.com/codex/
- FutureTools: https://futuretools.io/
