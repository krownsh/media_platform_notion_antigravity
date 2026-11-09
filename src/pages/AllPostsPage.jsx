import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderCog, RefreshCw, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPosts, movePostToCollection, deletePost } from '../features/postsSlice';
import { visibleCollections } from '../utils/collectionVisibility';
import LibraryPostCard from '../components/LibraryPostCard';
import './AllPostsPage.css';
import './LibraryGridOverride.css';
import './ListLoadMore.css';

const PAGE_SIZE = 24;
const getPostId = (post) => post.dbId || post.id;

export default function AllPostsPage() {
    const dispatch = useDispatch(); const navigate = useNavigate(); const { collectionId } = useParams(); const sentinelRef = useRef(null);
    const { items, collections, loading, refreshing, loadingMore, initialized, activeListKey, hasMore, nextOffset, total, error } = useSelector((state) => state.posts);
    const [query, setQuery] = useState(''); const [platform, setPlatform] = useState('all'); const listKey = collectionId ? `collection:${collectionId}` : 'all';
    const folders = useMemo(() => visibleCollections(collections), [collections]); const activeCollection = folders.find((folder) => folder.id === collectionId);
    const platforms = useMemo(() => [...new Set(items.map((post) => String(post.platform || 'unknown').toLowerCase()))].sort(), [items]);
    useEffect(() => { if (activeListKey !== listKey || !initialized) dispatch(fetchPosts({ limit: PAGE_SIZE, collectionId: collectionId || '', listKey })); }, [activeListKey, collectionId, dispatch, initialized, listKey]);
    const loadMore = useCallback(() => { if (hasMore && !loadingMore && !loading) dispatch(fetchPosts({ offset: nextOffset, limit: PAGE_SIZE, append: true, collectionId: collectionId || '', listKey })); }, [collectionId, dispatch, hasMore, listKey, loading, loadingMore, nextOffset]);
    useEffect(() => { const node = sentinelRef.current; if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return undefined; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { rootMargin: '320px' }); observer.observe(node); return () => observer.disconnect(); }, [hasMore, loadMore]);
    const posts = useMemo(() => { const normalizedQuery = query.trim().toLowerCase(); return [...items].filter((post) => platform === 'all' || String(post.platform || 'unknown').toLowerCase() === platform).filter((post) => !normalizedQuery || [post.content, post.author, post.title].filter((value) => typeof value === 'string').some((value) => value.toLowerCase().includes(normalizedQuery))); }, [items, platform, query]);
    const heading = collectionId ? activeCollection?.name || '找不到收藏夾' : '所有貼文';
    const visibleCount = total || items.length;
    return <div className="library-editorial-page"><header className="library-editorial-head"><div><p>LIBRARY / {collectionId ? 'FOLDER' : 'ALL SOURCES'}</p><div><h1>{heading}</h1><span>{visibleCount} 篇</span></div><strong>每次只讀取 24 篇來源；往下捲動時會自動載入更多。</strong></div><div className="library-editorial-actions"><Link to="/library"><FolderCog size={16} />資料夾管理</Link><button type="button" onClick={() => dispatch(fetchPosts({ limit: PAGE_SIZE, collectionId: collectionId || '', listKey }))} disabled={loading || refreshing}><RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />{refreshing ? '更新中' : '重新整理'}</button></div></header><section className="library-editorial-filter"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`); }} placeholder="篩選已載入來源；Enter 使用記憶搜尋" aria-label="搜尋貼文" /></label><label className="library-editorial-select"><SlidersHorizontal size={15} /><select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="依來源平台篩選"><option value="all">全部來源平台</option>{platforms.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></section>{error && <p role="alert" className="library-editorial-error">無法讀取收藏庫：{error}</p>}{(!initialized || loading) && activeListKey !== listKey ? <div className="library-editorial-loading">{[1, 2, 3].map((index) => <div key={index} />)}</div> : posts.length === 0 ? <div className="library-editorial-empty"><SearchX size={29} /><h2>沒有符合條件的貼文</h2><p>調整搜尋或篩選條件，或按 Enter 使用記憶搜尋。</p></div> : <><section className="library-editorial-grid">{posts.map((post) => <LibraryPostCard key={getPostId(post)} post={post} collections={folders} onOpen={() => navigate(`/post/${getPostId(post)}`)} onMove={(postId, nextCollectionId) => dispatch(movePostToCollection({ postId, collectionId: nextCollectionId }))} onDelete={(postId) => dispatch(deletePost(postId))} />)}</section><div className="library-load-more" ref={sentinelRef}>{loadingMore ? '正在載入更多來源…' : hasMore ? <button type="button" onClick={loadMore}>載入更多</button> : <span>已顯示全部 {visibleCount} 篇來源</span>}</div></>}</div>;
}
