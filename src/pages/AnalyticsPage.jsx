import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, BookOpen, Globe, RefreshCw, Tag, TrendingUp, Users } from 'lucide-react';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import { API_BASE_URL } from '../api/config';
import { authenticatedFetch } from '../api/authenticatedFetch';

async function fetchStats(path, params = {}) {
    const url = new URL(`${API_BASE_URL}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await authenticatedFetch(url.toString());
    if (!response.ok) throw new Error(`讀取分析資料失敗（${response.status}）`);
    return response.json();
}

function emptyMessage(message) { return <p className="py-8 text-center text-sm text-[#615d59]">{message}</p>; }

export default function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState({ overview: null, categories: [], domains: [], authors: [], trend: [], tags: [] });
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [overview, categoryResponse, domainResponse, authorResponse, trendResponse, tagResponse] = await Promise.all([
                fetchStats('/api/stats/overview'), fetchStats('/api/stats/categories'), fetchStats('/api/stats/domains', { limit: 10 }),
                fetchStats('/api/stats/authors', { minCount: 2 }), fetchStats('/api/stats/trend', { days: 30 }), fetchStats('/api/stats/tags', { limit: 20 })
            ]);
            setData({ overview, categories: categoryResponse.categories || [], domains: domainResponse.domains || [], authors: authorResponse.authors || [], trend: trendResponse.trend || [], tags: tagResponse.tags || [] });
        } catch (loadError) { setError(loadError.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const chartData = useMemo(() => data.categories.map(item => ({ label: item.primary_category || 'other', value: item.count })), [data.categories]);
    const maxTrend = Math.max(...data.trend.map(item => item.count || 0), 1);
    const trendPath = data.trend.length > 1 ? data.trend.map((item, index) => `${index ? 'L' : 'M'} ${(index / (data.trend.length - 1)) * 200} ${42 - ((item.count || 0) / maxTrend) * 36}`).join(' ') : '';

    return <div className="flow-page max-w-6xl px-1 sm:px-2">
        <header className="flex flex-wrap items-end justify-between gap-4 pt-5 sm:pt-8 md:pt-12"><div><p className="flow-kicker mb-2">唯讀概覽</p><h1 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em]">分析數據</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#615d59]">用既有收藏觀察來源與分佈。這個頁面只讀取資料，絕不會替你自動分類或改寫任何貼文。</p></div><button type="button" onClick={load} disabled={loading} className="flow-icon-button border notion-whisper-border" aria-label="重新整理分析數據"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button></header>
        {error && <p role="alert" className="mt-6 flow-panel border-destructive/30 p-4 text-sm text-destructive">{error}</p>}
        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="總收藏貼文" value={loading ? '—' : data.overview?.total_posts ?? 0} icon={<BookOpen size={18} />} colorClass="text-[var(--accent)]" subtext="已保存的來源" /><StatCard label="已分析貼文" value={loading ? '—' : data.overview?.total_analyzed ?? 0} icon={<BarChart3 size={18} />} colorClass="text-[var(--accent)]" subtext="已有分析資料的來源" /><StatCard label="最多分類" value={loading ? '—' : data.overview?.top_category?.primary_category || '尚無'} icon={<Tag size={18} />} colorClass="text-[var(--accent)]" subtext={data.overview?.top_category ? `${data.overview.top_category.count} 篇` : '沒有自動補寫動作'} /><StatCard label="常見來源" value={loading ? '—' : data.domains[0]?.domain || '尚無'} icon={<Globe size={18} />} colorClass="text-[var(--accent)]" subtext={data.domains[0] ? `${data.domains[0].count} 篇` : '等待更多來源'} /></section>
        <section className="mt-7 grid gap-6 md:grid-cols-2"><div className="flow-surface p-5 sm:p-6"><div className="flex items-center gap-2"><BarChart3 size={16} className="text-[var(--accent)]" /><h2 className="font-semibold">分類分佈</h2></div>{loading ? emptyMessage('正在讀取…') : chartData.length ? <div className="mt-5"><BarChart data={chartData} /></div> : emptyMessage('尚無可顯示的分類資料')}</div><div className="flow-surface p-5 sm:p-6"><div className="flex items-center gap-2"><TrendingUp size={16} className="text-[var(--accent)]" /><h2 className="font-semibold">近 30 天收藏趨勢</h2></div>{loading ? emptyMessage('正在讀取…') : trendPath ? <div className="mt-5"><svg viewBox="0 0 200 46" className="h-28 w-full" preserveAspectRatio="none"><path d={`${trendPath} L 200 46 L 0 46 Z`} fill="var(--accent)" fillOpacity="0.12" /><path d={trendPath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="flex justify-between text-[10px] text-[#615d59]"><span>{data.trend[0]?.date}</span><span>{data.trend[data.trend.length - 1]?.date}</span></div></div> : emptyMessage('暫無時間趨勢資料')}</div></section>
        <section className="mt-7 grid gap-6 md:grid-cols-2"><div className="flow-surface p-5 sm:p-6"><div className="flex items-center gap-2"><Globe size={16} className="text-[var(--accent)]" /><h2 className="font-semibold">常見來源</h2></div>{loading ? emptyMessage('正在讀取…') : data.domains.length ? <ol className="mt-4 divide-y divide-black/5">{data.domains.map((item, index) => <li key={item.domain} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="min-w-0 truncate"><span className="mr-3 text-xs text-[#615d59]">{index + 1}</span>{item.domain}</span><span className="notion-badge shrink-0">{item.count} 篇</span></li>)}</ol> : emptyMessage('尚無來源統計')}</div><div className="flow-surface p-5 sm:p-6"><div className="flex items-center gap-2"><Users size={16} className="text-[var(--accent)]" /><h2 className="font-semibold">常看作者</h2></div>{loading ? emptyMessage('正在讀取…') : data.authors.length ? <ol className="mt-4 space-y-3">{data.authors.slice(0, 8).map(item => <li key={`${item.authorHandle}-${item.platform}`} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{item.author || '未命名作者'} <span className="text-xs text-[#615d59]">{item.authorHandle ? `@${item.authorHandle}` : ''}</span></span><span className="notion-badge shrink-0">{item.count} 篇</span></li>)}</ol> : emptyMessage('尚無重複作者資料')}</div></section>
        {data.tags.length > 0 && <section className="mt-7 flow-surface p-5 sm:p-6"><div className="flex items-center gap-2"><Tag size={16} className="text-[var(--accent)]" /><h2 className="font-semibold">常見標籤</h2></div><div className="mt-4 flex flex-wrap gap-2">{data.tags.map(item => <span key={item.tag} className="notion-badge px-3 py-1">#{item.tag} · {item.count}</span>)}</div></section>}
    </div>;
}
