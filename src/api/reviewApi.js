import { API_BASE_URL } from './config';
import { authenticatedFetch } from './authenticatedFetch';

async function responseJson(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Review request failed');
    return body;
}

export async function listReviewPackets() {
    return (await responseJson(await authenticatedFetch(`${API_BASE_URL}/api/review/packets`))).packets || [];
}

export async function deferReviewPacket(packetId, expectedVersion, reason = null) {
    return (await responseJson(await authenticatedFetch(`${API_BASE_URL}/api/review/packets/${packetId}/defer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expected_version: expectedVersion, reason })
    }))).packet;
}

export async function resumeReviewPacket(packetId, expectedVersion) {
    return (await responseJson(await authenticatedFetch(`${API_BASE_URL}/api/review/packets/${packetId}/resume`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expected_version: expectedVersion })
    }))).packet;
}

export async function decideReviewProposal(packetId, proposalId, action, expectedVersion, editedPayload = null) {
    const endpoint = action === 'reject' ? 'reject' : action === 'edit_and_accept' ? 'edit-and-accept' : 'accept';
    return (await responseJson(await authenticatedFetch(
        `${API_BASE_URL}/api/review/packets/${packetId}/proposals/${proposalId}/${endpoint}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ expected_version: expectedVersion, ...(editedPayload ? { edited_payload: editedPayload } : {}) })
        }
    ))).packet;
}
