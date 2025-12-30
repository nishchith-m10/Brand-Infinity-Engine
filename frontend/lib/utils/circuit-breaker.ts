/**
 * Circuit Breaker Pattern
 * 
 * Prevents cascading failures by stopping requests to failing services
 * after a threshold of consecutive failures.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests immediately rejected
 * - HALF-OPEN: After cooldown, allow one test request
 */

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 3) */
  threshold?: number;
  /** Milliseconds to wait before trying again (default: 30000) */
  cooldown?: number;
  /** Name for logging purposes */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private lastFailure: number = 0;
  private readonly threshold: number;
  private readonly cooldown: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.threshold ?? 3;
    this.cooldown = options.cooldown ?? 30000;
    this.name = options.name ?? 'default';
  }

  /**
   * Execute a function with circuit breaker protection
   * @throws Error if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailure;
      
      if (timeSinceFailure > this.cooldown) {
        // Cooldown passed, try half-open
        this.state = 'half-open';
        console.log(`[CircuitBreaker:${this.name}] State: HALF-OPEN (testing)`);
      } else {
        // Still in cooldown, reject immediately
        const remainingMs = this.cooldown - timeSinceFailure;
        console.log(`[CircuitBreaker:${this.name}] OPEN - rejecting (${Math.ceil(remainingMs / 1000)}s remaining)`);
        throw new Error(`SERVICE_UNAVAILABLE: Circuit breaker is open. Retry in ${Math.ceil(remainingMs / 1000)}s`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      console.log(`[CircuitBreaker:${this.name}] Test request succeeded, closing circuit`);
    }
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.state === 'half-open') {
      // Failed during half-open, back to open
      this.state = 'open';
      console.log(`[CircuitBreaker:${this.name}] Test request failed, circuit OPEN`);
    } else if (this.failures >= this.threshold) {
      this.state = 'open';
      console.warn(`[CircuitBreaker:${this.name}] Threshold reached (${this.failures}/${this.threshold}), circuit OPEN`);
    } else {
      console.log(`[CircuitBreaker:${this.name}] Failure ${this.failures}/${this.threshold}`);
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailures(): number {
    return this.failures;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = 0;
    console.log(`[CircuitBreaker:${this.name}] Manually reset to CLOSED`);
  }

  /**
   * Check if a request would be allowed (without executing)
   */
  isAllowed(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'half-open') return true;
    if (this.state === 'open') {
      return Date.now() - this.lastFailure > this.cooldown;
    }
    return false;
  }
}

// Singleton instances for common services
export const llmCircuitBreaker = new CircuitBreaker({ 
  name: 'LLM', 
  threshold: 3, 
  cooldown: 30000 
});

export const redisCircuitBreaker = new CircuitBreaker({ 
  name: 'Redis', 
  threshold: 5, 
  cooldown: 10000 
});
