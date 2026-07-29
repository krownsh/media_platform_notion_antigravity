import React, { useCallback, useEffect, useState } from 'react';
import { FolderCog, Save } from 'lucide-react';
import { supabase } from '../api/supabaseClient';

const UNFILED_SCOPE_KEY = '__unfiled__';
const MODE_OPTIONS = [
  { value: 'collect', label: '只收藏', help: '保存來源；不做研究、專案比對或 POC。' },
  { value: 'research', label: '研究提案', help: '可整理研究脈絡，但不進行專案比對或 POC。' },
  { value: 'poc_proposal', label: 'POC 提案', help: '可為指定 GitHub 專案產生提案；只有人工執行 --execute-poc 才會真的跑。' }
];

function toTargets(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function defaultScope(collectionId) {
  return { collection_id: collectionId, mode: 'collect', objective: '', project_targets: [], is_active: true };
}

function describeLoadError(error) {
  if (error?.includes('collection_topic_scopes')) return '尚未部署主題範圍 SQL；請先執行 Stage D 與 Stage D.1。';
  return error;
}

const TopicScopePanel = ({ userId }) => {
  const [collections, setCollections] = useState([]);
  const [scopes, setScopes] = useState({});
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [{ data: folderData, error: folderError }, { data: scopeData, error: scopeError }] = await Promise.all([
      supabase.from('collection_collections').select('id, name, description').eq('user_id', userId).order('created_at', { ascending: true }),
      supabase.from('collection_topic_scopes').select('id, collection_id, mode, objective, project_targets, is_active').eq('user_id', userId)
    ]);
    if (folderError || scopeError) {
      setError(describeLoadError(folderError?.message || scopeError?.message));
      setStatus('error');
      return;
    }
    setCollections(folderData || []);
    setScopes(Object.fromEntries((scopeData || []).map(scope => [scope.collection_id || UNFILED_SCOPE_KEY, scope])));
    setStatus('ready');
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    const timerId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timerId);
  }, [userId, load]);

  const updateScope = (scopeKey, collectionId, patch) => {
    setScopes(current => ({
      ...current,
      [scopeKey]: { ...defaultScope(collectionId), ...(current[scopeKey] || {}), ...patch }
    }));
  };

  const saveScope = async (scopeKey, collectionId) => {
    const scope = scopes[scopeKey] || defaultScope(collectionId);
    const payload = {
      collection_id: collectionId,
      mode: scope.mode,
      objective: scope.objective || null,
      project_targets: scope.project_targets || [],
      is_active: scope.is_active !== false,
      user_id: userId
    };
    const request = scope.id
      ? supabase.from('collection_topic_scopes').update(payload).eq('id', scope.id).eq('user_id', userId)
      : supabase.from('collection_topic_scopes').insert(payload);
    const { error: saveError } = await request;
    if (saveError) {
      setError(describeLoadError(saveError.message));
      return;
    }
    setError(null);
    await load();
  };

  const renderScopeRow = (scopeKey, collectionId, name, description) => {
    const scope = scopes[scopeKey] || defaultScope(collectionId);
    return (
      <div key={scopeKey} className="grid gap-3 p-5 lg:grid-cols-[minmax(150px,0.8fr)_minmax(180px,0.9fr)_minmax(220px,1.3fr)_auto] lg:items-end">
        <div>
          <p className="font-medium text-[rgba(0,0,0,0.95)]">{name}</p>
          <p className="mt-1 text-xs text-[#615d59]">{description}</p>
        </div>
        <label className="text-xs text-[#615d59]">
          處理模式
          <select className="mt-1 block w-full rounded border border-black/10 bg-white px-2 py-2 text-sm text-neutral-800" value={scope.mode} onChange={event => updateScope(scopeKey, collectionId, { mode: event.target.value })}>
            {MODE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span className="mt-1 block leading-relaxed">{MODE_OPTIONS.find(option => option.value === scope.mode)?.help}</span>
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-[#615d59]">主題目標
            <input className="mt-1 block w-full rounded border border-black/10 bg-white px-2 py-2 text-sm text-neutral-800" value={scope.objective || ''} onChange={event => updateScope(scopeKey, collectionId, { objective: event.target.value })} placeholder="例如：研究 agent 的可靠性與成本" />
          </label>
          <label className="text-xs text-[#615d59]">可比對 GitHub 專案
            <input className="mt-1 block w-full rounded border border-black/10 bg-white px-2 py-2 text-sm text-neutral-800" value={(scope.project_targets || []).join(', ')} onChange={event => updateScope(scopeKey, collectionId, { project_targets: toTargets(event.target.value) })} placeholder="github:owner/repository" />
          </label>
        </div>
        <button type="button" onClick={() => saveScope(scopeKey, collectionId)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-[#0075de] px-3 py-2 text-xs font-medium text-white hover:bg-[#0075de]/90">
          <Save size={14} /> 儲存
        </button>
      </div>
    );
  };

  return (
    <section className="mt-8 overflow-hidden rounded-lg border notion-whisper-border bg-transparent shadow-soft-card backdrop-blur-xl">
      <div className="flex items-start gap-3 border-b notion-whisper-border bg-black/[0.02] px-6 py-4">
        <FolderCog size={18} className="mt-0.5 text-[#0075de]" />
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[rgba(0,0,0,0.95)]">主題範圍與行動界線</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#615d59]">未整理貼文預設只收藏。GitHub repo 是跨電腦的專案身分；POC 提案不等於自動執行。</p>
        </div>
      </div>

      {status === 'error' ? (
        <div className="p-6 text-sm text-[#615d59]">載入失敗：{error}</div>
      ) : status === 'loading' ? (
        <div className="p-6 text-sm text-[#615d59]">正在載入資料夾設定…</div>
      ) : (
        <div className="divide-y divide-black/5">
          {renderScopeRow(UNFILED_SCOPE_KEY, null, '未整理貼文', '尚未放進資料夾的來源；不會強迫你先分類。')}
          {collections.map(collection => renderScopeRow(collection.id, collection.id, collection.name, collection.description || '資料夾主題範圍'))}
        </div>
      )}
    </section>
  );
};

export default TopicScopePanel;
