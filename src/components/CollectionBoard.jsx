
import React, { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { DndContext, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { reorderPosts, fetchPosts, createCollection, movePostToCollection, deletePost } from '../features/postsSlice';
import SortablePostCard from './SortablePostCard';
import PostCard from './PostCard';
import CollectionFolder from './CollectionFolder';
import CollectionModal from './CollectionModal';
import { Layers, Plus, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const CollectionBoard = ({ onRemix }) => {
    const { items, collections, loading, initialized, tasks } = useSelector((state) => state.posts);
    console.log('CollectionBoard items:', items);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [activeId, setActiveId] = useState(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Animation State
    const [dropAnimation, setDropAnimation] = useState(null); // { item, startRect, targetRect }

    useEffect(() => {
        // Only fetch if we haven't initialized yet and aren't currently loading
        if (!initialized && !loading) {
            dispatch(fetchPosts());
        }
    }, [dispatch, initialized, loading]);

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
    console.log('Uncategorized posts:', uncategorizedPosts.length, uncategorizedPosts);
    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    const selectedCollectionPosts = selectedCollection
        ? items.filter(p => p.collectionId === selectedCollection.id)
        : [];

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const [activeOverId, setActiveOverId] = useState(null);

    const handleDragOver = (event) => {
        const { over } = event;
        setActiveOverId(over ? over.id : null);
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;
        const activeItemData = items.find(i => i.id === active.id);
        setActiveId(null);
        setActiveOverId(null);

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

            dispatch(movePostToCollection({ postId: activeItemData.dbId || active.id, collectionId }));
            return;
        }

        // Case 2: Dragging a Post to "Remove Zone" (Inside Modal)
        if (over.id === 'remove-zone') {
            dispatch(movePostToCollection({ postId: activeItemData.dbId || active.id, collectionId: null }));
            return;
        }

        // Case 3: Reordering Posts (Standard DnD)
        if (active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                dispatch(reorderPosts({ oldIndex, newIndex }));
            }
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

    // Check if currently hovering over a collection folder
    const isHoveringFolder = activeOverId && collections.some(c => c.id === activeOverId);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col gap-8 pb-20">

                {/* --- Top Section: Folders --- */}
                <div className="bg-white/40 border-b border-white/20 py-3 px-6 -mx-6 md:-mx-8 lg:-mx-12 sticky top-0 z-30 backdrop-blur-md shadow-sm">
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

                        <div className="flex gap-6 overflow-x-auto pb-8 pt-4 px-4 -mx-4 scrollbar-hide">
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
                                const isHovered = activeOverId === collection.id;

                                return (
                                    <div key={collection.id} className={`min-w-[140px] relative ${isHovered ? 'z-50' : 'z-0'}`}>
                                        <div className={`transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}>
                                            <CollectionFolder
                                                collection={collection}
                                                postCount={folderPosts.length}
                                                previewImages={previewImages}
                                                onClick={() => setSelectedCollectionId(collection.id)}
                                            />
                                        </div>
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
                <div className="max-w-full w-full px-4">
                    <h2 className="text-lg font-semibold text-foreground mb-6 pl-3 border-l-4 border-accent/50">
                        未分類貼文
                    </h2>

                    {uncategorizedPosts.length === 0 && tasks.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/60">
                            <p className="text-lg font-medium">全部都看完了！</p>
                            <p className="text-sm">所有貼文都已整理到資料夾中。</p>
                        </div>
                    ) : (
                        <SortableContext items={uncategorizedPosts.map(p => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-8">
                                {/* --- Task Queue Skeletons --- */}
                                {tasks.map((task) => (
                                    <div key={task.id} className="glass-card rounded-3xl overflow-hidden w-full max-w-[400px] h-[560px] bg-white/40 border border-white/50 shadow-xl relative flex flex-col">
                                        {/* Shimmer Effect Overlay */}
                                        {task.status !== 'failed' && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
                                        )}

                                        {/* Header Skeleton */}
                                        <div className="h-12 border-b border-white/20 flex items-center px-4 gap-3 flex-shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-white/30 animate-pulse" />
                                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                <div className="h-2.5 w-20 bg-white/30 rounded animate-pulse" />
                                                <div className="h-2 w-3/4 bg-white/20 rounded animate-pulse truncate" title={task.url} />
                                            </div>
                                        </div>

                                        {/* Author Skeleton */}
                                        <div className="h-[50px] border-b border-white/20 flex items-center px-4 gap-3 flex-shrink-0 bg-white/10">
                                            <div className="w-9 h-9 rounded-full bg-white/30 animate-pulse" />
                                            <div className="flex flex-col gap-2">
                                                <div className="h-3 w-24 bg-white/30 rounded animate-pulse" />
                                                <div className="h-2 w-16 bg-white/20 rounded animate-pulse" />
                                            </div>
                                        </div>

                                        {/* Image Skeleton with Status */}
                                        <div className={`h-44 flex items-center justify-center flex-shrink-0 relative overflow-hidden ${task.status === 'failed' ? 'bg-destructive/10' : 'bg-white/20'}`}>
                                            {task.status !== 'failed' && <div className="absolute inset-0 bg-white/5 animate-pulse" />}
                                            <div className="flex flex-col items-center gap-3 z-10 p-4 text-center">
                                                {task.status === 'failed' ? (
                                                    <>
                                                        <Loader2 className="text-destructive" size={32} />
                                                        <span className="text-xs font-semibold text-destructive uppercase tracking-widest">擷取失敗</span>
                                                        <p className="text-[10px] text-destructive/70 mt-1 line-clamp-2">系統將自動從佇列中移除</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Loader2 className="animate-spin text-accent" size={32} />
                                                        <span className="text-xs font-semibold text-accent uppercase tracking-widest animate-pulse">
                                                            {task.status === 'pending' && '等待處理中...'}
                                                            {task.status === 'crawling' && '正在爬取網頁內容...'}
                                                            {task.status === 'analyzing' && 'AI 分析語義中...'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Bar Skeleton */}
                                        <div className="h-10 border-b border-white/20 bg-white/5 flex items-center justify-end px-4 gap-2 flex-shrink-0">
                                            <div className="w-6 h-6 rounded-full bg-white/20" />
                                            <div className="w-6 h-6 rounded-full bg-white/20" />
                                        </div>

                                        {/* Content Skeleton */}
                                        <div className="p-4 flex-1 flex flex-col gap-3">
                                            <div className="space-y-2">
                                                <div className="h-3 w-full bg-white/30 rounded" />
                                                <div className="h-3 w-5/6 bg-white/30 rounded" />
                                                <div className="h-3 w-4/6 bg-white/30 rounded" />
                                            </div>

                                            <div className="flex gap-2 mt-1">
                                                <div className="h-5 w-12 rounded-full bg-white/20" />
                                                <div className="h-5 w-16 rounded-full bg-white/20" />
                                            </div>

                                            <div className="h-16 rounded-xl bg-accent/5 border border-accent/10 mt-2 p-3 flex flex-col gap-2">
                                                <div className="h-2 w-12 bg-accent/20 rounded" />
                                                <div className="h-2 w-full bg-accent/10 rounded" />
                                                <div className="h-2 w-3/4 bg-accent/10 rounded" />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* --- Actual Posts --- */}
                                {uncategorizedPosts.map((post) => (
                                    <SortablePostCard
                                        key={post.id}
                                        post={post}
                                        onRemix={onRemix}
                                        onClick={() => navigate(`/post/${post.dbId || post.id}`)}
                                        onDelete={() => dispatch(deletePost(post.dbId || post.id))}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    )}
                </div>

                {/* --- Modal --- */}
                {selectedCollection && (
                    <CollectionModal
                        collection={selectedCollection}
                        posts={selectedCollectionPosts}
                        onClose={() => setSelectedCollectionId(null)}
                        onPostClick={(post) => navigate(`/post/${post.dbId || post.id}`)}
                        onRemix={onRemix}
                    />
                )}

                {/* --- Drag Overlay --- */}
                {createPortal(
                    <DragOverlay>
                        {activeItem ? (
                            <div className={`w-full max-w-[400px] opacity-90 pointer-events-none transition-all duration-300 ${isHoveringFolder ? 'scale-[0.2] rotate-0' : 'scale-105 rotate-3'}`}>
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
                                    width: 400, // Matching max-width
                                    scale: 1,
                                    opacity: 1,
                                    zIndex: 9999
                                }}
                                animate={{
                                    left: dropAnimation.targetRect.left + (dropAnimation.targetRect.width / 2) - 200, // Center horizontally (200 is half of 400)
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
