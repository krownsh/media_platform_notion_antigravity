
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

    const headerRef = useRef(null);
    const sentinelRef = useRef(null);
    const [isStuck, setIsStuck] = useState(false);

    useEffect(() => {
        const scrollContainer = document.querySelector('main');
        if (!scrollContainer) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                // If it's not intersecting with the top margin, it means it's "stuck"
                setIsStuck(!entry.isIntersecting);
            },
            {
                root: scrollContainer,
                threshold: [0],
                rootMargin: '0px'
            }
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

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
            <div className="flex flex-col gap-6 pb-20">
                {/* Sentinel for sticky header detection - 1px high to avoid flickering */}
                <div ref={sentinelRef} className="h-[1px] w-full -mb-[1px] pointer-events-none" />

                {/* --- Top Section: Folders --- */}
                <div
                    ref={headerRef}
                    className={`hidden md:block border-b notion-whisper-border sticky top-0 z-[60] -mx-4 md:-mx-8 transition-all duration-300 px-6 ${isStuck ? 'pt-1 pb-1 shadow-soft-card bg-white/90 backdrop-blur-md' : 'pt-2 pb-2 bg-white'}`}
                >
                    <div className="w-full">
                        <div className={`flex items-center justify-between transition-all duration-300 ${isStuck ? 'mb-1' : 'mb-2'}`}>
                            <h2 className="text-sm font-semibold text-[#615d59] flex items-center gap-2">
                                <Layers size={16} className="text-[#615d59]" />
                                收藏夾
                            </h2>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="text-sm text-[#615d59] hover:bg-black/5 hover:text-[rgba(0,0,0,0.95)] px-3 py-1.5 rounded-sm flex items-center gap-1 transition-colors"
                            >
                                <Plus size={16} /> 新增資料夾
                            </button>
                        </div>

                        <div className={`flex gap-4 overflow-x-auto px-4 -mx-4 scrollbar-hide transition-all duration-300 ${isStuck ? 'pt-2 pb-1' : 'pt-4 pb-6'}`}>
                            {/* Create Input */}
                            {isCreating && (
                                <form onSubmit={handleCreateCollection} className={`p-4 rounded-lg border border-accent/30 bg-[#0075de]/5 flex flex-col items-center justify-center gap-2 shadow-inner transition-all duration-300 ${isStuck ? 'min-w-[110px]' : 'min-w-[160px]'}`}>
                                    <input
                                        type="text"
                                        placeholder="資料夾名稱"
                                        value={newCollectionName}
                                        onChange={e => setNewCollectionName(e.target.value)}
                                        autoFocus
                                        className="w-full bg-transparent border-b border-accent/50 text-sm text-center outline-none pb-1 text-[rgba(0,0,0,0.95)] placeholder-muted-foreground"
                                        onBlur={() => !newCollectionName && setIsCreating(false)}
                                    />
                                    <button type="submit" className="text-xs text-[#0075de] hover:text-[#0075de]/80 font-medium">按 Enter 鍵</button>
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
                                    <div key={collection.id} className={`relative transition-all duration-300 ${isStuck ? 'min-w-[85px]' : 'min-w-[120px]'} ${isHovered ? 'z-50' : 'z-0'}`}>
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
                                <div className="text-sm text-[#615d59] italic py-4">
                                    尚無收藏夾。建立一個來整理您的貼文。
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Bottom Section: Uncategorized Posts --- */}
                <div className="max-w-full w-full px-2 sm:px-4">
                    <h2 className="text-lg font-semibold text-[rgba(0,0,0,0.95)] mb-6 pl-3 border-l-4 border-accent/50">
                        未分類貼文
                    </h2>

                    {uncategorizedPosts.length === 0 && tasks.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-[#615d59]/60">
                            <p className="text-lg font-medium">全部都看完了！</p>
                            <p className="text-sm">所有貼文都已整理到資料夾中。</p>
                        </div>
                    ) : (
                        <SortableContext items={uncategorizedPosts.map(p => p.id)} strategy={rectSortingStrategy}>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-3 sm:gap-4 md:gap-5">
                                {/* --- Task Queue Skeletons --- */}
                                {tasks.map((task) => (
                                    <div key={task.id} className="notion-card rounded-lg overflow-hidden w-full max-w-[420px] h-[620px] bg-transparent border notion-whisper-border shadow-deep relative flex flex-col">
                                        {/* Shimmer Effect Overlay */}
                                        {task.status !== 'failed' && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shimmer" />
                                        )}

                                        {/* Header Skeleton */}
                                        <div className="h-12 border-b notion-whisper-border flex items-center px-4 gap-3 flex-shrink-0">
                                            <div className="w-8 h-8 rounded-full bg-transparent animate-pulse" />
                                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                                <div className="h-2.5 w-20 bg-transparent rounded animate-pulse" />
                                                <div className="h-2 w-3/4 bg-transparent rounded animate-pulse truncate" title={task.url} />
                                            </div>
                                        </div>

                                        {/* Author Skeleton */}
                                        <div className="h-[50px] border-b notion-whisper-border flex items-center px-4 gap-3 flex-shrink-0 bg-transparent">
                                            <div className="w-9 h-9 rounded-full bg-transparent animate-pulse" />
                                            <div className="flex flex-col gap-2">
                                                <div className="h-3 w-24 bg-transparent rounded animate-pulse" />
                                                <div className="h-2 w-16 bg-transparent rounded animate-pulse" />
                                            </div>
                                        </div>

                                        {/* Image Skeleton with Status */}
                                        <div className={`h-40 flex items-center justify-center flex-shrink-0 relative overflow-hidden ${task.status === 'failed' ? 'bg-destructive/10' : 'bg-transparent'}`}>
                                            {task.status !== 'failed' && <div className="absolute inset-0 bg-transparent animate-pulse" />}
                                            <div className="flex flex-col items-center gap-3 z-10 p-4 text-center">
                                                {task.status === 'failed' ? (
                                                    <>
                                                        <Loader2 className="text-destructive" size={32} />
                                                        <span className="text-xs font-semibold text-destructive uppercase tracking-widest">擷取失敗</span>
                                                        <p className="text-[10px] text-destructive/70 mt-1 line-clamp-2">系統將自動從佇列中移除</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Loader2 className="animate-spin text-[#0075de]" size={32} />
                                                        <span className="text-xs font-semibold text-[#0075de] uppercase tracking-widest animate-pulse">
                                                            {task.status === 'pending' && '等待處理中...'}
                                                            {task.status === 'crawling' && '正在爬取網頁內容...'}
                                                            {task.status === 'analyzing' && 'AI 分析語義中...'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Bar Skeleton */}
                                        <div className="h-10 border-b notion-whisper-border bg-transparent flex items-center justify-end px-4 gap-2 flex-shrink-0">
                                            <div className="w-6 h-6 rounded-full bg-transparent" />
                                            <div className="w-6 h-6 rounded-full bg-transparent" />
                                        </div>

                                        {/* Content Skeleton */}
                                        <div className="p-4 flex-1 flex flex-col gap-3">
                                            <div className="space-y-2">
                                                <div className="h-3 w-full bg-transparent rounded" />
                                                <div className="h-3 w-5/6 bg-transparent rounded" />
                                                <div className="h-3 w-4/6 bg-transparent rounded" />
                                            </div>

                                            <div className="flex gap-2 mt-1">
                                                <div className="h-6 w-14 rounded-full bg-transparent" />
                                                <div className="h-6 w-20 rounded-full bg-transparent" />
                                            </div>

                                            <div className="h-24 rounded-lg bg-[#0075de]/5 border border-accent/10 mt-3 p-3 flex flex-col gap-2">
                                                <div className="h-2.5 w-14 bg-[#0075de]/20 rounded" />
                                                <div className="h-2.5 w-full bg-[rgba(0,117,222,0.1)] rounded" />
                                                <div className="h-2.5 w-3/4 bg-[rgba(0,117,222,0.1)] rounded" />
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
                            <div className={`w-full max-w-[420px] opacity-90 pointer-events-none transition-all duration-300 ${isHoveringFolder ? 'scale-[0.2] rotate-0' : 'scale-105 rotate-3'}`}>
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
                                    width: 420, // Matching max-width
                                    scale: 1,
                                    opacity: 1,
                                    zIndex: 9999
                                }}
                                animate={{
                                    left: dropAnimation.targetRect.left + (dropAnimation.targetRect.width / 2) - 160,
                                    top: dropAnimation.targetRect.top + (dropAnimation.targetRect.height / 2) - 240,
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
