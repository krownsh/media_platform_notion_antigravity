export const AI_PROVIDER_RETIRED_CODE = 'HERMES_AGENT_REQUIRED';
export const AI_PROVIDER_RETIRED_MESSAGE = 'Server AI is retired. Run the Hermes Codex agent for this task.';

export class AiProviderRetiredError extends Error {
    constructor() {
        super(AI_PROVIDER_RETIRED_MESSAGE);
        this.name = 'AiProviderRetiredError';
        this.code = AI_PROVIDER_RETIRED_CODE;
    }
}

export function normalizeGeneratedTitle(value) {
    const title = String(value ?? '')
        .normalize('NFKC')
        .replace(/[\r\n]+/g, ' ')
        .replace(/^[「『"']+|[」』"']+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return title.length >= 4 ? title.slice(0, 80) : null;
}

/**
 * The server deliberately has no LLM provider. MiniMax was retired and
 * Hermes/Codex runs outside this HTTP process, so it must not be represented
 * as a callable provider here.
 */
class AiService {
    get status() {
        return 'retired';
    }

    async analyzeThreadsPost() {
        throw new AiProviderRetiredError();
    }

    async analyzeGenericPost() {
        throw new AiProviderRetiredError();
    }

    async rewriteContent() {
        throw new AiProviderRetiredError();
    }

    async remixContent() {
        throw new AiProviderRetiredError();
    }

    async generateStructuredJSON() {
        throw new AiProviderRetiredError();
    }
}

export const aiService = new AiService();

export async function generateContentJSON() {
    return aiService.generateStructuredJSON();
}
