// =============================================================================
// POST /api/v1/admin/undelete - Undelete (Restore) Soft-Deleted Records
// Phase III, Pillar 2: Admin capability for data recovery
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const UndeleteRequestSchema = z.object({
  table_name: z.enum([
    'content_requests',
    'request_tasks',
    'request_events',
    'scripts',
    'creative_briefs',
    'user_provider_keys',
    'conversation_sessions',
    'conversation_messages',
    'campaigns',
    'videos',
    'knowledge_bases',
    'brand_knowledge_base',
  ]),
  id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validation = UndeleteRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validation.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { table_name, id } = validation.data;

    // Verify record exists and is soft-deleted
    const { data: existingRecord, error: fetchError } = await supabase
      .from(table_name as any)
      .select('id, deleted_at')
      .eq('id', id)
      .single();

    if (fetchError || !existingRecord) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Record not found in ${table_name}`,
          },
        },
        { status: 404 }
      );
    }

    if (!existingRecord.deleted_at) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_DELETED',
            message: 'Record is not soft-deleted',
          },
        },
        { status: 400 }
      );
    }

    // Perform undelete by clearing deleted_at
    const { data: restoredRecord, error: undeleteError } = await supabase
      .from(table_name as any)
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (undeleteError) {
      console.error('Failed to undelete record:', undeleteError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNDELETE_FAILED',
            message: 'Failed to restore record',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        table_name,
        id,
        restored_at: new Date().toISOString(),
        record: restoredRecord,
      },
      message: `Record successfully restored from ${table_name}`,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/admin/undelete:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
