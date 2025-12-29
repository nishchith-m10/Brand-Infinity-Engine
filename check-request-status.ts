
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const REQUEST_ID = '8e4be8a8-d392-43d9-a9e5-3d7607c97619';

async function checkStatus() {
  console.log(`\n=== Checking Request ${REQUEST_ID} ===\n`);

  // 1. Get Request Details
  const { data: request, error: reqError } = await supabase
    .from('content_requests')
    .select('*')
    .eq('id', REQUEST_ID)
    .single();

  if (reqError) {
    console.error('Error fetching request:', reqError);
    return;
  }

  console.log(`Status: ${request.status.toUpperCase()}`);
  console.log(`Title: ${request.title}`);
  console.log(`Type: ${request.request_type}`);
  console.log(`Created: ${new Date(request.created_at).toLocaleTimeString()}`);
  console.log('----------------------------------------');

  // 2. Get Tasks
  const { data: tasks, error: taskError } = await supabase
    .from('request_tasks')
    .select('*')
    .eq('request_id', REQUEST_ID)
    .order('sequence_order', { ascending: true });

  if (taskError) {
    console.error('Error fetching tasks:', taskError);
    return;
  }

  console.log('\n=== TASK PIPELINE ===');
  tasks.forEach(task => {
    let statusIcon = '⬜️';
    if (task.status === 'completed') statusIcon = '✅';
    if (task.status === 'in_progress') statusIcon = '🔄';
    if (task.status === 'failed') statusIcon = '❌';
    if (task.status === 'waiting') statusIcon = '⏳';

    console.log(`${statusIcon} [${task.sequence_order}] ${task.type} (${task.status})`);
    if (task.error_message) {
      console.log(`   ERROR: ${task.error_message}`);
    }
    if (task.output_data) {
       // Peek at output
       const out = JSON.stringify(task.output_data);
       if (out.length > 100) console.log(`   Output: ${out.substring(0, 100)}...`);
       else console.log(`   Output: ${out}`);
    }
  });
  console.log('----------------------------------------');
}

checkStatus();
