import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/user/provider-keys/[id]
 * Delete a provider key for the authenticated user
 */
export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const { id } = resolvedParams;
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }


    // Phase III, Pillar 2: Soft delete for data recovery capability
    // Delete only if belongs to authenticated user (RLS enforced)
    const { error } = await supabase
      .from('user_provider_keys')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null); // Only soft delete if not already deleted

    if (error) {
      console.error('Error soft-deleting provider key:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete provider key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Provider key deleted',
    });
  } catch (error) {
    console.error('Error in DELETE /api/user/provider-keys/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
