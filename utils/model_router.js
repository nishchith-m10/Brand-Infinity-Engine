/**
 * Model Router
 * Intelligently routes requests to the best AI model based on task complexity,
 * cost constraints, and performance requirements
 */

class ModelRouter {
    constructor() {
        // Model capabilities matrix
        this.models = {
            // Text Generation
            text: {
                'gpt-4o': {
                    provider: 'openai',
                    capability: 'excellent',
                    speed: 'fast',
                    cost: 'high',
                    maxTokens: 128000,
                    bestFor: ['complex reasoning', 'long context', 'creative writing']
                },
                'gpt-4o-mini': {
                    provider: 'openai',
                    capability: 'good',
                    speed: 'very fast',
                    cost: 'low',
                    maxTokens: 128000,
                    bestFor: ['simple tasks', 'classification', 'extraction']
                },
                'claude-3-5-sonnet-20241022': {
                    provider: 'anthropic',
                    capability: 'excellent',
                    speed: 'fast',
                    cost: 'medium',
                    maxTokens: 200000,
                    bestFor: ['analysis', 'research', 'nuanced writing']
                },
                'claude-3-5-haiku-20241022': {
                    provider: 'anthropic',
                    capability: 'good',
                    speed: 'very fast',
                    cost: 'low',
                    maxTokens: 200000,
                    bestFor: ['fast responses', 'simple generation']
                },
                'deepseek-chat': {
                    provider: 'deepseek',
                    capability: 'good',
                    speed: 'fast',
                    cost: 'very low',
                    maxTokens: 64000,
                    bestFor: ['cost-effective generation', 'bulk processing']
                },
                'deepseek-reasoner': {
                    provider: 'deepseek',
                    capability: 'excellent',
                    speed: 'medium',
                    cost: 'medium',
                    maxTokens: 64000,
                    bestFor: ['complex reasoning', 'logical tasks']
                }
            },
            // Video Generation
            video: {
                'sora': {
                    provider: 'openai',
                    capability: 'excellent',
                    quality: 'cinematic',
                    speed: 'slow',
                    cost: 'very high',
                    maxDuration: 60,
                    bestFor: ['high-quality ads', 'cinematic content']
                },
                'veo3': {
                    provider: 'google',
                    capability: 'excellent',
                    quality: 'high',
                    speed: 'medium',
                    cost: 'high',
                    maxDuration: 120,
                    bestFor: ['realistic scenes', 'product demos']
                },
                'seedream': {
                    provider: 'seedream',
                    capability: 'good',
                    quality: 'medium',
                    speed: 'fast',
                    cost: 'medium',
                    maxDuration: 30,
                    bestFor: ['quick iterations', 'concept testing']
                },
                'nano-b': {
                    provider: 'nano',
                    capability: 'good',
                    quality: 'medium',
                    speed: 'very fast',
                    cost: 'low',
                    maxDuration: 20,
                    bestFor: ['rapid prototyping', 'social media shorts']
                }
            },
            // TTS
            tts: {
                'tts-1-hd': {
                    provider: 'openai',
                    quality: 'excellent',
                    speed: 'fast',
                    cost: 'medium',
                    bestFor: ['high-quality voiceovers', 'ads']
                },
                'tts-1': {
                    provider: 'openai',
                    quality: 'good',
                    speed: 'very fast',
                    cost: 'low',
                    bestFor: ['draft voiceovers', 'previews']
                },
                'eleven_multilingual_v2': {
                    provider: 'elevenlabs',
                    quality: 'excellent',
                    speed: 'medium',
                    cost: 'medium',
                    bestFor: ['natural speech', 'character voices']
                },
                'eleven_turbo_v2_5': {
                    provider: 'elevenlabs',
                    quality: 'good',
                    speed: 'very fast',
                    cost: 'medium',
                    bestFor: ['fast generation', 'bulk content']
                }
            }
        };
    }

    /**
     * Select the best model for a text generation task
     * @param {Object} options - Task requirements
     * @returns {Object} Selected model info
     */
    selectTextModel(options = {}) {
        const {
            complexity = 'medium',    // low, medium, high
            budget = 'medium',         // low, medium, high, unlimited
            priority = 'balanced',     // speed, cost, quality, balanced
            contextLength = 0,         // Number of tokens in context
            task = 'general'          // general, reasoning, creative, extraction
        } = options;

        const candidates = this.models.text;
        let scores = {};

        for (const [modelName, model] of Object.entries(candidates)) {
            let score = 0;

            // Context length check
            if (contextLength > model.maxTokens) {
                continue; // Skip if context is too long
            }

            // Complexity matching
            if (complexity === 'high' && model.capability === 'excellent') score += 3;
            if (complexity === 'medium' && model.capability === 'good') score += 2;
            if (complexity === 'low') score += 1;

            // Budget considerations
            if (budget === 'low' && model.cost === 'low') score += 3;
            if (budget === 'low' && model.cost === 'very low') score += 4;
            if (budget === 'medium' && (model.cost === 'medium' || model.cost === 'low')) score += 2;

            // Priority matching
            if (priority === 'speed' && (model.speed === 'fast' || model.speed === 'very fast')) score += 3;
            if (priority === 'cost' && (model.cost === 'low' || model.cost === 'very low')) score += 3;
            if (priority === 'quality' && model.capability === 'excellent') score += 3;
            if (priority === 'balanced') score += 2;

            // Task-specific bonuses
            if (model.bestFor.includes(task) || model.bestFor.some(bf => bf.includes(task))) {
                score += 2;
            }

            scores[modelName] = score;
        }

        // Select highest scoring model
        const selected = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)[0];

        if (!selected) {
            // Fallback to gpt-4o-mini
            return {
                model: 'gpt-4o-mini',
                ...candidates['gpt-4o-mini'],
                reason: 'Fallback to default model'
            };
        }

        return {
            model: selected[0],
            ...candidates[selected[0]],
            score: selected[1],
            reason: this.explainSelection(selected[0], options)
        };
    }

    /**
     * Select the best model for video generation
     * @param {Object} options - Task requirements
     * @returns {Object} Selected model info
     */
    selectVideoModel(options = {}) {
        const {
            quality = 'high',         // low, medium, high, cinematic
            budget = 'medium',         // low, medium, high, unlimited
            duration = 15,             // Video duration in seconds
            priority = 'quality'       // speed, cost, quality
        } = options;

        const candidates = this.models.video;
        let scores = {};

        for (const [modelName, model] of Object.entries(candidates)) {
            let score = 0;

            // Duration check
            if (duration > model.maxDuration) {
                continue; // Skip if duration is too long
            }

            // Quality matching
            if (quality === 'cinematic' && model.quality === 'cinematic') score += 4;
            if (quality === 'high' && (model.quality === 'high' || model.quality === 'cinematic')) score += 3;
            if (quality === 'medium' && model.quality === 'medium') score += 2;

            // Budget considerations
            if (budget === 'low' && model.cost === 'low') score += 3;
            if (budget === 'medium' && (model.cost === 'medium' || model.cost === 'low')) score += 2;
            if (budget === 'high' || budget === 'unlimited') score += 1;

            // Priority matching
            if (priority === 'speed' && (model.speed === 'fast' || model.speed === 'very fast')) score += 3;
            if (priority === 'cost' && (model.cost === 'low' || model.cost === 'medium')) score += 3;
            if (priority === 'quality' && model.quality === 'cinematic') score += 3;

            scores[modelName] = score;
        }

        const selected = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)[0];

        if (!selected) {
            // Fallback
            return {
                model: 'nano-b',
                ...candidates['nano-b'],
                reason: 'Fallback to budget-friendly model'
            };
        }

        return {
            model: selected[0],
            ...candidates[selected[0]],
            score: selected[1],
            reason: this.explainSelection(selected[0], options, 'video')
        };
    }

    /**
     * Select the best TTS model
     * @param {Object} options - Task requirements
     * @returns {Object} Selected model info
     */
    selectTTSModel(options = {}) {
        const {
            quality = 'high',
            budget = 'medium',
            priority = 'quality',
            characterCount = 0
        } = options;

        const candidates = this.models.tts;
        let scores = {};

        for (const [modelName, model] of Object.entries(candidates)) {
            let score = 0;

            // Quality matching
            if (quality === 'excellent' && model.quality === 'excellent') score += 3;
            if (quality === 'high' && (model.quality === 'excellent' || model.quality === 'good')) score += 2;

            // Budget considerations
            if (budget === 'low' && model.cost === 'low') score += 3;
            if (budget === 'medium' && (model.cost === 'medium' || model.cost === 'low')) score += 2;

            // Priority matching
            if (priority === 'speed' && model.speed === 'very fast') score += 3;
            if (priority === 'quality' && model.quality === 'excellent') score += 3;

            scores[modelName] = score;
        }

        const selected = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)[0];

        return {
            model: selected[0],
            ...candidates[selected[0]],
            score: selected[1],
            reason: this.explainSelection(selected[0], options, 'tts')
        };
    }

    /**
     * Explain why a model was selected
     * @private
     */
    explainSelection(modelName, options, type = 'text') {
        const model = this.models[type][modelName];
        const reasons = [];

        if (options.complexity === 'high' && model.capability === 'excellent') {
            reasons.push('excellent capability for complex tasks');
        }
        if (options.budget === 'low' && (model.cost === 'low' || model.cost === 'very low')) {
            reasons.push('cost-effective');
        }
        if (options.priority === 'speed' && (model.speed === 'fast' || model.speed === 'very fast')) {
            reasons.push('fast generation');
        }
        if (options.priority === 'quality' && (model.capability === 'excellent' || model.quality === 'excellent')) {
            reasons.push('high quality output');
        }

        return reasons.length > 0 
            ? `Selected for ${reasons.join(', ')}`
            : 'Best overall match for requirements';
    }

    /**
     * Get model info by name
     * @param {string} modelName - Name of the model
     * @param {string} type - Type: text, video, tts
     * @returns {Object} Model information
     */
    getModelInfo(modelName, type = 'text') {
        return this.models[type]?.[modelName] || null;
    }
}

export default ModelRouter;
