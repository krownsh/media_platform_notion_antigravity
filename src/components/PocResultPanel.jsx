import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { formatPocDuration, getLatestSuccessfulPocResult } from '../utils/pocResults';

const PocResultPanel = ({ insights }) => {
  const result = getLatestSuccessfulPocResult(insights);
  if (!result) return null;

  const execution = result.execution || {};
  const applicationCase = result.application_case || {};

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-soft-card" aria-label="POC 驗證結果">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
          <ShieldCheck size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">POC 驗證結果</p>
          <h3 className="mt-1 text-sm font-bold text-emerald-950">已完成安全沙盒驗證</h3>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-emerald-950">
        {result.summary || 'POC 已成功執行。'}
      </p>

      {applicationCase.title && (
        <div className="mt-4 rounded-lg bg-white/75 p-3 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900">驗證目標</p>
          <p className="mt-1 leading-relaxed">{applicationCase.title}</p>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white/75 p-3">
          <dt className="text-neutral-500">執行結果</dt>
          <dd className="mt-1 flex items-center gap-1 font-semibold text-emerald-700">
            <CheckCircle2 size={14} /> 成功
          </dd>
        </div>
        <div className="rounded-lg bg-white/75 p-3">
          <dt className="text-neutral-500">沙盒耗時</dt>
          <dd className="mt-1 font-semibold text-neutral-900">{formatPocDuration(execution.duration_ms)}</dd>
        </div>
      </dl>

      {execution.stdout && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs leading-relaxed text-emerald-200">
          {execution.stdout.trim()}
        </pre>
      )}

      {result.generation_method === 'deterministic_fallback' && (
        <p className="mt-4 text-xs leading-relaxed text-emerald-800">
          模型產生的程式嘗試連網，已被安全檢查阻擋；系統改用可稽核的 deterministic fallback。這代表 POC 通過，不代表工具已整合進正式爬蟲。
        </p>
      )}
    </section>
  );
};

export default PocResultPanel;
