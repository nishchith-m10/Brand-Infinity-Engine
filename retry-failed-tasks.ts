
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { RequestOrchestrator } from './lib/orchestrator/RequestOrchestrator';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const REQUEST_ID = '8e4be8a8-d392-43d9-a9e5-3d7607c97619';

async function retryFailed() {
  console.log(`Checking for failed tasks in request ${REQUEST_ID}...`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: tasks, error } = await supabase
    .from('request_tasks')
    .select('*')
    .eq('request_id', REQUEST_ID)
    .eq('status', 'failed');
    
  if (error) {
    console.error('Error fetching tasks:', error);
    return;
  }

  if (!tasks || tasks.length === 0) {
     console.log('No failed tasks found.');
     return;
  }
  
  const orchestrator = new RequestOrchestrator();

  for (const task of tasks) {
    console.log(`Found failed task: ${task.task_name} (${task.agent_role})`);
    console.log(`Error: ${task.error_message}`);
    console.log(`Retrying task ${task.id}...`);
    
    try {
      // Force reset retry count to allow manual retry
      await supabase
        .from('request_tasks')
        .update({ retry_count: 0 })
        .eq('id', task.id);
        
      await orchestrator.retryTask(task.id);
      console.log(`Successfully initiated retry for task ${task.id}`);
    } catch (err) {
      console.error(`Failed to retry task ${task.id}:`, err);
    }
  }
}

retryFailed();
