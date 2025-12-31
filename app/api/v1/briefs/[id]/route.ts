
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      brief_id: 'mock-brief-1',
      campaign_id: 'mock-campaign-1',
      brand_id: 'mock-brand-1',
      product_category: 'Technology',
      target_demographic: 'Gen Z',
      campaign_objective: 'Brand Awareness',
      budget_tier: 'high',
      creative_concept: 'Future of Tech',
      key_messages: ['Innovation', 'Speed'],
      visual_style: 'Cyberpunk',
      brand_alignment_score: 95,
      approval_status: 'approved',
      created_at: new Date().toISOString(),
    },
  });
}
