import React, { useEffect, useState } from 'react';
import { BookOpenText, FileWarning, Loader2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../api/authenticatedFetch';
import { API_BASE_URL } from '../api/config';

const typeLabel = {
  technology: '技術',
  workflow: '工作流',
  option: '方案',
  comparison: '比較',
  decision: '選型判斷',
  question: '待驗證問題'
};

const evidenceLabel = {
  source_captured: '已擷取來源文字',
  author_claim_unverified: '作者主張，未獨立驗證',
  verified: '已驗證'
};

function renderContent(value) {
  if (Array.isArray(value)) return value.join(' → ');
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Evidence({ evidence, number }) {
  const navigate = useNavigate();
  return (
    <li className="rounded-lg border border-black/10 bg-white/70 p-3 text-sm leading-6 text-[#615d59]">
      <button
        type="button"
        className="font-semibold text-[var(--accent)] hover:underline focus:outline-none focus:underline"
        onClick={() => navigate(`/post/${evidence.postId}`)}
      >
        〔來源 {number}〕{evidence.sourceTitle} <ExternalLink className="inline" size={13} aria-hidden="true" />
      </button>
      <p className="mt-1">{evidence.excerpt}</p>
      <p className="mt-1 text-xs text-[#8a6f42]">{evidenceLabel[evidence.evidenceStatus] || '來源狀態未標示'} · {evidence.role}</p>
      {evidence.note && <p className="mt-1 text-xs text-[#615d59]">{evidence.note}</p>}
    </li>
  );
}

export default function KnowledgeSpaceMap({ spaceId }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', data: null, error: null });

    const load = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/knowledge-spaces/${encodeURIComponent(spaceId)}`);
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
  }, [spaceId]);

  if (state.status === 'missing') return null;
  if (state.status === 'loading') {
    return <section className="flow-panel flex items-center gap-3 px-5 py-4 text-sm text-[#615d59]" aria-label="正在讀取跨資料夾知識地圖"><Loader2 size={17} className="animate-spin text-[var(--accent)]" aria-hidden="true" />正在讀取跨資料夾知識地圖…</section>;
  }
  if (state.status === 'error') {
    return <section className="flow-panel flex items-start gap-3 px-5 py-4 text-sm leading-6 text-[#615d59]" aria-live="polite"><FileWarning size={18} className="mt-0.5 shrink-0 text-[#8a6f42]" aria-hidden="true" />知識地圖暫時無法讀取：{state.error}</section>;
  }

  const { space, collections = [], nodes } = state.data;
  let evidenceNumber = 0;
  return (
    <section className="flow-panel overflow-visible px-5 py-5 sm:px-6 sm:py-6" aria-labelledby="knowledge-space-heading">
      <div className="border-b notion-whisper-border pb-4">
        <p className="flow-kicker mb-2">跨資料夾 · 唯讀知識地圖</p>
        <h1 id="knowledge-space-heading" className="flex items-center gap-2 text-2xl font-bold tracking-[-0.03em] text-[rgba(0,0,0,0.95)]"><BookOpenText size={22} className="text-[var(--accent)]" aria-hidden="true" />{space.name}</h1>
        {space.purpose && <p className="mt-3 max-w-3xl text-sm leading-6 text-[#615d59]">{space.purpose}</p>}
        {collections.length > 0 && (
          <div className="mt-3 text-sm text-[#615d59]" aria-label="此知識地圖涵蓋的收藏資料夾">
            <span className="mr-2 font-semibold text-[rgba(0,0,0,0.95)]">涵蓋資料夾：</span>
            {collections.map((collection) => (
              <span key={collection.id} className="mr-2 inline-block rounded-full bg-black/[0.045] px-2 py-0.5 text-xs">
                {collection.name}{collection.role === 'primary' ? '（主要）' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 text-sm leading-6 text-[#615d59]">每個節點說明技術、工作流或選型判斷；每條內容都附回原始收藏貼文，不把跨來源證據壓成不可追查的總結。</p>
      <ol className="mt-6 space-y-5">
        {nodes.map((node) => (
          <li key={node.id} className="border-l-2 border-[var(--accent)]/30 pl-4">
            <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">{typeLabel[node.type] || node.type}</span>
            <h2 className="mt-3 text-lg font-bold text-[rgba(0,0,0,0.95)]">{node.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#615d59]"><strong className="text-[rgba(0,0,0,0.95)]">要解決的問題：</strong>{node.problem}</p>
            {Object.entries(node.content).length > 0 && (
              <dl className="mt-3 grid gap-2 rounded-lg bg-black/[0.025] p-3 text-sm leading-6 text-[#615d59]">
                {Object.entries(node.content).map(([key, value]) => <div key={key}><dt className="inline font-semibold text-[rgba(0,0,0,0.95)]">{key}：</dt><dd className="inline">{renderContent(value)}</dd></div>)}
              </dl>
            )}
            <ul className="mt-3 space-y-2">
              {node.evidence.map((evidence) => {
                evidenceNumber += 1;
                return <Evidence key={`${node.id}-${evidence.postId}-${evidenceNumber}`} evidence={evidence} number={evidenceNumber} />;
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
