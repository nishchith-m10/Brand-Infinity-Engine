import 'dotenv/config';
import { generateBriefWithAI } from '../src/pillars/strategist/brief_generator.js';

async function run() {
  console.log('== Test brief generation (dry run) ==');
  const sampleContext = {
    campaignRequest: {
      product_category: 'beverage',
      target_demographic: 'young adults 18-25',
      campaign_objective: 'awareness',
      budget_tier: 'standard',
      brand_id: 'test-brand-123',
      platform: 'tiktok'
    },
    trends: [
      { topic: 'short-form dances', source: 'TikTok', engagement_score: 0.8 },
      { topic: 'ASMR unboxing', source: 'Instagram', engagement_score: 0.6 }
    ],
    trendingAudio: ['upbeat-pop-clip'],
    brandGuidelines: {
      brand_profile: {
        brand_name: 'TestBrand',
        tone: 'casual',
        visual_style: 'bold',
        core_values: ['fun', 'energy']
      }
    },
    competitorInsights: {
      top_patterns: [{ pattern: 'user testimonials', effectiveness: 'high' }]
    }
  };

  try {
    const brief = await generateBriefWithAI(sampleContext);
    console.log('Generated brief (or template fallback):\n', JSON.stringify(brief, null, 2));
  } catch (e) {
    console.error('Error running brief generation test:', e.message);
    process.exit(1);
  }
}

run();