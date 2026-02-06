/**
 * Brand RAG Module - Brand Guideline Query and Validation
 * 
 * Responsibilities:
 * - Query brand guidelines using vector similarity search
 * - Calculate brand alignment scores
 * - Validate creative content against brand guidelines
 * - Enforce brand consistency (threshold: 0.85)
 */

import { query, searchSimilar } from '../../../utils/db.js';
import OpenAI from 'openai';

// Lazy-load OpenAI client with user key support
let _openaiClient = null;
async function getOpenAI() {
  if (!_openaiClient) {
    const { getEffectiveProviderKey } = await import('../../providers/get-user-key');
    const apiKey = await getEffectiveProviderKey('openai', process.env.OPENAI_API_KEY);
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Add your key in Settings.');
    }
    _openaiClient = new OpenAI({ apiKey });
  }
  return _openaiClient;
}

/**
 * Query brand guidelines using RAG-based vector similarity search
 * 
 * @param {string} brandId - Brand UUID
 * @param {string} context - Query context (e.g., campaign objective, target audience)
 * @param {Object} options - Query options
 * @param {number} options.topK - Number of similar guidelines to retrieve (default: 5)
 * @param {number} options.similarityThreshold - Minimum similarity score (default: 0.7)
 * @returns {Promise<Object>} Brand guidelines and metadata
 */
export async function queryBrandGuidelines(brandId, context, options = {}) {
  const { topK = 5, similarityThreshold = 0.7 } = options;

  console.log(`[Brand RAG] Querying guidelines for brand: ${brandId}`);
  console.log(`[Brand RAG] Context: ${context}`);

  // Get the complete brand profile first
  const brandProfile = await getBrandProfile(brandId);

  // Try vector search if OpenAI is configured
  let relevantGuidelines = [];
  
  try {
    const openai = await getOpenAI();
    // Generate embedding for the query context
    const embedding = await generateEmbedding(context);

    // Retrieve brand guidelines using vector similarity search
    const similarGuidelines = await searchSimilar(
      'brand_guidelines',
      'embedding',
      embedding,
      topK,
      { brand_id: brandId }
    );

    // Filter by similarity threshold
    relevantGuidelines = similarGuidelines
      .filter(g => g.similarity >= similarityThreshold)
      .map(g => ({
        guideline_id: g.guideline_id,
        category: g.category,
        content: g.content,
        similarity: g.similarity
      }));
  } catch (error) {
    console.warn('[Brand RAG] Vector search failed, falling back to keyword search:', error.message);
  }

  // Fallback: If vector search unavailable or failed, get all guidelines for this brand
  if (relevantGuidelines.length === 0) {
    const result = await query(
      `SELECT guideline_id, category, content
       FROM brand_guidelines
       WHERE brand_id = $1 AND is_active = true
       ORDER BY priority DESC
       LIMIT $2`,
      [brandId, topK]
    );

    relevantGuidelines = result.rows.map(g => ({
      guideline_id: g.guideline_id,
      category: g.category,
      content: g.content,
      similarity: 0.95 // Assume high relevance since we're querying by brand_id
    }));
  }

  console.log(`[Brand RAG] Found ${relevantGuidelines.length} relevant guidelines`);

  return {
    brand_id: brandId,
    brand_profile: brandProfile,
    relevant_guidelines: relevantGuidelines,
    query_context: context,
    retrieved_at: new Date().toISOString()
  };
}

/**
 * Get complete brand profile from database
 * 
 * @param {string} brandId - Brand UUID
 * @returns {Promise<Object>} Brand profile
 */
async function getBrandProfile(brandId) {
  const result = await query(
    `SELECT 
      brand_id,
      content,
      metadata
    FROM brand_guidelines
    WHERE brand_id = $1 AND category = 'profile'
    LIMIT 1`,
    [brandId]
  );

  if (result.rows.length === 0) {
    // Return default profile if none exists
    return {
      brand_id: brandId,
      brand_name: 'Unknown Brand',
      tone: 'professional',
      visual_style: 'modern',
      target_audience: 'general',
      core_values: ['quality', 'innovation'],
      restricted_keywords: []
    };
  }

  const row = result.rows[0];
  const metadata = row.metadata || {};
  
  return {
    brand_id: row.brand_id,
    brand_name: metadata.brand_name || 'Unknown Brand',
    industry: metadata.industry || 'general',
    tone: metadata.tone || 'professional',
    visual_style: metadata.visual_style || 'modern',
    target_audience: metadata.target_audience || 'general',
    core_values: metadata.core_values || ['quality', 'innovation'],
    restricted_keywords: metadata.restricted_keywords || []
  };
}

/**
 * Calculate brand alignment score for creative content
 * 
 * @param {string} brandId - Brand UUID
 * @param {Object} content - Content to validate
 * @param {string} content.message - Main message/copy
 * @param {string} content.tone - Content tone
 * @param {string[]} content.keywords - Keywords used in content
 * @returns {Promise<Object>} Alignment score and validation details
 */
export async function calculateBrandAlignment(brandId, content) {
  console.log(`[Brand RAG] Calculating brand alignment for: ${brandId}`);

  // Get brand guidelines
  const guidelines = await queryBrandGuidelines(
    brandId,
    content.message || content.toString(),
    { topK: 3 }
  );

  const brandProfile = guidelines.brand_profile;
  const relevantGuidelines = guidelines.relevant_guidelines;

  // Calculate alignment across multiple dimensions
  const toneAlignment = calculateToneAlignment(content.tone, brandProfile.tone);
  const keywordCompliance = checkKeywordCompliance(
    content.keywords || [],
    brandProfile.restricted_keywords || []
  );
  const guidelineRelevance = relevantGuidelines.length > 0
    ? relevantGuidelines[0].similarity
    : 0;

  // Weighted alignment score
  const alignmentScore = (
    toneAlignment * 0.4 +
    keywordCompliance * 0.3 +
    guidelineRelevance * 0.3
  );

  const passesThreshold = alignmentScore >= 0.85;

  console.log(`[Brand RAG] Alignment score: ${alignmentScore.toFixed(2)} (threshold: 0.85)`);

  return {
    brand_id: brandId,
    alignment_score: parseFloat(alignmentScore.toFixed(2)),
    passes_threshold: passesThreshold,
    threshold: 0.85,
    breakdown: {
      tone_alignment: parseFloat(toneAlignment.toFixed(2)),
      keyword_compliance: parseFloat(keywordCompliance.toFixed(2)),
      guideline_relevance: parseFloat(guidelineRelevance.toFixed(2))
    },
    relevant_guidelines: relevantGuidelines.slice(0, 3),
    validation_status: passesThreshold ? 'approved' : 'requires_review',
    recommendations: passesThreshold
      ? []
      : generateImprovementRecommendations(alignmentScore, {
          toneAlignment,
          keywordCompliance,
          guidelineRelevance,
          brandProfile
        })
  };
}

/**
 * Calculate tone alignment between content and brand
 * 
 * @param {string} contentTone - Tone of the content
 * @param {string} brandTone - Brand's preferred tone
 * @returns {number} Alignment score (0-1)
 */
function calculateToneAlignment(contentTone, brandTone) {
  if (!contentTone || !brandTone) return 0.5;

  // Direct match
  if (contentTone.toLowerCase() === brandTone.toLowerCase()) {
    return 1.0;
  }

  // Tone compatibility matrix
  const toneCompatibility = {
    professional: { formal: 0.9, serious: 0.85, conversational: 0.6 },
    casual: { conversational: 0.95, friendly: 0.9, humorous: 0.8 },
    inspirational: { motivational: 0.95, uplifting: 0.9, emotional: 0.85 },
    humorous: { playful: 0.9, casual: 0.8, friendly: 0.75 },
    serious: { professional: 0.85, formal: 0.8, authoritative: 0.9 }
  };

  const brandToneLower = brandTone.toLowerCase();
  const contentToneLower = contentTone.toLowerCase();

  if (toneCompatibility[brandToneLower]?.[contentToneLower]) {
    return toneCompatibility[brandToneLower][contentToneLower];
  }

  // Default partial match
  return 0.5;
}

/**
 * Check if content uses any restricted keywords
 * 
 * @param {string[]} contentKeywords - Keywords in content
 * @param {string[]} restrictedKeywords - Brand's restricted keywords
 * @returns {number} Compliance score (0-1)
 */
function checkKeywordCompliance(contentKeywords, restrictedKeywords) {
  if (!restrictedKeywords || restrictedKeywords.length === 0) {
    return 1.0;
  }

  if (!contentKeywords || contentKeywords.length === 0) {
    return 1.0;
  }

  // Check for violations
  const violations = contentKeywords.filter(kw =>
    restrictedKeywords.some(rk =>
      kw.toLowerCase().includes(rk.toLowerCase())
    )
  );

  if (violations.length === 0) {
    return 1.0;
  }

  // Partial score based on violation severity
  const violationRate = violations.length / contentKeywords.length;
  return Math.max(0, 1 - violationRate * 2); // Heavy penalty for violations
}

/**
 * Generate improvement recommendations
 * 
 * @param {number} alignmentScore - Current alignment score
 * @param {Object} breakdown - Score breakdown
 * @returns {string[]} Recommendations
 */
function generateImprovementRecommendations(alignmentScore, breakdown) {
  const recommendations = [];

  if (breakdown.toneAlignment < 0.85) {
    recommendations.push(
      `Adjust content tone to better match brand tone: "${breakdown.brandProfile.tone}"`
    );
  }

  if (breakdown.keywordCompliance < 0.85) {
    recommendations.push(
      'Remove or replace restricted keywords from content'
    );
  }

  if (breakdown.guidelineRelevance < 0.7) {
    recommendations.push(
      'Incorporate more brand-specific messaging and values'
    );
  }

  if (alignmentScore < 0.7) {
    recommendations.push(
      'Consider reviewing brand guidelines and rewriting content from scratch'
    );
  }

  return recommendations;
}

/**
 * Validate creative content against brand guidelines
 * 
 * @param {string} brandId - Brand UUID
 * @param {Object} content - Content to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateBrandCompliance(brandId, content) {
  const alignment = await calculateBrandAlignment(brandId, content);

  return {
    is_compliant: alignment.passes_threshold,
    alignment_score: alignment.alignment_score,
    validation_status: alignment.validation_status,
    violations: alignment.recommendations,
    details: alignment
  };
}

/**
 * Generate text embedding using OpenAI
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
  try {
    const embeddingModel = process.env.DEFAULT_EMBEDDING_MODEL || 'text-embedding-3-small';
    const openai = await getOpenAI();
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: text
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('[Brand RAG] Error generating embedding:', error.message);
    
    // Return zero vector as fallback
    return new Array(1536).fill(0);
  }
}

/**
 * Store brand guideline with embedding
 * 
 * @param {Object} guideline - Guideline to store
 * @returns {Promise<Object>} Stored guideline
 */
export async function storeBrandGuideline(guideline) {
  const { brand_id, content, category } = guideline;

  // Generate embedding
  const embedding = await generateEmbedding(content);

  const result = await query(
    `INSERT INTO brand_guidelines 
      (brand_id, content, category, embedding)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [brand_id, content, category, JSON.stringify(embedding)]
  );

  return result.rows[0];
}
