// One-off script used by tests to simulate adding a video job
(async () => {
  try {
    // Simulate adding a job
    const jobId = `job-${Math.random().toString(36).slice(2, 10)}`;
    console.log(`Added job id: ${jobId}`);

    // Simulate cleanup
    console.log('Closed queue connections');

    process.exit(0);
  } catch (err) {
    console.error('Failed to add video job', err);
    console.log('Closed queue connections');
    process.exit(1);
  }
})();
