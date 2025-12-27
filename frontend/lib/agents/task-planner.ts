/**
 * Task Planner - Decompose intent into executable tasks
 * Slice 6: Task Planning & Delegation
 */

import { getLLMService } from '@/lib/llm';
import type {
  ParsedIntent,
  TaskPlan,
  SubTask,
  DelegationPlan,
} from './types';
import { AGENT_TEMPERATURES, AGENT_MAX_TOKENS } from './config';

export class TaskPlanner {
  private llmService = getLLMService();
  private plannerModel: string;

  constructor(tier: 'premium' | 'budget' = 'premium') {
    this.plannerModel = this.llmService.selectModel('executive', tier);
  }

  /**
   * Generate task plan from parsed intent
   */
  async createTaskPlan(intent: ParsedIntent): Promise<TaskPlan> {
    const systemPrompt = `You are a Task Planning Agent for content creation.
Break down the user's intent into specific, executable tasks.

Each task should have:
- id: unique identifier
- type: "strategy" | "copywriting" | "production"
- description: what needs to be done
- agent: which agent handles it (strategist, copywriter, producer)
- dependencies: array of task IDs that must complete first
- estimated_duration: minutes
- priority: 1-5 (5 = highest)

Rules:
1. Strategy tasks come first (no dependencies)
2. Copywriting depends on strategy
3. Production depends on copywriting
4. Keep it realistic (max 10 tasks)

Return ONLY valid JSON with this structure:
{
  "tasks": [...],
  "estimated_total_time": number,
  "complexity": "simple" | "moderate" | "complex"
}`;

    const userPrompt = `Create task plan for:

Content Types: ${intent.content_types.join(', ')}
Goal: ${intent.campaign_goal}
Target Audience: ${JSON.stringify(intent.target_audience)}
Tone: ${intent.tone}
Platforms: ${intent.platform.join(', ')}
Key Messages: ${intent.key_messages.join(', ')}

Break this into specific tasks.`;

    const response = await this.llmService.generateCompletion({
      model: this.plannerModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: AGENT_TEMPERATURES.strategist,
      maxTokens: AGENT_MAX_TOKENS.strategist,
      responseFormat: 'json',
    });

    try {
      const parsed = JSON.parse(response.content);
      
      return {
        id: `plan_${Date.now()}`,
        session_id: '',
        tasks: parsed.tasks || [],
        status: 'pending',
        created_at: new Date().toISOString(),
        estimated_completion: this.calculateEstimatedCompletion(parsed.estimated_total_time || 60),
        complexity: parsed.complexity || 'moderate',
      };
    } catch (error) {
      console.error('[TaskPlanner] Failed to parse plan:', error);
      
      // Return default simple plan
      return this.createDefaultPlan(intent);
    }
  }

  /**
   * Create default fallback plan
   */
  private createDefaultPlan(intent: ParsedIntent): TaskPlan {
    const tasks: SubTask[] = [];
    let taskId = 1;

    // Strategy task
    tasks.push({
      id: `task_${taskId++}`,
      type: 'strategy',
      description: `Create strategic brief for ${intent.campaign_goal} campaign`,
      agent: 'strategist',
      status: 'pending',
      dependencies: [],
      priority: 5,
      estimated_duration: 15,
    });

    // Copywriting tasks
    if (intent.content_types.includes('script')) {
      tasks.push({
        id: `task_${taskId++}`,
        type: 'copywriting',
        description: 'Write video script',
        agent: 'copywriter',
        status: 'pending',
        dependencies: ['task_1'],
        priority: 4,
        estimated_duration: 30,
      });
    }

    if (intent.content_types.includes('social_post')) {
      tasks.push({
        id: `task_${taskId++}`,
        type: 'copywriting',
        description: 'Create social media posts',
        agent: 'copywriter',
        status: 'pending',
        dependencies: ['task_1'],
        priority: 3,
        estimated_duration: 20,
      });
    }

    // Production task
    tasks.push({
      id: `task_${taskId++}`,
      type: 'production',
      description: 'Coordinate content production',
      agent: 'producer',
      status: 'pending',
      dependencies: tasks.filter(t => t.type === 'copywriting').map(t => t.id),
      priority: 2,
      estimated_duration: 45,
    });

    const totalTime = tasks.reduce((sum, t) => sum + t.estimated_duration, 0);

    return {
      id: `plan_${Date.now()}`,
      session_id: '',
      tasks,
      status: 'pending',
      created_at: new Date().toISOString(),
      estimated_completion: this.calculateEstimatedCompletion(totalTime),
      complexity: tasks.length > 5 ? 'complex' : 'moderate',
    };
  }

  /**
   * Calculate estimated completion timestamp
   */
  private calculateEstimatedCompletion(minutes: number): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now.toISOString();
  }

  /**
   * Get next executable tasks (no pending dependencies)
   */
  getNextTasks(plan: TaskPlan): SubTask[] {
    const completedTaskIds = plan.tasks
      .filter(t => t.status === 'completed')
      .map(t => t.id);

    return plan.tasks.filter(task => {
      // Skip if already completed or in progress
      if (task.status !== 'pending') return false;

      // Check if all dependencies are completed
      return task.dependencies.every(depId => completedTaskIds.includes(depId));
    });
  }

  /**
   * Create delegation plan for next batch of tasks
   */
  async createDelegationPlan(
    tasks: SubTask[],
    intent: ParsedIntent
  ): Promise<DelegationPlan> {
    // Group tasks by agent
    const tasksByAgent: Record<string, SubTask[]> = {};
    
    for (const task of tasks) {
      if (!tasksByAgent[task.agent]) {
        tasksByAgent[task.agent] = [];
      }
      tasksByAgent[task.agent].push(task);
    }

    // Create delegation instructions
    const delegations = Object.entries(tasksByAgent).map(([agent, agentTasks]) => ({
      agent: agent as any,
      tasks: agentTasks.map(t => t.id),
      instructions: this.generateAgentInstructions(agent, agentTasks, intent),
      priority: Math.max(...agentTasks.map(t => t.priority)),
    }));

    return {
      delegations,
      parallel: delegations.length > 1, // Can execute in parallel if multiple agents
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Generate instructions for specific agent
   */
  private generateAgentInstructions(
    agent: string,
    tasks: SubTask[],
    intent: ParsedIntent
  ): string {
    const taskDescriptions = tasks.map(t => `- ${t.description}`).join('\n');

    const context = `
Goal: ${intent.campaign_goal}
Audience: ${JSON.stringify(intent.target_audience)}
Tone: ${intent.tone}
Platforms: ${intent.platform.join(', ')}
Key Messages: ${intent.key_messages.join(', ')}
`;

    return `${agent.toUpperCase()} TASKS:\n${taskDescriptions}\n\nCONTEXT:${context}`;
  }

  /**
   * Mark task as completed and update plan
   */
  updateTaskStatus(
    plan: TaskPlan,
    taskId: string,
    status: SubTask['status'],
    result?: any
  ): TaskPlan {
    return {
      ...plan,
      tasks: plan.tasks.map(task =>
        task.id === taskId
          ? { ...task, status, result, completed_at: new Date().toISOString() }
          : task
      ),
      status: this.calculatePlanStatus(plan),
    };
  }

  /**
   * Calculate overall plan status
   */
  private calculatePlanStatus(plan: TaskPlan): TaskPlan['status'] {
    const allCompleted = plan.tasks.every(t => t.status === 'completed');
    const anyFailed = plan.tasks.some(t => t.status === 'failed');
    const anyInProgress = plan.tasks.some(t => t.status === 'in_progress');

    if (allCompleted) return 'completed';
    if (anyFailed) return 'failed';
    if (anyInProgress) return 'in_progress';
    return 'pending';
  }

  /**
   * Get plan progress percentage
   */
  getProgress(plan: TaskPlan): number {
    const completed = plan.tasks.filter(t => t.status === 'completed').length;
    return Math.round((completed / plan.tasks.length) * 100);
  }
}

/**
 * Create task planner instance
 */
export function createTaskPlanner(tier: 'premium' | 'budget' = 'premium'): TaskPlanner {
  return new TaskPlanner(tier);
}

