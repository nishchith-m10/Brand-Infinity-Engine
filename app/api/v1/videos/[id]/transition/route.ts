// =============================================================================
// POST /api/v1/videos/:id/transition - Transition Video Status
// Phase II, Pillar 3: State Machine Enforcement
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { transitionVideoAtomic, isTransactionError } from '@/lib/database/transactions';

/**
 * Valid state transitions for video/generation jobs
 * Enforces a clear workflow from creation to publication
 */
const VALID_VIDEO_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  completed: ['published', 'rejected'],
  published: ['archived'],
  rejected: ['processing'], // allow re-processing
  failed: ['processing'], // allow retry
  archived: []
};

/**
 * Validation schema for video status transitions
 */
const TransitionVideoSchema = z.object({
  targetStatus: z.enum(['pending', 'processing', 'completed', 'published', 'rejected', 'failed', 'archived']),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/v1/videos/:id/transition
 * 
 * Transition a video to a new status with state machine validation.
 * This is the ONLY way to change video status (PATCH no longer allows it).
 * 
 * Special rules:
 * - Videos must be approved before publishing (use /approve endpoint first)
 * - Certain transitions require admin privileges
 * 
 * @param targetStatus - The desired status to transition to
 * @param reason - Optional reason for the transition
 * 
 * @returns Updated video with new status or error with allowed transitions
 */
export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
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

    const params = await (context.params as any) as { id: string };
    const videoId = params.id;
    const body = await request.json();
    
    // Validate input
    const validation = TransitionVideoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: validation.error.flatten(),
          }
        },
        { status: 400 }
      );
    }

    const { targetStatus, reason } = validation.data;

    // Fetch current video
    const { data: video, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('id, status, approval_status, approved_at, approved_by, campaigns!inner(user_id, id)')
      .eq('id', videoId)
      .single();

    if (fetchError || !video) {
      if (fetchError?.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Video not found' } },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch video' } },
        { status: 500 }
      );
    }

    const currentStatus = video.status;

    // Check if already at target status
    if (currentStatus === targetStatus) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_IN_STATUS',
            message: `Video is already in '${targetStatus}' status`,
            details: { currentStatus, targetStatus },
          }
        },
        { status: 400 }
      );
    }

    // Validate transition is allowed
    const allowedTransitions = VALID_VIDEO_TRANSITIONS[currentStatus] || [];
    if (!allowedTransitions.includes(targetStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot transition from '${currentStatus}' to '${targetStatus}'`,
            details: {
              currentStatus,
              targetStatus,
              allowedTransitions,
            }
          }
        },
        { status: 400 }
      );
    }

    // Enforce approval before publishing
    if (targetStatus === 'published') {
      if (video.approval_status !== 'approved' || !video.approved_at) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'APPROVAL_REQUIRED', 
              message: 'Video must be approved before publishing. Use /api/v1/videos/:id/approve endpoint first.',
              details: {
                currentApprovalStatus: video.approval_status,
                requiredApprovalStatus: 'approved',
                hint: 'Call POST /api/v1/videos/:id/approve before attempting to publish'
              }
            } 
          },
          { status: 403 }
        );
      }
    }

    // Perform the transition atomically (Phase III, Pillar 1)
    // Uses PostgreSQL RPC to ensure status update + event logging happen together
    const transitionResult = await transitionVideoAtomic(
      supabase,
      videoId,
      currentStatus,
      targetStatus,
      reason || null,
      user.id
    );

    if (!transitionResult.success) {
      console.error('[VideoTransition] Atomic transition failed:', transitionResult.error);

      // Handle known error codes
      if (isTransactionError(transitionResult, 'STATUS_MISMATCH')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'STATUS_MISMATCH',
              message: 'Status changed by another process',
              details: transitionResult.details,
            }
          },
          { status: 409 } // Conflict
        );
      }

      if (isTransactionError(transitionResult, 'ALREADY_IN_STATUS')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALREADY_IN_STATUS',
              message: transitionResult.error || 'Already in target status',
            }
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: transitionResult.code || 'TRANSITION_FAILED', 
            message: transitionResult.error || 'Failed to transition status' 
          } 
        },
        { status: 500 }
      );
    }

    const updated = transitionResult.data;
    if (!updated) {
      console.error('[VideoTransition] Atomic transition succeeded but no data returned');
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'No data returned' } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: videoId,
        previousStatus: currentStatus,
        currentStatus: targetStatus,
      },
      message: `Successfully transitioned from '${currentStatus}' to '${targetStatus}'`,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[VideoTransition] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
