/**
 * Quality Scorer
 * Evaluates content quality across multiple dimensions
 */

const { OpenAI } = require('openai');

class QualityScorer {
    constructor(openaiApiKey) {
        this.openai = new OpenAI({ apiKey: openaiApiKey });
        
        // Quality thresholds
        this.thresholds = {
            excellent: 0.85,
            good: 0.70,
            acceptable: 0.60,
            poor: 0.50
        };
    }

    /**
     * Score content quality across multiple dimensions
     * @param {string} content - Content to score
     * @param {string} contentType - Type: 'script', 'hook', 'brief', 'video_description'
     * @returns {Object} Quality scores and rating
     */
    async scoreContent(content, contentType = 'script') {
        try {
            const scores = await Promise.all([
                this.scoreClarity(content),
                this.scoreEngagement(content, contentType),
                this.scoreCoherence(content),
                this.scoreGrammar(content),
                this.scoreOriginality(content)
            ]);

            const [clarity, engagement, coherence, grammar, originality] = scores;

            // Calculate weighted overall score
            const weights = this.getWeights(contentType);
            const overallScore = 
                (clarity * weights.clarity) +
                (engagement * weights.engagement) +
                (coherence * weights.coherence) +
                (grammar * weights.grammar) +
                (originality * weights.originality);

            const rating = this.getRating(overallScore);
            const suggestions = await this.generateSuggestions(content, {
                clarity,
                engagement,
                coherence,
                grammar,
                originality
            }, contentType);

            return {
                overallScore,
                rating,
                scores: {
                    clarity,
                    engagement,
                    coherence,
                    grammar,
                    originality
                },
                suggestions,
                passesThreshold: overallScore >= this.thresholds.acceptable
            };
        } catch (error) {
            console.error('Quality scoring error:', error);
            throw error;
        }
    }

    /**
     * Score clarity and readability
     * @private
     */
    async scoreClarity(content) {
        const prompt = `Rate the clarity and readability of this content on a scale of 0-1. Consider:
- Clear, concise language
- Easy to understand
- Well-structured sentences
- Appropriate vocabulary

Content:
${content}

Respond with only a number between 0 and 1.`;

        return await this.getAIScore(prompt);
    }

    /**
     * Score engagement potential
     * @private
     */
    async scoreEngagement(content, contentType) {
        const typeContext = {
            'script': 'video script',
            'hook': 'attention-grabbing hook',
            'brief': 'creative brief',
            'video_description': 'video description'
        };

        const prompt = `Rate the engagement potential of this ${typeContext[contentType] || 'content'} on a scale of 0-1. Consider:
- Captures attention
- Maintains interest
- Emotional resonance
- Call-to-action effectiveness

Content:
${content}

Respond with only a number between 0 and 1.`;

        return await this.getAIScore(prompt);
    }

    /**
     * Score logical coherence
     * @private
     */
    async scoreCoherence(content) {
        const prompt = `Rate the logical coherence and flow of this content on a scale of 0-1. Consider:
- Logical progression
- Smooth transitions
- Consistent messaging
- Clear narrative structure

Content:
${content}

Respond with only a number between 0 and 1.`;

        return await this.getAIScore(prompt);
    }

    /**
     * Score grammar and mechanics
     * @private
     */
    async scoreGrammar(content) {
        const prompt = `Rate the grammar, spelling, and mechanics of this content on a scale of 0-1. Consider:
- Correct grammar
- Proper spelling
- Appropriate punctuation
- Professional writing standards

Content:
${content}

Respond with only a number between 0 and 1.`;

        return await this.getAIScore(prompt);
    }

    /**
     * Score originality and creativity
     * @private
     */
    async scoreOriginality(content) {
        const prompt = `Rate the originality and creativity of this content on a scale of 0-1. Consider:
- Unique perspective
- Fresh ideas
- Creative expression
- Avoids clichés

Content:
${content}

Respond with only a number between 0 and 1.`;

        return await this.getAIScore(prompt);
    }

    /**
     * Get AI score from OpenAI
     * @private
     */
    async getAIScore(prompt) {
        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 10
        });

        const score = parseFloat(response.choices[0].message.content.trim());
        return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    }

    /**
     * Generate improvement suggestions
     * @private
     */
    async generateSuggestions(content, scores, contentType) {
        // Find lowest scoring dimensions
        const sortedScores = Object.entries(scores)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 2);

        const focusAreas = sortedScores.map(([dimension]) => dimension).join(' and ');

        const prompt = `This ${contentType} scored lowest in ${focusAreas}. Provide 3 specific, actionable suggestions to improve these areas.

Current Scores:
- Clarity: ${(scores.clarity * 100).toFixed(0)}%
- Engagement: ${(scores.engagement * 100).toFixed(0)}%
- Coherence: ${(scores.coherence * 100).toFixed(0)}%
- Grammar: ${(scores.grammar * 100).toFixed(0)}%
- Originality: ${(scores.originality * 100).toFixed(0)}%

Content:
${content}

Provide exactly 3 numbered, actionable suggestions:`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 400
        });

        const suggestions = response.choices[0].message.content
            .split('\n')
            .filter(line => /^\d+\./.test(line.trim()))
            .map(line => line.replace(/^\d+\.\s*/, '').trim());

        return suggestions.slice(0, 3);
    }

    /**
     * Get quality rating from score
     * @private
     */
    getRating(score) {
        if (score >= this.thresholds.excellent) return 'Excellent';
        if (score >= this.thresholds.good) return 'Good';
        if (score >= this.thresholds.acceptable) return 'Acceptable';
        if (score >= this.thresholds.poor) return 'Poor';
        return 'Needs Improvement';
    }

    /**
     * Get scoring weights based on content type
     * @private
     */
    getWeights(contentType) {
        const weightPresets = {
            'script': {
                clarity: 0.20,
                engagement: 0.30,
                coherence: 0.25,
                grammar: 0.15,
                originality: 0.10
            },
            'hook': {
                clarity: 0.15,
                engagement: 0.45,
                coherence: 0.15,
                grammar: 0.10,
                originality: 0.15
            },
            'brief': {
                clarity: 0.30,
                engagement: 0.15,
                coherence: 0.30,
                grammar: 0.15,
                originality: 0.10
            },
            'video_description': {
                clarity: 0.25,
                engagement: 0.25,
                coherence: 0.20,
                grammar: 0.20,
                originality: 0.10
            }
        };

        return weightPresets[contentType] || weightPresets.script;
    }

    /**
     * Batch score multiple pieces of content
     * @param {Array} contentItems - Array of {content, contentType} objects
     * @returns {Array} Array of quality scores
     */
    async batchScore(contentItems) {
        const results = await Promise.all(
            contentItems.map(item => 
                this.scoreContent(item.content, item.contentType)
            )
        );

        return results;
    }

    /**
     * Compare two pieces of content
     * @param {string} contentA - First content
     * @param {string} contentB - Second content
     * @param {string} contentType - Content type
     * @returns {Object} Comparison result
     */
    async compareContent(contentA, contentB, contentType = 'script') {
        const [scoreA, scoreB] = await Promise.all([
            this.scoreContent(contentA, contentType),
            this.scoreContent(contentB, contentType)
        ]);

        const winner = scoreA.overallScore > scoreB.overallScore ? 'A' : 
                      scoreB.overallScore > scoreA.overallScore ? 'B' : 'Tie';

        return {
            contentA: scoreA,
            contentB: scoreB,
            winner,
            scoreDifference: Math.abs(scoreA.overallScore - scoreB.overallScore)
        };
    }
}

module.exports = QualityScorer;
