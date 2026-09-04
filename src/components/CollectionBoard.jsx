
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { reorderPosts, createCollection, movePostToCollection, deletePost } from '../features/postsSlice';
import SortablePostCard from './SortablePostCard';
import PostCard from './PostCard';
import CollectionFolder from './CollectionFolder';
import CollectionModal from './CollectionModal';
import { Layers, Plus, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';

const CreateFolderInput = ({ onCreate, onCancel }) => {
    const [name, setName] = useState('');
    return (
        <form onSubmit={(e) => { e.preventDefault(); onCreate(name); }} className="flow-panel p-3 flex flex-col items-center justify-center gap-2 min-w-[132px]">
            <input
                type="text"
                placeholder="資料夾名稱"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                className="w-full bg-transparent border-b border-[var(--accent)] text-sm text-center outline-none pb-1 text-[rgba(0,0,0,0.95)] placeholder-muted-foreground"
                onBlur={() => !name && onCancel()}
            />
        </form>
    );
};

const CollectionBoard = ({ onRemix }) => {
    const { items, collections, loading, tasks } = useSelector((state) => state.posts);
    console.log('CollectionBoard items:', items);
    
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [activeId, setActiveId] = useState(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isMobileScreen, setIsMobileScreen] = useState(window.innerWidth < 1024); // 使用 1024 (lg) 作為判斷點，更符合平板與手機的操作習慣
    const [activeMenuId, setActiveMenuId] = useState(null);

    // Global click to close menu
    useEffect(() => {
        const handleClick = () => setActiveMenuId(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Lazy Loading state
    const [displayCount, setDisplayCount] = useState(12);
    const loadMoreRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobileScreen(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const headerRef = useRef(null);

    // Animation State
    const [dropAnimation, setDropAnimation] = useState(null); // { item, startRect, targetRect }

    // Filter posts (Memoized to prevent O(N) operations on every render):
    const uncategorizedPosts = useMemo(() => items.filter(p => !p.collectionId), [items]);
    
    // Memoize collection mapping so we don't filter items O(N*C) times
    const postsByCollection = useMemo(() => {
        const map = {};
        items.forEach(p => {
            if (p.collectionId) {
                if (!map[p.collectionId]) map[p.collectionId] = [];
                map[p.collectionId].push(p);
            }
        });
        return map;
    }, [items]);

    const selectedCollection = collections.find(c => c.id === selectedCollectionId);
    const selectedCollectionPosts = selectedCollection
        ? (postsByCollection[selectedCollection.id] || [])
        : [];

    useEffect(() => {
        // Infinite scroll intersection observer
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayCount(prev => prev + 12);
                }
            },
            { threshold: 0.1, rootMargin: '800px' }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [uncategorizedPosts]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: isMobileScreen ? 9999 : 8, // 手機版設極大值防止觸發
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event) => {
        setActiveId(event.active.id);
    };

    const [activeOverId, setActiveOverId] = useState(null);

    // Disable scrolling when dragging
    useEffect(() => {
        if (activeId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [activeId]);

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

    const handleCreateCollection = (name) => {
        if (name.trim()) {
            dispatch(createCollection({ name: name.trim() }));
            setIsCreating(false);
        }
    };

    // Helper to find the active item for DragOverlay
    const activeItem = items.find(i => i.id === activeId);

    // Check if currently hovering over a collection folder
    const isHoveringFolder = activeOverId && collections.some(c => c.id === activeOverId);

    const uncategorizedPostsGrid = useMemo(() => {
        if (uncategorizedPosts.length === 0 && tasks.length === 0 && !loading) {
            return (
                <div className="flow-panel flex min-h-[18rem] flex-col items-center justify-center px-6 text-center text-[#615d59]">
                    <p className="text-base font-semibold text-[rgba(0,0,0,0.95)]">收件匣已整理完成</p>
                    <p className="mt-2 text-sm leading-6">所有貼文都已放入資料夾。可以新增來源，或從收藏夾繼續檢視。</p>
                </div>
            );
        }

        const visiblePosts = uncategorizedPosts.slice(0, displayCount);
        const hasMore = displayCount < uncategorizedPosts.length;

        return (
            <SortableContext items={visiblePosts.map(p => p.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 px-1">
                    {/* --- Task Queue Skeletons --- */}
                    {tasks.map((task) => (
                        <div key={task.id} className={`flow-surface flow-shimmer min-h-[13rem] overflow-hidden relative flex flex-col ${task.status === 'failed' ? 'border-destructive/30' : ''}`}>
                            {/* Shimmer Effect Overlay */}
                            {task.status !== 'failed' && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full" />
                            )}

                            {/* Header Skeleton */}
                            <div className="border-b notion-whisper-border flex items-center px-4 py-3 gap-3 flex-shrink-0">
                                <div className={`w-9 h-9 rounded-[0.65rem] ${task.status === 'failed' ? 'bg-destructive/10 text-destructive' : 'bg-[var(--accent-soft)] text-[var(--accent)]'} flex items-center justify-center`}>
                                    <Loader2 className={task.status === 'failed' ? '' : 'animate-spin'} size={18} />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                    <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${task.status === 'failed' ? 'text-destructive' : 'text-[var(--accent)]'}`}>{task.inputType === 'image' ? '圖片來源' : '網址來源'}</span>
                                    <span className="text-xs text-[#615d59] truncate" title={task.url}>{task.label || task.url}</span>
                                </div>
                            </div>

                            <div className={`flex-1 flex items-center justify-center relative overflow-hidden ${task.status === 'failed' ? 'bg-destructive/5' : 'bg-[var(--surface)]'}`}>
                                <div className="flex flex-col items-center gap-3 z-10 p-5 text-center">
                                    {task.status === 'failed' ? (
                                        <>
                                            <span className="text-sm font-semibold text-destructive">擷取需要處理</span>
                                            <p className="text-xs text-destructive/80 leading-5">可從任務中心重試或清除這項任務。</p>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sm font-semibold text-[rgba(0,0,0,0.95)]">
                                                {task.status === 'pending' && '等待處理中...'}
                                                {task.status === 'crawling' && '正在爬取網頁內容...'}
                                                {task.status === 'analyzing' && 'AI 分析語義中...'}
                                                {!['pending', 'crawling', 'analyzing'].includes(task.status) && '正在整理來源...'}
                                            </span>
                                            <div className="flex w-28 gap-1" aria-hidden="true">
                                                <span className="h-1 flex-1 rounded-full bg-[var(--accent)]" />
                                                <span className="h-1 flex-1 rounded-full bg-[var(--accent)]/50" />
                                                <span className="h-1 flex-1 rounded-full bg-black/10" />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* --- Actual Posts --- */}
                    {visiblePosts.map((post) => (
                        <SortablePostCard
                            key={post.id}
                            post={post}
                            onRemix={onRemix}
                            onClick={() => navigate(`/post/${post.dbId || post.id}`)}
                            onDelete={() => dispatch(deletePost(post.dbId || post.id))}
                        />
                    ))}

                    {/* Infinite Scroll Trigger Element */}
                    {hasMore && (
                    <div ref={loadMoreRef} className="col-span-full h-20 flex items-center justify-center">
                        <Loader2 className="animate-spin text-[var(--accent)]/50" size={22} />
                        </div>
                    )}
                </div>
            </SortableContext>
        );
    }, [uncategorizedPosts, tasks, loading, onRemix, navigate, dispatch, displayCount]);

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            autoScroll={false}
        >
            <div className="flex flex-col gap-5 relative pb-20">
                {/* --- Top Section: Folders --- */}
                <div
                    ref={headerRef}
                    className="hidden md:block sticky top-0 z-[60] -mx-4 md:-mx-8 px-4 sm:px-6 pt-3 pb-2 bg-surface-raised backdrop-blur-md border-b notion-whisper-border"
                >
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-semibold text-[#615d59] flex items-center gap-2">
                                <Layers size={16} className="text-[var(--accent)]" />
                                收藏夾
                            </h2>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="notion-btn-ghost text-sm text-[#615d59] px-3 py-1.5 flex items-center gap-1"
                            >
                                <Plus size={16} /> 新增資料夾
                            </button>
                        </div>

                        <div className="flex gap-4 overflow-x-auto px-4 -mx-4 scrollbar-hide pt-2 pb-2">
                            {/* Create Input */}
                            {isCreating && (
                                <CreateFolderInput 
                                    onCreate={handleCreateCollection} 
                                    onCancel={() => setIsCreating(false)} 
                                />
                            )}

                            {/* Folder List */}
                            {collections.map(collection => {
                                const folderPosts = postsByCollection[collection.id] || [];
                                const previewImages = folderPosts
                                    .flatMap(p => p.images || [])
                                    .slice(0, 4);
                                const isHovered = activeOverId === collection.id;

                                return (
                                    <div key={collection.id} className={`relative min-w-[96px] ${isHovered ? 'z-50' : 'z-0'}`}>
                                        <div className={`transition-transform duration-150 ease-out ${isHovered ? 'scale-110' : ''}`}>
                                            <CollectionFolder
                                                collection={collection}
                                                postCount={folderPosts.length}
                                                previewImages={previewImages}
                                                onClick={() => setSelectedCollectionId(collection.id)}
                                                isMenuOpen={activeMenuId === collection.id}
                                                onMenuToggle={() => setActiveMenuId(activeMenuId === collection.id ? null : collection.id)}
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
                <div className="max-w-full w-full px-1 sm:px-2">
                    <div className="mb-5 sm:mb-6">
                        <p className="flow-kicker mb-1.5">等待下一步</p>
                        <h2 className="text-xl font-bold tracking-[-0.035em] text-[rgba(0,0,0,0.95)]">未分類貼文</h2>
                    </div>

                    {uncategorizedPostsGrid}
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
                            <Motion.div
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
                            </Motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

            </div>
        </DndContext>
    );
};

export default CollectionBoard;
