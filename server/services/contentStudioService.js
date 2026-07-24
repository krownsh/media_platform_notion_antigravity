import { generateContentJSON } from './aiService.js';

/**
 * Content Studio Service
 * Fast-track social media content generator for rewrites and translations.
 */

const REWRITE_SYSTEM_PROMPT = `You are a professional social media content creator and tech writer.
Adapt the given bookmark/article into a platform-native post draft.

Supported Formats:
- x_thread: A punchy 3-5 tweet thread with hook, key points, and call-to-action.
- linkedin_post: Professional insights, formatted with bullet points and key takeaways.
- blog_article: Concise Markdown summary with headers, takeaways, and source attribution.

Rules:
1. Always preserve the original source URL for attribution.
2. Output Traditional Chinese (繁體中文).
3. Do NOT claim you performed an in-depth POC unless evidence is explicitly provided.

Output Schema:
{
  "title": "Headline or thread topic",
  "format": "x_thread" | "linkedin_post" | "blog_article",
  "body": "Formatted content text",
  "key_takeaways": ["point 1", "point 2"],
  "attribution": "Original link reference"
}`;

/**
 * Generates a fast-track content draft based on post content and requested format.
 */
export async function createFastTrackDraft(postData, format = 'x_thread') {
  if (!postData || !postData.content) {
    throw new Error('postData with content is required for content adaptation');
  }

  const prompt = `Adapt the following source into a ${format}:
Title: ${postData.title || 'Untitled'}
Source URL: ${postData.original_url || postData.url || 'N/A'}
Content: ${postData.content.substring(0, 2000)}`;

  try {
    const aiResult = await generateContentJSON(REWRITE_SYSTEM_PROMPT, prompt);
    if (aiResult && aiResult.body) {
      return {
        title: aiResult.title || postData.title || 'Quick Adaptation',
        format,
        body: aiResult.body,
        metadata: {
          key_takeaways: aiResult.key_takeaways || [],
          attribution: aiResult.attribution || postData.original_url || postData.url
        }
      };
    }
  } catch (err) {
    console.warn(`[ContentStudio] LLM generation failed (${err.message}). Using fallback template.`);
  }

  // Pure rule fallback
  const sourceUrl = postData.original_url || postData.url || '';
  const bodyText = `💡 【即時精華整理】${postData.title || ''}\n\n${(postData.content || '').substring(0, 300)}...\n\n🔗 延伸閱讀 / 原始來源: ${sourceUrl}`;

  return {
    title: postData.title || 'Quick Adaptation Draft',
    format,
    body: bodyText,
    metadata: {
      key_takeaways: ['Rule-based fallback draft'],
      attribution: sourceUrl
    }
  };
}
