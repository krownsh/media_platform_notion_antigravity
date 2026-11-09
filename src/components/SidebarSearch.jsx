import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Sparkles } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { searchLibrary } from '../api/searchApi';
import './SidebarSearch.css';

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
        return <div className="editorial-sidebar-search-collapsed"><button onClick={onExpand} title="搜尋整個收藏庫" aria-label="展開搜尋"><Search size={20} /></button></div>;
    }

    return (
        <div className="editorial-sidebar-search" ref={searchRef}>
            <div className="editorial-sidebar-search-field">
                <Search size={17} />
                <input
                    type="text"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); openSearch(); } }}
                    placeholder="搜尋整個收藏庫..."
                    className="editorial-sidebar-search-input"
                    aria-label="搜尋整個收藏庫"
                />
                {query && <button onClick={() => setQuery('')} className="editorial-sidebar-search-clear" aria-label="清除搜尋內容"><X size={15} /></button>}
            </div>
            <AnimatePresence>
                {isOpen && query && (
                    <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="editorial-sidebar-search-results">
                        {loading ? <div className="editorial-sidebar-search-message">搜尋中…</div> : results.length > 0 ? (
                            <div>
                                {results.map((result) => <button type="button" key={result.post_id} onClick={() => handleSelect(result.post_id)} className="editorial-sidebar-search-result">
                                    <div><span>{result.platform}</span><Sparkles size={10} /></div>
                                    <p>{result.title || '來源未提供標題'}</p>
                                    <small>{result.preview}</small>
                                </button>)}
                                <button type="button" onClick={openSearch} className="editorial-sidebar-search-all">前往完整搜尋 <span>↗</span></button>
                            </div>
                        ) : <div className="editorial-sidebar-search-message">找不到結果，按 Enter 查看完整搜尋頁。</div>}
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SidebarSearch;
