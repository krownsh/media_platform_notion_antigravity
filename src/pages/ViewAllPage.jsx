import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchPosts } from '../features/postsSlice';
import PostCard from '../components/PostCard';
import { Layers } from 'lucide-react';

const ViewAllPage = ({ onRemix }) => {
    const { items, collections, loading } = useSelector((state) => state.posts);
    const dispatch = useDispatch();
    const { collectionId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (items.length === 0) {
            dispatch(fetchPosts());
        }
    }, [dispatch, items.length]);

    // Filter posts based on route (View All vs Collection)
    let displayedPosts = items;
    let title = "所有貼文";

    if (collectionId) {
        const collection = collections.find(c => c.id === collectionId);
        if (collection) {
            displayedPosts = items.filter(p => p.collectionId === collectionId);
            title = collection.name;
        } else {
            // Handle case where collection is not found (maybe redirect or show empty)
            displayedPosts = [];
            title = "找不到收藏夾";
        }
    }

    // Sort by createdAt desc (default)
    displayedPosts = [...displayedPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <div className="w-full mx-auto px-4 pb-20">
            <div className="flex items-center gap-3 mb-10 pt-8 pl-2">
                <div className="p-2.5 bg-accent/10 rounded-xl">
                    <Layers className="text-accent" size={24} />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                <span className="text-muted-foreground text-sm ml-2 font-medium">
                    {displayedPosts.length} 篇貼文
                </span>
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
