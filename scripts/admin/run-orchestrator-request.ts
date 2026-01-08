import 'dotenv/config';

async function main() {
  const requestId = process.argv[2];
  if (!requestId) {
    console.error('Usage: npx tsx scripts/admin/run-orchestrator-request.ts <requestId>');
    process.exit(1);
  }

  try {
    const { requestOrchestrator } = await import('@/lib/orchestrator/RequestOrchestrator');
    console.log('Triggering orchestrator for request', requestId);
    await requestOrchestrator.processRequest(requestId);
    console.log('Orchestrator finished processing request', requestId);
  } catch (err) {
    console.error('Error running orchestrator:', err);
    process.exit(2);
  }
}

main();
