import { API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedFetch';

export async function searchLibrary({
    query = '',
    limit = 30,
    platform = '',
    collectionId = '',
    stage = '',
    status = ''
} = {}) {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (platform) params.set('platform', platform);
    if (collectionId) params.set('collectionId', collectionId);
    if (stage) params.set('stage', stage);
    if (status) params.set('status', status);
    params.set('limit', String(limit));
    const response = await authenticatedFetch(`${API_BASE_URL}/api/search?${params.toString()}`);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || '搜尋收藏庫失敗');
    }
    return response.json();
}
