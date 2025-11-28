const getApiBaseUrl = () => {
    // 1. 如果有設定 VITE_API_BASE_URL (例如 .env.development)，則優先使用
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
        console.log('[Config] Using configured API Base URL:', envUrl);
        return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    }

    // 2. 預設回傳空字串，這會使用相對路徑 (例如 /api/...)
    // - 在開發環境 (npm run dev)：會透過 vite.config.js 的 proxy 轉發到後端 (預設 localhost:3001)
    // - 在生產環境 (build)：會直接請求同網域下的 /api，通常由 Nginx 或後端伺服器處理
    return "";
};

export const API_BASE_URL = getApiBaseUrl();
