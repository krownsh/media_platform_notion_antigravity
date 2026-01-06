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
                <div className="absolute -inset-4 bg-accent/10 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-700"></div>

                <form onSubmit={handleSubmit} className="relative flex items-center bg-white/60 backdrop-blur-xl border border-white/50 rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-300">
                    <div className="pl-5 text-muted-foreground">
                        <Link2 size={20} />
                    </div>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={isQueueFull ? "佇列已滿，請等候處理..." : "貼上 Instagram, Twitter 或 Facebook 連結..."}
                        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder-muted-foreground px-4 py-3 text-lg"
                        disabled={isQueueFull}
                    />
                    <button
                        type="submit"
                        disabled={isQueueFull || !url}
                        className="bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <span>新增</span>
                        <ArrowRight size={18} />
                    </button>
                </form>
            </div>

            {/* Helper Text */}
            <div className="mt-6 flex justify-center gap-8 text-sm text-muted-foreground/80">
                <span className="flex items-center gap-2 transition-colors hover:text-pink-500"><span className="w-1.5 h-1.5 rounded-full bg-pink-500/50"></span>Instagram</span>
                <span className="flex items-center gap-2 transition-colors hover:text-blue-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-600/50"></span>Facebook</span>
                <span className="flex items-center gap-2 transition-colors hover:text-sky-500"><span className="w-1.5 h-1.5 rounded-full bg-sky-500/50"></span>Twitter / X</span>
                <span className="flex items-center gap-2 transition-colors hover:text-foreground"><span className="w-1.5 h-1.5 rounded-full bg-foreground/50"></span>Threads</span>
            </div>
        </motion.div>
    );
};

export default UrlInput;
