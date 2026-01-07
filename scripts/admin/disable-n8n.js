#!/usr/bin/env node

/**
 * Emergency n8n Disable Script
 *
 * Purpose:
 *   Immediately disable n8n integration without restarting the application
 *   by forcing the circuit breaker to OPEN state.
 *
 * Usage:
 *   node scripts/admin/disable-n8n.js [--duration-minutes=<mins>]
 *
 * Options:
 *   --duration-minutes: How long to keep circuit breaker open (default: 60)
 *   --enable: Re-enable n8n by closing the circuit breaker
 *
 * Examples:
 *   # Disable n8n for 60 minutes (default)
 *   node scripts/admin/disable-n8n.js
 *
 *   # Disable n8n for 2 hours
 *   node scripts/admin/disable-n8n.js --duration-minutes=120
 *
 *   # Re-enable n8n
 *   node scripts/admin/disable-n8n.js --enable
 *
 * Requirements:
 *   - Must be run from project root
 *   - Requires Redis connection (REDIS_URL)
 *
 * Notes:
 *   - This is a temporary solution; for permanent disable, set N8N_ENABLED=false
 *   - Circuit breaker will auto-recover after duration expires
 *   - Use this for emergency rollback (< 5 minute response time)
 */

const args = process.argv.slice(2);

// Parse arguments
const durationMinutes = parseInt(
  args.find((arg) => arg.startsWith('--duration-minutes='))?.split('=')[1] || '60',
  10
);

const enableMode = args.includes('--enable');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

console.log(`${colors.blue}╔══════════════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.blue}║          n8n Emergency Disable/Enable Script                    ║${colors.reset}`);
console.log(`${colors.blue}╚══════════════════════════════════════════════════════════════════╝${colors.reset}`);
console.log('');

async function main() {
  try {
    // Dynamic import to avoid ESM/CommonJS issues
    const { circuitBreakers } = await import('../../lib/orchestrator/CircuitBreaker.js');

    if (enableMode) {
      // Re-enable n8n
      console.log(`${colors.yellow}[Action]${colors.reset} Re-enabling n8n integration...`);

      // Check current state
      const beforeStats = circuitBreakers.n8n.getStats();
      console.log(`${colors.blue}[Before]${colors.reset} Circuit Breaker State:`, {
        state: beforeStats.state,
        failures: beforeStats.failures,
      });

      // Reset circuit breaker
      circuitBreakers.n8n.reset();

      // Verify state
      const afterStats = circuitBreakers.n8n.getStats();
      console.log(`${colors.green}[After]${colors.reset} Circuit Breaker State:`, {
        state: afterStats.state,
        failures: afterStats.failures,
      });

      if (afterStats.state === 'CLOSED') {
        console.log('');
        console.log(`${colors.green}✓ n8n integration re-enabled successfully${colors.reset}`);
        console.log('');
        console.log(`${colors.yellow}Next Steps:${colors.reset}`);
        console.log('  1. Monitor metrics: redis-cli HGETALL metrics:n8n-dispatch:counts');
        console.log('  2. Check circuit breaker: circuitBreakers.n8n.getStats()');
        console.log('  3. Run E2E test: ./scripts/admin/trigger-real-n8n-test.sh');
      } else {
        console.log('');
        console.log(`${colors.red}✗ Failed to re-enable circuit breaker${colors.reset}`);
        process.exit(1);
      }
    } else {
      // Disable n8n
      console.log(`${colors.yellow}[Action]${colors.reset} Disabling n8n integration...`);
      console.log(`${colors.yellow}[Duration]${colors.reset} ${durationMinutes} minutes`);
      console.log('');

      // Check current state
      const beforeStats = circuitBreakers.n8n.getStats();
      console.log(`${colors.blue}[Before]${colors.reset} Circuit Breaker State:`, {
        state: beforeStats.state,
        failures: beforeStats.failures,
      });

      // Force circuit breaker open
      circuitBreakers.n8n.forceOpen();

      // Verify state
      const afterStats = circuitBreakers.n8n.getStats();
      console.log(`${colors.green}[After]${colors.reset} Circuit Breaker State:`, {
        state: afterStats.state,
        failures: afterStats.failures,
      });

      console.log('');

      if (afterStats.state === 'OPEN') {
        console.log(`${colors.green}✓ n8n integration disabled successfully${colors.reset}`);
        console.log('');
        console.log(`${colors.yellow}Impact:${colors.reset}`);
        console.log('  • All n8n dispatch requests will fail immediately');
        console.log('  • Tasks will be marked as failed');
        console.log('  • Orchestrator will handle failures per configured retry policy');
        console.log('');
        console.log(`${colors.yellow}Auto-Recovery:${colors.reset}`);
        console.log(`  • Circuit breaker will attempt recovery in ${durationMinutes} minutes`);
        console.log('  • Monitor state: circuitBreakers.n8n.getStats()');
        console.log('');
        console.log(`${colors.yellow}Manual Re-Enable:${colors.reset}`);
        console.log('  node scripts/admin/disable-n8n.js --enable');
        console.log('');
        console.log(`${colors.yellow}Permanent Disable:${colors.reset}`);
        console.log('  export N8N_ENABLED=false');
        console.log('  pm2 restart brand-infinity-engine');
      } else {
        console.log(`${colors.red}✗ Failed to disable circuit breaker${colors.reset}`);
        process.exit(1);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}✗ Error:${colors.reset}`, error.message);
    console.error('');
    console.error(`${colors.yellow}Troubleshooting:${colors.reset}`);
    console.error('  1. Ensure script is run from project root');
    console.error('  2. Check Redis connection (REDIS_URL)');
    console.error('  3. Verify circuit breaker module exists');
    console.error('');
    console.error(`${colors.yellow}Fallback:${colors.reset}`);
    console.error('  export N8N_ENABLED=false');
    console.error('  pm2 restart brand-infinity-engine');
    process.exit(1);
  }
}

// Run main function
main();
