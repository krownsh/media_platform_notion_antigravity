const MAX_TEXT = 8_000;
export const AUTONOMY_POLICY_VERSION = 'preprocess-v1';
export const AUTONOMY_CONFIDENCE_THRESHOLD = 0.85;
export const AUTONOMY_OUTCOMES = new Set(['complete', 'research_pending', 'review_pending']);
export const AUTONOMY_RISK_LEVELS = new Set(['low', 'medium', 'high']);

function text(value, maxLength = MAX_TEXT) {
    return String(value ?? '').replace(/\0/g, '').slice(0, maxLength).trim();
}

function number(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(1, Math.max(0, parsed));
}

function textList(value, maxItems = 60, maxLength = 180) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const result = [];
    for (const item of value) {
        const normalized = text(item, maxLength).replace(/\s+/g, ' ');
        const key = normalized.toLocaleLowerCase('zh-TW');
        if (!normalized || seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
        if (result.length >= maxItems) break;
    }
    return result;
}

function normalizeSearchInput(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        keywords: textList(input.keywords, 60),
        entities: textList(input.entities, 40),
        aliases: textList(input.aliases, 40),
        memory_cues: textList(input.memory_cues || input.memoryCues, 20, 240)
    };
}

function normalizeContentOutput(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const mode = text(input.mode, 40).toLowerCase();
    const allowedModes = new Set(['fast_rewrite', 'content_synthesis']);
    const skill = input.rewrite_skill && typeof input.rewrite_skill === 'object' && !Array.isArray(input.rewrite_skill)
        ? input.rewrite_skill
        : input.skill && typeof input.skill === 'object' && !Array.isArray(input.skill)
            ? input.skill
            : {};
    return {
        mode: allowedModes.has(mode) ? mode : 'none',
        format: text(input.format, 40) || null,
        title: text(input.title, 240) || null,
        body: text(input.body, 30_000) || null,
        confidence: number(input.confidence),
        content_basis: mode === 'content_synthesis' ? 'researched' : 'source_only',
        published: false,
        rewrite_skill: {
            name: text(skill.name || skill.skill_name, 120) || null,
            version: text(skill.version, 80) || null,
            preset: text(skill.preset || skill.profile, 120) || null,
            target_platform: text(skill.target_platform || input.target_platform, 80) || null,
            brief: text(skill.brief || skill.editorial_brief, 4_000),
            constraints: Array.isArray(skill.constraints)
                ? skill.constraints.map(item => text(item, 500)).filter(Boolean).slice(0, 20)
                : []
        }
    };
}

export function normalizeConfidence(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.fromEntries(Object.entries(value)
            .slice(0, 20)
            .map(([key, score]) => [text(key, 80), number(score)])
            .filter(([key]) => Boolean(key)));
    }
    return { overall: number(value) };
}

export function minimumConfidence(confidence) {
    const scores = Object.entries(normalizeConfidence(confidence))
        .filter(([key]) => key !== 'folder')
        .map(([, score]) => score)
        .filter(score => Number.isFinite(score));
    return scores.length ? Math.min(...scores) : 0;
}

export function normalizeRiskLevel(value) {
    const risk = text(value, 20).toLowerCase();
    return AUTONOMY_RISK_LEVELS.has(risk) ? risk : 'high';
}

export function normalizeReviewRequest(value, fallbackReason = 'low_confidence') {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        reason: text(input.reason || fallbackReason, 120),
        question: text(input.question || '需要使用者確認下一步處理方式。', 2_000),
        options: Array.isArray(input.options)
            ? input.options.map(item => text(item, 120)).filter(Boolean).slice(0, 8)
            : ['approve', 'skip', 'research_only'],
        evidence: Array.isArray(input.evidence)
            ? input.evidence.map(item => text(item, 1_000)).filter(Boolean).slice(0, 20)
            : [],
        blocked_actions: Array.isArray(input.blocked_actions)
            ? input.blocked_actions.map(item => text(item, 120)).filter(Boolean).slice(0, 20)
            : [],
        created_at: new Date().toISOString()
    };
}

export function normalizeAutonomyDecision(input = {}) {
    const automation = input.automation && typeof input.automation === 'object'
        ? input.automation
        : {};
    const confidence = normalizeConfidence(automation.confidence ?? input.confidence);
    const confidenceFloor = minimumConfidence(confidence);
    const riskLevel = normalizeRiskLevel(automation.risk_level ?? input.risk_level);
    const requestedOutcome = text(automation.outcome || input.outcome, 40).toLowerCase();
    const networkRequired = Boolean(
        input.poc?.network_required
        || input.poc?.requires_network
        || input.poc?.test_plan?.environment?.network_access
    );
    const secretsRequired = Boolean(
        input.poc?.secrets_required
        || input.poc?.requires_secrets
        || (Array.isArray(input.poc?.test_plan?.environment?.required_secrets)
            && input.poc.test_plan.environment.required_secrets.length > 0)
    );
    // A post may mention a future POC that would need network access without
    // asking Hermes to execute it now.  Only an explicit execution request is
    // a high-risk action; merely recording a candidate belongs in normal
    // preprocessing or the research queue.
    const pocExecutionRequested = Boolean(
        input.poc?.auto_execute
        || input.poc?.execute_requested
        || input.poc?.execution_requested
    );

    let outcome = AUTONOMY_OUTCOMES.has(requestedOutcome) ? requestedOutcome : 'review_pending';
    let reason = null;
    if ((pocExecutionRequested && (networkRequired || secretsRequired)) || riskLevel === 'high') {
        outcome = 'review_pending';
        reason = pocExecutionRequested && (networkRequired || secretsRequired)
            ? 'high_risk_poc'
            : 'high_risk_action';
    } else if (confidenceFloor < AUTONOMY_CONFIDENCE_THRESHOLD) {
        outcome = 'review_pending';
        reason = 'low_confidence';
    }

    return {
        outcome,
        confidence,
        confidence_floor: confidenceFloor,
        risk_level: riskLevel,
        network_required: networkRequired,
        secrets_required: secretsRequired,
        poc_execution_requested: pocExecutionRequested,
        reason,
        policy_version: AUTONOMY_POLICY_VERSION
    };
}

export function normalizePreprocessInput(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('Preprocess result must be a JSON object');
    }
    const analysis = input.analysis && typeof input.analysis === 'object' ? input.analysis : {};
    const topic = input.topic && typeof input.topic === 'object' ? input.topic : null;
    const relation = input.relation && typeof input.relation === 'object' ? input.relation : null;
    const folder = input.folder && typeof input.folder === 'object' ? input.folder : null;
    const research = input.research && typeof input.research === 'object' ? input.research : null;
    const poc = input.poc && typeof input.poc === 'object' ? input.poc : null;
    const autonomy = normalizeAutonomyDecision(input);

    const normalized = {
        schema_version: 1,
        autonomy,
        analysis: {
            primary_category: text(analysis.primary_category || 'other', 80),
            summary: text(analysis.summary, 12_000),
            tags: Array.isArray(analysis.tags) ? analysis.tags.map(item => text(item, 120)).filter(Boolean).slice(0, 30) : [],
            topics: Array.isArray(analysis.topics) ? analysis.topics.map(item => text(item, 120)).filter(Boolean).slice(0, 30) : [],
            claims: Array.isArray(analysis.claims) ? analysis.claims.map(item => text(item, 2_000)).filter(Boolean).slice(0, 30) : [],
            limitations: Array.isArray(analysis.limitations) ? analysis.limitations.map(item => text(item, 2_000)).filter(Boolean).slice(0, 30) : []
        },
        relation: relation ? {
            kind: text(relation.kind || 'different', 40),
            confidence: number(relation.confidence),
            rationale: text(relation.rationale, 4_000),
            matches: Array.isArray(relation.matches)
                ? relation.matches.slice(0, 20).map(match => {
                    if (match && typeof match === 'object' && !Array.isArray(match)) {
                        return {
                            source_id: text(match.source_id || match.id, 80) || null,
                            rationale: text(match.rationale, 1_000),
                            confidence: number(match.confidence)
                        };
                    }
                    return { source_id: text(match, 80) || null, rationale: '', confidence: 0 };
                }).filter(match => match.source_id)
                : []
        } : null,
        topic: topic ? {
            topic_id: text(topic.topic_id, 80) || null,
            slug: text(topic.slug, 120) || null,
            title: text(topic.title, 240) || null,
            description: text(topic.description, 2_000),
            purpose: text(topic.purpose, 2_000),
            keywords: Array.isArray(topic.keywords) ? topic.keywords.map(item => text(item, 120)).filter(Boolean).slice(0, 30) : [],
            confidence: number(topic.confidence ?? autonomy.confidence.topic ?? autonomy.confidence.overall),
            match_type: text(topic.match_type || 'related', 40)
        } : null,
        folder: folder ? {
            domain: text(folder.domain, 200) || '待整理',
            note_title: text(folder.note_title, 240),
            confidence: number(folder.confidence ?? autonomy.confidence.folder ?? autonomy.confidence.overall),
            rationale: text(folder.rationale, 2_000),
            existing_path: text(folder.existing_path, 500) || null
        } : { domain: '待整理', note_title: '', confidence: 0, rationale: '', existing_path: null },
        research: research ? {
            questions: Array.isArray(research.questions) ? research.questions.map(item => text(item, 2_000)).filter(Boolean).slice(0, 20) : [],
            candidates: Array.isArray(research.candidates) ? research.candidates.map(item => text(item, 2_000)).filter(Boolean).slice(0, 20) : [],
            priority: text(research.priority, 40) || 'normal'
        } : { questions: [], candidates: [], priority: 'normal' },
        poc: poc ? {
            candidate: text(poc.candidate, 2_000),
            objective: text(poc.objective, 2_000),
            network_required: Boolean(poc.network_required || poc.requires_network),
            secrets_required: Boolean(poc.secrets_required || poc.requires_secrets),
            auto_execute: Boolean(poc.auto_execute),
            execute_requested: Boolean(poc.execute_requested || poc.execution_requested),
            artifact: poc.artifact && typeof poc.artifact === 'object' ? poc.artifact : null,
            result: poc.result && typeof poc.result === 'object' ? poc.result : null
        } : null,
        vault: input.vault && typeof input.vault === 'object' ? input.vault : {},
        review_request: input.review_request && typeof input.review_request === 'object'
            ? normalizeReviewRequest(input.review_request, autonomy.reason || 'user_confirmation_required')
            : null,
        search: normalizeSearchInput(input.search || input.search_document),
        content_output: normalizeContentOutput(input.content_output || input.content)
    };

    if (normalized.folder.confidence < AUTONOMY_CONFIDENCE_THRESHOLD) {
        normalized.folder.domain = '待整理';
        if (autonomy.outcome === 'review_pending') {
            normalized.review_request ||= normalizeReviewRequest(null, 'folder_confidence_low');
        }
    }
    if (autonomy.outcome === 'review_pending') {
        normalized.review_request ||= normalizeReviewRequest(null, autonomy.reason || 'user_confirmation_required');
    }
    if (autonomy.outcome === 'research_pending' && normalized.research.questions.length === 0) {
        normalized.research.questions = ['確認來源 claims、限制、替代方案與可行應用。'];
    }
    return normalized;
}

export function buildAutomationContext(result, extra = {}) {
    return {
        ...extra,
        automation: {
            queue: result.autonomy.outcome === 'research_pending' ? 'research' : 'none',
            outcome: result.autonomy.outcome,
            confidence: result.autonomy.confidence,
            confidence_floor: result.autonomy.confidence_floor,
            risk_level: result.autonomy.risk_level,
            policy_version: result.autonomy.policy_version,
            completed_at: new Date().toISOString()
        },
        preprocess: {
            schema_version: result.schema_version,
            completed_at: new Date().toISOString(),
            analysis: result.analysis,
            relation: result.relation,
            topic: result.topic,
            folder: result.folder,
            research: result.research,
            poc: result.poc ? {
                candidate: result.poc.candidate,
                objective: result.poc.objective,
                network_required: result.poc.network_required,
                secrets_required: result.poc.secrets_required,
                auto_execute: result.poc.auto_execute,
                result: result.poc.result
            } : null
        },
        search: result.search,
        content_output: result.content_output,
        ...(result.review_request ? { review_request: result.review_request } : {})
    };
}
