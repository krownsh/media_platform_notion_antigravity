import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Inbox, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createCollection, fetchPosts, movePostToCollection } from '../features/postsSlice';
import { visibleCollections } from '../utils/collectionVisibility';

function postId(post) { return post.dbId || post.id; }
function postCollectionId(post) { return post.collectionId || post.collection_id || null; }
function postTitle(post) { return post.title || post.analysis?.generated_title || post.author || '未命名來源'; }

export default function LibraryPage() {
    const dispatch = useDispatch();
    const { collectionId } = useParams();
    const { items, collections, loading, refreshing, initialized, error } = useSelector(state => state.posts);
    const [newFolder, setNewFolder] = useState('');
    useEffect(() => { if (!initialized) dispatch(fetchPosts()); }, [dispatch, initialized]);
    const folders = useMemo(() => visibleCollections(collections), [collections]);
    const visiblePosts = useMemo(() => collectionId ? items.filter(post => postCollectionId(post) === collectionId) : items, [items, collectionId]);
    const activeCollection = folders.find(collection => collection.id === collectionId);
    const submitFolder = event => { event.preventDefault(); const name = newFolder.trim(); if (!name) return; dispatch(createCollection({ name })); setNewFolder(''); };

    return <div className="flow-page max-w-6xl px-1 sm:px-2">
        <header className="flex flex-wrap items-end justify-between gap-4 pt-5 sm:pt-8 md:pt-12"><div><p className="flow-kicker mb-2">既有收藏與資料夾</p><h1 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em]">Library</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[#615d59]">原本的貼文與資料夾整理仍在這裡。Focus Mode 只負責候選確認，不會取代你的 Library。</p></div><button onClick={() => dispatch(fetchPosts())} disabled={loading || refreshing} className="flow-icon-button border notion-whisper-border" aria-label="重新整理 Library"><RefreshCw size={16} className={loading || refreshing ? 'animate-spin' : ''} /></button></header>
        {error && <p role="alert" className="mt-5 text-sm text-[var(--destructive)]">無法載入 Library：{error}</p>}
        <section className="mt-8 flow-panel p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">資料夾</p><p className="mt-1 text-xs text-[#615d59]">直接建立、移動是你的明確整理動作；若來源仍有待確認的資料夾候選，這個選擇會以你的選擇完成確認。</p></div><form onSubmit={submitFolder} className="flex gap-2"><input value={newFolder} onChange={event => setNewFolder(event.target.value)} placeholder="新增資料夾" className="notion-input w-40" /><button className="notion-btn-primary px-3 py-2 text-sm">新增</button></form></div><div className="mt-4 flex flex-wrap gap-3"><Link to="/library" className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${!collectionId ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'notion-whisper-border'}`}><Inbox size={16} className="mr-2 inline" />全部來源 · {items.length}</Link>{folders.map(collection => <Link key={collection.id} to={`/library/${collection.id}`} className={`rounded-[var(--radius-control)] border px-4 py-3 text-sm ${collectionId === collection.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'notion-whisper-border'}`}><FolderOpen size={16} className="mr-2 inline" />{collection.name} · {items.filter(post => postCollectionId(post) === collection.id).length}</Link>)}</div></section>
        <section className="mt-8"><div className="flex items-baseline justify-between gap-4"><div><p className="flow-kicker">來源</p><h2 className="mt-1 text-xl font-bold">{activeCollection ? activeCollection.name : '全部貼文'}</h2></div><span className="text-sm text-[#615d59]">{visiblePosts.length} 篇</span></div>{!initialized || loading ? <p className="mt-5 text-sm text-[#615d59]">正在讀取你原本的貼文與資料夾…</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visiblePosts.map(post => <article key={postId(post)} className="flow-panel flex min-h-52 flex-col p-5"><p className="text-xs text-[#615d59]">{post.platform || 'source'} · {post.createdAt ? new Date(post.createdAt).toLocaleDateString('zh-TW') : ''}</p><h3 className="mt-3 line-clamp-2 font-semibold">{postTitle(post)}</h3><p className="mt-2 line-clamp-4 text-sm leading-6 text-[#615d59]">{post.content || post.analysis?.summary || '已保存來源，尚無可顯示文字。'}</p><div className="mt-auto flex items-center justify-between gap-2 pt-4"><Link to={`/post/${postId(post)}`} className="notion-btn-secondary px-3 py-1.5 text-xs">查看來源</Link><select value={postCollectionId(post) || ''} onChange={event => dispatch(movePostToCollection({ postId: postId(post), collectionId: event.target.value || null }))} className="notion-input max-w-36 py-1.5 text-xs" aria-label={`移動「${postTitle(post)}」到資料夾`} title="這是你的明確資料夾選擇；若來源有待確認候選，會以此完成確認。"><option value="">Inbox</option>{folders.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></div></article>)}</div>}{initialized && !loading && !visiblePosts.length && <p className="mt-5 text-sm text-[#615d59]">這個範圍內還沒有貼文。</p>}</section>
    </div>;
}
