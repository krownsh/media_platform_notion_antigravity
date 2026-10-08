import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, ChevronRight, Clock3, Edit3, ExternalLink, MessageSquareText, RefreshCw, ShieldCheck, Tag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { decideReviewProposal, deferReviewPacket, fetchReviewPackets, prepareReviewCandidates, resumeReviewPacket } from '../features/reviewSlice';
import { visibleCollections } from '../utils/collectionVisibility';

const actionCopy = {
    repair_source: ['先確認來源內容', '這篇貼文只保存到部分資料。先看原始內容，確認是否足以繼續整理。'],
    review_proposal: ['確認一個候選', '這篇貼文已有一項具體整理決策，只有你確認後才會寫進正式知識。'],
    resume_deferred: ['回到暫緩工作', '你先前選擇稍後再處理；恢復後會回到同一項決策。'],
    awaiting_proposals: ['等待下一個候選', '這篇貼文暫時沒有可確認的候選；來源仍安全留在收件匣。'],
    packet_complete: ['本輪已完成', '這篇貼文目前的候選都已有明確結果。']
};

function postId(post) { return post?.dbId || post?.id || null; }

function sourceTitle(post, packet) {
    const source = packet?.source_revision?.source_payload || {};
    return post?.title || post?.analysis?.generated_title || source.title || '未命名貼文';
}

function sourceText(post, packet) {
    const source = packet?.source_revision?.source_payload || {};
    return post?.content || source.content || source.text || '這篇來源沒有可顯示的文字內容。';
}

function sourceImage(post, packet) {
    if (post?.images?.[0]) return post.images[0];
    if (post?.screenshot) return post.screenshot;
    const media = packet?.source_revision?.source_payload?.media;
    return Array.isArray(media) ? media.find(item => item?.type === 'image')?.url || null : null;
}

function sourceAuthor(post, packet) {
    return post?.author || post?.author_name || packet?.source_revision?.source_payload?.author_name || null;
}

function proposalLabel(type) {
    return ({
        folder_assignment: '資料夾分類',
        post_learning_note: '貼文筆記',
        topic_assignment: 'Topic 關聯',
        topic_knowledge_delta: 'Topic 知識整理',
        project_reference: '專案參考'
    })[type] || '整理決策';
}

function proposalPresentation(proposal) {
    const payload = proposal?.payload || {};
    if (proposal?.proposal_type === 'folder_assignment') {
        if (payload.suggested_name) {
            return {
                question: `這篇貼文要放入「${payload.suggested_name}」嗎？`,
                recommendation: `建議分類至「${payload.suggested_name}」`,
                reason: payload.rationale || '貼文的內容與這個資料夾有明確關聯。',
                detail: (payload.alternatives || []).map(item => item.name).filter(Boolean).join('、')
            };
        }
        return {
            question: '這篇貼文要放到哪一個資料夾？',
            recommendation: '尚未找到可信的自動分類',
            reason: '貼文內容沒有足夠明確的線索對應現有資料夾，需要你選擇分類，或明確確認暫留收件匣。',
            detail: '選「選擇資料夾後確認」可直接指定資料夾。'
        };
    }
    if (proposal?.proposal_type === 'post_learning_note') {
        const needsDiscussion = payload.note_status === 'needs_discussion';
        return {
            question: needsDiscussion ? '這篇貼文要留下什麼屬於你的學習？' : '這篇貼文需要另寫一則個人學習筆記嗎？',
            recommendation: needsDiscussion ? '這篇有可討論的內容，等待你用自己的話決定。' : '目前沒有足夠理由自動建立個人學習筆記。',
            reason: payload.rationale || '貼文筆記必須由你明確記錄或明確選擇不需要。'
        };
    }
    if (proposal?.proposal_type === 'topic_assignment') {
        const topics = [payload.primary_topic, ...(payload.related_topics || [])].filter(Boolean);
        return {
            question: '這篇貼文要連到哪些 Topic？',
            recommendation: topics.length ? `候選 Topic：${topics.join('、')}` : '目前沒有可信的 Topic；可自行補上或明確保留空白。',
            reason: payload.rationale || 'Topic 是跨貼文的關聯，必須由你確認。'
        };
    }
    if (proposal?.proposal_type === 'topic_knowledge_delta') {
        const topics = (payload.topics || []).map(item => item.label).filter(Boolean);
        return {
            question: '這篇貼文有內容值得寫入既有 Topic 的知識彙整嗎？',
            recommendation: topics.length ? `檢視 Topic：${topics.join('、')}` : '建議只保留來源連結，不新增 Topic 知識。',
            reason: payload.rationale || '只有可跨貼文成立且有來源依據的內容，才會進入 Topic 知識。'
        };
    }
    if (proposal?.proposal_type === 'project_reference') {
        return {
            question: '這篇貼文是否值得作為既有專案的參考？',
            recommendation: '確認是否建立「可參考」關聯，不會修改任何專案。',
            reason: payload.rationale || '這是可參考的候選，不代表要執行或修改專案。'
        };
    }
    return { question: '要如何處理這個整理候選？', recommendation: '請查看候選內容後決定。', reason: '這項整理需要你的確認。' };
}

function acceptanceImpact(proposal) {
    const payload = proposal?.payload || {};
    if (!proposal) return '不會有隱藏寫入。';
    if (proposal.proposal_type === 'folder_assignment') return payload.suggested_name
        ? `會把這篇貼文的正式資料夾設為「${payload.suggested_name}」。`
        : '會記錄你明確選擇暫留收件匣；不會自動替你分類。';
    if (proposal.proposal_type === 'post_learning_note') return '只會寫入你確認的貼文學習狀態與內容。';
    if (proposal.proposal_type === 'topic_assignment') return '會建立這篇貼文與你確認的 Topic 連結，不會自動寫 Topic 知識。';
    if (proposal.proposal_type === 'topic_knowledge_delta') return '只有你選擇「新增知識摘要」時，才會新增帶來源引用的 Topic 修訂。';
    if (proposal.proposal_type === 'project_reference') return '只會記錄可參考的關聯；不會修改 repo 或執行 POC。';
    return '只會保存這個可稽核決定。';
}

function acceptLabel(proposal) {
    const payload = proposal?.payload || {};
    if (proposal?.proposal_type === 'folder_assignment') return payload.suggested_name ? `接受：放入「${payload.suggested_name}」` : '確認暫留收件匣';
    if (proposal?.proposal_type === 'topic_assignment') return '接受 Topic 關聯';
    if (proposal?.proposal_type === 'project_reference') return '接受專案參考';
    return '接受候選';
}

function ProposalEditor({ proposal, draft, onChange, collections }) {
    const update = patch => onChange({ ...draft, ...patch });
    if (proposal.proposal_type === 'folder_assignment') {
        return <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">選擇這篇貼文的資料夾</p><p className="mt-1 text-xs leading-5 text-[#615d59]">這是你明確的整理決定。選擇 Inbox 代表先保留，日後仍可調整。</p><label className="mt-3 block text-sm font-medium">正式資料夾<select value={draft.folder_id || ''} onChange={event => { const selected = collections.find(item => item.id === event.target.value); update({ folder_id: selected?.id || null, suggested_name: selected?.name || null }); }} className="notion-input mt-1 w-full"><option value="">Inbox（暫不分類）</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label></div>;
    }
    if (proposal.proposal_type === 'post_learning_note') {
        const recorded = draft.note_status === 'recorded';
        return <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">這篇貼文的學習筆記</p><p className="mt-1 text-xs leading-5 text-[#615d59]">可明確選擇不需要；空白不會被假裝成完成。</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" checked={!recorded} onChange={() => update({ note_status: 'not_needed', content: null })} />不需要另寫筆記</label><label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" checked={recorded} onChange={() => update({ note_status: 'recorded', content: draft.content || '' })} />記錄我的學習</label>{recorded && <textarea value={draft.content || ''} onChange={event => update({ content: event.target.value })} placeholder="用自己的話記下這篇帶來的學習…" className="notion-input mt-3 min-h-28 w-full" />}</div>;
    }
    if (proposal.proposal_type === 'topic_assignment') {
        return <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">這篇貼文要連到哪些 Topic？</p><p className="mt-1 text-xs leading-5 text-[#615d59]">最多 1 個主要 Topic 和 2 個相關 Topic。只建立可追溯連結，不會自動寫 Topic 知識。</p><label className="mt-3 block text-sm">主要 Topic<input value={draft.primary_topic || ''} onChange={event => update({ primary_topic: event.target.value })} placeholder="例如：UI UX" className="notion-input mt-1 w-full" /></label><label className="mt-3 block text-sm">相關 Topic（以逗號分隔，最多兩個）<input value={(draft.related_topics || []).join(', ')} onChange={event => update({ related_topics: event.target.value.split(',').map(item => item.trim()).filter(Boolean).slice(0, 2) })} placeholder="例如：Accessibility, Design Systems" className="notion-input mt-1 w-full" /></label><p className="mt-3 text-xs text-[#615d59]">若確定這篇不屬於任何 Topic，可保留兩欄空白再儲存。</p></div>;
    }
    if (proposal.proposal_type === 'topic_knowledge_delta') {
        const topic = (draft.topics || [])[0] || {};
        const setTopic = patch => update({ topics: [{ ...topic, ...patch }] });
        const recorded = draft.decision === 'recorded';
        return <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">要把什麼寫進 Topic？</p><p className="mt-1 text-xs leading-5 text-[#615d59]">這是跨來源的 Topic 知識，不是貼文原文。若沒有可累積的內容，選「只保留來源連結」。</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" checked={!recorded} onChange={() => update({ decision: 'not_needed' })} />只保留來源連結，不新增知識摘要</label><label className="mt-2 flex items-center gap-2 text-sm"><input type="radio" checked={recorded} onChange={() => update({ decision: 'recorded' })} />新增一筆知識摘要</label>{recorded && <><label className="mt-3 block text-sm">Topic 名稱<input value={topic.label || ''} onChange={event => setTopic({ label: event.target.value })} className="notion-input mt-1 w-full" /></label><label className="mt-3 block text-sm">摘要<textarea value={topic.summary || ''} onChange={event => setTopic({ summary: event.target.value })} placeholder="可跨貼文成立、可追溯的知識整理…" className="notion-input mt-1 min-h-28 w-full" /></label></>}</div>;
    }
    return <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[#615d59]">這個候選目前沒有可編輯欄位；你可以接受、拒絕，或先稍後處理。</div>;
}

function SourcePreview({ post, packet }) {
    const image = sourceImage(post, packet);
    const title = sourceTitle(post, packet);
    const content = sourceText(post, packet);
    const author = sourceAuthor(post, packet);
    const platform = post?.platform || packet?.source_revision?.source_payload?.platform || '來源';
    return <article className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)]">
        <div className="grid sm:grid-cols-[minmax(9rem,0.42fr)_minmax(0,1fr)]">
            {image ? <img src={image} alt="貼文媒體預覽" className="h-48 w-full object-cover sm:h-full sm:min-h-48" /> : <div className="flex min-h-36 items-end bg-[linear-gradient(135deg,#e9e1d4_0%,#f7f4ee_58%,#ddd3c3_100%)] p-4"><span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-[#615d59]">{platform}</span></div>}
            <div className="min-w-0 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]"><span className="font-semibold text-[var(--foreground)]">{author || platform}</span>{author && <><span aria-hidden="true">·</span><span>{platform}</span></>}</div><h3 className="mt-2 line-clamp-2 text-base font-bold leading-6 text-[var(--foreground)]">{title}</h3><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[#615d59]">{content}</p>{packet?.post_id && <Link to={`/post/${packet.post_id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"><ExternalLink size={14} />查看完整貼文</Link>}</div>
        </div>
    </article>;
}

export default function ReviewFocusPanel() {
    const dispatch = useDispatch();
    const { packets, activePacketId, loading, actionPending, error } = useSelector(state => state.review);
    const { items, collections } = useSelector(state => state.posts);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({});
    useEffect(() => { dispatch(fetchReviewPackets()); }, [dispatch]);
    const packet = packets.find(item => item.id === activePacketId) || packets[0] || null;
    const next = packet?.next_action || { kind: 'awaiting_proposals' };
    const proposal = useMemo(() => packet?.proposals?.find(item => item.id === next.proposal_id) || null, [packet, next.proposal_id]);
    const post = useMemo(() => items.find(item => postId(item) === packet?.post_id) || null, [items, packet?.post_id]);
    const folders = useMemo(() => visibleCollections(collections), [collections]);
    const requiresOwnerContent = (proposal?.proposal_type === 'post_learning_note' && proposal?.payload?.note_status === 'needs_discussion') || (proposal?.proposal_type === 'topic_knowledge_delta' && proposal?.payload?.decision === 'needs_discussion');
    const [stage, stageWhy] = actionCopy[next.kind] || actionCopy.awaiting_proposals;
    const presentation = proposalPresentation(proposal);
    const openPackets = packets.filter(item => item.next_action?.kind !== 'packet_complete').length;
    const startEdit = () => { setDraft(proposal?.payload || {}); setEditing(true); };
    const accept = (decision, editedPayload = null) => { if (!packet || !proposal) return; dispatch(decideReviewProposal({ packetId: packet.id, proposalId: proposal.id, decision, expectedVersion: packet.version, editedPayload })); setEditing(false); };

    return <section id="review-focus-mode" className="flow-panel p-5 sm:p-6" aria-label="Focus Mode review"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flow-kicker mb-2">現在處理這一篇</p><h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">{stage}</h2><p className="mt-2 text-sm leading-6 text-[#615d59]">{openPackets > 0 ? `還有 ${openPackets} 篇來源可回來處理；現在只需要完成眼前這一項。` : '目前沒有其他待確認來源。'}</p></div>{packet && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"><ShieldCheck size={14} />版本 {packet.version}</span>}</div>{packet && <div className="mt-5"><SourcePreview post={post} packet={packet} /></div>}{proposal ? <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"><Tag size={13} />{proposalLabel(proposal.proposal_type)}</span><span className="text-xs text-[var(--muted-foreground)]">這一項等待你的決定</span></div><h3 className="mt-3 text-lg font-bold tracking-[-0.02em] text-[var(--foreground)]">{presentation.question}</h3><div className="mt-4 border-l-2 border-[var(--accent)] pl-3"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">候選重點</p><p className="mt-1 text-sm font-semibold leading-6 text-[var(--foreground)]">{presentation.recommendation}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-[var(--surface-muted)] p-3"><p className="text-xs font-semibold text-[var(--muted-foreground)]">為什麼現在處理</p><p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{presentation.reason}</p></div><div className="rounded-lg bg-[var(--surface-muted)] p-3"><p className="text-xs font-semibold text-[var(--muted-foreground)]">接受後會改變什麼</p><p className="mt-1 text-sm leading-6 text-[var(--foreground)]">{acceptanceImpact(proposal)}</p></div></div>{presentation.detail && <p className="mt-3 text-xs leading-5 text-[#615d59]">{presentation.detail}</p>}{editing && <ProposalEditor proposal={proposal} draft={draft} onChange={setDraft} collections={folders} />}<div className="mt-5 flex flex-wrap gap-2">{!requiresOwnerContent && <button disabled={actionPending} onClick={() => accept('accept')} className="notion-btn-primary inline-flex items-center gap-2"><Check size={16} />{acceptLabel(proposal)}</button>}<button disabled={actionPending} onClick={startEdit} className="notion-btn-secondary inline-flex items-center gap-2"><Edit3 size={16} />{proposal.proposal_type === 'folder_assignment' ? '選擇資料夾後確認' : requiresOwnerContent ? '補充內容後接受' : '修改後接受'}</button>{editing && <button disabled={actionPending} onClick={() => accept('edit_and_accept', draft)} className="notion-btn-primary inline-flex items-center gap-2"><ChevronRight size={16} />儲存並接受</button>}<button disabled={actionPending} onClick={() => accept('reject')} className="notion-btn-secondary inline-flex items-center gap-2"><X size={16} />不採用這項建議</button></div></div> : <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4"><p className="text-sm font-semibold">{stage}</p><p className="mt-2 text-sm leading-6 text-[#615d59]">{stageWhy}</p>{packet?.source_revision_id && <p className="mt-3 text-xs text-[var(--muted-foreground)]">來源依據：版本 {packet.source_revision_id}</p>}</div>}<div className="mt-5 flex flex-wrap gap-2">{next.kind === 'repair_source' && packet && <button disabled={actionPending} onClick={() => dispatch(prepareReviewCandidates({ sourceRevisionId: packet.source_revision_id, allowPartial: true }))} className="notion-btn-primary inline-flex items-center gap-2"><ChevronRight size={16} />以現有來源建立候選</button>}{next.kind === 'resume_deferred' && packet && <button disabled={actionPending} onClick={() => dispatch(resumeReviewPacket({ packetId: packet.id, expectedVersion: packet.version }))} className="notion-btn-primary inline-flex items-center gap-2"><RefreshCw size={16} />繼續處理</button>}{packet && next.kind !== 'packet_complete' && <button disabled={actionPending} onClick={() => dispatch(deferReviewPacket({ packetId: packet.id, expectedVersion: packet.version, reason: 'Owner chose to continue later' }))} className="notion-btn-secondary inline-flex items-center gap-2"><Clock3 size={16} />稍後處理</button>}{!packet && !loading && <button onClick={() => dispatch(fetchReviewPackets())} className="notion-btn-secondary inline-flex items-center gap-2"><MessageSquareText size={16} />重新查看收件匣</button>}</div>{error && <p role="alert" className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}</section>;
}
