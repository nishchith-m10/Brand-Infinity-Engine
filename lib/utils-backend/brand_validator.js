/**
 * Brand Validator
 * Validates content against brand guidelines using vector similarity
 * @module utils/brand_validator
 */

import OpenAI from 'openai';
import { query, searchSimilar, storeEmbedding } from './db.js';

// =============================================================================
// Constants
// =============================================================================

const SIMILARITY_THRESHOLD = parseFloat(process.env.MIN_BRAND_ALIGNMENT_SCORE || '0.75');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-4o-mini';

// =============================================================================
// BrandValidator Class
// =============================================================================

class BrandValidator {
    constructor(config = {}) {
        this.openai = config.openaiClient || new OpenAI({ 
            apiKey: config.openaiApiKey || process.env.OPENAI_API_KEY 
        });
        this.similarityThreshold = config.similarityThreshold || SIMILARITY_THRESHOLD;
        this.mockMode = process.env.OPENAI_API_KEY === 'mock' || config.mockMode || false;
    }

    /**
     * Validate content against brand guidelines
     * @param {string} content - Content to validate
     * @param {number} brandGuidelineId - Brand guideline ID
     * @returns {Object} Validation result with score and suggestions
     */
    async validateContent(content, brandGuidelineId) {
        try {
            // Get brand guideline from database
            const brandGuideline = await this.getBrandGuideline(brandGuidelineId);
            
            if (!brandGuideline) {
                throw new Error(`Brand guideline ${brandGuidelineId} not found`);
            }

            // Generate embedding for content
            const contentEmbedding = await this.generateEmbedding(content);

            // Get brand guideline embedding
            const guidelineEmbedding = await this.getGuidelineEmbedding(brandGuidelineId);

            // Calculate similarity
            const similarity = this.cosineSimilarity(contentEmbedding, guidelineEmbedding);

            // Validate tone
            const toneScore = await this.validateTone(content, brandGuideline.tone);

            // Validate visual style references
            const visualScore = this.validateVisualStyle(content, brandGuideline.visual_style);

            // Calculate overall score
            const overallScore = (similarity * 0.5) + (toneScore * 0.3) + (visualScore * 0.2);

            // Generate suggestions if score is low
            const suggestions = overallScore < this.SIMILARITY_THRESHOLD 
                ? await this.generateSuggestions(content, brandGuideline, overallScore)
                : [];

            return {
                isValid: overallScore >= this.similarityThreshold,
                score: overallScore,
                breakdown: {
                    semanticSimilarity: similarity,
                    toneAlignment: toneScore,
                    visualStyleAlignment: visualScore
                },
                suggestions,
                brandGuideline: {
                    name: brandGuideline.brand_name,
                    tone: brandGuideline.tone,
                    visualStyle: brandGuideline.visual_style
                }
            };
        } catch (error) {
            console.error('Brand validation error:', error);
            throw error;
        }
    }

    /**
     * Generate embedding for text using OpenAI
     * @param {string} text - Text to embed
     * @returns {Promise<number[]>} Embedding vector
     */
    async generateEmbedding(text) {
        if (this.mockMode) {
            // Return mock embedding (1536 dimensions)
            return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
        }

        const response = await this.openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: text
        });
        return response.data[0].embedding;
    }

    /**
     * Get brand guideline from database
     * @param {string|number} brandGuidelineId - Brand guideline ID
     * @returns {Promise<Object|null>} Brand guideline object
     */
    async getBrandGuideline(brandGuidelineId) {
        const result = await query(
            `SELECT id, brand_name, industry, tone, visual_style, target_audience, 
                    core_values, restricted_keywords, color_palette, logo_url, 
                    embedding, created_at, updated_at
             FROM brand_guidelines 
             WHERE id = $1`,
            [brandGuidelineId]
        );
        
        return result.rows[0] || null;
    }

    /**
     * Get or generate guideline embedding
     * @param {string|number} brandGuidelineId - Brand guideline ID
     * @returns {Promise<number[]>} Embedding vector
     */
    async getGuidelineEmbedding(brandGuidelineId) {
        // First try to get existing embedding
        const result = await query(
            `SELECT embedding FROM brand_guidelines WHERE id = $1`,
            [brandGuidelineId]
        );

        if (result.rows[0]?.embedding) {
            // Parse vector from pgvector format
            const embeddingStr = result.rows[0].embedding;
            if (typeof embeddingStr === 'string') {
                return JSON.parse(embeddingStr.replace(/^\[|\]$/g, '').split(',').map(Number));
            }
            return embeddingStr;
        }

        // Generate and store embedding if not exists
        const guideline = await this.getBrandGuideline(brandGuidelineId);
        if (!guideline) {
            throw new Error(`Brand guideline ${brandGuidelineId} not found`);
        }

        // Create text representation for embedding
        const guidelineText = `
            Brand: ${guideline.brand_name}
            Industry: ${guideline.industry}
            Tone: ${guideline.tone}
            Visual Style: ${guideline.visual_style}
            Target Audience: ${guideline.target_audience}
            Core Values: ${JSON.stringify(guideline.core_values)}
        `.trim();

        const embedding = await this.generateEmbedding(guidelineText);
        
        // Store the embedding
        await storeEmbedding('brand_guidelines', brandGuidelineId, embedding, {
            embedded_at: new Date().toISOString()
        });

        return embedding;
    }

    /**
     * Search for similar brand guidelines
     * @param {string} queryText - Text to search for
     * @param {number} limit - Max results
     * @returns {Promise<Array>} Similar guidelines with scores
     */
    async searchSimilarGuidelines(queryText, limit = 5) {
        const embedding = await this.generateEmbedding(queryText);
        return searchSimilar('brand_guidelines', embedding, limit, 0.5);
    }

    /**
     * Validate tone using AI
     * @param {string} content - Content to analyze
     * @param {string} expectedTone - Expected tone
     * @returns {Promise<number>} Tone alignment score (0-1)
     */
    async validateTone(content, expectedTone) {
        if (this.mockMode) {
            return 0.7 + Math.random() * 0.2; // Mock score between 0.7-0.9
        }

        const prompt = `Analyze the tone of this content and rate how well it matches the expected tone on a scale of 0-1.

Expected Tone: ${expectedTone}

Content: ${content}

Respond with only a number between 0 and 1.`;

        const response = await this.openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 10
        });

        const score = parseFloat(response.choices[0].message.content.trim());
        return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    }

    /**
     * Validate visual style references in content
     * @private
     */
    validateVisualStyle(content, expectedStyle) {
        const styleKeywords = expectedStyle.toLowerCase().split(/[\s,]+/);
        const contentLower = content.toLowerCase();
        
        const matches = styleKeywords.filter(keyword => 
            contentLower.includes(keyword)
        ).length;

        return matches / styleKeywords.length;
    }

    /**
     * Generate improvement suggestions
     * @param {string} content - Content to improve
     * @param {Object} brandGuideline - Brand guidelines
     * @param {number} currentScore - Current alignment score
     * @returns {Promise<string[]>} Array of suggestions
     */
    async generateSuggestions(content, brandGuideline, currentScore) {
        if (this.mockMode) {
            return [
                'Adjust tone to be more aligned with brand voice',
                'Include more brand-specific terminology',
                'Ensure visual descriptions match brand style guidelines'
            ];
        }

        const prompt = `This content scored ${(currentScore * 100).toFixed(1)}% for brand alignment. Provide 3 specific suggestions to better align it with the brand guidelines.

Brand Guidelines:
- Tone: ${brandGuideline.tone}
- Visual Style: ${brandGuideline.visual_style}
- Target Audience: ${brandGuideline.target_audience}
- Core Values: ${JSON.stringify(brandGuideline.core_values)}

Content:
${content}

Provide exactly 3 numbered suggestions:`;

        const response = await this.openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 300
        });

        const suggestions = response.choices[0].message.content
            .split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.replace(/^\d+\.\s*/, '').trim());

        return suggestions.slice(0, 3);
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {number[]} vecA - First vector
     * @param {number[]} vecB - Second vector
     * @returns {number} Similarity score (0-1)
     */
    cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
        return similarity;
    }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new BrandValidator instance
 * @param {Object} config - Configuration options
 * @returns {BrandValidator}
 */
export function createBrandValidator(config = {}) {
    return new BrandValidator(config);
}

// =============================================================================
// Exports
// =============================================================================

export { BrandValidator };
export default BrandValidator;
