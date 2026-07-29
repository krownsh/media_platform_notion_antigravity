import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Loader2, Play, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { authenticatedFetch } from '../api/authenticatedFetch';

const PocWorkbenchPanel = ({ postId }) => {
  const [state, setState] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const response = await authenticatedFetch(`${API_BASE_URL}/api/poc-workbench/${postId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load POC workbench');
    setState(data);
    setStatus('ready');
  }, [postId]);

  useEffect(() => { void load().catch(error => { setMessage(error.message); setStatus('error'); }); }, [load]);

  const run = async (type) => {
    if (type === 'execute' && !window.confirm('這會呼叫模型、Tavily 與 Docker。確定執行 POC？')) return;
    setStatus('running');
    setMessage(type === 'execute' ? '正在執行受限 POC…' : '正在產生 POC 提案…');
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/poc-workbench/${postId}/${type === 'execute' ? 'execute' : 'proposal'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: type === 'execute' ? JSON.stringify({ confirmation: 'EXECUTE_POC' }) : undefined
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'POC request failed');
      setState(data);
      setMessage(type === 'execute' ? 'POC 已完成，結果已寫回本篇貼文。' : 'POC 提案已更新；尚未執行。');
      setStatus('ready');
    } catch (error) {
      setMessage(error.message);
      setStatus('error');
    }
  };

  if (status === 'loading') return <div className="mt-4 text-xs text-neutral-400">正在載入 POC 工作台…</div>;
  if (status === 'error' && !state) {
    return (
      <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        POC 工作台載入失敗：{message}
      </section>
    );
  }
  if (!state?.eligible_for_proposal && !state?.successful_run) return null;

  return (
    <section className="mt-4 rounded-xl border border-[#0075de]/20 bg-[#0075de]/5 p-4">
      <div className="flex items-start gap-2">
        <FlaskConical size={17} className="mt-0.5 text-[#0075de]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-neutral-800">POC 工作台</p>
          {state?.scope && <p className="mt-1 text-xs leading-relaxed text-[#615d59]">{state.scope.objective || '此資料夾允許 POC 提案'} · {state.scope.project_targets.join(', ')}</p>}
          {state?.successful_run ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">已有驗證結果：{state.successful_run.run_id}</p>
          ) : (
            <div className="mt-2 text-xs text-[#615d59]">
              <p>{state?.route?.outcome?.reason || '尚未建立 POC 提案'}</p>
              {state?.route?.outcome?.application_case?.title && (
                <p className="mt-1 font-medium text-neutral-800">提案：{state.route.outcome.application_case.title}</p>
              )}
            </div>
          )}
        </div>
      </div>
      {message && <p className="mt-3 text-xs text-[#615d59]">{message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={status === 'running'} onClick={() => run('proposal')} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-[#0075de]/30 bg-white px-3 text-xs font-medium text-[#0075de] disabled:opacity-50">
          {status === 'running' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} 產生提案
        </button>
        <button type="button" disabled={status === 'running' || Boolean(state?.successful_run)} onClick={() => run('execute')} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-[#0075de] px-3 text-xs font-medium text-white disabled:opacity-50">
          <Play size={14} /> 執行 POC
        </button>
      </div>
    </section>
  );
};

export default PocWorkbenchPanel;
