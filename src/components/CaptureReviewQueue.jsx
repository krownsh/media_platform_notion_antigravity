import React from 'react';
import { CheckCircle2, ClipboardList } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectReviewPacket } from '../features/reviewSlice';
import { Link } from 'react-router-dom';

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
    const { packets } = useSelector(state => state.review);
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
                        原始來源已保存。先選一篇查看內容與目前狀態；資料夾可在收藏庫直接整理，其餘知識工作在你和 Agent 的對話中完成。
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
                    const post = items.find(item => (item.dbId || item.id) === capture.post_id) || null;
                    const image = post?.images?.[0] || post?.screenshot || null;
                    const title = post?.title || post?.analysis?.generated_title || capture.original_filename || captureLabel(capture);
                    const content = post?.content || '來源已保存；開啟後可查看完整內容與待確認的整理項目。';
                    const author = post?.author || post?.author_name || post?.platform || (capture.input_type === 'image' ? '圖片來源' : '網頁來源');
                    return (
                        <article key={capture.id} className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]">
                            <div className="grid gap-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                                {image ? <img src={image} alt="貼文媒體預覽" className="h-44 w-full object-cover sm:h-full" /> : <div className="flex min-h-32 items-end bg-[linear-gradient(135deg,#e9e1d4_0%,#f7f4ee_58%,#ddd3c3_100%)] p-3"><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-[#615d59]">{post?.platform || '來源'}</span></div>}
                                <div className="min-w-0 p-4"><p className="text-xs font-semibold text-[var(--muted-foreground)]">{author}</p><h3 className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-[var(--foreground)]">{title}</h3><p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-[#615d59]">{content}</p><p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">{capture.status === 'degraded' ? '來源不完整：請先查看內容。' : reviewIsOpen ? '可查看來源與目前討論狀態。' : '來源已保存，等待 Agent 對話整理。'}</p></div>
                                <div className="flex items-center border-t border-[var(--border)] p-3 sm:border-l sm:border-t-0">{reviewIsOpen ? <button type="button" onClick={() => openFocus(packet.id)} className="notion-btn-primary inline-flex w-full shrink-0 items-center justify-center gap-1.5 text-xs"><CheckCircle2 size={15} />查看這篇</button> : capture.post_id ? <Link to={`/post/${capture.post_id}`} className="notion-btn-secondary inline-flex w-full shrink-0 items-center justify-center gap-1.5 text-xs">查看貼文</Link> : <span className="text-xs text-[#615d59]">等待整理</span>}</div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
