import 'dotenv/config';

async function main() {
  const [,, requestId, taskId, externalJobId = `sim-${Date.now()}`, providerName = 'pollinations-flux'] = process.argv;
  if (!requestId || !taskId) {
    console.error('Usage: npx tsx scripts/admin/simulate-n8n-callback.ts <requestId> <taskId> [externalJobId] [providerName]');
    process.exit(1);
  }

  try {
    const { requestOrchestrator } = await import('@/lib/orchestrator/RequestOrchestrator');
    const { createAdminClient } = await import('@/lib/supabase/admin');

    const supabase = createAdminClient();

    // Load request to get campaign_id and prompt
    const { data: reqRows } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .limit(1)
      .single();

    const campaignId = reqRows?.campaign_id || null;
    const prompt = reqRows?.prompt || null;

    // Insert a generation_jobs row to simulate a provider job
    const genRow = {
      campaign_id: campaignId,
      job_type: 'image',
      status: 'pending',
      model_name: providerName,
      prompt: prompt,
      metadata: { request_id: requestId, request_task_id: taskId },
      created_at: new Date().toISOString(),
    } as any;

    await supabase.from('generation_jobs').insert(genRow);

    // Call orchestrator callback to mark task completed and insert provider_metadata
    await requestOrchestrator.handleCallback(
      taskId,
      'completed',
      `https://example.com/output/${externalJobId}`,
      undefined,
      {
        provider_name: providerName,
        external_job_id: externalJobId,
        cost_incurred: 0,
      }
    );

    console.log('Simulated n8n callback completed for', taskId);
  } catch (err) {
    console.error('Simulation failed:', err);
    process.exit(2);
  }
}

main();
