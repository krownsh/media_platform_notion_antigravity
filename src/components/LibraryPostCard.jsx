import React, { useMemo, useState } from 'react';
import { ExternalLink, Facebook, FileText, FolderInput, Globe, Image as ImageIcon, Instagram, MoreHorizontal, Twitter, Youtube } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import AuthorInitialAvatar from './AuthorInitialAvatar';

function platformPresentation(platform) {
    const normalized = String(platform || '').toLowerCase();
    if (normalized === 'instagram') return { icon: <Instagram size={14} className="text-pink-500" />, label: 'Instagram' };
    if (normalized === 'twitter' || normalized === 'x') return { icon: <Twitter size={14} className="text-blue-400" />, label: 'Twitter' };
    if (normalized === 'facebook') return { icon: <Facebook size={14} className="text-blue-600" />, label: 'Facebook' };
    if (normalized === 'youtube') return { icon: <Youtube size={14} className="text-red-600" />, label: 'YouTube' };
    if (normalized === 'notion') return { icon: <FileText size={14} />, label: 'Notion' };
    if (normalized === 'image') return { icon: <ImageIcon size={14} className="text-violet-600" />, label: 'Image' };
    return { icon: <Globe size={14} className="text-[#615d59]" />, label: normalized || 'Web Link' };
}

function postId(post) { return post.dbId || post.id; }
function collectionId(post) { return post.collectionId || post.collection_id || null; }
function postDate(post) {
    const value = post.createdAt || post.created_at || post.capturedAt;
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' }) : '剛剛';
}

// This keeps the visual hierarchy of the old collection card while retaining the
// current owner-guided data model: it never makes a knowledge decision itself.
export default function LibraryPostCard({ post, collections, onOpen, onMove }) {
    const [showMenu, setShowMenu] = useState(false);
    const platform = platformPresentation(post.platform);
    const postCollectionId = collectionId(post);
    const folder = collections.find(item => item.id === postCollectionId);
    const images = useMemo(() => post.images?.filter(Boolean) || (post.screenshot ? [post.screenshot] : []), [post.images, post.screenshot]);
    const content = post.content || post.title || post.analysis?.summary || '這篇來源尚未保留可顯示文字。';
    const author = post.author || post.author_name || 'Unknown';
    const authorHandle = post.authorHandle || post.author_handle || 'unknown';
    const tags = Array.isArray(post.analysis?.tags) ? post.analysis.tags.slice(0, 3) : [];
    const category = post.analysis?.primary_category || '尚未分類';

    const move = (event, targetCollectionId) => {
        event.stopPropagation();
        onMove(postId(post), targetCollectionId || null);
        setShowMenu(false);
    };

    return <Motion.article layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.25, 0.8, 0.3, 1] }} onClick={onOpen} onMouseLeave={() => setShowMenu(false)} className="notion-card group relative mx-auto flex min-h-[430px] w-full max-w-[440px] cursor-pointer flex-col overflow-hidden hover:-translate-y-0.5">
        <div className="flex w-full flex-shrink-0 items-center justify-between border-b notion-whisper-border bg-surface-raised px-3 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2"><span className="shrink-0">{platform.icon}</span><span className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-[#615d59]">{platform.label}</span><span className="h-3.5 w-px shrink-0 bg-black/10" /><span className="truncate text-[10px] font-medium leading-none text-[#615d59]/80">{folder?.name || '未分類'}</span></div>
            <div className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-semibold leading-none text-emerald-800">已保存</span><button type="button" className="flow-icon-button min-h-8 min-w-8" aria-label="開啟貼文選項" aria-expanded={showMenu} onClick={event => { event.stopPropagation(); setShowMenu(value => !value); }}><MoreHorizontal size={16} /></button></div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2.5 border-b notion-whisper-border bg-surface-raised px-3 py-2.5 sm:px-4"><AuthorInitialAvatar name={author} size="md" /><div className="min-w-0"><p className="truncate text-sm font-semibold leading-tight">{author}</p><p className="mt-0.5 truncate text-[12px] text-[#615d59]/80">@{authorHandle}</p></div></div>
        {images.length > 0 && <div className="relative flex aspect-[16/7.5] w-full flex-shrink-0 items-center justify-center overflow-hidden border-b notion-whisper-border bg-[var(--surface-muted)]"><img src={images[0]} className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]" alt="貼文媒體預覽" />{images.length > 1 && <span className="absolute right-2 top-2 rounded-md bg-black/45 px-1.5 py-1 text-[9px] tabular-nums text-white">1 / {images.length}</span>}</div>}
        <div className="flex flex-1 flex-col overflow-hidden bg-surface-raised"><div className="flex-1 overflow-hidden px-3 py-3 sm:px-4 sm:py-4"><p className="line-clamp-6 whitespace-pre-wrap text-sm font-medium leading-6 text-[rgba(0,0,0,0.95)]/80">{content.replace(/\n\s*\n/g, '\n').trim()}</p></div><footer className="mt-auto flex flex-shrink-0 flex-col gap-2 border-t notion-whisper-border bg-surface px-3 py-2.5 sm:px-4"><div className="flex min-h-5 flex-wrap items-center gap-1">{tags.map(tag => <span key={tag} className="notion-badge text-[10px] leading-none">#{tag}</span>)}</div><div className="flex items-center justify-between gap-3"><span className="truncate text-[10px] font-bold uppercase leading-none tracking-[0.05em] text-[var(--accent)]">來源標籤：{category}</span><label className="flex min-w-0 items-center gap-1 text-[10px] text-[#615d59]"><span className="shrink-0">資料夾</span><select value={postCollectionId || ''} onClick={event => event.stopPropagation()} onChange={event => move(event, event.target.value)} className="max-w-28 rounded border border-[var(--border)] bg-surface-raised px-1.5 py-1 text-[10px] text-[#615d59]" aria-label={`直接選擇「${author}」貼文的資料夾分類`}><option value="">Inbox</option>{collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label><span className="shrink-0 text-[10px] font-medium leading-none tabular-nums text-[#615d59]">{postDate(post)}</span></div></footer></div>
        <AnimatePresence>{showMenu && <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={event => event.stopPropagation()} className="absolute inset-0 z-20 flex flex-col bg-surface-raised/95 p-3 backdrop-blur-sm sm:p-4"><div className="mb-4 flex items-center justify-between"><span className="font-bold">貼文選項</span><button type="button" className="flow-icon-button min-h-8 min-w-8" onClick={() => setShowMenu(false)} aria-label="關閉貼文選項">×</button></div>{(post.originalUrl || post.original_url) && <a href={post.originalUrl || post.original_url} target="_blank" rel="noreferrer" className="notion-btn-secondary flex items-center justify-center gap-2 py-2 text-sm" onClick={event => event.stopPropagation()}><ExternalLink size={15} />開啟原始貼文</a>}<div className="mt-4 border-t notion-whisper-border pt-4"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#615d59]"><FolderInput size={14} />移至資料夾</p><button type="button" onClick={event => move(event, null)} className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm text-[#615d59] hover:bg-black/5">Inbox</button>{collections.map(collection => <button key={collection.id} type="button" onClick={event => move(event, collection.id)} className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 ${collection.id === postCollectionId ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent)]' : 'text-[#615d59]'}`}>{collection.name}</button>)}</div></Motion.div>}</AnimatePresence>
    </Motion.article>;
}
