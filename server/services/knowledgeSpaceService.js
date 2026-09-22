function knowledgeSpaceError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sourcePost(sourcePost) {
  const joined = Array.isArray(sourcePost) ? sourcePost[0] : sourcePost;
  return {
    title: typeof joined?.title === 'string' && joined.title.trim() ? joined.title.trim() : '原始收藏貼文',
    url: typeof joined?.original_url === 'string' ? joined.original_url : ''
  };
}

function normalizeEvidence(evidence) {
  if (!evidence || typeof evidence.source_post_id !== 'string' || !evidence.source_post_id || typeof evidence.excerpt !== 'string' || !evidence.excerpt.trim()) {
    throw knowledgeSpaceError('Knowledge space contains invalid evidence', 'KNOWLEDGE_SPACE_INVALID');
  }

  const post = sourcePost(evidence.source_post);
  return {
    postId: evidence.source_post_id,
    role: typeof evidence.evidence_role === 'string' ? evidence.evidence_role : 'supports',
    excerpt: evidence.excerpt.trim(),
    evidenceStatus: typeof evidence.evidence_status === 'string' ? evidence.evidence_status : 'source_captured',
    note: typeof evidence.note === 'string' ? evidence.note.trim() : '',
    sourceTitle: post.title,
    sourceUrl: post.url
  };
}

function normalizeNode(node) {
  if (!node || typeof node.id !== 'string' || !node.id || typeof node.title !== 'string' || !node.title.trim() || typeof node.problem !== 'string' || !node.problem.trim() || !Array.isArray(node.evidence) || node.evidence.length === 0) {
    throw knowledgeSpaceError('Every knowledge-space node must include a problem and at least one source citation', 'KNOWLEDGE_SPACE_INVALID');
  }

  return {
    id: node.id,
    slug: typeof node.slug === 'string' ? node.slug : '',
    type: typeof node.node_type === 'string' ? node.node_type : 'question',
    title: node.title.trim(),
    problem: node.problem.trim(),
    content: node.content && typeof node.content === 'object' && !Array.isArray(node.content) ? node.content : {},
    status: typeof node.status === 'string' ? node.status : 'draft',
    evidence: node.evidence.map(normalizeEvidence)
  };
}

function normalizeTextList(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
}

function normalizeEvidenceLink(link, nodesById) {
  const roles = ['evidence', 'method', 'example', 'decision', 'risk', 'open_question'];
  const statuses = ['proposed', 'accepted', 'superseded', 'archived'];
  const node = nodesById.get(link?.node_id);
  if (!link || typeof link.id !== 'string' || !link.id || !node || !roles.includes(link.evidence_role) || typeof link.rationale !== 'string' || !link.rationale.trim()) {
    throw knowledgeSpaceError('Knowledge-space stage contains an invalid evidence link', 'KNOWLEDGE_SPACE_INVALID');
  }

  return {
    id: link.id,
    role: link.evidence_role,
    rationale: link.rationale.trim(),
    applicability: typeof link.applicability === 'string' ? link.applicability.trim() : '',
    limitation: typeof link.limitation === 'string' ? link.limitation.trim() : '',
    position: Number.isInteger(link.position) && link.position >= 0 ? link.position : 0,
    status: statuses.includes(link.status) ? link.status : 'proposed',
    node
  };
}

function normalizeStage(stage, nodesById) {
  if (!stage || typeof stage.id !== 'string' || !stage.id || typeof stage.slug !== 'string' || !stage.slug.trim() || typeof stage.title !== 'string' || !stage.title.trim() || typeof stage.objective !== 'string' || !stage.objective.trim()) {
    throw knowledgeSpaceError('Knowledge space contains an invalid product-path stage', 'KNOWLEDGE_SPACE_INVALID');
  }

  const sortLinks = (left, right) => left.position - right.position || left.id.localeCompare(right.id);
  const candidateNodes = (Array.isArray(stage.node_links) ? stage.node_links : [])
    .map((link) => {
      const node = nodesById.get(link?.node_id);
      if (!node) throw knowledgeSpaceError('Knowledge-space stage references an unavailable node', 'KNOWLEDGE_SPACE_INVALID');
      return { position: Number.isInteger(link?.position) && link.position >= 0 ? link.position : 0, node };
    })
    .sort((left, right) => left.position - right.position || left.node.id.localeCompare(right.node.id))
    .map(({ node }) => node);
  const allEvidenceLinks = (Array.isArray(stage.evidence_links) ? stage.evidence_links : [])
    .map((link) => normalizeEvidenceLink(link, nodesById))
    .sort(sortLinks);
  const evidenceLinks = allEvidenceLinks.filter((link) => link.status === 'accepted');
  const proposedEvidenceLinks = allEvidenceLinks.filter((link) => link.status === 'proposed');
  const requestedCoverage = ['supported', 'partial', 'gap'].includes(stage.coverage_status) ? stage.coverage_status : 'gap';
  const coverageStatus = evidenceLinks.length > 0 ? requestedCoverage : 'gap';

  return {
    id: stage.id,
    slug: stage.slug.trim(),
    title: stage.title.trim(),
    objective: stage.objective.trim(),
    position: Number.isInteger(stage.position) && stage.position >= 0 ? stage.position : 0,
    requiredInputs: normalizeTextList(stage.required_inputs),
    expectedOutputs: normalizeTextList(stage.expected_outputs),
    gates: normalizeTextList(stage.gates),
    coverageStatus,
    status: typeof stage.status === 'string' ? stage.status : 'draft',
    evidenceLinks,
    proposedEvidenceLinks,
    candidateNodes,
    transitions: (Array.isArray(stage.transitions) ? stage.transitions : [])
      .filter((transition) => typeof transition?.to_stage_id === 'string' && transition.to_stage_id)
      .map((transition) => ({
        toStageId: transition.to_stage_id,
        type: ['progression', 'branch', 'feedback'].includes(transition.transition_type) ? transition.transition_type : 'progression',
        condition: typeof transition.condition === 'string' ? transition.condition.trim() : ''
      }))
  };
}

function normalizeCollection(scope) {
  const collection = Array.isArray(scope?.collection) ? scope.collection[0] : scope?.collection;
  if (!collection || typeof collection.id !== 'string' || !collection.id || typeof collection.name !== 'string' || !collection.name.trim()) {
    throw knowledgeSpaceError('Knowledge space contains an invalid source-folder scope', 'KNOWLEDGE_SPACE_INVALID');
  }

  return {
    id: collection.id,
    name: collection.name.trim(),
    role: scope.scope_role === 'primary' ? 'primary' : 'supporting',
    position: Number.isInteger(scope.position) && scope.position >= 0 ? scope.position : 0
  };
}

function normalizeSpaceSummary(space) {
  if (!space || typeof space.id !== 'string' || !space.id || typeof space.name !== 'string' || !space.name.trim()) {
    throw knowledgeSpaceError('Knowledge space contains an invalid summary', 'KNOWLEDGE_SPACE_INVALID');
  }

  return {
    id: space.id,
    slug: typeof space.slug === 'string' ? space.slug : '',
    name: space.name.trim(),
    purpose: typeof space.purpose === 'string' ? space.purpose.trim() : '',
    status: typeof space.status === 'string' ? space.status : 'draft',
    taxonomyVersion: Number.isInteger(space.taxonomy_version) ? space.taxonomy_version : 1
  };
}

export async function listKnowledgeSpaces({ userId, supabaseClient }) {
  if (typeof userId !== 'string' || !userId.trim() || !supabaseClient) {
    throw knowledgeSpaceError('A user ID and database client are required', 'KNOWLEDGE_SPACE_NOT_FOUND');
  }

  const { data, error } = await supabaseClient
    .from('knowledge_spaces')
    .select('id, slug, name, purpose, status, taxonomy_version')
    .eq('user_id', userId)
    .in('status', ['active', 'published'])
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Knowledge spaces] list read failed:', error.message);
    throw knowledgeSpaceError('Knowledge spaces are temporarily unavailable', 'KNOWLEDGE_SPACE_UNAVAILABLE');
  }

  return {
    readOnly: true,
    spaces: Array.isArray(data) ? data.map(normalizeSpaceSummary) : []
  };
}

export async function loadKnowledgeSpace({ spaceId, userId, supabaseClient }) {
  if (typeof spaceId !== 'string' || !spaceId.trim() || typeof userId !== 'string' || !userId.trim() || !supabaseClient) {
    throw knowledgeSpaceError('A knowledge space ID, user ID, and database client are required', 'KNOWLEDGE_SPACE_NOT_FOUND');
  }

  const { data, error } = await supabaseClient
    .from('knowledge_spaces')
    .select('id, slug, name, purpose, status, taxonomy_version, collections:knowledge_space_collections!inner(scope_role, position, collection:collection_collections!inner(id, name)), nodes:knowledge_map_nodes!inner(id, slug, node_type, title, problem, content, status, evidence:knowledge_node_evidence!inner(source_post_id, evidence_role, excerpt, evidence_status, note, source_post:collection_posts!inner(title, original_url))), stages:knowledge_space_path_stages!left(id, slug, title, objective, position, required_inputs, expected_outputs, gates, coverage_status, status, node_links:knowledge_space_stage_nodes!left(position, node_id), evidence_links:knowledge_space_stage_evidence_links!left(id, position, node_id, evidence_role, rationale, applicability, limitation, status), transitions:knowledge_space_stage_transitions!knowledge_space_stage_transitions_from_stage_id_fkey(to_stage_id, transition_type, condition))')
    .eq('id', spaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Knowledge space] database read failed:', error.message);
    throw knowledgeSpaceError('Knowledge space reader is temporarily unavailable', 'KNOWLEDGE_SPACE_UNAVAILABLE');
  }
  if (!data) throw knowledgeSpaceError('Knowledge space was not found', 'KNOWLEDGE_SPACE_NOT_FOUND');

  const collections = Array.isArray(data.collections) ? data.collections.map(normalizeCollection).sort((left, right) => left.position - right.position || left.name.localeCompare(right.name, 'zh-Hant')) : [];
  if (collections.length === 0) throw knowledgeSpaceError('Knowledge space has no explicit source-folder scope', 'KNOWLEDGE_SPACE_INVALID');

  const nodes = Array.isArray(data.nodes) ? data.nodes.map(normalizeNode) : [];
  if (nodes.length === 0) throw knowledgeSpaceError('Knowledge space has no citable nodes', 'KNOWLEDGE_SPACE_INVALID');
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const stages = Array.isArray(data.stages)
    ? data.stages.map((stage) => normalizeStage(stage, nodesById)).sort((left, right) => left.position - right.position || left.slug.localeCompare(right.slug))
    : [];

  return {
    readOnly: true,
    space: {
      id: data.id,
      slug: typeof data.slug === 'string' ? data.slug : '',
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '未命名知識地圖',
      purpose: typeof data.purpose === 'string' ? data.purpose.trim() : '',
      status: typeof data.status === 'string' ? data.status : 'draft',
      taxonomyVersion: Number.isInteger(data.taxonomy_version) ? data.taxonomy_version : 1
    },
    collections,
    nodes,
    stages
  };
}
