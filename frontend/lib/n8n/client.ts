/**
 * n8n Workflow Integration Client
 * Slice 11: N8N Integration
 */

import { logger } from '../monitoring/logger';

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

export class N8NClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.N8N_WEBHOOK_URL || '';
    this.apiKey = process.env.N8N_API_KEY || '';

    if (!this.baseUrl) {
      logger.warn('N8N', 'n8n webhook URL not configured');
    }
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
  }): Promise<{ execution_id: string; webhook_url: string }> {
    const workflowUrl = `${this.baseUrl}/content-generation`;

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
  }): Promise<{ execution_id: string }> {
    const workflowUrl = `${this.baseUrl}/video-production`;

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
   * Generic workflow trigger (backward compatibility)
   */
  async triggerWorkflow(
    webhookPath: string,
    data: Record<string, unknown>
  ): Promise<{ success: boolean; execution_id?: string; error?: string }> {
    if (!this.isConfigured()) {
      logger.warn('N8N', 'n8n not configured, skipping workflow trigger');
      return { success: false, error: 'n8n not configured' };
    }

    const workflowUrl = `${this.baseUrl}${webhookPath}`;

    try {
      const response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({
          data,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Workflow trigger failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      logger.info('N8N', 'Workflow triggered', {
        webhook: webhookPath,
        execution_id: result.execution_id,
      });

      return {
        success: true,
        execution_id: result.execution_id || `exec_${Date.now()}`,
      };
    } catch (error) {
      logger.error('N8N', 'Failed to trigger workflow', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Webhook endpoints for different workflows
 */
export const N8N_WEBHOOKS = {
  STRATEGIST_CAMPAIGN: '/campaign-strategy',
  STRATEGIST_BRIEF: '/strategist',
  CONTENT_GENERATION: '/content-generation',
  COPYWRITER_SCRIPT: '/copywriter',
  VIDEO_PRODUCTION: '/video-production',
  PRODUCTION_DISPATCH: '/production-dispatcher',
  BROADCASTER_PUBLISH: '/broadcaster',
  APPROVAL_HANDLE: '/approval-handler',
  REVIEW_CONTENT: '/content-review',
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
