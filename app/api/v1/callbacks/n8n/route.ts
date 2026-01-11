/**
 * n8n Callback API Route
 * POST /api/v1/callbacks/n8n
 * 
 * Receives completion signals from n8n workflows when tasks finish.
 * Validates the callback, updates task status, and triggers orchestrator transitions.
 * 
 * Expected payload from n8n:
 * {
 *   requestId: string,
 *   taskId: string,
 *   executionId: string,
 *   status: 'success' | 'error',
 *   result?: { output_url?: string, metadata?: object },
 *   error?: { code: string, message: string }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { eventLogger } from '@/lib/orchestrator/EventLogger';
import { requestOrchestrator } from '@/lib/orchestrator/RequestOrchestrator';
import crypto from 'crypto';

interface N8nCallbackPayload {
  requestId: string;
  taskId: string;
  executionId: string;
  workflowId?: string;
  status: 'success' | 'error';
  result?: {
    output_url?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export async function POST(request: NextRequest) {
  try {
    // **SECURITY: Verify webhook signature to prevent unauthorized triggers**
    const signature = request.headers.get('x-n8n-signature');
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[n8n Callback] N8N_WEBHOOK_SECRET not configured!');
      return NextResponse.json(
        { success: false, error: 'Webhook authentication not configured' },
        { status: 500 }
      );
    }
    
    if (!signature) {
      console.error('[n8n Callback] Missing signature header');
      return NextResponse.json(
        { success: false, error: 'Missing webhook signature' },
        { status: 401 }
      );
    }
    
    // Read raw body for signature validation
    const rawBody = await request.text();
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      console.error('[n8n Callback] Invalid signature');
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
    
    // Parse callback payload after validation
    const payload = JSON.parse(rawBody) as N8nCallbackPayload;

    // Validate required fields
    if (!payload.requestId || !payload.taskId || !payload.status) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required fields: requestId, taskId, status' 
        },
        { status: 400 }
      );
    }

    console.log('[n8n Callback] Received:', {
      requestId: payload.requestId,
      taskId: payload.taskId,
      status: payload.status,
      executionId: payload.executionId,
    });

    const supabase = await createClient();

    // Verify task exists and is in valid state
    const { data: task, error: taskError } = await supabase
      .from('request_tasks')
      .select('*, request:content_requests!inner(*)')
      .eq('id', payload.taskId)
      .eq('request_id', payload.requestId)
      .single();

    if (taskError || !task) {
      console.error('[n8n Callback] Task not found:', payload.taskId);
      return NextResponse.json(
        { 
          success: false,
          error: 'Task not found or request mismatch' 
        },
        { status: 404 }
      );
    }

    // Only process if task is still in progress
    if (task.status !== 'in_progress') {
      console.warn('[n8n Callback] Task not in progress:', {
        taskId: payload.taskId,
        currentStatus: task.status,
      });
      return NextResponse.json(
        { 
          success: true,
          message: 'Task already completed or cancelled',
          currentStatus: task.status,
        },
        { status: 200 }
      );
    }

    // Process based on callback status
    if (payload.status === 'success') {
      // Store provider metadata if execution ID provided
      if (payload.executionId) {
        await supabase
          .from('provider_metadata')
          .insert({
            request_id: payload.requestId,
            task_id: payload.taskId,
            provider_name: 'n8n',
            provider_job_id: payload.executionId,
            workflow_id: payload.workflowId,
            metadata: {
              workflow_id: payload.workflowId,
              execution_id: payload.executionId,
              completed_at: new Date().toISOString(),
              result: payload.result,
            },
          });
      }

      // Update task to completed
      await supabase
        .from('request_tasks')
        .update({
          status: 'completed',
          output_data: payload.result || {},
          output_url: payload.result?.output_url,
          completed_at: new Date().toISOString(),
        })
        .eq('id', payload.taskId);

      // Log completion event
      await eventLogger.logTaskCompleted(
        payload.requestId,
        payload.taskId,
        task.task_name,
        task.assigned_to,
        JSON.stringify(payload.result || {}),
        0 // Duration unknown from callback
      );

      // Log provider callback event
      await eventLogger.logProviderCallback(
        payload.requestId,
        payload.taskId,
        'n8n',
        payload.executionId || 'unknown',
        'completed',
        payload.result?.output_url
      );

      // Trigger orchestrator to process next steps
      console.log('[n8n Callback] Task completed, resuming orchestrator');
      await requestOrchestrator.resumeRequest(payload.requestId);

      return NextResponse.json({
        success: true,
        message: 'Task completed successfully',
        taskId: payload.taskId,
      });

    } else {
      // Handle error callback
      const errorMessage = payload.error?.message || 'n8n workflow failed';
      const errorCode = payload.error?.code || 'N8N_WORKFLOW_ERROR';

      // Update task to failed
      await supabase
        .from('request_tasks')
        .update({
          status: 'failed',
          error_message: `${errorCode}: ${errorMessage}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', payload.taskId);

      // Log failure event
      await eventLogger.logTaskFailed(
        payload.requestId,
        payload.taskId,
        task.task_name,
        task.assigned_to,
        errorCode,
        errorMessage,
        true // n8n failures are generally retriable
      );

      // Log provider callback event
      await eventLogger.logProviderCallback(
        payload.requestId,
        payload.taskId,
        'n8n',
        payload.executionId || 'unknown',
        'failed'
      );

      // Trigger orchestrator to handle failure
      console.log('[n8n Callback] Task failed, resuming orchestrator');
      await requestOrchestrator.resumeRequest(payload.requestId);

      return NextResponse.json({
        success: true,
        message: 'Task failure recorded',
        taskId: payload.taskId,
      });
    }

  } catch (error) {
    console.error('[n8n Callback] Error processing callback:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/v1/callbacks/n8n',
    methods: ['POST'],
  });
}
