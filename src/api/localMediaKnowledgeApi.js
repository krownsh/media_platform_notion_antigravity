import { API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedFetch';

export async function getLocalPostRecord(postId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/local-records/posts/${encodeURIComponent(postId)}`);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || '無法讀取本機紀錄狀態');
    }
    const payload = await response.json();
    return payload.local_record;
}

export async function syncLocalPostRecord(postId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/local-records/posts/${encodeURIComponent(postId)}/sync`, { method: 'POST' });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || '無法建立本機紀錄');
    }
    return response.json();
}
