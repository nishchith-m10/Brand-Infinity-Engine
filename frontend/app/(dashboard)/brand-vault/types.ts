export interface BrandAsset {
  id: string;
  brand_id: string;
  knowledge_base_id: string | null;
  asset_type: 'logo' | 'product' | 'guideline' | 'color' | 'font' | 'other';
  file_url: string;
  file_name: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface BrandIdentity {
  // Core Identity
  brandName: string;
  tagline: string;
  industry: string;
  
  // Voice & Tone
  toneStyle: 'professional' | 'casual' | 'playful' | 'authoritative' | 'friendly' | 'luxurious';
  communicationStyle: 'formal' | 'conversational' | 'educational' | 'inspirational';
  brandVoice: string;
  
  // Personality Traits (select up to 5)
  personalityTraits: string[];
  
  // Target Audience
  targetAudience: string;
  audienceAgeRange: string;
  audiencePainPoints: string;
  
  // Visual Identity
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  
  // Content Strategy
  contentPillars: string[];
  keyMessages: string;
  avoidTopics: string;
  
  // Competitors & Positioning
  competitors: string;
  uniqueValue: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_core: boolean;
  is_default: boolean;
  asset_count: number;
}

export interface AssetTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}

export interface ToneStyle {
  value: BrandIdentity['toneStyle'];
  label: string;
  desc: string;
}

export interface CommunicationStyle {
  value: BrandIdentity['communicationStyle'];
  label: string;
  desc: string;
}

export interface SetupStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export type TabType = 'assets' | 'identity' | 'kbs';
export type AssetCategory = 'all' | BrandAsset['asset_type'];
export type ActionLoadingType = 'toggle' | 'delete';
