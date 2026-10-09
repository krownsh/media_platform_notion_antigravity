import React from 'react';
import { CheckCircle2, CircleAlert, FileClock, FolderSync, Loader2 } from 'lucide-react';

function StatusIcon({ phase }) {
    if (phase === 'synchronized') return <CheckCircle2 size={18} className="text-emerald-600" />;
    if (phase === 'failed' || phase === 'conflict') return <CircleAlert size={18} className="text-amber-700" />;
    return <FileClock size={18} className="text-[var(--accent)]" />;
}

export default function LocalRecordStatusCard({ record, loading, error }) {
    return <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4" aria-label="本機完整紀錄">
        <div className="flex items-center gap-2"><FolderSync size={18} className="text-[var(--accent)]" /><h3 className="font-semibold">本機完整紀錄</h3></div>
        {loading ? <p className="mt-3 flex items-center gap-2 text-sm text-[#615d59]"><Loader2 size={15} className="animate-spin" />正在確認本機狀態…</p> : error ? <p className="mt-3 text-sm leading-6 text-amber-800">暫時無法確認本機狀態：{error}</p> : record ? <><div className="mt-3 flex items-center gap-2"><StatusIcon phase={record.phase} /><p className="text-sm font-semibold text-[var(--foreground)]">{record.label}</p></div><p className="mt-2 text-sm leading-6 text-[#615d59]">{record.reason}</p>{record.relative_path && <p className="mt-3 break-all rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-xs leading-5 text-[#615d59]">{record.relative_path}</p>}<p className="mt-3 border-t border-[var(--border)] pt-3 text-sm font-medium text-[var(--foreground)]">系統狀態：{record.next_action?.label || '等待下一個明確動作'}</p></> : <p className="mt-3 text-sm leading-6 text-[#615d59]">尚未取得本機紀錄狀態。</p>}
    </section>;
}
