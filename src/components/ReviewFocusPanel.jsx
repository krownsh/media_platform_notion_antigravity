import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, ChevronRight, Clock3, Edit3, MessageSquareText, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { decideReviewProposal, deferReviewPacket, fetchReviewPackets, resumeReviewPacket } from '../features/reviewSlice';

const actionCopy = {
    repair_source: ['修復來源', '這筆來源是部分擷取；先確認缺少什麼，再決定是否以現有材料繼續。'],
    review_proposal: ['確認一個候選', '這項決定會影響正式整理；接受前可以保留、修改或拒絕。'],
    resume_deferred: ['回到暫緩工作', '你先前選擇稍後再處理；恢復後會回到同一個下一步。'],
    awaiting_proposals: ['等待下一個候選', '目前沒有待決定的候選；來源會保留在收件匣，不會被自動歸檔。'],
    packet_complete: ['本輪已完成', '所有目前候選都有明確結果；之後仍可從資料庫安全地新增新候選。']
};

function readablePayload(proposal) {
    if (!proposal?.payload) return '沒有候選內容。';
    const payload = proposal.payload;
    if (proposal.proposal_type === 'folder_assignment') return payload.suggested_name || '保持在收件匣';
    if (proposal.proposal_type === 'post_learning_note') return payload.note_status === 'not_needed' ? '這篇不需要另寫學習筆記' : payload.content || '需要你的學習筆記或明確跳過決定';
    if (proposal.proposal_type === 'topic_assignment') return [payload.primary_topic, ...(payload.related_topics || [])].filter(Boolean).join(' · ') || '尚無明確 Topic；可自行補上或保留空白';
    return JSON.stringify(payload);
}

export default function ReviewFocusPanel() {
    const dispatch = useDispatch();
    const { packets, loading, actionPending, error } = useSelector(state => state.review);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    useEffect(() => { dispatch(fetchReviewPackets()); }, [dispatch]);
    const packet = packets[0] || null;
    const next = packet?.next_action || { kind: 'awaiting_proposals' };
    const proposal = useMemo(() => packet?.proposals?.find(item => item.id === next.proposal_id) || null, [packet, next.proposal_id]);
    const noteNeedsDiscussion = proposal?.proposal_type === 'post_learning_note' && proposal?.payload?.note_status === 'needs_discussion';
    const [stage, why] = actionCopy[next.kind] || actionCopy.awaiting_proposals;
    const startEdit = () => { setDraft(JSON.stringify(proposal?.payload || {}, null, 2)); setEditing(true); };
    const accept = (decision, editedPayload = null) => {
        if (!packet || !proposal) return;
        dispatch(decideReviewProposal({ packetId: packet.id, proposalId: proposal.id, decision, expectedVersion: packet.version, editedPayload }));
        setEditing(false);
    };

    return (
        <section className="flow-panel p-5 sm:p-6" aria-label="Focus Mode review">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="flow-kicker mb-2">Focus Mode</p>
                    <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">目前階段：{stage}</h2>
                </div>
                {packet && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"><ShieldCheck size={14} /> 版本 {packet.version}</span>}
            </div>
            {packet?.source_revision_id && <p className="mt-3 text-xs text-[var(--muted-foreground)]">來源依據：版本 {packet.source_revision_id}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">為什麼現在要處理</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{why}</p>
                </div>
                <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">下一步</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{proposal ? readablePayload(proposal) : '目前沒有需要你記住的隱藏步驟。'}</p>
                </div>
            </div>
            {editing && <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">編輯後接受<textarea value={draft} onChange={event => setDraft(event.target.value)} className="mt-2 min-h-32 w-full rounded-[var(--radius-control)] border border-[var(--input)] bg-[var(--surface-raised)] p-3 font-mono text-xs text-[var(--foreground)]" /></label>}
            <div className="mt-5 flex flex-wrap gap-2">
                {next.kind === 'review_proposal' && proposal && <>
                    {!noteNeedsDiscussion && <button disabled={actionPending} onClick={() => accept('accept')} className="notion-btn-primary inline-flex items-center gap-2"><Check size={16} /> 接受候選</button>}
                    <button disabled={actionPending} onClick={startEdit} className="notion-btn-secondary inline-flex items-center gap-2"><Edit3 size={16} /> {noteNeedsDiscussion ? '補充筆記後接受' : '編輯後接受'}</button>
                    {editing && <button disabled={actionPending} onClick={() => { try { accept('edit_and_accept', JSON.parse(draft)); } catch { window.alert('請使用有效的 JSON 格式'); } }} className="notion-btn-primary inline-flex items-center gap-2"><ChevronRight size={16} /> 儲存編輯</button>}
                    <button disabled={actionPending} onClick={() => accept('reject')} className="notion-btn-secondary inline-flex items-center gap-2"><X size={16} /> 不採用</button>
                </>}
                {next.kind === 'resume_deferred' && packet && <button disabled={actionPending} onClick={() => dispatch(resumeReviewPacket({ packetId: packet.id, expectedVersion: packet.version }))} className="notion-btn-primary inline-flex items-center gap-2"><RefreshCw size={16} /> 繼續處理</button>}
                {packet && next.kind !== 'packet_complete' && <button disabled={actionPending} onClick={() => dispatch(deferReviewPacket({ packetId: packet.id, expectedVersion: packet.version, reason: 'Owner chose to continue later' }))} className="notion-btn-secondary inline-flex items-center gap-2"><Clock3 size={16} /> 稍後處理</button>}
                {!packet && !loading && <button onClick={() => dispatch(fetchReviewPackets())} className="notion-btn-secondary inline-flex items-center gap-2"><MessageSquareText size={16} /> 重新查看收件匣</button>}
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}
        </section>
    );
}
