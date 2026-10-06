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
    const { captureHistory } = useSelector(state => state.posts);
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
                    <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">選擇下一篇要整理的來源</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                        原始來源已保存，尚未進入正式知識。按下按鈕才會建立可編輯的候選；資料夾、貼文筆記、Topic 與專案參考仍都需要你的接受。
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
                    return (
                        <article key={capture.id} className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--foreground)] break-all">{captureLabel(capture)}</p>
                                    <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                                        {capture.status === 'degraded' ? '已降級保存：可先確認原始資料是否足夠。' : '擷取完成：下一步是建立候選整理。'}
                                    </p>
                                </div>
                                {reviewIsOpen ? (
                                    <button type="button" onClick={() => openFocus(packet.id)} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"><CheckCircle2 size={15} /> 在 Focus Mode 確認</button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={actionPending}
                                        onClick={() => dispatch(prepareReviewCandidates({ sourceRevisionId: capture.source_revision_id }))}
                                        className="notion-btn-primary inline-flex shrink-0 items-center justify-center gap-2 disabled:cursor-not-allowed"
                                    >
                                        {actionPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                                        {sourceIsPartial ? '確認來源品質' : '建立候選整理'}
                                    </button>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
