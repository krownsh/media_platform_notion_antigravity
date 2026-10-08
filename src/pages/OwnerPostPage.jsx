import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, BookOpenText, CheckCircle2, ExternalLink, Image as ImageIcon, Lightbulb, Loader2, MessageCircle, Tag } from 'lucide-react';
import { getOwnerLibraryPost } from '../api/ownerLibraryApi';

function candidateLabel(type) {
    return ({ folder_assignment: '資料夾候選', post_learning_note: '貼文筆記候選', topic_assignment: 'Topic 候選', topic_knowledge_delta: 'Topic 知識候選', project_reference: '專案參考候選' })[type] || type;
}

export default function OwnerPostPage() {
    const { postId } = useParams();
    const libraryPost = useSelector(state => state.posts.items.find(item => (item.dbId || item.id) === postId));
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        getOwnerLibraryPost(postId).then(value => active && setDetail(value)).catch(loadError => active && setError(loadError.message));
        return () => { active = false; };
    }, [postId]);

    if (error) return <div className="flow-page px-1 sm:px-2"><p className="flow-panel p-5 text-destructive">{error}</p></div>;
    if (!detail) return <div className="flow-page flex min-h-[18rem] items-center justify-center text-[#615d59]"><Loader2 className="animate-spin" size={22} /> <span className="ml-2">載入來源與知識脈絡…</span></div>;
    const { post, source_revision: source, learning_note: note, topic_links: links = [], topic_revisions: revisions = [], project_references: references = [], candidates = [] } = detail;
    const acceptedTopics = [...new Set([...links.map(item => item.topic?.label), ...revisions.map(item => item.topic?.label)].filter(Boolean))];
    const sourcePayload = source?.source_payload || {};
    const images = libraryPost?.images || sourcePayload.media?.filter(item => item?.type === 'image').map(item => item.url).filter(Boolean) || [];
    const comments = libraryPost?.comments || sourcePayload.comments || [];

    return <div className="flow-page mx-auto max-w-4xl px-1 sm:px-2">
        <Link to="/view-all" className="inline-flex items-center gap-2 text-sm text-[#615d59] hover:text-[var(--accent)]"><ArrowLeft size={16} />回到所有貼文</Link>
        <header className="mt-6 border-b notion-whisper-border pb-6">
            <p className="flow-kicker mb-2">來源詳情 · {!source ? '歷史來源，尚無版本化證據' : source.capture_quality === 'partial' ? '來源不完整' : '來源完整'}</p>
            <h1 className="text-3xl font-bold tracking-[-0.05em]">{post?.title || '未命名來源'}</h1>
            <p className="mt-2 text-sm text-[#615d59]">{[post?.platform, post?.author_name].filter(Boolean).join(' · ') || '來源資訊未完整記錄'}</p>
            <p className="mt-3 text-sm leading-6 text-[#615d59]">目前階段：回看來源與知識脈絡。下一步：若仍有黃色候選，回到收件匣完成你的決定。</p>
            {post?.original_url && <a href={post.original_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline">開啟原始連結 <ExternalLink size={14} /></a>}
        </header>

        <section className="mt-7 flow-surface p-5"><div className="flex items-center gap-2"><BookOpenText size={18} className="text-[var(--accent)]" /><h2 className="font-semibold">原始貼文</h2></div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#615d59]">{post?.content || '原始來源未提供內文。'}</p></section>

        {images.length > 0 && <section className="mt-5 flow-surface p-5"><div className="flex items-center gap-2"><ImageIcon size={18} className="text-[var(--accent)]" /><h2 className="font-semibold">貼文媒體</h2><span className="text-xs text-[#615d59]">{images.length} 個檔案</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{images.map((url, index) => <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[0.75rem] border notion-whisper-border bg-black/5"><img src={url} alt={`貼文媒體 ${index + 1}`} className="max-h-[30rem] w-full object-cover" loading="lazy" /></a>)}</div></section>}

        {comments.length > 0 && <section className="mt-5 flow-surface p-5"><div className="flex items-center gap-2"><MessageCircle size={18} className="text-[var(--accent)]" /><h2 className="font-semibold">已擷取留言</h2><span className="text-xs text-[#615d59]">{comments.length} 則</span></div><div className="mt-4 divide-y divide-black/5">{comments.map((comment, index) => <article key={`${comment.id || comment.user || comment.author_name || 'comment'}-${index}`} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-medium">{comment.user || comment.author_name || '未命名帳號'}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#615d59]">{comment.text || comment.content || '留言內容未完整記錄。'}</p></article>)}</div></section>}

        <section className="mt-5 flow-surface p-5"><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-emerald-600" /><h2 className="font-semibold">已接受的知識</h2></div>
            {note?.note_status === 'recorded' ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{note.content}</p> : <p className="mt-3 text-sm text-[#615d59]">這篇貼文目前沒有已接受的個人學習筆記。</p>}
            {acceptedTopics.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{acceptedTopics.map(label => <span key={label} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800"><Tag size={12} className="mr-1 inline" />{label}</span>)}</div>}
            {revisions.map(revision => <div key={revision.id || `${revision.topic?.label}-${revision.summary}`} className="mt-4 border-l-2 border-emerald-200 pl-4"><p className="text-sm font-semibold">{revision.topic?.label}</p><p className="mt-1 text-sm leading-6 text-[#615d59]">{revision.summary}</p></div>)}
            {references.map(reference => <div key={reference.id || `${reference.topic?.label}-${reference.project?.title}`} className="mt-4 text-sm"><span className="font-semibold">可參考專案：</span>{reference.project?.title || '未命名專案'}{reference.rationale && <span className="text-[#615d59]"> — {reference.rationale}</span>}</div>)}
        </section>

        {candidates.length > 0 && <section className="mt-5 border border-amber-200 bg-amber-50/60 p-5 rounded-[0.8rem]"><div className="flex items-center gap-2 text-amber-900"><Lightbulb size={18} /><h2 className="font-semibold">尚待你確認的候選</h2></div><p className="mt-2 text-sm leading-6 text-amber-900/75">這些不是正式知識，不會被當成已接受內容使用。</p><div className="mt-3 flex flex-wrap gap-2">{candidates.map(candidate => <span key={candidate.id || candidate.proposal_type} className="rounded-full border border-amber-300 px-3 py-1 text-xs text-amber-900">{candidateLabel(candidate.proposal_type)}</span>)}</div><Link to="/" className="mt-4 inline-block text-sm font-semibold text-amber-900 underline">回到收件匣處理下一步</Link></section>}
    </div>;
}
