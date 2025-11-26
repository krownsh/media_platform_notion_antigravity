import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, MessageSquare, Share2, Sparkles, MoreHorizontal, ChevronLeft, ChevronRight, Instagram, Twitter } from 'lucide-react';
import { addAnnotation } from '../features/postsSlice';
import { supabase } from '../api/supabaseClient';

// Reusing ThreadsIcon from PostCard
const ThreadsIcon = ({ size = 12, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M12.0001 1.03125C5.93407 1.03125 1.03125 5.93407 1.03125 12C1.03125 18.0659 5.93407 22.9688 12.0001 22.9688C17.5519 22.9688 22.138 18.8681 22.8688 13.5356H19.8281C19.1672 17.2022 15.9159 20.0062 12.0001 20.0062C7.58447 20.0062 3.99384 16.4156 3.99384 12C3.99384 7.58447 7.58447 3.99384 12.0001 3.99384C16.4157 3.99384 20.0063 7.58447 20.0063 12C20.0063 13.7916 19.4182 15.4284 18.4219 16.7438C17.6531 17.7562 16.4157 18.375 15.0563 18.375C13.2563 18.375 11.9531 16.9688 11.9531 15.0938V12.2812H14.9063V15.0938C14.9063 15.4219 15.0282 15.5437 15.0563 15.5437C15.1969 15.5437 15.4688 15.3562 15.75 14.9812C16.2188 14.3531 16.4813 13.4344 16.4813 12C16.4813 9.52509 14.4751 7.51884 12.0001 7.51884C9.52509 7.51884 7.51884 9.52509 7.51884 12C7.51884 14.4751 9.52509 16.4813 12.0001 16.4813C13.2094 16.4813 14.3063 16.0031 15.1219 15.2156L17.2126 17.325C15.8626 18.6656 14.0251 19.4438 12.0001 19.4438C7.88447 19.4438 4.55634 16.1157 4.55634 12C4.55634 7.88447 7.88447 4.55634 12.0001 4.55634C16.1157 4.55634 19.4438 7.88447 19.4438 12C19.4438 18.2344 14.8594 23.5312 8.71884 23.5312V26.4938C16.4532 26.4938 22.4063 19.9219 22.4063 12C22.4063 6.25322 17.7469 1.59384 12.0001 1.59384C6.25322 1.59384 1.59384 6.25322 1.59384 12C1.59384 17.7469 6.25322 22.4063 12.0001 22.4063C13.3594 22.4063 14.6626 22.1438 15.8719 21.6656L14.7844 18.8531C13.9126 19.1438 12.9751 19.3031 12.0001 19.3031V22.9688Z" />
    </svg>
);

const CommentItem = ({ comment, depth = 0 }) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const authorName = comment.user || comment.author;

    return (
        <div className={`flex flex-col ${depth === 0 ? 'bg-secondary/10 p-4 rounded-2xl' : 'mt-2'}`}>
            {authorName && (
                <div className="mb-1">
                    <span className="text-xs font-bold text-foreground/70">{authorName}</span>
                </div>
            )}
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {comment.text}
            </p>

            {hasReplies && (
                <div className="border-l-2 border-border/30 ml-0.5 pl-3 mt-2">
                    {comment.replies.map((reply, idx) => (
                        <CommentItem key={idx} comment={reply} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

const PostDetailView = ({ post: initialPost, onClose }) => {
    const dispatch = useDispatch();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [noteInput, setNoteInput] = useState('');

    // Get the latest post data from Redux store
    const latestPost = useSelector(state => {
        const postId = initialPost.dbId || initialPost.id;
        return state.posts.items.find(p => p.id === postId || p.dbId === postId) || initialPost;
    });

    // Use latest post data (which includes updated annotations)
    const post = latestPost;
    const { platform, title, screenshot, analysis } = post;

    // Helper function to proxy Instagram/Threads images
    const proxyImage = (imageUrl) => {
        if (!imageUrl) return null;
        if (imageUrl.includes('instagram.') || imageUrl.includes('fbcdn.net')) {
            return `http://localhost:3001/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
        }
        return imageUrl;
    };

    const getPlatformStyle = (p) => {
        const platformName = p?.toLowerCase();
        if (platformName === 'instagram') {
            return {
                icon: <Instagram size={14} className="text-pink-500" />,
                label: 'Instagram',
            };
        }
        if (platformName === 'twitter' || platformName === 'x') {
            return {
                icon: <Twitter size={14} className="text-blue-400" />,
                label: 'X',
            };
        }
        return {
            icon: <ThreadsIcon size={14} className="text-foreground" />,
            label: 'Threads',
        };
    };

    const platformStyle = getPlatformStyle(platform);
    const images = post.images && post.images.length > 0 ? post.images : (screenshot ? [screenshot] : []);

    // Use actual comments or empty array
    const comments = post.comments || [];

    // Handle saving note
    const handleSaveNote = async () => {
        if (!noteInput.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('請先登入才能新增筆記');
                return;
            }

            const postId = post.dbId || post.id;

            dispatch(addAnnotation({
                postId,
                content: noteInput.trim(),
                userId: user.id
            }));

            setNoteInput('');
        } catch (error) {
            console.error('Error saving note:', error);
            alert('儲存筆記時發生錯誤：' + error.message);
        }
    };

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

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prevImage(e);
            if (e.key === 'ArrowRight') nextImage(e);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentImageIndex, images.length]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-xl p-4 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.4, ease: [0.25, 0.8, 0.3, 1] }}
                className="relative w-full max-w-7xl h-[85vh] bg-white/80 border border-white/50 rounded-3xl overflow-hidden flex flex-col shadow-2xl backdrop-blur-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/50 text-foreground/70 hover:text-foreground hover:bg-white/80 transition-colors shadow-sm"
                >
                    <X size={20} />
                </button>

                {/* Top Section - My Notes (Full Width) */}
                <div className="w-full border-b border-border/20 bg-gradient-to-b from-amber-50/50 to-transparent flex-shrink-0">
                    <div className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-1.5 rounded-lg bg-amber-100/50 text-amber-600">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider">我的筆記</h3>
                        </div>

                        {/* Notes Display Area */}
                        {post.annotations && post.annotations.length > 0 ? (
                            <div className="space-y-2 mb-3 max-h-[120px] overflow-y-auto custom-scrollbar">
                                {post.annotations.map((note, idx) => (
                                    <div key={idx} className="p-3 rounded-xl bg-white/40 border border-white/50 shadow-sm">
                                        <p className="text-sm text-foreground/80 leading-relaxed">{note.content}</p>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {new Date(note.created_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mb-3 p-3 rounded-xl bg-white/40 border border-white/50 text-center shadow-sm">
                                <p className="text-xs text-muted-foreground italic">尚未新增筆記</p>
                            </div>
                        )}

                        {/* Note Input */}
                        <div className="relative">
                            <textarea
                                placeholder="添加我的筆記..."
                                className="w-full bg-white/50 border border-white/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-400/50 focus:bg-white/80 transition-all resize-none shadow-inner"
                                rows={2}
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                        handleSaveNote();
                                    }
                                }}
                            />
                            <button
                                onClick={handleSaveNote}
                                disabled={!noteInput.trim()}
                                className="absolute right-3 bottom-3 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                儲存
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Section - Three Columns */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    <div className="w-full md:w-[45%] h-[40vh] md:h-full bg-secondary/5 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-border/20 group overflow-hidden">
                        {images.length > 0 ? (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <motion.div
                                    className="flex w-full h-full"
                                    animate={{ x: `-${currentImageIndex * 100}%` }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                >
                                    {images.map((img, idx) => (
                                        <div key={idx} className="w-full h-full flex-shrink-0 flex items-center justify-center bg-black/5">
                                            <img
                                                src={proxyImage(img)}
                                                alt={`${title} - ${idx + 1}`}
                                                className="max-w-full max-h-full object-contain"
                                                draggable={false}
                                            />
                                        </div>
                                    ))}
                                </motion.div>

                                {/* Navigation Controls */}
                                {images.length > 1 && (
                                    <>
                                        {currentImageIndex > 0 && (
                                            <button
                                                onClick={prevImage}
                                                className="absolute left-4 p-2 rounded-full bg-white/80 text-foreground hover:bg-white transition-colors opacity-0 group-hover:opacity-100 shadow-md"
                                            >
                                                <ChevronLeft size={24} />
                                            </button>
                                        )}
                                        {currentImageIndex < images.length - 1 && (
                                            <button
                                                onClick={nextImage}
                                                className="absolute right-4 p-2 rounded-full bg-white/80 text-foreground hover:bg-white transition-colors opacity-0 group-hover:opacity-100 shadow-md"
                                            >
                                                <ChevronRight size={24} />
                                            </button>
                                        )}

                                        {/* Dots */}
                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-1.5 rounded-full bg-black/10 backdrop-blur-sm">
                                            {images.map((_, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="text-muted-foreground">無圖片</div>
                        )}
                    </div>

                    {/* Middle - Comments Section (30%) */}
                    <div className="w-full md:w-[30%] h-full flex flex-col bg-white/40 border-r border-border/20">
                        {/* Header */}
                        <div className="p-5 border-b border-border/20 flex items-center justify-between flex-shrink-0 bg-white/20 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                {post.avatar ? (
                                    <img src={proxyImage(post.avatar)} alt={post.author} className="w-9 h-9 rounded-full object-cover border border-white/50 shadow-sm" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-secondary to-primary flex items-center justify-center text-xs font-bold text-foreground border border-white/50 shadow-sm">
                                        {post.author?.[0] || 'U'}
                                    </div>
                                )}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-foreground">{post.author || 'Unknown'}</span>
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-secondary/20 border border-secondary/30">
                                            {platformStyle.icon}
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-none">
                                                {platformStyle.label}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">@{post.authorHandle || 'unknown'}</span>
                                </div>
                            </div>
                            <button className="text-muted-foreground hover:text-foreground transition-colors">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>

                        {/* Scrollable Comments Area */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {/* Caption/Post Content */}
                            <div className="mb-6">
                                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium">
                                    {(() => {
                                        const text = post.content || title || '';
                                        // Regex to find URLs (http/https)
                                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                                        const parts = text.split(urlRegex);

                                        return parts.map((part, i) => {
                                            if (part.match(urlRegex)) {
                                                return (
                                                    <a
                                                        key={i}
                                                        href={part}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-accent hover:text-accent/80 hover:underline break-all"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {part}
                                                    </a>
                                                );
                                            }
                                            return part;
                                        });
                                    })()}
                                </p>
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {post.postedAt ? new Date(post.postedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '剛剛'}
                                </div>
                            </div>

                            {/* Comments Section - Only show if there are comments */}
                            {comments.length > 0 && (
                                <>
                                    <div className="h-px bg-border/20 my-4" />
                                    <div className="space-y-4">
                                        {comments.map((comment, idx) => (
                                            <CommentItem key={idx} comment={comment} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-4 border-t border-border/20 bg-white/30 flex-shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="新增留言..."
                                    className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
                                />
                                <button className="absolute right-0 top-0 text-sm font-semibold text-accent hover:text-accent/80">
                                    發佈
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Side - AI Summary Section (25%) */}
                    <div className="w-full md:w-[25%] h-full flex flex-col bg-accent/5">
                        {/* AI Summary Header */}
                        <div className="p-5 border-b border-accent/10 flex-shrink-0 bg-gradient-to-b from-accent/10 to-transparent">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-accent" />
                                <span className="text-sm font-bold text-accent uppercase tracking-wider">AI 摘要</span>
                            </div>
                        </div>

                        {/* AI Summary Content */}
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                            {analysis?.summary ? (
                                <div className="space-y-4">
                                    <div className="bg-white/60 border border-white/50 rounded-2xl p-4 shadow-sm">
                                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                            {analysis.summary}
                                        </p>
                                    </div>

                                    {/* Additional AI Insights */}
                                    {analysis?.keyPoints && analysis.keyPoints.length > 0 && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-accent uppercase tracking-wider">重點整理</h4>
                                            <ul className="space-y-2">
                                                {analysis.keyPoints.map((point, idx) => (
                                                    <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                                                        <span className="text-accent mt-0.5">•</span>
                                                        <span>{point}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {analysis?.sentiment && (
                                        <div className="bg-white/60 border border-white/50 rounded-2xl p-4 shadow-sm">
                                            <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-2">情緒分析</h4>
                                            <p className="text-xs text-muted-foreground">{analysis.sentiment}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center text-muted-foreground/50">
                                        <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-xs">無 AI 分析</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PostDetailView;
