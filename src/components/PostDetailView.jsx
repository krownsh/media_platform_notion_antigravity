import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, Heart, MessageSquare, Share2, Sparkles, MoreHorizontal, ChevronLeft, ChevronRight, Instagram, Twitter, ArrowLeft, Library, Image as ImageIcon } from 'lucide-react';
import { addAnnotation, fetchPosts } from '../features/postsSlice';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';
import PocWorkbenchPanel from './PocWorkbenchPanel';
import PocResultPanel from './PocResultPanel';
import AuthorInitialAvatar from './AuthorInitialAvatar';


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
        <div className={`flex flex-col ${depth === 0 ? 'bg-[var(--surface-muted)] p-4 rounded-xl border border-[var(--border)]' : 'mt-2'}`}>
            {authorName && (
                <div className="mb-1">
                    <span className="text-xs font-bold text-[var(--foreground)]/70">{authorName}</span>
                </div>
            )}
            <p className="text-sm text-[var(--foreground)]/90 leading-relaxed whitespace-pre-wrap break-words">
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
                            className="max-h-48 rounded-xl object-contain border border-[var(--border)] cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onImageClick(img);
                            }}
                        />
                    ))}
                </div>
            )}

            {hasReplies && (
                <div className="border-l-2 border-[var(--border)] ml-0.5 pl-3 mt-2">
                    {comment.replies.map((reply, idx) => (
                        <CommentItem key={idx} comment={reply} depth={depth + 1} onImageClick={onImageClick} />
                    ))}
                </div>
            )}
        </div>
    );
};

const PostDetailView = ({ onRemix }) => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [noteInput, setNoteInput] = useState('');
    const [zoomedImage, setZoomedImage] = useState(null);
    const [isNoteOpen, setIsNoteOpen] = useState(false);

    // Get the post data from Redux store
    const { items, loading, initialized } = useSelector(state => state.posts);
    const post = items.find(p => p.id === postId || p.dbId === postId);

    // Fetch posts if not found (e.g., direct link or refresh)
    useEffect(() => {
        if (!post && !loading && !initialized) {
            dispatch(fetchPosts());
        }
    }, [post, loading, initialized, dispatch]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (zoomedImage) setZoomedImage(null);
                else isNoteOpen ? setIsNoteOpen(false) : navigate(-1);
            }
            if (!zoomedImage && post && !isNoteOpen) {
                const images = post.images && post.images.length > 0 ? post.images : (post.screenshot ? [post.screenshot] : []);
                if (e.key === 'ArrowLeft' && currentImageIndex > 0) setCurrentImageIndex(prev => prev - 1);
                if (e.key === 'ArrowRight' && currentImageIndex < images.length - 1) setCurrentImageIndex(prev => prev + 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentImageIndex, zoomedImage, post, navigate, isNoteOpen]);

    if (!post) {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full p-6" aria-busy="true">
                    <div className="flow-surface w-full max-w-md p-5 space-y-3">
                        <div className="flow-shimmer h-3 w-20 rounded-full" />
                        <div className="flow-shimmer h-7 w-3/4 rounded-md" />
                        <div className="flow-shimmer h-32 rounded-xl" />
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                <div className="flow-surface max-w-md p-8">
                    <p className="text-lg font-semibold text-[var(--foreground)]">找不到貼文</p>
                    <p className="mt-2 text-sm text-[var(--muted-foreground)]">它可能已移動、尚未同步，或目前沒有存取權。</p>
                    <button onClick={() => navigate('/')} className="notion-btn-secondary mt-5">返回首頁</button>
                </div>
            </div>
        );
    }

    const { platform, title, screenshot, analysis, annotations } = post;

    const getPlatformStyle = (p) => {
        const platformName = p?.toLowerCase();
        if (platformName === 'instagram') {
            return {
                icon: <Instagram size={14} className="text-pink-500" />,
                label: 'Instagram',
            };
        }
        if (platformName === 'twitter' || platformName === 'x' || platformName === 'github') {
            return {
                icon: platformName === 'github' ? <Share2 size={14} /> : <Twitter size={14} className="text-blue-400" />,
                label: platformName.toUpperCase(),
            };
        }
        if (platformName === 'image') {
            return {
                icon: <ImageIcon size={14} className="text-violet-600" />,
                label: 'IMAGE',
            };
        }
        return {
            icon: <ThreadsIcon size={14} className="text-[rgba(0,0,0,0.95)]" />,
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

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col min-h-[100dvh] md:h-[calc(100vh-40px)] md:max-h-[calc(100vh-40px)] md:overflow-hidden overflow-x-hidden"
        >
            {/* --- Top Header / Navigation --- */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 sm:py-4 px-2 flex-shrink-0 gap-3 sm:gap-4">
                <div
                    className="flex items-center gap-1.5 sm:gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors group min-h-11 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-muted)]"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs sm:text-sm font-medium">返回</span>
                    <span className="mx-1 sm:mx-2 text-neutral-300">/</span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {platformStyle.icon}
                        <span className="text-[10px] sm:text-xs font-semibold text-neutral-500 truncate max-w-[80px] sm:max-w-none">{platformStyle.label}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
                    <button
                        onClick={() => onRemix && onRemix(post)}
                        className="notion-btn-secondary flex items-center gap-2 py-1.5 px-3 text-xs sm:text-sm"
                    >
                        <Sparkles size={16} />
                        AI 改寫
                    </button>
                    <button
                        onClick={() => setIsNoteOpen(true)}
                        className="notion-btn-primary flex items-center gap-2 py-1.5 px-3 text-xs sm:text-sm"
                    >
                        <Library size={16} />
                        <span>筆記 ({annotations?.length || 0})</span>
                    </button>
                </div>
            </div>

            {/* --- Main Content Layout --- */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 md:overflow-hidden pb-4">

                {/* 1. Left Section: Instagram Style (Image top, Content bottom) */}
                <div className="flex-[3] flex flex-col flow-surface overflow-hidden">
                    {/* User Header */}
                    <div className="p-4 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <AuthorInitialAvatar name={post.author} size="lg" />
                            <div>
                                <p className="text-sm font-bold text-[var(--foreground)]">{post.author || 'Unknown'}</p>
                                <p className="text-xs text-[var(--muted-foreground)]">@{post.authorHandle || 'unknown'}</p>
                            </div>
                        </div>
                        <button aria-label="更多貼文操作" className="flow-icon-button">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>

                    {/* Scrollable Area for Image and Content */}
                    <div className="flex-1 md:overflow-y-auto custom-scrollbar">
                        {/* Image(s) at Top */}
                        {images.length > 0 && (
                            <div className="relative bg-[var(--surface-muted)] border-b border-[var(--border)] group">
                                <div className="max-w-3xl mx-auto py-2">
                                    <div className="relative aspect-auto flex items-center justify-center overflow-hidden">
                                        <Motion.div
                                            className="flex w-full"
                                            animate={{ x: `-${currentImageIndex * 100}%` }}
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        >
                                            {images.map((img, idx) => (
                                                <div key={idx} className="w-full flex-shrink-0 flex items-center justify-center">
                                                    <img
                                                        src={proxyImage(img)}
                                                        alt={`${title} - ${idx + 1}`}
                                                        className="max-w-full max-h-[60vh] object-contain shadow-soft-card cursor-zoom-in rounded-sm"
                                                        onClick={() => setZoomedImage(img)}
                                                    />
                                                </div>
                                            ))}
                                        </Motion.div>

                                        {images.length > 1 && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (currentImageIndex > 0) setCurrentImageIndex(i => i - 1) }}
                                                    aria-label="上一張圖片"
                                                    className="absolute left-2 sm:left-4 flow-icon-button bg-[var(--surface-raised)]/95 shadow-soft-card opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                    disabled={currentImageIndex === 0}
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (currentImageIndex < images.length - 1) setCurrentImageIndex(i => i + 1) }}
                                                    aria-label="下一張圖片"
                                                    className="absolute right-2 sm:right-4 flow-icon-button bg-[var(--surface-raised)]/95 shadow-soft-card opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                                    disabled={currentImageIndex === images.length - 1}
                                                >
                                                    <ChevronRight size={20} />
                                                </button>
                                                <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1 rounded-full bg-black/20">
                                                    {images.map((_, i) => (
                                                        <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentImageIndex ? 'bg-white' : 'bg-white/40'}`} />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content below Image */}
                        <div className="p-4 sm:p-6 max-w-2xl mx-auto">
                            <div className="flex items-center gap-3 sm:gap-4 mb-4">
                                <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                                    <Heart size={20} />
                                    <MessageSquare size={20} />
                                    <Share2 size={20} />
                                </div>
                            </div>

                            <h1 className="text-lg font-bold text-[var(--foreground)] mb-4">{title}</h1>

                            <p className="text-base text-[var(--foreground)]/90 leading-relaxed whitespace-pre-wrap mb-6">
                                {(() => {
                                    const text = post.content || '';
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
                                                    className="text-[var(--accent)] hover:underline break-all"
                                                >
                                                    {part}
                                                </a>
                                            );
                                        }
                                        return part;
                                    });
                                })()}
                            </p>

                            <div className="text-xs text-[var(--muted-foreground)] mb-8 pb-8 border-b border-[var(--border)] tracking-[0.16em]">
                                {post.postedAt ? new Date(post.postedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '剛剛'}
                            </div>

                            {/* Comments inside the scrollable area */}
                            {comments.length > 0 && (
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-[var(--muted-foreground)] tracking-[0.16em] mb-4">留言回覆</h3>
                                    {comments.map((comment, idx) => (
                                        <CommentItem key={idx} comment={comment} onImageClick={setZoomedImage} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Right Section: AI Summary */}
                <div className="flex-1 w-full lg:min-w-[320px] lg:max-w-[400px] flex flex-col flow-surface overflow-hidden mt-0 lg:mt-0">
                    <div className="p-5 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--surface-raised)]">
                        <Sparkles size={16} className="text-[var(--accent)]" />
                        <span className="text-sm font-bold text-[var(--foreground)] tracking-wide">AI 知識摘要</span>
                    </div>

                    <div className="flex-1 md:overflow-y-auto p-5 custom-scrollbar">
                        <PocResultPanel insights={analysis?.insights} />
                        <PocWorkbenchPanel postId={post.dbId || post.id} />

                        {analysis?.summary ? (
                            <div className="mt-6 space-y-6">
                                {(() => {
                                    let data = analysis.summary;
                                    if (typeof data === 'string' && (data.trim().startsWith('{') || data.includes('```json'))) {
                                        try {
                                            const cleanJson = data.replace(/```json\s*|\s*```/g, '').trim();
                                            data = JSON.parse(cleanJson);
                                        } catch {
                                            data = analysis.summary;
                                        }
                                    }

                                    if (!data) return <p className='text-sm text-neutral-400 italic'>無效的摘要結構</p>;

                                    if (typeof data === 'object' && data !== null) {
                                        return (
                                            <>
                                                {data.core_insight && (
                                                    <div className="flow-panel p-5">
                                                        <h4 className="text-[10px] tracking-[0.16em] font-bold text-[var(--accent)] mb-3">核心洞察</h4>
                                                        <p className="text-sm font-medium leading-relaxed text-[var(--foreground)]">{data.core_insight}</p>
                                                    </div>
                                                )}
                                                {data.key_points && (
                                                    <div className="flow-panel p-5">
                                                        <h4 className="text-[10px] tracking-[0.16em] font-bold text-[var(--muted-foreground)] mb-3">關鍵要點</h4>
                                                        <ul className="space-y-3">
                                                            {data.key_points.map((p, i) => (
                                                                <li key={i} className="text-sm text-[var(--foreground)]/80 flex gap-2 leading-relaxed">
                                                                    <span className="text-[var(--accent)] font-bold">•</span>
                                                                    <span>{p}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {data.actionable_knowledge && (
                                                    <div className="bg-[var(--accent-soft)] p-5 rounded-xl border border-[var(--border)]">
                                                        <h4 className="text-[10px] tracking-[0.16em] font-bold text-[var(--accent)] mb-3">實用建議</h4>
                                                        <p className="text-sm leading-relaxed text-[var(--foreground)]">{data.actionable_knowledge}</p>
                                                    </div>
                                                )}
                                                {data.tags && (
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {data.tags.map((t, i) => (
                                                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface-muted)] text-[var(--muted-foreground)] border border-[var(--border)] inline-flex items-center min-h-9">#{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    }
                                    return <p className="text-sm text-[var(--foreground)]/75 leading-relaxed whitespace-pre-wrap">{typeof data === 'string' ? data : JSON.stringify(data)}</p>;
                                })()}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-[var(--muted-foreground)]">
                                <Sparkles size={40} className="mb-2" />
                                <p className="text-sm">尚未產生 AI 摘要</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- Notes Drawer (Collapsible Right Side Overlay) --- */}
            <AnimatePresence>
                {isNoteOpen && (
                    <>
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsNoteOpen(false)}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
                        />
                        <Motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-none sm:max-w-[450px] bg-[var(--surface)] shadow-deep rounded-none sm:rounded-l-2xl z-[110] flex flex-col overflow-hidden"
                        >
                            <div className="p-4 sm:p-6 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0 bg-[var(--surface-raised)]/90 backdrop-blur-md gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                                        <Library size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-[var(--foreground)]">閱讀筆記</h2>
                                        <p className="text-xs text-[var(--muted-foreground)] font-medium">整理與紀錄這則貼文的個人見解</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsNoteOpen(false)}
                                    aria-label="關閉筆記"
                                    className="flow-icon-button"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Note Content */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                                {/* New Note Input */}
                                <div className="flow-panel p-4">
                                    <textarea
                                        placeholder="輸入您的見解或筆記 (Ctrl + Enter 儲存)..."
                                        className="w-full bg-transparent border-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] text-sm leading-relaxed resize-none focus:ring-0 h-32"
                                        value={noteInput}
                                        onChange={(e) => setNoteInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSaveNote();
                                        }}
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button
                                            onClick={handleSaveNote}
                                            disabled={!noteInput.trim()}
                                            className="notion-btn-primary px-4 py-2 text-xs disabled:opacity-30 disabled:grayscale"
                                        >
                                            新增筆記
                                        </button>
                                    </div>
                                </div>

                                {/* Notes List */}
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-[10px] font-bold text-[var(--muted-foreground)] tracking-[0.16em] pl-2">已儲存的筆記 ({annotations?.length || 0})</h3>
                                    {annotations && annotations.length > 0 ? (
                                        annotations.map((note, idx) => (
                                            <div key={idx} className="flow-panel p-4 relative group">
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-[8px] text-[var(--accent)] font-bold">{idx + 1}</p>
                                                </div>
                                                <p className="text-sm text-[var(--foreground)] leading-relaxed">{note.content}</p>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
                                                        {new Date(note.created_at).toLocaleDateString(undefined, {
                                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 opacity-30">
                                            <p className="text-sm italic text-[var(--muted-foreground)]">尚無筆記</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Zoomed Image Overlay */}
            <AnimatePresence>
                {zoomedImage && (
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3 sm:p-4"
                        onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImage(null);
                        }}
                    >
                        <button
                            aria-label="關閉圖片預覽"
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 flow-icon-button bg-white/10 text-white hover:bg-white/20"
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
                    </Motion.div>
                )}
            </AnimatePresence>
        </Motion.div>
    );
};

export default PostDetailView;
