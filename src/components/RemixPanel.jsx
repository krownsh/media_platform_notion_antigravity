import React, { useState, useEffect } from 'react';
import { X, Wand2, Copy, Share, RefreshCw, Image as ImageIcon, Sparkles, Brain, Eye, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MODELS = [
    {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash',
        type: 'free',
        capabilities: ['vision', 'fast'],
        desc: 'Fast, Free, Vision-capable'
    },
    {
        id: 'google/gemini-2.0-pro-exp-02-05:free',
        name: 'Gemini 2.0 Pro',
        type: 'free',
        capabilities: ['vision', 'deep'],
        desc: 'Smarter, Free, Vision-capable'
    },
    {
        id: 'meta-llama/llama-3.2-3b-instruct:free',
        name: 'Llama 3.2 3B',
        type: 'free',
        capabilities: ['text'],
        desc: 'Fast, Text-only'
    },
    {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        type: 'paid',
        capabilities: ['vision', 'best'],
        desc: 'Premium, Best Reasoning'
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

    const handleRemix = async () => {
        if (activeImages.length > 4) {
            alert('Please select at most 4 images. Remove unwanted images from the list.');
            return;
        }

        setLoading(true);
        setResult(null);
        try {
            let sourceJson;
            try {
                sourceJson = JSON.parse(editableJson);
            } catch (e) {
                alert('Invalid JSON format. Please check your edits.');
                setLoading(false);
                return;
            }

            const response = await fetch('http://localhost:3001/api/remix', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sourceJson: sourceJson,
                    sourceImages: activeImages,
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
            setResult(data.result);
        } catch (error) {
            console.error('Remix failed:', error);
            setResult({ remixed_content: 'Remix failed. Please try again.', image_prompt: '' });
        } finally {
            setLoading(false);
        }
    };

    // Auto-generate prompt preview
    const promptPreview = `
You are a seasoned Industry Veteran and Thought Leader.
Your task is to take a "Source Post" (provided as a JSON object) and **INTERNALIZE** it, then **RE-EXPRESS** it as a deep, professional insight shared casually.

**Input Data Structure:**
- **Source JSON**: Contains text content (\`main_text\`, \`author\`, \`replies\`).
- **Images**: Visual context provided as attachments.

**Input JSON Fields:**
- \`main_text\`: The core content/insight of the original post.
- \`author\`: The original creator.
- \`replies\`: A list of comments. **Use these to identify what resonated with the audience, find interesting counter-points, or add social proof.**

**The Goal:**
The user wants to share this insight on their personal feed.
It must sound like a **Seasoned Expert** (資深專家) sharing a thought, NOT a beginner learning something new.
The vibe is: **"I've seen this pattern many times, and here's what you need to know."**

**CRITICAL REQUIREMENT:**
**ALL OUTPUT fields MUST BE in Traditional Chinese (繁體中文, Taiwan usage).**

- Tone (語氣): ${params.style || 'Professional & Casual'} (Calm, Insightful, Conversational)
- Focus (核心領域): ${params.focus || 'Auto-detect'}
- Perspective (切入觀點): ${params.perspective || 'Industry Observer'}

**Style Guidelines:**
1. **Expert Authority**: You already know this concept inside out. Do NOT say "I just learned..." (最近研究...) or "Wow!" (天啊!). Instead, say "I noticed..." (看到這個...) or "This reminds me..." (這讓我想起...).
2. **No Newbie Language**: STRICTLY FORBIDDEN phrases: "天啊", "筆記一下", "簡單說", "避坑小貼士", "感覺像...".
3. **Conversational but Deep**: Use a tone that suggests experience. E.g., "其實很多人忽略了...", "這才是核心邏輯...".
4. **Calm & Composed**: Use minimal emojis (max 1-2). No "😱" or "✨". Use neutral ones like ☕, 📉, 💡.

**Process:**
1. **Analyze Main Text**: Identify the core concept.
2. **Internalize**: Connect this to broader industry knowledge.
3. **Re-teach with Authority**: Frame the insight as an observation.
   - **Bad Opening**: "天啊！最近發現主力洗盤好可怕！" (Newbie)
   - **Good Opening**: "聊聊主力洗盤。其實這就是心理戰的極致表現。" (Expert)
4. **Visual Creation**: The 'imagePrompt' should describe a *new* image that represents this internalized knowledge. It should be a synthesis of the source image's information and the user's style.

**Output Requirements:**
You must respond with a JSON object containing two fields:
1. "remixed_content": The new post content (in Traditional Chinese). It should be standalone and ready to post.
2. "image_prompt": A detailed prompt for an AI image generator (like Midjourney/DALL-E). This prompt must be a **Visual Reorganization** of the knowledge point.
    `.trim();

    // Image Carousel State
    const [imgStartIndex, setImgStartIndex] = useState(0);
    const MAX_VISIBLE_IMAGES = 3;
    const visibleImages = activeImages.slice(imgStartIndex, imgStartIndex + MAX_VISIBLE_IMAGES);

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

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-[95vw] h-[90vh] glass-panel rounded-2xl flex flex-col overflow-hidden border border-white/10 shadow-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                            <Wand2 className="text-white" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Remix Content</h2>
                            <p className="text-xs text-gray-400">Internalize & Reframe Engine</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Flex Layout (37% - 26% - 37%) */}
                <div className="flex-1 flex overflow-hidden divide-x divide-white/10">

                    {/* Column 1: Source Material (37%) */}
                    <div className="w-[37%] flex flex-col bg-black/20 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center border border-blue-500/30">1</span>
                                Source Material
                            </h3>
                            <span className="text-xs text-gray-500">JSON + Images</span>
                        </div>

                        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                            {/* Images - Horizontal Carousel (Fixed Height) */}
                            {activeImages.length > 0 && (
                                <div className="space-y-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <label className={`text-xs font-medium uppercase tracking-wider ${activeImages.length > 4 ? 'text-red-400' : 'text-gray-400'}`}>
                                            Source Images ({activeImages.length}) {activeImages.length > 4 && '(Max 4)'}
                                        </label>
                                        {activeImages.length > MAX_VISIBLE_IMAGES && (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={prevImages}
                                                    disabled={imgStartIndex === 0}
                                                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30 transition-colors"
                                                >
                                                    <ChevronLeft size={14} />
                                                </button>
                                                <button
                                                    onClick={nextImages}
                                                    disabled={imgStartIndex + MAX_VISIBLE_IMAGES >= activeImages.length}
                                                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30 transition-colors"
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
                                                    className="w-1/3 aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5 relative group flex-shrink-0"
                                                >
                                                    <img src={img} alt={`Source ${imgStartIndex + idx}`} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ImageIcon className="text-white/80" size={20} />
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveImage(imgStartIndex + idx)}
                                                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                                                        title="Remove image"
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
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex justify-between mb-2 shrink-0">
                                    Full JSON Data
                                    <span className="text-[10px] text-gray-500 lowercase">(editable)</span>
                                </label>
                                <textarea
                                    value={editableJson}
                                    onChange={(e) => setEditableJson(e.target.value)}
                                    className="w-full flex-1 bg-black/40 rounded-lg p-3 border border-white/10 font-mono text-xs text-gray-300 resize-none focus:outline-none focus:border-blue-500/50 transition-colors custom-scrollbar"
                                    spellCheck="false"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Configuration (26%) - Fixed Ratio Layout */}
                    <div className="w-[26%] flex flex-col bg-gradient-to-b from-white/5 to-transparent overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center border border-purple-500/30">2</span>
                                Settings
                            </h3>
                        </div>

                        {/* Main Content Area - Flex Column with Ratios */}
                        <div className="flex-1 flex flex-col overflow-hidden">

                            {/* Top 10%: Model Selection */}
                            <div className="h-[10%] px-4 border-b border-white/10 flex flex-col justify-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-xs font-medium text-gray-300 shrink-0">
                                        <Brain size={14} className="text-purple-400" />
                                        Model
                                    </label>
                                    <div className="relative flex-1">
                                        <select
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                                        >
                                            {MODELS.map(model => (
                                                <option key={model.id} value={model.id} className="bg-gray-900 text-white">
                                                    {model.name} {model.type === 'free' ? '(Free)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <ChevronRight size={12} className="rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle 25%: Parameters */}
                            <div className="h-[25%] px-4 border-b border-white/10 flex flex-col justify-center shrink-0 overflow-hidden">
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-300 mb-2 shrink-0">
                                    <Sparkles size={14} className="text-pink-400" />
                                    Params
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-gray-500 w-16 shrink-0">Tone</label>
                                        <input
                                            type="text"
                                            placeholder="Casual..."
                                            value={params.style}
                                            onChange={(e) => setParams({ ...params, style: e.target.value })}
                                            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-gray-500 w-16 shrink-0">Focus</label>
                                        <input
                                            type="text"
                                            placeholder="Auto..."
                                            value={params.focus}
                                            onChange={(e) => setParams({ ...params, focus: e.target.value })}
                                            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-gray-500 w-16 shrink-0">Perspective</label>
                                        <input
                                            type="text"
                                            placeholder="Observer..."
                                            value={params.perspective}
                                            onChange={(e) => setParams({ ...params, perspective: e.target.value })}
                                            className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom 65%: Prompt Preview */}
                            <div className="h-[65%] p-4 overflow-hidden flex flex-col">
                                <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2 mb-2 shrink-0">
                                    <Zap size={10} /> Prompt Preview
                                </div>
                                <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/10 text-[10px] font-mono text-blue-300 whitespace-pre-wrap overflow-y-auto custom-scrollbar">
                                    {promptPreview}
                                </div>
                            </div>
                        </div>

                        {/* Action Bar */}
                        <div className="p-4 border-t border-white/10 bg-black/20 shrink-0">
                            <button
                                onClick={handleRemix}
                                disabled={loading}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw className="animate-spin" size={16} /> : <Wand2 size={16} />}
                                {loading ? '...' : 'Remix'}
                            </button>
                        </div>
                    </div>

                    {/* Column 3: Output (37%) */}
                    <div className="w-[37%] flex flex-col bg-black/20 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs flex items-center justify-center border border-green-500/30">3</span>
                                Final Output
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col">
                            {!result && !loading && (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                        <Wand2 size={32} className="opacity-20" />
                                    </div>
                                    <p className="text-sm text-center max-w-[200px]">
                                        Ready to Remix
                                    </p>
                                </div>
                            )}

                            {loading && (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-4">
                                    <RefreshCw size={32} className="animate-spin text-purple-500" />
                                    <p className="text-sm animate-pulse">Internalizing & Reframing...</p>
                                </div>
                            )}

                            {result && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    {/* Image Prompt / Generated Image */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <ImageIcon size={12} /> Visual Concept
                                        </label>

                                        {result.generated_image ? (
                                            <div className="aspect-square w-full bg-black rounded-xl border border-white/10 overflow-hidden relative group">
                                                <img
                                                    src={result.generated_image}
                                                    alt="AI Generated"
                                                    className="w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-6 backdrop-blur-sm">
                                                    <p className="text-[10px] text-gray-300 text-center line-clamp-4">
                                                        "{result.image_prompt}"
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <a
                                                            href={result.generated_image}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white backdrop-blur-sm transition-colors flex items-center gap-1"
                                                        >
                                                            <ExternalLink size={12} /> Open
                                                        </a>
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(result.image_prompt)}
                                                            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white backdrop-blur-sm transition-colors flex items-center gap-1"
                                                        >
                                                            <Copy size={12} /> Prompt
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 flex flex-col items-center justify-center p-6 text-center group relative overflow-hidden">
                                                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                                <p className="text-xs text-gray-400 italic relative z-10 line-clamp-4 group-hover:line-clamp-none transition-all">
                                                    "{result.image_prompt}"
                                                </p>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(result.image_prompt)}
                                                    className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors relative z-10 flex items-center gap-2"
                                                >
                                                    <Copy size={12} /> Copy Prompt
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Text Content */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <Brain size={12} /> Remixed Content
                                        </label>
                                        <div className="bg-white/5 rounded-xl p-4 text-gray-200 text-sm leading-relaxed border border-white/10 whitespace-pre-wrap">
                                            {result.remixed_content}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-4">
                                        <button className="flex-1 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                                            <Copy size={16} /> Copy Text
                                        </button>
                                        <button className="flex-1 py-2.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                                            <Share size={16} /> Share
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default RemixPanel;
