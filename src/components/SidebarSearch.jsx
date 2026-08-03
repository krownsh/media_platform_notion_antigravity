import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const SidebarSearch = ({ collapsed, onExpand }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const { items } = useSelector(state => state.posts);
    const searchRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const results = useMemo(() => {
        if (!query.trim()) return [];
        const lowerQuery = query.toLowerCase();
        const filtered = items.filter(post => {
            const contentMatch = post.content?.toLowerCase().includes(lowerQuery);
            const authorMatch = post.author?.toLowerCase().includes(lowerQuery);
            const summaryMatch = typeof post.analysis?.summary === 'string' && post.analysis.summary.toLowerCase().includes(lowerQuery);
            // Check comments if they exist
            const commentsMatch = post.comments?.some(c => c.text?.toLowerCase().includes(lowerQuery));

            return contentMatch || authorMatch || summaryMatch || commentsMatch;
        });

        return filtered.slice(0, 10); // Limit to 10 results
    }, [query, items]);

    const handleSelect = (post) => {
        navigate(`/post/${post.dbId || post.id}`);
        setIsOpen(false);
        setQuery('');
    };

    if (collapsed) {
        return (
            <div className="px-2 py-4 mb-2 flex justify-center">
                <button
                    onClick={onExpand}
                    className="flow-icon-button bg-[var(--surface-muted)]"
                    title="搜尋"
                    aria-label="展開搜尋"
                >
                    <Search size={20} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative px-4 sm:px-5 py-4 mb-2" ref={searchRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#615d59]/70 group-focus-within:text-[var(--accent)] transition-colors duration-300" size={18} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="搜尋貼文..."
                    className="w-full bg-[var(--surface-muted)] border border-transparent hover:bg-[var(--surface-raised)] focus:bg-surface-raised focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] rounded-md pl-11 pr-10 py-3 text-sm text-[rgba(0,0,0,0.95)] placeholder-muted-foreground/60 focus:outline-none transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    aria-label="搜尋貼文、作者或摘要"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                        }}
                        className="flow-icon-button absolute right-1.5 top-1/2 min-h-8 min-w-8 -translate-y-1/2 hover:text-destructive"
                        aria-label="清除搜尋內容"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {isOpen && query && (
                    <Motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 right-0 sm:left-5 sm:right-5 md:right-[-240px] top-full mt-3 bg-surface-raised border notion-whisper-border rounded-[0.85rem] shadow-deep overflow-hidden z-50 max-h-[70vh] sm:max-h-[400px] overflow-y-auto custom-scrollbar max-w-[calc(100vw-1rem)]"
                    >
                        {results.length > 0 ? (
                            <div className="py-2">
                                {results.map(post => (
                                    <div
                                        key={post.id}
                                        onClick={() => handleSelect(post)}
                                        className="px-4 sm:px-5 py-3 sm:py-4 hover:bg-[var(--accent-soft)] cursor-pointer border-b notion-whisper-border last:border-0 transition-colors duration-200"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="font-semibold text-[rgba(0,0,0,0.95)] text-sm truncate">{post.author}</span>
                                                    <span className="text-xs text-[#615d59]/70">{new Date(post.postedAt || post.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs text-[#615d59] line-clamp-2 mb-2 leading-relaxed">{post.content || post.title}</p>
                                                {/* Highlight AI Summary match if applicable */}
                                                {typeof post.analysis?.summary === 'string' && post.analysis.summary.toLowerCase().includes(query.toLowerCase()) && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1 rounded-full w-fit">
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
                            <div className="p-8 text-center text-[#615d59] text-sm leading-6">
                                沒有符合的結果，試著改用作者、內容或摘要中的詞語。
                            </div>
                        )}
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SidebarSearch;
