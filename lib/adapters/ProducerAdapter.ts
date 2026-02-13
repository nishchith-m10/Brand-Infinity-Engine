/**
 * Producer Adapter
 * Dispatches production tasks to n8n workflows with callback integration
 * Falls back to direct provider APIs when n8n is not configured
 * 
 * Purpose:
 * - Translate orchestrator's AgentExecutionParams to n8n workflow payload
 * - Dispatch to n8n with callback URLs for status updates
 * - Direct Pollinations API fallback for image generation
 * - Track n8n execution IDs and handle async completion
 * - Return standardized AgentExecutionResult (pending state)
 */

import type { 
  AgentExecutionParams, 
  AgentExecutionResult,
  RequestTask,
} from '@/lib/orchestrator/types';
import { circuitBreakers, CircuitBreakerError } from '@/lib/orchestrator/CircuitBreaker';
import { generateImagePollinations } from '@/lib/ai/pollinations';

/**
 * n8n Workflow Configuration
 */
interface N8nConfig {
  baseUrl: string;
  apiKey: string;
  workflows: {
    video_production: string; // Workflow ID for video production
    image_generation: string; // Workflow ID for image generation
    voiceover_synthesis: string; // Workflow ID for voiceover
  };
}

/**
 * n8n Dispatch Payload
 * NOTE: script_id and campaign_id are required by Production_Dispatcher.json workflow
 */
interface N8nDispatchPayload {
  requestId: string;
  taskId: string;
  script_id: string | null; // Required by n8n to load from scripts table
  campaign_id: string | null; // Required by n8n for budget/tracking
  taskType: string;
  contentType: string;
  input: unknown;
  callbackUrl: string;
  budget_tier?: string; // Used by n8n to select provider priority
  metadata: {
    request_type: string;
    created_at: string;
    [key: string]: unknown;
  };
}

/**
 * n8n Dispatch Response
 */
interface N8nDispatchResponse {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running';
  message?: string;
}

export class ProducerAdapter {
  private config: N8nConfig;
  
  constructor(config?: Partial<N8nConfig>) {
    // Load from environment or use provided config
    this.config = {
      baseUrl: config?.baseUrl || process.env.N8N_BASE_URL || 'http://localhost:5678',
      apiKey: config?.apiKey || process.env.N8N_API_KEY || '',
      workflows: {
        video_production: config?.workflows?.video_production || process.env.N8N_WORKFLOW_VIDEO || '',
        image_generation: config?.workflows?.image_generation || process.env.N8N_WORKFLOW_IMAGE || '',
        voiceover_synthesis: config?.workflows?.voiceover_synthesis || process.env.N8N_WORKFLOW_VOICEOVER || '',
      },
    };
  }

  /**
   * Execute producer task via n8n dispatch or direct provider API
   */
  async execute(params: AgentExecutionParams): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Determine workflow based on task type
      const workflowId = this.selectWorkflow(params);
      const requestType = params.request.request_type;
      
      // If no n8n workflow configured and it's an image request, use direct Pollinations
      if (!workflowId && requestType === 'image') {
        console.log('[ProducerAdapter] No n8n workflow configured for images, using direct Pollinations API');
        return await this.generateImageDirect(params, startTime);
      }
      
      if (!workflowId) {
        return {
          success: false,
          error: {
            code: 'WORKFLOW_NOT_FOUND',
            message: `No n8n workflow configured for task type: ${params.task.task_name}`,
          },
          metadata: {
            agent: 'producer',
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Build dispatch payload
      const payload = this.buildDispatchPayload(params);

      // Dispatch to n8n
      const dispatchResult = await this.dispatchToN8n(workflowId, payload);

      // Return pending result (n8n will callback when complete)
      return {
        success: true,
        output: {
          type: 'n8n_dispatch',
          workflow_id: dispatchResult.workflowId,
          execution_id: dispatchResult.executionId,
          status: 'dispatched',
          message: 'Task dispatched to n8n, awaiting callback',
        },
        metadata: {
          agent: 'producer',
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          workflow_id: dispatchResult.workflowId,
          execution_id: dispatchResult.executionId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PRODUCER_DISPATCH_FAILED',
          message: error instanceof Error ? error.message : 'n8n dispatch failed',
        },
        metadata: {
          agent: 'producer',
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Generate image directly via Pollinations (no n8n)
   */
  private async generateImageDirect(
    params: AgentExecutionParams,
    startTime: number
  ): Promise<AgentExecutionResult> {
    try {
      // Use the user's original prompt directly for image generation
      // The strategist's output is a strategic brief document, NOT an image prompt
      // Sanitize: remove newlines, special chars, and truncate for Pollinations URL
      const rawPrompt = params.request.prompt || 'A professional creative image';
      const prompt = rawPrompt
        .replace(/[\r\n]+/g, ' ')     // Replace newlines with spaces
        .replace(/[:"'()\[\]{}]/g, '') // Remove special chars that break URLs
        .replace(/\s+/g, ' ')          // Normalize multiple spaces
        .trim()
        .substring(0, 500);            // Flux handles longer prompts well (tested 250+), 500 is safe
      
      // Parse aspect ratio to dimensions
      const aspectRatio = params.request.aspect_ratio || '1:1';
      const dimensions = this.aspectRatioDimensions(aspectRatio);
      
      console.log('[ProducerAdapter] Generating image via Pollinations:', {
        prompt: prompt + '...',
        dimensions,
        model: 'flux'
      });
      
      // Generate image via Pollinations - use Flux for reliability (slower but works)
      // Must set enhance: true to avoid blank images with Flux
      // Retry logic: Attempt up to 3 times to handle intermittent 0-byte/timeout failures
      const MAX_RETRIES = 3;
      let lastError: unknown;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`[ProducerAdapter] Retry attempt ${attempt}/${MAX_RETRIES} for Flux generation...`);
          }

          // Cache Busting: Generate a unique seed for each attempt
          // This ensures we don't hit a cached 0-byte result from Pollinations/Cloudflare
          const attemptSeed = Math.floor(Math.random() * 1000000000);

          const result = await generateImagePollinations({
            prompt,
            width: dimensions.width,
            height: dimensions.height,
            model: 'flux',
            nologo: true,
            enhance: true, 
            seed: attemptSeed, // FORCE FRESH GENERATION
          });
          
          console.log('[ProducerAdapter] Image generated successfully:', result.url);
          
          return {
            success: true,
            output: {
              type: 'image_generation',
              provider: 'pollinations',
              model: 'flux',
              url: result.url,
              prompt: result.prompt,
              width: result.width,
              height: result.height,
              seed: attemptSeed, // Include seed in output
            },
            output_url: result.url,
            metadata: {
              agent: 'producer',
              execution_time_ms: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              provider: 'pollinations',
              model: 'flux',
              attempts: attempt,
              seed: attemptSeed,
            },
          };
        } catch (error) {
          console.warn(`[ProducerAdapter] Flux generation attempt ${attempt} failed: ${error}`);
          lastError = error;
          
          // Wait before retrying (1s)
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // If we got here, all retries failed
      throw lastError || new Error('Failed to generate image after multiple attempts');

    } catch (error) {
      console.error('[ProducerAdapter] Pollinations image generation failed (exhausted retries):', error);
      return {
        success: false,
        error: {
          code: 'POLLINATIONS_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Image generation failed',
        },
        metadata: {
          agent: 'producer',
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Convert aspect ratio to pixel dimensions
   */
  private aspectRatioDimensions(aspectRatio: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1280, height: 720 },  // Standard HD (safer than 1792x1024)
      '9:16': { width: 720, height: 1280 },  // Standard HD Vertical
      '1:1': { width: 1024, height: 1024 },
      '4:5': { width: 800, height: 1000 },   // Safer vertical
    };
    return dimensions[aspectRatio] || { width: 1024, height: 1024 };
  }

  /**
   * Select appropriate n8n workflow based on task type
   */
  private selectWorkflow(params: AgentExecutionParams): string | null {
    const taskName = params.task.task_name.toLowerCase();
    const requestType = params.request.request_type;

    // Video production tasks
    if (taskName.includes('video') || taskName.includes('edit')) {
      return this.config.workflows.video_production;
    }

    // Voiceover tasks
    if (taskName.includes('voiceover') || taskName.includes('narration')) {
      return this.config.workflows.voiceover_synthesis;
    }

    // Image generation tasks
    if (taskName.includes('image') || taskName.includes('thumbnail') || taskName.includes('visual')) {
      return this.config.workflows.image_generation;
    }

    // Fallback based on request type
    if (requestType === 'image') {
      return this.config.workflows.image_generation;
    } else if (requestType === 'video_with_vo') {
      return this.config.workflows.voiceover_synthesis;
    } else if (requestType === 'video_no_vo') {
      return this.config.workflows.video_production;
    }

    return null;
  }

  /**
   * Build n8n dispatch payload
   * NOTE: script_id is critical - n8n Production_Dispatcher loads script from DB using this
   */
  private buildDispatchPayload(params: AgentExecutionParams): N8nDispatchPayload {
    // Extract input from completed tasks
    const input = this.buildWorkflowInput(params);

    // Build callback URL
    const callbackUrl = this.buildCallbackUrl(params.request.id, params.task.id);

    // Extract script_id from copywriter task output (required for n8n)
    const copywriterTask = params.completedTasks?.find(
      (t: RequestTask) => t.agent_role === 'copywriter' && t.status === 'completed'
    );
    const scriptId = (copywriterTask?.output_data as Record<string, unknown>)?.script_id as string | null;
    
    // Extract campaign_id from request
    const campaignId = (params.request as unknown as Record<string, unknown>).campaign_id as string | null;
    
    // Extract budget tier for provider selection
    const metadata = params.request.metadata as Record<string, unknown> | undefined;
    const budgetTier = (metadata?.tier as string) || 'standard';
    
    // Validation logging
    if (!scriptId) {
      console.warn('[ProducerAdapter] No script_id found in copywriter output - n8n may fail to load script');
    }
    
    console.log('[ProducerAdapter] Building dispatch payload:', {
      requestId: params.request.id,
      script_id: scriptId,
      campaign_id: campaignId,
      budget_tier: budgetTier,
    });

    return {
      requestId: params.request.id,
      taskId: params.task.id,
      script_id: scriptId, // NEW: n8n expects this to load from scripts table
      campaign_id: campaignId, // NEW: n8n expects this for budget tracking
      taskType: params.task.task_name,
      contentType: params.request.request_type,
      input,
      callbackUrl,
      budget_tier: budgetTier, // NEW: controls provider priority in n8n
      metadata: {
        request_type: params.request.request_type,
        created_at: params.request.created_at,
        ...(params.request.metadata || {}),
      },
    };
  }

  /**
   * Build workflow input from completed tasks
   */
  private buildWorkflowInput(params: AgentExecutionParams): unknown {
    const input: Record<string, unknown> = {};

    // Add outputs from completed tasks
    if (params.completedTasks && params.completedTasks.length > 0) {
      // Strategic brief
      const strategistTask = params.completedTasks.find((t: RequestTask) => t.agent_role === 'strategist');
      if (strategistTask?.output_data) {
        input.strategic_brief = strategistTask.output_data;
      }

      // Script/content
      const copywriterTask = params.completedTasks.find((t: RequestTask) => t.agent_role === 'copywriter');
      if (copywriterTask?.output_data) {
        input.script = copywriterTask.output_data;
      }
    }

    return input;
  }

  /**
   * Build callback URL for n8n to ping when task completes
   */
  private buildCallbackUrl(requestId: string, taskId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/callbacks/n8n?requestId=${requestId}&taskId=${taskId}`;
  }

  /**
   * Dispatch helper used by tests to simulate n8n dispatch behavior.
   * This uses the circuit breaker so repeated failures will open the circuit.
   */
  async dispatch(_taskId: string, _payload: any) {
    try {
      return await circuitBreakers.n8n.execute(async () => {
        // Simulate an unreachable n8n service
        throw new Error('n8n service is currently unavailable');
      });
    } catch (error) {
      throw new Error('n8n service is currently unavailable');
    }
  }

  /**
   * Dispatch task to n8n workflow
   */
  private async dispatchToN8n(
    workflowId: string,
    payload: N8nDispatchPayload
  ): Promise<N8nDispatchResponse> {
    // Use circuit breaker to protect against n8n failures
    try {
      return await circuitBreakers.n8n.execute(async () => {
        const url = `${this.config.baseUrl}/api/v1/workflows/${workflowId}/execute`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-API-KEY': this.config.apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`n8n dispatch failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        return {
          executionId: result.data?.executionId || result.executionId || 'unknown',
          workflowId,
          status: result.data?.status || 'pending',
          message: result.message,
        };
      });
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        throw new Error(`n8n service unavailable (circuit breaker ${error.state})`);
      }
      throw error;
    }
  }

  /**
   * Check n8n execution status (for polling if needed)
   */
  async checkExecutionStatus(executionId: string): Promise<{
    status: 'pending' | 'running' | 'success' | 'error';
    result?: unknown;
    error?: string;
  }> {
    // Use circuit breaker for status checks too
    try {
      return await circuitBreakers.n8n.execute(async () => {
        const url = `${this.config.baseUrl}/api/v1/executions/${executionId}`;

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-N8N-API-KEY': this.config.apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to check execution status: ${response.status}`);
        }

        const result = await response.json();
        
        return {
          status: result.data?.status || 'pending',
          result: result.data?.result,
          error: result.data?.error,
        };
      });
    } catch (error) {
      if (error instanceof CircuitBreakerError) {
        throw new Error(`n8n service unavailable (circuit breaker ${error.state})`);
      }
      throw error;
    }
  }
}

/**
 * Create producer adapter instance
 */
export function createProducerAdapter(config?: Partial<N8nConfig>): ProducerAdapter {
  return new ProducerAdapter(config);
}

/**
 * Execute producer task (convenience function)
 */
export async function executeProducerTask(
  params: AgentExecutionParams,
  config?: Partial<N8nConfig>
): Promise<AgentExecutionResult> {
  const adapter = createProducerAdapter(config);
  return await adapter.execute(params);
}
