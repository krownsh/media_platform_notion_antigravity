# API 路由邏輯與流程圖

本文件說明前端如何在不同環境（開發與生產）連接後端，以及如何透過 `.env` 變數進行設定。

## 🔄 流程圖 (Flowchart)

```mermaid
flowchart TD
    Start([前端 API 請求]) --> CheckEnv{是否有設定 VITE_API_BASE_URL?}
    
    %% 路徑 1: 直接連線 (強制指定網址)
    CheckEnv -- 是 --> Direct[使用 VITE_API_BASE_URL]
    Direct --> RequestDirect[請求: $VITE_API_BASE_URL/api/...]
    RequestDirect --> Backend((後端伺服器))
    
    %% 路徑 2: 相對路徑 (透過 Proxy 或 Nginx)
    CheckEnv -- 否 (預設) --> Relative[使用相對路徑 ""]
    Relative --> RequestRelative[請求: /api/...]
    
    RequestRelative --> EnvCheck{當前環境?}
    
    %% 開發環境
    EnvCheck -- 開發環境 (npm run dev) --> ViteProxy[Vite 開發伺服器代理]
    ViteProxy --> CheckProxyTarget{是否有設定 VITE_API_TARGET?}
    
    CheckProxyTarget -- 是 --> ProxyCustom[代理至 VITE_API_TARGET]
    ProxyCustom --> RemoteBackend((遠端後端))
    
    CheckProxyTarget -- 否 (預設) --> ProxyLocal[代理至 localhost:3001]
    ProxyLocal --> LocalBackend((本地後端))
    
    %% 生產環境
    EnvCheck -- 生產環境 (Build/Nginx) --> Nginx[Nginx / 網頁伺服器]
    Nginx --> ProdBackend((生產環境後端))

    style Start fill:#f9f,stroke:#333,stroke-width:2px
    style Backend fill:#bbf,stroke:#333,stroke-width:2px
    style LocalBackend fill:#bfb,stroke:#333,stroke-width:2px
    style RemoteBackend fill:#fbb,stroke:#333,stroke-width:2px
    style ProdBackend fill:#bfb,stroke:#333,stroke-width:2px
```

## 📝 設定情境說明

### 1. 本地開發 (標準模式)
*   **目標**：前端 (localhost:5173) 連接至 **本地後端** (localhost:3001)。
*   **設定方式** (`.env`)：
    *   `VITE_API_BASE_URL`: (留空 / 不設定)
    *   `VITE_API_TARGET`: (留空 / 不設定)
*   **請求流程**：前端 -> `/api` -> Vite Proxy -> `http://localhost:3001`

### 2. 本地前端 + 遠端後端 (除錯用)
*   **目標**：前端 (localhost:5173) 連接至 **已部署的遠端後端** (例如 krownsh.work)。
*   **設定方式** (`.env` 或 `.env.local`)：
    *   `VITE_API_TARGET=https://mediacrawl.krownsh.work`
*   **請求流程**：前端 -> `/api` -> Vite Proxy -> `https://mediacrawl.krownsh.work`

### 3. 生產環境部署
*   **目標**：已部署的前端連接至 **同網域下的後端**。
*   **設定方式**：
    *   `VITE_API_BASE_URL`: (留空 / 不設定)
*   **請求流程**：前端 -> `/api` -> Nginx/伺服器 -> 後端程序

### 4. 強制直接連線 (不建議，易有 CORS 問題)
*   **目標**：完全繞過 Proxy，直接請求特定網址 (瀏覽器直接發送請求)。
*   **設定方式**：
    *   `VITE_API_BASE_URL=http://localhost:3001`
*   **請求流程**：前端 -> `http://localhost:3001/api` (瀏覽器直接處理)
