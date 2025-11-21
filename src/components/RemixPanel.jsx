import React, { useState } from 'react';
import { X, Wand2, Copy, Share, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { aiService } from '../services/aiService';

const RemixPanel = ({ post, onClose }) => {
    const [style, setStyle] = useState('viral-tweet');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRemix = async () => {
        setLoading(true);
        try {
            const remixedContent = await aiService.rewriteContent(post.content || post.title, style);
            setResult(remixedContent);
        } catch (error) {
            console.error('Remix failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-y-0 right-0 w-96 bg-black/80 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 p-6 flex flex-col"
        >
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Wand2 className="text-purple-400" />
                    Remix Content
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>

            {/* Style Selection */}
            <div className="space-y-4 mb-8">
                <label className="text-sm font-medium text-gray-400">Choose Style</label>
                <div className="grid grid-cols-2 gap-3">
                    {['Viral Tweet', 'LinkedIn Pro', 'IG Caption', 'Blog Intro'].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStyle(s.toLowerCase().replace(' ', '-'))}
                            className={`p-3 rounded-xl text-sm font-medium transition-all border ${style === s.toLowerCase().replace(' ', '-')
                                    ? 'bg-purple-500/20 border-purple-500 text-white'
                                    : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={handleRemix}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20} />}
                {loading ? 'Generating...' : 'Generate Remix'}
            </button>

            {/* Result Area */}
            {result && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 flex-1 flex flex-col"
                >
                    <label className="text-sm font-medium text-gray-400 mb-2">Result</label>
                    <div className="flex-1 bg-white/5 rounded-xl p-4 text-gray-200 font-mono text-sm leading-relaxed border border-white/10 overflow-y-auto">
                        {result}
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                            <Copy size={16} /> Copy
                        </button>
                        <button className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                            <Share size={16} /> Share
                        </button>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
};

export default RemixPanel;
