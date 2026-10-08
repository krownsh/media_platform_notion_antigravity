import React from 'react';
import { ArrowRight, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { prepareReviewCandidates, selectReviewPacket } from '../features/reviewSlice';

function captureLabel(capture) {
    if (capture.input_type === 'image') return capture.original_filename || '圖片來源';
    return capture.url || '未命名來源';
}

function existingPacket(packets, sourceRevisionId) {
    return packets.find(packet => packet.source_revision_id === sourceRevisionId) || null;
}

export default function CaptureReviewQueue() {
    const dispatch = useDispatch();
    const { captureHistory, items } = useSelector(state => state.posts);
    const { packets, actionPending } = useSelector(state => state.review);
    const completed = captureHistory
        .filter(capture => ['finalized', 'degraded'].includes(capture.status) && capture.source_revision_id)
        .slice(0, 6);

    const openFocus = (packetId) => {
        dispatch(selectReviewPacket(packetId));
        window.requestAnimationFrame(() => {
            document.getElementById('review-focus-mode')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    if (completed.length === 0) return null;

    return (
        <section className="mt-6 flow-panel p-5 sm:p-6" aria-label="Captured source review handoff">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="flow-kicker mb-2">已保存的來源</p>
                    <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">選擇下一篇要確認的來源</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                        原始來源已保存，尚未進入正式知識。完整來源的候選會自動準備；資料夾、貼文筆記、Topic 與專案參考仍都需要你的接受。
                    </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <ClipboardList size={14} /> {completed.length} 篇可處理
                </span>
            </div>

            <div className="mt-5 space-y-3">
                {completed.map(capture => {
                    const packet = existingPacket(packets, capture.source_revision_id);
                    const reviewIsOpen = packet && packet.next_action?.kind !== 'packet_complete';
                    const sourceIsPartial = capture.capture_quality === 'partial' || capture.status === 'degraded';
                    const post = items.find(item => (item.dbId || item.id) === capture.post_id) || null;
                    const image = post?.images?.[0] || post?.screenshot || null;
                    const title = post?.title || post?.analysis?.generated_title || capture.original_filename || captureLabel(capture);
                    const content = post?.content || '來源已保存；開啟後可查看完整內容與待確認的整理項目。';
                    const author = post?.author || post?.author_name || post?.platform || (capture.input_type === 'image' ? '圖片來源' : '網頁來源');
                    const proposal = packet?.proposals?.find(item => item.id === packet.next_action?.proposal_id);
                    const proposalLabel = ({ folder_assignment: '資料夾分類', post_learning_note: '貼文筆記', topic_assignment: 'Topic 關聯', topic_knowledge_delta: 'Topic 知識', project_reference: '專案參考' })[proposal?.proposal_type] || '查看候選';
                    return (
                        <article key={capture.id} className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]">
                            <div className="grid gap-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                                {image ? <img src={image} alt="貼文媒體預覽" className="h-44 w-full object-cover sm:h-full" /> : <div className="flex min-h-32 items-end bg-[linear-gradient(135deg,#e9e1d4_0%,#f7f4ee_58%,#ddd3c3_100%)] p-3"><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-[#615d59]">{post?.platform || '來源'}</span></div>}
                                <div className="min-w-0 p-4"><p className="text-xs font-semibold text-[var(--muted-foreground)]">{author}</p><h3 className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-[var(--foreground)]">{title}</h3><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-[#615d59]">{content}</p><p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">{capture.status === 'degraded' ? '來源不完整：先確認保留內容是否足夠。' : reviewIsOpen ? `待確認：${proposalLabel}` : '候選尚未準備。'}</p></div>
                                <div className="flex items-center border-t border-[var(--border)] p-3 sm:border-l sm:border-t-0">{reviewIsOpen ? <button type="button" onClick={() => openFocus(packet.id)} className="notion-btn-primary inline-flex w-full shrink-0 items-center justify-center gap-1.5 text-xs"><CheckCircle2 size={15} />處理這篇</button> : <button type="button" disabled={actionPending} onClick={() => dispatch(prepareReviewCandidates({ sourceRevisionId: capture.source_revision_id }))} className="notion-btn-primary inline-flex w-full shrink-0 items-center justify-center gap-2 text-xs disabled:cursor-not-allowed">{actionPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{sourceIsPartial ? '確認來源' : '準備候選'}</button>}</div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
