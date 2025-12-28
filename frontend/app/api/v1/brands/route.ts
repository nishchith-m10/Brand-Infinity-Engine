import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/brands
 * List all brands owned by the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch brands where owner_id matches user.id (RLS handles this but explicit filter is safer)
    const { data: brands, error } = await supabase
      .from('brands')
      .select('*')
      .eq('owner_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Brands API] Error:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: brands || [],
      count: brands?.length || 0
    });
  } catch (error: any) {
    console.error('[Brands API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}
