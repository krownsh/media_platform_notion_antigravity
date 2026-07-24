import { generateContentJSON } from './aiService.js';

/**
 * Route Agent Service
 * Responsible for multi-lane intent classification of captured bookmarks/posts.
 */

const SYSTEM_PROMPT = `You are the Route Agent for the Knowledge-Action Vault system.
Your job is to analyze a captured social media post, bookmark, or article and determine its target execution routes.

Available Routes:
- quick_rewrite: Directly rewrite as a short social post (X thread, LinkedIn, short tip).
- translate_localize: Translate into Traditional Chinese and adapt tone for local audience.
- research_content: Requires fact-checking, additional references, or counter-arguments before creation.
- apply_poc: Contains a tool, library, GitHub repo, skill, or workflow that should be matched against project needs and tested in a POC.

Rule: A post CAN have MULTIPLE routes (e.g. quick_rewrite AND apply_poc simultaneously).

Output MUST be a single valid JSON object with the following schema:
{
  "primary_intent": "quick_rewrite" | "translate_localize" | "research_content" | "apply_poc",
  "urgency": "low" | "normal" | "high" | "critical",
  "routes": [
    {
      "type": "quick_rewrite" | "translate_localize" | "research_content" | "apply_poc",
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

  const translateKeywords = ['english', 'en:', 'translate', 'original:', 'source:'];
  if (translateKeywords.some(kw => text.includes(kw)) || /[a-zA-Z]{30,}/.test(text)) {
    routes.push({
      type: 'translate_localize',
      priority: 75,
      reason: 'Content appears to be non-Chinese or references foreign source.'
    });
    reasons.push('Detected foreign language or translation candidate');
  }

  // Every item is eligible for quick rewrite draft
  routes.push({
    type: 'quick_rewrite',
    priority: 60,
    reason: 'Standard post suitable for fast-track social media rewrite.'
  });

  // Pick primary intent
  routes.sort((a, b) => b.priority - a.priority);
  const primary_intent = routes[0].type;
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
        primary_intent: aiResult.primary_intent || aiResult.routes[0].type || 'quick_rewrite',
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
