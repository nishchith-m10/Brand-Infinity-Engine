// =============================================================================
// PROGRESS API - Server-Sent Events (SSE) Endpoint
// GET /api/v1/requests/[id]/progress
// =============================================================================
// Purpose: Stream realtime progress updates to frontend clients

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { progressTracker } from '@/lib/orchestrator/ProgressTracker';

/**
 * GET /api/v1/requests/[id]/progress
 * 
 * Streams progress updates via Server-Sent Events (SSE).
 * 
 * Response format:
 * ```
 * data: {"percentage":25,"completedTasks":1,"totalTasks":4,...}
 * 
 * data: {"percentage":50,"completedTasks":2,"totalTasks":4,...}
 * 
 * : keep-alive
 * ```
 * 
 * Frontend usage:
 * ```
 * const eventSource = new EventSource('/api/v1/requests/[id]/progress');
 * eventSource.onmessage = (e) => {
 *   const progress = JSON.parse(e.data);
 *   console.log(`${progress.percentage}% complete`);
 * };
 * ```
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;

  // Verify user has access to this request
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify request exists and user owns it
  const { data: contentRequest, error: requestError } = await supabase
    .from('content_requests')
    .select('id, user_id, status')
    .eq('id', requestId)
    .single();

  if (requestError || !contentRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }

  if (contentRequest.user_id !== user.id) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE event
      const sendEvent = (data: unknown) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Helper to send keepalive comment
      const sendKeepalive = () => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      };

      // Send initial progress immediately
      try {
        const progress = await progressTracker.getProgress(requestId);
        sendEvent(progress);

        // If request is already complete, close stream
        if (progress.percentage >= 100 || contentRequest.status === 'published' || contentRequest.status === 'cancelled') {
          controller.close();
          return;
        }
      } catch (error) {
        console.error('[Progress API] Error fetching initial progress:', error);
        sendEvent({ error: 'Failed to fetch progress' });
        controller.close();
        return;
      }

      // Poll for updates every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          // Fetch latest progress
          const progress = await progressTracker.getProgress(requestId);
          sendEvent(progress);

          // If complete, stop polling and close stream
          if (progress.percentage >= 100 || contentRequest.status === 'published' || contentRequest.status === 'cancelled') {
            clearInterval(pollInterval);
            clearInterval(keepaliveInterval);
            controller.close();
          }
        } catch (error) {
          console.error('[Progress API] Error in poll interval:', error);
          // Don't close on transient errors - client can reconnect if needed
        }
      }, 2000); // Poll every 2 seconds

      // Send keepalive every 30 seconds to prevent timeout
      const keepaliveInterval = setInterval(() => {
        sendKeepalive();
      }, 30000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(keepaliveInterval);
        controller.close();
      });
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
