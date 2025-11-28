const getApiBaseUrl = () => {
    let url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
};

export const API_BASE_URL = getApiBaseUrl();
