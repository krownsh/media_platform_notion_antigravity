function synchronizedStatus(manifest) {
    const result = {
        phase: 'synchronized',
        label: '已落盤',
        reason: '本機 case file 已完成上次確認的寫入。',
        next_action: { type: 'open_local_record', label: '查看本機紀錄' }
    };
    if (manifest.relative_path) result.relative_path = manifest.relative_path;
    if (manifest.last_content_sha256) result.checksum = manifest.last_content_sha256;
    return result;
}

export function describeLocalPostRecord({ sourceRevision, manifest }) {
    if (!sourceRevision) {
        return {
            phase: 'source_unavailable',
            label: '尚未取得可落盤來源',
            reason: '需要先完成貼文來源擷取，才能建立可追溯的本機紀錄。',
            next_action: { type: 'resume_capture', label: '回到擷取流程' }
        };
    }
    if (!manifest) {
        return {
            phase: 'ready_to_create',
            label: '待建立本機紀錄',
            reason: '來源已保存；尚未建立本機 case file。',
            next_action: { type: 'create_local_record', label: '建立本機紀錄' }
        };
    }
    if (manifest.sync_state === 'synchronized') return synchronizedStatus(manifest);
    if (manifest.sync_state === 'failed') {
        return {
            phase: 'failed', label: '本機同步失敗',
            reason: manifest.last_error || '上次本機寫入未完成。',
            next_action: { type: 'retry_local_record', label: '重試同步' }
        };
    }
    if (manifest.sync_state === 'conflict') {
        return {
            phase: 'conflict', label: '本機變更待處理',
            reason: '偵測到系統管理區塊與本機內容不一致，尚未覆寫。',
            next_action: { type: 'review_local_conflict', label: '檢視衝突' }
        };
    }
    if (manifest.sync_state === 'local_change_pending') {
        return {
            phase: 'local_change_pending', label: '本機修改待確認',
            reason: '你的自由筆記有尚未接受的同步候選。',
            next_action: { type: 'review_local_change', label: '檢視本機修改' }
        };
    }
    return {
        phase: 'pending', label: '待本機落盤',
        reason: '已建立本機紀錄請求，尚未完成檔案寫入。',
        next_action: { type: 'retry_local_record', label: '重試同步' }
    };
}
