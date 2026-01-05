/**
 * @jest-environment node
 */

import { StateMachine } from '@/lib/orchestrator/StateMachine';
import { RequestStatus, TaskStatus } from '@/lib/orchestrator/types';

describe('StateMachine', () => {
  let stateMachine: StateMachine;

  beforeEach(() => {
    stateMachine = new StateMachine();
  });

  describe('canTransition', () => {
    describe('from intake', () => {
      it('should allow transition to draft', () => {
        expect(stateMachine.canTransition('intake', 'draft')).toBe(true);
      });

      it('should allow transition to cancelled', () => {
        expect(stateMachine.canTransition('intake', 'cancelled')).toBe(true);
      });

      it('should NOT allow transition to production', () => {
        expect(stateMachine.canTransition('intake', 'production')).toBe(false);
      });

      it('should NOT allow transition to qa', () => {
        expect(stateMachine.canTransition('intake', 'qa')).toBe(false);
      });

      it('should NOT allow transition to published', () => {
        expect(stateMachine.canTransition('intake', 'published')).toBe(false);
      });
    });

    describe('from draft', () => {
      it('should allow transition to production', () => {
        expect(stateMachine.canTransition('draft', 'production')).toBe(true);
      });

      it('should allow transition to cancelled', () => {
        expect(stateMachine.canTransition('draft', 'cancelled')).toBe(true);
      });

      it('should NOT allow transition back to intake', () => {
        expect(stateMachine.canTransition('draft', 'intake')).toBe(false);
      });

      it('should NOT allow skipping to qa', () => {
        expect(stateMachine.canTransition('draft', 'qa')).toBe(false);
      });
    });

    describe('from production', () => {
      it('should allow transition to qa', () => {
        expect(stateMachine.canTransition('production', 'qa')).toBe(true);
      });

      it('should allow transition to cancelled', () => {
        expect(stateMachine.canTransition('production', 'cancelled')).toBe(true);
      });

      it('should allow rollback to draft', () => {
        expect(stateMachine.canTransition('production', 'draft')).toBe(true);
      });

      it('should NOT allow transition to intake', () => {
        expect(stateMachine.canTransition('production', 'intake')).toBe(false);
      });

      it('should NOT allow skipping to published', () => {
        expect(stateMachine.canTransition('production', 'published')).toBe(false);
      });
    });

    describe('from qa', () => {
      it('should allow transition to published', () => {
        expect(stateMachine.canTransition('qa', 'published')).toBe(true);
      });

      it('should allow rollback to production', () => {
        expect(stateMachine.canTransition('qa', 'production')).toBe(true);
      });

      it('should allow transition to cancelled', () => {
        expect(stateMachine.canTransition('qa', 'cancelled')).toBe(true);
      });

      it('should NOT allow transition to intake or draft', () => {
        expect(stateMachine.canTransition('qa', 'intake')).toBe(false);
        expect(stateMachine.canTransition('qa', 'draft')).toBe(false);
      });
    });

    describe('terminal states', () => {
      it('should NOT allow any transitions from published', () => {
        expect(stateMachine.canTransition('published', 'draft')).toBe(false);
        expect(stateMachine.canTransition('published', 'intake')).toBe(false);
        expect(stateMachine.canTransition('published', 'production')).toBe(false);
        expect(stateMachine.canTransition('published', 'qa')).toBe(false);
        expect(stateMachine.canTransition('published', 'cancelled')).toBe(false);
      });

      it('should NOT allow any transitions from cancelled', () => {
        expect(stateMachine.canTransition('cancelled', 'draft')).toBe(false);
        expect(stateMachine.canTransition('cancelled', 'intake')).toBe(false);
        expect(stateMachine.canTransition('cancelled', 'production')).toBe(false);
        expect(stateMachine.canTransition('cancelled', 'qa')).toBe(false);
        expect(stateMachine.canTransition('cancelled', 'published')).toBe(false);
      });
    });
  });

  describe('getNextStatus', () => {
    it('should return draft from intake', () => {
      expect(stateMachine.getNextStatus('intake')).toBe('draft');
    });

    it('should return production from draft', () => {
      expect(stateMachine.getNextStatus('draft')).toBe('production');
    });

    it('should return qa from production', () => {
      expect(stateMachine.getNextStatus('production')).toBe('qa');
    });

    it('should return published from qa', () => {
      expect(stateMachine.getNextStatus('qa')).toBe('published');
    });

    it('should return null from published', () => {
      expect(stateMachine.getNextStatus('published')).toBeNull();
    });

    it('should return null from cancelled', () => {
      expect(stateMachine.getNextStatus('cancelled')).toBeNull();
    });
  });

  describe('getPreviousStatus', () => {
    it('should return null from intake', () => {
      expect(stateMachine.getPreviousStatus('intake')).toBeNull();
    });

    it('should return intake from draft', () => {
      expect(stateMachine.getPreviousStatus('draft')).toBe('intake');
    });

    it('should return draft from production', () => {
      expect(stateMachine.getPreviousStatus('production')).toBe('draft');
    });

    it('should return production from qa', () => {
      expect(stateMachine.getPreviousStatus('qa')).toBe('production');
    });

    it('should return qa from published', () => {
      expect(stateMachine.getPreviousStatus('published')).toBe('qa');
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for published', () => {
      expect(stateMachine.isTerminalStatus('published')).toBe(true);
    });

    it('should return true for cancelled', () => {
      expect(stateMachine.isTerminalStatus('cancelled')).toBe(true);
    });

    it('should return false for non-terminal statuses', () => {
      expect(stateMachine.isTerminalStatus('intake')).toBe(false);
      expect(stateMachine.isTerminalStatus('draft')).toBe(false);
      expect(stateMachine.isTerminalStatus('production')).toBe(false);
      expect(stateMachine.isTerminalStatus('qa')).toBe(false);
    });
  });

  describe('shouldAutoAdvance', () => {
    it('should return true for intake', () => {
      expect(stateMachine.shouldAutoAdvance('intake')).toBe(true);
    });

    it('should return true for draft', () => {
      expect(stateMachine.shouldAutoAdvance('draft')).toBe(true);
    });

    it('should return true for production', () => {
      expect(stateMachine.shouldAutoAdvance('production')).toBe(true);
    });

    it('should return false for qa (requires approval)', () => {
      expect(stateMachine.shouldAutoAdvance('qa')).toBe(false);
    });

    it('should return false for terminal states', () => {
      expect(stateMachine.shouldAutoAdvance('published')).toBe(false);
      expect(stateMachine.shouldAutoAdvance('cancelled')).toBe(false);
    });
  });

  describe('areTasksCompleteForStatus', () => {
    it('should return true for status with no required tasks', () => {
      const tasks: Array<{ agent_role: string; status: TaskStatus }> = [];
      expect(stateMachine.areTasksCompleteForStatus('intake', tasks)).toBe(true);
    });

    it('should return true when all required tasks are complete', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus },
        { agent_role: 'copywriter', status: 'completed' as TaskStatus },
      ];
      expect(stateMachine.areTasksCompleteForStatus('production', tasks)).toBe(true);
    });

    it('should return false when required tasks are missing', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus },
      ];
      expect(stateMachine.areTasksCompleteForStatus('production', tasks)).toBe(false);
    });

    it('should return false when required tasks are not complete', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus },
        { agent_role: 'copywriter', status: 'in_progress' as TaskStatus },
      ];
      expect(stateMachine.areTasksCompleteForStatus('production', tasks)).toBe(false);
    });
  });

  describe('getBlockingTasks', () => {
    it('should return empty array when all tasks complete', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus, task_name: 'Strategy' },
        { agent_role: 'copywriter', status: 'completed' as TaskStatus, task_name: 'Copywriting' },
      ];
      expect(stateMachine.getBlockingTasks('production', tasks)).toEqual([]);
    });

    it('should return blocking tasks when incomplete', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'in_progress' as TaskStatus, task_name: 'Strategy' },
        { agent_role: 'copywriter', status: 'pending' as TaskStatus, task_name: 'Copywriting' },
      ];
      const blocking = stateMachine.getBlockingTasks('production', tasks);
      expect(blocking).toContain('Strategy (in_progress)');
      expect(blocking).toContain('Copywriting (pending)');
    });

    it('should return missing tasks', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus, task_name: 'Strategy' },
      ];
      const blocking = stateMachine.getBlockingTasks('production', tasks);
      expect(blocking).toContain('copywriter (missing)');
    });
  });

  describe('validateTransition', () => {
    it('should validate valid transition without tasks', () => {
      const result = stateMachine.validateTransition('intake', 'draft');
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('draft');
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid transition', () => {
      const result = stateMachine.validateTransition('intake', 'production');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
      expect(result.error).toContain('intake → production');
    });

    it('should validate transition with complete tasks', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus, task_name: 'Strategy' },
        { agent_role: 'copywriter', status: 'completed' as TaskStatus, task_name: 'Copywriting' },
      ];
      const result = stateMachine.validateTransition('draft', 'production', tasks);
      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('production');
    });

    it('should reject transition with incomplete tasks', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'in_progress' as TaskStatus, task_name: 'Strategy' },
        { agent_role: 'copywriter', status: 'pending' as TaskStatus, task_name: 'Copywriting' },
      ];
      const result = stateMachine.validateTransition('draft', 'production', tasks);
      expect(result.success).toBe(false);
      expect(result.error).toContain('blocking tasks');
    });
  });

  describe('getCompletionPercentage', () => {
    it('should return correct percentages for each status', () => {
      expect(stateMachine.getCompletionPercentage('intake')).toBe(10);
      expect(stateMachine.getCompletionPercentage('draft')).toBe(40);
      expect(stateMachine.getCompletionPercentage('production')).toBe(70);
      expect(stateMachine.getCompletionPercentage('qa')).toBe(90);
      expect(stateMachine.getCompletionPercentage('published')).toBe(100);
      expect(stateMachine.getCompletionPercentage('cancelled')).toBe(0);
    });
  });

  describe('getStage', () => {
    it('should return correct stage for each status', () => {
      expect(stateMachine.getStage('intake').stage).toBe('planning');
      expect(stateMachine.getStage('draft').stage).toBe('planning');
      expect(stateMachine.getStage('production').stage).toBe('execution');
      expect(stateMachine.getStage('qa').stage).toBe('review');
      expect(stateMachine.getStage('published').stage).toBe('complete');
      expect(stateMachine.getStage('cancelled').stage).toBe('complete');
    });

    it('should return required tasks for each status', () => {
      expect(stateMachine.getStage('intake').requiredTasks).toEqual([]);
      expect(stateMachine.getStage('draft').requiredTasks).toEqual(['strategist', 'copywriter']);
      expect(stateMachine.getStage('production').requiredTasks).toEqual(['producer']);
      expect(stateMachine.getStage('qa').requiredTasks).toEqual(['qa']);
    });
  });

  describe('canAdvanceToNext', () => {
    it('should return true when can advance', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'completed' as TaskStatus, task_name: 'Strategy' },
        { agent_role: 'copywriter', status: 'completed' as TaskStatus, task_name: 'Copywriting' },
      ];
      const result = stateMachine.canAdvanceToNext('draft', tasks);
      expect(result.canAdvance).toBe(true);
      expect(result.nextStatus).toBe('production');
    });

    it('should return false when tasks incomplete', () => {
      const tasks = [
        { agent_role: 'strategist', status: 'in_progress' as TaskStatus, task_name: 'Strategy' },
      ];
      const result = stateMachine.canAdvanceToNext('draft', tasks);
      expect(result.canAdvance).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should return false at terminal status', () => {
      const result = stateMachine.canAdvanceToNext('published', []);
      expect(result.canAdvance).toBe(false);
      expect(result.reason).toContain('terminal state');
    });
  });

  describe('helper methods', () => {
    it('hasFailedTasks should detect failed tasks', () => {
      const tasksWithFailure = [
        { status: 'completed' as TaskStatus },
        { status: 'failed' as TaskStatus },
      ];
      expect(stateMachine.hasFailedTasks(tasksWithFailure)).toBe(true);

      const tasksWithoutFailure = [
        { status: 'completed' as TaskStatus },
        { status: 'pending' as TaskStatus },
      ];
      expect(stateMachine.hasFailedTasks(tasksWithoutFailure)).toBe(false);
    });

    it('hasRunningTasks should detect in_progress tasks', () => {
      const tasksWithRunning = [
        { status: 'completed' as TaskStatus },
        { status: 'in_progress' as TaskStatus },
      ];
      expect(stateMachine.hasRunningTasks(tasksWithRunning)).toBe(true);

      const tasksWithoutRunning = [
        { status: 'completed' as TaskStatus },
        { status: 'pending' as TaskStatus },
      ];
      expect(stateMachine.hasRunningTasks(tasksWithoutRunning)).toBe(false);
    });

    it('areAllTasksComplete should check all tasks', () => {
      const allComplete = [
        { status: 'completed' as TaskStatus },
        { status: 'completed' as TaskStatus },
      ];
      expect(stateMachine.areAllTasksComplete(allComplete)).toBe(true);

      const notAllComplete = [
        { status: 'completed' as TaskStatus },
        { status: 'pending' as TaskStatus },
      ];
      expect(stateMachine.areAllTasksComplete(notAllComplete)).toBe(false);

      expect(stateMachine.areAllTasksComplete([])).toBe(false);
    });
  });
});
