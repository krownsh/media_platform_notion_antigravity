# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## 快速開始 (Quick Start)

### 1. 安裝依賴
```bash
npm install
```

### 2. 設定環境變數
複製 `.env.example` 為 `.env` 並填入 Supabase 資訊。

### 3. 啟動服務
開啟兩個 Terminal 視窗：

**Terminal 1 (Backend):**
```bash
node server/index.js
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

## 專案目錄結構

```text
src/
├── api/                # Supabase client
├── components/         # UI Components (PostCard, RemixPanel, UrlInput...)
├── features/           # Redux Slices (postsSlice)
├── services/           # 核心服務
│   ├── aiService.js            # AI 分析與改寫 (Mock)
│   ├── socialApiService.js     # API 串接
│   ├── crawlerService/         # Puppeteer 爬蟲
│   └── orchestrator.js         # 調度中心
├── store/              # Redux Store
└── server/             # Backend Entry Point
```

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
