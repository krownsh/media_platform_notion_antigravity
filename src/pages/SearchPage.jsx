import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Sparkles, FolderOpen, FileText, ShieldCheck, Lightbulb } from 'lucide-react';
import { searchLibrary } from '../api/searchApi';

const MATCH_LABELS = {
    raw_source: '原始貼文',
    post_learning_note: '已接受的貼文筆記',
    topic_assignment: '已接受的 Topic',
    topic_knowledge: '已接受的 Topic 知識',
    project_reference: '已接受的專案參考',
    candidate_folder: '候選資料夾',
    candidate_post_learning_note: '候選貼文筆記',
    candidate_topic_assignment: '候選 Topic',
    candidate_topic_knowledge: '候選 Topic 知識',
    candidate_project_reference: '候選專案參考'
};

function SearchResultCard({ result, onOpen }) {
    return (
        <button type="button" onClick={() => onOpen(result.post_id)} className="flow-surface w-full text-left p-4 sm:p-5 hover:-translate-y-0.5 hover:border-[var(--accent)] transition-all">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#615d59]">
                        <span>{result.source_quality === 'partial' ? '來源不完整' : '來源完整'}</span>
                        {result.candidate_only && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">僅候選，尚未接受</span>}
                    </div>
                    <h2 className="mt-2 font-semibold text-[rgba(0,0,0,0.95)] line-clamp-2">{result.title || '來源未提供標題'}</h2>
                    {result.author_name && <p className="mt-1 text-xs text-[#615d59]">作者：{result.author_name}</p>}
                </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#615d59] line-clamp-3">{result.preview || '尚無摘要'}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
                {(result.why_matched || []).map((reason) => (
                    <span key={reason} className={`rounded-full border px-2 py-1 text-[10px] ${reason.startsWith('candidate_') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-black/10 text-[#615d59]'}`}>{MATCH_LABELS[reason] || reason}</span>
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
    const [includeCandidates, setIncludeCandidates] = useState(params.get('includeCandidates') === 'true');

    useEffect(() => {
        const query = params.get('q') || '';
        setInput(query);
        const candidates = params.get('includeCandidates') === 'true';
        setIncludeCandidates(candidates);
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await searchLibrary({ query, includeCandidates: candidates, limit: 50 });
                setResults(payload.results || []);
            } catch (searchError) {
                setError(searchError.message);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, query ? 220 : 0);
        return () => window.clearTimeout(timer);
    }, [params]);

    const submit = (event) => {
        event.preventDefault();
        const next = new URLSearchParams(params);
        if (input.trim()) next.set('q', input.trim());
        else next.delete('q');
        if (includeCandidates) next.set('includeCandidates', 'true'); else next.delete('includeCandidates');
        setParams(next);
    };

    return (
        <div className="flow-page px-1 sm:px-2">
            <div className="pt-5 sm:pt-8 md:pt-12 mb-7">
                <p className="flow-kicker mb-2">記憶搜尋</p>
                <h1 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em]">找回收藏</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#615d59]">搜尋原始貼文與你已接受的筆記、Topic 知識、專案參考。每一筆結果都會告訴你它為什麼出現。</p>
            </div>

            <form onSubmit={submit} className="flow-surface p-3 sm:p-4 flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#615d59]" />
                    <input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="例如：那個讓照片開口說話的工具" className="w-full rounded-md border border-black/10 bg-transparent pl-10 pr-3 py-3 text-sm focus:border-[var(--accent)] focus:outline-none" />
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[#615d59]" title="候選資料尚未寫入正式知識">
                        <input type="checkbox" checked={includeCandidates} onChange={(event) => setIncludeCandidates(event.target.checked)} className="accent-[var(--accent)]" />
                        包含尚未接受的候選
                    </label>
                    <button type="submit" className="notion-btn-primary px-5 py-3">搜尋</button>
                </div>
            </form>

            <div className="mb-4 flex items-center justify-between text-sm text-[#615d59]">
                <span>{loading ? '搜尋中…' : `${results.length} 筆結果`}</span>
                <span className="flex items-center gap-1 text-xs"><ShieldCheck size={14} className="text-[var(--accent)]" />正式與候選清楚分開</span>
            </div>
            {error && <div className="flow-panel mb-4 p-4 text-sm text-destructive">{error}</div>}
            {!loading && !error && results.length === 0 && (
                <div className="flow-panel min-h-[18rem] flex flex-col items-center justify-center text-center text-[#615d59]">
                    <FolderOpen size={28} className="mb-3 text-[var(--accent)]" />
                    <p className="font-semibold text-[rgba(0,0,0,0.95)]">還沒有符合的收藏</p>
                    <p className="mt-2 text-sm">先輸入你記得的詞、工具名稱、作者或使用情境。</p>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {results.map((result) => <SearchResultCard key={result.post_id} result={result} onOpen={(id) => navigate(`/post/${id}`)} />)}
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs text-[#615d59]/80"><Lightbulb size={14} />原始貼文會立即可搜；接受決定後，相關知識會重新索引。{includeCandidates && <><FileText size={14} />黃色標籤代表仍待你確認。</>}</div>
        </div>
    );
}
