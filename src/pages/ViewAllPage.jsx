import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPosts } from '../features/postsSlice';
import PostCard from '../components/PostCard';
import { Layers, Search, Filter } from 'lucide-react';

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
            const summaryMatch = post.analysis?.summary?.toLowerCase().includes(lowerQuery);
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
        <div className="w-full mx-auto px-4 pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-10 pt-8 pl-2">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-accent/10 rounded-xl">
                        <Layers className="text-accent" size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                    <span className="text-muted-foreground text-sm ml-2 font-medium">
                        {displayedPosts.length} 篇貼文
                    </span>
                </div>

                {/* 檢索與過濾區塊 */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative group flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-accent transition-colors" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="全文搜尋 (作者/內容/總結)"
                            className="w-full bg-white/50 border border-border focus:border-accent/50 focus:bg-white rounded-full pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none transition-all"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="relative flex-shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" size={14} />
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="appearance-none bg-white/50 border border-border focus:border-accent/50 focus:bg-white rounded-full pl-9 pr-10 py-2 text-sm text-foreground focus:outline-none transition-all font-medium cursor-pointer"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-8 justify-center">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-card rounded-3xl overflow-hidden animate-pulse w-[360px] h-[560px] bg-white/20" />
                    ))}
                </div>
            ) : displayedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
                    <p className="text-lg font-medium">未找到貼文</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-8 justify-center">
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
