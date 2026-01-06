import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, Clock, ExternalLink, Trash2 } from 'lucide-react';
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
            case 'pending': return <Clock size={16} className="text-muted-foreground" />;
            case 'crawling': return <Loader2 size={16} className="text-accent animate-spin" />;
            case 'analyzing': return <Loader2 size={16} className="text-primary animate-spin" />;
            case 'failed': return <AlertCircle size={16} className="text-destructive" />;
            default: return <Clock size={16} />;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return '排隊中...';
            case 'crawling': return '抓取內容中...';
            case 'analyzing': return 'AI 分析中...';
            case 'failed': return '擷取失敗';
            default: return '處理中';
        }
    };

    return (
        <AnimatePresence>
            {taskCenterOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => dispatch(toggleTaskCenter())}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[101] flex flex-col border-l border-white/20"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">任務中心</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {activeTasksCount} 個進行中 · {failedTasksCount} 個失敗
                                </p>
                            </div>
                            <button
                                onClick={() => dispatch(toggleTaskCenter())}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-muted-foreground"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Task List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {tasks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-60">
                                    <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                                        <CheckCircle2 size={32} />
                                    </div>
                                    <p className="text-sm font-medium">目前沒有正在處理的任務</p>
                                </div>
                            ) : (
                                [...tasks].reverse().map((task) => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`p-4 rounded-2xl border transition-all duration-300 ${task.status === 'failed'
                                            ? 'bg-destructive/5 border-destructive/20'
                                            : 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-1 p-2 rounded-xl ${task.status === 'failed' ? 'bg-destructive/10' : 'bg-accent/10'
                                                }`}>
                                                {getStatusIcon(task.status)}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${task.status === 'failed' ? 'text-destructive' : 'text-accent'
                                                        }`}>
                                                        {task.platform || 'URL'} 擷取
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                <div className="mt-1 flex items-center gap-1 group">
                                                    <p className="text-sm font-medium text-foreground truncate flex-1">
                                                        {task.url}
                                                    </p>
                                                    <a
                                                        href={task.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent"
                                                    >
                                                        <ExternalLink size={14} />
                                                    </a>
                                                </div>

                                                <div className="mt-2 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs ${task.status === 'failed' ? 'text-destructive font-semibold' : 'text-muted-foreground'
                                                            }`}>
                                                            {getStatusText(task.status)}
                                                        </span>
                                                        {task.status !== 'failed' && (
                                                            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                                                        )}
                                                    </div>

                                                    {task.status === 'failed' && (
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => handleRetry(task)}
                                                                className="text-xs text-accent hover:text-accent/80 flex items-center gap-1 transition-colors font-semibold"
                                                            >
                                                                <RotateCcw size={12} />
                                                                <span>重試</span>
                                                            </button>
                                                            <button
                                                                onClick={() => dispatch(removeTask(task.id))}
                                                                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                                                            >
                                                                <Trash2 size={12} />
                                                                <span>清除</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Footer (Optional info) */}
                        <div className="p-6 bg-gray-50 border-t border-gray-100">
                            <div className="text-[10px] text-muted-foreground text-center uppercase tracking-[0.2em] font-bold">
                                Concurrency Strategy Active (Max 3)
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default TaskCenter;
