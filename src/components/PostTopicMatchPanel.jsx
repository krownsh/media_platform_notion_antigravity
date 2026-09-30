import React, { useState } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { authenticatedFetch } from '../api/authenticatedFetch';

async function responseData(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    return data;
}

const PostTopicMatchPanel = ({ sourceId }) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [matches, setMatches] = useState([]);

    const loadSuggestions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics/matches/dry-run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId })
            }));
            setMatches(data.matches || []);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const toggle = () => {
        const nextExpanded = !expanded;
        setExpanded(nextExpanded);
        if (nextExpanded && matches.length === 0 && !loading) loadSuggestions();
    };

    const decide = async (topicId, status) => {
        setLoading(true);
        setError(null);
        try {
            await responseData(await authenticatedFetch(`${API_BASE_URL}/api/topics/${topicId}/matches/${sourceId}/decision`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            }));
            setMatches((current) => current.map((match) => match.topic_id === topicId ? { ...match, status } : match));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    return <div className="relative">
        <button type="button" onClick={toggle} className="notion-btn-secondary flex items-center gap-2 py-1.5 px-3 text-xs sm:text-sm" aria-expanded={expanded}>
            <ChevronDown size={16} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
            加入主題
        </button>
        {expanded && <section className="absolute right-0 top-full z-30 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-xl border notion-whisper-border bg-[var(--surface-raised)] p-4 shadow-lg" aria-label="主題建議">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">把這篇貼文加入主題</h3><p className="mt-1 text-xs leading-5 text-[#615d59]">先看建議與理由；只有你按「接受」才會加入。</p></div><button type="button" onClick={() => setExpanded(false)} className="flow-icon-button" aria-label="關閉主題建議"><X size={15} /></button></div>
            {loading && <p className="mt-4 flex items-center gap-2 text-sm text-[#615d59]"><Loader2 size={15} className="animate-spin" />正在找適合的主題…</p>}
            {error && <p className="mt-4 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
            {!loading && !error && matches.length === 0 && <p className="mt-4 text-sm text-[#615d59]">目前沒有足夠相符的既有主題。你可以先在主題工作區建立一個，再回來加入。</p>}
            {!loading && matches.length > 0 && <div className="mt-4 space-y-2">{matches.map((match) => <div key={match.topic_id} className="rounded-lg border notion-whisper-border p-3"><p className="text-sm font-medium">{match.topic_title}{match.status === 'accepted' && <span className="ml-2 text-xs text-emerald-700">已加入</span>}</p><p className="mt-1 text-xs leading-5 text-[#615d59]">{match.rationale}</p><div className="mt-3 flex gap-2"><button type="button" disabled={loading || match.status === 'accepted'} onClick={() => decide(match.topic_id, 'accepted')} className="notion-btn-primary flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"><Check size={13} />接受</button><button type="button" disabled={loading} onClick={() => decide(match.topic_id, 'rejected')} className="rounded-md border notion-whisper-border px-3 py-1.5 text-xs disabled:opacity-50">略過</button></div></div>)}</div>}
        </section>}
    </div>;
};

export default PostTopicMatchPanel;
