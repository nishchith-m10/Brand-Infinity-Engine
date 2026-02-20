// One-off script used by tests to simulate adding an embedding job
(async () => {
  try {
    // Simulate adding a job
    const jobId = `job-${Math.random().toString(36).slice(2, 10)}`;
    console.log(`Added job id: ${jobId}`);

    // Simulate cleanup
    console.log('Closed queue connections');

    process.exit(0);
  } catch (err) {
    console.error('Failed to add embedding job', err);
    // Ensure we still close gracefully
    console.log('Closed queue connections');
    process.exit(1);
  }
})();
