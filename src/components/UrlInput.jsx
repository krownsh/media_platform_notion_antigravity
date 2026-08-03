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
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl mb-8"
        >
            <div className="flow-surface overflow-hidden shadow-soft-card">
                <div className="flex flex-col items-stretch gap-3 border-b notion-whisper-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                        <p className="text-sm font-semibold text-[rgba(0,0,0,0.95)]">新增來源</p>
                        <p className="mt-0.5 text-xs text-[#615d59]">連結與圖片會安全地進入你的私人工作區。</p>
                    </div>
                    <div className="inline-flex self-start rounded-lg bg-black/[0.04] p-1">
                    <button
                        type="button"
                        onClick={() => setMode('url')}
                        aria-pressed={mode === 'url'}
                        className={`flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-semibold transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${mode === 'url' ? 'bg-white text-[rgba(0,0,0,0.95)] shadow-[0_1px_2px_rgba(23,31,26,0.08)]' : 'text-[#615d59] hover:text-[rgba(0,0,0,0.95)]'}`}
                    >
                        <Link2 size={16} /> 貼上連結
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode('image')}
                        aria-pressed={mode === 'image'}
                        className={`flex min-h-9 items-center gap-2 rounded-md px-3 py-2 text-xs sm:text-sm font-semibold transition-[transform,background-color,color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${mode === 'image' ? 'bg-white text-[rgba(0,0,0,0.95)] shadow-[0_1px_2px_rgba(23,31,26,0.08)]' : 'text-[#615d59] hover:text-[rgba(0,0,0,0.95)]'}`}
                    >
                        <ImagePlus size={16} /> 上傳圖片
                    </button>
                    </div>
                </div>

                <div className="p-3 sm:p-4">
                {mode === 'url' ? (
                    <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row items-stretch sm:items-center rounded-[0.75rem] border notion-whisper-border bg-[var(--surface)] p-2 gap-2 transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_var(--accent-soft)]">
                        <div className="flex-1 flex items-center min-w-0">
                            <div className="hidden sm:block pl-3 text-[var(--accent)]"><Link2 size={20} /></div>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder={isQueueFull ? '佇列已滿...' : '貼上網址...'}
                                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[rgba(0,0,0,0.95)] placeholder-muted-foreground px-3 sm:px-4 py-3 text-[16px] sm:text-base"
                                disabled={isQueueFull}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isQueueFull || !url.trim()}
                            className="notion-btn-primary w-full sm:w-auto px-6 py-3 sm:py-3 font-bold disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <span>加入佇列</span>
                            <ArrowRight size={18} className="hidden sm:block" />
                        </button>
                    </form>
                ) : (
                    <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center rounded-[0.75rem] border notion-whisper-border bg-[var(--surface)] p-2 gap-2">
                        <div className="flex-1 flex items-center gap-3 px-3 sm:px-4 py-3 text-[#615d59]">
                            <ImagePlus size={22} className="flex-shrink-0 text-[var(--accent)]" />
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
                            className="notion-btn-primary w-full sm:w-auto px-6 py-3 font-bold disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {imageSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            <span>{imageSubmitting ? '上傳中' : '選擇圖片'}</span>
                        </button>
                    </div>
                )}
                </div>

                <div className="border-t notion-whisper-border px-4 py-3 sm:px-5 text-xs leading-5 text-[#615d59]">
                    {mode === 'image'
                        ? '圖片會先存入私人空間，再交由 Hermes 非同步分析。'
                        : '支援公開社群連結與一般網頁來源。處理完成後可從收件匣繼續整理。'}
                </div>
            </div>
        </Motion.div>
    );
};

export default UrlInput;
