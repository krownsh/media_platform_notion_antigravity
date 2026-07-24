-- =============================================================================
-- Intelligence Aggregator Schema Upgrade
-- 參考 fieldtheory-cli 的分類聚合架構，為 collection_post_analysis 與 collection_posts 表新增欄位。
-- 所有操作均使用 IF NOT EXISTS，可安全重複執行，不會與現有資料衝突。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. collection_post_analysis 表：新增 primary_category 主分類欄位
-- -----------------------------------------------------------------------------
-- (Note: Already handled in database/schema/schema.sql but kept for aggregator consistency.)
ALTER TABLE public.collection_post_analysis
    ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50);

COMMENT ON COLUMN public.collection_post_analysis.primary_category IS
    'LLM 或 Rule-based 分類的主標籤，合法值：tool | ai | market | security | opinion | research | launch | other';

-- -----------------------------------------------------------------------------
-- 2. collection_posts 表：新增 source_domains 網域提取欄位
-- -----------------------------------------------------------------------------
ALTER TABLE public.collection_posts
    ADD COLUMN IF NOT EXISTS source_domains TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.collection_posts.source_domains IS
    'Normalized hostname array extracted from post content, for example {github.com,youtube.com}; used for domain-frequency aggregation.';

-- -----------------------------------------------------------------------------
-- 3. 建立索引：加速聚合查詢效能
-- -----------------------------------------------------------------------------

-- 3-1. primary_category 索引
CREATE INDEX IF NOT EXISTS idx_collection_analysis_category
    ON public.collection_post_analysis(primary_category);

-- 3-2. 複合索引
CREATE INDEX IF NOT EXISTS idx_collection_posts_user_posted_at
    ON public.collection_posts(user_id, posted_at DESC);

-- 3-3. GIN 索引
CREATE INDEX IF NOT EXISTS idx_collection_posts_source_domains
    ON public.collection_posts USING gin(source_domains);

-- -----------------------------------------------------------------------------
-- 4. collection_category_configs 表：自動分類標籤定義與規則
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collection_category_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    patterns JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.collection_category_configs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

COMMENT ON TABLE public.collection_category_configs IS 
    '儲存自動分類的規則與定義（Field Theory），用於動態生成 AI Prompt 與前端分類徽章。';
COMMENT ON COLUMN public.collection_category_configs.patterns IS
    'JSONB array of category-matching rules. Each entry is a string or a rule object consumed by the category processor.';

-- -----------------------------------------------------------------------------
-- 5. 初始分類策略資料 (Seeding)
-- -----------------------------------------------------------------------------
INSERT INTO public.collection_category_configs (slug, label, description)
VALUES 
    ('ai', '人工智慧', '關於 LLM 模型、Fine-tuning、Prompt Engineering、Agentic AI、或是 AI 在各種領域應用的技術探討。'),
    ('tool', '工具開源', '開發者工具、CLI 工具、GitHub 熱門開源專案、或是提升工程效率的軟體服務與腳本。'),
    ('market', '市場趨勢', '金融市場分析、半導體產業趨勢、科技巨頭財報、財經新聞、或宏觀經濟對技術領域的影響。'),
    ('security', '資訊安全', '漏洞回報 (CVE)、攻擊手法分析、零信任架構、加密技術、或是系統加固與防禦策略。'),
    ('research', '深度研究', '學術論文導讀、長篇技術白皮書、架構演進分析、或是需要深度閱讀的核心底層技術解析。'),
    ('launch', '產品發布', '新產品上線、版本重大更新 (Breaking Changes)、創業公司融資訊息、或是產品路線圖公告。'),
    ('opinion', '觀點心得', '業界前輩的心得分享、職業發展建議、技術選型爭議、或是對於科技趨勢的個人評論。'),
    ('productivity', '生產力', '筆記工作流 (Notion/Obsidian)、時間管理法、自動化工作流優化、或是提升個人產出的數位工具使用技巧。'),
    ('design', '設計美學', 'UI/UX 設計趨勢、前端組件美學、CSS 技巧、設計系統構建、或是設計與工程之間的協作模式。'),
    ('crypto', '加密貨幣', '區塊鏈技術、DeFi 協議、NFT 應用、Web3 基礎設施、或是加密貨幣市場的波動與政策。'),
    ('other', '其他', '無法歸類於上述明確標籤的通用資訊或是雜項內容。')
ON CONFLICT (slug) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description;
