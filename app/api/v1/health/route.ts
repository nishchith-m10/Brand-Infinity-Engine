import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { n8nClient } from '@/lib/n8n/client';

// =============================================================================
// GET /api/v1/health - System health check
// =============================================================================
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: { status: 'unknown', latency: 0 },
      n8n: { status: 'unknown', latency: 0 },
    },
  };

  // Check database
  const dbStart = Date.now();
  try {
    const supabase = createAdminClient();
    await supabase.from('campaigns').select('campaign_id').limit(1);
    health.services.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    health.services.database = {
      status: 'unhealthy',
      latency: Date.now() - dbStart,
    };
    health.status = 'degraded';
  }

  // Check n8n
  const n8nStart = Date.now();
  try {
    const n8nHealthy = await n8nClient.healthCheck();
    health.services.n8n = {
      status: n8nHealthy ? 'healthy' : 'unhealthy',
      latency: Date.now() - n8nStart,
    };
    if (!n8nHealthy) {
      health.status = 'degraded';
    }
  } catch {
    health.services.n8n = {
      status: 'unhealthy',
      latency: Date.now() - n8nStart,
    };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
