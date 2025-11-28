const getApiBaseUrl = () => {
    // 強制使用相對路徑以透過 Proxy 轉發
    return "";

    /*
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    console.log('[Config] VITE_API_BASE_URL:', envUrl);
    let url = envUrl || 'http://localhost:3001';
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
    */
};

export const API_BASE_URL = getApiBaseUrl();
