/**
 * Orchestrator Metrics & Monitoring
 * 
 * Collects and tracks performance metrics for the orchestration system:
 * - Task execution duration and success rates
 * - Request throughput and completion times
 * - Agent performance metrics
 * - Provider (n8n) statistics
 * - Error rates and patterns
 * - Circuit breaker health
 */

import { createClient } from '@/lib/supabase/server';
import { circuitBreakerManager } from './CircuitBreaker';
import type { RequestTask, ContentRequest, AgentRole } from './types';

/**
 * Task Performance Metrics
 */
export interface TaskMetrics {
  task_name: string;
  assigned_to: AgentRole;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  average_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  p50_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
}

/**
 * Request Performance Metrics
 */
export interface RequestMetrics {
  request_type: string;
  total_requests: number;
  completed_requests: number;
  failed_requests: number;
  cancelled_requests: number;
  in_progress_requests: number;
  completion_rate: number;
  average_completion_time_ms: number;
  average_cost: number;
}

/**
 * Agent Performance Metrics
 */
export interface AgentMetrics {
  agent_role: AgentRole;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  success_rate: number;
  average_execution_time_ms: number;
  total_tokens_used: number;
  average_tokens_per_task: number;
}

/**
 * Provider Metrics (n8n, etc.)
 */
export interface ProviderMetrics {
  provider_name: string;
  total_dispatches: number;
  successful_completions: number;
  failed_completions: number;
  success_rate: number;
  average_callback_time_ms: number;
  circuit_breaker_status: 'healthy' | 'degraded' | 'unavailable';
}

/**
 * System Health Metrics
 */
export interface SystemHealthMetrics {
  uptime_seconds: number;
  total_requests_processed: number;
  requests_per_minute: number;
  active_requests: number;
  stuck_tasks_count: number;
  dlq_entries_count: number;
  circuit_breakers_open: number;
  overall_success_rate: number;
  average_request_duration_ms: number;
}

/**
 * Time-series data point
 */
export interface MetricDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

/**
 * Metrics Collector
 */
export class MetricsCollector {
  private startTime = Date.now();

  /**
   * Get task performance metrics.
   * 
   * @param since - Optional start date for metrics window
   * @returns Array of task metrics
   */
  async getTaskMetrics(since?: string): Promise<TaskMetrics[]> {
    const supabase = await createClient();

    let query = supabase
      .from('request_tasks')
      .select('task_name, assigned_to, status, started_at, completed_at, metadata');

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: tasks } = await query;

    if (!tasks || tasks.length === 0) return [];

    // Group by task name and agent
    const taskGroups = new Map<string, RequestTask[]>();
    
    for (const task of tasks as unknown as RequestTask[]) {
      const key = `${task.task_name}:${task.agent_role}`;
      if (!taskGroups.has(key)) {
        taskGroups.set(key, []);
      }
      taskGroups.get(key)!.push(task);
    }

    // Calculate metrics for each group
    const metrics: TaskMetrics[] = [];

    for (const [key, groupTasks] of taskGroups.entries()) {
      const [task_name, assigned_to] = key.split(':');
      const total = groupTasks.length;
      const successful = groupTasks.filter(t => t.status === 'completed').length;
      const failed = groupTasks.filter(t => t.status === 'failed').length;

      // Calculate durations
      const durations = groupTasks
        .filter(t => t.started_at && t.completed_at)
        .map(t => {
          const start = new Date(t.started_at!).getTime();
          const end = new Date(t.completed_at!).getTime();
          return end - start;
        })
        .sort((a, b) => a - b);

      const avgDuration = durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

      metrics.push({
        task_name,
        assigned_to: assigned_to as AgentRole,
        total_executions: total,
        successful_executions: successful,
        failed_executions: failed,
        success_rate: total > 0 ? (successful / total) * 100 : 0,
        average_duration_ms: avgDuration,
        min_duration_ms: durations[0] || 0,
        max_duration_ms: durations[durations.length - 1] || 0,
        p50_duration_ms: durations[Math.floor(durations.length * 0.5)] || 0,
        p95_duration_ms: durations[Math.floor(durations.length * 0.95)] || 0,
        p99_duration_ms: durations[Math.floor(durations.length * 0.99)] || 0,
      });
    }

    return metrics.sort((a, b) => b.total_executions - a.total_executions);
  }

  /**
   * Get request performance metrics.
   * 
   * @param since - Optional start date for metrics window
   * @returns Array of request metrics
   */
  async getRequestMetrics(since?: string): Promise<RequestMetrics[]> {
    const supabase = await createClient();

    let query = supabase
      .from('content_requests')
      .select('request_type, status, created_at, completed_at, estimated_cost');

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: requests } = await query;

    if (!requests || requests.length === 0) return [];

    // Group by request type
    const typeGroups = new Map<string, ContentRequest[]>();
    
    for (const request of requests as unknown as ContentRequest[]) {
      if (!typeGroups.has(request.request_type)) {
        typeGroups.set(request.request_type, []);
      }
      typeGroups.get(request.request_type)!.push(request);
    }

    // Calculate metrics for each type
    const metrics: RequestMetrics[] = [];

    for (const [request_type, groupRequests] of typeGroups.entries()) {
      const total = groupRequests.length;
      const completed = groupRequests.filter(r => r.status === 'published').length;
      const failed = 0; // Request-level 'failed' state is not part of RequestStatus enum
      const cancelled = groupRequests.filter(r => r.status === 'cancelled').length;
      const in_progress = groupRequests.filter(r => 
        ['intake', 'draft', 'production', 'qa', 'approval'].includes(r.status as string)
      ).length;

      // Calculate completion times
      const completionTimes = groupRequests
        .filter(r => r.created_at && r.completed_at)
        .map(r => {
          const start = new Date(r.created_at).getTime();
          const end = new Date(r.completed_at!).getTime();
          return end - start;
        });

      const avgCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length
        : 0;

      // Calculate average cost
      const costs = groupRequests
        .filter(r => r.estimated_cost)
        .map(r => r.estimated_cost!);

      const avgCost = costs.length > 0
        ? costs.reduce((sum, c) => sum + c, 0) / costs.length
        : 0;

      metrics.push({
        request_type,
        total_requests: total,
        completed_requests: completed,
        failed_requests: failed,
        cancelled_requests: cancelled,
        in_progress_requests: in_progress,
        completion_rate: total > 0 ? (completed / total) * 100 : 0,
        average_completion_time_ms: avgCompletionTime,
        average_cost: avgCost,
      });
    }

    return metrics;
  }

  /**
   * Get agent performance metrics.
   * 
   * @param since - Optional start date for metrics window
   * @returns Array of agent metrics
   */
  async getAgentMetrics(since?: string): Promise<AgentMetrics[]> {
    const supabase = await createClient();

    let query = supabase
      .from('request_tasks')
      .select('assigned_to, status, started_at, completed_at, output_data');

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: tasks } = await query;

    if (!tasks || tasks.length === 0) return [];

    // Group by agent role
    const agentGroups = new Map<string, RequestTask[]>();
    
    for (const task of tasks as RequestTask[]) {
      if (!agentGroups.has(task.assigned_to)) {
        agentGroups.set(task.assigned_to, []);
      }
      agentGroups.get(task.assigned_to)!.push(task);
    }

    // Calculate metrics for each agent
    const metrics: AgentMetrics[] = [];

    for (const [agent_role, groupTasks] of agentGroups.entries()) {
      const total = groupTasks.length;
      const successful = groupTasks.filter(t => t.status === 'completed').length;
      const failed = groupTasks.filter(t => t.status === 'failed').length;

      // Calculate execution times
      const executionTimes = groupTasks
        .filter(t => t.started_at && t.completed_at)
        .map(t => {
          const start = new Date(t.started_at!).getTime();
          const end = new Date(t.completed_at!).getTime();
          return end - start;
        });

      const avgExecutionTime = executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0;

      // Calculate token usage (for AI agents)
      const tokens = groupTasks
        .map(t => (t.output_data as any)?.tokens_used || 0)
        .filter(t => t > 0);

      const totalTokens = tokens.reduce((sum, t) => sum + t, 0);
      const avgTokens = tokens.length > 0 ? totalTokens / tokens.length : 0;

      metrics.push({
        agent_role: agent_role as AgentRole,
        total_tasks: total,
        successful_tasks: successful,
        failed_tasks: failed,
        success_rate: total > 0 ? (successful / total) * 100 : 0,
        average_execution_time_ms: avgExecutionTime,
        total_tokens_used: totalTokens,
        average_tokens_per_task: avgTokens,
      });
    }

    return metrics.sort((a, b) => b.total_tasks - a.total_tasks);
  }

  /**
   * Get provider metrics (n8n, etc.).
   * 
   * @param since - Optional start date for metrics window
   * @returns Array of provider metrics
   */
  async getProviderMetrics(since?: string): Promise<ProviderMetrics[]> {
    const supabase = await createClient();

    let query = supabase
      .from('provider_metadata')
      .select('provider_name, created_at, metadata');

    if (since) {
      query = query.gte('created_at', since);
    }

    const { data: metadata } = await query;

    if (!metadata || metadata.length === 0) return [];

    // Group by provider
    const providerGroups = new Map<string, typeof metadata>();
    
    for (const item of metadata) {
      if (!providerGroups.has(item.provider_name)) {
        providerGroups.set(item.provider_name, []);
      }
      providerGroups.get(item.provider_name)!.push(item);
    }

    // Calculate metrics for each provider
    const metrics: ProviderMetrics[] = [];

    for (const [provider_name, groupMetadata] of providerGroups.entries()) {
      const total = groupMetadata.length;
      
      // Count successes/failures from metadata
      const successful = groupMetadata.filter(m => 
        (m.metadata as any)?.status === 'completed' ||
        (m.metadata as any)?.completed_at
      ).length;
      
      const failed = total - successful;

      // Get circuit breaker status
      const circuitHealth = circuitBreakerManager.getHealthStatus();
      let cbStatus: 'healthy' | 'degraded' | 'unavailable' = 'healthy';
      
      if (circuitHealth.has(provider_name)) {
        cbStatus = circuitHealth.get(provider_name) ? 'healthy' : 'unavailable';
      }

      metrics.push({
        provider_name,
        total_dispatches: total,
        successful_completions: successful,
        failed_completions: failed,
        success_rate: total > 0 ? (successful / total) * 100 : 0,
        average_callback_time_ms: 0, // Would need timestamp tracking
        circuit_breaker_status: cbStatus,
      });
    }

    return metrics;
  }

  /**
   * Get overall system health metrics.
   * 
   * @returns System health summary
   */
  async getSystemHealth(): Promise<SystemHealthMetrics> {
    const supabase = await createClient();

    // Get total requests
    const { count: totalRequests } = await supabase
      .from('content_requests')
      .select('*', { count: 'exact', head: true });

    // Get active requests
    const { count: activeRequests } = await supabase
      .from('content_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['intake', 'draft', 'production', 'qa']);

    // Get stuck tasks (in progress > 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { count: stuckTasks } = await supabase
      .from('request_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .lt('started_at', twoHoursAgo);

    // Get DLQ entries
    const { count: dlqEntries } = await supabase
      .from('request_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'error')
      .like('description', '%Dead Letter Queue%');

    // Get circuit breaker status
    const circuitStats = circuitBreakerManager.getAllStats();
    const openCircuits = Array.from(circuitStats.values()).filter(
      s => s.state === 'OPEN'
    ).length;

    // Calculate uptime
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    // Get requests per minute (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentRequests } = await supabase
      .from('content_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    const requestsPerMinute = (recentRequests || 0) / 60;

    return {
      uptime_seconds: uptimeSeconds,
      total_requests_processed: totalRequests || 0,
      requests_per_minute: requestsPerMinute,
      active_requests: activeRequests || 0,
      stuck_tasks_count: stuckTasks || 0,
      dlq_entries_count: dlqEntries || 0,
      circuit_breakers_open: openCircuits,
      overall_success_rate: 0, // Would need to calculate from completed requests
      average_request_duration_ms: 0, // Would need to calculate from timestamps
    };
  }

  /**
   * Get time-series data for a metric.
   * 
   * @param metric - Metric name
   * @param interval - Time interval (hour, day, week)
   * @param points - Number of data points
   * @returns Array of metric data points
   */
  async getTimeSeries(
    metric: 'requests' | 'tasks' | 'errors',
    interval: 'hour' | 'day' | 'week' = 'hour',
    points: number = 24
  ): Promise<MetricDataPoint[]> {
    // Placeholder - would implement actual time-series queries
    return [];
  }
}

/**
 * Singleton instance
 */
export const metricsCollector = new MetricsCollector();

/**
 * Export class for testing
 */
export default MetricsCollector;
