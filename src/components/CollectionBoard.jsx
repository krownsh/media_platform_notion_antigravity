import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { reorderPosts, fetchPosts, deletePost, createCollection, addToCollection, updateCollectionName } from '../features/postsSlice';
import SortablePostCard from './SortablePostCard';
import { Layers } from 'lucide-react';

const CollectionBoard = ({ onRemix, onPostClick }) => {
    const { items, loading } = useSelector((state) => state.posts);
    const dispatch = useDispatch();

    const [activeId, setActiveId] = useState(null);
    const [mergeTargetId, setMergeTargetId] = useState(null);
    const hoverTimerRef = useRef(null);
    const lastOverIdRef = useRef(null);

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

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event) => {
        const { active, over } = event;

        if (!over || active.id === over.id) {
            resetMergeTimer();
            return;
        }

        if (over.id !== lastOverIdRef.current) {
            resetMergeTimer();
            lastOverIdRef.current = over.id;

            // Start timer for merge
            hoverTimerRef.current = setTimeout(() => {
                setMergeTargetId(over.id);
            }, 2000);
        }
    };

    const resetMergeTimer = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setMergeTargetId(null);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        // Capture merge target before resetting
        const currentMergeTargetId = mergeTargetId;

        resetMergeTimer();
        lastOverIdRef.current = null;
        setActiveId(null);

        if (!over) return;

        // Check if we were in a merge state (hovered for 2s)
        // We check currentMergeTargetId which was set by the timer
        // Also ensure we are still over that target
        if (currentMergeTargetId === over.id && active.id !== over.id) {
            const targetItem = items.find(i => i.id === over.id);
            if (targetItem) {
                if (targetItem.type === 'collection') {
                    dispatch(addToCollection({ sourceId: active.id, targetId: over.id }));
                } else {
                    dispatch(createCollection({ sourceId: active.id, targetId: over.id }));
                }
            }
            return;
        }

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

    const handleRename = (collectionId, name) => {
        dispatch(updateCollectionName({ collectionId, name }));
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
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(item => item.id)}
                strategy={rectSortingStrategy}
            >
                <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-4 justify-center">
                    {items.map((post) => (
                        <div
                            key={post.id}
                            className={`transition-all duration-300 rounded-2xl ${mergeTargetId === post.id ? 'ring-2 ring-blue-500 scale-105 z-10' : ''}`}
                        >
                            <SortablePostCard
                                post={post}
                                onRemix={onRemix}
                                onClick={() => post.type === 'collection' ? null : onPostClick(post)}
                                onDelete={() => handleDelete(post.id)}
                                onRename={handleRename}
                            />
                        </div>
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
