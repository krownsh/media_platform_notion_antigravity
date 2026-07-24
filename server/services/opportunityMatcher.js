/**
 * Opportunity Matcher Service
 * Performs bi-directional matching between captured bookmarks/routes and project needs.
 */

/**
 * Matches a route classification (with captured post data) against a list of project needs.
 * @param {Object} routeClassification Route classification object from routeAgent
 * @param {Object} postData Captured post data
 * @param {Array<Object>} projectNeeds Array of active project needs
 * @param {Object} targetProject Target project details
 */
export function matchSourceToProjectNeeds(routeClassification, postData, projectNeeds = [], targetProject = {}) {
  const matches = [];

  if (!routeClassification || !postData) {
    return matches;
  }

  const contentText = `${postData.title || ''} ${postData.content || ''} ${(postData.source_domains || []).join(' ')}`.toLowerCase();
  const isPocCandidate = routeClassification.routes?.some(r => r.type === 'apply_poc');

  for (const need of projectNeeds) {
    let score = 0;
    const matchReasons = [];

    // Match keywords
    const categoryKeywords = {
      missing_test: ['test', 'jest', 'vitest', 'playwright', 'puppeteer', 'mock', 'assertion', 'contract'],
      bug: ['fix', 'bug', 'patch', 'error', 'exception', 'issue'],
      security_risk: ['auth', 'jwt', 'security', 'token', 'rls', 'encryption', 'sanitizer', 'cors'],
      tech_debt: ['refactor', 'clean', 'outbox', 'queue', 'postgres', 'migration', 'schema'],
      missing_feature: ['feature', 'extension', 'plugin', 'adapter', 'crawler', 'parser', 'llm', 'ai']
    };

    const keywords = categoryKeywords[need.category] || [];
    for (const kw of keywords) {
      if (contentText.includes(kw)) {
        score += 25;
        matchReasons.push(`Content references category keyword '${kw}' matching need category '${need.category}'`);
      }
    }

    if (isPocCandidate) {
      score += 20;
      matchReasons.push('Bookmark is classified as apply_poc candidate');
    }

    if (score >= 40) {
      matches.push({
        project_id: targetProject.id || null,
        project_need_id: need.id || null,
        title: `POC Application: Apply ${postData.title || 'Bookmark'} to resolve "${need.title}"`,
        hypothesis: `Integrating or benchmarking the tool/concept from ${postData.original_url || postData.url || 'bookmark'} will address "${need.title}".`,
        expected_value: `Resolves ${need.severity} severity issue: ${need.impact}`,
        candidate_module: need.evidence?.[0]?.location || 'test/poc/',
        risk_assessment: {
          license: 'Requires license check during POC execution',
          security_risk: need.category === 'security_risk' ? 'high' : 'low',
          dependency_cost: 'Minimal (isolated in lab/worktree)'
        },
        score,
        matchReasons
      });
    }
  }

  // Sort candidates by match score descending
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
