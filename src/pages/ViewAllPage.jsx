import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import { fetchPosts } from '../features/postsSlice';
import PostCard from '../components/PostCard';
import { Layers } from 'lucide-react';

const ViewAllPage = ({ onRemix, onPostClick }) => {
    const { items, collections, loading } = useSelector((state) => state.posts);
    const dispatch = useDispatch();
    const { collectionId } = useParams();

    useEffect(() => {
        if (items.length === 0) {
            dispatch(fetchPosts());
        }
    }, [dispatch, items.length]);

    // Filter posts based on route (View All vs Collection)
    let displayedPosts = items;
    let title = "All Posts";

    if (collectionId) {
        const collection = collections.find(c => c.id === collectionId);
        if (collection) {
            displayedPosts = items.filter(p => p.collectionId === collectionId);
            title = collection.name;
        } else {
            // Handle case where collection is not found (maybe redirect or show empty)
            displayedPosts = [];
            title = "Collection Not Found";
        }
    }

    // Sort by createdAt desc (default)
    displayedPosts = [...displayedPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return (
        <div className="w-full mx-auto px-4 pb-20">
            <div className="flex items-center gap-3 mb-8 pt-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Layers className="text-blue-400" size={24} />
                </div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                <span className="text-gray-500 text-sm ml-2">
                    {displayedPosts.length} {displayedPosts.length === 1 ? 'post' : 'posts'}
                </span>
            </div>

            {loading ? (
                <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-6 justify-center">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-card rounded-2xl overflow-hidden animate-pulse w-[360px] h-[560px] bg-white/5" />
                    ))}
                </div>
            ) : displayedPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <p className="text-lg font-medium">No posts found</p>
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-6 justify-center">
                    {displayedPosts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onRemix={onRemix}
                            onClick={() => onPostClick(post)}
                            onDelete={() => { }} // Add delete handler if needed
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ViewAllPage;
