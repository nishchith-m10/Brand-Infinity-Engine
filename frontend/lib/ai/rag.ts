import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Lazy initialize OpenAI client
let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('[OpenAI] OPENAI_API_KEY environment variable is required');
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface BrandContext {
  matched_assets: string[];
  brand_voice?: string;
  primary_colors?: string[];
  product_images?: string[];
  logo_url?: string;
  /** Image URLs for vision-enabled AI models */
  image_urls?: Array<{
    url: string;
    type: string;
    file_name: string;
  }>;
  /** Full asset details for advanced processing */
  assets?: Array<{
    id: string;
    file_name: string;
    file_url: string;
    asset_type: string;
    content: string;
    similarity: number;
  }>;
}

export interface RAGSearchOptions {
  /** Filter to specific KB IDs (uses match_kb_assets RPC) */
  kbIds?: string[];
  /** Similarity threshold (default: 0.7) */
  matchThreshold?: number;
  /** Max results (default: 5) */
  matchCount?: number;
}

/**
 * Embed a text prompt using OpenAI embeddings
 * Cost: ~$0.000002 per query
 */
async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Get brand context via RAG (vector search)
 * Supports filtering by specific Knowledge Base IDs
 * Cost: ~$0.000005 per query (negligible)
 */
export async function getBrandContext(
  prompt: string,
  brandId: string,
  options: RAGSearchOptions = {}
): Promise<BrandContext> {
  const { kbIds, matchThreshold = 0.7, matchCount = 5 } = options;

  try {
    // 1. Embed the user's prompt
    const promptEmbedding = await embedText(prompt);

    // 2. Vector search
    const supabase = await createClient();
    let matches: any[] = [];

    if (kbIds && kbIds.length > 0) {
      // Use KB-filtered search (new Phase 6 function)
      const { data, error } = await supabase.rpc('match_kb_assets', {
        query_embedding: promptEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_kb_ids: kbIds,
      });

      if (error) {
        console.error('RAG KB search error:', error);
        return { matched_assets: [] };
      }
      matches = data || [];
    } else {
      // Fallback to brand-wide search (legacy)
      const { data, error } = await supabase.rpc('match_brand_assets', {
        query_embedding: promptEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_brand_id: brandId,
      });

      if (error) {
        console.error('RAG brand search error:', error);
        return { matched_assets: [] };
      }
      matches = data || [];
    }

    // 3. Extract relevant context
    const imageMatches = matches.filter((m: any) => 
      m.file_url && (m.asset_type === 'logo' || m.asset_type === 'product' || m.asset_type === 'color')
    );

    return {
      matched_assets: matches.map((m: any) => m.file_name),
      brand_voice: matches.find((m: any) => m.asset_type === 'guideline')?.metadata?.voice,
      primary_colors: matches.find((m: any) => m.asset_type === 'color')?.metadata?.colors,
      product_images: matches
        .filter((m: any) => m.asset_type === 'product')
        .map((m: any) => m.file_url),
      logo_url: matches.find((m: any) => m.asset_type === 'logo')?.file_url,
      // NEW: Image URLs for vision API
      image_urls: imageMatches.map((m: any) => ({
        url: m.file_url,
        type: m.asset_type,
        file_name: m.file_name,
      })),
      // NEW: Full asset details for advanced processing
      assets: matches.map((m: any) => ({
        id: m.id,
        file_name: m.file_name,
        file_url: m.file_url,
        asset_type: m.asset_type,
        content: m.content,
        similarity: m.similarity,
      })),
    };
  } catch (error) {
    console.error('RAG error:', error);
    return { matched_assets: [] };
  }
}

/**
 * Search specific Knowledge Bases for relevant assets
 * Convenience wrapper for KB-filtered search
 */
export async function searchKnowledgeBases(
  prompt: string,
  kbIds: string[],
  options: Omit<RAGSearchOptions, 'kbIds'> = {}
): Promise<BrandContext> {
  // Use a placeholder brand ID since we're filtering by KBs directly
  return getBrandContext(prompt, '', { ...options, kbIds });
}

/**
 * Enrich a prompt with brand context
 */
export function enrichPromptWithBrandContext(
  prompt: string,
  context: BrandContext
): string {
  const enrichments: string[] = [];

  if (context.primary_colors?.length) {
    enrichments.push(`Use brand colors: ${context.primary_colors.join(', ')}`);
  }

  if (context.brand_voice) {
    enrichments.push(`Tone: ${context.brand_voice}`);
  }

  if (enrichments.length === 0) {
    return prompt;
  }

  return `${prompt}\n\nBRAND CONTEXT:\n${enrichments.join('\n')}`;
}

