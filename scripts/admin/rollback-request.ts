#!/usr/bin/env ts-node
import { createAdminClient } from '../../lib/supabase/admin';

// CLI: ts-node scripts/admin/rollback-request.ts <REQUEST_ID> "<reason>"

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: rollback-request.ts <REQUEST_ID> "reason"');
    process.exit(1);
  }

  const requestId = args[0];
  const reason = args[1] || 'manual rollback by operator';

  const supabase = createAdminClient();

  try {
    // Update request status to draft
    const { error: updateError } = await supabase
      .from('content_requests')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    // Insert an audit event
    const event = {
      request_id: requestId,
      event_type: 'system_action',
      description: 'Rollback to draft by operator',
      metadata: { reason },
      actor: 'system:engineer',
      created_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase.from('request_events').insert(event);
    if (insertError) {
      throw insertError;
    }

    console.log(`Successfully rolled back request ${requestId} to draft and logged event.`);
  } catch (err) {
    console.error('Rollback failed:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});