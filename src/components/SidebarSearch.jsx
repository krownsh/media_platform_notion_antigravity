import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { searchLibrary } from '../api/searchApi';

const SidebarSearch = ({ collapsed, onExpand, onSearchSelect }) => {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const searchRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return undefined;
        }
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const payload = await searchLibrary({ query, limit: 8 });
                setResults(payload.results || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 260);
        return () => window.clearTimeout(timer);
    }, [query]);

    const openSearch = () => {
        if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        else navigate('/search');
        setIsOpen(false);
        onSearchSelect?.();
    };

    const handleSelect = (postId) => {
        navigate(`/post/${postId}`);
        setIsOpen(false);
        setQuery('');
        onSearchSelect?.();
    };

    if (collapsed) {
        return <div className="px-2 py-4 mb-2 flex justify-center"><button onClick={onExpand} className="flow-icon-button bg-[var(--surface-muted)]" title="搜尋整個收藏庫" aria-label="展開搜尋"><Search size={20} /></button></div>;
    }

    return (
        <div className="relative px-4 sm:px-5 py-4 mb-2" ref={searchRef}>
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#615d59]/70 group-focus-within:text-[var(--accent)]" size={18} />
                <input
                    type="text"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); openSearch(); } }}
                    placeholder="搜尋整個收藏庫..."
                    className="w-full bg-[var(--surface-muted)] border border-transparent hover:bg-[var(--surface-raised)] focus:bg-surface-raised focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] rounded-md pl-11 pr-10 py-3 text-sm focus:outline-none"
                    aria-label="搜尋整個收藏庫"
                />
                {query && <button onClick={() => setQuery('')} className="flow-icon-button absolute right-1.5 top-1/2 min-h-8 min-w-8 -translate-y-1/2 hover:text-destructive" aria-label="清除搜尋內容"><X size={16} /></button>}
            </div>
            <AnimatePresence>
                {isOpen && query && (
                    <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-0 right-0 sm:left-5 sm:right-5 md:right-[-240px] top-full mt-3 bg-surface-raised border notion-whisper-border rounded-[0.85rem] shadow-deep overflow-hidden z-50 max-h-[70vh] overflow-y-auto max-w-[calc(100vw-1rem)]">
                        {loading ? <div className="p-5 text-center text-sm text-[#615d59]">搜尋中…</div> : results.length > 0 ? (
                            <div className="py-2">
                                {results.map((result) => <button type="button" key={result.post_id} onClick={() => handleSelect(result.post_id)} className="w-full px-4 sm:px-5 py-3 text-left hover:bg-[var(--accent-soft)] border-b notion-whisper-border last:border-0">
                                    <div className="flex items-center gap-2 text-[10px] text-[#615d59]"><span>{result.platform}</span><Sparkles size={10} className="text-[var(--accent)]" /></div>
                                    <p className="mt-1 text-sm font-semibold truncate">{result.title || '未命名貼文'}</p>
                                    <p className="mt-1 text-xs text-[#615d59] line-clamp-2">{result.preview}</p>
                                </button>)}
                                <button type="button" onClick={openSearch} className="w-full px-4 sm:px-5 py-3 text-center text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]">查看全部搜尋結果</button>
                            </div>
                        ) : <div className="p-5 text-center text-sm text-[#615d59]">找不到結果，按 Enter 查看完整搜尋頁。</div>}
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SidebarSearch;
