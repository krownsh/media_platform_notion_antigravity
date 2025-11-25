import React, { useState } from 'react';
import { MoreHorizontal, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Instagram, Twitter, Trash2, FolderInput, FolderMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { movePostToCollection } from '../features/postsSlice';

// Custom Threads Icon
const ThreadsIcon = ({ size = 12, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M12.0001 1.03125C5.93407 1.03125 1.03125 5.93407 1.03125 12C1.03125 18.0659 5.93407 22.9688 12.0001 22.9688C17.5519 22.9688 22.138 18.8681 22.8688 13.5356H19.8281C19.1672 17.2022 15.9159 20.0062 12.0001 20.0062C7.58447 20.0062 3.99384 16.4156 3.99384 12C3.99384 7.58447 7.58447 3.99384 12.0001 3.99384C16.4157 3.99384 20.0063 7.58447 20.0063 12C20.0063 13.7916 19.4182 15.4284 18.4219 16.7438C17.6531 17.7562 16.4157 18.375 15.0563 18.375C13.2563 18.375 11.9531 16.9688 11.9531 15.0938V12.2812H14.9063V15.0938C14.9063 15.4219 15.0282 15.5437 15.0563 15.5437C15.1969 15.5437 15.4688 15.3562 15.75 14.9812C16.2188 14.3531 16.4813 13.4344 16.4813 12C16.4813 9.52509 14.4751 7.51884 12.0001 7.51884C9.52509 7.51884 7.51884 9.52509 7.51884 12C7.51884 14.4751 9.52509 16.4813 12.0001 16.4813C13.2094 16.4813 14.3063 16.0031 15.1219 15.2156L17.2126 17.325C15.8626 18.6656 14.0251 19.4438 12.0001 19.4438C7.88447 19.4438 4.55634 16.1157 4.55634 12C4.55634 7.88447 7.88447 4.55634 12.0001 4.55634C16.1157 4.55634 19.4438 7.88447 19.4438 12C19.4438 18.2344 14.8594 23.5312 8.71884 23.5312V26.4938C16.4532 26.4938 22.4063 19.9219 22.4063 12C22.4063 6.25322 17.7469 1.59384 12.0001 1.59384C6.25322 1.59384 1.59384 6.25322 1.59384 12C1.59384 17.7469 6.25322 22.4063 12.0001 22.4063C13.3594 22.4063 14.6626 22.1438 15.8719 21.6656L14.7844 18.8531C13.9126 19.1438 12.9751 19.3031 12.0001 19.3031V22.9688Z" />
    </svg>
);

const PostCard = ({
    post,
    onRemix,
    onClick,
    onDelete,
    isMergeTarget = false,
    mergeProgress = 0,
    mergeReady = false,
}) => {
    const { platform, title, screenshot, analysis } = post;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [showMoveMenu, setShowMoveMenu] = useState(false);

    const dispatch = useDispatch();
    const { collections } = useSelector(state => state.posts);

    // Helper function to proxy Instagram/Threads images
    const proxyImage = (imageUrl) => {
        if (!imageUrl) return null;
        // Only proxy Instagram/Threads images
        if (imageUrl.includes('instagram.') || imageUrl.includes('fbcdn.net')) {
            return `http://localhost:3001/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
        return imageUrl;
    };

    const getPlatformStyle = (p) => {
        const platformName = p?.toLowerCase();
        if (platformName === 'instagram') {
            return {
                icon: <Instagram size={12} className="text-white" />,
                headerBg: 'bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]',
                label: 'Instagram',
            };
        }
        if (platformName === 'twitter' || platformName === 'x') {
            return {
                icon: <Twitter size={12} className="text-white" />,
                headerBg: 'bg-[#1DA1F2]', // Twitter Blue
                label: 'Twitter', // Or 'X' if preferred, but user asked for "Twitter style"
            };
        }
        // Default to Threads
        return {
            icon: <ThreadsIcon size={12} className="text-white" />,
            headerBg: 'bg-[#101010]',
            label: 'Threads',
        };
    };

    const platformStyle = getPlatformStyle(platform);
    const images = post.images && post.images.length > 0 ? post.images : (screenshot ? [screenshot] : []);
    const hasMultipleImages = images.length > 1;

    const nextImage = (e) => {
        e.stopPropagation();
        if (currentImageIndex < images.length - 1) {
            setCurrentImageIndex(prev => prev + 1);
        }
    };

    const prevImage = (e) => {
        e.stopPropagation();
        if (currentImageIndex > 0) {
            setCurrentImageIndex(prev => prev - 1);
        }
    };

    const handleMoveToCollection = (e, collectionId) => {
        e.stopPropagation();
        dispatch(movePostToCollection({ postId: post.id, collectionId }));
        setShowMenu(false);
        setShowMoveMenu(false);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{
                opacity: 1,
                y: 0,
                scale: isMergeTarget ? 0.97 : 1,
                rotate: isMergeTarget ? -0.4 : 0
            }}
            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
            onClick={onClick}
            className="glass-card rounded-xl overflow-hidden group relative w-[360px] h-[560px] flex-shrink-0 bg-black/40 border border-white/10 shadow-xl flex flex-col cursor-pointer"
            onMouseLeave={() => { setShowMenu(false); setShowMoveMenu(false); }}
        >
            {isMergeTarget && (
                <div className="absolute inset-0 pointer-events-none rounded-xl">
                    <div className="absolute inset-0 rounded-xl bg-blue-500/5" />
                    <div
                        className="absolute inset-2 rounded-xl border border-blue-400/60"
                        style={{ opacity: mergeReady ? 1 : mergeProgress * 0.9 }}
                    />
                </div>
            )}
            {/* Platform Header Strip */}
            <div className={`w-full h-8 px-3 flex items-center justify-between flex-shrink-0 ${platformStyle.headerBg} border-b border-white/5`}>
                <div className="flex items-center gap-2">
                    {platformStyle.icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white leading-none">
                        {platformStyle.label}
                    </span>
                    <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
                    <span className="text-[10px] text-white/70 font-medium leading-none">
                        {post.collectionId ? collections.find(c => c.id === post.collectionId)?.name || 'Uncategorized' : 'Uncategorized'}
                    </span>
                </div>

                {/* Menu */}
                <div className="relative">
                    <button
                        className="p-1 rounded-full hover:bg-white/20 text-white/80 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowMenu(!showMenu);
                            setShowMoveMenu(false);
                        }}
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                transition={{ duration: 0.1 }}
                                className="absolute right-0 top-full mt-1 w-48 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
                            >
                                {/* Move To Submenu Trigger */}
                                <div className="relative">
                                    <button
                                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5 flex items-center justify-between transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMoveMenu(!showMoveMenu);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FolderInput size={14} />
                                            Move to...
                                        </div>
                                        <ChevronRight size={12} />
                                    </button>

                                    {/* Submenu */}
                                    {showMoveMenu && (
                                        <div className="absolute right-full top-0 mr-1 w-40 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                                            {post.collectionId && (
                                                <button
                                                    className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-white/5 flex items-center gap-2 transition-colors border-b border-white/5"
                                                    onClick={(e) => handleMoveToCollection(e, null)}
                                                >
                                                    <FolderMinus size={12} /> Remove from Folder
                                                </button>
                                            )}
                                            {collections.length > 0 ? (
                                                collections.map(collection => (
                                                    <button
                                                        key={collection.id}
                                                        className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-white/5 truncate"
                                                        onClick={(e) => handleMoveToCollection(e, collection.id)}
                                                    >
                                                        {collection.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-3 py-2 text-xs text-gray-500 italic">No folders</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-white/5 flex items-center gap-2 transition-colors border-t border-white/5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onDelete && onDelete();
                                    }}
                                >
                                    <Trash2 size={14} />
                                    Delete Post
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Author Info */}
            <div className="p-3 border-b border-white/5 flex-shrink-0 relative z-20 flex items-center gap-2.5 bg-black/20">
                {post.avatar ? (
                    <img src={proxyImage(post.avatar)} alt={post.author} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
                        {post.author?.[0] || 'U'}
                    </div>
                )}
                <div className="flex flex-col justify-center">
                    <span className="text-sm font-semibold text-white leading-none truncate max-w-[180px]">
                        {post.author || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400 leading-none mt-1">
                        @{post.authorHandle || 'unknown'}
                        {post.postedAt && (
                            <>
                                <span className="mx-1">•</span>
                                {new Date(post.postedAt).toLocaleDateString()}
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Image Carousel Section - Fixed Height (Aspect Video is relative to width, so it's fixed) */}
            <div className="relative w-full aspect-video bg-gray-900 overflow-hidden group/image flex-shrink-0">
                {images.length > 0 ? (
                    <div className="relative w-full h-full">
                        {/* Image Slider */}
                        <motion.div
                            className="flex w-full h-full"
                            animate={{ x: `-${currentImageIndex * 100}%` }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                            {images.map((img, idx) => (
                                <div key={idx} className="w-full h-full flex-shrink-0">
                                    <img
                                        src={proxyImage(img)}
                                        alt={`${title} - ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                        draggable={false}
                                    />
                                </div>
                            ))}
                        </motion.div>

                        {/* Controls */}
                        {hasMultipleImages && (
                            <>
                                {currentImageIndex > 0 && (
                                    <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={prevImage}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/90 hover:bg-black/80 backdrop-blur-sm transition-all z-10 opacity-0 group-hover/image:opacity-100"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                )}
                                {currentImageIndex < images.length - 1 && (
                                    <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={nextImage}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white/90 hover:bg-black/80 backdrop-blur-sm transition-all z-10 opacity-0 group-hover/image:opacity-100"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                )}

                                {/* Dots Indicator */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 px-2 py-1 rounded-full bg-black/20 backdrop-blur-sm">
                                    {images.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/40'}`}
                                        />
                                    ))}
                                </div>

                                {/* Image Counter Badge */}
                                <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white border border-white/10">
                                    {currentImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <span className="text-gray-500 text-sm">No image available</span>
                    </div>
                )}
            </div>

            {/* Action Bar - Fixed Height */}
            <div className="px-3 py-2.5 flex items-center justify-end border-b border-white/5 h-[50px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemix && onRemix(post);
                        }}
                        className="p-1.5 rounded-full hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 transition-colors"
                        title="Remix with AI"
                    >
                        <Sparkles size={20} />
                    </button>
                    <a
                        href={post.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-400 text-gray-400 transition-colors"
                        title="Open original post"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink size={20} />
                    </a>
                </div>
            </div>

            {/* Content Section - Flexible Height but constrained */}
            <div className="p-3 flex-1 flex flex-col overflow-hidden">
                {/* Caption - Fixed Height for 3 lines */}
                <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap line-clamp-3 h-[4.5rem] mb-1 flex-shrink-0">
                    <span className="font-semibold text-white mr-2">{post.author}</span>
                    {post.content || title}
                </div>

                {/* Tags - Fixed Height for 1 line */}
                <div className="flex flex-wrap gap-1.5 h-[26px] mb-1 flex-shrink-0 overflow-hidden">
                    {analysis?.tags && analysis.tags.length > 0 && analysis.tags.slice(0, 5).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-[10px] font-medium text-blue-300 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap">
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* AI Summary (if available) - Fixed Height */}
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5 mb-2 flex-shrink-0 h-[70px] overflow-hidden">
                    {analysis?.summary ? (
                        <>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Sparkles size={12} className="text-purple-400" />
                                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">AI Summary</span>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">
                                {analysis.summary}
                            </p>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs text-gray-600 italic">
                            No AI summary available
                        </div>
                    )}
                </div>

                {/* Footer Info (Date) - Pushed to bottom */}
                <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                    <span>已儲存 • {post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                </div>
            </div>
        </motion.div>
    );
};

export default PostCard;
