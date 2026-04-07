/**
 * categoryRules.js
 * 第一層：Rule-based 快速分類器
 * 對齊 fieldtheory-cli 的 bookmark-classify.ts 設計理念
 * 使用 Regex 關鍵字映射，無需 LLM，低延遲完成初步分類。
 */

/**
 * 主分類規則定義
 * 每條規則包含 slug 標籤與對應的正則表達式列表
 * 多個 pattern 之間為 OR 關係
 */
const CATEGORY_RULES = [
    {
        slug: 'ai',
        patterns: [
            /\b(gpt|chatgpt|llm|gemini|claude|openai|anthropic|mistral|llama|copilot)\b/i,
            /\b(ai model|language model|大語言模型|生成式ai|prompt|embedding)\b/i,
            /\b(機器學習|深度學習|neural network|transformer|fine.?tun)\b/i,
        ],
    },
    {
        slug: 'tool',
        patterns: [
            /github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/i,
            /\b(npm|pypi|docker|cli|sdk|api|library|framework|plugin|extension)\b/i,
            /\b(open.?source|開源|repo|repository)\b/i,
        ],
    },
    {
        slug: 'security',
        patterns: [
            /\b(cve-\d{4}-\d+|exploit|vulnerability|hack|breach|malware|phishing)\b/i,
            /\b(資安|漏洞|攻擊|入侵|加密|零日)\b/i,
        ],
    },
    {
        slug: 'market',
        patterns: [
            /\b(stock|stocks|etf|nasdaq|s&p|dow jones|btc|eth|crypto|bitcoin|ethereum)\b/i,
            /\b(股票|基金|加密貨幣|市值|漲跌|收盤|開盤|技術分析|KD|MACD|RSI)\b/i,
            /\b(投資|理財|金融市場|economy|inflation|fed|央行)\b/i,
        ],
    },
    {
        slug: 'research',
        patterns: [
            /\b(paper|arxiv|study|research|journal|experiment|dataset|benchmark)\b/i,
            /\b(論文|研究|數據|實驗|學術|報告|調查|統計分析)\b/i,
        ],
    },
    {
        slug: 'launch',
        patterns: [
            /\b(launch|release|announce|v\d+\.\d+|new feature|now available)\b/i,
            /\b(上線|發布|發佈|新版本|正式版|更新|推出)\b/i,
        ],
    },
    {
        slug: 'opinion',
        patterns: [
            /\b(我認為|我覺得|我的看法|心得|分享|感想|推薦|觀點)\b/i,
            /\b(imo|in my opinion|i think|thread:|🧵)\b/i,
        ],
    },
];

/**
 * classifyByRules
 * 對給定內文進行規則匹配，返回最先匹配的分類 slug
 * @param {string} content - 貼文內文
 * @returns {string} - 分類 slug，如無匹配則返回 'other'
 */
export function classifyByRules(content) {
    if (!content || typeof content !== 'string') return 'other';

    for (const rule of CATEGORY_RULES) {
        const matched = rule.patterns.some((pattern) => pattern.test(content));
        if (matched) {
            return rule.slug;
        }
    }

    return 'other';
}

/**
 * VALID_CATEGORIES
 * 合法的分類 Slug 集合，用於驗證 LLM 回傳值
 */
export const VALID_CATEGORIES = new Set([
    'ai', 'tool', 'security', 'market', 'research', 'launch', 'opinion', 'other',
]);

/**
 * normalizeCategorySlug
 * 驗證並正規化 LLM 回傳的分類 slug
 * @param {string} slug
 * @returns {string} - 合法 slug 或 'other'
 */
export function normalizeCategorySlug(slug) {
    if (!slug || typeof slug !== 'string') return 'other';
    const normalized = slug.toLowerCase().trim();
    return VALID_CATEGORIES.has(normalized) ? normalized : 'other';
}
