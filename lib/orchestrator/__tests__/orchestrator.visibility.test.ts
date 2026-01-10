import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import RequestOrchestrator from '../RequestOrchestrator';
import { metricsCollector } from '../MetricsCollector';

const TEST_USER_ID = 'test-user-orch-visibility';
const TEST_ORG_ID = 'test-org-orch-visibility';

describe('Orchestrator visibility & auto-advance blocking', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let orchestrator: RequestOrchestrator;

  beforeAll(async () => {
    supabase = await createClient();
    orchestrator = new RequestOrchestrator();

    // Cleanup any prior test data
    await supabase.from('request_tasks').delete().like('request_id', `${TEST_ORG_ID}%`);
    await supabase.from('request_events').delete().like('request_id', `${TEST_ORG_ID}%`);
    await supabase.from('content_requests').delete().like('id', `${TEST_ORG_ID}%`);
  });

  afterAll(async () => {
    await supabase.from('request_tasks').delete().like('request_id', `${TEST_ORG_ID}%`);
    await supabase.from('request_events').delete().like('request_id', `${TEST_ORG_ID}%`);
    await supabase.from('content_requests').delete().like('id', `${TEST_ORG_ID}%`);
  });

  it('should block auto-advance to production when draft tasks are missing', async () => {
    const inputData = {
      brand_name: 'Visibility Test Brand',
      creative_brief: 'Visibility test',
      request_type: 'social_media_post',
    };

    // Create a request and force it to DRAFT without creating tasks
    const requestId = await orchestrator.createRequest(TEST_USER_ID, TEST_ORG_ID, inputData);

    // Move request to draft state manually
    await supabase
      .from('content_requests')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    // Ensure no tasks exist for this request
    await supabase.from('request_tasks').delete().eq('request_id', requestId);

    // Run orchestrator - it should log an auto-advance blocked event and NOT move to production
    await orchestrator.processRequest(requestId);

    const { data: request } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    expect(request.status).toBe('draft');

    const { data: events } = await supabase
      .from('request_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    const blocked = events.find((e: any) => e.event_type === 'system_action' && e.description.includes('Auto-advance blocked'));
    expect(blocked).toBeDefined();

    // Metrics: invalid transition counter should not have been incremented for an auto-advance block (it's a blocked advance, not an explicit invalid transition)
    const invalidCountBefore = metricsCollector.getInvalidTransitionCount();
    expect(typeof invalidCountBefore).toBe('number');

    // Trigger an explicit invalid transition attempt (e.g., intake -> production) and assert metric increment
    // Manually try transitioning intake -> production via transitionStatus to simulate an invalid programmatic attempt
    const { data: req } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    // Attempt programmatic invalid transition and catch the thrown error
    let threw = false;
    try {
      // call private method via cast (for test purposes)
      // @ts-ignore
      await orchestrator.transitionStatus(req, 'production');
    } catch (err) {
      threw = true;
    }

    expect(threw).toBe(true);

    const invalidCountAfter = metricsCollector.getInvalidTransitionCount();
    expect(invalidCountAfter).toBe(invalidCountBefore + 1);
  });

  it('should create tasks idempotently when processing concurrently', async () => {
    const inputData = {
      brand_name: 'Concurrency Test Brand',
      creative_brief: 'Concurrency test',
      request_type: 'social_media_post',
    };

    const requestId = await orchestrator.createRequest(TEST_USER_ID, TEST_ORG_ID, inputData);

    // Run two orchestrator runs concurrently to simulate racing intake
    await Promise.all([
      orchestrator.processRequest(requestId),
      orchestrator.processRequest(requestId),
    ]);

    const { data: tasks } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('request_id', requestId)
      .order('sequence_order', { ascending: true });

    expect(tasks).toBeDefined();
    // Ensure there are no duplicate task names
    const taskNames = tasks.map((t: any) => t.task_name);
    const uniqueNames = new Set(taskNames);
    expect(uniqueNames.size).toBe(taskNames.length);
  });
});
