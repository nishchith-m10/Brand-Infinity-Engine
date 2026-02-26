/**
 * @jest-environment node
 */

import { TaskFactory } from '@/lib/orchestrator/TaskFactory';
import { RequestType, ContentRequest, AgentRole } from '@/lib/orchestrator/types';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => Promise.resolve({
          data: mockInsertedTasks,
          error: null,
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: mockTasks,
            error: null,
          })),
          limit: jest.fn(() => Promise.resolve({
            data: mockTasks,
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

let mockInsertedTasks: any[] = [];
let mockTasks: any[] = [];

describe('TaskFactory', () => {
  let taskFactory: TaskFactory;

  beforeEach(() => {
    taskFactory = new TaskFactory();
    mockInsertedTasks = [];
    mockTasks = [];
  });

  describe('getTemplatesForRequestType', () => {
    it('should return templates for video_with_vo', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_with_vo');
      expect(templates).toHaveLength(6);
      expect(templates[0].agent_role).toBe('executive');
      expect(templates[1].agent_role).toBe('task_planner');
      expect(templates[2].agent_role).toBe('strategist');
      expect(templates[3].agent_role).toBe('copywriter');
      expect(templates[4].agent_role).toBe('producer');
      expect(templates[5].agent_role).toBe('qa');
    });

    it('should return templates for video_no_vo', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_no_vo');
      expect(templates).toHaveLength(5);
      expect(templates.find((t: any) => t.agent_role === 'copywriter')).toBeUndefined();
    });

    it('should return templates for image', () => {
      const templates = taskFactory.getTemplatesForRequestType('image');
      expect(templates).toHaveLength(4);
      expect(templates[0].agent_role).toBe('executive');
      expect(templates[1].agent_role).toBe('strategist');
      expect(templates[2].agent_role).toBe('producer');
      expect(templates[3].agent_role).toBe('qa');
    });

    it('should throw error for unknown request type', () => {
      expect(() => {
        taskFactory.getTemplatesForRequestType('unknown' as RequestType);
      }).toThrow('Unknown request type');
    });
  });

  describe('getEstimatedTotalDuration', () => {
    it('should calculate total duration for video_with_vo', () => {
      const duration = taskFactory.getEstimatedTotalDuration('video_with_vo');
      // executive(5) + planner(10) + strategist(30) + copywriter(45) + producer(180) + qa(10) = 280
      expect(duration).toBe(280);
    });

    it('should calculate total duration for video_no_vo', () => {
      const duration = taskFactory.getEstimatedTotalDuration('video_no_vo');
      // executive(5) + planner(10) + strategist(25) + producer(180) + qa(10) = 230
      expect(duration).toBe(230);
    });

    it('should calculate total duration for image', () => {
      const duration = taskFactory.getEstimatedTotalDuration('image');
      // executive(5) + strategist(20) + producer(30) + qa(5) = 60
      expect(duration).toBe(60);
    });

    it('should return 0 for unknown request type', () => {
      const duration = taskFactory.getEstimatedTotalDuration('unknown' as RequestType);
      expect(duration).toBe(0);
    });
  });

  describe('getEstimatedDurationForTask', () => {
    it('should return duration for specific agent role', () => {
      const duration = taskFactory.getEstimatedDurationForTask('video_with_vo', 'copywriter');
      expect(duration).toBe(45);
    });

    it('should return 0 for non-existent agent role', () => {
      const duration = taskFactory.getEstimatedDurationForTask('image', 'copywriter');
      expect(duration).toBe(0);
    });

    it('should return 0 for unknown request type', () => {
      const duration = taskFactory.getEstimatedDurationForTask('unknown' as RequestType, 'strategist');
      expect(duration).toBe(0);
    });
  });

  describe('task template validation', () => {
    it('should have sequential sequence_order for all templates', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const orders = templates.map((t: any) => t.sequence_order);
        
        // Should start at 1
        expect(orders[0]).toBe(1);
        
        // Should be sequential
        for (let i = 1; i < orders.length; i++) {
          expect(orders[i]).toBe(orders[i - 1] + 1);
        }
      });
    });

    it('should have valid dependencies', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_with_vo');
      
      // First task should have no dependencies
      expect(templates[0].dependencies).toEqual([]);
      
      // Subsequent tasks should depend on previous agent roles
      expect(templates[1].dependencies).toContain('executive');
      expect(templates[2].dependencies).toContain('task_planner');
      expect(templates[3].dependencies).toContain('strategist');
      expect(templates[4].dependencies).toContain('copywriter');
      expect(templates[5].dependencies).toContain('producer');
    });

    it('should have all required fields', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_with_vo');
      
      templates.forEach((template: any) => {
        expect(template.name).toBeDefined();
        expect(template.agent_role).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.sequence_order).toBeGreaterThan(0);
        expect(template.dependencies).toBeDefined();
        expect(template.estimatedDurationSeconds).toBeGreaterThan(0);
        expect(typeof template.retryable).toBe('boolean');
      });
    });

    it('should have longer duration for producer tasks', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const producerTask = templates.find((t: any) => t.agent_role === 'producer');
        const otherTasks = templates.filter((t: any) => t.agent_role !== 'producer');
        
        expect(producerTask).toBeDefined();
        otherTasks.forEach((task: any) => {
          expect(producerTask!.estimatedDurationSeconds).toBeGreaterThan(task.estimatedDurationSeconds);
        });
      });
    });

    it('should have QA as final task for all request types', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const lastTask = templates[templates.length - 1];
        expect(lastTask.agent_role).toBe('qa');
      });
    });
  });

  describe('task dependency graph', () => {
    it('should create valid dependency chain for video_with_vo', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_with_vo');
      const roles = templates.map((t: any) => t.agent_role);
      
      // Verify chain: executive → task_planner → strategist → copywriter → producer → qa
      expect(roles).toEqual([
        'executive',
        'task_planner',
        'strategist',
        'copywriter',
        'producer',
        'qa',
      ]);
    });

    it('should skip copywriter for video_no_vo', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_no_vo');
      const roles = templates.map((t: any) => t.agent_role);
      
      expect(roles).not.toContain('copywriter');
      expect(roles).toContain('strategist');
      expect(roles).toContain('producer');
      
      // Producer should depend on strategist, not copywriter
      const producerTask = templates.find((t: any) => t.agent_role === 'producer');
      expect(producerTask?.dependencies).toContain('strategist');
      expect(producerTask?.dependencies).not.toContain('copywriter');
    });

    it('should have minimal tasks for image type', () => {
      const templates = taskFactory.getTemplatesForRequestType('image');
      const roles = templates.map((t: any) => t.agent_role);
      
      // Should skip task_planner and copywriter
      expect(roles).not.toContain('task_planner');
      expect(roles).not.toContain('copywriter');
      
      // Verify chain: executive → strategist → producer → qa
      expect(roles).toEqual([
        'executive',
        'strategist',
        'producer',
        'qa',
      ]);
    });
  });

  describe('retryable configuration', () => {
    it('should mark QA tasks as non-retryable', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const qaTask = templates.find((t: any) => t.agent_role === 'qa');
        expect(qaTask?.retryable).toBe(false);
      });
    });

    it('should mark all other tasks as retryable', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const nonQaTasks = templates.filter((t: any) => t.agent_role !== 'qa');

        nonQaTasks.forEach((task: any) => {
          expect(task.retryable).toBe(true);
        });
      });
    });
  });

  describe('task naming', () => {
    it('should have unique task names', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const names = templates.map((t: any) => t.name);
        const uniqueNames = new Set(names);
        
        expect(names.length).toBe(uniqueNames.size);
      });
    });

    it('should have descriptive task names', () => {
      const templates = taskFactory.getTemplatesForRequestType('video_with_vo');
      
      templates.forEach((template: any) => {
        expect(template.name.length).toBeGreaterThan(5);
        expect(template.description.length).toBeGreaterThan(10);
      });
    });
  });

  describe('agent role coverage', () => {
    it('should use only valid agent roles', () => {
      const validRoles: AgentRole[] = [
        'executive',
        'task_planner',
        'strategist',
        'copywriter',
        'producer',
        'qa',
      ];
      
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        templates.forEach((template: any) => {
          expect(validRoles).toContain(template.agent_role);
        });
      });
    });

    it('should include executive in all request types', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const hasExecutive = templates.some(t => t.agent_role === 'executive');
        expect(hasExecutive).toBe(true);
      });
    });

    it('should include strategist in all request types', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const hasStrategist = templates.some(t => t.agent_role === 'strategist');
        expect(hasStrategist).toBe(true);
      });
    });

    it('should include producer in all request types', () => {
      const requestTypes: RequestType[] = ['video_with_vo', 'video_no_vo', 'image'];
      
      requestTypes.forEach(type => {
        const templates = taskFactory.getTemplatesForRequestType(type);
        const hasProducer = templates.some(t => t.agent_role === 'producer');
        expect(hasProducer).toBe(true);
      });
    });
  });
});
