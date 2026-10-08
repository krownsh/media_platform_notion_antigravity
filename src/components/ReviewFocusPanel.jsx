import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, ChevronRight, Clock3, Edit3, MessageSquareText, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { decideReviewProposal, deferReviewPacket, fetchReviewPackets, prepareReviewCandidates, resumeReviewPacket } from '../features/reviewSlice';

const actionCopy = {
    repair_source: ['修復來源', '這筆來源是部分擷取；先查看缺少什麼，再選擇重試或明確以現有材料建立候選。'],
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
    if (proposal.proposal_type === 'topic_knowledge_delta') return (payload.topics || []).map(item => item.label).filter(Boolean).join(' · ') || '這則來源不需要新增 Topic 知識';
    if (proposal.proposal_type === 'project_reference') return payload.rationale || '確認這個 Topic 是否可能應用到 Catalog 專案';
    return JSON.stringify(payload);
}

function acceptanceImpact(proposal) {
    if (!proposal) return '不會有隱藏寫入。';
    if (proposal.proposal_type === 'folder_assignment') return '只會更新這篇貼文的正式資料夾；空白表示維持 Inbox。';
    if (proposal.proposal_type === 'post_learning_note') return '只會寫入你確認的貼文學習狀態，不會自動生成內容。';
    if (proposal.proposal_type === 'topic_assignment') return '會保留 Topic 選擇；獨立 Topic 連結會在 production migration 完成後啟用，且不會自動寫知識摘要。';
    if (proposal.proposal_type === 'topic_knowledge_delta') return '會建立或連結獨立 Topic；只有「已記錄」摘要才會新增帶引用的知識 revision。';
    if (proposal.proposal_type === 'project_reference') return '只會記錄 Topic 與 Catalog 專案的參考關係；不會修改 repo 或執行 POC。';
    return '只會保存這個可稽核決定。';
}

function ProposalEditor({ proposal, draft, onChange }) {
    const update = patch => onChange({ ...draft, ...patch });
    if (proposal.proposal_type === 'post_learning_note') {
        const recorded = draft.note_status === 'recorded';
        return <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">這篇貼文的學習筆記</p><p className="mt-1 text-xs leading-5 text-[#615d59]">可明確選擇不需要；空白不會被假裝成完成。</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" checked={!recorded} onChange={() => update({ note_status: 'not_needed', content: null })} />不需要另寫筆記</label><label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" checked={recorded} onChange={() => update({ note_status: 'recorded', content: draft.content || '' })} />記錄我的學習</label>{recorded && <textarea value={draft.content || ''} onChange={event => update({ content: event.target.value })} placeholder="用自己的話記下這篇帶來的學習…" className="notion-input mt-3 min-h-28 w-full" />}</div>;
    }
    if (proposal.proposal_type === 'topic_assignment') {
        return <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">這篇貼文要連到哪些 Topic？</p><p className="mt-1 text-xs leading-5 text-[#615d59]">最多 1 個主要 Topic 和 2 個相關 Topic。只建立可追溯連結，不會自動寫 Topic 知識。</p><label className="mt-3 block text-sm">主要 Topic<input value={draft.primary_topic || ''} onChange={event => update({ primary_topic: event.target.value })} placeholder="例如：UI UX" className="notion-input mt-1 w-full" /></label><label className="mt-3 block text-sm">相關 Topic（以逗號分隔，最多兩個）<input value={(draft.related_topics || []).join(', ')} onChange={event => update({ related_topics: event.target.value.split(',').map(item => item.trim()).filter(Boolean).slice(0, 2) })} placeholder="例如：Accessibility, Design Systems" className="notion-input mt-1 w-full" /></label><p className="mt-3 text-xs text-[#615d59]">若確定這篇不屬於任何 Topic，可保留兩欄空白再儲存。</p></div>;
    }
    if (proposal.proposal_type === 'topic_knowledge_delta') {
        const topic = (draft.topics || [])[0] || {};
        const setTopic = patch => update({ topics: [{ ...topic, ...patch }] });
        const recorded = draft.decision === 'recorded';
        return <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">要把什麼寫進 Topic？</p><p className="mt-1 text-xs leading-5 text-[#615d59]">這是跨來源的 Topic 知識，不是貼文原文。若沒有可累積的內容，選「只保留來源連結」。</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" checked={!recorded} onChange={() => update({ decision: 'not_needed' })} />只保留來源連結，不新增知識摘要</label><label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" checked={recorded} onChange={() => update({ decision: 'recorded' })} />新增一筆知識摘要</label>{recorded && <><label className="mt-3 block text-sm">Topic 名稱<input value={topic.label || ''} onChange={event => setTopic({ label: event.target.value })} className="notion-input mt-1 w-full" /></label><label className="mt-3 block text-sm">摘要<textarea value={topic.summary || ''} onChange={event => setTopic({ summary: event.target.value })} placeholder="可跨貼文成立、可追溯的知識整理…" className="notion-input mt-1 min-h-28 w-full" /></label></>}</div>;
    }
    return <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">編輯候選<textarea value={JSON.stringify(draft, null, 2)} onChange={event => { try { onChange(JSON.parse(event.target.value)); } catch { /* keep last valid value */ } }} className="mt-2 min-h-32 w-full rounded-[var(--radius-control)] border border-[var(--input)] bg-[var(--surface-raised)] p-3 font-mono text-xs text-[var(--foreground)]" /></label>;
}

export default function ReviewFocusPanel() {
    const dispatch = useDispatch();
    const { packets, activePacketId, loading, actionPending, error } = useSelector(state => state.review);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({});
    useEffect(() => { dispatch(fetchReviewPackets()); }, [dispatch]);
    const packet = packets.find(item => item.id === activePacketId) || packets[0] || null;
    const next = packet?.next_action || { kind: 'awaiting_proposals' };
    const proposal = useMemo(() => packet?.proposals?.find(item => item.id === next.proposal_id) || null, [packet, next.proposal_id]);
    const requiresOwnerContent = (proposal?.proposal_type === 'post_learning_note' && proposal?.payload?.note_status === 'needs_discussion')
        || (proposal?.proposal_type === 'topic_knowledge_delta' && proposal?.payload?.decision === 'needs_discussion');
    const [stage, why] = actionCopy[next.kind] || actionCopy.awaiting_proposals;
    const startEdit = () => { setDraft(proposal?.payload || {}); setEditing(true); };
    const accept = (decision, editedPayload = null) => {
        if (!packet || !proposal) return;
        dispatch(decideReviewProposal({ packetId: packet.id, proposalId: proposal.id, decision, expectedVersion: packet.version, editedPayload }));
        setEditing(false);
    };

    return (
        <section id="review-focus-mode" className="flow-panel p-5 sm:p-6" aria-label="Focus Mode review">
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
            {proposal && <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">接受後會改變什麼</p><p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{acceptanceImpact(proposal)}</p></div>}
            {editing && <ProposalEditor proposal={proposal} draft={draft} onChange={setDraft} />}
            <div className="mt-5 flex flex-wrap gap-2">
                {next.kind === 'review_proposal' && proposal && <>
                    {!requiresOwnerContent && <button disabled={actionPending} onClick={() => accept('accept')} className="notion-btn-primary inline-flex items-center gap-2"><Check size={16} /> 接受候選</button>}
                    <button disabled={actionPending} onClick={startEdit} className="notion-btn-secondary inline-flex items-center gap-2"><Edit3 size={16} /> {requiresOwnerContent ? '補充內容後接受' : '編輯後接受'}</button>
                    {editing && <button disabled={actionPending} onClick={() => accept('edit_and_accept', draft)} className="notion-btn-primary inline-flex items-center gap-2"><ChevronRight size={16} /> 儲存編輯</button>}
                    <button disabled={actionPending} onClick={() => accept('reject')} className="notion-btn-secondary inline-flex items-center gap-2"><X size={16} /> 不採用</button>
                </>}
                {next.kind === 'repair_source' && packet && <>
                    {packet.post_id && <Link to={`/post/${packet.post_id}`} className="notion-btn-secondary inline-flex items-center gap-2">查看原始來源</Link>}
                    <button disabled={actionPending} onClick={() => dispatch(prepareReviewCandidates({ sourceRevisionId: packet.source_revision_id, allowPartial: true }))} className="notion-btn-primary inline-flex items-center gap-2"><ChevronRight size={16} /> 以目前來源建立候選</button>
                </>}
                {next.kind === 'resume_deferred' && packet && <button disabled={actionPending} onClick={() => dispatch(resumeReviewPacket({ packetId: packet.id, expectedVersion: packet.version }))} className="notion-btn-primary inline-flex items-center gap-2"><RefreshCw size={16} /> 繼續處理</button>}
                {packet && next.kind !== 'packet_complete' && <button disabled={actionPending} onClick={() => dispatch(deferReviewPacket({ packetId: packet.id, expectedVersion: packet.version, reason: 'Owner chose to continue later' }))} className="notion-btn-secondary inline-flex items-center gap-2"><Clock3 size={16} /> 稍後處理</button>}
                {!packet && !loading && <button onClick={() => dispatch(fetchReviewPackets())} className="notion-btn-secondary inline-flex items-center gap-2"><MessageSquareText size={16} /> 重新查看收件匣</button>}
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}
        </section>
    );
}
