/**
 * Brand Prompt Builder
 * 
 * Fetches brand identity from database and formats it for injection
 * into LLM system prompts. Ensures consistent brand voice across all
 * AI-generated content.
 * 
 * Phase 2: Brand Voice Enforcement
 */

import { createClient } from '@/lib/supabase/server';

export interface BrandIdentity {
  id: string;
  brand_id: string;
  campaign_id?: string | null;
  brand_name?: string;
  brand_voice?: string;
  tagline?: string;
  mission_statement?: string;
  target_audience?: string;
  tone_style?: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'playful' | 'empathetic';
  personality_traits?: string[];
  content_pillars?: string[];
  primary_color?: string;
  secondary_color?: string;
}

export interface BrandPromptContext {
  systemPromptPrefix: string;
  userContextSection: string;
  toneGuidelines: string;
  brandIdentity: BrandIdentity | null;
}

/**
 * Fetch brand identity for a given brand and optional campaign
 * Respects campaign identity modes (isolated, inherited, shared)
 */
export async function getBrandIdentity(
  brandId: string,
  campaignId?: string
): Promise<BrandIdentity | null> {
  try {
    const supabase = await createClient();

    // If campaign_id is provided, check campaign's identity_mode first
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('id, identity_mode, parent_campaign_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        // ISOLATED MODE: Campaign has its own identity
        if (campaign.identity_mode === 'isolated') {
          const { data: campaignIdentity } = await supabase
            .from('brand_identity')
            .select('*')
            .eq('campaign_id', campaignId)
            .single();

          if (campaignIdentity) {
            return campaignIdentity as BrandIdentity;
          }
        }

        // INHERITED MODE: Use identity from parent campaign
        if (campaign.identity_mode === 'inherited' && campaign.parent_campaign_id) {
          const { data: parentIdentity } = await supabase
            .from('brand_identity')
            .select('*')
            .eq('campaign_id', campaign.parent_campaign_id)
            .single();

          if (parentIdentity) {
            return parentIdentity as BrandIdentity;
          }
        }
      }
    }

    // SHARED MODE (or no campaign): Use brand-level identity
    const { data: brandIdentity } = await supabase
      .from('brand_identity')
      .select('*')
      .eq('brand_id', brandId)
      .is('campaign_id', null)
      .single();

    return brandIdentity as BrandIdentity | null;
  } catch (error) {
    console.error('[BrandPromptBuilder] Error fetching brand identity:', error);
    return null;
  }
}

/**
 * Build system prompt prefix from brand identity
 * This is injected at the start of the system prompt for all LLM calls
 */
export function buildSystemPromptPrefix(identity: BrandIdentity | null): string {
  if (!identity) {
    return '';
  }

  const lines: string[] = [];
  
  lines.push('=== BRAND IDENTITY GUIDELINES ===');
  lines.push('You are generating content for a specific brand. Follow these identity guidelines strictly:');
  lines.push('');

  // Brand basics
  if (identity.brand_name) {
    lines.push(`Brand Name: ${identity.brand_name}`);
  }

  if (identity.tagline) {
    lines.push(`Tagline: "${identity.tagline}"`);
  }

  if (identity.mission_statement) {
    lines.push(`Mission: ${identity.mission_statement}`);
  }

  // Target audience
  if (identity.target_audience) {
    lines.push('');
    lines.push(`Target Audience: ${identity.target_audience}`);
  }

  // Voice and tone
  lines.push('');
  lines.push('=== VOICE & TONE ===');

  if (identity.tone_style) {
    const toneDescriptions: Record<string, string> = {
      professional: 'Business-like, credible, and authoritative. Use formal language and maintain expertise.',
      casual: 'Relaxed and conversational. Use everyday language and feel approachable.',
      friendly: 'Warm, welcoming, and personable. Create a sense of connection with the audience.',
      authoritative: 'Expert, confident, and decisive. Establish thought leadership and trust.',
      playful: 'Fun, energetic, and lighthearted. Use humor and creativity.',
      empathetic: 'Understanding, supportive, and compassionate. Connect emotionally with the audience.',
    };
    lines.push(`Tone Style: ${identity.tone_style.toUpperCase()} - ${toneDescriptions[identity.tone_style] || ''}`);
  }

  if (identity.brand_voice) {
    lines.push('');
    lines.push('Brand Voice Guidelines:');
    lines.push(identity.brand_voice);
  }

  // Personality traits
  if (identity.personality_traits && identity.personality_traits.length > 0) {
    lines.push('');
    lines.push(`Personality Traits: ${identity.personality_traits.join(', ')}`);
    lines.push('Embody these traits in the writing style and word choice.');
  }

  // Content pillars
  if (identity.content_pillars && identity.content_pillars.length > 0) {
    lines.push('');
    lines.push('Content Pillars (key themes to emphasize):');
    identity.content_pillars.forEach((pillar, i) => {
      lines.push(`  ${i + 1}. ${pillar}`);
    });
  }

  lines.push('');
  lines.push('=== END BRAND GUIDELINES ===');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build user context section for adding to user prompts
 * Lighter weight than system prompt, good for follow-up context
 */
export function buildUserContextSection(identity: BrandIdentity | null): string {
  if (!identity) {
    return '';
  }

  const parts: string[] = [];

  if (identity.brand_name) {
    parts.push(`This is for ${identity.brand_name}`);
  }

  if (identity.tone_style) {
    parts.push(`Use a ${identity.tone_style} tone`);
  }

  if (identity.target_audience) {
    parts.push(`targeting ${identity.target_audience}`);
  }

  return parts.length > 0 ? `[BRAND CONTEXT: ${parts.join(', ')}]` : '';
}

/**
 * Build concise tone guidelines for constrained contexts
 */
export function buildToneGuidelines(identity: BrandIdentity | null): string {
  if (!identity) {
    return '';
  }

  const guidelines: string[] = [];

  if (identity.tone_style) {
    guidelines.push(`Tone: ${identity.tone_style}`);
  }

  if (identity.personality_traits && identity.personality_traits.length > 0) {
    guidelines.push(`Style: ${identity.personality_traits.slice(0, 3).join(', ')}`);
  }

  if (identity.brand_voice) {
    // Extract first sentence of brand voice for concise summary
    const firstSentence = identity.brand_voice.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length < 100) {
      guidelines.push(`Voice: ${firstSentence}`);
    }
  }

  return guidelines.join(' | ');
}

/**
 * Get complete brand prompt context for a request
 * Use this in adapters to inject brand identity into prompts
 */
export async function getBrandPromptContext(
  brandId: string,
  campaignId?: string
): Promise<BrandPromptContext> {
  const identity = await getBrandIdentity(brandId, campaignId);

  return {
    systemPromptPrefix: buildSystemPromptPrefix(identity),
    userContextSection: buildUserContextSection(identity),
    toneGuidelines: buildToneGuidelines(identity),
    brandIdentity: identity,
  };
}

/**
 * Enrich an existing prompt with brand context
 * Convenience function for simple prompt enrichment
 */
export async function enrichPromptWithBrandContext(
  prompt: string,
  brandId: string,
  campaignId?: string
): Promise<string> {
  const context = await getBrandPromptContext(brandId, campaignId);
  
  if (!context.userContextSection) {
    return prompt;
  }

  return `${context.userContextSection}\n\n${prompt}`;
}
