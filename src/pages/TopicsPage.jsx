import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Plus, RefreshCw, Sparkles, Target } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { authenticatedFetch } from '../api/authenticatedFetch';

function slugify(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}

function splitList(value) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

async function responseData(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
}

const TopicsPage = () => {
    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [slugTouched, setSlugTouched] = useState(false);
    const [form, setForm] = useState({
        title: '', slug: '', description: '', purpose: '', keywords: '', desiredOutcomes: ''
    });

    const loadTopics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics`));
            setTopics(data.topics || []);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTopics();
    }, [loadTopics]);

    const updateForm = (field, value) => {
        setForm((current) => {
            if (field === 'title' && !slugTouched) {
                return { ...current, title: value, slug: slugify(value) };
            }
            return { ...current, [field]: value };
        });
    };

    const createTopic = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const data = await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title,
                    slug: form.slug,
                    description: form.description,
                    purpose: form.purpose,
                    keywords: splitList(form.keywords),
                    desired_outcomes: splitList(form.desiredOutcomes)
                })
            }));
            setTopics((current) => [data.topic, ...current]);
            setForm({ title: '', slug: '', description: '', purpose: '', keywords: '', desiredOutcomes: '' });
            setSlugTouched(false);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 sm:pt-8 mb-8">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                        <Target className="text-[#0075de]" size={28} /> 主題工作區
                    </h2>
                    <p className="text-sm text-[#615d59] mt-1">把收藏連成你想持續研究、實作或創作的脈絡。</p>
                </div>
                <button onClick={loadTopics} disabled={loading} className="self-start sm:self-auto p-2 rounded-lg border notion-whisper-border text-[#615d59] hover:text-[#0075de] hover:bg-black/5 disabled:opacity-50" title="重新整理">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3 text-red-700">
                    <AlertCircle size={17} /><span className="text-sm">{error}</span>
                </div>
            )}

            <form onSubmit={createTopic} className="mb-8 bg-white border notion-whisper-border rounded-lg shadow-soft-card p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Plus size={18} className="text-[#0075de]" /><h3 className="font-semibold">建立你的主題</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="text-sm text-[#615d59]">名稱
                        <input required maxLength="160" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="例如：AI 工作流程自動化" className="mt-1.5 w-full rounded-md border notion-whisper-border px-3 py-2 text-[rgba(0,0,0,0.95)]" />
                    </label>
                    <label className="text-sm text-[#615d59]">Slug
                        <input required maxLength="80" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,79}" value={form.slug} onChange={(event) => { setSlugTouched(true); updateForm('slug', event.target.value); }} placeholder="ai-workflow-automation" className="mt-1.5 w-full rounded-md border notion-whisper-border px-3 py-2 text-[rgba(0,0,0,0.95)]" />
                    </label>
                    <label className="text-sm text-[#615d59] sm:col-span-2">這個主題想解決什麼？
                        <textarea value={form.purpose} onChange={(event) => updateForm('purpose', event.target.value)} rows="2" placeholder="例如：把重複的內容研究與產出流程變成可驗證的系統。" className="mt-1.5 w-full rounded-md border notion-whisper-border px-3 py-2 text-[rgba(0,0,0,0.95)] resize-y" />
                    </label>
                    <label className="text-sm text-[#615d59] sm:col-span-2">背景描述（選填）
                        <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows="2" placeholder="這會協助之後的來源匹配與 Agent 發想。" className="mt-1.5 w-full rounded-md border notion-whisper-border px-3 py-2 text-[rgba(0,0,0,0.95)] resize-y" />
                    </label>
                    <label className="text-sm text-[#615d59]">關鍵字（逗號分隔）
                        <input value={form.keywords} onChange={(event) => updateForm('keywords', event.target.value)} placeholder="agent, automation, workflow" className="mt-1.5 w-full rounded-md border notion-whisper-border px-3 py-2 text-[rgba(0,0,0,0.95)]" />
                    </label>
                    <label className="text-sm text-[#615d59]">預期成果（逗號分隔）
                        <input value={form.desiredOutcomes} onChange={(event) => updateForm('desiredOutcomes', event.target.value)} placeholder="研究問題, POC, 內容草稿" className="mt-1.5 w-full rounded-md border notion-whisper-border px-3 py-2 text-[rgba(0,0,0,0.95)]" />
                    </label>
                </div>
                <div className="mt-5 flex justify-end">
                    <button type="submit" disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-md bg-[rgba(0,0,0,0.95)] text-white text-sm font-medium hover:bg-black disabled:opacity-50">
                        <Sparkles size={15} /> {submitting ? '建立中...' : '建立主題'}
                    </button>
                </div>
            </form>

            <section>
                <h3 className="text-lg font-semibold mb-4">目前主題</h3>
                {loading ? (
                    <div className="text-sm text-[#615d59]">載入中...</div>
                ) : topics.length === 0 ? (
                    <div className="rounded-lg border border-dashed notion-whisper-border p-8 text-center text-sm text-[#615d59]">先建立一個你真正想持續推進的主題。</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {topics.map((topic) => (
                            <article key={topic.id} className="bg-white border notion-whisper-border rounded-lg shadow-soft-card p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <h4 className="font-semibold text-lg">{topic.title}</h4>
                                    <span className="shrink-0 rounded-full bg-[#0075de]/10 px-2 py-1 text-xs text-[#0075de]">{topic.status}</span>
                                </div>
                                {topic.purpose && <p className="mt-3 text-sm text-[#615d59]">{topic.purpose}</p>}
                                {topic.description && <p className="mt-2 text-sm text-[#615d59]/80">{topic.description}</p>}
                                {topic.keywords?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{topic.keywords.map((keyword) => <span key={keyword} className="rounded bg-black/5 px-2 py-1 text-xs text-[#615d59]">#{keyword}</span>)}</div>}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default TopicsPage;
