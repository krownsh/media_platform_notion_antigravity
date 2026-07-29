const FOLDER_RULES = [
  {
    folders: ['工程師開發優化'],
    keywords: ['code review', 'code-review', 'devtools', 'developer tool', '開發', '程式', '程式碼', '測試', 'test', 'typescript', 'javascript', 'python', 'github', 'npm', 'api', 'xss', 'sql 注入']
  },
  {
    folders: ['agent工具', 'agent loop'],
    keywords: ['agent', 'mcp', 'multi-agent', 'workflow', 'orchestration', '自動化代理']
  },
  {
    folders: ['好skill', 'codex', 'UI skill'],
    keywords: ['skill', 'claude code', 'codex', 'cursor', 'prompt']
  },
  {
    folders: ['好用套件'],
    keywords: ['library', 'package', 'plugin', '套件', '開源', 'repository']
  },
  {
    folders: ['ai圖片+影片', 'ai漫劇'],
    keywords: ['image', 'video', '影片', '圖片', '動畫', 'kling', '電影感']
  },
  {
    folders: ['投資'],
    keywords: ['股票', '投資', 'market', '市場', 'portfolio', 'financial']
  }
];

function normalizedText(post) {
  const analysis = post?.analysis || {};
  return [
    post?.title,
    post?.content,
    post?.originalUrl,
    analysis?.primary_category,
    ...(Array.isArray(analysis?.tags) ? analysis.tags : [])
  ].filter(Boolean).join(' ').toLowerCase();
}

export function suggestFolders(post, collections) {
  if (!post || post.collectionId || !Array.isArray(collections)) return [];
  const text = normalizedText(post);
  if (!text) return [];

  const candidates = new Map();
  for (const rule of FOLDER_RULES) {
    const matchedKeywords = rule.keywords.filter(keyword => text.includes(keyword.toLowerCase()));
    if (matchedKeywords.length === 0) continue;
    for (const folderName of rule.folders) {
      const collection = collections.find(item => item.name === folderName);
      if (!collection) continue;
      const current = candidates.get(collection.id) || { collection, score: 0, reasons: [] };
      current.score += matchedKeywords.length;
      current.reasons.push(...matchedKeywords);
      candidates.set(collection.id, current);
    }
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score || left.collection.name.localeCompare(right.collection.name, 'zh-Hant'))
    .map(candidate => ({
      ...candidate,
      reasons: [...new Set(candidate.reasons)].slice(0, 3)
    }));
}
