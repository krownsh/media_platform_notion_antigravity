import React from 'react';
import { MoreHorizontal, ExternalLink, MessageSquare, Heart, Share2, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const PostCard = ({ post, onRemix }) => {
    const { platform, title, screenshot, analysis, originalUrl } = post;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-2xl overflow-hidden group relative"
        >
            {/* Image Section */}
            <div className="relative aspect-[4/5] overflow-hidden bg-gray-900">
                <img
                    src={screenshot || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=1000&auto=format&fit=crop'}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                {/* Platform Badge */}
                <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 rounded-md bg-black/50 backdrop-blur-md text-xs font-medium text-white uppercase tracking-wider border border-white/10">
                        {platform}
                    </span>
                </div>

                {/* Actions Overlay */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                        onClick={() => onRemix && onRemix(post)}
                        className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-purple-500 transition-colors"
                        title="Remix this post"
                    >
                        <Sparkles size={16} />
                    </button>
                    <button className="p-2 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-white hover:text-black transition-colors">
                        <MoreHorizontal size={16} />
                    </button>
                </div>
            </div>

            {/* Content Section */}
            <div className="p-4">
                <h3 className="text-white font-medium line-clamp-2 mb-2 leading-snug">
                    {title || 'Untitled Post'}
                </h3>

                {/* AI Summary */}
                {analysis?.summary && (
                    <div className="flex items-start gap-2 mb-3">
                        <Sparkles size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-400 line-clamp-2">
                            {analysis.summary}
                        </p>
                    </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {analysis?.tags?.slice(0, 3).map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-gray-300 border border-white/5">
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5 text-gray-500">
                    <div className="flex items-center gap-3">
                        <button className="hover:text-white transition-colors"><Heart size={16} /></button>
                        <button className="hover:text-white transition-colors"><MessageSquare size={16} /></button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="hover:text-white transition-colors"><Share2 size={16} /></button>
                        <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                            <ExternalLink size={16} />
                        </a>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default PostCard;
