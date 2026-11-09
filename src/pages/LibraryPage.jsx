import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, FolderOpen, Inbox, Plus, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createCollection, fetchPosts, movePostToCollection } from '../features/postsSlice';
import { visibleCollections } from '../utils/collectionVisibility';
import './LibraryPage.css';
import './ListLoadMore.css';

const PAGE_SIZE = 24;
const postId = (post) => post.dbId || post.id;
const postCollectionId = (post) => post.collectionId || post.collection_id || null;
const postTitle = (post) => post.title || post.analysis?.generated_title || post.author || '未命名來源';

export default function LibraryPage() {
    const dispatch = useDispatch(); const { collectionId } = useParams(); const sentinelRef = useRef(null);
    const { items, collections, loading, refreshing, loadingMore, initialized, activeListKey, hasMore, nextOffset, total, error } = useSelector((state) => state.posts);
    const [newFolder, setNewFolder] = useState(''); const listKey = collectionId ? `collection:${collectionId}` : 'all';
    const folders = useMemo(() => visibleCollections(collections), [collections]); const activeCollection = folders.find((collection) => collection.id === collectionId);
    useEffect(() => { if (activeListKey !== listKey || !initialized) dispatch(fetchPosts({ limit: PAGE_SIZE, collectionId: collectionId || '', listKey })); }, [activeListKey, collectionId, dispatch, initialized, listKey]);
    const loadMore = useCallback(() => { if (hasMore && !loading && !loadingMore) dispatch(fetchPosts({ offset: nextOffset, limit: PAGE_SIZE, append: true, collectionId: collectionId || '', listKey })); }, [collectionId, dispatch, hasMore, listKey, loading, loadingMore, nextOffset]);
    useEffect(() => { const node = sentinelRef.current; if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return undefined; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { rootMargin: '300px' }); observer.observe(node); return () => observer.disconnect(); }, [hasMore, loadMore]);
    const submitFolder = (event) => { event.preventDefault(); const name = newFolder.trim(); if (!name) return; dispatch(createCollection({ name })); setNewFolder(''); };
    const folderCount = (folder) => Number.isInteger(folder.postCount) ? folder.postCount : items.filter((post) => postCollectionId(post) === folder.id).length;
    const displayedTotal = total || items.length;
    return <div className="folders-editorial-page"><header className="folders-editorial-head"><div><p>LIBRARY / FOLDERS</p><h1>資料夾管理</h1><strong>資料夾只幫你整理來源；列表每次讀取 24 篇，向下捲動可繼續載入。</strong></div><button type="button" onClick={() => dispatch(fetchPosts({ limit: PAGE_SIZE, collectionId: collectionId || '', listKey }))} disabled={loading || refreshing} aria-label="重新整理資料夾"><RefreshCw size={17} className={loading || refreshing ? 'is-spinning' : ''} /></button></header>{error && <p role="alert" className="folders-editorial-error">無法載入資料夾：{error}</p>}<section className="folders-editorial-control"><div><p>建立新資料夾</p><span>這是你的明確整理動作；若存在候選，會以你的選擇完成確認。</span></div><form onSubmit={submitFolder}><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="例如：產品靈感" aria-label="新增資料夾" /><button><Plus size={16} />新增</button></form></section><section className="folders-editorial-tabs" aria-label="資料夾篩選"><Link to="/library" className={!collectionId ? 'is-active' : ''}><Inbox size={16} />全部來源 <b>{displayedTotal}</b></Link>{folders.map((collection) => <Link key={collection.id} to={`/library/${collection.id}`} className={collectionId === collection.id ? 'is-active' : ''}><FolderOpen size={16} />{collection.name} <b>{folderCount(collection)}</b></Link>)}</section><section className="folders-editorial-sources"><header><div><p>來源</p><h2>{activeCollection ? activeCollection.name : '全部貼文'}</h2></div><span>{displayedTotal} 篇</span></header>{(!initialized || loading) && activeListKey !== listKey ? <p className="folders-editorial-loading">正在讀取來源與資料夾…</p> : <><div className="folders-editorial-list">{items.map((post) => <article key={postId(post)}><div><p>{post.platform || 'SOURCE'} · {post.createdAt ? new Date(post.createdAt).toLocaleDateString('zh-TW') : '已保存'}</p><h3>{postTitle(post)}</h3><span>{post.content || post.analysis?.summary || '已保存來源，尚無可顯示文字。'}</span></div><div className="folders-editorial-row-actions"><Link to={`/post/${postId(post)}`}>查看來源 <ArrowUpRight size={14} /></Link><select value={postCollectionId(post) || ''} onChange={(event) => dispatch(movePostToCollection({ postId: postId(post), collectionId: event.target.value || null }))} aria-label={`移動「${postTitle(post)}」到資料夾`}><option value="">Inbox</option>{folders.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></div></article>)}</div>{!items.length && <p className="folders-editorial-empty">這個範圍內還沒有貼文。</p>}<div className="folders-load-more" ref={sentinelRef}>{loadingMore ? '正在載入更多來源…' : hasMore ? <button type="button" onClick={loadMore}>載入更多</button> : items.length ? <span>已顯示全部 {displayedTotal} 篇來源</span> : null}</div></>}</section></div>;
}
