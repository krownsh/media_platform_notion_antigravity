import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

const SidebarSearch = ({ onPostClick }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const { items } = useSelector(state => state.posts);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = items.filter(post => {
            const contentMatch = post.content?.toLowerCase().includes(lowerQuery);
            const authorMatch = post.author?.toLowerCase().includes(lowerQuery);
            const summaryMatch = post.analysis?.summary?.toLowerCase().includes(lowerQuery);
            // Check comments if they exist
            const commentsMatch = post.comments?.some(c => c.text?.toLowerCase().includes(lowerQuery));

            return contentMatch || authorMatch || summaryMatch || commentsMatch;
        });

        setResults(filtered.slice(0, 10)); // Limit to 10 results
    }, [query, items]);

    const handleSelect = (post) => {
        if (onPostClick) {
            onPostClick(post);
        }
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div className="relative px-6 py-4 mb-2" ref={searchRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-accent transition-colors duration-300" size={18} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="搜尋貼文..."
                    className="w-full bg-secondary/20 border border-transparent hover:bg-secondary/30 focus:bg-white focus:border-accent/30 focus:shadow-sm rounded-full pl-11 pr-10 py-3 text-sm text-foreground placeholder-muted-foreground/60 focus:outline-none transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.3,1)]"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            setResults([]);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isOpen && query && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.8, 0.3, 1] }}
                        className="absolute left-6 right-[-240px] top-full mt-4 bg-white/90 border border-white/50 rounded-2xl shadow-xl overflow-hidden z-50 max-h-[400px] overflow-y-auto custom-scrollbar backdrop-blur-2xl"
                    >
                        {results.length > 0 ? (
                            <div className="py-2">
                                {results.map(post => (
                                    <div
                                        key={post.id}
                                        onClick={() => handleSelect(post)}
                                        className="px-5 py-4 hover:bg-secondary/20 cursor-pointer border-b border-border/30 last:border-0 transition-colors duration-200"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="font-semibold text-foreground text-sm truncate">{post.author}</span>
                                                    <span className="text-xs text-muted-foreground/70">• {new Date(post.postedAt || post.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">{post.content || post.title}</p>
                                                {/* Highlight AI Summary match if applicable */}
                                                {post.analysis?.summary?.toLowerCase().includes(query.toLowerCase()) && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-accent-foreground bg-accent/80 px-2.5 py-1 rounded-full w-fit shadow-sm">
                                                        <Sparkles size={10} />
                                                        <span className="truncate max-w-[200px]">{post.analysis.summary}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                未找到結果
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SidebarSearch;
