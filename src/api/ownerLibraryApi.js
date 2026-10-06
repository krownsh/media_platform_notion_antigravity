import { API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedFetch';

export async function getOwnerLibraryPost(postId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/owner-library/posts/${encodeURIComponent(postId)}`);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || '無法載入來源詳情');
    }
    return response.json();
}
