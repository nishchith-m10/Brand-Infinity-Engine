/**
 * POST /api/v1/requests/[id]/transition
 * 
 * Dedicated endpoint for status transitions that enforces state machine rules.
 * All status changes should go through this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { stateMachine } from '@/lib/orchestrator/StateMachine';
import { RequestStatus, TaskStatus } from '@/lib/orchestrator/types';
import { logger } from '@/lib/monitoring/logger';
import { transitionRequestAtomic, isTransactionError } from '@/lib/database/transactions';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';

const TransitionSchema = z.object({
  targetStatus: z.enum([
    'intake', 'draft', 'production', 'qa', 'published', 'cancelled'
  ]),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await context.params;
    const requestId = params.id;

    // Authenticate
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    // Parse body
    const body = await request.json();
    const validation = TransitionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR', 
            message: 'Validation failed',
            details: validation.error.issues
          } 
        },
        { status: 400 }
      );
    }

    const { targetStatus, reason } = validation.data;

    // Load current request
    const { data: contentRequest, error: fetchError } = await supabase
      .from('content_requests')
      .select('id, status, title')
      .eq('id', requestId)
      .single();

    if (fetchError || !contentRequest) {
      if (fetchError?.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Failed to load request' } },
        { status: 500 }
      );
    }

    const currentStatus = contentRequest.status as RequestStatus;
    const targetStatusTyped = targetStatus as RequestStatus;

    // Get tasks for validation
    const { data: tasks } = await supabase
      .from('request_tasks')
      .select('agent_role, status, task_name')
      .eq('request_id', requestId);

    const taskArray = (tasks || []).map((t: { agent_role: string; status: string; task_name: string }) => ({
      agent_role: t.agent_role,
      status: t.status as TaskStatus,
      task_name: t.task_name,
    }));

    // Validate transition using StateMachine
    const validationResult = stateMachine.validateTransition(
      currentStatus,
      targetStatusTyped,
      taskArray
    );

    if (!validationResult.success) {
      logger.warn('RequestTransition', 'Invalid transition attempted', {
        requestId,
        from: currentStatus,
        to: targetStatus,
        error: validationResult.error,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: validationResult.error || `Cannot transition from ${currentStatus} to ${targetStatus}`,
            details: {
              currentStatus,
              requestedStatus: targetStatus,
              allowedTransitions: stateMachine.getAllowedTransitions(currentStatus),
            }
          }
        },
        { status: 400 }
      );
    }

    // Perform the transition atomically (Phase III, Pillar 1)
    // Uses PostgreSQL RPC to ensure status update + event logging happen together
    const transitionResult = await transitionRequestAtomic(
      supabase,
      requestId,
      currentStatus,
      targetStatusTyped,
      reason || null,
      user.id
    );

    if (!transitionResult.success) {
      logger.error('RequestTransition', 'Atomic transition failed', {
        requestId,
        from: currentStatus,
        to: targetStatus,
        error: transitionResult.error,
        code: transitionResult.code,
      });

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
      logger.error('RequestTransition', 'Atomic transition succeeded but no data returned', { requestId });
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'No data returned' } },
        { status: 500 }
      );
    }

    logger.info('RequestTransition', 'Status transition successful', {
      requestId,
      from: currentStatus,
      to: targetStatus,
      userId: user.id,
    });

    // Trigger orchestrator to process next steps if applicable
    // Don't await - let it run asynchronously
    if (!stateMachine.isTerminalStatus(targetStatusTyped)) {
      requestOrchestrator.processRequest(requestId).catch((error) => {
        logger.error('RequestTransition', 'Failed to trigger orchestrator', {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: requestId,
        previousStatus: currentStatus,
        currentStatus: targetStatus,
        title: updated.title,
      },
      message: `Transitioned from ${currentStatus} to ${targetStatus}`,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    logger.error('RequestTransition', 'Unexpected error', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
