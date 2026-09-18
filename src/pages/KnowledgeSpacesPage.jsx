import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpenText, FileWarning, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authenticatedFetch } from '../api/authenticatedFetch';
import { API_BASE_URL } from '../api/config';

function SpaceCard({ space }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="flow-panel w-full p-5 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      onClick={() => navigate(`/knowledge-spaces/${space.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flow-kicker mb-2">唯讀知識地圖</p>
          <h2 className="text-lg font-bold tracking-[-0.02em] text-[rgba(0,0,0,0.95)]">{space.name}</h2>
          {space.purpose && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#615d59]">{space.purpose}</p>}
        </div>
        <ArrowRight size={18} className="mt-1 shrink-0 text-[var(--accent)]" aria-hidden="true" />
      </div>
    </button>
  );
}

export default function KnowledgeSpacesPage() {
  const [state, setState] = useState({ status: 'loading', spaces: [], error: null });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/knowledge-spaces`);
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || '無法讀取知識地圖');
        if (active) setState({ status: 'ready', spaces: Array.isArray(body?.spaces) ? body.spaces : [], error: null });
      } catch (error) {
        if (active) setState({ status: 'error', spaces: [], error: error.message });
      }
    };
    load();
    return () => { active = false; };
  }, []);

  return (
    <div className="flow-page mx-auto max-w-5xl px-1 pt-5 sm:px-2 sm:pt-8 md:pt-12">
      <header className="mb-7 border-b notion-whisper-border pb-5">
        <p className="flow-kicker mb-2">跨資料夾 · 唯讀入口</p>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-[-0.04em] text-[rgba(0,0,0,0.95)]"><BookOpenText size={27} className="text-[var(--accent)]" aria-hidden="true" />知識地圖</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#615d59]">從已整理的跨資料夾知識空間進入；每個結論都保留回到原始收藏貼文的來源連結。</p>
      </header>

      {state.status === 'loading' && <section className="flow-panel flex items-center gap-3 px-5 py-4 text-sm text-[#615d59]"><Loader2 size={17} className="animate-spin text-[var(--accent)]" aria-hidden="true" />正在讀取知識地圖…</section>}
      {state.status === 'error' && <section className="flow-panel flex items-start gap-3 px-5 py-4 text-sm leading-6 text-[#615d59]" aria-live="polite"><FileWarning size={18} className="mt-0.5 shrink-0 text-[#8a6f42]" aria-hidden="true" />知識地圖暫時無法讀取：{state.error}</section>}
      {state.status === 'ready' && state.spaces.length === 0 && <section className="flow-panel px-5 py-5 text-sm leading-6 text-[#615d59]">目前還沒有可閱讀的知識地圖。建立與整理仍從你的收藏資料夾開始；這裡只顯示已完成來源關聯的地圖。</section>}
      {state.status === 'ready' && state.spaces.length > 0 && <section className="space-y-3" aria-label="可閱讀的知識地圖">{state.spaces.map((space) => <SpaceCard key={space.id} space={space} />)}</section>}
    </div>
  );
}
