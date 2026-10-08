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

async function request(url, options, fallback) {
    const response = await authenticatedFetch(url, options);
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || fallback);
    }
    return response.json();
}

export async function createOwnerLibraryFolder(name) {
    const payload = await request(`${API_BASE_URL}/api/owner-library/folders`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name })
    }, '無法建立資料夾');
    return payload.collection;
}

export async function setOwnerLibraryFolder(postId, collectionId) {
    return request(`${API_BASE_URL}/api/owner-library/posts/${encodeURIComponent(postId)}/folder`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ collection_id: collectionId })
    }, '無法更新資料夾');
}
