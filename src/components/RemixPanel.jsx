import React, { useState, useEffect } from 'react';
import { X, Wand2, Copy, Share, RefreshCw, Image as ImageIcon, Sparkles, Brain, Eye, Zap } from 'lucide-react';
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

    // Ensure images is an array
    const [editableJson, setEditableJson] = useState('');

    // Ensure images is an array
    const images = Array.isArray(post.images) ? post.images : (post.image ? [post.image] : []);

    useEffect(() => {
        const initialJson = post.full_json ? JSON.stringify(post.full_json, null, 2) : JSON.stringify(post, null, 2);
        setEditableJson(initialJson);
    }, [post]);

    const handleRemix = async () => {
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
                    sourceImages: images,
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
You are an expert Social Media Content Curator.
Your task is to take a "Source Post" (which may include text JSON and a visual image) and **INTERNALIZE** it, then **RE-EXPRESS** it as a casual, spontaneous daily share.

**The Goal:**
The user wants to share this learning/insight on their personal feed.
It should **NOT** feel like a formal article, a lecture, or a "content farm" post.
It should feel like a **"Quick Note"**, a **"Sudden Realization"**, or a **"Daily Vlog"** in text form.

**CRITICAL REQUIREMENT:**
**ALL OUTPUT fields MUST BE in Traditional Chinese (繁體中文, Taiwan usage).**

- Tone (語氣): ${params.style || 'Casual & Authentic'} (Use natural language, conversational fillers)
- Focus (核心領域): ${params.focus || 'Auto-detect'}
- Perspective (切入觀點): ${params.perspective || 'Daily Observer'}

**Style Guidelines:**
1. **Casual Vibe**: Write as if texting a friend or posting a quick thought on Threads/Instagram. Avoid stiff transitions like "Firstly", "In conclusion".
2. **Emojis & Kaomoji**: **MUST** use emojis (✨, 🚀, 💡) and Kaomoji (e.g., (´・ω・\`), (≧▽≦), (nod)) naturally to add emotion and personality.
3. **Short & Punchy**: Keep sentences relatively short. No walls of text. Use line breaks for readability.

**Process:**
1. **Visual & Textual Synthesis**: Analyze images and text to find the "Aha!" moment.
2. **Internalize**: What is the one cool thing here?
3. **Re-teach with Persona**: Share that one cool thing. Start with a hook like "天啊...", "最近發現...", or just dive straight into the feeling.
4. **No Drift**: Stick to the topic.
5. **Visual Creation**: The 'imagePrompt' should describe a *new* image that represents this internalized knowledge. It should be a synthesis of the source image's information and the user's style.

**Output Requirements:**
You must respond with a JSON object containing two fields:
1. "remixed_content": The new post content (in Traditional Chinese). It should be standalone and ready to post.
2. "image_prompt": A detailed prompt for an AI image generator (like Midjourney/DALL-E). This prompt must be a **Visual Reorganization** of the knowledge point.
    `.trim();

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

                {/* Body - 3 Columns */}
                <div className="flex-1 grid grid-cols-12 divide-x divide-white/10 overflow-hidden">

                    {/* Column 1: Source Material (Span 3) */}
                    <div className="col-span-3 flex flex-col bg-black/20 overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center border border-blue-500/30">1</span>
                                Source Material
                            </h3>
                            <span className="text-xs text-gray-500">JSON + Images</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {/* Images */}
                            {images.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Source Images</label>
                                    <div className={`grid gap - 2 ${images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} `}>
                                        {images.map((img, idx) => (
                                            <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5 relative group">
                                                <img src={img} alt={`Source ${idx} `} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <ImageIcon className="text-white/80" size={20} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* JSON */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex justify-between">
                                    Full JSON Data
                                    <span className="text-[10px] text-gray-500 lowercase">(editable)</span>
                                </label>
                                <textarea
                                    value={editableJson}
                                    onChange={(e) => setEditableJson(e.target.value)}
                                    className="w-full h-96 bg-black/40 rounded-lg p-3 border border-white/10 font-mono text-xs text-gray-300 resize-none focus:outline-none focus:border-blue-500/50 transition-colors custom-scrollbar"
                                    spellCheck="false"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Configuration (Span 5) */}
                    <div className="col-span-5 flex flex-col bg-gradient-to-b from-white/5 to-transparent overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold text-white flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center border border-purple-500/30">2</span>
                                AI Model & Prompt
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                            {/* Model Selection */}
                            <div className="space-y-3">
                                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                    <Brain size={16} className="text-purple-400" />
                                    Model Engine
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {MODELS.map(model => (
                                        <button
                                            key={model.id}
                                            onClick={() => setSelectedModel(model.id)}
                                            className={`flex items - center justify - between p - 3 rounded - xl border transition - all text - left ${selectedModel === model.id
                                                ? 'bg-purple-500/20 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                                } `}
                                        >
                                            <div>
                                                <div className="font-medium text-white text-sm">{model.name}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{model.desc}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                {model.type === 'free' && <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-medium border border-green-500/20">Free</span>}
                                                {model.type === 'paid' && <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-medium border border-yellow-500/20">Paid</span>}
                                                {model.capabilities.includes('vision') && <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-medium border border-blue-500/20">Vision</span>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Prompt Lab */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                    <Sparkles size={16} className="text-pink-400" />
                                    Prompt 煉成實驗室
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">語氣口吻 (Tone)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 資深股市玩家經驗分享"
                                            value={params.style}
                                            onChange={(e) => setParams({ ...params, style: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">核心領域 (Core Focus) 自動偵測 / 跨界設定</label>
                                        <input
                                            type="text"
                                            placeholder="留空則由 AI 自動分析"
                                            value={params.focus}
                                            onChange={(e) => setParams({ ...params, focus: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">切入觀點 (Perspective)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 一位走過彎路的資深導師"
                                            value={params.perspective}
                                            onChange={(e) => setParams({ ...params, perspective: e.target.value })}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Prompt Preview */}
                            <div className="space-y-2">
                                <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
                                    <Zap size={12} /> 完整 PROMPT 預覽 (即時生成)
                                </div>
                                <div className="bg-black/40 rounded-xl p-4 border border-white/10 text-xs font-mono text-blue-300 whitespace-pre-wrap overflow-x-auto max-h-[200px]">
                                    {promptPreview}
                                </div>
                            </div>

                        </div>

                        {/* Action Bar */}
                        <div className="p-6 border-t border-white/10 bg-black/20">
                            <button
                                onClick={handleRemix}
                                disabled={loading}
                                className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                            >
                                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20} />}
                                {loading ? 'Remixing Content...' : 'Start Remix Transformation'}
                            </button>
                        </div>
                    </div>

                    {/* Column 3: Output (Span 4) */}
                    <div className="col-span-4 flex flex-col bg-black/20 overflow-hidden">
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
                                        Configure your settings and click Start to generate your remixed content.
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
                                    {/* Image Prompt / Placeholder */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                            <ImageIcon size={12} /> Visual Concept
                                        </label>
                                        <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 flex flex-col items-center justify-center p-6 text-center group relative overflow-hidden">
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                                            <p className="text-xs text-gray-400 italic relative z-10 line-clamp-4 group-hover:line-clamp-none transition-all">
                                                "{result.image_prompt}"
                                            </p>
                                            <button className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white transition-colors relative z-10 flex items-center gap-2">
                                                <Copy size={12} /> Copy Prompt
                                            </button>
                                        </div>
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
