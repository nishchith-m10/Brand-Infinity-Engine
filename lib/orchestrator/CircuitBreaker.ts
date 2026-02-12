/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protects the system from cascading failures when external services
 * (n8n, LLM providers, etc.) become unavailable or unreliable.
 * 
 * Circuit States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail fast without attempting
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Configuration:
 * - Failure threshold: 5 consecutive failures triggers OPEN
 * - Timeout: 60 seconds in OPEN before trying HALF_OPEN
 * - Success threshold: 2 consecutive successes in HALF_OPEN to close
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  successThreshold: number;      // Number of successes to close from half-open
  timeout: number;               // Milliseconds to wait before half-open
  name: string;                  // Circuit breaker identifier
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  openedAt?: number;
  closedAt?: number;
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(public serviceName: string, public state: CircuitState) {
    super(`Circuit breaker OPEN for service: ${serviceName}`);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private openedAt?: number;
  private closedAt?: number;
  private nextAttemptTime?: number;
  
  // Statistics
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute a function with circuit breaker protection.
   * 
   * @param fn - The function to execute
   * @returns Promise resolving to function result
   * @throws CircuitBreakerError if circuit is OPEN
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check circuit state
    if (this.state === 'OPEN') {
      // Check if enough time has passed to try half-open
      if (this.nextAttemptTime && Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(this.config.name, 'OPEN');
      }
      
      // Transition to HALF_OPEN to test service
      this.state = 'HALF_OPEN';
      console.log(`[CircuitBreaker:${this.config.name}] Transitioning to HALF_OPEN`);
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

  /**
   * Handle successful execution.
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        // Service recovered, close circuit
        this.close();
      }
    }
  }

  /**
   * Handle failed execution.
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.config.failureThreshold) {
      this.open();
    }
  }

  /**
   * Open the circuit (block requests).
   */
  private open(): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.nextAttemptTime = this.openedAt + this.config.timeout;

    console.warn(`[CircuitBreaker:${this.config.name}] Circuit OPENED after ${this.failureCount} failures`, {
      next_attempt: new Date(this.nextAttemptTime).toISOString(),
    });
  }

  /**
   * Close the circuit (allow requests).
   */
  private close(): void {
    this.state = 'CLOSED';
    this.closedAt = Date.now();
    this.failureCount = 0;
    this.successCount = 0;

    console.log(`[CircuitBreaker:${this.config.name}] Circuit CLOSED, service recovered`);
  }

  /**
   * Manually reset the circuit breaker.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.openedAt = undefined;
    this.nextAttemptTime = undefined;

    console.log(`[CircuitBreaker:${this.config.name}] Manually reset`);
  }

  /**
   * Get current circuit breaker statistics.
   * 
   * @returns Circuit breaker stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      openedAt: this.openedAt,
      closedAt: this.closedAt,
    };
  }

  /**
   * Get human-readable status.
   * 
   * @returns Status string
   */
  getStatus(): string {
    const stats = this.getStats();
    const successRate = stats.totalRequests > 0 
      ? ((stats.totalSuccesses / stats.totalRequests) * 100).toFixed(1)
      : '0.0';

    let status = `Circuit: ${stats.state} | Success Rate: ${successRate}% (${stats.totalSuccesses}/${stats.totalRequests})`;

    if (stats.state === 'OPEN' && this.nextAttemptTime) {
      const waitTime = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
      status += ` | Retry in ${waitTime}s`;
    }

    return status;
  }

  /**
   * Check if circuit is healthy.
   * 
   * @returns True if circuit is closed
   */
  isHealthy(): boolean {
    return this.state === 'CLOSED';
  }
}

/**
 * Circuit Breaker Manager
 * 
 * Manages multiple circuit breakers for different services.
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a service.
   * 
   * @param serviceName - Name of the service
   * @param config - Optional custom configuration
   * @returns Circuit breaker instance
   */
  getBreaker(
    serviceName: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const defaultConfig: CircuitBreakerConfig = {
        name: serviceName,
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 60000, // 60 seconds
        ...config,
      };

      this.breakers.set(serviceName, new CircuitBreaker(defaultConfig));
    }

    return this.breakers.get(serviceName)!;
  }

  /**
   * Execute a function with circuit breaker protection.
   * 
   * @param serviceName - Name of the service
   * @param fn - Function to execute
   * @returns Promise resolving to function result
   */
  async execute<T>(serviceName: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getBreaker(serviceName);
    return breaker.execute(fn);
  }

  /**
   * Get all circuit breaker statistics.
   * 
   * @returns Map of service name to stats
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();
    
    for (const [name, breaker] of this.breakers.entries()) {
      stats.set(name, breaker.getStats());
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers.
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get health status of all services.
   * 
   * @returns Map of service name to health status
   */
  getHealthStatus(): Map<string, boolean> {
    const health = new Map<string, boolean>();
    
    for (const [name, breaker] of this.breakers.entries()) {
      health.set(name, breaker.isHealthy());
    }
    
    return health;
  }
}

/**
 * Global circuit breaker manager instance
 */
export const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Preconfigured circuit breakers for common services
 */
export const circuitBreakers = {
  n8n: circuitBreakerManager.getBreaker('n8n', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 120000, // 2 minutes (n8n might be restarting)
  }),
  
  openai: circuitBreakerManager.getBreaker('openai', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  }),
  
  anthropic: circuitBreakerManager.getBreaker('anthropic', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 60000, // 1 minute
  }),
  
  elevenLabs: circuitBreakerManager.getBreaker('elevenLabs', {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 90000, // 1.5 minutes
  }),
};

/**
 * Export types and utilities
 */
export default CircuitBreaker;
