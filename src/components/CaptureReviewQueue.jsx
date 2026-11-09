import React from 'react';
import { ArrowUpRight, CheckCircle2, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectReviewPacket } from '../features/reviewSlice';
import './CaptureReviewQueue.css';
import './CaptureReviewQueueHover.css';

function captureLabel(capture) {
    if (capture.input_type === 'image') return capture.original_filename || '圖片來源';
    return capture.url || '未命名來源';
}

function existingPacket(packets, sourceRevisionId) {
    return packets.find((packet) => packet.source_revision_id === sourceRevisionId) || null;
}

function captureDate(value) {
    if (!value) return '剛剛保存';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '已保存';
    return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric' }).format(date);
}

export default function CaptureReviewQueue() {
    const dispatch = useDispatch();
    const { captureHistory, items } = useSelector((state) => state.posts);
    const { packets } = useSelector((state) => state.review);
    const completed = captureHistory
        .filter((capture) => ['finalized', 'degraded'].includes(capture.status) && capture.source_revision_id)
        .slice(0, 6);

    const openFocus = (packetId) => {
        dispatch(selectReviewPacket(packetId));
        window.requestAnimationFrame(() => document.getElementById('review-focus-mode')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };

    if (completed.length === 0) return null;

    return (
        <section className="capture-queue-editorial" aria-labelledby="saved-source-title">
            <header className="capture-queue-head">
                <div>
                    <p className="capture-editorial-kicker">02 / SAVED SOURCES</p>
                    <h2 id="saved-source-title">已保存的來源</h2>
                </div>
                <div className="capture-queue-count"><ClipboardList size={15} /> <span>{completed.length} 份可閱讀</span></div>
            </header>
            <p className="capture-queue-intro">每一份都先保留完整來源。現在只需挑一篇閱讀，不必急著分類或接受候選。</p>

            <div className="capture-queue-grid">
                {completed.map((capture, index) => {
                    const packet = existingPacket(packets, capture.source_revision_id);
                    const reviewIsOpen = packet && packet.next_action?.kind !== 'packet_complete';
                    const post = items.find((item) => (item.dbId || item.id) === capture.post_id) || null;
                    const image = post?.images?.[0] || post?.screenshot || null;
                    const title = post?.title || post?.analysis?.generated_title || capture.original_filename || captureLabel(capture);
                    const content = post?.content || '來源已保存；開啟後可以閱讀完整內容與目前待確認的整理項目。';
                    const author = post?.author || post?.author_name || post?.platform || (capture.input_type === 'image' ? '圖片來源' : '網頁來源');
                    const platform = post?.platform || (capture.input_type === 'image' ? 'IMAGE' : 'WEB');
                    return (
                        <article key={capture.id} className="capture-queue-card">
                            <div className={`capture-queue-cover ${image ? 'has-image' : ''}`}>
                                {image ? <img src={image} alt="貼文媒體預覽" /> : <><span>{String(index + 1).padStart(2, '0')}</span><ImageIcon size={24} /></>}
                                <p>{platform}</p>
                            </div>
                            <div className="capture-queue-copy">
                                <div className="capture-queue-meta"><span>{author}</span><span>{captureDate(capture.created_at || capture.completed_at)}</span></div>
                                <h3>{title}</h3>
                                <p>{content}</p>
                                <div className="capture-queue-status">
                                    <span className={capture.status === 'degraded' ? 'is-partial' : ''}>{capture.status === 'degraded' ? '部分擷取' : '完整來源'}</span>
                                    {reviewIsOpen ? <button type="button" onClick={() => openFocus(packet.id)}><CheckCircle2 size={15} />查看這篇</button> : capture.post_id ? <Link to={`/post/${capture.post_id}`}>查看貼文 <ArrowUpRight size={15} /></Link> : <span className="is-waiting">等待整理</span>}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
