import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, MessageSquare, Share2, Sparkles, MoreHorizontal, ChevronLeft, ChevronRight, Instagram, Twitter, ArrowLeft, Library } from 'lucide-react';
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
        <div className={`flex flex-col ${depth === 0 ? 'bg-black/5 p-4 rounded-lg' : 'mt-2'}`}>
            {authorName && (
                <div className="mb-1">
                    <span className="text-xs font-bold text-[rgba(0,0,0,0.95)]/70">{authorName}</span>
                </div>
            )}
            <p className="text-sm text-[rgba(0,0,0,0.95)]/90 leading-relaxed whitespace-pre-wrap break-words">
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
                            className="max-h-48 rounded-lg object-contain border border-[rgba(0,0,0,0.1)]/20 cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                                e.stopPropagation();
                                onImageClick(img);
                            }}
                        />
                    ))}
                </div>
            )}

            {hasReplies && (
                <div className="border-l-2 border-[rgba(0,0,0,0.1)]/30 ml-0.5 pl-3 mt-2">
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
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-lg text-[#615d59]">找不到貼文</p>
                <button onClick={() => navigate('/')} className="text-[#0075de] hover:underline">返回首頁</button>
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
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-[calc(100vh-40px)] max-h-[calc(100vh-40px)] overflow-hidden"
        >
            {/* --- Top Header / Navigation --- */}
            <div className="flex items-center justify-between py-4 px-2 flex-shrink-0">
                <div
                    className="flex items-center gap-2 text-[#615d59] hover:text-[rgba(0,0,0,0.95)] cursor-pointer transition-colors group"
                    onClick={() => navigate(-1)}
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">返回</span>
                    <span className="mx-2 text-neutral-300">/</span>
                    <div className="flex items-center gap-2">
                        {platformStyle.icon}
                        <span className="text-xs font-semibold text-neutral-500">{platformStyle.label}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onRemix && onRemix(post)}
                        className="notion-btn-ghost text-[#0075de] flex items-center gap-2"
                    >
                        <Sparkles size={16} />
                        AI 改寫
                    </button>
                    <button
                        onClick={() => setIsNoteOpen(true)}
                        className="notion-btn-primary bg-amber-500 hover:bg-amber-600 border-amber-600/20 flex items-center gap-2"
                    >
                        <Library size={16} />
                        我的筆記 ({annotations?.length || 0})
                    </button>
                </div>
            </div>

            {/* --- Main Content Layout --- */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden pb-4">

                {/* 1. Left Section: Instagram Style (Image top, Content bottom) */}
                <div className="flex-[3] flex flex-col bg-white rounded-2xl border notion-whisper-border shadow-soft-card overflow-hidden">
                    {/* User Header */}
                    <div className="p-4 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            {post.avatar ? (
                                <img src={proxyImage(post.avatar)} alt={post.author} className="w-10 h-10 rounded-full object-cover border notion-whisper-border" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-bold text-neutral-600 border">
                                    {post.author?.[0] || 'U'}
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-bold text-neutral-900">{post.author || 'Unknown'}</p>
                                <p className="text-xs text-neutral-500">@{post.authorHandle || 'unknown'}</p>
                            </div>
                        </div>
                        <button className="text-neutral-400 hover:text-neutral-900 transition-colors">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>

                    {/* Scrollable Area for Image and Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Image(s) at Top */}
                        {images.length > 0 && (
                            <div className="relative bg-neutral-50 border-b border-neutral-50 group">
                                <div className="max-w-3xl mx-auto py-2">
                                    <div className="relative aspect-auto flex items-center justify-center overflow-hidden">
                                        <motion.div
                                            className="flex w-full"
                                            animate={{ x: `-${currentImageIndex * 100}%` }}
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        >
                                            {images.map((img, idx) => (
                                                <div key={idx} className="w-full flex-shrink-0 flex items-center justify-center">
                                                    <img
                                                        src={proxyImage(img)}
                                                        alt={`${title} - ${idx + 1}`}
                                                        className="max-w-full max-h-[60vh] object-contain shadow-soft-card cursor-zoom-in"
                                                        onClick={() => setZoomedImage(img)}
                                                    />
                                                </div>
                                            ))}
                                        </motion.div>

                                        {images.length > 1 && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (currentImageIndex > 0) setCurrentImageIndex(i => i - 1) }}
                                                    className="absolute left-4 p-2 rounded-full bg-white/80 backdrop-blur-md shadow-soft-card text-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    disabled={currentImageIndex === 0}
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (currentImageIndex < images.length - 1) setCurrentImageIndex(i => i + 1) }}
                                                    className="absolute right-4 p-2 rounded-full bg-white/80 backdrop-blur-md shadow-soft-card text-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    disabled={currentImageIndex === images.length - 1}
                                                >
                                                    <ChevronRight size={20} />
                                                </button>
                                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1 rounded-full bg-black/20">
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
                        <div className="p-6 max-w-2xl mx-auto">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-center gap-2">
                                    <Heart size={20} className="text-neutral-600 hover:text-red-500 cursor-pointer transition-colors" />
                                    <MessageSquare size={20} className="text-neutral-600 hover:text-blue-500 cursor-pointer transition-colors" />
                                    <Share2 size={20} className="text-neutral-600 hover:text-green-500 cursor-pointer transition-colors" />
                                </div>
                            </div>

                            <h1 className="text-lg font-bold text-neutral-900 mb-4">{title}</h1>

                            <p className="text-base text-neutral-800 leading-relaxed whitespace-pre-wrap mb-6">
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
                                                    className="text-[#0075de] hover:underline break-all"
                                                >
                                                    {part}
                                                </a>
                                            );
                                        }
                                        return part;
                                    });
                                })()}
                            </p>

                            <div className="text-xs text-neutral-400 mb-8 pb-8 border-b border-neutral-100 uppercase tracking-widest">
                                {post.postedAt ? new Date(post.postedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '剛剛'}
                            </div>

                            {/* Comments inside the scrollable area */}
                            {comments.length > 0 && (
                                <div className="space-y-6">
                                    <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">留言回覆</h3>
                                    {comments.map((comment, idx) => (
                                        <CommentItem key={idx} comment={comment} onImageClick={setZoomedImage} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Right Section: AI Summary */}
                <div className="flex-1 min-w-[320px] max-w-[400px] flex flex-col bg-neutral-50/50 rounded-2xl border notion-whisper-border overflow-hidden">
                    <div className="p-5 border-b border-neutral-100 flex items-center gap-2 bg-white">
                        <Sparkles size={16} className="text-[#0075de]" />
                        <span className="text-sm font-bold text-neutral-700 uppercase tracking-wider">AI 知識摘要</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {analysis?.summary ? (
                            <div className="space-y-6">
                                {(() => {
                                    let data = analysis.summary;
                                    if (typeof data === 'string' && (data.trim().startsWith('{') || data.includes('```json'))) {
                                        try {
                                            const cleanJson = data.replace(/```json\s*|\s*```/g, '').trim();
                                            data = JSON.parse(cleanJson);
                                        } catch (e) { }
                                    }

                                    if (!data) return <p className='text-sm text-neutral-400 italic'>無效的摘要結構</p>;

                                     if (typeof data === 'object' && data !== null) {
                                        return (
                                            <>
                                                {data.core_insight && (
                                                    <div className="bg-white p-5 rounded-xl border notion-whisper-border shadow-soft-card">
                                                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0075de] mb-3">核心洞察</h4>
                                                        <p className="text-sm font-medium leading-relaxed text-neutral-800">{data.core_insight}</p>
                                                    </div>
                                                )}
                                                {data.key_points && (
                                                    <div className="bg-white p-5 rounded-xl border notion-whisper-border shadow-soft-card">
                                                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-neutral-400 mb-3">關鍵要點</h4>
                                                        <ul className="space-y-3">
                                                            {data.key_points.map((p, i) => (
                                                                <li key={i} className="text-sm text-neutral-700 flex gap-2 leading-relaxed">
                                                                    <span className="text-[#0075de] font-bold">•</span>
                                                                    <span>{p}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {data.actionable_knowledge && (
                                                    <div className="bg-[#0075de]/5 p-5 rounded-xl border border-[#0075de]/10 shadow-soft-card">
                                                        <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#0075de] mb-3">實用建議</h4>
                                                        <p className="text-sm leading-relaxed text-neutral-800">{data.actionable_knowledge}</p>
                                                    </div>
                                                )}
                                                {data.tags && (
                                                    <div className="flex flex-wrap gap-2 pt-2">
                                                        {data.tags.map((t, i) => (
                                                            <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-500 border border-neutral-200 hover:bg-neutral-200 transition-colors cursor-pointer">#{t}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    }
                                    return <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{typeof data === 'string' ? data : JSON.stringify(data)}</p>;
                                })()}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-neutral-400">
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
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsNoteOpen(false)}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-full max-w-[450px] bg-amber-50 shadow-deep rounded-l-3xl z-[110] flex flex-col overflow-hidden"
                        >
                            <div className="p-6 border-b border-amber-200/50 flex items-center justify-between flex-shrink-0 bg-white/50 backdrop-blur-md">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                                        <Library size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-amber-900">學術筆記</h2>
                                        <p className="text-xs text-amber-700/60 font-medium">整理與紀錄此貼文的個人見解</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsNoteOpen(false)}
                                    className="p-2 rounded-full hover:bg-amber-100 text-amber-800 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Note Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                                {/* New Note Input */}
                                <div className="bg-white rounded-2xl p-4 shadow-soft-card border border-amber-200">
                                    <textarea
                                        placeholder="輸入您的見解或筆記 (Ctrl + Enter 儲存)..."
                                        className="w-full bg-transparent border-none text-neutral-800 placeholder-amber-900/40 text-sm leading-relaxed resize-none focus:ring-0 h-32"
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
                                            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all disabled:opacity-30 disabled:grayscale shadow-soft-card"
                                        >
                                            新增筆記
                                        </button>
                                    </div>
                                </div>

                                {/* Notes List */}
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-[10px] uppercase font-bold text-amber-800/40 tracking-widest pl-2">已儲存的筆記 ({annotations?.length || 0})</h3>
                                    {annotations && annotations.length > 0 ? (
                                        annotations.map((note, idx) => (
                                            <div key={idx} className="bg-white/80 p-4 rounded-xl border border-amber-200 shadow-sm relative group">
                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <p className="text-[8px] text-amber-500 font-bold uppercase">{idx + 1}</p>
                                                </div>
                                                <p className="text-sm text-neutral-800 leading-relaxed">{note.content}</p>
                                                <div className="mt-2 flex items-center justify-between">
                                                    <span className="text-[10px] text-amber-700/60 font-medium">
                                                        {new Date(note.created_at).toLocaleDateString(undefined, {
                                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 opacity-30">
                                            <p className="text-sm italic text-amber-900">尚無筆記</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

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
                            className="absolute top-4 right-4 p-2 rounded-full bg-transparent text-white hover:bg-transparent transition-colors"
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
