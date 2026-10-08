import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, LayoutGrid, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPosts, movePostToCollection } from '../features/postsSlice';
import { visibleCollections } from '../utils/collectionVisibility';
import { matchesWorkflowFilter, WORKFLOW_FILTER_OPTIONS } from '../utils/workflowPresentation';

const CATEGORIES = [
    { value: 'all', label: '全部類別' },
    { value: 'ai', label: '人工智慧' },
    { value: 'tool', label: '開發工具' },
    { value: 'market', label: '市場動態' },
    { value: 'security', label: '資安情報' },
    { value: 'opinion', label: '觀點評論' },
    { value: 'research', label: '深度研究' },
    { value: 'launch', label: '產品發布' },
    { value: 'productivity', label: '生產力' },
    { value: 'design', label: '設計' },
    { value: 'crypto', label: '加密資產' },
    { value: 'other', label: '其他' }
];

function getPostId(post) { return post.dbId || post.id; }
function getCollectionId(post) { return post.collectionId || post.collection_id || null; }
function getTitle(post) { return post.title || post.analysis?.generated_title || post.author || '未命名來源'; }
function getSummary(post) { return post.content || post.analysis?.summary || '這篇來源尚沒有可顯示的文字摘要。'; }
function getDate(post) {
    const value = post.createdAt || post.created_at || post.capturedAt;
    if (!value) return '日期未記錄';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '日期未記錄' : date.toLocaleDateString('zh-TW');
}

export default function AllPostsPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { collectionId } = useParams();
    const { items, collections, loading, refreshing, initialized, error } = useSelector(state => state.posts);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('all');
    const [workflow, setWorkflow] = useState('all');
    const folders = useMemo(() => visibleCollections(collections), [collections]);
    const activeCollection = folders.find(folder => folder.id === collectionId);

    useEffect(() => {
        if (!initialized) dispatch(fetchPosts());
    }, [dispatch, initialized]);

    const posts = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return [...items]
            .filter(post => !collectionId || getCollectionId(post) === collectionId)
            .filter(post => category === 'all' || (post.analysis?.primary_category || 'other') === category)
            .filter(post => workflow === 'all' || matchesWorkflowFilter(post.workflow, workflow))
            .filter(post => !normalizedQuery || [post.content, post.author, post.title, post.analysis?.summary, post.analysis?.generated_title]
                .filter(value => typeof value === 'string')
                .some(value => value.toLowerCase().includes(normalizedQuery)))
            .sort((left, right) => new Date(right.createdAt || right.created_at || 0) - new Date(left.createdAt || left.created_at || 0));
    }, [items, collectionId, category, workflow, query]);

    const heading = collectionId ? activeCollection?.name || '找不到收藏夾' : '所有貼文';

    return <div className="flow-page px-1 sm:px-2">
        <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 pt-5 sm:pt-8 md:pt-12">
            <div>
                <p className="flow-kicker mb-2">收藏庫</p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em]">{heading}</h1>
                    <span className="text-sm font-medium tabular-nums text-[#615d59]">{posts.length} 篇貼文</span>
                </div>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#615d59]">這是你完整的可回看收藏庫。資料夾只負責整理；Topic 與候選審核仍維持各自的知識流程。</p>
            </div>
            <div className="flex items-center gap-2">
                <Link to="/library" className="notion-btn-secondary px-3 py-2 text-sm">資料夾管理</Link>
                <button onClick={() => dispatch(fetchPosts())} disabled={loading || refreshing} className="notion-btn-secondary px-3 py-2 text-sm disabled:opacity-60">{refreshing ? '更新中…' : '重新整理'}</button>
            </div>
        </header>

        <section className="mt-7 flow-surface p-2 sm:p-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <label className="relative block">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#615d59]" />
                    <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
                        if (event.key === 'Enter' && query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
                    }} className="notion-input w-full pl-9" placeholder="在這批貼文內搜尋；Enter 使用記憶搜尋" aria-label="搜尋貼文" />
                </label>
                <label className="relative">
                    <SlidersHorizontal size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#615d59]" />
                    <select value={category} onChange={event => setCategory(event.target.value)} className="notion-input w-full min-w-36 pl-8" aria-label="依類別篩選">
                        {CATEGORIES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <select value={workflow} onChange={event => setWorkflow(event.target.value)} className="notion-input w-full min-w-36" aria-label="依流程狀態篩選">
                    {WORKFLOW_FILTER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </div>
        </section>

        {error && <p role="alert" className="mt-5 flow-panel border-destructive/30 p-4 text-sm text-destructive">無法讀取收藏庫：{error}</p>}
        {!initialized || loading ? <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map(index => <div key={index} className="flow-surface flow-shimmer h-64" />)}</div> : posts.length === 0 ? <div className="mt-6 flow-panel flex min-h-64 flex-col items-center justify-center px-6 text-center"><SearchX size={28} className="text-[var(--accent)]" /><p className="mt-4 font-semibold">沒有符合條件的貼文</p><p className="mt-2 text-sm text-[#615d59]">調整篩選條件，或回到所有貼文重新查看。</p></div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map(post => <article key={getPostId(post)} className="flow-panel flex min-h-64 flex-col p-5 transition-shadow hover:shadow-soft-card">
                <div className="flex items-center justify-between gap-3 text-xs text-[#615d59]"><span className="truncate">{post.platform || '來源'}{post.author ? ` · ${post.author}` : ''}</span><span className="shrink-0">{getDate(post)}</span></div>
                <button type="button" onClick={() => navigate(`/post/${getPostId(post)}`)} className="mt-3 text-left text-lg font-semibold leading-6 hover:text-[var(--accent)]"><span className="line-clamp-2">{getTitle(post)}</span></button>
                <p className="mt-3 line-clamp-5 text-sm leading-6 text-[#615d59]">{getSummary(post)}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <Link to={`/post/${getPostId(post)}`} className="text-sm font-semibold text-[var(--accent)] hover:underline">查看貼文</Link>
                    <select value={getCollectionId(post) || ''} onChange={event => dispatch(movePostToCollection({ postId: getPostId(post), collectionId: event.target.value || null }))} className="notion-input max-w-36 py-1.5 text-xs" aria-label={`移動「${getTitle(post)}」到資料夾`}>
                        <option value="">Inbox</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                    </select>
                </div>
            </article>)}
        </div>}
    </div>;
}
