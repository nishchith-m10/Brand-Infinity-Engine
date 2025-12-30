/**
 * Task Progress API Endpoint
 * GET /api/v1/tasks/[id]/progress
 * 
 * Returns current progress of a task plan execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ProgressResponse {
  success: boolean;
  plan_id?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: {
    percentage: number;
    current_task?: string;
    total_tasks: number;
    completed_tasks: number;
  };
  results?: unknown[];
  errors?: string[];
  error?: {
    code: string;
    message: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ProgressResponse>> {
  try {
    const { id } = await params;
    
    // Authenticate
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get task plan from database
    const { data: plan, error: planError } = await supabase
      .from('task_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Task plan not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan_id: plan.id,
      status: plan.status,
      progress: {
        percentage: plan.progress_percentage || 0,
        current_task: plan.current_task_id,
        total_tasks: plan.total_tasks || 0,
        completed_tasks: plan.completed_tasks || 0,
      },
      results: plan.results || [],
      errors: plan.errors || [],
    });

  } catch (error) {
    console.error('[TaskProgress] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get progress' } },
      { status: 500 }
    );
  }
}
