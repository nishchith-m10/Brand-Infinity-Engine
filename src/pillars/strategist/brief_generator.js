/**
 * Brief Generator Module - Creative Brief Generation
 * 
 * Responsibilities:
 * - Generate strategic creative briefs from campaign requests
 * - Combine trends, brand guidelines, and competitor insights
 * - Validate brief quality and brand alignment
 * - Store and retrieve creative briefs
 */

import { query } from '../../../utils/db.js';
import { getTrends, analyzeTrendVirality, getTrendingAudio } from './trends.js';
import { queryBrandGuidelines, calculateBrandAlignment } from './brand_rag.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate a creative brief from a campaign request
 * 
 * @param {Object} campaignRequest - Campaign request details
 * @param {string} campaignRequest.product_category - Product category
 * @param {string} campaignRequest.target_demographic - Target audience
 * @param {string} campaignRequest.campaign_objective - awareness|conversion|engagement
 * @param {string} campaignRequest.budget_tier - premium|standard|volume
 * @param {string} campaignRequest.brand_id - Brand UUID
 * @param {string} campaignRequest.platform - Target platform (optional)
 * @returns {Promise<Object>} Generated creative brief
 */
export async function generateCreativeBrief(campaignRequest) {
  console.log('[Brief Generator] Starting brief generation');
  console.log('[Brief Generator] Campaign:', campaignRequest);

  const {
    product_category,
    target_demographic,
    campaign_objective,
    budget_tier,
    brand_id,
    platform = 'multi-platform'
  } = campaignRequest;

  // Step 1: Gather market intelligence
  console.log('[Brief Generator] Step 1: Gathering trends...');
  const trends = await getTrends({
    category: product_category,
    minEngagement: 0.6,
    limit: 5,
    daysBack: 7
  });

  const trendingAudio = await getTrendingAudio();

  // Step 2: Query brand guidelines
  console.log('[Brief Generator] Step 2: Querying brand guidelines...');
  const brandContext = `${campaign_objective} campaign for ${target_demographic} in ${product_category} category`;
  const brandGuidelines = await queryBrandGuidelines(brand_id, brandContext, {
    topK: 5,
    similarityThreshold: 0.7
  });

  // Step 3: Get competitor insights (simulated for now)
  console.log('[Brief Generator] Step 3: Analyzing competitors...');
  const competitorInsights = await getCompetitorInsights(product_category);

  // Step 4: Generate brief using LLM
  console.log('[Brief Generator] Step 4: Generating brief with AI...');
  const briefContent = await generateBriefWithAI({
    campaignRequest,
    trends,
    trendingAudio,
    brandGuidelines,
    competitorInsights
  });

  // Step 5: Validate brand alignment
  console.log('[Brief Generator] Step 5: Validating brand alignment...');
  const alignmentResult = await calculateBrandAlignment(brand_id, {
    message: briefContent.core_message.primary_hook,
    tone: briefContent.brand_guidelines_ref.tone,
    keywords: extractKeywords(briefContent)
  });

  // Step 6: Store brief in database
  console.log('[Brief Generator] Step 6: Storing brief...');
  const creativeBrief = {
    ...briefContent,
    brand_alignment_score: alignmentResult.alignment_score,
    approval_status: alignmentResult.passes_threshold ? 'pending' : 'requires_review',
    generated_at: new Date().toISOString()
  };

  const storedBrief = await storeBrief(campaignRequest, creativeBrief, alignmentResult.alignment_score);

  console.log(`[Brief Generator] Brief generated successfully: ${storedBrief.brief_id}`);
  console.log(`[Brief Generator] Brand alignment: ${alignmentResult.alignment_score} (threshold: 0.85)`);

  return {
    ...storedBrief,
    validation: alignmentResult
  };
}

/**
 * Generate brief content using AI (GPT-4)
 * 
 * @param {Object} context - Context for brief generation
 * @returns {Promise<Object>} Generated brief content
 */
export async function generateBriefWithAI(context) {
  const {
    campaignRequest,
    trends,
    trendingAudio,
    brandGuidelines,
    competitorInsights
  } = context;

  const prompt = buildBriefGenerationPrompt(context);

  try {
    const model = process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini';
    const temperature = parseFloat(process.env.LLM_TEMPERATURE ?? '0.2');
    const max_tokens = parseInt(process.env.LLM_MAX_TOKENS ?? '1024', 10);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert marketing strategist creating creative briefs for video campaigns.
Generate comprehensive creative briefs that combine market trends, brand guidelines, and competitor insights.
Output must be valid JSON matching the creative_brief schema.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens,
      response_format: { type: 'json_object' }
    });

    const briefContent = JSON.parse(response.choices[0].message.content);
    return briefContent;

  } catch (error) {
    console.error('[Brief Generator] AI generation error:', error.message);
    
    // Fallback to template-based brief
    return generateTemplateBrief(context);
  }
}

/**
 * Build prompt for AI brief generation
 * 
 * @param {Object} context - Generation context
 * @returns {string} Prompt text
 */
function buildBriefGenerationPrompt(context) {
  const { campaignRequest, trends, brandGuidelines, competitorInsights } = context;

  return `Generate a creative brief for a ${campaignRequest.campaign_objective} campaign.

**Campaign Details:**
- Product Category: ${campaignRequest.product_category}
- Target Demographic: ${campaignRequest.target_demographic}
- Budget Tier: ${campaignRequest.budget_tier}
- Platform: ${campaignRequest.platform || 'multi-platform'}

**Brand Guidelines:**
- Brand Name: ${brandGuidelines.brand_profile.brand_name}
- Tone: ${brandGuidelines.brand_profile.tone}
- Visual Style: ${brandGuidelines.brand_profile.visual_style}
- Core Values: ${brandGuidelines.brand_profile.core_values.join(', ')}

**Trending Insights:**
${trends.slice(0, 3).map(t => `- ${t.topic} (${t.source}, engagement: ${t.engagement_score})`).join('\n')}

**Competitor Insights:**
${competitorInsights.top_patterns.slice(0, 2).map(p => `- ${p.pattern}: ${p.effectiveness}`).join('\n')}

Generate a creative brief with the following JSON structure:
{
  "target_audience": {
    "demographics": "detailed demographics",
    "psychographics": ["value 1", "value 2"],
    "pain_points": ["pain point 1", "pain point 2"]
  },
  "core_message": {
    "primary_hook": "attention-grabbing hook",
    "value_proposition": "clear value prop",
    "call_to_action": "specific CTA"
  },
  "trending_insights": {
    "trending_topics": ["topic 1", "topic 2"],
    "trending_audio": ["audio 1"],
    "competitor_analysis": {
      "winning_patterns": ["pattern 1"],
      "gaps": ["opportunity 1"]
    },
    "viral_patterns": ["pattern 1"]
  },
  "brand_guidelines_ref": {
    "tone": "${brandGuidelines.brand_profile.tone}",
    "color_palette": ["#color1", "#color2"],
    "restricted_keywords": [],
    "visual_style": "${brandGuidelines.brand_profile.visual_style}"
  },
  "variant_suggestions": [
    {
      "variant_type": "humorous",
      "rationale": "why this variant works"
    }
  ]
}`;
}

/**
 * Generate template-based brief (fallback)
 * 
 * @param {Object} context - Generation context
 * @returns {Object} Template brief
 */
function generateTemplateBrief(context) {
  const { campaignRequest, trends, brandGuidelines } = context;

  return {
    target_audience: {
      demographics: campaignRequest.target_demographic,
      psychographics: ['value-conscious', 'tech-savvy', 'socially-aware'],
      pain_points: ['lack of time', 'information overload', 'seeking authenticity']
    },
    core_message: {
      primary_hook: `Transform your ${campaignRequest.product_category} experience`,
      value_proposition: 'Innovative solutions that simplify your life',
      call_to_action: 'Learn more today'
    },
    trending_insights: {
      trending_topics: trends.slice(0, 3).map(t => t.topic),
      trending_audio: ['Upbeat modern track'],
      competitor_analysis: {
        winning_patterns: ['emotional storytelling', 'user testimonials'],
        gaps: ['lack of authenticity', 'generic messaging']
      },
      viral_patterns: ['hook in first 3 seconds', 'clear value prop', 'strong visuals']
    },
    brand_guidelines_ref: {
      tone: brandGuidelines.brand_profile.tone,
      color_palette: ['#0066CC', '#00CC99', '#FFFFFF'],
      restricted_keywords: brandGuidelines.brand_profile.restricted_keywords || [],
      visual_style: brandGuidelines.brand_profile.visual_style
    },
    variant_suggestions: [
      {
        variant_type: 'emotional',
        rationale: 'Connect with audience through storytelling'
      },
      {
        variant_type: 'educational',
        rationale: 'Position as thought leader'
      }
    ]
  };
}

/**
 * Get competitor insights (simulated)
 * 
 * @param {string} category - Product category
 * @returns {Promise<Object>} Competitor insights
 */
async function getCompetitorInsights(category) {
  // In production, query competitor_ads table
  const result = await query(
    `SELECT 
      competitor_name,
      platform,
      engagement_metrics,
      patterns
    FROM competitor_ads
    WHERE patterns->>'category' = $1
    ORDER BY (engagement_metrics->>'engagement_score')::numeric DESC
    LIMIT 5`,
    [category]
  );

  if (result.rows.length === 0) {
    // Return simulated insights
    return {
      top_competitors: ['Competitor A', 'Competitor B'],
      top_patterns: [
        { pattern: 'Emotional storytelling', effectiveness: 'high' },
        { pattern: 'User testimonials', effectiveness: 'high' },
        { pattern: 'Product demos', effectiveness: 'medium' }
      ],
      avg_engagement: 0.75,
      insights: 'Competitors focus heavily on emotional connection and social proof'
    };
  }

  // Process actual competitor data
  return {
    top_competitors: result.rows.map(r => r.competitor_name),
    top_patterns: result.rows.flatMap(r => r.patterns?.winning_patterns || []),
    avg_engagement: result.rows.reduce((sum, r) => 
      sum + (r.engagement_metrics?.engagement_score || 0), 0
    ) / result.rows.length
  };
}

/**
 * Store brief in database
 * 
 * @param {Object} campaignRequest - Original request
 * @param {Object} creativeBrief - Generated brief
 * @param {number} alignmentScore - Brand alignment score
 * @returns {Promise<Object>} Stored brief with ID
 */
async function storeBrief(campaignRequest, creativeBrief, alignmentScore) {
  const result = await query(
    `INSERT INTO creative_briefs 
      (brand_id, campaign_request, creative_brief, brand_alignment_score, approval_status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      campaignRequest.brand_id,
      JSON.stringify(campaignRequest),
      JSON.stringify(creativeBrief),
      alignmentScore,
      creativeBrief.approval_status
    ]
  );

  return result.rows[0];
}

/**
 * Get brief by ID
 * 
 * @param {string} briefId - Brief UUID
 * @returns {Promise<Object>} Brief data
 */
export async function getBriefById(briefId) {
  const result = await query(
    'SELECT * FROM creative_briefs WHERE brief_id = $1',
    [briefId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Brief not found: ${briefId}`);
  }

  return result.rows[0];
}

/**
 * Validate brief quality
 * 
 * @param {Object} brief - Brief to validate
 * @returns {Object} Validation result
 */
export async function validateBrief(brief) {
  const creativeBrief = brief.creative_brief || brief;

  const checks = {
    has_target_audience: !!creativeBrief.target_audience,
    has_core_message: !!creativeBrief.core_message,
    has_trending_insights: !!creativeBrief.trending_insights,
    has_brand_guidelines: !!creativeBrief.brand_guidelines_ref,
    has_variants: creativeBrief.variant_suggestions?.length > 0,
    brand_alignment_passed: brief.brand_alignment_score >= 0.85
  };

  const passedChecks = Object.values(checks).filter(v => v).length;
  const totalChecks = Object.keys(checks).length;
  const qualityScore = passedChecks / totalChecks;

  return {
    is_valid: qualityScore >= 0.8,
    quality_score: parseFloat(qualityScore.toFixed(2)),
    checks,
    passed: passedChecks,
    total: totalChecks,
    issues: Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([check, _]) => `Missing or invalid: ${check.replace(/_/g, ' ')}`)
  };
}

/**
 * Extract keywords from brief for validation
 * 
 * @param {Object} brief - Creative brief
 * @returns {string[]} Extracted keywords
 */
function extractKeywords(brief) {
  const keywords = new Set();

  // Extract from core message
  if (brief.core_message) {
    const messageText = [
      brief.core_message.primary_hook,
      brief.core_message.value_proposition,
      brief.core_message.call_to_action
    ].join(' ');

    // Simple keyword extraction (split on non-alphanumeric)
    const words = messageText
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3);
    
    words.forEach(w => keywords.add(w));
  }

  // Extract from trending topics
  if (brief.trending_insights?.trending_topics) {
    brief.trending_insights.trending_topics.forEach(topic => {
      topic.toLowerCase().split(/\W+/).forEach(w => {
        if (w.length > 3) keywords.add(w);
      });
    });
  }

  return Array.from(keywords);
}

/**
 * Update brief approval status
 * 
 * @param {string} briefId - Brief UUID
 * @param {string} status - New status (approved|rejected|pending)
 * @param {string} approvedBy - User ID who approved
 * @returns {Promise<Object>} Updated brief
 */
export async function updateBriefApprovalStatus(briefId, status, approvedBy = null) {
  const result = await query(
    `UPDATE creative_briefs
     SET approval_status = $1,
         approved_by = $2,
         approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END
     WHERE brief_id = $3
     RETURNING *`,
    [status, approvedBy, briefId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Brief not found: ${briefId}`);
  }

  return result.rows[0];
}
