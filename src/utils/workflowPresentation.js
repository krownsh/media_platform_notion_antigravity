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

export const WORKFLOW_FILTER_OPTIONS = [
    { value: 'all', label: '全部流程狀態' },
    { value: 'needs_attention', label: '需要你處理' },
    { value: 'in_progress', label: '系統處理中' },
    { value: 'not_started', label: '尚未開始' },
    { value: 'completed', label: '已完成' }
];

export function workflowFilterGroup(workflow) {
    if (!workflow || workflow.stage === 'base_analysis') return 'not_started';
    if (['failed', 'blocked', 'awaiting_user'].includes(workflow.status)) return 'needs_attention';
    if (workflow.stage === 'complete' && workflow.status === 'completed') return 'completed';
    return 'in_progress';
}

export function matchesWorkflowFilter(workflow, filter) {
    return filter === 'all' || workflowFilterGroup(workflow) === filter;
}

export function workflowNextStep(workflow) {
    if (!workflow) return { label: '等待系統開始整理', tone: 'slate' };
    if (workflow.status === 'failed') return { label: '打開貼文查看錯誤並重試', tone: 'red' };
    if (workflow.status === 'blocked') return { label: '打開貼文查看需要協助的項目', tone: 'red' };
    if (workflow.status === 'awaiting_user') return { label: '打開貼文並選擇後續方向', tone: 'amber' };
    if (workflow.stage === 'complete' && workflow.status === 'completed') return { label: '流程已完成，可查看整理結果', tone: 'emerald' };
    if (workflow.stage === 'vault_sync') return { label: '等待筆記同步完成', tone: 'indigo' };
    if (workflow.stage === 'base_analysis') return { label: '等待 Hermes 開始整理', tone: 'slate' };
    return { label: '系統正在整理，完成後會顯示下一步', tone: 'teal' };
}

export function workflowGuidance(workflow) {
    const stage = workflow?.stage || 'base_analysis';
    const status = workflow?.status || 'pending';
    const stageLabels = { base_analysis: '來源分析', triage: '內容分流', preprocessing: '自動整理', vault_sync: 'Obsidian 同步', strategy: '方向決策', research: '研究驗證', review: '人工審核', actions: '後續行動', complete: '流程完成' };
    const stageLabel = stageLabels[stage] || `未知階段（${stage}）`;
    if (!workflow) return { stageLabel, waitingFor: 'Hermes', reason: '來源已儲存，尚未開始整理。', actionLabel: '等待系統開始整理' };
    if (status === 'failed' || status === 'blocked') return { stageLabel, waitingFor: '你', reason: workflow.last_error || '此步驟未成功完成，需要確認後再試。', actionLabel: '查看錯誤並重試或調整方向' };
    if (status === 'awaiting_user') return { stageLabel, waitingFor: '你', reason: workflow.context?.review_request?.question || '需要你決定後續方向。', actionLabel: '打開貼文並選擇後續方向' };
    if (stage === 'vault_sync') return { stageLabel, waitingFor: '本機 Obsidian', reason: workflow.context?.vault_sync?.reason || '等待已排程的筆記同步。', actionLabel: '等待同步完成' };
    if (stage === 'complete' && status === 'completed') return { stageLabel, waitingFor: '無', reason: '所有已核准工作均已完成。', actionLabel: '查看整理結果' };
    return { stageLabel, waitingFor: 'Hermes', reason: `目前正在進行「${stageLabel}」。`, actionLabel: workflowNextStep(workflow).label };
}

const PARALLEL_TRACK_LABELS = {
    pending: { label: '待處理', tone: 'slate' },
    processing: { label: '整理中', tone: 'teal' },
    needs_review: { label: '需要確認', tone: 'amber' },
    completed: { label: '已完成', tone: 'emerald' },
    not_applicable: { label: '尚未適用', tone: 'slate' },
    failed: { label: '需要處理', tone: 'red' }
};

export function parallelTrackPresentation(tracks) {
    return [
        { key: 'knowledge', title: '知識收藏', ...(PARALLEL_TRACK_LABELS[tracks?.knowledge?.status] || PARALLEL_TRACK_LABELS.pending), reason: tracks?.knowledge?.reason || '等待知識整理' },
        { key: 'project_application', title: '專案應用', ...(PARALLEL_TRACK_LABELS[tracks?.project_application?.status] || PARALLEL_TRACK_LABELS.not_applicable), reason: tracks?.project_application?.reason || '尚未連結專案應用' }
    ];
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
