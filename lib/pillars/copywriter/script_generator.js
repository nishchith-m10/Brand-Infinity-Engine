/**
 * Copywriter Module - Script & Hook Generation (Pillar 2)
 * 
 * Responsibilities:
 * - Generate 50 hook variations per brief
 * - Score hooks using psychological persuasion patterns
 * - Generate scene-by-scene scripts
 * - Calculate brand compliance scores
 * - Store scripts and hooks in database
 */

import { query } from '../../../utils/db.js';
import { getBriefById } from '../strategist/brief_generator.js';
import { calculateBrandAlignment } from '../strategist/brand_rag.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_MODEL = process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini';
const DEFAULT_TEMP = parseFloat(process.env.LLM_TEMPERATURE ?? '0.2');
const DEFAULT_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS ?? '1024', 10);

/**
 * Generate hooks and script from creative brief
 * 
 * @param {string} briefId - Creative brief UUID
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} Generated script with hooks
 */
export async function generateScript(briefId, options = {}) {
  console.log(`[Copywriter] Generating script for brief: ${briefId}`);

  const {
    hookCount = 50,
    variantTag = 'balanced',
    targetDuration = 30
  } = options;

  // Step 1: Get creative brief
  const brief = await getBriefById(briefId);
  if (!brief) {
    throw new Error(`Brief not found: ${briefId}`);
  }

  // Step 2: Generate 50 hook variations
  console.log(`[Copywriter] Generating ${hookCount} hook variations...`);
  const hooks = await generateHooks(brief, hookCount);

  // Step 3: Score and rank hooks
  console.log('[Copywriter] Scoring hooks...');
  const scoredHooks = await scoreHooks(hooks, brief);

  // Step 4: Select best hook
  const selectedHook = scoredHooks[0];
  console.log(`[Copywriter] Selected hook: "${selectedHook.hook_text}" (score: ${selectedHook.quality_score})`);

  // Step 5: Generate scene-by-scene script
  console.log('[Copywriter] Generating scene script...');
  const sceneScript = await generateSceneScript(brief, selectedHook, targetDuration);

  // Step 6: Calculate brand compliance
  console.log('[Copywriter] Calculating brand compliance...');
  const complianceScore = await calculateScriptCompliance(brief, sceneScript);

  // Step 7: Store script and all hooks
  console.log('[Copywriter] Storing script and hooks...');
  const scriptId = await storeScript({
    briefId,
    selectedHook,
    scenes: sceneScript.scenes,
    voiceoverText: sceneScript.voiceover_full_text,
    totalDuration: sceneScript.total_duration_seconds,
    variantTag,
    complianceScore
  });

  await storeHooks(scriptId, scoredHooks);

  console.log(`[Copywriter] Script generated successfully: ${scriptId}`);

  return {
    script_id: scriptId,
    brief_id: briefId,
    selected_hook: selectedHook,
    hook_variations_count: scoredHooks.length,
    scenes: sceneScript.scenes,
    total_duration: sceneScript.total_duration_seconds,
    brand_compliance_score: complianceScore,
    approval_status: complianceScore >= 0.85 ? 'pending' : 'revision_requested'
  };
}

/**
 * Generate hook variations using AI
 * 
 * @param {Object} brief - Creative brief
 * @param {number} count - Number of hooks to generate
 * @returns {Promise<Array>} Array of hook objects
 */
async function generateHooks(brief, count = 50) {
  const creativeBrief = typeof brief.creative_brief === 'string' 
    ? JSON.parse(brief.creative_brief) 
    : brief.creative_brief;

  const prompt = buildHookGenerationPrompt(creativeBrief, count);

  try {
    const model = process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini';
    const temperature = parseFloat(process.env.LLM_TEMPERATURE ?? '0.7'); // Higher temp for creativity
    const max_tokens = parseInt(process.env.LLM_MAX_TOKENS ?? '2048', 10);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert copywriter specializing in viral short-form video hooks.
Generate attention-grabbing hooks that leverage psychological persuasion patterns.
Output must be valid JSON array.`
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

    const result = JSON.parse(response.choices[0].message.content);
    return result.hooks || [];

  } catch (error) {
    console.error('[Copywriter] Hook generation error:', error.message);
    
    // Fallback to template hooks
    return generateTemplateHooks(creativeBrief, count);
  }
}

/**
 * Build prompt for hook generation
 */
function buildHookGenerationPrompt(brief, count) {
  return `Generate ${count} viral hook variations for a short-form video campaign.

**Target Audience:**
${JSON.stringify(brief.target_audience, null, 2)}

**Core Message:**
- Primary Hook: ${brief.core_message?.primary_hook || 'N/A'}
- Value Proposition: ${brief.core_message?.value_proposition || 'N/A'}

**Brand Guidelines:**
- Tone: ${brief.brand_guidelines_ref?.tone || 'professional'}
- Visual Style: ${brief.brand_guidelines_ref?.visual_style || 'modern'}

**Trending Insights:**
${brief.trending_insights?.trending_topics?.slice(0, 3).join(', ') || 'N/A'}

Generate ${count} hooks with diverse types:
- Question hooks (provocative questions)
- Statement hooks (bold claims)
- Visual shock hooks (unexpected visuals)
- Story hooks (narrative opening)
- Curiosity gap hooks (incomplete information)

Output JSON format:
{
  "hooks": [
    {
      "hook_text": "Your hook text here",
      "hook_type": "question|statement|visual_shock|story|curiosity_gap",
      "variation_number": 1
    }
  ]
}`;
}

/**
 * Generate template hooks (fallback)
 */
function generateTemplateHooks(brief, count) {
  const templates = [
    { type: 'question', text: `Did you know ${brief.core_message?.value_proposition || 'this'}?` },
    { type: 'statement', text: `${brief.core_message?.primary_hook || 'Transform your life'}` },
    { type: 'visual_shock', text: 'Watch what happens next...' },
    { type: 'story', text: 'This changed everything for me...' },
    { type: 'curiosity_gap', text: `The secret ${brief.target_audience?.demographics || 'everyone'} needs to know...` }
  ];

  const hooks = [];
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    hooks.push({
      hook_text: `${template.text} (variation ${i + 1})`,
      hook_type: template.type,
      variation_number: i + 1
    });
  }

  return hooks;
}

/**
 * Score hooks using psychological persuasion patterns
 */
async function scoreHooks(hooks, brief) {
  const scored = hooks.map((hook, idx) => {
    // Simple scoring algorithm (can be enhanced with AI)
    const patterns = {
      curiosity_gap: hook.hook_text.includes('secret') || hook.hook_text.includes('?') ? 0.8 : 0.3,
      emotional_resonance: hook.hook_text.length > 50 ? 0.7 : 0.5,
      pattern_interrupt: hook.hook_type === 'visual_shock' ? 0.9 : 0.4,
      shareability: hook.hook_type === 'question' ? 0.8 : 0.6
    };

    const quality_score = (
      patterns.curiosity_gap * 0.3 +
      patterns.emotional_resonance * 0.2 +
      patterns.pattern_interrupt * 0.3 +
      patterns.shareability * 0.2
    );

    return {
      ...hook,
      quality_score: parseFloat(quality_score.toFixed(2)),
      psychological_patterns: patterns,
      selected: idx === 0 // Mark first as selected by default
    };
  });

  // Sort by quality score descending
  return scored.sort((a, b) => b.quality_score - a.quality_score);
}

/**
 * Generate scene-by-scene script
 */
async function generateSceneScript(brief, selectedHook, targetDuration) {
  const creativeBrief = typeof brief.creative_brief === 'string'
    ? JSON.parse(brief.creative_brief)
    : brief.creative_brief;

  const prompt = `Generate a ${targetDuration}-second video script.

**Hook:** ${selectedHook.hook_text}

**Core Message:**
${JSON.stringify(creativeBrief.core_message, null, 2)}

**Target Audience:**
${creativeBrief.target_audience?.demographics || 'general audience'}

Create a scene-by-scene breakdown with:
- Scene number, duration, voiceover, and visual description
- Total duration: ${targetDuration}s

Output JSON format:
{
  "scenes": [
    {
      "scene_number": 1,
      "duration_seconds": 3,
      "voiceover": "text",
      "visual_description": "description"
    }
  ],
  "voiceover_full_text": "complete script",
  "total_duration_seconds": ${targetDuration}
}`;

  try {
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: 'You are a professional video script writer.' },
        { role: 'user', content: prompt }
      ],
      temperature: DEFAULT_TEMP,
      max_tokens: DEFAULT_MAX_TOKENS * 2,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);

  } catch (error) {
    console.error('[Copywriter] Scene script generation error:', error.message);
    
    // Fallback template
    return {
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 3,
          voiceover: selectedHook.hook_text,
          visual_description: 'Opening hook scene'
        },
        {
          scene_number: 2,
          duration_seconds: 20,
          voiceover: creativeBrief.core_message?.value_proposition || 'Main content',
          visual_description: 'Product demonstration'
        },
        {
          scene_number: 3,
          duration_seconds: 7,
          voiceover: creativeBrief.core_message?.call_to_action || 'Learn more',
          visual_description: 'Call to action'
        }
      ],
      voiceover_full_text: `${selectedHook.hook_text}. ${creativeBrief.core_message?.value_proposition}. ${creativeBrief.core_message?.call_to_action}.`,
      total_duration_seconds: targetDuration
    };
  }
}

/**
 * Calculate script brand compliance
 */
async function calculateScriptCompliance(brief, sceneScript) {
  const scriptText = sceneScript.voiceover_full_text;
  const creativeBrief = typeof brief.creative_brief === 'string'
    ? JSON.parse(brief.creative_brief)
    : brief.creative_brief;

  // Extract tone and keywords from script
  const alignment = await calculateBrandAlignment(brief.brand_id, {
    message: scriptText,
    tone: creativeBrief.brand_guidelines_ref?.tone || 'professional',
    keywords: scriptText.split(' ').slice(0, 10)
  });

  return alignment.alignment_score;
}

/**
 * Store script in database
 */
async function storeScript(scriptData) {
  const result = await query(
    `INSERT INTO scripts 
      (brief_id, hook, scenes, voiceover_full_text, total_duration_seconds, 
       variant_tag, brand_compliance_score, approval_status, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     RETURNING script_id`,
    [
      scriptData.briefId,
      JSON.stringify(scriptData.selectedHook),
      JSON.stringify(scriptData.scenes),
      scriptData.voiceoverText,
      scriptData.totalDuration,
      scriptData.variantTag,
      scriptData.complianceScore,
      scriptData.complianceScore >= 0.85 ? 'pending' : 'revision_requested'
    ]
  );

  return result.rows[0].script_id;
}

/**
 * Store all hook variations
 */
async function storeHooks(scriptId, hooks) {
  for (const hook of hooks) {
    await query(
      `INSERT INTO hooks 
        (script_id, hook_text, hook_type, quality_score, variation_number, 
         selected, psychological_patterns)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        scriptId,
        hook.hook_text,
        hook.hook_type,
        hook.quality_score,
        hook.variation_number,
        hook.selected || false,
        JSON.stringify(hook.psychological_patterns)
      ]
    );
  }
}

/**
 * Get script by ID
 */
export async function getScriptById(scriptId) {
  const result = await query(
    'SELECT * FROM scripts WHERE script_id = $1',
    [scriptId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Script not found: ${scriptId}`);
  }

  return result.rows[0];
}

/**
 * Get all hooks for a script
 */
export async function getHooksByScriptId(scriptId) {
  const result = await query(
    `SELECT * FROM hooks 
     WHERE script_id = $1 
     ORDER BY quality_score DESC`,
    [scriptId]
  );

  return result.rows;
}