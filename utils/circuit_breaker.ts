export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitOptions {
  threshold?: number;
  resetTimeout?: number; // ms
  failureWindow?: number; // ms - not used heavily in simple impl
}

export class CircuitBreaker {
  private name: string;
  private redis: any;
  private threshold: number;
  private resetTimeout: number;
  private failureWindow: number;

  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private lastFailure: number | null = null;

  constructor(name: string, redisClient: any, opts: CircuitOptions = {}) {
    this.name = name;
    this.redis = redisClient;
    this.threshold = opts.threshold ?? 3;
    this.resetTimeout = opts.resetTimeout ?? 30000;
    this.failureWindow = opts.failureWindow ?? 60_000;
  }

  async getState(): Promise<CircuitState> {
    return this.state;
  }

  async setState(s: CircuitState) {
    this.state = s;
  }

  private async persistStatus() {
    try {
      await this.redis.set(`${this.name}:failures`, String(this.failures));
      await this.redis.set(`${this.name}:lastFailure`, String(this.lastFailure ?? ''));
      await this.redis.set(`${this.name}:state`, this.state);
    } catch (e) {
      // ignore persistence errors in tests
    }
  }

  private async loadStatus() {
    try {
      const failures = await this.redis.get(`${this.name}:failures`);
      const last = await this.redis.get(`${this.name}:lastFailure`);
      const state = await this.redis.get(`${this.name}:state`);
      this.failures = failures ? parseInt(failures, 10) : this.failures;
      this.lastFailure = last ? Number(last) : this.lastFailure;
      this.state = (state as CircuitState) ?? this.state;
    } catch (e) {
      // ignore
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.loadStatus();

    if (this.state === 'OPEN') {
      const last = this.lastFailure ?? 0;
      if (Date.now() - last > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();

      // On success
      this.failures = 0;
      this.lastFailure = null;
      this.state = 'CLOSED';
      await this.persistStatus();
      return result;
    } catch (err) {
      // On failure
      this.failures += 1;
      this.lastFailure = Date.now();

      if (this.state === 'HALF_OPEN') {
        // failed during HALF_OPEN -> back to OPEN
        this.state = 'OPEN';
      } else if (this.failures >= this.threshold) {
        this.state = 'OPEN';
      }

      await this.persistStatus();
      throw err;
    }
  }

  async getStatus() {
    await this.loadStatus();
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailure ? new Date(this.lastFailure) : null,
    };
  }

  async reset() {
    this.failures = 0;
    this.lastFailure = null;
    this.state = 'CLOSED';
    await this.persistStatus();
  }
}
