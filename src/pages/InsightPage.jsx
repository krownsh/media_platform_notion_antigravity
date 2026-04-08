import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
    BarChart3, TrendingUp, Globe, Users, Tag, BookOpen,
    RefreshCw, Sparkles, AlertCircle, Settings, Plus, Save, Trash2, Edit3, X
} from 'lucide-react';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import { supabase } from '../api/supabaseClient';
import { API_BASE_URL } from '../api/config';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch wrapper
// ─────────────────────────────────────────────────────────────────────────────

async function fetchStats(endpoint, userId, params = {}) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    url.searchParams.set('userId', userId);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`${endpoint} failed: ${res.status}`);
    return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Category 標籤映射
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
    ai: '🤖 AI / 模型',
    tool: '🔧 工具 / 開源',
    market: '📈 市場 / 金融',
    security: '🔒 資安',
    research: '📄 研究 / 學術',
    launch: '🚀 發布 / 上線',
    opinion: '💬 觀點 / 心得',
    other: '📦 其他',
};

// ─────────────────────────────────────────────────────────────────────────────
// 主元件
// ─────────────────────────────────────────────────────────────────────────────

const InsightPage = () => {
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [batchStatus, setBatchStatus] = useState(null);

    const [overview, setOverview] = useState(null);
    const [categories, setCategories] = useState([]);
    const [domains, setDomains] = useState([]);
    const [authors, setAuthors] = useState([]);
    const [trend, setTrend] = useState([]);
    const [tags, setTags] = useState([]);
    const [configList, setConfigList] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    // 取得目前登入用戶
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.id) setUserId(data.user.id);
        });
    }, []);

    // 載入所有統計資料
    const loadStats = async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const [ov, cat, dom, auth, tr, tg, ov_configs] = await Promise.all([
                fetchStats('/api/stats/overview', userId),
                fetchStats('/api/stats/categories', userId),
                fetchStats('/api/stats/domains', userId, { limit: 10 }),
                fetchStats('/api/stats/authors', userId, { minCount: 2 }),
                fetchStats('/api/stats/trend', userId, { days: 30 }),
                fetchStats('/api/stats/tags', userId, { limit: 20 }),
                supabase.from('category_configs').select('*').order('created_at', { ascending: true })
            ]);
            setOverview(ov);
            setCategories((cat.categories || []).map(c => ({
                label: c.primary_category,
                value: c.count,
            })));
            setDomains(dom.domains || []);
            setAuthors(auth.authors || []);
            setTrend(tr.trend || []);
            setTags(tg.tags || []);
            const { data: configs } = ov_configs;
            setConfigList(configs || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) loadStats();
    }, [userId]);

    // 更新分類設定
    const handleSaveConfig = async (id) => {
        try {
            const { error: updateError } = await supabase
                .from('category_configs')
                .update({
                    label: editData.label,
                    description: editData.description,
                    patterns: typeof editData.patterns === 'string' ? JSON.parse(editData.patterns) : editData.patterns
                })
                .eq('id', id);

            if (updateError) throw updateError;
            setEditingId(null);
            loadStats(); // Reload to sync
        } catch (err) {
            alert(`儲存失敗: ${err.message}`);
        }
    };

    // 觸發批量分類
    const handleBatchClassify = async () => {
        setBatchStatus('running');
        try {
            const res = await fetch(`${API_BASE_URL}/api/batch-classify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruleOnly: true, limit: 200 }),
            });
            const data = await res.json();
            setBatchStatus(`✅ 完成：${data.processed} 筆已分類`);
            setTimeout(() => { setBatchStatus(null); loadStats(); }, 2000);
        } catch (err) {
            setBatchStatus(`❌ ${err.message}`);
            setTimeout(() => setBatchStatus(null), 3000);
        }
    };

    // Sparkline（迷你折線圖）
    const maxTrend = Math.max(...trend.map(t => t.count), 1);
    const sparklinePath = trend.length > 0
        ? trend.map((t, i) => {
            const x = (i / (trend.length - 1)) * 200;
            const y = 40 - (t.count / maxTrend) * 36;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ')
        : '';

    if (!userId) {
        return (
            <div className="flex items-center justify-center h-64 text-[#615d59]">
                請先登入以查看趨勢看板。
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-5xl mx-auto px-4 pb-20"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pt-8">
                <div>
                    <h2 className="text-3xl font-bold text-[rgba(0,0,0,0.95)] flex items-center gap-3">
                        <BarChart3 className="text-[#0075de]" size={28} />
                        情報趨勢看板
                    </h2>
                    <p className="text-[#615d59] text-sm mt-1">
                        分析你收藏的內容分佈，發現知識盲區與資訊熱點
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleBatchClassify}
                        disabled={batchStatus === 'running'}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent border notion-whisper-border text-sm font-medium text-[rgba(0,0,0,0.95)] hover:bg-[rgba(0,117,222,0.1)] hover:border-accent/30 transition-all shadow-soft-card disabled:opacity-50"
                    >
                        <Sparkles size={14} className="text-[#0075de]" />
                        {batchStatus === 'running' ? '分類中...' : batchStatus || '一鍵自動分類'}
                    </button>
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="p-2 rounded-lg bg-transparent border notion-whisper-border text-[#615d59] hover:text-[#0075de] transition-colors shadow-soft-card"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3 text-red-700">
                    <AlertCircle size={16} />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* ── 總覽卡片 ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    label="總收藏貼文"
                    value={overview?.total_posts ?? '—'}
                    icon={<BookOpen size={18} />}
                    colorClass="text-violet-500"
                    subtext="已採集的貼文總數"
                />
                <StatCard
                    label="已分析貼文"
                    value={overview?.total_analyzed ?? '—'}
                    icon={<Sparkles size={18} />}
                    colorClass="text-amber-500"
                    subtext="已取得主分類標籤"
                />
                <StatCard
                    label="最熱門分類"
                    value={overview?.top_category ? CATEGORY_LABELS[overview.top_category.primary_category] || overview.top_category.primary_category : '—'}
                    icon={<Tag size={18} />}
                    colorClass="text-emerald-500"
                    subtext={overview?.top_category ? `共 ${overview.top_category.count} 篇` : ''}
                />
                <StatCard
                    label="熱門來源"
                    value={domains[0]?.domain || '—'}
                    icon={<Globe size={18} />}
                    colorClass="text-blue-500"
                    subtext={domains[0] ? `被引用 ${domains[0].count} 次` : ''}
                />
            </div>

            {/* ── 中間：類別分佈 + 時間趨勢 ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* 類別分佈 */}
                <div className="bg-transparent backdrop-blur-xl rounded-lg border notion-whisper-border shadow-soft-card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 size={16} className="text-[#0075de]" />
                        <h3 className="text-sm font-bold text-[rgba(0,0,0,0.95)] uppercase tracking-wider">主題分佈</h3>
                    </div>
                    {categories.length > 0
                        ? <BarChart data={categories.map(c => ({ ...c, label: c.label || 'other' }))} />
                        : <p className="text-sm text-[#615d59]/60 text-center py-8">尚無分類資料，點擊「一鍵自動分類」開始</p>
                    }
                </div>

                {/* 時間趨勢 Sparkline */}
                <div className="bg-transparent backdrop-blur-xl rounded-lg border notion-whisper-border shadow-soft-card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <TrendingUp size={16} className="text-[#0075de]" />
                        <h3 className="text-sm font-bold text-[rgba(0,0,0,0.95)] uppercase tracking-wider">近 30 天採集趨勢</h3>
                    </div>
                    {trend.length > 0 ? (
                        <div>
                            <svg viewBox="0 0 200 44" className="w-full h-28" preserveAspectRatio="none">
                                {/* Grid lines */}
                                {[0, 1, 2].map(i => (
                                    <line key={i} x1="0" y1={i * 18 + 4} x2="200" y2={i * 18 + 4}
                                        stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.5" />
                                ))}
                                {/* Area fill */}
                                <path
                                    d={`${sparklinePath} L 200 44 L 0 44 Z`}
                                    fill="url(#sparkGradient)"
                                    fillOpacity="0.3"
                                />
                                {/* Line */}
                                <path d={sparklinePath} fill="none" stroke="#7c6ef5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Gradient def */}
                                <defs>
                                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#7c6ef5" />
                                        <stop offset="100%" stopColor="#7c6ef5" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <div className="flex justify-between text-[10px] text-[#615d59]/60 mt-1">
                                <span>{trend[0]?.date}</span>
                                <span>{trend[trend.length - 1]?.date}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-[#615d59]/60 text-center py-8">暫無時間軸資料</p>
                    )}
                </div>
            </div>

            {/* ── 下排：Domain 排行 + Rising Voices ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Domain 排行 */}
                <div className="bg-transparent backdrop-blur-xl rounded-lg border notion-whisper-border shadow-soft-card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Globe size={16} className="text-[#0075de]" />
                        <h3 className="text-sm font-bold text-[rgba(0,0,0,0.95)] uppercase tracking-wider">熱門來源 Domain</h3>
                    </div>
                    {domains.length > 0 ? (
                        <div className="space-y-2">
                            {domains.map((d, idx) => (
                                <div key={d.domain} className="flex items-center justify-between py-1.5 border-b border-[rgba(0,0,0,0.1)]/10 last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-[#615d59]/60 w-5 text-right">{idx + 1}</span>
                                        <a href={`https://${d.domain}`} target="_blank" rel="noopener noreferrer"
                                            className="text-sm font-medium text-[rgba(0,0,0,0.95)] hover:text-[#0075de] transition-colors">
                                            {d.domain}
                                        </a>
                                    </div>
                                    <span className="text-xs font-bold text-[#0075de] bg-[rgba(0,117,222,0.1)] px-2 py-0.5 rounded-full">
                                        ×{d.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[#615d59]/60 text-center py-8">尚無 Domain 資料</p>
                    )}
                </div>

                {/* Rising Voices */}
                <div className="bg-transparent backdrop-blur-xl rounded-lg border notion-whisper-border shadow-soft-card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Users size={16} className="text-[#0075de]" />
                        <h3 className="text-sm font-bold text-[rgba(0,0,0,0.95)] uppercase tracking-wider">常看作者（Rising Voices）</h3>
                    </div>
                    {authors.length > 0 ? (
                        <div className="space-y-3">
                            {authors.slice(0, 8).map((a) => (
                                <div key={a.authorHandle} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                            {(a.author?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-[rgba(0,0,0,0.95)] leading-none">{a.author || 'Unknown'}</p>
                                            <p className="text-xs text-[#615d59] mt-0.5">@{a.authorHandle} · {a.platform}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        {a.count} 篇
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-[#615d59]/60 text-center py-8">暫無作者統計（需 2 篇以上）</p>
                    )}
                </div>
            </div>

            {/* ── Tag Cloud ── */}
            {tags.length > 0 && (
                <div className="bg-transparent backdrop-blur-xl rounded-lg border notion-whisper-border shadow-soft-card p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Tag size={16} className="text-[#0075de]" />
                        <h3 className="text-sm font-bold text-[rgba(0,0,0,0.95)] uppercase tracking-wider">熱門標籤</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((t) => {
                            const maxCount = tags[0]?.count || 1;
                            const size = 0.75 + (t.count / maxCount) * 0.5;
                            return (
                                <span
                                    key={t.tag}
                                    className="px-3 py-1 rounded-full bg-[rgba(0,117,222,0.1)] text-[#0075de] font-medium border border-accent/20 cursor-default hover:bg-[#0075de]/20 transition-colors"
                                    style={{ fontSize: `${size}rem` }}
                                    title={`${t.count} 次`}
                                >
                                    #{t.tag}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── 分類策略管理區 (Setting Section) ── */}
            <div className="mt-8 bg-transparent backdrop-blur-xl rounded-lg border notion-whisper-border shadow-soft-card overflow-hidden">
                <div className="px-6 py-4 border-b notion-whisper-border bg-black/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings size={18} className="text-[#615d59]" />
                        <h3 className="text-sm font-bold text-[rgba(0,0,0,0.95)] uppercase tracking-wider">情報分類策略管理</h3>
                    </div>
                    <button
                        onClick={async () => {
                            const newSlug = prompt('請輸入分類 Slug (例如: ai, tool):');
                            if (!newSlug) return;
                            const { error } = await supabase.from('category_configs').insert({
                                slug: newSlug,
                                label: '新分類',
                                description: '點擊編輯定義...'
                            });
                            if (error) alert(error.message);
                            else loadStats();
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-[#0075de] text-white hover:bg-[#0075de]/90 transition-colors shadow-sm"
                    >
                        <Plus size={14} />
                        新增分類
                    </button>
                </div>

                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-black/[0.01] text-[10px] uppercase tracking-widest text-[#615d59]/60 border-b notion-whisper-border">
                                <th className="px-6 py-3 font-bold w-32">Slug / 代碼</th>
                                <th className="px-6 py-3 font-bold w-40">顯示名稱</th>
                                <th className="px-6 py-3 font-bold">AI 分類定義 (Description for LLM)</th>
                                <th className="px-6 py-3 font-bold w-24">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y border-[rgba(0,0,0,0.05)]">
                            {configList.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-[#615d59]/60 italic text-sm">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle size={24} className="opacity-20" />
                                            尚無分類定義，請點擊上方「新增分類」建立規則。
                                        </div>
                                    </td>
                                </tr>
                            ) : configList.map((config) => (
                                <tr key={config.id} className="group hover:bg-black/[0.01] transition-colors">
                                    <td className="px-6 py-4">
                                        <code className="text-[10px] font-mono bg-black/5 px-1.5 py-0.5 rounded text-[#0075de]">
                                            {config.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-sm">
                                        {editingId === config.id ? (
                                            <input
                                                className="w-full px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-[#0075de] outline-none"
                                                value={editData.label}
                                                onChange={(e) => setEditData({ ...editData, label: e.target.value })}
                                            />
                                        ) : (
                                            config.label
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingId === config.id ? (
                                            <textarea
                                                className="w-full px-2 py-1 border rounded text-xs h-20 focus:ring-1 focus:ring-[#0075de] outline-none leading-relaxed"
                                                value={editData.description}
                                                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                            />
                                        ) : (
                                            <p className="text-xs text-[#615d59] leading-relaxed line-clamp-2 italic">
                                                {config.description || '尚未設定定義'}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            {editingId === config.id ? (
                                                <>
                                                    <button
                                                        onClick={() => handleSaveConfig(config.id)}
                                                        className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 transition-colors"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingId(null)}
                                                        className="p-1.5 rounded hover:bg-red-50 text-red-600 transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(config.id);
                                                            setEditData(config);
                                                        }}
                                                        className="p-1.5 rounded hover:bg-black/5 text-[#615d59] opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('確定要刪除此分類定義？此動作將影響後續 AI 分類。')) {
                                                                const { error } = await supabase.from('category_configs').delete().eq('id', config.id);
                                                                if (error) alert(error.message);
                                                                else loadStats();
                                                            }
                                                        }}
                                                        className="p-1.5 rounded hover:bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 bg-black/[0.01] border-t notion-whisper-border flex items-center gap-2">
                    <AlertCircle size={12} className="text-[#0075de]" />
                    <p className="text-[10px] text-[#615d59]/70 italic">
                        提示：此處定義的 Description 會直接影響 「一鍵自動分類」 時 AI 的判斷基準。優化定義可大幅提昇準確率。
                    </p>
                </div>
            </div>
        </motion.div >
    );
};

export default InsightPage;
