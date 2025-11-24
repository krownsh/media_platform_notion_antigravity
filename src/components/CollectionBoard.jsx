import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { reorderPosts, fetchPosts, deletePost } from '../features/postsSlice';
import SortablePostCard from './SortablePostCard';
import { Layers } from 'lucide-react';

const CollectionBoard = ({ onRemix, onPostClick }) => {
    const { items, loading } = useSelector((state) => state.posts);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(fetchPosts());
    }, [dispatch]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            dispatch(reorderPosts({ oldIndex, newIndex }));
        }
    };

    const handleDelete = (postId) => {
        if (window.confirm('Are you sure you want to delete this post?')) {
            dispatch(deletePost(postId));
        }
    };

    if (items.length === 0 && !loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Layers size={32} className="opacity-50" />
                </div>
                <p className="text-lg font-medium">Your collection is empty</p>
                <p className="text-sm">Paste a URL above to start building your knowledge base.</p>
            </div>
        );
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(item => item.id)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-4 justify-center">
                    {items.map((post) => (
                        <SortablePostCard
                            key={post.id}
                            post={post}
                            onRemix={onRemix}
                            onClick={() => onPostClick(post)}
                            onDelete={() => handleDelete(post.id)}
                        />
                    ))}

                    {/* Loading Skeleton Card */}
                    {loading && (
                        <div className="glass-card rounded-2xl overflow-hidden animate-pulse w-[360px]">
                            <div className="aspect-[4/5] bg-white/5" />
                            <div className="p-4 space-y-3">
                                <div className="h-4 bg-white/5 rounded w-3/4" />
                                <div className="h-3 bg-white/5 rounded w-full" />
                                <div className="h-3 bg-white/5 rounded w-1/2" />
                            </div>
                        </div>
                    )}
                </div>
            </SortableContext>
        </DndContext>
    );
};

export default CollectionBoard;
