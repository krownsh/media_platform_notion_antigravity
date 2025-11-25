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
        <div className="relative px-4 py-2 mb-2" ref={searchRef}>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-white transition-colors" size={16} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Search..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:border-white/20 transition-all"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            setResults([]);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isOpen && query && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-4 right-[-240px] top-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto custom-scrollbar backdrop-blur-xl"
                    >
                        {results.length > 0 ? (
                            <div className="py-2">
                                {results.map(post => (
                                    <div
                                        key={post.id}
                                        onClick={() => handleSelect(post)}
                                        className="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium text-white text-sm truncate">{post.author}</span>
                                                    <span className="text-xs text-gray-500">• {new Date(post.postedAt || post.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 line-clamp-2 mb-1">{post.content || post.title}</p>
                                                {/* Highlight AI Summary match if applicable */}
                                                {post.analysis?.summary?.toLowerCase().includes(query.toLowerCase()) && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md w-fit">
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
                            <div className="p-4 text-center text-gray-500 text-sm">
                                No results found
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SidebarSearch;
