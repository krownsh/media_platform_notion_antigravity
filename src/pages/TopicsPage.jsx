import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, FolderGit2, Plus, RefreshCw, Sparkles, X } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { authenticatedFetch } from '../api/authenticatedFetch';

const PROJECT_PRESETS = [
    'media_platform_notion_antigravity',
    'my_hater_react_native',
    'my_full-stack-path-inspector',
    'my-chrome-extension-ordering',
    'v0-stock-portfolio-dashboard',
    'My-sticker-book'
].map((repository) => ({
    title: repository,
    slug: repository.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    repository_target: `github:krownsh/${repository}`
}));

const FALLBACK_DOMAINS = [
    { key: 'agent_workflow', label: 'Agent 工作流' },
    { key: 'knowledge_rag', label: '知識／RAG' },
    { key: 'data_crawling', label: '資料擷取／爬蟲' },
    { key: 'architecture_analysis', label: '架構分析／程式碼智慧' },
    { key: 'browser_automation', label: '瀏覽器自動化' },
    { key: 'mobile_app', label: '行動 App 開發' },
    { key: 'ios_swiftui', label: 'iOS／SwiftUI' },
    { key: 'market_data', label: '市場資料' },
    { key: 'portfolio_analysis', label: '投資組合／技術分析' },
    { key: 'visual_content', label: '視覺／貼紙內容' },
    { key: 'product_growth', label: '產品成長' },
    { key: 'infrastructure_security', label: '基礎設施／安全' }
];

function slugify(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9\s_-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function splitList(value) {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

async function responseData(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
}

const TopicCard = ({ topic, domainLabel }) => (
    <article className="notion-card p-5">
        <div className="flex items-start justify-between gap-3">
            <h4 className="font-semibold text-lg">{topic.title}</h4>
            <span className="notion-badge shrink-0">{topic.status}</span>
        </div>
        <p className="mt-2 text-xs text-[#615d59]">{topic.project?.title || '尚未遷移的舊主題'} · {domainLabel(topic.domain_key)}</p>
        {topic.purpose && <p className="mt-3 text-sm text-[#615d59]">{topic.purpose}</p>}
        {topic.description && <p className="mt-2 text-sm text-[#615d59]/80">{topic.description}</p>}
        {topic.keywords?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{topic.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs text-[#615d59]">#{keyword}</span>)}</div>}
    </article>
);

const TopicsPage = () => {
    const [topics, setTopics] = useState([]);
    const [projects, setProjects] = useState([]);
    const [domains, setDomains] = useState(FALLBACK_DOMAINS);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [slugTouched, setSlugTouched] = useState(false);
    const [sourceId, setSourceId] = useState('');
    const [matchResults, setMatchResults] = useState([]);
    const [matchBusy, setMatchBusy] = useState(false);
    const [showArchivedTopics, setShowArchivedTopics] = useState(false);
    const [form, setForm] = useState({ projectId: '', domainKey: '', title: '', slug: '', description: '', purpose: '', keywords: '', desiredOutcomes: '' });

    const loadTopics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [topicData, projectData] = await Promise.all([
                responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics`)),
                responseData(await authenticatedFetch(`${API_BASE_URL}/api/projects`))
            ]);
            setTopics(topicData.topics || []);
            setDomains(topicData.domains || FALLBACK_DOMAINS);
            setProjects(projectData.projects || []);
            setForm((current) => ({ ...current, projectId: current.projectId || projectData.projects?.[0]?.id || '' }));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTopics(); }, [loadTopics]);

    const updateForm = (field, value) => {
        setForm((current) => {
            if (field === 'title' && !slugTouched) return { ...current, title: value, slug: slugify(value) };
            return { ...current, [field]: value };
        });
    };

    const addProject = async (preset) => {
        setSubmitting(true);
        setError(null);
        try {
            const data = await responseData(await authenticatedFetch(`${API_BASE_URL}/api/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preset)
            }));
            setProjects((current) => [data.project, ...current]);
            setForm((current) => ({ ...current, projectId: data.project.id }));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSubmitting(false);
        }
    };

    const createTopic = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const data = await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: form.projectId, domain_key: form.domainKey, title: form.title, slug: form.slug,
                    description: form.description, purpose: form.purpose, keywords: splitList(form.keywords),
                    desired_outcomes: splitList(form.desiredOutcomes)
                })
            }));
            const project = projects.find((item) => item.id === form.projectId) || null;
            setTopics((current) => [{ ...data.topic, project }, ...current]);
            setForm((current) => ({ ...current, domainKey: '', title: '', slug: '', description: '', purpose: '', keywords: '', desiredOutcomes: '' }));
            setSlugTouched(false);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setSubmitting(false);
        }
    };

    const findMatches = async (event) => {
        event.preventDefault();
        setMatchBusy(true);
        setError(null);
        try {
            const data = await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics/matches/dry-run`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId })
            }));
            setMatchResults(data.matches || []);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setMatchBusy(false);
        }
    };

    const decideMatch = async (topicId, status) => {
        setMatchBusy(true);
        setError(null);
        try {
            await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics/${topicId}/matches/${sourceId}/decision`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
            }));
            setMatchResults((current) => current.map((match) => match.topic_id === topicId ? { ...match, status } : match));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setMatchBusy(false);
        }
    };

    const availablePresets = PROJECT_PRESETS.filter((preset) => !projects.some((project) => project.repository_target?.toLowerCase() === preset.repository_target.toLowerCase()));
    const domainLabel = (key) => domains.find((domain) => domain.key === key)?.label || key || '未分類';
    const activeTopics = topics.filter((topic) => topic.origin === 'user' && topic.status === 'active');
    const historicalTopics = topics.filter((topic) => !activeTopics.includes(topic));
    const activeTopicGroups = projects.map((project) => ({
        project,
        topics: activeTopics.filter((topic) => topic.project_id === project.id || topic.project?.id === project.id)
    })).filter((group) => group.topics.length > 0);
    const ungroupedActiveTopics = activeTopics.filter((topic) => !activeTopicGroups.some((group) => group.topics.includes(topic)));

    return (
        <div className="flow-page max-w-6xl px-1 sm:px-2">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-5 sm:pt-8 md:pt-12 mb-7 sm:mb-9">
                <div>
                    <p className="flow-kicker mb-2">專案驅動</p>
                    <h2 className="text-3xl sm:text-[2.25rem] font-bold tracking-[-0.05em]">主題工作區</h2>
                    <p className="text-sm leading-6 text-[#615d59] mt-3">先選專案，再用領域定義研究脈絡；貼文必須由你接受匹配，Hermes 才能把它帶往研究或 POC。</p>
                </div>
                <button onClick={loadTopics} disabled={loading} className="flow-icon-button border notion-whisper-border self-start sm:self-auto disabled:opacity-50" title="重新整理" aria-label="重新整理主題"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
            </div>

            {error && <div className="mb-6 p-4 rounded-[0.75rem] bg-destructive/10 border border-destructive/25 flex items-center gap-3 text-destructive"><AlertCircle size={17} /><span className="text-sm">{error}</span></div>}

            <section className="mb-6 flow-surface p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.65rem] bg-[var(--accent-soft)] text-[var(--accent)]"><FolderGit2 size={18} /></div><div><h3 className="font-semibold text-[rgba(0,0,0,0.95)]">已確認的 GitHub 專案</h3><p className="mt-1 text-xs leading-5 text-[#615d59]">這裡只顯示已建立的專案；不會因為發現新 repo 自動建立 Project。</p></div></div>
                <div className="flex flex-wrap gap-2">
                    {projects.map((project) => <span key={project.id} className="rounded-md bg-[var(--surface-muted)] px-2.5 py-1.5 text-xs text-[#615d59]">{project.title}</span>)}
                    {availablePresets.map((preset) => <button key={preset.repository_target} type="button" disabled={submitting} onClick={() => addProject(preset)} className="rounded-md border notion-whisper-border px-2.5 py-1.5 text-xs hover:bg-[var(--surface-muted)] disabled:opacity-50">+ {preset.title}</button>)}
                </div>
            </section>

            <form onSubmit={createTopic} className="mb-9 flow-surface p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.65rem] bg-[var(--accent-soft)] text-[var(--accent)]"><Plus size={18} /></div><div><h3 className="font-semibold text-[rgba(0,0,0,0.95)]">建立專案主題</h3><p className="mt-1 text-xs leading-5 text-[#615d59]">一個啟用中的「專案 × 領域」只保留一個主題，避免再度碎裂。</p></div></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="text-sm text-[#615d59]">專案<select required value={form.projectId} onChange={(event) => updateForm('projectId', event.target.value)} className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)]"><option value="">先加入一個 GitHub 專案</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
                    <label className="text-sm text-[#615d59]">領域<select required value={form.domainKey} onChange={(event) => updateForm('domainKey', event.target.value)} className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)]"><option value="">選擇領域</option>{domains.map((domain) => <option key={domain.key} value={domain.key}>{domain.label}</option>)}</select></label>
                    <label className="text-sm text-[#615d59]">名稱<input required maxLength="160" value={form.title} onChange={(event) => updateForm('title', event.target.value)} placeholder="例如：研究與 POC 流程" className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)]" /></label>
                    <label className="text-sm text-[#615d59]">Slug<input required maxLength="80" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,79}" value={form.slug} onChange={(event) => { setSlugTouched(true); updateForm('slug', event.target.value); }} placeholder="research-poc-flow" className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)]" /></label>
                    <label className="text-sm text-[#615d59] sm:col-span-2">這個主題想解決什麼？<textarea value={form.purpose} onChange={(event) => updateForm('purpose', event.target.value)} rows="2" placeholder="描述你要研究、驗證或實作的具體問題。" className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)] resize-y" /></label>
                    <label className="text-sm text-[#615d59] sm:col-span-2">背景描述（選填）<textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows="2" placeholder="提供判斷貼文匹配時需要的背景。" className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)] resize-y" /></label>
                    <label className="text-sm text-[#615d59]">關鍵字（逗號分隔）<input value={form.keywords} onChange={(event) => updateForm('keywords', event.target.value)} placeholder="agent, automation, workflow" className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)]" /></label>
                    <label className="text-sm text-[#615d59]">預期成果（逗號分隔）<input value={form.desiredOutcomes} onChange={(event) => updateForm('desiredOutcomes', event.target.value)} placeholder="研究問題, POC" className="notion-input mt-1.5 w-full text-[rgba(0,0,0,0.95)]" /></label>
                </div>
                <div className="mt-5 flex justify-end"><button type="submit" disabled={submitting || projects.length === 0} className="notion-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:cursor-not-allowed"><Sparkles size={15} /> {submitting ? '建立中...' : '建立主題'}</button></div>
            </form>

            <section className="mb-9 flow-surface p-5 sm:p-6">
                <p className="flow-kicker mb-1.5">人工關卡</p><h3 className="text-xl font-bold tracking-[-0.035em]">接受貼文匹配</h3><p className="mt-2 text-sm text-[#615d59]">貼上貼文 ID 取得建議；只有按「接受」的匹配可驅動 Hermes 研究與 POC。</p>
                <form onSubmit={findMatches} className="mt-4 flex flex-col sm:flex-row gap-2"><input required value={sourceId} onChange={(event) => setSourceId(event.target.value.trim())} placeholder="貼文 ID" className="notion-input flex-1 text-[rgba(0,0,0,0.95)]" /><button type="submit" disabled={matchBusy} className="notion-btn-primary px-4 py-2 text-sm disabled:opacity-50">{matchBusy ? '比對中...' : '找匹配'}</button></form>
                {matchResults.length > 0 && <div className="mt-4 space-y-2">{matchResults.map((match) => <div key={match.topic_id} className="rounded-lg border notion-whisper-border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-sm font-medium">{match.topic_title} <span className="text-[#615d59]">{match.score} 分</span></p><p className="mt-1 text-xs text-[#615d59]">{match.rationale}</p></div><div className="flex gap-2"><button type="button" disabled={matchBusy} onClick={() => decideMatch(match.topic_id, 'accepted')} className="notion-btn-primary px-3 py-1.5 text-xs flex items-center gap-1"><Check size={13} />{match.status === 'accepted' ? '已接受' : '接受'}</button><button type="button" disabled={matchBusy} onClick={() => decideMatch(match.topic_id, 'rejected')} className="rounded-md border notion-whisper-border px-3 py-1.5 text-xs flex items-center gap-1"><X size={13} />略過</button></div></div>)}</div>}
            </section>

            <section>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="flow-kicker mb-1.5">持續推進</p><h3 className="text-xl font-bold tracking-[-0.035em]">進行中的主題</h3></div>{historicalTopics.length > 0 && <button type="button" onClick={() => setShowArchivedTopics((current) => !current)} className="self-start rounded-md border notion-whisper-border px-3 py-1.5 text-xs text-[#615d59] hover:bg-[var(--surface-muted)]">{showArchivedTopics ? `隱藏歷史主題（${historicalTopics.length}）` : `查看歷史主題（${historicalTopics.length}）`}</button>}</div>
                {loading ? <div className="flow-surface flow-shimmer h-44" /> : activeTopics.length === 0 ? <div className="flow-panel border-dashed p-10 text-center text-sm text-[#615d59]">尚未建立進行中的主題。</div> : <div className="space-y-7">{activeTopicGroups.map((group) => <section key={group.project.id}><h4 className="mb-3 text-sm font-semibold text-[#615d59]">{group.project.title}</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{group.topics.map((topic) => <TopicCard key={topic.id} topic={topic} domainLabel={domainLabel} />)}</div></section>)}{ungroupedActiveTopics.length > 0 && <section><h4 className="mb-3 text-sm font-semibold text-[#615d59]">尚未關聯專案</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{ungroupedActiveTopics.map((topic) => <TopicCard key={topic.id} topic={topic} domainLabel={domainLabel} />)}</div></section>}</div>}
                {showArchivedTopics && historicalTopics.length > 0 && <section className="mt-8 border-t notion-whisper-border pt-6"><p className="flow-kicker mb-1.5">僅供查閱</p><h3 className="text-lg font-semibold">歷史主題</h3><p className="mt-2 text-sm text-[#615d59]">封存主題不參與新的來源匹配、研究或 POC。</p><div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">{historicalTopics.map((topic) => <TopicCard key={topic.id} topic={topic} domainLabel={domainLabel} />)}</div></section>}
            </section>
        </div>
    );
};

export default TopicsPage;
