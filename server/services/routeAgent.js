import { generateContentJSON } from './aiService.js';

/**
 * Route Agent Service
 * Responsible for multi-lane intent classification of captured bookmarks/posts.
 */

const SYSTEM_PROMPT = `You are the Route Agent for the Knowledge-Action Vault system.
Your job is to analyze a captured social media post, bookmark, or article and determine its target execution routes.

Available investigation routes:
- research_content: Requires fact-checking, additional references, or counter-arguments before a conclusion.
- apply_poc: Contains a tool, library, GitHub repo, skill, or workflow that may be matched against project needs and tested in a POC.

Content rewriting is intentionally not an initial route. It is either an explicit
fast-rewrite request or a final synthesis after research/validation.

Output MUST be a single valid JSON object with the following schema:
{
  "primary_intent": "analysis_only" | "research_content" | "apply_poc",
  "urgency": "low" | "normal" | "high" | "critical",
  "routes": [
    {
      "type": "research_content" | "apply_poc",
      "priority": number (1-100),
      "reason": "explanation string"
    }
  ],
  "reasons": ["summary of why these routes were chosen"]
}`;

/**
 * Rule-based fallback classifier when LLM is unavailable or for rapid dry-runs.
 */
export function classifyRoutesByRules(postData) {
  const content = (postData.content || postData.raw_content || '').toLowerCase();
  const title = (postData.title || '').toLowerCase();
  const text = `${title} ${content}`;
  
  const routes = [];
  const reasons = [];

  const toolKeywords = ['github.com', 'npm', 'pip install', 'repo', 'library', 'package', 'plugin', 'framework', 'cli', 'sdk', 'api', 'docker', 'version'];
  const isToolCandidate = toolKeywords.some(kw => text.includes(kw));

  if (isToolCandidate) {
    routes.push({
      type: 'apply_poc',
      priority: 85,
      reason: 'Contains code, package, or tool reference suitable for POC testing.'
    });
    reasons.push('Detected developer tool/library keywords');
  }

  const researchKeywords = ['paper', 'benchmark', 'research', 'study', 'whitepaper', 'case study', '論文', '研究', '比較', '限制'];
  if (researchKeywords.some(kw => text.includes(kw))) {
    routes.push({
      type: 'research_content',
      priority: 75,
      reason: 'Contains claims or material that benefits from additional verification and context.'
    });
    reasons.push('Detected research or comparison keywords');
  }

  // Pick primary intent
  routes.sort((a, b) => b.priority - a.priority);
  const primary_intent = routes[0]?.type || 'analysis_only';
  const urgency = isToolCandidate ? 'high' : 'normal';

  return {
    primary_intent,
    urgency,
    routes,
    reasons: reasons.length > 0 ? reasons : ['Default classification applied']
  };
}

/**
 * Classifies a post using LLM with rule fallback.
 */
export async function classifyPostRoutes(postData) {
  if (!postData || typeof postData !== 'object') {
    throw new Error('Invalid postData provided to RouteAgent');
  }

  const userPrompt = `Analyze the following captured post:
Platform: ${postData.platform || 'generic'}
Title: ${postData.title || 'N/A'}
Content snippet: ${(postData.content || '').substring(0, 1500)}
Source domains: ${(postData.source_domains || []).join(', ')}
Hashtags: ${(postData.tags || []).join(', ')}`;

  try {
    const aiResult = await generateContentJSON(SYSTEM_PROMPT, userPrompt);
    if (aiResult && aiResult.routes && Array.isArray(aiResult.routes) && aiResult.routes.length > 0) {
      return {
    primary_intent: aiResult.primary_intent || aiResult.routes[0]?.type || 'analysis_only',
        urgency: aiResult.urgency || 'normal',
        routes: aiResult.routes,
        reasons: aiResult.reasons || ['LLM intent routing']
      };
    }
  } catch (err) {
    console.warn(`[RouteAgent] LLM classification failed (${err.message}). Using rule fallback.`);
  }

  return classifyRoutesByRules(postData);
}
