import React, { useState } from 'react';
import { Link2, ArrowRight, Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addPostByUrl, addTask } from '../features/postsSlice';
import { motion } from 'framer-motion';
import { addNotification } from '../features/uiSlice';

const UrlInput = () => {
    const [url, setUrl] = useState('');
    const dispatch = useDispatch();
    const { tasks } = useSelector((state) => state.posts);
    const isQueueFull = tasks.length >= 10;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (url.trim()) {
            if (isQueueFull) {
                dispatch(addNotification({ message: '佇列任務過多，請稍後再試', type: 'error' }));
                return;
            }

            // Check for duplicate URLs in active tasks
            if (tasks.some(t => t.url === url.trim())) {
                dispatch(addNotification({ message: '此網址正在處理中', type: 'info' }));
                return;
            }

            const taskId = crypto.randomUUID();
            dispatch(addTask({ taskId, url: url.trim() }));
            dispatch(addPostByUrl({ url: url.trim(), taskId }));
            setUrl('');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.8, 0.3, 1] }}
            className="w-full max-w-3xl mx-auto mb-16"
        >
            <div className="relative group">
                {/* Soft organic glow */}
                <div className="absolute -inset-4 bg-[rgba(0,117,222,0.1)] rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-700"></div>

                <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-transparent backdrop-blur-xl border notion-whisper-border rounded-[2rem] sm:rounded-full p-2 sm:p-2 gap-2 shadow-deep hover:shadow-deep transition-all duration-300">
                    <div className="flex-1 flex items-center">
                        <div className="hidden sm:block pl-5 text-[#615d59]">
                            <Link2 size={20} />
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder={isQueueFull ? "佇列已滿..." : "貼上網址..."}
                            className="flex-1 bg-transparent border-none outline-none text-[rgba(0,0,0,0.95)] placeholder-muted-foreground px-4 sm:px-4 py-3 sm:py-3 text-base sm:text-lg"
                            disabled={isQueueFull}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isQueueFull || !url}
                        className="bg-[#0075de] hover:bg-[#0075de]/90 text-white px-8 py-3.5 sm:py-3 rounded-[1.5rem] sm:rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-soft-card hover:shadow-deep hover:-translate-y-0.5"
                    >
                        <span>新增</span>
                        <ArrowRight size={18} className="hidden sm:block" />
                    </button>
                </form>
            </div>

            {/* Helper Text */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] sm:text-sm text-[#615d59]/80 px-4">
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-pink-500"><span className="w-1.5 h-1.5 rounded-full bg-pink-500/50"></span>Instagram</span>
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-blue-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-600/50"></span>Facebook</span>
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-sky-500"><span className="w-1.5 h-1.5 rounded-full bg-sky-500/50"></span>Twitter / X</span>
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-[rgba(0,0,0,0.95)]"><span className="w-1.5 h-1.5 rounded-full bg-foreground/50"></span>Threads</span>
            </div>
        </motion.div>
    );
};

export default UrlInput;
