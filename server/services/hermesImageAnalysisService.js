const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGENT_PATTERN = /^[a-zA-Z0-9._:@/-]{1,128}$/;

function normalizeStringList(value, limit, maxLength) {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item) => typeof item === 'string' && item.trim())
        .slice(0, limit)
        .map((item) => item.trim().slice(0, maxLength));
}

export function normalizeImageAnalysisResult(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Image analysis must be a JSON object');
    }
    const summary = typeof value.summary === 'string' ? value.summary.trim().slice(0, 12000) : '';
    if (!summary) throw new Error('Image analysis summary is required');

    return {
        summary,
        description: typeof value.description === 'string' ? value.description.trim().slice(0, 40000) : '',
        ocr_text: typeof value.ocr_text === 'string' ? value.ocr_text.trim().slice(0, 40000) : '',
        tags: normalizeStringList(value.tags, 25, 80),
        topics: normalizeStringList(value.topics, 25, 120),
        primary_category: typeof value.primary_category === 'string'
            ? value.primary_category.trim().slice(0, 50)
            : '',
        sentiment: typeof value.sentiment === 'string' ? value.sentiment.trim().slice(0, 50) : ''
    };
}

export async function recordHermesImageAnalysis(input, supabaseClient) {
    if (!UUID_PATTERN.test(String(input?.outboxId || ''))) throw new Error('Outbox ID must be a UUID');
    if (!AGENT_PATTERN.test(String(input?.agentIdentity || ''))) throw new Error('Hermes agent identity is invalid');
    const result = normalizeImageAnalysisResult(input.result);

    const { data, error } = await supabaseClient
        .rpc('record_collection_image_analysis', {
            p_outbox_id: input.outboxId,
            p_agent_identity: input.agentIdentity,
            p_result: result
        })
        .single();
    if (error) throw new Error(`Image analysis write-back failed: ${error.message}`);
    if (!data?.id) throw new Error('Image analysis write-back returned no analysis row');
    return data;
}
