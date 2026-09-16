import React, { useEffect, useId, useState } from 'react';
import { BookOpenText, ExternalLink, FileWarning, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../api/authenticatedFetch';
import { API_BASE_URL } from '../api/config';

const evidenceLabel = {
    author_claim_unverified: '作者主張，未獨立驗證',
    source_link_not_read: '原貼文已讀，外部連結未讀取',
    captured_source: '已擷取來源文字',
};

function Citation({ citation, number }) {
    const navigate = useNavigate();
    const tooltipId = useId();
    const [isOpen, setIsOpen] = useState(false);
    const statusLabel = evidenceLabel[citation.evidenceStatus] || '來源狀態未標示';

    return (
        <span
            className="relative inline-flex align-baseline"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onFocus={() => setIsOpen(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
            }}
        >
            <button
                type="button"
                className="ml-1 inline-flex min-h-7 items-center rounded px-1.5 text-xs font-semibold text-[var(--accent)] underline decoration-[var(--accent)]/35 underline-offset-2 hover:bg-[var(--accent-soft)] focus:bg-[var(--accent-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/35"
                aria-describedby={isOpen ? tooltipId : undefined}
                aria-label={`來源 ${number}：${citation.title}`}
                onClick={() => navigate(`/post/${citation.postId}`)}
            >
                〔{number}〕
            </button>
            {isOpen && (
                <span
                    id={tooltipId}
                    role="tooltip"
                    className="absolute left-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white p-3.5 text-left shadow-xl"
                >
                    <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">來源 {number}</span>
                    <span className="mt-1 block text-sm font-semibold leading-5 text-[rgba(0,0,0,0.95)]">{citation.title}</span>
                    <span className="mt-2 block text-sm leading-6 text-[#615d59]">{citation.excerpt}</span>
                    <span className="mt-2 block text-xs leading-5 text-[#8a6f42]">{statusLabel}</span>
                    <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline focus:outline-none focus:underline"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/post/${citation.postId}`);
                        }}
                    >
                        查看原貼文 <ExternalLink size={13} aria-hidden="true" />
                    </button>
                </span>
            )}
        </span>
    );
}

export default function CollectionKnowledgeMap({ collectionId }) {
    const [state, setState] = useState({ status: 'loading', data: null, error: null });

    useEffect(() => {
        let active = true;
        setState({ status: 'loading', data: null, error: null });

        const load = async () => {
            try {
                const response = await authenticatedFetch(`${API_BASE_URL}/api/knowledge-map/${encodeURIComponent(collectionId)}`);
                if (response.status === 404) {
                    if (active) setState({ status: 'missing', data: null, error: null });
                    return;
                }
                const body = await response.json().catch(() => null);
                if (!response.ok) throw new Error(body?.error || '無法讀取知識地圖');
                if (active) setState({ status: 'ready', data: body, error: null });
            } catch (error) {
                if (active) setState({ status: 'error', data: null, error: error.message });
            }
        };

        load();
        return () => { active = false; };
    }, [collectionId]);

    if (state.status === 'missing') return null;
    if (state.status === 'loading') {
        return (
            <section className="flow-panel mb-7 flex items-center gap-3 px-5 py-4 text-sm text-[#615d59]" aria-label="正在讀取知識地圖">
                <Loader2 size={17} className="animate-spin text-[var(--accent)]" aria-hidden="true" />
                正在讀取這個資料夾的知識地圖…
            </section>
        );
    }
    if (state.status === 'error') {
        return (
            <section className="flow-panel mb-7 flex items-start gap-3 px-5 py-4 text-sm leading-6 text-[#615d59]" aria-live="polite">
                <FileWarning size={18} className="mt-0.5 shrink-0 text-[#8a6f42]" aria-hidden="true" />
                <span>知識地圖暫時無法讀取：{state.error}</span>
            </section>
        );
    }

    const { collection, progress } = state.data;
    let citationNumber = 0;

    return (
        <section className="flow-panel mb-7 overflow-visible px-5 py-5 sm:px-6 sm:py-6" aria-labelledby="knowledge-map-heading">
            <div className="flex flex-col gap-3 border-b notion-whisper-border pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="flow-kicker mb-2">唯讀整理</p>
                    <h2 id="knowledge-map-heading" className="flex items-center gap-2 text-xl font-bold tracking-[-0.03em] text-[rgba(0,0,0,0.95)]">
                        <BookOpenText size={20} className="text-[var(--accent)]" aria-hidden="true" />
                        {collection.name}｜知識地圖
                    </h2>
                </div>
                <span className="w-fit rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold tabular-nums text-[var(--accent)]">
                    已讀 {progress.processedPosts} / {progress.totalPosts} 篇 · 整理中
                </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#615d59]">每一條整理後的〔來源〕可 hover、鍵盤聚焦或點擊快速查看是哪篇貼文；在浮層中可直接開啟原貼文。</p>

            <ol className="mt-5 space-y-5">
                {collection.statements.map((statement, statementIndex) => (
                    <li key={`${statementIndex}-${statement.text}`} className="border-l-2 border-[var(--accent)]/30 pl-4">
                        <p className="text-base font-semibold leading-7 text-[rgba(0,0,0,0.95)]">
                            {statement.text}
                            {statement.citations.map((citation) => {
                                citationNumber += 1;
                                return <Citation key={citation.postId} citation={citation} number={citationNumber} />;
                            })}
                        </p>
                        {statement.detail && <p className="mt-1.5 text-sm leading-6 text-[#615d59]">{statement.detail}</p>}
                    </li>
                ))}
            </ol>
        </section>
    );
}
