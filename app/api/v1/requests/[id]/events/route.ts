// =============================================================================
// GET /api/v1/requests/:id/events - Get Event Timeline
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GetEventsResponse } from '@/types/pipeline';

export async function GET(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();

    // Normalize params: some Next versions provide params as a Promise
    const params = await (context.params as any) as { id: string };
    const requestId = params.id;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // requestId already extracted above

    // Verify request exists
    const { data: contentRequest, error: requestError } = await supabase
      .from('content_requests')
      .select('id')
      .eq('id', requestId)
      .single();

    if (requestError || !contentRequest) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    // Fetch all events for this request
    const { data: events, error: eventsError } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (eventsError) {
      console.error('Failed to fetch events:', eventsError);
      return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 });
    }

    const response: GetEventsResponse = {
      success: true,
      data: events || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in GET /api/v1/requests/:id/events:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
