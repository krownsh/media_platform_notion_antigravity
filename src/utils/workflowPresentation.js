const ACTIONS = {
    research: { label: '研究', tone: 'sky' },
    poc_proposal: { label: 'POC 提案', tone: 'blue' },
    poc_execute: { label: 'POC 執行', tone: 'blue' },
    replication_plan: { label: '復刻方案', tone: 'violet' },
    fast_rewrite: { label: '快速改寫', tone: 'amber' },
    content_synthesis: { label: '內容整合', tone: 'emerald' }
};

const ACTION_STATUS = {
    approved: '已確認',
    completed: '已完成',
    failed: '需重試',
    pending: '待處理'
};

export function workflowBadge(workflow) {
    if (!workflow) return { label: '尚未納入流程', tone: 'slate' };
    if (workflow.status === 'failed') return { label: '需要重試', tone: 'red' };
    if (workflow.status === 'blocked') return { label: '需要協助', tone: 'red' };
    if (workflow.status === 'awaiting_user') return { label: '等你確認', tone: 'amber' };
    if (workflow.stage === 'complete' && workflow.status === 'completed') return { label: '已完成', tone: 'emerald' };
    if (workflow.stage === 'vault_sync') return { label: '同步 Obsidian', tone: 'indigo' };
    if (['research', 'actions'].includes(workflow.stage)) return { label: '後續行動中', tone: 'blue' };
    if (workflow.stage === 'base_analysis') return { label: '尚未處理', tone: 'slate' };
    return { label: 'AI 整理中', tone: 'teal' };
}

export function actionBadges(workflow) {
    const actions = Array.isArray(workflow?.action_plan?.actions) ? workflow.action_plan.actions : [];
    return actions
        .map(action => {
            const presentation = ACTIONS[action?.type];
            if (!presentation) return null;
            const status = ACTION_STATUS[action.status] || '待確認';
            return { type: action.type, tone: presentation.tone, label: `${presentation.label}｜${status}`, title: action.project_name || action.notes || presentation.label };
        })
        .filter(Boolean);
}

export const badgeClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    teal: 'border-teal-200 bg-teal-50 text-teal-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700'
};
