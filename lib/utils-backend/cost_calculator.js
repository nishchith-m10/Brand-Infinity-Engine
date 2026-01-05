/**
 * Cost Calculator
 * Tracks and calculates costs across all AI API calls
 */

class CostCalculator {
    constructor() {
        // Pricing per 1M tokens (as of 2024 - update regularly)
        this.pricing = {
            openai: {
                'gpt-4o': { input: 2.50, output: 10.00 },
                'gpt-4o-mini': { input: 0.150, output: 0.600 },
                'gpt-4-turbo': { input: 10.00, output: 30.00 },
                'text-embedding-3-small': { input: 0.020, output: 0 },
                'text-embedding-3-large': { input: 0.130, output: 0 },
                'whisper-1': { perMinute: 0.006 },
                'tts-1': { per1MChars: 15.00 },
                'tts-1-hd': { per1MChars: 30.00 },
                'dall-e-3': { perImage: 0.040 } // standard quality
            },
            anthropic: {
                'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
                'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
                'claude-3-opus-20240229': { input: 15.00, output: 75.00 }
            },
            deepseek: {
                'deepseek-chat': { input: 0.14, output: 0.28 },
                'deepseek-reasoner': { input: 0.55, output: 2.19 }
            },
            elevenlabs: {
                'eleven_multilingual_v2': { per1MChars: 30.00 },
                'eleven_turbo_v2_5': { per1MChars: 30.00 }
            },
            // Video generation (approximate - pricing varies)
            video: {
                'sora': { perSecond: 0.50 }, // Estimated
                'veo3': { perSecond: 0.40 }, // Estimated
                'seedream': { perSecond: 0.30 }, // Estimated
                'nano-b': { perSecond: 0.25 } // Estimated
            }
        };
    }

    /**
     * Calculate cost for text generation
     * @param {string} provider - AI provider (openai, anthropic, deepseek)
     * @param {string} model - Model name
     * @param {number} inputTokens - Number of input tokens
     * @param {number} outputTokens - Number of output tokens
     * @returns {number} Cost in USD
     */
    calculateTextCost(provider, model, inputTokens, outputTokens) {
        const modelPricing = this.pricing[provider]?.[model];
        
        if (!modelPricing) {
            console.warn(`No pricing found for ${provider}/${model}`);
            return 0;
        }

        const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
        const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

        return inputCost + outputCost;
    }

    /**
     * Calculate cost for embedding generation
     * @param {string} provider - AI provider
     * @param {string} model - Model name
     * @param {number} tokens - Number of tokens
     * @returns {number} Cost in USD
     */
    calculateEmbeddingCost(provider, model, tokens) {
        const modelPricing = this.pricing[provider]?.[model];
        
        if (!modelPricing) {
            console.warn(`No pricing found for ${provider}/${model}`);
            return 0;
        }

        return (tokens / 1_000_000) * modelPricing.input;
    }

    /**
     * Calculate cost for TTS generation
     * @param {string} provider - AI provider
     * @param {string} model - Model name
     * @param {number} characters - Number of characters
     * @returns {number} Cost in USD
     */
    calculateTTSCost(provider, model, characters) {
        const modelPricing = this.pricing[provider]?.[model];
        
        if (!modelPricing) {
            console.warn(`No pricing found for ${provider}/${model}`);
            return 0;
        }

        return (characters / 1_000_000) * modelPricing.per1MChars;
    }

    /**
     * Calculate cost for video generation
     * @param {string} model - Model name (sora, veo3, etc.)
     * @param {number} durationSeconds - Video duration in seconds
     * @returns {number} Cost in USD
     */
    calculateVideoCost(model, durationSeconds) {
        const modelPricing = this.pricing.video[model];
        
        if (!modelPricing) {
            console.warn(`No pricing found for video model: ${model}`);
            return 0;
        }

        return durationSeconds * modelPricing.perSecond;
    }

    /**
     * Calculate cost for audio transcription
     * @param {number} durationMinutes - Audio duration in minutes
     * @returns {number} Cost in USD
     */
    calculateTranscriptionCost(durationMinutes) {
        const pricing = this.pricing.openai['whisper-1'];
        return durationMinutes * pricing.perMinute;
    }

    /**
     * Calculate cost for image generation
     * @param {string} model - Model name
     * @param {number} count - Number of images
     * @returns {number} Cost in USD
     */
    calculateImageCost(model, count) {
        const modelPricing = this.pricing.openai[model];
        
        if (!modelPricing) {
            console.warn(`No pricing found for image model: ${model}`);
            return 0;
        }

        return count * modelPricing.perImage;
    }

    /**
     * Calculate total cost for a workflow execution
     * @param {Array} operations - Array of operation objects
     * @returns {Object} Cost breakdown
     */
    calculateWorkflowCost(operations) {
        let totalCost = 0;
        const breakdown = {
            text: 0,
            embedding: 0,
            tts: 0,
            video: 0,
            transcription: 0,
            image: 0
        };

        for (const op of operations) {
            let cost = 0;

            switch (op.type) {
                case 'text':
                    cost = this.calculateTextCost(op.provider, op.model, op.inputTokens, op.outputTokens);
                    breakdown.text += cost;
                    break;

                case 'embedding':
                    cost = this.calculateEmbeddingCost(op.provider, op.model, op.tokens);
                    breakdown.embedding += cost;
                    break;

                case 'tts':
                    cost = this.calculateTTSCost(op.provider, op.model, op.characters);
                    breakdown.tts += cost;
                    break;

                case 'video':
                    cost = this.calculateVideoCost(op.model, op.durationSeconds);
                    breakdown.video += cost;
                    break;

                case 'transcription':
                    cost = this.calculateTranscriptionCost(op.durationMinutes);
                    breakdown.transcription += cost;
                    break;

                case 'image':
                    cost = this.calculateImageCost(op.model, op.count);
                    breakdown.image += cost;
                    break;

                default:
                    console.warn(`Unknown operation type: ${op.type}`);
            }

            totalCost += cost;
        }

        return {
            total: totalCost,
            breakdown,
            currency: 'USD'
        };
    }

    /**
     * Format cost for display
     * @param {number} cost - Cost in USD
     * @returns {string} Formatted cost string
     */
    formatCost(cost) {
        return `$${cost.toFixed(4)}`;
    }

    /**
     * Get pricing info for a specific model
     * @param {string} provider - AI provider
     * @param {string} model - Model name
     * @returns {Object} Pricing information
     */
    getPricing(provider, model) {
        return this.pricing[provider]?.[model] || null;
    }

    /**
     * Update pricing (for when providers change their rates)
     * @param {string} provider - AI provider
     * @param {string} model - Model name
     * @param {Object} pricing - New pricing object
     */
    updatePricing(provider, model, pricing) {
        if (!this.pricing[provider]) {
            this.pricing[provider] = {};
        }
        this.pricing[provider][model] = pricing;
    }
}

module.exports = CostCalculator;
