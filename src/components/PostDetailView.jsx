import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, MessageSquare, Share2, Sparkles, MoreHorizontal, ChevronLeft, ChevronRight, Instagram, Twitter, ArrowLeft } from 'lucide-react';
import { addAnnotation, fetchPosts } from '../features/postsSlice';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';


// Reusing ThreadsIcon from PostCard
const ThreadsIcon = ({ size = 12, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
        <path d="M12.0001 1.03125C5.93407 1.03125 1.03125 5.93407 1.03125 12C1.03125 18.0659 5.93407 22.9688 12.0001 22.9688C17.5519 22.9688 22.138 18.8681 22.8688 13.5356H19.8281C19.1672 17.2022 15.9159 20.0062 12.0001 20.0062C7.58447 20.0062 3.99384 16.4156 3.99384 12C3.99384 7.58447 7.58447 3.99384 12.0001 3.99384C16.4157 3.99384 20.0063 7.58447 20.0063 12C20.0063 13.7916 19.4182 15.4284 18.4219 16.7438C17.6531 17.7562 16.4157 18.375 15.0563 18.375C13.2563 18.375 11.9531 16.9688 11.9531 15.0938V12.2812H14.9063V15.0938C14.9063 15.4219 15.0282 15.5437 15.0563 15.5437C15.1969 15.5437 15.4688 15.3562 15.75 14.9812C16.2188 14.3531 16.4813 13.4344 16.4813 12C16.4813 9.52509 14.4751 7.51884 12.0001 7.51884C9.52509 7.51884 7.51884 9.52509 7.51884 12C7.51884 14.4751 9.52509 16.4813 12.0001 16.4813C13.2094 16.4813 14.3063 16.0031 15.1219 15.2156L17.2126 17.325C15.8626 18.6656 14.0251 19.4438 12.0001 19.4438C7.88447 19.4438 4.55634 16.1157 4.55634 12C4.55634 7.88447 7.88447 4.55634 12.0001 4.55634C16.1157 4.55634 19.4438 7.88447 19.4438 12C19.4438 18.2344 14.8594 23.5312 8.71884 23.5312V26.4938C16.4532 26.4938 22.4063 19.9219 22.4063 12C22.4063 6.25322 17.7469 1.59384 12.0001 1.59384C6.25322 1.59384 1.59384 6.25322 1.59384 12C1.59384 17.7469 6.25322 22.4063 12.0001 22.4063C13.3594 22.4063 14.6626 22.1438 15.8719 21.6656L14.7844 18.8531C13.9126 19.1438 12.9751 19.3031 12.0001 19.3031V22.9688Z" />
    </svg>
);

// Helper function to proxy Instagram/Threads images
const proxyImage = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.includes('instagram.') || imageUrl.includes('fbcdn.net')) {
        return `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    }
    return imageUrl;
};

const CommentItem = ({ comment, depth = 0, onImageClick }) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const authorName = comment.user || comment.author;
    const images = comment.images || [];

    return (
        <div className={`flex flex-col ${depth === 0 ? 'bg-secondary/10 p-4 rounded-2xl' : 'mt-2'}`}>
            {authorName && (
                <div className="mb-1">
                    <span className="text-xs font-bold text-foreground/70">{authorName}</span>
                </div>
            )}
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words">
                {comment.text}
            </p>

            {/* Render Comment Images */}
            {images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                        <img
                            key={idx}
                            src={proxyImage(img)}
                            alt="Comment attachment"
                            className="max-h-48 rounded-lg object-contain border border-border/20 cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onImageClick(img);
                            }}
                        />
                    ))}
                </div>
            )}

            {hasReplies && (
                <div className="border-l-2 border-border/30 ml-0.5 pl-3 mt-2">
                    {comment.replies.map((reply, idx) => (
                        <CommentItem key={idx} comment={reply} depth={depth + 1} onImageClick={onImageClick} />
                    ))}
                </div>
            )}
        </div>
    );
};

const PostDetailView = () => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [noteInput, setNoteInput] = useState('');
    const [zoomedImage, setZoomedImage] = useState(null);

    // Get the post data from Redux store
    const { items, loading } = useSelector(state => state.posts);
    const post = items.find(p => p.id === postId || p.dbId === postId);

    // Fetch posts if not found (e.g., direct link or refresh)
    useEffect(() => {
        if (!post && !loading && items.length === 0) {
            dispatch(fetchPosts());
        }
    }, [post, loading, items.length, dispatch]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (zoomedImage) setZoomedImage(null);
                else navigate(-1);
            }
            if (!zoomedImage && post) {
                const images = post.images && post.images.length > 0 ? post.images : (post.screenshot ? [post.screenshot] : []);
                if (e.key === 'ArrowLeft' && currentImageIndex > 0) setCurrentImageIndex(prev => prev - 1);
                if (e.key === 'ArrowRight' && currentImageIndex < images.length - 1) setCurrentImageIndex(prev => prev + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentImageIndex, zoomedImage, post, navigate]);

    if (!post) {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-lg text-muted-foreground">找不到貼文</p>
                <button onClick={() => navigate('/')} className="text-accent hover:underline">返回首頁</button>
            </div>
        );
    }

    const { platform, title, screenshot, analysis } = post;

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
    const comments = post.comments || [];

    const handleSaveNote = async () => {
        if (!noteInput.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                alert('請先登入才能新增筆記');
                return;
            }

            const dbPostId = post.dbId || post.id;

            dispatch(addAnnotation({
                postId: dbPostId,
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-col min-h-screen gap-8 pb-20"
        >
            {/* Back Button Area */}
            <div
                className="flex-shrink-0 w-full cursor-pointer py-2 group"
                onClick={() => navigate(-1)}
            >
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                    <ArrowLeft size={20} />
                    <span className="text-sm font-medium">返回</span>
                </div>
            </div>

            {/* Main Content Area - 3 Columns Unified */}
            <div className="flex flex-col md:flex-row md:h-[80vh] h-auto flex-shrink-0 bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 shadow-xl overflow-hidden">
                {/* Left Column: Image (30%) - Only show if images exist */}
                {images.length > 0 && (
                    <div className="w-full md:w-[30%] h-[50vh] md:h-full bg-black/5 relative flex items-center justify-center border-b md:border-b-0 md:border-r border-white/20 group">
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            <motion.div
                                className="flex w-full h-full"
                                animate={{ x: `-${currentImageIndex * 100}%` }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            >
                                {images.map((img, idx) => (
                                    <div key={idx} className="w-full h-full flex-shrink-0 flex items-center justify-center p-4">
                                        <img
                                            src={proxyImage(img)}
                                            alt={`${title} - ${idx + 1}`}
                                            className="max-w-full max-h-full object-contain"
                                            draggable={false}
                                            onClick={() => setZoomedImage(img)}
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
                                            className="absolute left-4 p-2 rounded-full bg-white/80 text-foreground hover:bg-white transition-colors opacity-0 group-hover:opacity-100 shadow-md z-10"
                                        >
                                            <ChevronLeft size={24} />
                                        </button>
                                    )}
                                    {currentImageIndex < images.length - 1 && (
                                        <button
                                            onClick={nextImage}
                                            className="absolute right-4 p-2 rounded-full bg-white/80 text-foreground hover:bg-white transition-colors opacity-0 group-hover:opacity-100 shadow-md z-10"
                                        >
                                            <ChevronRight size={24} />
                                        </button>
                                    )}

                                    {/* Dots */}
                                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-1.5 rounded-full bg-black/10 backdrop-blur-sm z-10">
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
                    </div>
                )}

                {/* Middle Column: Content & Comments (45% or 60%) */}
                <div className={`w-full ${images.length > 0 ? 'md:w-[45%]' : 'md:w-[60%]'} h-[60vh] md:h-full bg-white/20 flex flex-col border-b md:border-b-0 md:border-r border-white/20 transition-all duration-300`}>
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

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 custom-scrollbar">
                        {/* Caption/Post Content */}
                        <div className="mb-6">
                            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-medium break-words">
                                {(() => {
                                    const text = post.content || title || '';
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

                        {/* Comments Section */}
                        {comments.length > 0 && (
                            <>
                                <div className="h-px bg-border/20 my-4" />
                                <div className="space-y-4">
                                    {comments.map((comment, idx) => (
                                        <CommentItem key={idx} comment={comment} onImageClick={setZoomedImage} />
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

                {/* Right Column: AI Summary (25% or 40%) */}
                <div className={`w-full ${images.length > 0 ? 'md:w-[25%]' : 'md:w-[40%]'} h-auto md:h-full bg-accent/5 flex flex-col transition-all duration-300`}>
                    {/* AI Summary Header */}
                    <div className="p-5 border-b border-accent/10 flex-shrink-0 bg-gradient-to-b from-accent/10 to-transparent">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-accent" />
                            <span className="text-sm font-bold text-accent uppercase tracking-wider">AI 摘要</span>
                        </div>
                    </div>

                    {/* AI Summary Content */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 custom-scrollbar">
                        {analysis?.summary ? (
                            <div className="space-y-4">
                                {(() => {
                                    let data = analysis.summary;
                                    // Try to parse if it's a string that looks like JSON
                                    if (typeof data === 'string' && (data.trim().startsWith('{') || data.includes('```json'))) {
                                        try {
                                            const cleanJson = data.replace(/```json\s*|\s*```/g, '').trim();
                                            data = JSON.parse(cleanJson);
                                        } catch (e) {
                                            // Keep as string if parse fails
                                        }
                                    }

                                    if (typeof data === 'object' && data !== null) {
                                        return (
                                            <div className="bg-white/60 border border-white/50 rounded-2xl p-5 shadow-sm text-foreground/90">
                                                {/* Core Insight */}
                                                {data.core_insight && (
                                                    <div className="mb-6">
                                                        <h4 className="flex items-center gap-2 text-sm font-bold text-accent uppercase tracking-wider mb-2">
                                                            <Sparkles size={14} />
                                                            核心洞察
                                                        </h4>
                                                        <p className="text-sm leading-relaxed font-medium">
                                                            {data.core_insight}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Key Points */}
                                                {data.key_points && data.key_points.length > 0 && (
                                                    <div className="mb-6">
                                                        <h4 className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-3">關鍵要點</h4>
                                                        <ul className="space-y-2">
                                                            {data.key_points.map((point, idx) => (
                                                                <li key={idx} className="text-sm flex items-start gap-2 leading-relaxed">
                                                                    <span className="font-bold text-accent mt-0.5">•</span>
                                                                    <span>{point}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Actionable Knowledge */}
                                                {data.actionable_knowledge && (
                                                    <div className="mb-6">
                                                        <h4 className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-2">實用知識</h4>
                                                        <p className="text-sm leading-relaxed">
                                                            {data.actionable_knowledge}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Tags */}
                                                {data.tags && data.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/10">
                                                        {data.tags.map((tag, idx) => (
                                                            <span key={idx} className="text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        // Fallback for raw string
                                        let content = typeof data === 'string' ? data : JSON.stringify(data);
                                        // Strip Markdown syntax (headers, bold, code blocks)
                                        if (typeof content === 'string') {
                                            content = content.replace(/##\s*|###\s*|\*\*/g, '').replace(/`/g, '').trim();
                                        }

                                        return (
                                            <div className="bg-white/60 border border-white/50 rounded-2xl p-5 shadow-sm">
                                                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
                                                    {content}
                                                </p>
                                            </div>
                                        );
                                    }
                                })()}

                                {analysis?.sentiment && (
                                    <div className="bg-white/60 border border-white/50 rounded-2xl p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-accent uppercase tracking-wider mb-2">情緒分析</h4>
                                        <p className="text-xs text-muted-foreground break-words">{analysis.sentiment}</p>
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

            {/* Bottom Section: Notes (Reorganized) */}
            <div className="h-[100vh] flex-shrink-0 bg-amber-50/50 rounded-3xl border border-amber-100/50 flex flex-col shadow-sm overflow-hidden">
                {/* Top Row: Input and Save */}
                <div className="p-4 border-b border-amber-100/50 flex gap-3 items-start bg-white/30">
                    <div className="p-1.5 rounded-lg bg-amber-100/50 text-amber-600 flex-shrink-0 mt-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <textarea
                        placeholder="添加我的筆記..."
                        className="flex-1 bg-white/50 border border-white/50 rounded-xl px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-amber-400/50 focus:bg-white/80 transition-all shadow-inner resize-none custom-scrollbar"
                        rows={5}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleSaveNote();
                            }
                        }}
                    />
                    <button
                        onClick={handleSaveNote}
                        disabled={!noteInput.trim()}
                        className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm whitespace-nowrap mt-1"
                    >
                        儲存
                    </button>
                </div>

                {/* Bottom Area: Notes List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {post.annotations && post.annotations.length > 0 ? (
                        <div className="space-y-2">
                            {post.annotations.map((note, idx) => (
                                <div key={idx} className="p-3 rounded-xl bg-white/60 border border-white/50 shadow-sm flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm text-foreground/80 leading-relaxed">{note.content}</p>
                                        <div className="mt-1 text-[10px] text-muted-foreground">
                                            {new Date(note.created_at).toLocaleDateString(undefined, {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50 italic text-sm">
                            <p>尚未新增筆記</p>
                            <p className="text-xs mt-1 opacity-70">在上方輸入並按下 Enter 鍵</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Zoomed Image Overlay */}
            <AnimatePresence>
                {zoomedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
                        onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImage(null);
                        }}
                    >
                        <button
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                            onClick={() => setZoomedImage(null)}
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={proxyImage(zoomedImage)}
                            alt="Zoomed comment"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default PostDetailView;
