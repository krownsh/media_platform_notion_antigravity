import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, FolderOpen, Lightbulb, Search, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { searchLibrary } from '../api/searchApi';
import './SearchPage.css';

const MATCH_LABELS = { raw_source: '原始貼文', post_learning_note: '已接受筆記', topic_assignment: '已接受 Topic', topic_knowledge: '已接受知識', project_reference: '已接受專案參考', candidate_folder: '候選資料夾', candidate_post_learning_note: '候選貼文筆記', candidate_topic_assignment: '候選 Topic', candidate_topic_knowledge: '候選 Topic 知識', candidate_project_reference: '候選專案參考' };

function SearchResultCard({ result, index, onOpen }) {
    const reasons = result.why_matched || [];
    return <button type="button" onClick={() => onOpen(result.post_id)} className="memory-result-card"><span className="memory-result-index">{String(index + 1).padStart(2, '0')}</span><div className="memory-result-main"><div className="memory-result-meta"><span className={result.source_quality === 'partial' ? 'is-partial' : 'is-complete'}>{result.source_quality === 'partial' ? '來源不完整' : '來源完整'}</span>{result.candidate_only && <span className="is-candidate"><ShieldAlert size={12} />尚未接受</span>}</div><h2>{result.title || '來源未提供標題'}</h2><p className="memory-result-author">{result.author_name ? `作者 · ${result.author_name}` : '來源作者未保留'}</p><p className="memory-result-preview">{result.preview || '尚無摘要'}</p><div className="memory-result-reasons">{reasons.map((reason) => <span key={reason} className={reason.startsWith('candidate_') ? 'is-candidate' : ''}>{MATCH_LABELS[reason] || reason}</span>)}</div></div><span className="memory-result-open" aria-hidden="true"><ArrowUpRight size={18} /></span></button>;
}

export default function SearchPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [input, setInput] = useState(params.get('q') || '');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [includeCandidates, setIncludeCandidates] = useState(params.get('includeCandidates') !== 'false');
    useEffect(() => { const query = params.get('q') || ''; setInput(query); const candidates = params.get('includeCandidates') !== 'false'; setIncludeCandidates(candidates); const timer = window.setTimeout(async () => { setLoading(true); setError(''); try { const payload = await searchLibrary({ query, includeCandidates: candidates, limit: 50 }); setResults(payload.results || []); } catch (searchError) { setError(searchError.message); setResults([]); } finally { setLoading(false); } }, query ? 220 : 0); return () => window.clearTimeout(timer); }, [params]);
    const submit = (event) => { event.preventDefault(); const next = new URLSearchParams(params); if (input.trim()) next.set('q', input.trim()); else next.delete('q'); next.set('includeCandidates', includeCandidates ? 'true' : 'false'); setParams(next); };
    return <div className="memory-search-page"><header className="memory-search-header"><div><p>MEMORY / RETRIEVAL</p><h1>找回一篇來源</h1><strong>從你記得的片段開始，原始貼文與已接受知識都會被檢索。</strong></div><aside><Sparkles size={17} /><span>語意檢索</span><small>原始來源與 Owner 已接受知識</small></aside></header><form onSubmit={submit} className="memory-query-panel"><label><span><Search size={20} /></span><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="描述你記得的工具、作者、情境或一句話…" aria-label="自然語言搜尋" /></label><button type="submit"><Search size={16} />開始檢索</button><div className="memory-query-options"><label className="memory-candidate-toggle"><input type="checkbox" checked={includeCandidates} onChange={(event) => setIncludeCandidates(event.target.checked)} /><span><i><Check size={12} /></i><b>包含尚未接受的候選</b><em>候選資料不會被當成正式知識。</em></span></label><p><ShieldCheck size={15} />每筆結果都標示命中依據</p></div></form><section className="memory-results" aria-live="polite"><header><div><p>RESULTS</p><h2>{loading ? '正在檢索記憶…' : input.trim() ? `「${input.trim()}」的命中結果` : '準備開始檢索'}</h2></div><span>{loading ? '…' : `${results.length} 筆`}</span></header>{error && <div className="memory-search-error">無法完成搜尋：{error}</div>}{!loading && !error && results.length === 0 && <div className="memory-empty"><FolderOpen size={31} /><h3>{input.trim() ? '這次還沒有找到對應來源' : '用一段模糊印象開始'}</h3><p>{input.trim() ? '換一個詞、作者或情境描述再試一次。' : '例如「會讓照片說話的工具」或「某位作者談寫作系統的那篇」。'}</p></div>}{loading && <div className="memory-result-loading">{[1, 2, 3].map((item) => <div key={item}><i /><span /><b /></div>)}</div>}{!loading && !error && <div className="memory-results-list">{results.map((result, index) => <SearchResultCard key={result.post_id} result={result} index={index} onOpen={(id) => navigate(`/post/${id}`)} />)}</div>}</section><footer className="memory-search-note"><Lightbulb size={15} /><span>原始貼文保存後即可搜尋；筆記、Topic 與專案脈絡則只會在 Owner 接受後列為正式命中。</span></footer></div>;
}
