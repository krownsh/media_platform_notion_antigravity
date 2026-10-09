import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpenText, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Heart, Lightbulb, Loader2, MessageCircle, MoreHorizontal, Share2, Tag } from 'lucide-react';
import AuthorInitialAvatar from '../components/AuthorInitialAvatar';
import { getOwnerLibraryPost } from '../api/ownerLibraryApi';
import { getLocalPostRecord, syncLocalPostRecord } from '../api/localMediaKnowledgeApi';
import LocalRecordStatusCard from '../components/LocalRecordStatusCard';

function candidateLabel(type) {
    return ({ folder_assignment: '資料夾候選', post_learning_note: '貼文筆記候選', topic_assignment: 'Topic 候選', topic_knowledge_delta: 'Topic 知識候選', project_reference: '專案參考候選' })[type] || type;
}

function capturedDate(post) {
    const date = new Date(post?.created_at || post?.createdAt || post?.posted_at || 0);
    return Number.isNaN(date.getTime()) || date.getTime() === 0 ? '已保存的來源' : date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
}

function CommentItem({ comment }) {
    const author = comment.user || comment.author_name || comment.author || '未命名帳號';
    const content = comment.text || comment.content || '留言內容未完整記錄。';
    return <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"><p className="text-xs font-bold text-[var(--foreground)]/70">{author}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]/90">{content}</p></article>;
}

export default function OwnerPostPage() {
    const { postId } = useParams();
    const libraryPost = useSelector(state => state.posts.items.find(item => (item.dbId || item.id) === postId));
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');
    const [localRecordState, setLocalRecordState] = useState({ postId: null, record: null, error: '', loading: true });
    const [localRecordSyncing, setLocalRecordSyncing] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [zoomedImage, setZoomedImage] = useState(null);

    useEffect(() => {
        let active = true;
        getOwnerLibraryPost(postId).then(value => active && setDetail(value)).catch(loadError => active && setError(loadError.message));
        getLocalPostRecord(postId)
            .then(value => active && setLocalRecordState({ postId, record: value, error: '', loading: false }))
            .catch(loadError => active && setLocalRecordState({ postId, record: null, error: loadError.message, loading: false }));
        return () => { active = false; };
    }, [postId]);

    if (error) return <div className="flow-page px-1 sm:px-2"><p className="flow-panel p-5 text-destructive">{error}</p></div>;
    if (!detail) return <div className="flow-page flex min-h-[18rem] items-center justify-center text-[#615d59]"><Loader2 className="animate-spin" size={22} /> <span className="ml-2">載入來源與知識脈絡…</span></div>;

    const { post, source_revision: source, learning_note: note, topic_links: links = [], topic_revisions: revisions = [], project_references: references = [], candidates = [] } = detail;
    const sourcePayload = source?.source_payload || {};
    const payloadMedia = Array.isArray(sourcePayload.media) ? sourcePayload.media.filter(item => item?.type === 'image').map(item => item.url).filter(Boolean) : [];
    const images = libraryPost?.images?.length ? libraryPost.images : payloadMedia;
    const comments = libraryPost?.comments?.length ? libraryPost.comments : Array.isArray(sourcePayload.comments) ? sourcePayload.comments : [];
    const acceptedTopics = [...new Set([...links.map(item => item.topic?.label), ...revisions.map(item => item.topic?.label)].filter(Boolean))];
    const author = post?.author_name || libraryPost?.author || 'Unknown';
    const previousImage = () => setCurrentImageIndex(index => Math.max(0, index - 1));
    const nextImage = () => setCurrentImageIndex(index => Math.min(images.length - 1, index + 1));
    const syncLocalRecord = async () => {
        setLocalRecordSyncing(true);
        try { const payload = await syncLocalPostRecord(postId); setLocalRecordState({ postId, record: payload.local_record, error: '', loading: false }); }
        catch (syncError) { setLocalRecordState(current => ({ ...current, postId, error: syncError.message, loading: false })); }
        finally { setLocalRecordSyncing(false); }
    };

    return <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[100dvh] flex-col overflow-x-hidden md:h-[calc(100vh-7rem)] md:max-h-[calc(100vh-7rem)] md:overflow-hidden">
        <header className="flex flex-col items-start justify-between gap-3 px-2 py-3 sm:flex-row sm:items-center sm:gap-4 sm:py-4">
            <Link to="/view-all" className="group flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"><ArrowLeft size={20} className="transition-transform group-hover:-translate-x-1" /><span className="text-sm font-medium">返回所有貼文</span><span className="mx-1 text-neutral-300">/</span><span className="max-w-[10rem] truncate text-xs font-semibold">{post?.platform || '來源'}</span></Link>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto"><span className="hidden text-xs text-[#615d59] sm:inline">{source?.capture_quality === 'partial' ? '來源不完整' : '來源完整'}</span>{post?.original_url && <a href={post.original_url} target="_blank" rel="noreferrer" className="notion-btn-secondary flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm"><ExternalLink size={16} />原始貼文</a>}</div>
        </header>

        <main className="flex flex-1 flex-col gap-6 pb-4 md:min-h-0 md:flex-row">
            <section className="flex flex-[3] flex-col overflow-hidden flow-surface md:min-h-0">
                <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] p-4"><div className="flex items-center gap-3"><AuthorInitialAvatar name={author} size="lg" /><div><p className="text-sm font-bold text-[var(--foreground)]">{author}</p><p className="text-xs text-[var(--muted-foreground)]">@{libraryPost?.authorHandle || libraryPost?.author_handle || 'unknown'}</p></div></div><button type="button" aria-label="更多貼文操作" className="flow-icon-button"><MoreHorizontal size={20} /></button></div>
                <div className="flex-1 md:overflow-y-auto custom-scrollbar">
                    {images.length > 0 && <div className="group relative border-b border-[var(--border)] bg-[var(--surface-muted)]"><div className="mx-auto max-w-3xl py-2"><div className="relative flex items-center justify-center overflow-hidden"><Motion.div className="flex w-full" animate={{ x: `-${currentImageIndex * 100}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>{images.map((image, index) => <div key={`${image}-${index}`} className="flex w-full flex-shrink-0 items-center justify-center"><img src={image} alt={`${post?.title || '貼文媒體'} - ${index + 1}`} className="max-h-[60vh] max-w-full cursor-zoom-in rounded-sm object-contain shadow-soft-card" onClick={() => setZoomedImage(image)} /></div>)}</Motion.div>{images.length > 1 && <><button type="button" onClick={previousImage} disabled={currentImageIndex === 0} aria-label="上一張圖片" className="absolute left-2 flow-icon-button bg-surface-raised/95 shadow-soft-card disabled:opacity-30 sm:left-4"><ChevronLeft size={20} /></button><button type="button" onClick={nextImage} disabled={currentImageIndex === images.length - 1} aria-label="下一張圖片" className="absolute right-2 flow-icon-button bg-surface-raised/95 shadow-soft-card disabled:opacity-30 sm:right-4"><ChevronRight size={20} /></button><div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/20 p-1">{images.map((_, index) => <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === currentImageIndex ? 'bg-white' : 'bg-white/40'}`} />)}</div></>}</div></div></div>}
                    <div className="mx-auto max-w-2xl p-4 sm:p-6"><div className="mb-4 flex items-center gap-3 text-[var(--muted-foreground)]"><Heart size={20} /><MessageCircle size={20} /><Share2 size={20} /></div><h1 className="mb-4 text-lg font-bold text-[var(--foreground)]">{post?.title || '來源未提供標題'}</h1><p className="mb-6 whitespace-pre-wrap text-base leading-relaxed text-[var(--foreground)]/90">{post?.content || '原始來源未提供內文。'}</p><p className="mb-8 border-b border-[var(--border)] pb-8 text-xs tracking-[0.16em] text-[var(--muted-foreground)]">{capturedDate(post)}</p>{comments.length > 0 && <div className="space-y-4"><h2 className="mb-4 text-xs font-bold tracking-[0.16em] text-[var(--muted-foreground)]">留言回覆 · {comments.length}</h2>{comments.map((comment, index) => <CommentItem key={`${comment.id || comment.user || comment.author_name || 'comment'}-${index}`} comment={comment} />)}</div>}</div>
                </div>
            </section>
            <aside className="flex flex-[2] flex-col overflow-hidden flow-surface md:min-h-0"><div className="border-b border-[var(--border)] bg-[var(--surface)] p-5"><div className="flex items-center gap-2"><BookOpenText size={18} className="text-[var(--accent)]" /><h2 className="font-semibold">知識與整理</h2></div><p className="mt-2 text-sm leading-6 text-[#615d59]">來源在左；這裡只顯示你已接受的知識與仍待決定的候選。</p></div><div className="space-y-5 p-5 md:overflow-y-auto custom-scrollbar"><LocalRecordStatusCard record={localRecordState.record} loading={localRecordState.loading || localRecordState.postId !== postId} error={localRecordState.postId === postId ? localRecordState.error : ''} onSync={syncLocalRecord} syncing={localRecordSyncing} /><section><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /><h3 className="font-semibold">已接受的知識</h3></div>{note?.note_status === 'recorded' ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{note.content}</p> : <p className="mt-3 text-sm text-[#615d59]">這篇貼文目前沒有已接受的個人學習筆記。</p>}{acceptedTopics.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{acceptedTopics.map(label => <span key={label} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800"><Tag size={12} className="mr-1 inline" />{label}</span>)}</div>}{revisions.map(revision => <div key={revision.id || `${revision.topic?.label}-${revision.summary}`} className="mt-4 border-l-2 border-emerald-200 pl-4"><p className="text-sm font-semibold">{revision.topic?.label}</p><p className="mt-1 text-sm leading-6 text-[#615d59]">{revision.summary}</p></div>)}{references.map(reference => <div key={reference.id || `${reference.topic?.label}-${reference.project?.title}`} className="mt-4 text-sm"><span className="font-semibold">可參考專案：</span>{reference.project?.title || '未命名專案'}{reference.rationale && <span className="text-[#615d59]"> — {reference.rationale}</span>}</div>)}</section>{candidates.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><div className="flex items-center gap-2 text-amber-900"><Lightbulb size={18} /><h3 className="font-semibold">尚待你確認的候選</h3></div><p className="mt-2 text-sm leading-6 text-amber-900/75">這些不是正式知識，不會被當成已接受內容使用。</p><div className="mt-3 flex flex-wrap gap-2">{candidates.map(candidate => <span key={candidate.id || candidate.proposal_type} className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-900">{candidateLabel(candidate.proposal_type)}</span>)}</div><Link to="/" className="mt-4 inline-block text-sm font-semibold text-amber-900 underline">回到收件匣處理下一步</Link></section>}</div></aside>
        </main>
        <AnimatePresence>{zoomedImage && <Motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setZoomedImage(null)} className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/80 p-6" aria-label="關閉媒體預覽"><img src={zoomedImage} alt="放大媒體預覽" className="max-h-full max-w-full object-contain" /></Motion.button>}</AnimatePresence>
    </Motion.div>;
}
