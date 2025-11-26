
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndContext, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { reorderPosts, fetchPosts, createCollection, movePostToCollection } from '../features/postsSlice';
import SortablePostCard from './SortablePostCard';
import CollectionFolder from './CollectionFolder';
import CollectionModal from './CollectionModal';
import { Layers, Plus } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const CollectionBoard = ({ onRemix, onPostClick }) => {
    const { items, collections, loading } = useSelector((state) => state.posts);
    const dispatch = useDispatch();

    const [activeId, setActiveId] = useState(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Animation State
    const [dropAnimation, setDropAnimation] = useState(null); // { item, startRect, targetRect }

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

    // Filter posts:
    const uncategorizedPosts = items.filter(p => !p.collectionId);
    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    const selectedCollectionPosts = selectedCollection
        ? items.filter(p => p.collectionId === selectedCollection.id)
        : [];

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        const activeItemData = items.find(i => i.id === active.id);
        setActiveId(null);

        if (!over) return;

        // Case 1: Dragging a Post into a Collection Folder (Top Section)
        if (over.data.current?.type === 'collection') {
            const collectionId = over.data.current.collection.id;

            // Trigger "Suck In" Animation
            if (activeItemData && active.rect.current?.translated && over.rect) {
                setDropAnimation({
                    item: activeItemData,
                    startRect: active.rect.current.translated,
                    targetRect: over.rect
                });

                // Clear animation after it finishes (approx 500ms)
                setTimeout(() => setDropAnimation(null), 500);
            }

            dispatch(movePostToCollection({ postId: active.id, collectionId }));
            return;
        }

        // Case 2: Dragging a Post to "Remove Zone" (Inside Modal)
        if (over.id === 'remove-zone') {
            dispatch(movePostToCollection({ postId: active.id, collectionId: null }));
            return;
        }

        // Case 3: Reordering Posts (Standard DnD)
        if (active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);
            dispatch(reorderPosts({ oldIndex, newIndex }));
        }
    };

    const handleCreateCollection = (e) => {
        e.preventDefault();
        if (newCollectionName.trim()) {
            dispatch(createCollection({ name: newCollectionName }));
            setNewCollectionName('');
            setIsCreating(false);
        }
    };

    // Helper to find the active item for DragOverlay
    const activeItem = items.find(i => i.id === activeId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col gap-8 pb-20">

                {/* --- Top Section: Folders --- */}
                <div className="bg-white/40 border-b border-white/20 p-6 -mx-6 md:-mx-8 lg:-mx-12 sticky top-0 z-30 backdrop-blur-md shadow-sm">
                    <div className="max-w-[1600px] mx-auto w-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <Layers size={20} className="text-accent" />
                                收藏夾
                            </h2>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="text-sm bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-xl flex items-center gap-1 transition-all shadow-sm hover:shadow-md"
                            >
                                <Plus size={16} /> 新增資料夾
                            </button>
                        </div>

                        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                            {/* Create Input */}
                            {isCreating && (
                                <form onSubmit={handleCreateCollection} className="min-w-[160px] p-4 rounded-2xl border border-accent/30 bg-accent/5 flex flex-col items-center gap-2 shadow-inner">
                                    <input
                                        type="text"
                                        placeholder="資料夾名稱"
                                        value={newCollectionName}
                                        onChange={e => setNewCollectionName(e.target.value)}
                                        autoFocus
                                        className="w-full bg-transparent border-b border-accent/50 text-sm text-center outline-none pb-1 text-foreground placeholder-muted-foreground"
                                        onBlur={() => !newCollectionName && setIsCreating(false)}
                                    />
                                    <button type="submit" className="text-xs text-accent hover:text-accent/80 font-medium">按 Enter 鍵</button>
                                </form>
                            )}

                            {/* Folder List */}
                            {collections.map(collection => {
                                const folderPosts = items.filter(p => p.collectionId === collection.id);
                                const previewImages = folderPosts
                                    .flatMap(p => p.images || [])
                                    .slice(0, 4);

                                return (
                                    <div key={collection.id} className="min-w-[140px]">
                                        <CollectionFolder
                                            collection={collection}
                                            postCount={folderPosts.length}
                                            previewImages={previewImages}
                                            onClick={() => setSelectedCollectionId(collection.id)}
                                        />
                                    </div>
                                );
                            })}

                            {collections.length === 0 && !isCreating && (
                                <div className="text-sm text-muted-foreground italic py-4">
                                    尚無收藏夾。建立一個來整理您的貼文。
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Bottom Section: Uncategorized Posts --- */}
                <div className="max-w-[1600px] mx-auto w-full px-4">
                    <h2 className="text-lg font-semibold text-foreground mb-6 pl-3 border-l-4 border-accent/50">
                        未分類貼文
                    </h2>

                    {uncategorizedPosts.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
                            <p className="text-lg font-medium">全部都看完了！</p>
                            <p className="text-sm">所有貼文都已整理到資料夾中。</p>
                        </div>
                    ) : (
                        <SortableContext items={uncategorizedPosts.map(item => item.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-8 justify-center">
                                {uncategorizedPosts.map((post) => (
                                    <SortablePostCard
                                        key={post.id}
                                        post={post}
                                        onRemix={onRemix}
                                        onClick={() => onPostClick(post)}
                                        onDelete={() => { }}
                                        onRename={() => { }}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    )}

                    {loading && (
                        <div className="grid grid-cols-[repeat(auto-fit,360px)] gap-8 justify-center mt-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="glass-card rounded-3xl overflow-hidden animate-pulse w-[360px] h-[560px] bg-white/20" />
                            ))}
                        </div>
                    )}
                </div>

                {/* --- Modal --- */}
                {selectedCollection && (
                    <CollectionModal
                        collection={selectedCollection}
                        posts={selectedCollectionPosts}
                        onClose={() => setSelectedCollectionId(null)}
                        onPostClick={onPostClick}
                        onRemix={onRemix}
                    />
                )}

                {/* --- Drag Overlay --- */}
                {createPortal(
                    <DragOverlay>
                        {activeItem ? (
                            <div className="w-[360px] opacity-90 rotate-3 scale-105 pointer-events-none">
                                <SortablePostCard
                                    post={activeItem}
                                    onRemix={() => { }}
                                    onClick={() => { }}
                                    isOverlay
                                />
                            </div>
                        ) : null}
                    </DragOverlay>,
                    document.body
                )}

                {/* --- Suck In Animation --- */}
                {createPortal(
                    <AnimatePresence>
                        {dropAnimation && (
                            <motion.div
                                initial={{
                                    position: 'fixed',
                                    left: dropAnimation.startRect.left,
                                    top: dropAnimation.startRect.top,
                                    width: 360, // Assuming card width
                                    scale: 1,
                                    opacity: 1,
                                    zIndex: 9999
                                }}
                                animate={{
                                    left: dropAnimation.targetRect.left + (dropAnimation.targetRect.width / 2) - 180, // Center horizontally (180 is half of 360)
                                    top: dropAnimation.targetRect.top + (dropAnimation.targetRect.height / 2) - 200, // Center vertically (approx)
                                    scale: 0.1,
                                    opacity: 0
                                }}
                                transition={{ duration: 0.4, ease: [0.25, 0.8, 0.3, 1] }}
                                className="pointer-events-none"
                            >
                                <SortablePostCard
                                    post={dropAnimation.item}
                                    onRemix={() => { }}
                                    onClick={() => { }}
                                    isOverlay
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

            </div>
        </DndContext>
    );
};

export default CollectionBoard;
