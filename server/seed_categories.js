
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables! Please check your .env file.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultConfigs = [
    { slug: 'ai', label: '🤖 人工智慧', description: '關於 LLM 模型、Fine-tuning、Prompt Engineering、Agentic AI、或是 AI 在各種領域應用的技術探討。' },
    { slug: 'tool', label: '🔧 工具開源', description: '開發者工具、CLI 工具、GitHub 熱門開源專案、或是提升工程效率的軟體服務與腳本。' },
    { slug: 'market', label: '📈 市場趨勢', description: '金融市場分析、半導體產業趨勢、科技巨頭財報、財經新聞、或宏觀經濟對技術領域的影響。' },
    { slug: 'security', label: '🔒 資訊安全', description: '漏洞回報 (CVE)、攻擊手法分析、零信任架構、加密技術、或是系統加固與防禦策略。' },
    { slug: 'research', label: '📄 深度研究', description: '學術論文導讀、長篇技術白皮書、架構演進分析、或是需要深度閱讀的核心底層技術解析。' },
    { slug: 'launch', label: '🚀 產品發布', description: '新產品上線、版本重大更新 (Breaking Changes)、創業公司融資訊息、或是產品路線圖公告。' },
    { slug: 'opinion', label: '💬 觀點心得', description: '業界前輩的心得分享、職業發展建議、技術選型爭議、或是對於科技趨勢的個人評論。' },
    { slug: 'productivity', label: '⏱️ 生產力', description: '筆記工作流 (Notion/Obsidian)、時間管理法、自動化工作流優化、或是提升個人產出的數位工具使用技巧。' },
    { slug: 'design', label: '🎨 設計美學', description: 'UI/UX 設計趨勢、前端組件美學、CSS 技巧、設計系統構建、或是設計與工程之間的協作模式。' },
    { slug: 'crypto', label: '⛓️ 加密貨幣', description: '區塊鏈技術、DeFi 協議、NFT 應用、Web3 基礎設施、或是加密貨幣市場的波動與政策。' },
    { slug: 'other', label: '📦 其他', description: '無法歸類於上述明確標籤的通用資訊或是雜項內容。' }
];

async function seed() {
    console.log('--- Seeding Category Strategy ---');
    for (const config of defaultConfigs) {
        const { error } = await supabase
            .from('category_configs')
            .upsert(config, { onConflict: 'slug' });

        if (error) {
            console.error(`[FAIL] ${config.slug}:`, error.message);
        } else {
            console.log(`[OK] ${config.slug}`);
        }
    }
    console.log('--- Seeding Completed ---');
    process.exit(0);
}

seed();
