import { createInitialTasks } from '@/lib/pipeline/task-factory';

describe('createInitialTasks', () => {
  describe('video_with_vo requests', () => {
    it('should create all required tasks', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      expect(tasks.length).toBeGreaterThan(0);
      
      // Verify required tasks exist
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).toContain('generate_script');
      expect(taskNames).toContain('generate_voiceover');
      expect(taskNames).toContain('generate_video');
      expect(taskNames).toContain('compose_final');
    });
    
    it('should set correct sequence order', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      // Check that sequence_order is sequential starting from 1
      const orders = tasks.map((t: any) => t.sequence_order).sort((a: number, b: number) => a - b);
      expect(orders[0]).toBe(1);
      expect(orders[orders.length - 1]).toBe(tasks.length);
      
      // Check no duplicates
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(tasks.length);
    });
    
    it('should set correct agent roles', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      const scriptTask = tasks.find((t: any) => t.name === 'generate_script');
      const voiceTask = tasks.find((t: any) => t.name === 'generate_voiceover');
      const videoTask = tasks.find((t: any) => t.name === 'generate_video');
      
      expect(scriptTask?.agent_role).toBe('script_writer');
      expect(voiceTask?.agent_role).toBe('voice_generator');
      expect(videoTask?.agent_role).toBe('video_generator');
    });
    
    it('should set all tasks to pending status', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      expect(tasks.every((t: any) => t.status === 'pending')).toBe(true);
    });
  });
  
  describe('video_no_vo requests', () => {
    it('should not include voiceover task', () => {
      const tasks = createInitialTasks({
        type: 'video_no_vo',
        autoScript: true,
        hasVoiceover: false
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).not.toContain('generate_voiceover');
    });
    
    it('should include video generation task', () => {
      const tasks = createInitialTasks({
        type: 'video_no_vo',
        autoScript: true,
        hasVoiceover: false
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).toContain('generate_video');
    });
  });
  
  describe('image requests', () => {
    it('should create minimal task set', () => {
      const tasks = createInitialTasks({
        type: 'image',
        autoScript: false,
        hasVoiceover: false
      });
      
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThan(5); // Images are simpler
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).toContain('generate_image');
    });
    
    it('should not include voiceover or video tasks', () => {
      const tasks = createInitialTasks({
        type: 'image',
        autoScript: false,
        hasVoiceover: false
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).not.toContain('generate_voiceover');
      expect(taskNames).not.toContain('generate_video');
    });
  });
  
  describe('text requests', () => {
    it('should create text generation task', () => {
      const tasks = createInitialTasks({
        type: 'text',
        autoScript: false,
        hasVoiceover: false
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).toContain('generate_text');
    });
    
    it('should have minimal complexity', () => {
      const tasks = createInitialTasks({
        type: 'text',
        autoScript: false,
        hasVoiceover: false
      });
      
      expect(tasks.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('carousel requests', () => {
    it('should create carousel-specific tasks', () => {
      const tasks = createInitialTasks({
        type: 'carousel',
        autoScript: false,
        hasVoiceover: false
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames.some((name: string) => name.includes('carousel') || name.includes('slide'))).toBe(true);
    });
  });
  
  describe('script handling', () => {
    it('should include script generation when autoScript is true', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).toContain('generate_script');
    });
    
    it('should not include script generation when autoScript is false', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: false,
        hasVoiceover: true
      });
      
      const taskNames = tasks.map((t: any) => t.name);
      expect(taskNames).not.toContain('generate_script');
    });
  });
  
  describe('task properties', () => {
    it('should set retry_count to 0', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      expect(tasks.every((t: any) => t.retry_count === 0)).toBe(true);
    });
    
    it('should not set started_at or completed_at', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      expect(tasks.every((t: any) => t.started_at === undefined)).toBe(true);
      expect(tasks.every((t: any) => t.completed_at === undefined)).toBe(true);
    });
    
    it('should set valid agent roles', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      const validRoles = [
        'script_writer',
        'voice_generator', 
        'video_generator',
        'image_generator',
        'text_generator',
        'composer',
        'qa_reviewer'
      ];
      
      expect(tasks.every((t: any) => validRoles.includes(t.agent_role))).toBe(true);
    });
  });
  
  describe('dependencies', () => {
    it('should set dependencies correctly for sequential tasks', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      // Later tasks should have dependencies on earlier tasks
      const composeTask = tasks.find((t: any) => t.name === 'compose_final');
      
      if (composeTask?.dependencies) {
        expect(composeTask.dependencies.length).toBeGreaterThan(0);
      }
    });
  });
  
  describe('edge cases', () => {
    it('should handle all request types', () => {
      const types = ['video_with_vo', 'video_no_vo', 'image', 'text', 'carousel'] as const;
      
      types.forEach(type => {
        const tasks = createInitialTasks({
          type,
          autoScript: false,
          hasVoiceover: false
        });
        
        expect(tasks.length).toBeGreaterThan(0);
        expect(tasks.every((t: any) => t.status === 'pending')).toBe(true);
      });
    });
    
    it('should create unique task names within a request', () => {
      const tasks = createInitialTasks({
        type: 'video_with_vo',
        autoScript: true,
        hasVoiceover: true
      });
      
      const names = tasks.map((t: any) => t.name);
      const uniqueNames = new Set(names);
      
      expect(uniqueNames.size).toBe(names.length);
    });
  });
});
