/**
 * Task Execution API Endpoint
 * POST /api/v1/tasks/execute
 * 
 * Creates and executes a task plan from the conversation session.
 * Returns task plan ID for progress tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createOrchestrator } from '@/lib/agents/orchestrator';
import { createTaskPlanner } from '@/lib/agents/task-planner';
import type { ParsedIntent } from '@/lib/agents/types';

interface ExecuteRequest {
  session_id: string;
  intent?: ParsedIntent;
  campaign_id?: string;
  brand_context?: string;
}

interface ExecuteResponse {
  success: boolean;
  plan_id?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  progress?: {
    percentage: number;
    current_step: string;
    total_steps: number;
    completed_steps: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ExecuteResponse>> {
  try {
    // Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse request
    const body: ExecuteRequest = await request.json();
    const { session_id, intent, campaign_id, brand_context } = body;

    if (!session_id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'session_id required' } },
        { status: 400 }
      );
    }

    // Get session to retrieve intent if not provided
    let parsedIntent = intent;
    if (!parsedIntent) {
      const { data: session, error: sessionError } = await supabase
        .from('conversation_sessions')
        .select('parsed_intent')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
          { status: 404 }
        );
      }

      parsedIntent = session.parsed_intent as ParsedIntent;
    }

    if (!parsedIntent || !parsedIntent.content_type) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Intent not complete - content_type required' } },
        { status: 400 }
      );
    }

    // Create task plan
    const taskPlanner = createTaskPlanner('premium');
    const taskPlan = await taskPlanner.createTaskPlan(parsedIntent);

    // Create orchestrator and start execution (async)
    const orchestrator = createOrchestrator();
    
    // Execute plan asynchronously
    const executionPromise = orchestrator.executePlan({
      plan: taskPlan,
      intent: parsedIntent,
      brandContext: brand_context,
      campaignId: campaign_id,
      conversationId: session_id,
    });

    // Don't await - return immediately with plan ID
    // The orchestrator will update the plan status in the database
    executionPromise.then(result => {
      console.log('[TaskExecute] Plan completed:', taskPlan.id, result.success);
    }).catch(err => {
      console.error('[TaskExecute] Plan failed:', taskPlan.id, err);
    });

    // Return plan ID for progress tracking
    return NextResponse.json({
      success: true,
      plan_id: taskPlan.id,
      status: 'running',
      progress: {
        percentage: 0,
        current_step: taskPlan.tasks[0]?.name || 'Starting',
        total_steps: taskPlan.tasks.length,
        completed_steps: 0,
      },
    });

  } catch (error) {
    console.error('[TaskExecute] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to execute task' } },
      { status: 500 }
    );
  }
}
