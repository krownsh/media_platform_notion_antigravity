import React, { useState, useEffect } from 'react';
import { X, Wand2, Copy, Share, RefreshCw, Image as ImageIcon, Sparkles, Brain, Eye, Zap, ChevronLeft, ChevronRight, ExternalLink, Settings2, Download, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../api/config';
import MarkdownRenderer from './MarkdownRenderer';

// Hardcoded models as requested
const MODELS = [
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Exp)',
        type: 'google',
        capabilities: ['vision', 'fast'],
        desc: 'Fast, Experimental'
    },
    {
        id: 'gemini-2.0-flash-thinking-exp',
        name: 'Gemini 2.0 Flash Thinking',
        type: 'google',
        capabilities: ['vision', 'deep'],
        desc: 'Reasoning, Experimental'
    },
    {
        id: 'gemini-2.0-pro-exp-02-05',
        name: 'Gemini 2.0 Pro (Exp)',
        type: 'google',
        capabilities: ['vision', 'deep'],
        desc: 'High Capability, Experimental'
    },
    {
        id: 'x-ai/grok-4.1-fast:free',
        name: 'xAI Grok 4.1 Fast',
        type: 'openrouter',
        capabilities: ['text'],
        desc: 'xAI Free Model'
    },
    {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1',
        type: 'openrouter',
        capabilities: ['text', 'reasoning'],
        desc: 'DeepSeek Reasoning'
    },
    {
        id: 'qwen/qwen-2.5-vl-72b-instruct:free',
        name: 'Qwen 2.5 VL 72B',
        type: 'openrouter',
        capabilities: ['vision', 'text'],
        desc: 'Qwen Vision Model'
    }
];

const RemixPanel = ({ post, onClose }) => {
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [params, setParams] = useState({
        style: '',
        focus: '',
        perspective: ''
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editableJson, setEditableJson] = useState('');

    const [activeImages, setActiveImages] = useState([]);

    // Image Generation State
    const [imagePrompt, setImagePrompt] = useState("A creative, high-quality illustration representing the core insight of the post. Style: Modern, Minimalist, Tech-focused.");
    const [generatedImages, setGeneratedImages] = useState({}); // Map index -> url
    const [generatingImageIndex, setGeneratingImageIndex] = useState(null);
    const [showPromptInput, setShowPromptInput] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // Image Carousel State
    const [imgStartIndex, setImgStartIndex] = useState(0);
    const MAX_VISIBLE_IMAGES = 3;
    const visibleImages = activeImages.slice(imgStartIndex, imgStartIndex + MAX_VISIBLE_IMAGES);

    useEffect(() => {
        // Ensure images is an array
        const imgs = Array.isArray(post.images) ? post.images : (post.image ? [post.image] : []);
        setActiveImages(imgs);

        // Logic to populate editableJson: Use full_json if available, otherwise construct a fallback
        let initialData = post.full_json || post.fullJson;

        if (!initialData) {
            // Construct fallback data from available fields
            initialData = [{
                main_text: post.content || '',
                author: post.author || 'Unknown',
                postedAt: post.postedAt || '',
                replies: post.comments ? post.comments.map(c => ({
                    text: c.text || c.content,
                    author: c.user || c.author,
                    postedAt: c.postedAt || c.commented_at
                })) : []
            }];
        } else {
            // Strip images from existing JSON to avoid redundancy with the carousel
            try {
                // Deep copy to avoid mutating original prop
                const dataCopy = JSON.parse(JSON.stringify(initialData));
                if (Array.isArray(dataCopy)) {
                    dataCopy.forEach(item => delete item.images);
                } else if (typeof dataCopy === 'object') {
                    delete dataCopy.images;
                }
                initialData = dataCopy;
            } catch (e) {
                console.warn("Failed to strip images from JSON", e);
            }
        }

        setEditableJson(JSON.stringify(initialData, null, 2));
    }, [post]);

    const handleRemoveImage = (indexToRemove) => {
        setActiveImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
        // If we remove an image and the current start index would hide the last remaining images, adjust it
        if (imgStartIndex > 0 && imgStartIndex >= activeImages.length - 1) {
            setImgStartIndex(Math.max(0, imgStartIndex - 1));
        }
    };

    const nextImages = () => {
        if (imgStartIndex + MAX_VISIBLE_IMAGES < activeImages.length) {
            setImgStartIndex(prev => prev + 1);
        }
    };

    const prevImages = () => {
        if (imgStartIndex > 0) {
            setImgStartIndex(prev => prev - 1);
        }
    };

    const handleRemix = async () => {
        setLoading(true);
        setResult(null);
        try {
            let sourceJson;
            try {
                sourceJson = JSON.parse(editableJson);
            } catch (e) {
                alert('JSON 格式無效。請檢查您的編輯。');
                setLoading(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/remix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceJson: sourceJson,
                    // sourceImages: activeImages, // Removed as per request to not use images for text remix
                    userParams: {
                        ...params,
                        model: selectedModel
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Remix failed');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            setResult(data.result);

            // If the AI returned a suggested prompt, maybe we update our default? 
            if (data.result.image_prompt) {
                setImagePrompt(data.result.image_prompt);
            }

        } catch (error) {
            console.error('Remix failed:', error);
            alert(`Remix failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateImage = async (index) => {
        setGeneratingImageIndex(index);
        try {
            const response = await fetch(`${API_BASE_URL}/api/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt: imagePrompt })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.imageUrl) {
                setGeneratedImages(prev => ({
                    ...prev,
                    [index]: data.imageUrl
                }));
            }
        } catch (error) {
            console.error("Image generation failed:", error);
            alert("Image generation failed: " + error.message);
        } finally {
            setGeneratingImageIndex(null);
        }
    };

    // Auto-generate prompt preview
    const promptPreview = `
: You are a seasoned Industry Veteran and Thought Leader.
: Your task is to take a "Source Post" (provided as a JSON object) and **INTERNALIZE** it, then **RE-EXPRESS** it as a deep, professional insight shared casually.
: 
: **Input Data Structure:**
: - **Source JSON**: Contains text content (\`main_text\`, \`author\`, \`replies\`).
: 
: **Input JSON Fields:**
: - \`main_text\`: The core content/insight of the original post.
: - \`author\`: The original creator.
: - \`replies\`: A list of comments. **Use these to identify what resonated with the audience, find interesting counter-points, or add social proof.**
: 
: **The Goal:**
: The user wants to share this insight on their personal feed.
: It must sound like a **Seasoned Expert** (資深專家) sharing a thought, NOT a beginner learning something new.
: The vibe is: **"I've seen this pattern many times, and here's what you need to know."**
: 
: **CRITICAL REQUIREMENT:**
: **ALL OUTPUT fields MUST BE in Traditional Chinese (繁體中文, Taiwan usage).**
: 
: - Tone (語氣): ${params.style || 'Professional & Casual'} (Calm, Insightful, Conversational)
: - Focus (核心領域): ${params.focus || 'Auto-detect'}
: - Perspective (切入觀點): ${params.perspective || 'Industry Observer'}
    `.trim();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-md p-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.8, 0.3, 1] }}
                className="w-full max-w-[95vw] h-[90vh] bg-white/80 border border-white/50 rounded-3xl flex flex-col overflow-hidden shadow-2xl backdrop-blur-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border/20 bg-white/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-secondary/30 rounded-xl text-foreground">
                            <Wand2 size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">內容改寫</h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">內化與重構引擎</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-black/5 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Flex Layout (37% - 26% - 37%) */}
                <div className="flex-1 flex overflow-hidden divide-x divide-border/20">

                    {/* Column 1: Source Material (37%) */}
                    <div className="w-[37%] flex flex-col bg-secondary/5 overflow-hidden">
                        <div className="p-4 border-b border-border/20 flex items-center justify-between shrink-0">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-secondary/30 text-foreground text-xs flex items-center justify-center border border-secondary/50">1</span>
                                來源素材
                            </h3>
                            <span className="text-xs text-muted-foreground">JSON + 圖片</span>
                        </div>

                        <div className="flex-1 flex flex-col p-5 space-y-5 overflow-hidden">
                            {/* Images - Horizontal Carousel (Fixed Height) */}
                            {activeImages.length > 0 && (
                                <div className="space-y-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <label className={`text-xs font-medium uppercase tracking-wider ${activeImages.length > 4 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                            來源圖片 ({activeImages.length}) {activeImages.length > 4 && '(最多 4 張)'}
                                        </label>
                                        {activeImages.length > MAX_VISIBLE_IMAGES && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={prevImages}
                                                    disabled={imgStartIndex === 0}
                                                    className="p-1 hover:bg-black/5 rounded disabled:opacity-30 transition-colors text-foreground"
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <button
                                                    onClick={nextImages}
                                                    disabled={imgStartIndex + MAX_VISIBLE_IMAGES >= activeImages.length}
                                                    className="p-1 hover:bg-black/5 rounded disabled:opacity-30 transition-colors text-foreground"
                                                >
                                                    <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-3 relative overflow-hidden">
                                        <AnimatePresence mode="popLayout">
                                            {visibleImages.map((img, idx) => (
                                                <motion.div
                                                    key={`${img}-${imgStartIndex + idx}`}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className="w-1/3 aspect-square rounded-xl overflow-hidden border border-border/20 bg-white/50 relative group flex-shrink-0 shadow-sm"
                                                >
                                                    <img src={img} alt={`Source ${imgStartIndex + idx}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                                        <ImageIcon className="text-foreground/80" size={20} />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveImage(imgStartIndex + idx)}
                                                        className="absolute top-1 right-1 bg-destructive/80 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                        title="移除圖片"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}

                            {/* JSON (Flex Grow to fill remaining space) */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex justify-between mb-2 shrink-0">
                                    完整 JSON 資料
                                    <span className="text-[10px] text-muted-foreground/70 lowercase">(可編輯)</span>
                                </label>
                                <textarea
                                    value={editableJson}
                                    onChange={(e) => setEditableJson(e.target.value)}
                                    className="w-full flex-1 bg-white/50 rounded-xl p-4 border border-border/20 font-mono text-xs text-foreground/80 resize-none focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all custom-scrollbar shadow-inner"
                                    spellCheck="false"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Configuration (26%) - Fixed Ratio Layout */}
                    <div className="w-[26%] flex flex-col bg-white/10 overflow-hidden">
                        <div className="p-4 border-b border-border/20 flex items-center justify-between shrink-0">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center border border-accent/30">2</span>
                                設定
                            </h3>
                        </div>

                        {/* Main Content Area - Flex Column with Ratios */}
                        <div className="flex-1 flex flex-col overflow-hidden">

                            {/* Top 10%: Model Selection */}
                            <div className="h-[10%] px-5 border-b border-border/10 flex flex-col justify-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground shrink-0">
                                        <Brain size={14} className="text-accent" />
                                        模型
                                    </label>
                                    <div className="relative flex-1">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-white/50 border border-border/20 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent/50 appearance-none cursor-pointer hover:bg-white/80 transition-colors shadow-sm"
                                        >
                                            {MODELS.map(model => (
                                                <option key={model.id} value={model.id} className="bg-white text-foreground">
                                                    {model.type === 'google' ? '[Google] ' : '[OpenRouter] '}
                                                    {model.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                            <ChevronRight size={12} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle 25%: Parameters */}
                            <div className="h-[25%] px-5 border-b border-border/10 flex flex-col justify-center shrink-0 overflow-hidden">
                                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3 shrink-0">
                                    <Sparkles size={14} className="text-accent" />
                                    參數
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-muted-foreground w-16 shrink-0">語氣</label>
                                        <input
                                            type="text"
                                            placeholder="輕鬆..."
                                            value={params.style}
                                            onChange={(e) => setParams({ ...params, style: e.target.value })}
                                            className="flex-1 bg-white/50 border border-border/20 rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-muted-foreground w-16 shrink-0">重點</label>
                                        <input
                                            type="text"
                                            placeholder="自動..."
                                            value={params.focus}
                                            onChange={(e) => setParams({ ...params, focus: e.target.value })}
                                            className="flex-1 bg-white/50 border border-border/20 rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-muted-foreground w-16 shrink-0">視角</label>
                                        <input
                                            type="text"
                                            placeholder="觀察者..."
                                            value={params.perspective}
                                            onChange={(e) => setParams({ ...params, perspective: e.target.value })}
                                            className="flex-1 bg-white/50 border border-border/20 rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent/50 focus:bg-white/80 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom 65%: Prompt Preview */}
                            <div className="h-[65%] p-5 overflow-hidden flex flex-col">
                                <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 mb-2 shrink-0">
                                    <Zap size={10} /> 提示詞預覽
                                </div>
                                <div className="flex-1 bg-white/30 rounded-xl p-3 border border-border/20 text-[10px] font-mono text-foreground/70 whitespace-pre-wrap overflow-y-auto custom-scrollbar shadow-inner">
                                    {promptPreview}
                                </div>
                            </div>
                        </div>

                        {/* Action Bar */}
                        <div className="p-5 border-t border-border/20 bg-white/20 shrink-0">
                            <button
                                onClick={handleRemix}
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-accent text-white text-sm font-bold hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                            >
                                {loading ? <RefreshCw className="animate-spin" size={16} /> : <Wand2 size={16} />}
                                {loading ? '...' : '改寫'}
                            </button>
                        </div>
                    </div>

                    {/* Column 3: Output (37%) - Split into Top (Text) and Bottom (Images) */}
                    <div className="w-[37%] flex flex-col bg-secondary/5 overflow-hidden">

                        {/* Section 3: Text Output (Flex 1) */}
                        <div className="flex-1 flex flex-col min-h-0 border-b border-border/20">
                            <div className="p-4 border-b border-border/10 flex items-center justify-between shrink-0 bg-white/30">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">3</div>
                                    <h3 className="font-medium text-foreground">最終產出 (文字)</h3>
                                </div>
                            </div>

                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                                        <RefreshCw className="w-8 h-8 animate-spin text-accent" />
                                        <p className="text-sm animate-pulse">AI 正在思考與改寫中...</p>
                                    </div>
                                ) : result ? (
                                    <div className="space-y-6 animate-in fade-in duration-500">
                                        <div className="prose prose-sm max-w-none">
                                            <MarkdownRenderer content={result.remixed_content} />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => navigator.clipboard.writeText(result.remixed_content)}
                                                className="flex-1 py-2 rounded-lg bg-white/50 hover:bg-white/80 text-foreground text-xs font-medium flex items-center justify-center gap-2 transition-colors border border-border/20"
                                            >
                                                <Copy size={14} /> 複製
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
                                        <Sparkles className="w-12 h-12 mb-2 opacity-20" />
                                        <p className="text-sm">點擊「改寫」生成內容</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Image Generation (Fixed Height or Flex) */}
                        <div className="h-[40%] flex flex-col min-h-0 bg-white/20">
                            <div className="p-4 border-b border-border/10 flex items-center justify-between shrink-0 bg-white/30">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">4</div>
                                    <h3 className="font-medium text-foreground">配圖生成</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            onClose();
                                            // Use window.location as fallback if useNavigate not available in this context (though it should be)
                                            // But better to pass navigate or use hook
                                            window.location.href = `/image-workflow/${post.id || post.dbId}`;
                                        }}
                                        className="text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-md text-accent hover:bg-accent/10"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Advanced
                                    </button>
                                    <button
                                        onClick={() => setShowPromptInput(!showPromptInput)}
                                        className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-md ${showPromptInput ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-accent hover:bg-accent/5'}`}
                                    >
                                        <Settings2 className="w-3 h-3" />
                                        Prompt
                                    </button>
                                </div>
                            </div>

                            {showPromptInput && (
                                <div className="px-4 py-2 bg-accent/5 border-b border-accent/10 shrink-0 animate-in slide-in-from-top-2">
                                    <textarea
                                        value={imagePrompt}
                                        onChange={(e) => setImagePrompt(e.target.value)}
                                        className="w-full text-xs bg-white border border-border/20 rounded p-2 focus:outline-none focus:border-accent/50 h-16 resize-none"
                                        placeholder="輸入圖片生成提示詞..."
                                    />
                                </div>
                            )}

                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
                                {activeImages.length > 0 ? (
                                    <div className="space-y-3">
                                        {activeImages.map((imgUrl, idx) => (
                                            <div key={idx} className="flex items-center gap-3 bg-white/40 p-3 rounded-xl border border-white/20 shadow-sm hover:bg-white/50 transition-colors">
                                                {/* Left: Source Image */}
                                                <div
                                                    className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-border/10 cursor-zoom-in hover:opacity-90 transition-opacity shadow-inner"
                                                    onClick={() => setPreviewImage(imgUrl)}
                                                >
                                                    <img src={imgUrl} alt="Source" className="w-full h-full object-cover" />
                                                </div>

                                                {/* Center: Generate Button */}
                                                <div className="shrink-0 flex flex-col items-center justify-center gap-1 px-2">
                                                    <button
                                                        onClick={() => handleGenerateImage(idx)}
                                                        disabled={generatingImageIndex === idx}
                                                        className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:scale-110 active:scale-95"
                                                        title="生成配圖"
                                                    >
                                                        {generatingImageIndex === idx ? (
                                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <ChevronRight className="w-5 h-5" />
                                                        )}
                                                    </button>
                                                    <span className="text-[10px] text-muted-foreground font-medium">生成</span>
                                                </div>

                                                {/* Right: Generated Image */}
                                                <div
                                                    className={`w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-border/10 flex items-center justify-center relative shadow-inner transition-all ${generatedImages[idx] ? 'bg-white cursor-zoom-in hover:opacity-90' : 'bg-black/5'}`}
                                                    onClick={() => generatedImages[idx] && setPreviewImage(generatedImages[idx])}
                                                >
                                                    {generatedImages[idx] ? (
                                                        <img
                                                            src={generatedImages[idx]}
                                                            alt="Generated"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="text-[10px] text-muted-foreground/50 text-center px-2 leading-tight flex flex-col items-center gap-1">
                                                            <Sparkles className="w-4 h-4 opacity-20" />
                                                            <span>待生成</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 text-xs">
                                        <p>無來源圖片</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Image Preview Modal */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
                            onClick={() => setPreviewImage(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="relative max-w-full max-h-full rounded-2xl overflow-hidden shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain" />
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
};

export default RemixPanel;
