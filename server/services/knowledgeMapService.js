function knowledgeMapError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeCitation(citation) {
  if (!citation || typeof citation.post_id !== 'string' || !citation.post_id || typeof citation.excerpt !== 'string' || !citation.excerpt.trim()) {
    throw knowledgeMapError('Knowledge map contains an invalid citation', 'KNOWLEDGE_MAP_INVALID');
  }

  return {
    postId: citation.post_id,
    title: typeof citation.title === 'string' && citation.title.trim() ? citation.title.trim() : '原始收藏貼文',
    excerpt: citation.excerpt.trim(),
    evidenceStatus: typeof citation.evidence_status === 'string' ? citation.evidence_status : 'captured_source',
  };
}

function normalizeStatement(statement) {
  if (!statement || typeof statement.text !== 'string' || !statement.text.trim() || !Array.isArray(statement.citations) || statement.citations.length === 0) {
    throw knowledgeMapError('Every knowledge statement must include at least one citation', 'KNOWLEDGE_MAP_INVALID');
  }

  return {
    text: statement.text.trim(),
    detail: typeof statement.detail === 'string' ? statement.detail.trim() : '',
    citations: statement.citations.map(normalizeCitation),
  };
}

function collectionName(collection) {
  const joined = Array.isArray(collection) ? collection[0] : collection;
  return typeof joined?.name === 'string' && joined.name.trim() ? joined.name.trim() : '未命名資料夾';
}

export async function loadKnowledgeMap({ collectionId, userId, supabaseClient }) {
  if (typeof collectionId !== 'string' || !collectionId.trim() || typeof userId !== 'string' || !userId.trim() || !supabaseClient) {
    throw knowledgeMapError('A collection ID, user ID, and database client are required', 'KNOWLEDGE_MAP_NOT_FOUND');
  }

  const { data, error } = await supabaseClient
    .from('collection_knowledge_maps')
    .select('collection_id, status, question, caveat, statements, processed_posts, total_posts, collection:collection_collections!inner(name)')
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Knowledge map] database read failed:', error.message);
    throw knowledgeMapError('Knowledge map reader is temporarily unavailable', 'KNOWLEDGE_MAP_UNAVAILABLE');
  }
  if (!data) throw knowledgeMapError('Knowledge map was not found for this collection', 'KNOWLEDGE_MAP_NOT_FOUND');

  const statements = Array.isArray(data.statements) ? data.statements.map(normalizeStatement) : [];
  if (statements.length === 0) throw knowledgeMapError('Knowledge map has no citable statements', 'KNOWLEDGE_MAP_INVALID');

  return {
    readOnly: true,
    collection: {
      id: data.collection_id,
      name: collectionName(data.collection),
      status: typeof data.status === 'string' ? data.status : 'partial',
      question: typeof data.question === 'string' ? data.question.trim() : '',
      statements,
      caveat: typeof data.caveat === 'string' ? data.caveat.trim() : '',
    },
    progress: {
      processedPosts: Number.isInteger(data.processed_posts) ? data.processed_posts : 0,
      totalPosts: Number.isInteger(data.total_posts) ? data.total_posts : 0,
    },
  };
}
