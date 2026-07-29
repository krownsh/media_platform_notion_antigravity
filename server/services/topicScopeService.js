const POC_PROPOSAL_MODE = 'poc_proposal';

export function normalizeGitHubTarget(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  const match = value.match(/github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
  if (!match) return null;
  return `github:${match[1]}/${match[2]}`.toLowerCase();
}

export function selectPocTopicScope(scopes, projectTarget) {
  if (!Array.isArray(scopes)) return null;

  return scopes.find(scope => (
    scope?.is_active !== false
    && scope?.mode === POC_PROPOSAL_MODE
    && Array.isArray(scope?.project_targets)
    && scope.project_targets.includes(projectTarget)
  )) || null;
}

export async function getTopicScopesForPost(postData, supabaseClient) {
  if (!postData?.id || !postData?.user_id) {
    throw new Error('postData.id and postData.user_id are required to resolve topic scopes');
  }
  if (!supabaseClient) throw new Error('Supabase client is required to resolve topic scopes');

  const collectionIds = new Set(postData.collection_id ? [postData.collection_id] : []);
  const { data: mappings, error: mappingsError } = await supabaseClient
    .from('collection_collection_post_map')
    .select('collection_id')
    .eq('post_id', postData.id)
    .eq('user_id', postData.user_id);
  if (mappingsError) throw new Error(`Failed to read source folder mappings: ${mappingsError.message}`);

  for (const mapping of mappings || []) {
    if (mapping.collection_id) collectionIds.add(mapping.collection_id);
  }
  let scopeQuery = supabaseClient
    .from('collection_topic_scopes')
    .select('id, collection_id, mode, objective, project_targets, is_active')
    .eq('user_id', postData.user_id)
    .eq('is_active', true);
  scopeQuery = collectionIds.size === 0
    ? scopeQuery.is('collection_id', null)
    : scopeQuery.in('collection_id', [...collectionIds]);

  const { data: scopes, error: scopesError } = await scopeQuery;
  if (scopesError) throw new Error(`Failed to read topic scopes: ${scopesError.message}`);

  return scopes || [];
}
