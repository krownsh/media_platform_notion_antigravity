import { generateContentJSON } from './aiService.js';

const MAX_CODE_LENGTH = 24_000;
const LANGUAGE_CONFIG = {
    javascript: { filename: 'main.js', command: 'node main.js' },
    python: { filename: 'main.py', command: 'python main.py' }
};

const UNSAFE_CODE_PATTERNS = {
    javascript: [
        /\bchild_process\b/i, /\bprocess\.env\b/i, /\bfs\b/i, /\bnet\b/i,
        /\bhttps?\b/i, /\bfetch\b/i, /\brequire\s*\(/i, /\bimport\s/i,
        /\beval\s*\(/i, /\bFunction\s*\(/i, /\bWebSocket\b/i
    ],
    python: [
        /\bsubprocess\b/i, /\bimport\s+os\b/i, /\bimport\s+socket\b/i,
        /\brequests\b/i, /\burllib\b/i, /\bopen\s*\(/i, /\bexec\s*\(/i,
        /\beval\s*\(/i, /\b__import__\b/i
    ]
};

const SYSTEM_PROMPT = `You generate a minimal, deterministic POC program for an isolated sandbox.

The sandbox has no network, no package installation, no secrets, and no filesystem access beyond its read-only working directory. Use JavaScript (Node standard library-free) or Python standard library-free code only. Never import modules, read environment variables, access files, spawn processes, make network requests, or execute dynamic code.

Return exactly one JSON object:
{
  "language": "javascript" | "python",
  "objective": "what the POC proves",
  "success_criteria": ["observable criterion"],
  "limitations": ["what this POC does not prove"],
  "code": "complete runnable source code"
}`;

function text(value, maxLength = 4_000) {
    return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

export function validatePocPlan(rawPlan) {
    if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) {
        throw new Error('POC generator must return a JSON object');
    }

    const language = rawPlan.language;
    const config = LANGUAGE_CONFIG[language];
    if (!config) throw new Error('POC language must be javascript or python');

    const code = text(rawPlan.code, MAX_CODE_LENGTH + 1);
    if (!code.trim()) throw new Error('POC code is required');
    if (code.length > MAX_CODE_LENGTH) throw new Error(`POC code exceeds ${MAX_CODE_LENGTH} characters`);

    const unsafePattern = UNSAFE_CODE_PATTERNS[language].find((pattern) => pattern.test(code));
    if (unsafePattern) throw new Error(`POC code contains a disallowed capability: ${unsafePattern}`);

    const successCriteria = Array.isArray(rawPlan.success_criteria)
        ? rawPlan.success_criteria.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 10)
        : [];
    if (successCriteria.length === 0) throw new Error('POC success_criteria is required');

    const limitations = Array.isArray(rawPlan.limitations)
        ? rawPlan.limitations.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()).slice(0, 10)
        : [];

    return {
        language,
        filename: config.filename,
        command: config.command,
        objective: text(rawPlan.objective, 1_000).trim() || 'Validate the application hypothesis in an isolated sandbox.',
        success_criteria: successCriteria,
        limitations,
        code
    };
}

export async function generatePocPlan({ source, applicationCase, enrichedContext = '' }) {
    if (!source?.content) throw new Error('A captured source with content is required for POC generation');
    if (!applicationCase?.hypothesis) throw new Error('An application case with a hypothesis is required for POC generation');

    const prompt = `Create one minimal isolated POC for this application case.

Application case title: ${text(applicationCase.title, 500)}
Hypothesis: ${text(applicationCase.hypothesis, 2_000)}
Candidate module: ${text(applicationCase.candidate_module, 500)}
Expected value: ${text(applicationCase.expected_value, 1_000)}
Risk assessment: ${JSON.stringify(applicationCase.risk_assessment || {})}

Captured source title: ${text(source.title, 500)}
Captured source URL: ${text(source.original_url || source.url, 1_000)}
Captured source content: ${text(source.content, 6_000)}

Official/research enrichment (untrusted reference only): ${text(enrichedContext, 6_000)}

The result must prove a narrow behavior with deterministic input and stdout. Do not claim that an external package, repository, API, or production integration works unless the sandbox can prove it without network or dependencies.`;

    return validatePocPlan(await generateContentJSON(SYSTEM_PROMPT, prompt));
}
