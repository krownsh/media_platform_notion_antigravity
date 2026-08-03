import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, Clock, ExternalLink, Trash2, Image as ImageIcon } from 'lucide-react';
import { toggleTaskCenter } from '../features/uiSlice';
import { removeTask, addPostByUrl, updateTaskStatus } from '../features/postsSlice';
import { RotateCcw } from 'lucide-react';

const TaskCenter = () => {
    const dispatch = useDispatch();
    const { taskCenterOpen } = useSelector((state) => state.ui);
    const { tasks } = useSelector((state) => state.posts);

    const activeTasksCount = tasks.filter(t => t.status !== 'failed').length;
    const failedTasksCount = tasks.filter(t => t.status === 'failed').length;

    const handleRetry = (task) => {
        dispatch(updateTaskStatus({ taskId: task.id, status: 'pending' }));
        dispatch(addPostByUrl({ url: task.url, taskId: task.id }));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return <Clock size={16} className="text-[#615d59]" />;
            case 'submitting':
            case 'uploading':
            case 'accepted':
            case 'extracting':
            case 'crawling': return <Loader2 size={16} className="text-[var(--accent)] animate-spin" />;
            case 'analyzing': return <Loader2 size={16} className="text-primary animate-spin" />;
            case 'failed': return <AlertCircle size={16} className="text-destructive" />;
            default: return <Clock size={16} />;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return '排隊中...';
            case 'submitting': return '送入佇列中...';
            case 'uploading': return '上傳圖片中...';
            case 'accepted': return '已儲存，等待背景處理...';
            case 'extracting': return '整理來源資料中...';
            case 'crawling': return '抓取內容中...';
            case 'analyzing': return 'AI 分析中...';
            case 'failed': return '擷取失敗';
            default: return '處理中';
        }
    };

    const getTaskProgress = (status) => {
        switch (status) {
            case 'pending': return 1;
            case 'submitting':
            case 'uploading': return 2;
            case 'accepted':
            case 'extracting':
            case 'crawling': return 3;
            case 'analyzing': return 4;
            case 'failed': return 2;
            default: return 1;
        }
    };

    const getTaskTone = (status) => (
        status === 'failed' ? 'text-destructive' : 'text-[var(--accent)]'
    );

    return (
        <AnimatePresence>
            {taskCenterOpen && (
                <>
                    {/* Backdrop */}
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => dispatch(toggleTaskCenter())}
                        className="fixed inset-0 bg-[#17201d]/25 backdrop-blur-[3px] z-[100]"
                    />

                    {/* Drawer */}
                    <Motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                        className="fixed right-0 top-0 h-full w-full max-w-[100vw] sm:max-w-[30rem] bg-surface-raised shadow-deep z-[101] flex flex-col border-l notion-whisper-border"
                    >
                        {/* Header */}
                        <div className="px-5 py-5 sm:px-6 sm:py-6 border-b notion-whisper-border flex items-center justify-between bg-surface-raised sticky top-0 z-10 gap-3">
                            <div>
                                <p className="flow-kicker mb-1.5">背景處理</p>
                                <h2 className="text-xl sm:text-2xl font-bold tracking-[-0.04em] text-[rgba(0,0,0,0.95)]">任務中心</h2>
                                <p className="text-xs sm:text-sm text-[#615d59] mt-1.5">
                                    {activeTasksCount} 個進行中，{failedTasksCount} 個需要處理
                                </p>
                            </div>
                            <button
                                onClick={() => dispatch(toggleTaskCenter())}
                                className="flow-icon-button"
                                aria-label="關閉任務中心"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3" aria-live="polite">
                            {tasks.length === 0 ? (
                                <div className="h-full min-h-[18rem] flex flex-col items-center justify-center text-[#615d59] gap-4 text-center px-8">
                                    <div className="w-14 h-14 rounded-[1rem] bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                                        <CheckCircle2 size={28} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-[rgba(0,0,0,0.95)]">目前沒有正在處理的任務</p>
                                        <p className="mt-1 text-xs leading-5">新增來源後，處理進度會持續留在這裡。</p>
                                    </div>
                                </div>
                            ) : (
                                [...tasks].reverse().map((task) => (
                                    <Motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                        className={`p-4 rounded-[0.85rem] border transition-[border-color,box-shadow,background-color] duration-200 ${task.status === 'failed'
                                            ? 'bg-destructive/5 border-destructive/25'
                                            : 'bg-surface border-[var(--border-subtle)] hover:border-[var(--accent)] hover:shadow-soft-card'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            <div className={`mt-0.5 p-2.5 rounded-[0.65rem] ${task.status === 'failed' ? 'bg-destructive/10' : 'bg-[var(--accent-soft)]'
                                                }`}>
                                                {getStatusIcon(task.status)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${getTaskTone(task.status)
                                                        }`}>
                                                        {task.inputType === 'image' ? '圖片' : (task.platform || 'URL')} 擷取
                                                    </span>
                                                    <span className="text-[10px] text-[#615d59] tabular-nums">
                                                        {new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <div className="mt-1.5 flex items-center gap-1 group">
                                                    <p className="text-sm font-medium text-[rgba(0,0,0,0.95)] break-all sm:truncate flex-1">
                                                        {task.label || task.url}
                                                    </p>
                                                    {task.url ? (
                                                        <a
                                                            href={task.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="flow-icon-button min-h-8 min-w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                            aria-label="在新分頁開啟來源"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    ) : <ImageIcon size={14} className="text-[#615d59]" />}
                                                </div>

                                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="mb-2 flex items-center gap-1" aria-label={`${getStatusText(task.status)}，進度 ${getTaskProgress(task.status)} / 4`}>
                                                            {[1, 2, 3, 4].map((step) => (
                                                                <span
                                                                    key={step}
                                                                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${task.status === 'failed'
                                                                        ? (step <= getTaskProgress(task.status) ? 'bg-destructive/70' : 'bg-destructive/10')
                                                                        : (step <= getTaskProgress(task.status) ? 'bg-[var(--accent)]' : 'bg-black/8')
                                                                        }`}
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className={`text-xs ${task.status === 'failed' ? 'text-destructive font-semibold' : 'text-[#615d59]'
                                                            }`}>
                                                            {getStatusText(task.status)}
                                                        </span>
                                                    </div>

                                                    {task.status === 'failed' && (
                                                        <div className="flex items-center gap-3 flex-wrap">
                                                            {task.inputType === 'url' && (
                                                                <button
                                                                    onClick={() => handleRetry(task)}
                                                                className="notion-btn-ghost text-xs text-[var(--accent)] px-2.5 py-1.5 flex items-center gap-1"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                    <span>重試</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => dispatch(removeTask(task.id))}
                                                                className="notion-btn-ghost text-xs text-[#615d59] hover:text-destructive px-2.5 py-1.5 flex items-center gap-1"
                                                            >
                                                                <Trash2 size={12} />
                                                                <span>清除</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Motion.div>
                                ))
                            )}
                        </div>

                        {/* Footer (Optional info) */}
                        <div className="px-5 py-4 sm:px-6 border-t notion-whisper-border bg-[var(--surface)]">
                            <p className="text-xs leading-5 text-[#615d59]">
                                任務會在背景持續處理。若失敗，可在此直接重試或清除。
                            </p>
                        </div>
                    </Motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default TaskCenter;
