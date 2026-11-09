import React, { useRef, useState } from 'react';
import { ArrowRight, ImagePlus, Link2, Loader2, Upload } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { submitImageCapture } from '../api/captureApi';
import { addPostByUrl, addTask, monitorCapture, updateTaskStatus } from '../features/postsSlice';
import { addNotification } from '../features/uiSlice';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const maxFileSize = 15 * 1024 * 1024;

const UrlInput = () => {
    const [url, setUrl] = useState('');
    const [mode, setMode] = useState('url');
    const [imageSubmitting, setImageSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);
    const dispatch = useDispatch();
    const { tasks } = useSelector((state) => state.posts);
    const isQueueFull = tasks.filter((task) => task.status !== 'failed').length >= 10;

    const notify = (message, type = 'error') => dispatch(addNotification({ message, type }));

    const handleSubmit = (event) => {
        event.preventDefault();
        const value = url.trim();
        if (!value) return;
        if (isQueueFull) return notify('佇列任務過多，請稍後再試');
        if (tasks.some((task) => task.url === value)) return notify('此網址正在處理中', 'info');

        const taskId = crypto.randomUUID();
        dispatch(addTask({ taskId, inputType: 'url', url: value, label: value }));
        dispatch(addPostByUrl({ url: value, taskId }));
        setUrl('');
    };

    const submitFile = async (file) => {
        if (!file) return;
        if (isQueueFull) return notify('佇列任務過多，請稍後再試');
        if (!allowedTypes.has(file.type)) return notify('僅支援 JPEG、PNG、WebP 或 GIF 圖片');
        if (file.size > maxFileSize) return notify('圖片大小不可超過 15 MB');

        const taskId = crypto.randomUUID();
        dispatch(addTask({ taskId, inputType: 'image', label: file.name }));
        dispatch(updateTaskStatus({ taskId, status: 'uploading' }));
        setImageSubmitting(true);
        try {
            const capture = await submitImageCapture(file);
            dispatch(updateTaskStatus({ taskId, status: 'accepted', captureId: capture.capture_id }));
            dispatch(monitorCapture({ captureId: capture.capture_id, taskId }));
        } catch (error) {
            dispatch(updateTaskStatus({ taskId, status: 'failed' }));
            notify(`圖片上傳失敗：${error.message}`);
        } finally {
            setImageSubmitting(false);
        }
    };

    const handleImageSelected = (event) => {
        const [file] = event.target.files || [];
        event.target.value = '';
        submitFile(file);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        setIsDragging(false);
        submitFile(event.dataTransfer.files?.[0]);
    };

    return (
        <Motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} className="capture-editorial-card" aria-labelledby="capture-title">
            <header className="capture-editorial-head">
                <div>
                    <p className="capture-editorial-kicker">01 / CAPTURE SOURCE</p>
                    <h2 id="capture-title">把一份來源放進收件匣</h2>
                </div>
                <p className="capture-editorial-limit">{isQueueFull ? '佇列已滿（10 / 10）' : `可再加入 ${Math.max(0, 10 - tasks.filter((task) => task.status !== 'failed').length)} 份來源`}</p>
            </header>

            <div className="capture-editorial-tabs" role="tablist" aria-label="選擇來源型態">
                <button type="button" role="tab" aria-selected={mode === 'url'} className={mode === 'url' ? 'is-active' : ''} onClick={() => setMode('url')}><Link2 size={16} />貼上連結</button>
                <button type="button" role="tab" aria-selected={mode === 'image'} className={mode === 'image' ? 'is-active' : ''} onClick={() => setMode('image')}><ImagePlus size={16} />上傳圖片</button>
            </div>

            <div className="capture-editorial-body">
                {mode === 'url' ? (
                    <form className="capture-editorial-url-form" onSubmit={handleSubmit}>
                        <label htmlFor="source-url" className="capture-editorial-input-label">來源網址</label>
                        <div className="capture-editorial-url-row">
                            <Link2 size={20} aria-hidden="true" />
                            <input id="source-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder={isQueueFull ? '佇列已滿，請稍後再試' : '貼上公開貼文或網頁的連結'} disabled={isQueueFull} />
                            <button type="submit" disabled={isQueueFull || !url.trim()}>開始擷取 <ArrowRight size={17} /></button>
                        </div>
                        <p className="capture-editorial-help">Instagram、Facebook、X、YouTube 與一般公開網頁都會先保存為原始證據；尚未經你接受前，不會成為正式知識。</p>
                    </form>
                ) : (
                    <div className="capture-editorial-image-panel">
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleImageSelected} />
                        <button type="button" className={`capture-editorial-dropzone ${isDragging ? 'is-dragging' : ''}`} disabled={isQueueFull || imageSubmitting} onClick={() => fileInputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
                            <span className="capture-editorial-drop-icon">{imageSubmitting ? <Loader2 size={26} className="animate-spin" /> : <Upload size={26} />}</span>
                            <strong>{imageSubmitting ? '圖片正在上傳' : '拖曳圖片到這裡，或點擊選擇'}</strong>
                            <span>JPEG、PNG、WebP、GIF · 最大 15 MB</span>
                        </button>
                        <p className="capture-editorial-help">圖片會先進入私人收件匣並建立原始來源；稍後你再決定它是否值得留下筆記、Topic 或專案關聯。</p>
                    </div>
                )}
            </div>

            <footer className="capture-editorial-footer"><span>原始來源</span><i aria-hidden="true" /><span>候選審核</span><i aria-hidden="true" /><span className="is-muted">你的明確接受</span></footer>
        </Motion.section>
    );
};

export default UrlInput;
