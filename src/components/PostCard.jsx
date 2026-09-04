import React, { useState } from 'react';
import { MoreHorizontal, ExternalLink, Sparkles, ChevronLeft, ChevronRight, Instagram, Twitter, Trash2, FolderInput, FolderMinus, Globe, Facebook, Youtube, FileText, Image as ImageIcon } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { movePostToCollection } from '../features/postsSlice';
import { API_BASE_URL } from '../api/config';
import { suggestFolders } from '../utils/folderSuggestion';
import AuthorInitialAvatar from './AuthorInitialAvatar';


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
    showSummary = false,
    isCompact = false,
}) => {
    const { platform, title, screenshot, analysis } = post;
    const analysisPending = analysis?.analysis_status === 'pending';
    const [currentImageIndex] = useState(0);
    const [showMenu, setShowMenu] = useState(false);
    const [showMoveMenu, setShowMoveMenu] = useState(false);

    const dispatch = useDispatch();
    const { collections } = useSelector(state => state.posts);
    const folderSuggestions = suggestFolders(post, collections);
    const topFolderSuggestion = folderSuggestions[0] || null;

    const workflowLabel = (workflow) => {
        if (!workflow) return null;
        const labels = {
            base_analysis: '待內容分析',
            triage: '待 Hermes 分類',
            preprocessing: 'Hermes 自動整理中',
            strategy: workflow.status === 'awaiting_user' ? '待討論策略' : '整理策略中',
            research: '等待研究任務',
            review: '待後續確認',
            vault_sync: '等待 Vault 同步',
            actions: '執行後續工作中',
            complete: '處理完成'
        };
        if (workflow.status === 'failed') return `待重試：${labels[workflow.stage] || '處理失敗'}`;
        if (workflow.status === 'blocked') return '需要你協助處理';
        return labels[workflow.stage] || '背景處理中';
    };
    const workflowText = workflowLabel(post.workflow);

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
        if (platformName === 'image') return { icon: <ImageIcon size={14} className="text-violet-600" />, label: 'Image' };
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
        <Motion.div
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
            className={`notion-card group relative mx-auto w-full flex-shrink-0 flex flex-col cursor-pointer overflow-hidden hover:-translate-y-0.5 ${isCompact ? 'max-w-[320px] min-h-[390px]' : 'max-w-[440px] min-h-[430px]'}`}
            onMouseLeave={() => { setShowMenu(false); setShowMoveMenu(false); }}
        >
            {/* Platform Header */}
            <div className="flex-shrink-0 w-full px-3 sm:px-4 py-2.5 flex items-center justify-between bg-surface-raised border-b notion-whisper-border">
                <div className="flex items-center gap-2">
                    {platformStyle.icon}
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#615d59] leading-none">{platformStyle.label}</span>
                    <span className="h-3.5 w-px bg-black/10" aria-hidden="true" />
                    <span className="text-[10px] sm:text-[11px] max-w-[140px] text-[#615d59]/80 font-medium leading-none truncate" title={topFolderSuggestion ? `建議放入：${topFolderSuggestion.collection.name}` : undefined}>
                        {post.collectionId
                            ? collections.find(c => c.id === post.collectionId)?.name || '未分類'
                            : topFolderSuggestion ? `建議：${topFolderSuggestion.collection.name}` : '未分類'}
                    </span>
                    {workflowText && (
                        <>
                            <span className="h-3.5 w-px bg-black/10" aria-hidden="true" />
                            <span className="max-w-[120px] truncate text-[10px] sm:text-[11px] font-medium leading-none text-[var(--accent)]" title={post.workflow?.last_error || workflowText}>
                                {workflowText}
                            </span>
                        </>
                    )}
                    {post.drafts?.length > 0 && (
                        <>
                            <span className="h-3.5 w-px bg-black/10" aria-hidden="true" />
                            <span className="rounded-full bg-amber-50 px-1.5 py-1 text-[10px] font-medium text-amber-700" title="已有 Hermes 自動草稿">草稿</span>
                        </>
                    )}
                </div>
                <button
                    className="flow-icon-button min-h-8 min-w-8"
                    onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    aria-label="開啟貼文選項"
                    aria-expanded={showMenu}
                >
                    <MoreHorizontal size={16} />
                </button>
            </div>

            {/* Author Info */}
            <div className="flex-shrink-0 px-3 sm:px-4 py-2.5 border-b notion-whisper-border flex items-center gap-2.5 bg-surface-raised">
                <AuthorInitialAvatar name={post.author} size={isCompact ? 'sm' : 'md'} />
                <div className="min-w-0">
                    <div className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold truncate leading-tight`}>{post.author || 'Unknown'}</div>
                    <div className={`${isCompact ? 'text-[10px]' : 'text-[12px]'} text-[#615d59]/80 truncate mt-0.5`}>@{post.authorHandle || 'unknown'}</div>
                </div>
            </div>

            {/* Show media only when a usable preview exists. */}
            {images.length > 0 && (
                <div className={`flex-shrink-0 w-full bg-[var(--surface-muted)] overflow-hidden flex items-center justify-center relative border-b notion-whisper-border ${isCompact ? 'aspect-[16/8]' : 'aspect-[16/7.5]'}`}>
                    <img src={proxyImage(images[currentImageIndex])} className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02]" alt="Post content" />
                    {hasMultipleImages && (
                        <div className="absolute top-2 right-2 px-1.5 py-1 rounded-md bg-black/45 text-[9px] text-white tabular-nums">
                            {currentImageIndex + 1} / {images.length}
                        </div>
                    )}
                </div>
            )}

            {/* Action Bar */}
            <div className="flex-shrink-0 px-3 sm:px-4 py-1 flex items-center justify-end border-b notion-whisper-border bg-surface-raised">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="flow-icon-button min-h-8 min-w-8"
                        onClick={(e) => { e.stopPropagation(); onRemix && onRemix(post); }}
                        aria-label="AI 改寫"
                    >
                        <Sparkles size={16} className="text-[var(--accent)]" />
                    </button>
                    {post.originalUrl && (
                        <a href={post.originalUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flow-icon-button min-h-8 min-w-8" aria-label="在新分頁開啟原始貼文">
                            <ExternalLink size={16} className="text-[#615d59]" />
                        </a>
                    )}
                </div>
            </div>

            {/* --- Content Area --- */}
            <div className="flex-1 flex flex-col bg-surface-raised overflow-hidden">

                {/* 1. Main Content Container */}
                <div className={`flex-1 px-3 sm:px-4 overflow-hidden ${isCompact ? 'py-2.5' : 'py-3 sm:py-4'}`}>
                    <div
                        className={`text-[rgba(0,0,0,0.95)]/80 leading-6 whitespace-pre-wrap font-medium ${isCompact ? 'text-xs' : 'text-sm'}`}
                        style={{ display: '-webkit-box', WebkitLineClamp: isCompact ? 5 : 6, WebkitBoxOrient: 'vertical' }}
                    >
                        {(post.content || title || '').replace(/\n\s*\n/g, '\n').trim()}
                    </div>
                </div>

                {/* 2. Footer Container */}
                <div className={`mt-auto flex-shrink-0 px-3 sm:px-4 flex flex-col bg-surface border-t notion-whisper-border ${isCompact ? 'py-2 gap-1.5' : 'py-2.5 gap-2'}`}>
                    {/* Tags Area */}
                    <div className="min-h-5 overflow-hidden flex flex-wrap items-center gap-1 flex-shrink-0">
                        {!analysisPending && analysis?.tags && analysis.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className={`notion-badge leading-none ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>#{tag}</span>
                        ))}
                    </div>

                    {/* AI Info / Summary Area */}
                    <div className={`${showSummary && analysis?.summary ? 'max-h-10' : 'max-h-0'} overflow-hidden flex-shrink-0 transition-[max-height] duration-200`}>
                        {showSummary && !analysisPending && analysis?.summary && (
                            <div className="bg-[var(--accent-soft)] rounded-md px-2 py-1.5 flex flex-col justify-center border border-[rgba(45,111,115,0.1)]">
                                <div className={`${isCompact ? 'text-[9px]' : 'text-[11px]'} text-[#615d59] leading-tight line-clamp-1 font-medium`}>
                                    <Sparkles size={8} className="inline mr-1 text-[var(--accent)]" />
                                    {(typeof analysis.summary === 'string' ? analysis.summary : (analysis.summary.core_insight || "點擊查看")).replace(/##\s*|\*\*/g, '')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Final Bottom Row */}
                    <div className="flex items-center justify-between flex-shrink-0 gap-3">
                        <span className={`text-[var(--accent)] font-bold uppercase tracking-[0.05em] leading-none ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>{analysisPending ? '待分析' : (analysis?.primary_category || '尚未分類')}</span>
                        <div className={`text-[#615d59] opacity-80 font-medium leading-none tabular-nums ${isCompact ? 'text-[9px]' : 'text-[10px]'}`}>{post.createdAt ? new Date(post.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '剛剛'}</div>
                    </div>
                </div>
            </div>

            {/* --- Hidden Menu Overlay --- */}
            <AnimatePresence>
                {showMenu && (
                    <Motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-surface-raised backdrop-blur-sm flex flex-col p-3 sm:p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4 gap-3">
                            <span className="font-bold">更多選項</span>
                            <button type="button" className="flow-icon-button min-h-8 min-w-8" onClick={() => { setShowMenu(false); setShowMoveMenu(false); }} aria-label="關閉貼文選項">
                                <MoreHorizontal size={16} />
                            </button>
                        </div>
                        
                        {!showMoveMenu ? (
                            <>
                                {topFolderSuggestion && (
                                    <button
                                        className="flex flex-col gap-1 p-3 mb-1 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)] w-full text-left transition-transform duration-150 active:scale-[0.98]"
                                        onClick={(e) => handleMoveToCollection(e, topFolderSuggestion.collection.id)}
                                    >
                                        <span className="flex items-center gap-2 font-medium"><FolderInput size={16} /> 建議移至「{topFolderSuggestion.collection.name}」</span>
                                        <span className="pl-6 text-[11px] text-[#615d59]">依據：{topFolderSuggestion.reasons.join('、')}</span>
                                    </button>
                                )}
                                <button 
                                    className="flex items-center gap-2 p-3 hover:bg-black/5 rounded-lg text-[rgba(0,0,0,0.95)] w-full text-left" 
                                    onClick={(e) => { e.stopPropagation(); setShowMoveMenu(true); }}
                                >
                                    <FolderInput size={16} /> 移至資料夾
                                </button>
                                <button className="flex items-center gap-2 p-3 hover:bg-black/5 rounded-lg text-destructive w-full text-left" onClick={() => { onDelete && onDelete(); setShowMenu(false); }}>
                                    <Trash2 size={16} /> 刪除此貼文
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col flex-1 min-h-0">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b notion-whisper-border">
                                    <ChevronLeft size={16} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setShowMoveMenu(false); }} />
                                    <span className="font-bold text-sm">選擇資料夾</span>
                                </div>
                                <div className="overflow-y-auto flex-1 flex flex-col gap-1 custom-scrollbar">
                                    <button 
                                        className="flex items-center gap-2 p-2 hover:bg-black/5 rounded-lg text-sm text-left w-full"
                                        onClick={(e) => handleMoveToCollection(e, null)}
                                    >
                                        <FolderMinus size={16} /> 取消分類
                                    </button>
                                    {collections.map(c => (
                                        <button 
                                            key={c.id}
                                            className="flex items-center gap-2 p-2 hover:bg-black/5 rounded-lg text-sm text-left w-full"
                                            onClick={(e) => handleMoveToCollection(e, c.id)}
                                        >
                                            <FolderInput size={16} /> {c.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Motion.div>
                )}
            </AnimatePresence>
        </Motion.div>
    );
};

export default PostCard;
