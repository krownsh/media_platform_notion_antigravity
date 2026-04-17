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
    showSummary = false,
}) => {
    const { platform, title, screenshot, analysis, category } = post;
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [showMoveMenu, setShowMoveMenu] = useState(false);

    const dispatch = useDispatch();
    const { collections } = useSelector(state => state.posts);

    // Helper function to proxy Instagram/Threads images
    const proxyImage = (imageUrl) => {
        if (!imageUrl) return null;
        if (imageUrl.includes('instagram.') || imageUrl.includes('fbcdn.net')) {
            return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
        return imageUrl;
    };

    const getPlatformStyle = (p) => {
        const platformName = p?.toLowerCase();
        if (platformName === 'threads') return { icon: <ThreadsIcon size={14} className="text-[rgba(0,0,0,0.95)]" />, label: 'Threads' };
        if (platformName === 'instagram') return { icon: <Instagram size={14} className="text-pink-500" />, label: 'Instagram' };
        if (platformName === 'twitter' || platformName === 'x') return { icon: <Twitter size={14} className="text-blue-400" />, label: 'Twitter' };
        if (platformName === 'facebook') return { icon: <Facebook size={14} className="text-blue-600" />, label: 'Facebook' };
        if (platformName === 'youtube') return { icon: <Youtube size={14} className="text-red-600" />, label: 'YouTube' };
        if (platformName === 'notion') return { icon: <FileText size={14} className="text-[rgba(0,0,0,0.95)]" />, label: 'Notion' };
        return { icon: <Globe size={14} className="text-[#615d59]" />, label: 'Web Link' };
    };

    const platformStyle = getPlatformStyle(platform);
    const images = post.images && post.images.length > 0 ? post.images : (screenshot ? [screenshot] : []);
    const hasMultipleImages = images.length > 1;

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
            className="notion-card rounded-lg group relative mx-auto w-full sm:max-w-[420px] h-[640px] flex-shrink-0 flex flex-col cursor-pointer border notion-whisper-border shadow-soft-card hover:shadow-deep hover:-translate-y-1 transition-all duration-500 overflow-hidden"
            onMouseLeave={() => { setShowMenu(false); setShowMoveMenu(false); }}
        >
            {/* Platform Header (40px) */}
            <div className="flex-shrink-0 w-full h-10 px-4 flex items-center justify-between bg-white border-b notion-whisper-border">
                <div className="flex items-center gap-2">
                    {platformStyle.icon}
                    <span className="text-sm sm:text-[11px] font-bold uppercase tracking-wider text-[#615d59] leading-none">{platformStyle.label}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    <span className="text-sm sm:text-[11px] text-[#615d59]/80 font-medium leading-none">{post.collectionId ? collections.find(c => c.id === post.collectionId)?.name || '未分類' : '未分類'}</span>
                </div>
                {/* Menu Toggle */}
                <button
                    className="p-1.5 rounded-full hover:bg-black/5 text-[#615d59]"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>

            {/* Author Info (50px) */}
            <div className="flex-shrink-0 px-4 py-2 border-b notion-whisper-border h-[50px] flex items-center gap-2.5 bg-white">
                {post.avatar ? (
                    <img src={proxyImage(post.avatar)} alt={post.author} className="w-8 h-8 rounded-full object-cover border" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-xs font-bold">{post.author?.[0] || 'U'}</div>
                )}
                <div className="min-w-0">
                    <div className="text-sm font-semibold truncate leading-tight">{post.author || 'Unknown'}</div>
                    <div className="text-[12px] text-[#615d59]/80 truncate mt-0.5">@{post.authorHandle || 'unknown'}</div>
                </div>
            </div>

            {/* Image (180px) */}
            <div className="flex-shrink-0 w-full h-[180px] bg-black/5 overflow-hidden flex items-center justify-center relative">
                {images.length > 0 ? (
                    <img src={proxyImage(images[currentImageIndex])} className="w-full h-full object-cover" alt="Post content" />
                ) : (
                    <span className="text-[#615d59] text-sm">無圖片</span>
                )}
                {hasMultipleImages && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/20 text-[9px] text-white">
                        {currentImageIndex + 1} / {images.length}
                    </div>
                )}
            </div>

            {/* Action Bar (40px) */}
            <div className="flex-shrink-0 px-4 h-10 flex items-center justify-end border-b notion-whisper-border bg-white">
                <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#0075de] cursor-pointer" onClick={(e) => { e.stopPropagation(); onRemix && onRemix(post); }} />
                    <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <ExternalLink size={16} className="text-[#615d59]" />
                    </a>
                </div>
            </div>

            {/* --- Content Area (Total Remaining: 330px) --- */}
            <div className="flex-1 flex flex-col bg-white overflow-hidden">

                {/* 1. Main Content Container: STRICT FIXED 230px */}
                <div className="h-[230px] flex-shrink-0 px-4 py-3 overflow-hidden">
                    <div className="font-bold text-[rgba(0,0,0,0.95)] text-sm mb-1 leading-tight">{post.author}</div>
                    <div
                        className="text-base sm:text-[14px] text-[rgba(0,0,0,0.95)]/80 leading-snug whitespace-pre-wrap font-medium"
                        style={{ display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' }}
                    >
                        {(post.content || title || '').replace(/\n\s*\n/g, '\n').trim()}
                    </div>
                </div>

                {/* 2. Footer Container: STRICT FIXED 100px (Pinned to absolute bottom) */}
                <div className="mt-auto h-[100px] flex-shrink-0 px-4 py-2 flex flex-col justify-end bg-white border-t notion-whisper-border">
                    {/* Tags Area (Fixed 24px) */}
                    <div className="h-6 overflow-hidden flex items-center gap-1.5 mb-1.5">
                        {analysis?.tags && analysis.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-medium text-[rgba(0,0,0,0.95)]/70 border border-black/5">#{tag}</span>
                        ))}
                    </div>

                    {/* AI Info / Summary Area (Fixed 45px) */}
                    <div className="h-[45px] overflow-hidden">
                        {showSummary && analysis?.summary && (
                            <div className="bg-[#0075de]/5 rounded-md p-1.5 h-full flex flex-col justify-center border border-[#0075de]/10">
                                <div className="text-[9px] font-bold text-[#0075de] uppercase leading-none mb-1">AI 摘要</div>
                                <div className="text-[11px] text-[#615d59] leading-tight line-clamp-2">
                                    {(typeof analysis.summary === 'string' ? analysis.summary : (analysis.summary.core_insight || "點擊查看")).replace(/##\s*|\*\*/g, '')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Final Bottom Row (Fixed 20px) - PINNED TO THE VERY BOTTOM */}
                    <div className="h-5 flex items-center justify-between mt-auto">
                        <span className="text-[#0075de] text-[9px] font-bold uppercase tracking-tight">{analysis?.primary_category || ''}</span>
                        <div className="text-[10px] text-[#615d59] opacity-60 font-medium">{post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '剛剛'}</div>
                    </div>
                </div>
            </div>

            {/* --- Hidden Menu Overlay --- */}
            <AnimatePresence>
                {showMenu && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-white/95 flex flex-col p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <span className="font-bold">更多選項</span>
                            <MoreHorizontal className="cursor-pointer" onClick={() => setShowMenu(false)} />
                        </div>
                        <button className="flex items-center gap-2 p-3 hover:bg-black/5 rounded-lg text-destructive" onClick={() => { onDelete && onDelete(); setShowMenu(false); }}>
                            <Trash2 size={16} /> 刪除此貼文
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default PostCard;
