-- =============================================================================
-- Intelligence Aggregator Schema Upgrade
-- 參考 fieldtheory-cli 的分類聚合架構，為 post_analysis 與 posts 表新增欄位。
-- 所有操作均使用 IF NOT EXISTS，可安全重複執行，不會與現有資料衝突。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. post_analysis 表：新增 primary_category 主分類欄位
--    用於快速 GROUP BY 聚合查詢（對齊 fieldtheory-cli 的 primary_category）
-- -----------------------------------------------------------------------------
ALTER TABLE public.post_analysis
    ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50);

COMMENT ON COLUMN public.post_analysis.primary_category IS
    'LLM 或 Rule-based 分類的主標籤，合法值：tool | ai | market | security | opinion | research | launch | other';

-- -----------------------------------------------------------------------------
-- 2. posts 表：新增 source_domains 網域提取欄位
--    JSONB 陣列，儲存貼文內文中提取到的外部 URL hostname 列表。
--    範例：["github.com", "youtube.com", "notion.so"]
-- -----------------------------------------------------------------------------
ALTER TABLE public.posts
    ADD COLUMN IF NOT EXISTS source_domains JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.posts.source_domains IS
    'JSONB 陣列，儲存貼文內文中提取的 URL hostname 列表，例如 ["github.com", "youtube.com"]。用於 domain 熱度聚合分析。';

-- -----------------------------------------------------------------------------
-- 3. 建立索引：加速聚合查詢效能
-- -----------------------------------------------------------------------------

-- 3-1. primary_category 索引：加速 GROUP BY primary_category 查詢
CREATE INDEX IF NOT EXISTS idx_analysis_category
    ON public.post_analysis(primary_category);

-- 3-2. 複合索引：加速「特定用戶 + 依時間排序」的趨勢查詢
CREATE INDEX IF NOT EXISTS idx_posts_user_posted_at
    ON public.posts(user_id, posted_at DESC);

-- 3-3. GIN 索引：加速 source_domains JSONB 的包含查詢
CREATE INDEX IF NOT EXISTS idx_posts_source_domains
    ON public.posts USING gin(source_domains);

-- -----------------------------------------------------------------------------
-- 4. category_configs 表：自動分類標籤定義與規則 (Field Theory Core)
--    儲存 slug、輔助顯示的 label、以及用於 LLM Prompt 的 description
--    patterns 則儲存用於第一層 Regex 匹配的正則字串陣列
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    patterns JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.category_configs IS 
    '儲存自動分類的規則與定義（Field Theory），用於動態生成 AI Prompt 與前端分類徽章。';

-- =============================================================================
-- 完成
-- =============================================================================