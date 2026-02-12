import type Redis from 'ioredis';

export type RateLimiterOptions = {
  maxRequests: number;
  windowSecs: number;
  keyPrefix?: string;
};

export const RATE_LIMIT_PRESETS: Record<string, RateLimiterOptions> = {
  standard: { maxRequests: 100, windowSecs: 60 },
  strict: { maxRequests: 10, windowSecs: 60 },
  lenient: { maxRequests: 500, windowSecs: 60 },
  burst: { maxRequests: 20, windowSecs: 10 },
  daily: { maxRequests: 1000, windowSecs: 86400 },
};

export class RateLimiter {
  private redis: Redis | any;
  private maxRequests: number;
  private windowSecs: number;
  private keyPrefix: string;

  constructor(redisClient: Redis | any, opts: RateLimiterOptions) {
    this.redis = redisClient;
    this.maxRequests = opts.maxRequests;
    this.windowSecs = opts.windowSecs;
    this.keyPrefix = opts.keyPrefix ?? 'rate-limiter';
  }

  private key(identifier: string) {
    return `${this.keyPrefix}:${identifier}`;
  }

  private async safe(fn: (...args: any[]) => Promise<any>, ...args: any[]) {
    try {
      return await fn(...args);
    } catch (e) {
      return undefined;
    }
  }

  async check(identifier: string) {
    const key = this.key(identifier);
    const nowMs = Date.now();
    const windowStartMs = nowMs - this.windowSecs * 1000;

    try {
      const raw = (await this.safe(this.redis.lrange.bind(this.redis), key, 0, -1)) || [];
      const timestamps = raw.map((s: string) => Number(s)).filter(Boolean);
      const valid = timestamps.filter((t: number) => t >= windowStartMs);

      if (valid.length < this.maxRequests) {
        // allow
        await this.safe(this.redis.lpush.bind(this.redis), key, String(nowMs));
        // trim to a reasonable size
        await this.safe(this.redis.ltrim.bind(this.redis), key, 0, this.maxRequests * 2);

        const remaining = Math.max(this.maxRequests - (valid.length + 1), 0);
        const resetAt = valid.length ? new Date(Math.min(...valid) + this.windowSecs * 1000) : new Date(nowMs + this.windowSecs * 1000);

        return { allowed: true, remaining, resetAt };
      }

      // blocked
      const earliest = Math.min(...valid);
      const retryAfterSecs = Math.max(0, Math.ceil((earliest + this.windowSecs * 1000 - nowMs) / 1000));
      const resetAt = new Date(earliest + this.windowSecs * 1000);

      return { allowed: false, remaining: 0, retryAfterSecs, resetAt };
    } catch (e) {
      // fail-open on redis errors
      return { allowed: true, remaining: Math.max(this.maxRequests - 1, 0) };
    }
  }

  async reset(identifier: string) {
    try {
      await this.safe(this.redis.del.bind(this.redis), this.key(identifier));
    } catch (e) {
      return;
    }
  }

  async getUsage(identifier: string) {
    const key = this.key(identifier);
    const nowMs = Date.now();
    const windowStartMs = nowMs - this.windowSecs * 1000;

    try {
      const raw = (await this.safe(this.redis.lrange.bind(this.redis), key, 0, -1)) || [];
      const timestamps = raw.map((s: string) => Number(s)).filter(Boolean);
      const valid = timestamps.filter((t: number) => t >= windowStartMs);
      const used = valid.length;
      const remaining = Math.max(this.maxRequests - used, 0);
      return { used, limit: this.maxRequests, remaining };
    } catch (e) {
      return { used: 0, limit: this.maxRequests, remaining: this.maxRequests };
    }
  }
}
