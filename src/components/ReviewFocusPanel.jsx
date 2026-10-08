import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ExternalLink, FolderOpen, MessageSquareText, ShieldCheck, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchReviewPackets } from '../features/reviewSlice';

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
        folder_assignment: '資料夾建議',
        post_learning_note: '貼文筆記討論',
        topic_assignment: 'Topic 討論',
        topic_knowledge_delta: 'Topic 知識討論',
        project_reference: '專案參考討論'
    })[type] || '待討論項目';
}

function workflowPresentation(packet) {
    if (!packet) return { label: '尚未選擇來源', description: '從上方選一篇貼文，查看它目前的整理狀態。' };
    if (packet.status === 'deferred') return { label: '暫緩中', description: '這篇已暫停；需要時可在 Agent 對話中恢復討論。' };
    if (packet.status === 'completed') return { label: '目前討論已結束', description: '這篇的目前候選已有結果；仍可在 Agent 對話中繼續延伸。' };
    if (packet.source_revision?.capture_quality === 'partial') return { label: '來源待補確認', description: '擷取內容不完整；先在 Agent 對話中確認是否以現有內容繼續。' };
    return { label: '等待與 Agent 討論', description: '前端只呈現來源與狀態；筆記、Topic、專案與研究結論由你和 Agent 在對話中完成。' };
}

function SourcePreview({ post, packet }) {
    const image = sourceImage(post, packet);
    const title = sourceTitle(post, packet);
    const content = sourceText(post, packet);
    const author = sourceAuthor(post, packet);
    const platform = post?.platform || packet?.source_revision?.source_payload?.platform || '來源';
    return <article className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)]"><div className="grid sm:grid-cols-[minmax(9rem,0.42fr)_minmax(0,1fr)]">{image ? <img src={image} alt="貼文媒體預覽" className="h-48 w-full object-cover sm:h-full sm:min-h-48" /> : <div className="flex min-h-36 items-end bg-[linear-gradient(135deg,#e9e1d4_0%,#f7f4ee_58%,#ddd3c3_100%)] p-4"><span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-[#615d59]">{platform}</span></div>}<div className="min-w-0 p-4 sm:p-5"><div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]"><span className="font-semibold text-[var(--foreground)]">{author || platform}</span>{author && <><span aria-hidden="true">·</span><span>{platform}</span></>}</div><h3 className="mt-2 line-clamp-2 text-base font-bold leading-6 text-[var(--foreground)]">{title}</h3><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[#615d59]">{content}</p>{packet?.post_id && <Link to={`/post/${packet.post_id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"><ExternalLink size={14} />查看完整貼文</Link>}</div></div></article>;
}

export default function ReviewFocusPanel() {
    const dispatch = useDispatch();
    const { packets, activePacketId, loading, error } = useSelector(state => state.review);
    const { items } = useSelector(state => state.posts);
    useEffect(() => { dispatch(fetchReviewPackets()); }, [dispatch]);
    const packet = packets.find(item => item.id === activePacketId) || packets[0] || null;
    const post = useMemo(() => items.find(item => postId(item) === packet?.post_id) || null, [items, packet?.post_id]);
    const state = workflowPresentation(packet);
    const pendingItems = (packet?.proposals || []).filter(item => ['pending', 'proposed'].includes(item.status));

    return <section id="review-focus-mode" className="flow-panel p-5 sm:p-6" aria-label="Selected source workspace"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flow-kicker mb-2">目前選擇的來源</p><h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--foreground)]">{state.label}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#615d59]">{state.description}</p></div>{packet && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"><ShieldCheck size={14} />來源版本 {packet.version}</span>}</div>{packet ? <><div className="mt-5"><SourcePreview post={post} packet={packet} /></div><section className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"><div className="flex items-center gap-2"><MessageSquareText size={18} className="text-[var(--accent)]" /><h3 className="font-semibold">等待與 Agent 討論</h3></div><p className="mt-2 text-sm leading-6 text-[#615d59]">以下是 Agent 準備好的討論脈絡，不是可在前端接受或拒絕的決策。請在對話中以這篇貼文為範圍討論；完成的理解與結果才會寫入正式資料與本機筆記。</p>{pendingItems.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{pendingItems.map(item => <span key={item.id} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"><Tag size={13} />{proposalLabel(item.proposal_type)}</span>)}</div> : <p className="mt-4 rounded-lg bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[#615d59]">目前沒有待討論的候選。你仍可在 Agent 對話中針對這篇來源提出新的整理需求。</p>}<p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--foreground)]">對話時可直接說：<span className="font-semibold">「討論這篇貼文：{sourceTitle(post, packet)}」</span></p></section><div className="mt-5 flex flex-wrap gap-2"><Link to={`/post/${packet.post_id}`} className="notion-btn-primary inline-flex items-center gap-2"><ExternalLink size={16} />查看完整貼文</Link><Link to="/view-all" className="notion-btn-secondary inline-flex items-center gap-2"><FolderOpen size={16} />到收藏庫分類</Link></div></> : <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-5 text-sm leading-6 text-[#615d59]">{loading ? '正在載入來源…' : '從上方選一篇來源後，這裡會顯示完整貼文與目前狀態。'}</div>}{error && <p role="alert" className="mt-4 text-sm text-[var(--destructive)]">{error}</p>}</section>;
}
