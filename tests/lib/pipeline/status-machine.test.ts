import {
  canTransition,
  getNextStatus,
  isTerminalStatus,
  getStageForStatus,
  validateTransition,
  getStatusLabel,
  getStatusColor
} from '@/lib/pipeline/status-machine';

describe('Status Machine', () => {
  describe('canTransition', () => {
    describe('from intake', () => {
      it('should allow transition to draft', () => {
        expect(canTransition('intake', 'draft')).toBe(true);
      });
      
      it('should allow transition to cancelled', () => {
        expect(canTransition('intake', 'cancelled')).toBe(true);
      });
      
      it('should NOT allow transition to production', () => {
        expect(canTransition('intake', 'production')).toBe(false);
      });
      
      it('should NOT allow transition to qa', () => {
        expect(canTransition('intake', 'qa')).toBe(false);
      });
      
      it('should NOT allow transition to published', () => {
        expect(canTransition('intake', 'published')).toBe(false);
      });
    });
    
    describe('from draft', () => {
      it('should allow transition to production', () => {
        expect(canTransition('draft', 'production')).toBe(true);
      });
      
      it('should allow transition to cancelled', () => {
        expect(canTransition('draft', 'cancelled')).toBe(true);
      });
      
      it('should NOT allow transition back to intake', () => {
        expect(canTransition('draft', 'intake')).toBe(false);
      });
      
      it('should NOT allow skipping to qa', () => {
        expect(canTransition('draft', 'qa')).toBe(false);
      });
    });
    
    describe('from production', () => {
      it('should allow transition to qa', () => {
        expect(canTransition('production', 'qa')).toBe(true);
      });
      
      it('should allow transition to cancelled', () => {
        expect(canTransition('production', 'cancelled')).toBe(true);
      });
      
      it('should NOT allow transition backward', () => {
        expect(canTransition('production', 'draft')).toBe(false);
        expect(canTransition('production', 'intake')).toBe(false);
      });
      
      it('should NOT allow skipping to published', () => {
        expect(canTransition('production', 'published')).toBe(false);
      });
    });
    
    describe('from qa', () => {
      it('should allow transition to published', () => {
        expect(canTransition('qa', 'published')).toBe(true);
      });
      
      it('should allow transition back to draft for rework', () => {
        expect(canTransition('qa', 'draft')).toBe(true);
      });
      
      it('should allow transition to cancelled', () => {
        expect(canTransition('qa', 'cancelled')).toBe(true);
      });
      
      it('should NOT allow skipping back to intake', () => {
        expect(canTransition('qa', 'intake')).toBe(false);
      });
    });
    
    describe('from terminal states', () => {
      it('should NOT allow any transitions from published', () => {
        expect(canTransition('published', 'draft')).toBe(false);
        expect(canTransition('published', 'intake')).toBe(false);
        expect(canTransition('published', 'production')).toBe(false);
        expect(canTransition('published', 'qa')).toBe(false);
        expect(canTransition('published', 'cancelled')).toBe(false);
      });
      
      it('should NOT allow any transitions from cancelled', () => {
        expect(canTransition('cancelled', 'draft')).toBe(false);
        expect(canTransition('cancelled', 'intake')).toBe(false);
        expect(canTransition('cancelled', 'production')).toBe(false);
        expect(canTransition('cancelled', 'qa')).toBe(false);
        expect(canTransition('cancelled', 'published')).toBe(false);
      });
    });
  });
  
  describe('getNextStatus', () => {
    it('should return draft for intake', () => {
      expect(getNextStatus('intake')).toBe('draft');
    });
    
    it('should return production for draft', () => {
      expect(getNextStatus('draft')).toBe('production');
    });
    
    it('should return qa for production', () => {
      expect(getNextStatus('production')).toBe('qa');
    });
    
    it('should return published for qa', () => {
      expect(getNextStatus('qa')).toBe('published');
    });
    
    it('should return null for terminal states', () => {
      expect(getNextStatus('published')).toBeNull();
      expect(getNextStatus('cancelled')).toBeNull();
    });
  });
  
  describe('isTerminalStatus', () => {
    it('should return true for published', () => {
      expect(isTerminalStatus('published')).toBe(true);
    });
    
    it('should return true for cancelled', () => {
      expect(isTerminalStatus('cancelled')).toBe(true);
    });
    
    it('should return false for all other statuses', () => {
      expect(isTerminalStatus('intake')).toBe(false);
      expect(isTerminalStatus('draft')).toBe(false);
      expect(isTerminalStatus('production')).toBe(false);
      expect(isTerminalStatus('qa')).toBe(false);
    });
  });
  
  describe('getStageForStatus', () => {
    it('should return correct stages', () => {
      expect(getStageForStatus('intake')).toBe('planning');
      expect(getStageForStatus('draft')).toBe('planning');
      expect(getStageForStatus('production')).toBe('execution');
      expect(getStageForStatus('qa')).toBe('review');
      expect(getStageForStatus('published')).toBe('complete');
      expect(getStageForStatus('cancelled')).toBe('complete');
    });
  });
  
  describe('validateTransition', () => {
    it('should return valid for allowed transitions', () => {
      const result = validateTransition('intake', 'draft');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
    
    it('should return error for invalid transitions', () => {
      const result = validateTransition('intake', 'published');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('intake');
      expect(result.error).toContain('published');
    });
    
    it('should return error for terminal state transitions', () => {
      const result = validateTransition('published', 'draft');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('terminal');
    });
    
    it('should include suggestion for invalid transitions', () => {
      const result = validateTransition('intake', 'production');
      expect(result.valid).toBe(false);
      expect(result.suggestion).toBeDefined();
      expect(result.suggestion).toContain('draft');
    });
  });
  
  describe('getStatusLabel', () => {
    it('should return human-readable labels', () => {
      expect(getStatusLabel('intake')).toBe('Intake');
      expect(getStatusLabel('draft')).toBe('Draft');
      expect(getStatusLabel('production')).toBe('In Production');
      expect(getStatusLabel('qa')).toBe('Quality Assurance');
      expect(getStatusLabel('published')).toBe('Published');
      expect(getStatusLabel('cancelled')).toBe('Cancelled');
    });
  });
  
  describe('getStatusColor', () => {
    it('should return appropriate colors', () => {
      expect(getStatusColor('intake')).toBe('gray');
      expect(getStatusColor('draft')).toBe('blue');
      expect(getStatusColor('production')).toBe('yellow');
      expect(getStatusColor('qa')).toBe('purple');
      expect(getStatusColor('published')).toBe('green');
      expect(getStatusColor('cancelled')).toBe('red');
    });
  });
  
  describe('workflow scenarios', () => {
    it('should allow happy path: intake -> draft -> production -> qa -> published', () => {
      expect(canTransition('intake', 'draft')).toBe(true);
      expect(canTransition('draft', 'production')).toBe(true);
      expect(canTransition('production', 'qa')).toBe(true);
      expect(canTransition('qa', 'published')).toBe(true);
    });
    
    it('should allow cancellation from any non-terminal state', () => {
      expect(canTransition('intake', 'cancelled')).toBe(true);
      expect(canTransition('draft', 'cancelled')).toBe(true);
      expect(canTransition('production', 'cancelled')).toBe(true);
      expect(canTransition('qa', 'cancelled')).toBe(true);
    });
    
    it('should allow QA rejection: qa -> draft', () => {
      expect(canTransition('qa', 'draft')).toBe(true);
    });
    
    it('should NOT allow skipping stages', () => {
      expect(canTransition('intake', 'production')).toBe(false);
      expect(canTransition('draft', 'qa')).toBe(false);
      expect(canTransition('intake', 'published')).toBe(false);
    });
  });
});
