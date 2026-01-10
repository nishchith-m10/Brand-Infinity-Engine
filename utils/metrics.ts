import type Redis from 'ioredis';

export type JobRecord = {
  jobType: string;
  durationMs: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
};

export type JobSummary = {
  totalJobs: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  recentErrors: Array<{ error: string; metadata?: Record<string, any>; timestamp: number }>;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
};

const KNOWN_JOB_TYPES = [
  'video-generation',
  'embeddings',
  'video-processing',
  'brief-generation',
  'script-generation',
];

// Small in-memory Redis-like store used when no Redis client is provided
class InMemoryRedis {
  private store = new Map<string, any>();

  async hincrby(key: string, field: string, increment = 1) {
    const map = this.store.get(key) ?? {};
    map[field] = (map[field] ?? 0) + increment;
    this.store.set(key, map);
    return map[field];
  }

  async hgetall(key: string) {
    return this.store.get(key) ?? {};
  }

  async lpush(key: string, value: string) {
    const arr = this.store.get(key) ?? [];
    arr.unshift(value);
    this.store.set(key, arr);
    return arr.length;
  }

  async lrange(key: string, start: number, stop: number) {
    const arr = this.store.get(key) ?? [];
    // stop inclusive
    if (stop === -1) stop = arr.length - 1;
    return arr.slice(start, stop + 1);
  }

  async ltrim(key: string, start: number, stop: number) {
    const arr = this.store.get(key) ?? [];
    if (stop === -1) stop = arr.length - 1;
    const newArr = arr.slice(start, stop + 1);
    this.store.set(key, newArr);
    return 'OK';
  }

  async del(key: string) {
    this.store.delete(key);
    return 1;
  }

  async flushall() {
    this.store.clear();
    return 'OK';
  }

  async quit() {
    // no-op
    return 'OK';
  }
}

export class MetricsCollector {
  private redis: Redis | InMemoryRedis;
  private prefix = 'metrics';

  constructor(redis?: Redis | any) {
    this.redis = redis ?? new InMemoryRedis();
  }

  private countsKey(jobType: string) {
    return `${this.prefix}:${jobType}:counts`;
  }

  private durationsKey(jobType: string) {
    return `${this.prefix}:${jobType}:durations`;
  }

  private errorsKey(jobType: string) {
    return `${this.prefix}:${jobType}:errors`;
  }

  async recordJob(record: JobRecord) {
    try {
      const { jobType, durationMs, success, error, metadata } = record;
      const countsKey = this.countsKey(jobType);
      if (success) {
        await this.safe(this.redis.hincrby.bind(this.redis), countsKey, 'successCount', 1);
      } else {
        await this.safe(this.redis.hincrby.bind(this.redis), countsKey, 'failureCount', 1);
      }
      await this.safe(this.redis.hincrby.bind(this.redis), countsKey, 'totalJobs', 1);

      // track durations (push as numbers)
      await this.safe(this.redis.lpush.bind(this.redis), this.durationsKey(jobType), String(durationMs));

      // store recent errors (up to 10)
      if (!success && error) {
        const payload = JSON.stringify({ error, metadata, timestamp: Date.now() });
        await this.safe(this.redis.lpush.bind(this.redis), this.errorsKey(jobType), payload);
        await this.safe(this.redis.ltrim.bind(this.redis), this.errorsKey(jobType), 0, 9);
      }
    } catch (e) {
      // swallow Redis errors to be resilient
      // eslint-disable-next-line no-console
      // console.warn('MetricsCollector.recordJob error', e);
      return;
    }
  }

  private async safe(fn: (...args: any[]) => Promise<any>, ...args: any[]) {
    try {
      return await fn(...args);
    } catch (e) {
      return undefined;
    }
  }

  async getSummary(jobType: string): Promise<JobSummary> {
    try {
      const counts = (await this.safe(this.redis.hgetall.bind(this.redis), this.countsKey(jobType))) || {};
      const durations = (await this.safe(this.redis.lrange.bind(this.redis), this.durationsKey(jobType), 0, -1)) || [];
      const errors = (await this.safe(this.redis.lrange.bind(this.redis), this.errorsKey(jobType), 0, -1)) || [];

      const totalJobs = Number(counts.totalJobs ?? 0);
      const successCount = Number(counts.successCount ?? 0);
      const failureCount = Number(counts.failureCount ?? 0);
      const avgDuration = durations.length ? Math.round(durations.map(Number).reduce((a, b) => a + b, 0) / durations.length) : 0;
      const successRate = totalJobs ? successCount / totalJobs : 0;

      // percentiles
      const numericDurations = durations.map(Number).sort((a, b) => a - b);
      const p50 = this.percentile(numericDurations, 0.5);
      const p95 = this.percentile(numericDurations, 0.95);
      const p99 = this.percentile(numericDurations, 0.99);

      const recentErrors = errors.map((e: string) => {
        try {
          return JSON.parse(e);
        } catch {
          return { error: String(e), timestamp: Date.now() };
        }
      }).slice(0, 10);

      return {
        totalJobs,
        successCount,
        failureCount,
        successRate,
        avgDuration,
        recentErrors,
        p50Duration: p50,
        p95Duration: p95,
        p99Duration: p99,
      };
    } catch (e) {
      return {
        totalJobs: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        avgDuration: 0,
        recentErrors: [],
        p50Duration: 0,
        p95Duration: 0,
        p99Duration: 0,
      };
    }
  }

  private percentile(sorted: number[], p: number) {
    if (!sorted.length) return 0;
    const n = sorted.length;
    const rank = Math.ceil(p * n) - 1;
    const idx = Math.min(Math.max(rank, 0), n - 1);
    return sorted[idx];
  }

  async getAllSummaries() {
    const out: Record<string, JobSummary> = {};
    for (const jt of KNOWN_JOB_TYPES) {
      out[jt] = await this.getSummary(jt);
    }
    return out;
  }

  async reset(jobType: string) {
    try {
      await this.safe(this.redis.del.bind(this.redis), this.countsKey(jobType));
      await this.safe(this.redis.del.bind(this.redis), this.durationsKey(jobType));
      await this.safe(this.redis.del.bind(this.redis), this.errorsKey(jobType));
    } catch (e) {
      return;
    }
  }
}

let singleton: MetricsCollector | null = null;

export function getMetricsCollector(redis?: Redis | any) {
  if (!singleton) singleton = new MetricsCollector(redis);
  return singleton;
}

export async function recordSuccess(jobType: string, durationMs: number, metadata?: Record<string, any>) {
  const mc = getMetricsCollector();
  await mc.recordJob({ jobType, durationMs, success: true, metadata });
}

export async function recordFailure(jobType: string, durationMs: number, error?: string, metadata?: Record<string, any>) {
  const mc = getMetricsCollector();
  await mc.recordJob({ jobType, durationMs, success: false, error, metadata });
}
