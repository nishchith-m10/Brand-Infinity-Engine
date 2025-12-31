/**
 * Producer Adapter
 * Dispatches production tasks to n8n workflows with callback integration
 * 
 * Purpose:
 * - Translate orchestrator's AgentExecutionParams to n8n workflow payload
 * - Dispatch to n8n with callback URLs for status updates
 * - Track n8n execution IDs and handle async completion
 * - Return standardized AgentExecutionResult (pending state)
 */

import type { 
  AgentExecutionParams, 
  AgentExecutionResult,
  RequestTask,
} from '@/lib/orchestrator/types';
import { circuitBreakers, CircuitBreakerError } from '@/lib/orchestrator/CircuitBreaker';

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
 */
interface N8nDispatchPayload {
  requestId: string;
  taskId: string;
  taskType: string;
  contentType: string;
  input: unknown;
  callbackUrl: string;
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
   * Execute producer task via n8n dispatch
   */
  async execute(params: AgentExecutionParams): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Determine workflow based on task type
      const workflowId = this.selectWorkflow(params);
      
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
   */
  private buildDispatchPayload(params: AgentExecutionParams): N8nDispatchPayload {
    // Extract input from completed tasks
    const input = this.buildWorkflowInput(params);

    // Build callback URL
    const callbackUrl = this.buildCallbackUrl(params.request.id, params.task.id);

    return {
      requestId: params.request.id,
      taskId: params.task.id,
      taskType: params.task.task_name,
      contentType: params.request.request_type,
      input,
      callbackUrl,
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
