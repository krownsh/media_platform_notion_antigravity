import React, { useState } from 'react';
import { MoreHorizontal, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Instagram, Twitter, Trash2, FolderInput, FolderMinus, Globe, Facebook, Youtube, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { movePostToCollection } from '../features/postsSlice';
import { API_BASE_URL } from '../api/config';


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
            return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
        return imageUrl;
    };

    const getPlatformStyle = (p) => {
        const platformName = p?.toLowerCase();
        if (platformName === 'threads') {
            return {
                icon: <ThreadsIcon size={14} className="text-foreground" />,
                label: 'Threads',
            };
        }
        if (platformName === 'instagram') {
            return {
                icon: <Instagram size={14} className="text-pink-500" />,
                label: 'Instagram',
            };
        }
        if (platformName === 'twitter' || platformName === 'x') {
            return {
                icon: <Twitter size={14} className="text-blue-400" />,
                label: 'Twitter',
            };
        }
        if (platformName === 'facebook') {
            return {
                icon: <Facebook size={14} className="text-blue-600" />,
                label: 'Facebook',
            };
        }
        if (platformName === 'youtube') {
            return {
                icon: <Youtube size={14} className="text-red-600" />,
                label: 'YouTube',
            };
        }
        if (platformName === 'notion') {
            return {
                icon: <FileText size={14} className="text-foreground" />,
                label: 'Notion',
            };
        }
        // Default to Generic
        return {
            icon: <Globe size={14} className="text-muted-foreground" />,
            label: 'Web Link',
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
            transition={{ duration: 0.5, ease: [0.25, 0.8, 0.3, 1] }}
            onClick={onClick}
            className="glass-card rounded-3xl group relative w-full max-w-[400px] h-[560px] flex-shrink-0 flex flex-col cursor-pointer bg-white/60 border border-white/40 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
            onMouseLeave={() => { setShowMenu(false); setShowMoveMenu(false); }}
        >
            {isMergeTarget && (
                <div className="absolute inset-0 pointer-events-none rounded-3xl z-50">
                    <div className="absolute inset-0 rounded-3xl bg-accent/10" />
                    <div
                        className="absolute inset-2 rounded-2xl border-2 border-accent/60"
                        style={{ opacity: mergeReady ? 1 : mergeProgress * 0.9 }}
                    />
                </div>
            )}
            {/* Platform Header Strip */}
            <div className="relative z-40 w-full h-10 px-4 flex items-center justify-between flex-shrink-0 bg-white/30 backdrop-blur-sm border-b border-white/20 rounded-t-3xl">
                <div className="flex items-center gap-2">
                    {platformStyle.icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                        {platformStyle.label}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                    <span className="text-[10px] text-muted-foreground/80 font-medium leading-none">
                        {post.collectionId ? collections.find(c => c.id === post.collectionId)?.name || '未分類' : '未分類'}
                    </span>
                </div>

                {/* Menu */}
                <div className="relative z-50">
                    <button
                        className="p-1.5 rounded-full hover:bg-secondary/20 text-muted-foreground transition-colors"
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
                                transition={{ duration: 0.2, ease: [0.25, 0.8, 0.3, 1] }}
                                className="absolute right-0 top-full mt-2 w-48 bg-white border border-white/50 rounded-2xl shadow-xl z-50 backdrop-blur-xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Move To Submenu Trigger */}
                                <div className="relative">
                                    <button
                                        className="w-full px-4 py-3 text-left text-xs text-foreground hover:bg-secondary/20 flex items-center justify-between transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMoveMenu(!showMoveMenu);
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FolderInput size={14} className="text-muted-foreground" />
                                            移動至...
                                        </div>
                                        <ChevronRight size={12} className="text-muted-foreground" />
                                    </button>

                                    {/* Submenu */}
                                    {showMoveMenu && (
                                        <div className="absolute right-full top-0 mr-2 w-40 bg-white border border-white/50 rounded-2xl shadow-xl overflow-hidden z-50 backdrop-blur-xl">
                                            {post.collectionId && (
                                                <button
                                                    className="w-full px-4 py-3 text-left text-xs text-destructive hover:bg-destructive/5 flex items-center gap-2 transition-colors border-b border-border/20"
                                                    onClick={(e) => handleMoveToCollection(e, null)}
                                                >
                                                    <FolderMinus size={12} /> 從資料夾移除
                                                </button>
                                            )}
                                            {collections.length > 0 ? (
                                                collections.map(collection => (
                                                    <button
                                                        key={collection.id}
                                                        className="w-full px-4 py-3 text-left text-xs text-foreground hover:bg-secondary/20 truncate"
                                                        onClick={(e) => handleMoveToCollection(e, collection.id)}
                                                    >
                                                        {collection.name}
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-xs text-muted-foreground italic">無資料夾</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="w-full px-4 py-3 text-left text-xs text-destructive hover:bg-destructive/5 flex items-center gap-2 transition-colors border-t border-border/20"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        onDelete && onDelete();
                                    }}
                                    title="Delete Post"
                                >
                                    <Trash2 size={14} />
                                    刪除貼文
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Author Info */}
            <div className="px-4 py-2 border-b border-white/20 flex-shrink-0 relative z-20 flex items-center gap-2.5 bg-white/20">
                {post.avatar ? (
                    <img src={proxyImage(post.avatar)} alt={post.author} className="w-8 h-8 rounded-full object-cover border border-white/30 shadow-sm" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-secondary to-primary flex items-center justify-center text-xs font-bold text-foreground border border-white/30 shadow-sm">
                        {post.author?.[0] || 'U'}
                    </div>
                )}
                <div className="flex flex-col justify-center min-w-0">
                    <span className="text-sm font-semibold text-foreground leading-none truncate max-w-[180px]">
                        {post.author || 'Unknown'}
                    </span>
                    <span className="text-[10px] text-muted-foreground/80 leading-none mt-1 font-medium truncate">
                        @{post.authorHandle || 'unknown'}
                    </span>
                </div>
            </div>

            {/* Image Carousel Section - Reduced Height */}
            <div className="relative w-full h-44 bg-muted/20 overflow-hidden group/image flex-shrink-0">
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
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-foreground hover:bg-white backdrop-blur-sm transition-all z-10 opacity-0 group-hover/image:opacity-100 shadow-sm"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                )}
                                {currentImageIndex < images.length - 1 && (
                                    <button
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={nextImage}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 text-foreground hover:bg-white backdrop-blur-sm transition-all z-10 opacity-0 group-hover/image:opacity-100 shadow-sm"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                )}

                                {/* Dots Indicator */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-10 px-2 py-1 rounded-full bg-black/10 backdrop-blur-md">
                                    {images.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`w-1 h-1 rounded-full transition-all duration-300 shadow-sm ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                                        />
                                    ))}
                                </div>

                                {/* Image Counter Badge */}
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/20 backdrop-blur-md text-[9px] font-medium text-white border border-white/10">
                                    {currentImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary/10">
                        <span className="text-muted-foreground text-sm">無圖片</span>
                    </div>
                )}
            </div>

            {/* Action Bar - Reduced Height */}
            <div className="px-4 flex items-center justify-end border-b border-white/20 h-10 flex-shrink-0 bg-white/10">
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemix && onRemix(post);
                        }}
                        className="p-1.5 rounded-full hover:bg-accent/10 text-accent hover:text-accent-foreground transition-colors duration-300"
                        title="AI 改寫"
                    >
                        <Sparkles size={16} />
                    </button>
                    <a
                        href={post.originalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-full hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-colors duration-300"
                        title="開啟原始貼文"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>

            {/* Content Section - Flexible with Padding */}
            <div className="px-4 py-3 flex-1 flex flex-col overflow-hidden bg-white/30 rounded-b-3xl">
                {/* Caption - Flexible Height */}
                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-3 mb-2 font-medium flex-grow">
                    <span className="font-bold text-foreground mr-2">{post.author}</span>
                    {post.content || title}
                </div>

                {/* Tags - Fixed Height */}
                <div className="flex flex-wrap gap-1.5 h-[24px] mb-2 flex-shrink-0 overflow-hidden">
                    {analysis?.tags && analysis.tags.length > 0 && analysis.tags.slice(0, 4).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-secondary/20 text-[9px] font-medium text-foreground/70 border border-secondary/30 hover:bg-secondary/30 transition-colors cursor-pointer whitespace-nowrap">
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* AI Summary - Fixed Height */}
                <div className="bg-accent/5 border border-accent/10 rounded-xl p-2.5 mb-2 flex-shrink-0 h-[64px] overflow-hidden relative group/summary">
                    {analysis?.summary ? (
                        <>
                            <div className="flex items-center gap-1 mb-0.5">
                                <Sparkles size={10} className="text-accent" />
                                <span className="text-[9px] font-bold text-accent uppercase tracking-wider">AI 摘要</span>
                            </div>
                            <div className="text-xs text-muted-foreground leading-snug line-clamp-2 group-hover/summary:text-foreground transition-colors">
                                {(() => {
                                    let summary = analysis.summary;

                                    // 1. Try to parse JSON string if it looks like JSON
                                    if (typeof summary === 'string' && (summary.trim().startsWith('{') || summary.includes('```json'))) {
                                        try {
                                            const cleanJson = summary.replace(/```json\s*|\s*```/g, '').trim();
                                            const parsed = JSON.parse(cleanJson);
                                            if (parsed && typeof parsed === 'object') {
                                                summary = parsed;
                                            }
                                        } catch (e) {
                                            // Ignore parse error
                                        }
                                    }

                                    // 2. Handle Object (Parsed or original)
                                    if (typeof summary === 'object' && summary !== null) {
                                        return summary.core_insight || "點擊查看詳情";
                                    }

                                    // 3. Handle String (Strip Markdown)
                                    if (typeof summary === 'string') {
                                        // Remove ## headings, bold markers (**), code blocks (```)
                                        return summary.replace(/##\s*|\*\*/g, '').replace(/`/g, '').trim();
                                    }

                                    return summary || "無摘要";
                                })()}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50 italic">
                            無 AI 摘要
                        </div>
                    )}
                </div>

                {/* Footer Info - Fixed at Bottom */}
                <div className="mt-auto pt-2 border-t border-white/20 flex items-center justify-between text-[9px] text-muted-foreground uppercase tracking-widest opacity-60 flex-shrink-0">
                    <span>已儲存 • {post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '剛剛'}</span>
                </div>
            </div>
        </motion.div>
    );
};

export default PostCard;
