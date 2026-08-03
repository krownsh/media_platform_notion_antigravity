import React, { useRef, useState } from 'react';
import { Link2, ArrowRight, Loader2, ImagePlus, Upload } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { addPostByUrl, addTask, monitorCapture, updateTaskStatus } from '../features/postsSlice';
import { motion as Motion } from 'framer-motion';
import { addNotification } from '../features/uiSlice';
import { submitImageCapture } from '../api/captureApi';

const UrlInput = () => {
    const [url, setUrl] = useState('');
    const [mode, setMode] = useState('url');
    const [imageSubmitting, setImageSubmitting] = useState(false);
    const fileInputRef = useRef(null);
    const dispatch = useDispatch();
    const { tasks } = useSelector((state) => state.posts);
    const isQueueFull = tasks.filter((task) => task.status !== 'failed').length >= 10;

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
            dispatch(addTask({ taskId, inputType: 'url', url: url.trim(), label: url.trim() }));
            dispatch(addPostByUrl({ url: url.trim(), taskId }));
            setUrl('');
        }
    };

    const handleImageSelected = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (isQueueFull) {
            dispatch(addNotification({ message: '佇列任務過多，請稍後再試', type: 'error' }));
            return;
        }

        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        if (!allowedTypes.has(file.type)) {
            dispatch(addNotification({ message: '僅支援 JPEG、PNG、WebP 或 GIF 圖片', type: 'error' }));
            return;
        }
        if (file.size > 15 * 1024 * 1024) {
            dispatch(addNotification({ message: '圖片大小不可超過 15 MB', type: 'error' }));
            return;
        }

        const taskId = crypto.randomUUID();
        dispatch(addTask({ taskId, inputType: 'image', label: file.name }));
        dispatch(updateTaskStatus({ taskId, status: 'uploading' }));
        setImageSubmitting(true);

        try {
            const capture = await submitImageCapture(file);
            dispatch(updateTaskStatus({ taskId, status: 'accepted', captureId: capture.capture_id }));
            dispatch(monitorCapture({ captureId: capture.capture_id, taskId }));
            dispatch(addNotification({ message: '圖片已安全儲存，可以繼續新增；Hermes 將在背景分析', type: 'success' }));
        } catch (error) {
            dispatch(updateTaskStatus({ taskId, status: 'failed' }));
            dispatch(addNotification({ message: `圖片上傳失敗：${error.message}`, type: 'error' }));
        } finally {
            setImageSubmitting(false);
        }
    };

    return (
        <Motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.8, 0.3, 1] }}
            className="w-full max-w-3xl mx-auto mb-16"
        >
            <div className="mb-4 flex justify-center">
                <div className="inline-flex rounded-full border notion-whisper-border bg-white p-1 shadow-soft-card">
                    <button
                        type="button"
                        onClick={() => setMode('url')}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${mode === 'url' ? 'bg-[#0075de] text-white' : 'text-[#615d59] hover:bg-black/5'}`}
                    >
                        <Link2 size={16} /> 貼上連結
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('image')}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${mode === 'image' ? 'bg-[#0075de] text-white' : 'text-[#615d59] hover:bg-black/5'}`}
                    >
                        <ImagePlus size={16} /> 上傳圖片
                    </button>
                </div>
            </div>
            <div className="relative group">
                {/* Soft organic glow */}
                <div className="absolute -inset-4 bg-[rgba(0,117,222,0.1)] rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition duration-700"></div>

                {mode === 'url' ? (
                    <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-transparent backdrop-blur-xl border notion-whisper-border rounded-[2rem] sm:rounded-full p-2 gap-2 shadow-deep hover:shadow-deep transition-all duration-300">
                        <div className="flex-1 flex items-center min-w-0">
                            <div className="hidden sm:block pl-5 text-[#615d59]"><Link2 size={20} /></div>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder={isQueueFull ? '佇列已滿...' : '貼上網址...'}
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[rgba(0,0,0,0.95)] placeholder-muted-foreground px-4 py-3 text-[16px] sm:text-lg"
                                disabled={isQueueFull}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isQueueFull || !url.trim()}
                            className="w-full sm:w-auto bg-[#0075de] hover:bg-[#0075de]/90 text-white px-8 py-3.5 sm:py-3 rounded-[1.5rem] sm:rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-soft-card hover:shadow-deep hover:-translate-y-0.5"
                        >
                            <span>加入佇列</span>
                            <ArrowRight size={18} className="hidden sm:block" />
                        </button>
                    </form>
                ) : (
                    <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-transparent backdrop-blur-xl border notion-whisper-border rounded-[2rem] sm:rounded-full p-2 gap-2 shadow-deep">
                        <div className="flex-1 flex items-center gap-3 px-4 py-3 text-[#615d59]">
                            <ImagePlus size={22} className="flex-shrink-0 text-[#0075de]" />
                            <div className="min-w-0">
                                <p className="font-semibold text-[rgba(0,0,0,0.95)]">選擇要整理的圖片</p>
                                <p className="text-xs mt-0.5">JPEG、PNG、WebP、GIF，最多 15 MB</p>
                            </div>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleImageSelected}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isQueueFull || imageSubmitting}
                            className="w-full sm:w-auto bg-[#0075de] hover:bg-[#0075de]/90 text-white px-8 py-3.5 sm:py-3 rounded-[1.5rem] sm:rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-soft-card"
                        >
                            {imageSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            <span>{imageSubmitting ? '上傳中' : '選擇圖片'}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Helper Text */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[10px] sm:text-sm text-[#615d59]/80 px-4">
                {mode === 'image' && <span className="w-full text-center">圖片會先存入私人空間，再交由 Hermes 非同步分析</span>}
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-pink-500"><span className="w-1.5 h-1.5 rounded-full bg-pink-500/50"></span>Instagram</span>
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-blue-600"><span className="w-1.5 h-1.5 rounded-full bg-blue-600/50"></span>Facebook</span>
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-sky-500"><span className="w-1.5 h-1.5 rounded-full bg-sky-500/50"></span>Twitter / X</span>
                <span className="flex items-center gap-1.5 sm:gap-2 transition-colors hover:text-[rgba(0,0,0,0.95)]"><span className="w-1.5 h-1.5 rounded-full bg-foreground/50"></span>Threads</span>
            </div>
        </Motion.div>
    );
};

export default UrlInput;
