import 'dotenv/config';

async function main() {
  const [,, requestId, taskId] = process.argv;
  if (!requestId || !taskId) {
    console.error('Usage: npx tsx scripts/admin/run-task.ts <requestId> <taskId>');
    process.exit(1);
  }

  try {
    const { agentRunner } = await import('@/lib/orchestrator/AgentRunner');
    const { createAdminClient } = await import('@/lib/supabase/admin');

    const supabase = createAdminClient();

    const { data: request } = await supabase
      .from('content_requests')
      .select('*')
      .eq('id', requestId)
      .limit(1)
      .single();

    const { data: task } = await supabase
      .from('request_tasks')
      .select('*')
      .eq('id', taskId)
      .limit(1)
      .single();

    if (!request || !task) {
      console.error('Request or task not found');
      process.exit(2);
    }

    const result = await agentRunner.runTask(request as any, task as any);
    console.log('AgentRunner result:', result);
  } catch (err) {
    console.error('Failed to run task:', err);
    process.exit(3);
  }
}

main();
