import axios, { AxiosInstance, AxiosError } from 'axios';

const N8N_WEBHOOK_BASE = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';

export interface WorkflowTriggerResult {
  success: boolean;
  executionId?: string;
  error?: string;
}

/**
 * n8n Webhook Client
 * 
 * Centralized client for triggering n8n workflows from API routes.
 * Implements timeout handling, error logging, and consistent response format.
 */
class N8nClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: N8N_WEBHOOK_BASE,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Trigger an n8n workflow via webhook
   * 
   * @param webhookPath - The webhook path (e.g., '/strategist/campaign')
   * @param payload - The data to send to the workflow
   * @returns Result with success status and optional execution ID
   */
  async triggerWorkflow(
    webhookPath: string,
    payload: Record<string, unknown>
  ): Promise<WorkflowTriggerResult> {
    try {
      console.log(`[n8n] Triggering workflow: ${webhookPath}`, { campaignId: payload.campaign_id });
      
      const response = await this.client.post(webhookPath, payload);
      
      console.log(`[n8n] Workflow triggered successfully: ${webhookPath}`);
      
      return {
        success: true,
        executionId: response.data?.executionId || response.data?.id,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data 
        ? JSON.stringify(axiosError.response.data)
        : axiosError.message;
      
      console.error(`[n8n] Webhook error (${webhookPath}):`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if n8n is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const n8nClient = new N8nClient();

// Webhook path constants
export const N8N_WEBHOOKS = {
  STRATEGIST_CAMPAIGN: '/strategist/campaign',
  STRATEGIST_BRIEF: '/strategist/brief',
  COPYWRITER_SCRIPT: '/copywriter/script',
  PRODUCTION_DISPATCH: '/production/dispatch',
  PRODUCTION_DOWNLOAD: '/production/download',
  BROADCASTER_PUBLISH: '/broadcaster/publish',
  APPROVAL_HANDLE: '/approval/handle',
} as const;
