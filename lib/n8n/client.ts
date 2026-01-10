/**
 * n8n Workflow Integration Client
 * Slice 11: N8N Integration
 */

import { logger } from '../monitoring/logger';
import crypto from 'crypto';

export interface N8NWorkflowTrigger {
  workflow_id: string;
  webhook_url: string;
  data: Record<string, unknown>;
}

export interface N8NWorkflowStatus {
  execution_id: string;
  status: 'running' | 'completed' | 'failed' | 'waiting';
  result?: unknown;
  error?: string;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

interface IdempotencyCache {
  [key: string]: { result: any; timestamp: number };
}

export class N8NClient {
  private baseUrl: string;
  private apiKey: string;
  private circuitBreaker: CircuitBreakerState;
  private idempotencyCache: IdempotencyCache;
  private failureWindow: number = 60000; // 1 minute
  private failureThreshold: number = 0.5; // 50% failure rate
  private totalRequests: number = 0;
  private requestWindow: number[] = [];

  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL || '';
    this.apiKey = process.env.N8N_API_KEY || '';
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
    };
    this.idempotencyCache = {};

    if (!this.baseUrl) {
      logger.warn('N8N', 'n8n webhook URL not configured');
    }
    
    // Clean up old idempotency cache entries every 5 minutes
    setInterval(() => this.cleanupIdempotencyCache(), 300000);
  }
  
  /**
   * Clean up expired idempotency cache entries (older than 24 hours)
   */
  private cleanupIdempotencyCache(): void {
    const now = Date.now();
    const expirationTime = 24 * 60 * 60 * 1000; // 24 hours
    
    Object.keys(this.idempotencyCache).forEach(key => {
      if (now - this.idempotencyCache[key].timestamp > expirationTime) {
        delete this.idempotencyCache[key];
      }
    });
  }
  
  /**
   * Update circuit breaker state based on failure rate
   */
  private updateCircuitBreaker(success: boolean): void {
    const now = Date.now();
    
    // Clean old requests outside the window
    this.requestWindow = this.requestWindow.filter(timestamp => 
      now - timestamp < this.failureWindow
    );
    
    this.requestWindow.push(now);
    
    if (!success) {
      this.circuitBreaker.failures++;
      this.circuitBreaker.lastFailureTime = now;
    }
    
    // Calculate failure rate
    const failureRate = this.circuitBreaker.failures / this.requestWindow.length;
    
    // Update circuit breaker state
    if (this.circuitBreaker.state === 'closed' && failureRate >= this.failureThreshold) {
      this.circuitBreaker.state = 'open';
      logger.warn('N8N', 'Circuit breaker opened', { failureRate, failures: this.circuitBreaker.failures });
    } else if (this.circuitBreaker.state === 'open' && now - this.circuitBreaker.lastFailureTime > 60000) {
      // After 1 minute, move to half-open to test recovery
      this.circuitBreaker.state = 'half-open';
      logger.info('N8N', 'Circuit breaker half-open, testing recovery');
    } else if (this.circuitBreaker.state === 'half-open' && success) {
      // Success in half-open state, close the circuit
      this.circuitBreaker.state = 'closed';
      this.circuitBreaker.failures = 0;
      logger.info('N8N', 'Circuit breaker closed, service recovered');
    }
  }
  
  /**
   * Check if circuit breaker allows request
   */
  private canMakeRequest(): boolean {
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceLastFailure < 60000) {
        return false;
      }
      // Move to half-open to test
      this.circuitBreaker.state = 'half-open';
    }
    return true;
  }
  
  /**
   * Execute request with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();
        this.updateCircuitBreaker(true);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.updateCircuitBreaker(false);
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error;
        }
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          logger.warn('N8N', `Request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Trigger content generation workflow
   */
  async triggerContentGeneration(params: {
    content_type: string;
    brief: string;
    specifications: Record<string, unknown>;
    brand_id: string;
    session_id: string;
    request_id?: string;
    task_id?: string;
  }): Promise<{ execution_id: string; webhook_url: string }> {
    const workflowUrl = `${this.baseUrl}/production/dispatch`;

    try {
      const response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          trigger: 'content_generation',
          data: params,
          request_id: params.request_id,
          task_id: params.task_id,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`n8n workflow failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      logger.info('N8N', 'Content generation workflow triggered', {
        execution_id: result.execution_id,
        content_type: params.content_type,
      });

      return {
        execution_id: result.execution_id || `exec_${Date.now()}`,
        webhook_url: workflowUrl,
      };
    } catch (error) {
      logger.error('N8N', 'Failed to trigger content generation', error);
      throw error;
    }
  }

  /**
   * Trigger video production workflow
   */
  async triggerVideoProduction(params: {
    script: string;
    visual_specs: Record<string, unknown>;
    brand_assets: string[];
    session_id: string;
    request_id?: string;
    task_id?: string;
  }): Promise<{ execution_id: string }> {
    const workflowUrl = `${this.baseUrl}/production/dispatch`;

    try {
      const response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          trigger: 'video_production',
          data: params,
          request_id: params.request_id,
          task_id: params.task_id,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`n8n workflow failed: ${response.statusText}`);
      }

      const result = await response.json();

      logger.info('N8N', 'Video production workflow triggered', {
        execution_id: result.execution_id,
      });

      return {
        execution_id: result.execution_id || `exec_${Date.now()}`,
      };
    } catch (error) {
      logger.error('N8N', 'Failed to trigger video production', error);
      throw error;
    }
  }

  /**
   * Check workflow status (polling)
   */
  async checkStatus(executionId: string): Promise<N8NWorkflowStatus> {
    const statusUrl = `${this.baseUrl}/status/${executionId}`;

    try {
      const response = await fetch(statusUrl, {
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.statusText}`);
      }

      const status = await response.json();
      return status;
    } catch (error) {
      logger.error('N8N', 'Failed to check workflow status', error);
      return {
        execution_id: executionId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for workflow completion (with timeout)
   */
  async waitForCompletion(
    executionId: string,
    timeoutMs: number = 300000, // 5 minutes
    pollInterval: number = 5000 // 5 seconds
  ): Promise<N8NWorkflowStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.checkStatus(executionId);

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Workflow ${executionId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Check if n8n is configured
   */
  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  /**
   * Health check - verify n8n is reachable
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generic workflow trigger with retry logic, idempotency, and configurable timeout
   */
  async triggerWorkflow(
    webhookPath: string,
    data: Record<string, unknown>,
    options?: {
      idempotencyKey?: string;
      timeout?: number;
      retries?: number;
    }
  ): Promise<{ success: boolean; execution_id?: string; error?: string }> {
    if (!this.isConfigured()) {
      logger.warn('N8N', 'n8n not configured, skipping workflow trigger');
      return { success: false, error: 'n8n not configured' };
    }
    
    // Check circuit breaker
    if (!this.canMakeRequest()) {
      logger.error('N8N', 'Circuit breaker open, rejecting request');
      return { success: false, error: 'Service temporarily unavailable (circuit breaker open)' };
    }

    // Generate or use provided idempotency key
    const idempotencyKey = options?.idempotencyKey || crypto.randomUUID();
    
    // Check idempotency cache
    if (this.idempotencyCache[idempotencyKey]) {
      logger.info('N8N', 'Returning cached result for idempotent request', { idempotencyKey });
      return this.idempotencyCache[idempotencyKey].result;
    }

    const workflowUrl = `${this.baseUrl}${webhookPath}`;
    
    // Determine timeout based on workflow type
    const timeout = options?.timeout || this.getTimeoutForWorkflow(webhookPath);
    const maxRetries = options?.retries ?? 3;

    try {
      const result = await this.executeWithRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(workflowUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': idempotencyKey,
              ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            },
            body: JSON.stringify({
              data,
              timestamp: new Date().toISOString(),
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }, maxRetries);
      
      logger.info('N8N', 'Workflow triggered', {
        webhook: webhookPath,
        execution_id: result.execution_id,
        idempotencyKey,
      });

      const responseData = {
        success: true,
        execution_id: result.execution_id || `exec_${Date.now()}`,
      };
      
      // Cache result for idempotency
      this.idempotencyCache[idempotencyKey] = {
        result: responseData,
        timestamp: Date.now(),
      };

      return responseData;
    } catch (error) {
      logger.error('N8N', 'Failed to trigger workflow after retries', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Get timeout for specific workflow types
   */
  private getTimeoutForWorkflow(webhookPath: string): number {
    // Video generation: 5 minutes
    if (webhookPath.includes('video') || webhookPath.includes('production')) {
      return 300000;
    }
    // Image generation: 2 minutes
    if (webhookPath.includes('image') || webhookPath.includes('visual')) {
      return 120000;
    }
    // Quick tasks: 30 seconds
    return 30000;
  }
}

/**
 * Webhook endpoints for different workflows
 * Updated to match deployed workflow paths
 */
export const N8N_WEBHOOKS = {
  STRATEGIST_CAMPAIGN: '/strategist', // Strategist_Main.json
  STRATEGIST_BRIEF: '/strategist', // Strategist_Main.json (same workflow)
  COPYWRITER_SCRIPT: '/copywriter', // Copywriter_Main.json
  PRODUCTION_DISPATCH: '/production/dispatch', // Production_Dispatcher.json
  PRODUCTION_ASSEMBLE: '/production/assemble', // Video_Assembly.json
  PRODUCTION_DOWNLOAD: '/production/download', // Production_Downloader.json
  BROADCASTER_PUBLISH: '/broadcast', // Broadcaster_Main.json
  APPROVAL_HANDLE: '/campaign/approve', // Approval_Handler.json
  REVIEW_CONTENT: '/campaign/verify', // Campaign_Verifier.json
} as const;

/**
 * Get n8n client instance (singleton)
 */
let clientInstance: N8NClient | null = null;

export function getN8NClient(): N8NClient {
  if (!clientInstance) {
    clientInstance = new N8NClient();
  }
  return clientInstance;
}

/**
 * Export singleton instance for backward compatibility
 */
export const n8nClient = new N8NClient();
