import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, Sparkles, FolderOpen, FileText } from 'lucide-react';
import { searchLibrary } from '../api/searchApi';

const STATUS_LABELS = {
    completed: '已完成',
    awaiting_user: '等候確認',
    pending: '待處理',
    processing: '處理中',
    failed: '失敗'
};

function SearchResultCard({ result, onOpen }) {
    return (
        <button type="button" onClick={() => onOpen(result.post_id)} className="flow-surface w-full text-left p-4 sm:p-5 hover:-translate-y-0.5 hover:border-[var(--accent)] transition-all">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#615d59]">
                        <span className="uppercase tracking-[0.08em]">{result.platform || 'generic'}</span>
                        {result.workflow_status && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">{STATUS_LABELS[result.workflow_status] || result.workflow_status}</span>}
                    </div>
                    <h2 className="mt-2 font-semibold text-[rgba(0,0,0,0.95)] line-clamp-2">{result.title || '未命名貼文'}</h2>
                    {result.author_name && <p className="mt-1 text-xs text-[#615d59]">作者：{result.author_name}</p>}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[#615d59]/70">{Math.round(Number(result.score || 0))}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#615d59] line-clamp-3">{result.preview || '尚無摘要'}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
                {[...(result.memory_cues || []), ...(result.keywords || [])].slice(0, 8).map((term) => (
                    <span key={term} className="rounded-full border border-black/10 px-2 py-1 text-[10px] text-[#615d59]">{term}</span>
                ))}
            </div>
        </button>
    );
}

export default function SearchPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [input, setInput] = useState(params.get('q') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [status, setStatus] = useState(params.get('status') || '');

    useEffect(() => {
        const query = params.get('q') || '';
        setInput(query);
        setStatus(params.get('status') || '');
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await searchLibrary({ query, status, limit: 50 });
                setResults(payload.results || []);
            } catch (searchError) {
                setError(searchError.message);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, query ? 220 : 0);
        return () => window.clearTimeout(timer);
    }, [params, status]);

    const submit = (event) => {
        event.preventDefault();
        const next = new URLSearchParams(params);
        if (input.trim()) next.set('q', input.trim());
        else next.delete('q');
        if (status) next.set('status', status); else next.delete('status');
        setParams(next);
    };

    return (
        <div className="flow-page px-1 sm:px-2">
            <div className="pt-5 sm:pt-8 md:pt-12 mb-7">
                <p className="flow-kicker mb-2">記憶搜尋</p>
                <h1 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em]">找回收藏</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#615d59]">搜尋標題、原文、摘要、作者、標籤、草稿與 Hermes 萃取的記憶線索。這裡使用可解釋的文字搜尋，不使用向量。</p>
            </div>

            <form onSubmit={submit} className="flow-surface p-3 sm:p-4 flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#615d59]" />
                    <input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="例如：那個讓照片開口說話的工具" className="w-full rounded-md border border-black/10 bg-transparent pl-10 pr-3 py-3 text-sm focus:border-[var(--accent)] focus:outline-none" />
                </div>
                <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-[#615d59]" />
                    <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-black/10 bg-transparent px-3 py-3 text-sm focus:border-[var(--accent)] focus:outline-none">
                        <option value="">所有狀態</option>
                        <option value="completed">已完成</option>
                        <option value="awaiting_user">等候確認</option>
                        <option value="pending">待處理</option>
                    </select>
                    <button type="submit" className="notion-btn-primary px-5 py-3">搜尋</button>
                </div>
            </form>

            <div className="mb-4 flex items-center justify-between text-sm text-[#615d59]">
                <span>{loading ? '搜尋中…' : `${results.length} 筆結果`}</span>
                <span className="flex items-center gap-1 text-xs"><Sparkles size={14} className="text-[var(--accent)]" />可用自然語句回想</span>
            </div>
            {error && <div className="flow-panel mb-4 p-4 text-sm text-destructive">{error}</div>}
            {!loading && !error && results.length === 0 && (
                <div className="flow-panel min-h-[18rem] flex flex-col items-center justify-center text-center text-[#615d59]">
                    <FolderOpen size={28} className="mb-3 text-[var(--accent)]" />
                    <p className="font-semibold text-[rgba(0,0,0,0.95)]">還沒有符合的收藏</p>
                    <p className="mt-2 text-sm">先輸入一個你記得的詞、工具名稱或使用情境。</p>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {results.map((result) => <SearchResultCard key={result.post_id} result={result} onOpen={(id) => navigate(`/post/${id}`)} />)}
            </div>
            <div className="mt-6 text-xs text-[#615d59]/80 flex items-center gap-2"><FileText size={14} />搜尋結果會隨每次 Hermes 預處理更新。</div>
        </div>
    );
}
