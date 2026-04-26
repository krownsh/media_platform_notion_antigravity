-- =============================================================================
-- Intelligence Aggregator Schema Upgrade
-- 參考 fieldtheory-cli 的分類聚合架構，為 collection_post_analysis 與 collection_posts 表新增欄位。
-- 所有操作均使用 IF NOT EXISTS，可安全重複執行，不會與現有資料衝突。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. collection_post_analysis 表：新增 primary_category 主分類欄位
-- -----------------------------------------------------------------------------
-- (Note: Already handled in main schema.sql but keeping here for aggregator consistency)
ALTER TABLE public.collection_post_analysis
    ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50);

COMMENT ON COLUMN public.collection_post_analysis.primary_category IS
    'LLM 或 Rule-based 分類的主標籤，合法值：tool | ai | market | security | opinion | research | launch | other';

-- -----------------------------------------------------------------------------
-- 2. collection_posts 表：新增 source_domains 網域提取欄位
-- -----------------------------------------------------------------------------
ALTER TABLE public.collection_posts
    ADD COLUMN IF NOT EXISTS source_domains JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.collection_posts.source_domains IS
    'JSONB 陣列，儲存貼文內文中提取的 URL hostname 列表，例如 ["github.com", "youtube.com"]。用於 domain 熱度聚合分析。';

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.collection_category_configs IS 
    '儲存自動分類的規則與定義（Field Theory），用於動態生成 AI Prompt 與前端分類徽章。';