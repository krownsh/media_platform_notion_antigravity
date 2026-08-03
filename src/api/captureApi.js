import { authenticatedFetch } from './authenticatedFetch';
import { API_BASE_URL } from './config';

async function readApiResponse(response, fallbackMessage) {
    let body = null;
    try {
        body = await response.json();
    } catch {
        // A gateway may return a non-JSON error page; keep the user-facing fallback.
    }
    if (!response.ok) throw new Error(body?.error || fallbackMessage);
    return body;
}

export async function submitUrlCapture(url) {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/captures`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-idempotency-key': crypto.randomUUID()
        },
        body: JSON.stringify({ url })
    });
    return readApiResponse(response, '無法建立網址擷取任務');
}

export async function submitImageCapture(file) {
    if (!(file instanceof File)) throw new Error('請選擇圖片檔案');
    const response = await authenticatedFetch(`${API_BASE_URL}/api/captures/images`, {
        method: 'POST',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'x-file-name': encodeURIComponent(file.name || 'uploaded-image'),
            'x-idempotency-key': crypto.randomUUID()
        },
        body: file
    });
    return readApiResponse(response, '圖片上傳失敗');
}

export async function getCaptureStatus(captureId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/captures/${captureId}`);
    const body = await readApiResponse(response, '無法讀取擷取狀態');
    return body.capture;
}
