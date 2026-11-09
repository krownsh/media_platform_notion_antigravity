import React, { useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink, FolderInput, Globe, Image as ImageIcon, MoreHorizontal, Trash2 } from 'lucide-react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import AuthorInitialAvatar from './AuthorInitialAvatar';
import './LibraryPostCard.css';
import './LibraryPostCardActions.css';

const postId = (post) => post.dbId || post.id;
const collectionId = (post) => post.collectionId || post.collection_id || null;
const postDate = (post) => { const value = post.createdAt || post.created_at || post.capturedAt; const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' }) : '剛剛'; };

export default function LibraryPostCard({ post, collections, onOpen, onMove, onDelete }) {
    const [showMenu, setShowMenu] = useState(false);
    const [showMoveMenu, setShowMoveMenu] = useState(false);
    const currentCollectionId = collectionId(post);
    const folder = collections.find((item) => item.id === currentCollectionId);
    const images = useMemo(() => post.images?.filter(Boolean) || (post.screenshot ? [post.screenshot] : []), [post.images, post.screenshot]);
    const content = post.content || post.title || '這篇來源尚未保留可顯示文字。';
    const author = post.author || post.author_name || 'Unknown';
    const authorHandle = post.authorHandle || post.author_handle || 'unknown';
    const platform = String(post.platform || 'web').toUpperCase();
    const sourceDomains = Array.isArray(post.sourceDomains) ? post.sourceDomains.slice(0, 2) : [];
    const move = (event, targetCollectionId) => { event.stopPropagation(); onMove(postId(post), targetCollectionId || null); setShowMenu(false); setShowMoveMenu(false); };
    const remove = (event) => { event.stopPropagation(); onDelete?.(postId(post)); setShowMenu(false); setShowMoveMenu(false); };

    return <Motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, ease: [0.16, 1, .3, 1] }} onClick={onOpen} className="library-source-card">
        <header><span className="library-source-platform">{platform}</span><span className="library-source-folder">{folder?.name || 'INBOX'}</span>{(post.originalUrl || post.original_url) && <a href={post.originalUrl || post.original_url} target="_blank" rel="noreferrer" className="library-source-external" onClick={(event) => event.stopPropagation()} aria-label="開啟原始貼文" title="開啟原始貼文"><ExternalLink size={15} /></a>}<button type="button" aria-label="開啟貼文選項" aria-expanded={showMenu} onClick={(event) => { event.stopPropagation(); setShowMenu((value) => !value); }}><MoreHorizontal size={18} /></button></header>
        <div className={`library-source-visual ${images.length ? 'has-image' : ''}`}>{images.length ? <img src={images[0]} alt="貼文媒體預覽" /> : <><Globe size={28} /><span>{platform}</span></>}{images.length > 1 && <b>1 / {images.length}</b>}</div>
        <div className="library-source-body"><div className="library-source-author"><AuthorInitialAvatar name={author} size="sm" /><div><strong>{author}</strong><span>@{authorHandle}</span></div></div><h3>{post.title || post.analysis?.generated_title || content}</h3><p>{content.replace(/\n\s*\n/g, '\n').trim()}</p></div>
        <footer><div>{sourceDomains.map((domain) => <span key={domain}>{domain}</span>)}</div><div><select value={currentCollectionId || ''} onClick={(event) => event.stopPropagation()} onChange={(event) => move(event, event.target.value)} aria-label={`直接選擇「${author}」貼文的資料夾分類`}><option value="">Inbox</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select><time>{postDate(post)}</time></div></footer>
        <AnimatePresence>{showMenu && <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(event) => event.stopPropagation()} className="library-source-menu"><div><strong>{showMoveMenu ? '選擇資料夾' : '貼文選項'}</strong><button type="button" onClick={() => { setShowMenu(false); setShowMoveMenu(false); }} aria-label="關閉貼文選項">×</button></div>{showMoveMenu ? <section><button type="button" onClick={() => setShowMoveMenu(false)}><ChevronLeft size={15} />返回選項</button><button type="button" onClick={(event) => move(event, null)}>Inbox</button>{collections.map((collection) => <button key={collection.id} type="button" onClick={(event) => move(event, collection.id)}>{collection.name}</button>)}</section> : <section><button type="button" onClick={() => setShowMoveMenu(true)}><FolderInput size={16} />移至資料夾</button><button type="button" className="is-delete" onClick={remove}><Trash2 size={16} />刪除此貼文</button></section>}</Motion.div>}</AnimatePresence>
    </Motion.article>;
}
