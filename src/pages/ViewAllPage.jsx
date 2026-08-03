import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPosts } from '../features/postsSlice';
import PostCard from '../components/PostCard';
import { Search, Filter, SearchX } from 'lucide-react';

const CATEGORIES = [
    { value: 'all', label: '全部類別' },
    { value: 'ai', label: '人工智慧' },
    { value: 'tool', label: '開發工具' },
    { value: 'market', label: '市場動態' },
    { value: 'security', label: '資安情報' },
    { value: 'opinion', label: '觀點評論' },
    { value: 'research', label: '深度研究' },
    { value: 'launch', label: '產品發布' },
    { value: 'other', label: '其他' }
];

const ViewAllPage = ({ onRemix }) => {
    const { items, collections, loading, initialized } = useSelector((state) => state.posts);
    const dispatch = useDispatch();
    const { collectionId } = useParams();
    const navigate = useNavigate();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    useEffect(() => {
        if (!initialized && !loading) {
            dispatch(fetchPosts());
        }
    }, [dispatch, initialized, loading]);

    // 1. Base Filter (Collection)
    let displayedPosts = items;
    let title = "所有貼文";

    if (collectionId) {
        const collection = collections.find(c => c.id === collectionId);
        if (collection) {
            displayedPosts = items.filter(p => p.collectionId === collectionId);
            title = collection.name;
        } else {
            displayedPosts = [];
            title = "找不到收藏夾";
        }
    }

    // 2. Search Filter (全域檢索)
    if (searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase();
        displayedPosts = displayedPosts.filter(post => {
            const contentMatch = post.content?.toLowerCase().includes(lowerQuery);
            const authorMatch = post.author?.toLowerCase().includes(lowerQuery);
            const summaryMatch = typeof post.analysis?.summary === 'string' && post.analysis.summary.toLowerCase().includes(lowerQuery);
            return contentMatch || authorMatch || summaryMatch;
        });
    }

    // 3. Category Filter (分類過濾)
    if (selectedCategory !== 'all') {
        displayedPosts = displayedPosts.filter(post => {
            const cat = post.analysis?.primary_category || 'other';
            return cat === selectedCategory;
        });
    }

    // 4. Sort by createdAt desc (default)
    displayedPosts = [...displayedPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <div className="flow-page px-1 sm:px-2">
            <div className="flex flex-col xl:flex-row items-start xl:items-end justify-between gap-5 mb-7 sm:mb-9 pt-5 sm:pt-8 md:pt-12">
                <div>
                    <p className="flow-kicker mb-2">知識庫</p>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h1 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em] text-[rgba(0,0,0,0.95)] break-words">{title}</h1>
                        <span className="text-[#615d59] text-sm font-medium tabular-nums">
                            {displayedPosts.length} 篇貼文
                        </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#615d59]">用來源、分類與摘要快速定位，進一步整理成主題、內容或實作線索。</p>
                </div>

                {/* 檢索與過濾區塊 */}
                <div className="flow-surface flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full xl:w-auto p-2">
                    {/* Search Bar */}
                    <div className="relative group flex-1 sm:w-72 min-w-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#615d59]/70 group-focus-within:text-[var(--accent)] transition-colors" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="全文搜尋 (作者/內容/總結)"
                            className="w-full bg-transparent border border-transparent hover:bg-black/[0.025] focus:border-[var(--accent)] focus:bg-surface-raised rounded-md pl-9 pr-4 py-2.5 text-sm text-[rgba(0,0,0,0.95)] focus:outline-none transition-[background-color,border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                            aria-label="搜尋貼文"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="relative flex-shrink-0 w-full sm:w-auto border-t sm:border-t-0 sm:border-l notion-whisper-border pt-2 sm:pt-0 sm:pl-2">
                        <Filter className="absolute left-3 sm:left-5 top-[calc(50%+0.25rem)] sm:top-1/2 -translate-y-1/2 text-[#615d59]/70 pointer-events-none" size={14} />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="appearance-none bg-transparent border border-transparent hover:bg-black/[0.025] focus:border-[var(--accent)] focus:bg-surface-raised rounded-md pl-9 sm:pl-10 pr-10 py-2.5 text-sm text-[rgba(0,0,0,0.95)] focus:outline-none transition-[background-color,border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_var(--accent-soft)] font-medium cursor-pointer w-full sm:w-auto"
                            aria-label="依類別篩選貼文"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flow-surface flow-shimmer h-[27rem] w-full" />
                    ))}
                </div>
            ) : displayedPosts.length === 0 ? (
                <div className="flow-panel flex min-h-[22rem] flex-col items-center justify-center px-6 py-16 text-center text-[#615d59]">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1rem] bg-[var(--accent-soft)] text-[var(--accent)]">
                        <SearchX size={26} />
                    </div>
                    <p className="text-base font-semibold text-[rgba(0,0,0,0.95)]">沒有符合條件的貼文</p>
                    <p className="mt-2 max-w-sm text-sm leading-6">調整搜尋字詞或篩選條件，也可以清除限制後重新查看全部收藏。</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {displayedPosts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onRemix={onRemix}
                            onClick={() => navigate(`/post/${post.dbId || post.id}`)}
                            onDelete={() => { }} // Add delete handler if needed
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewAllPage;
