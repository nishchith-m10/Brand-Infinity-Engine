import { calculateEstimate } from '@/lib/pipeline/estimator';

describe('calculateEstimate', () => {
  describe('video_with_vo requests', () => {
    it('should calculate cost for standard tier', () => {
      const estimate = calculateEstimate({
        type: 'video_with_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: true,
        autoScript: true
      });
      
      expect(estimate.cost).toBeGreaterThan(0);
      expect(estimate.timeSeconds).toBeGreaterThan(0);
      expect(estimate.breakdown.length).toBeGreaterThan(0);
      expect(estimate.breakdown.some((b: any) => b.component.includes('voiceover'))).toBe(true);
    });
    
    it('should include script generation in breakdown when autoScript is true', () => {
      const estimate = calculateEstimate({
        type: 'video_with_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: true,
        autoScript: true
      });
      
      expect(estimate.breakdown.some((b: any) => b.component.includes('script'))).toBe(true);
    });
    
    it('should cost more for premium tier than economy', () => {
      const economy = calculateEstimate({
        type: 'video_with_vo',
        duration: 30,
        tier: 'economy',
        hasVoiceover: true,
        autoScript: true
      });
      
      const premium = calculateEstimate({
        type: 'video_with_vo',
        duration: 30,
        tier: 'premium',
        hasVoiceover: true,
        autoScript: true
      });
      
      expect(premium.cost).toBeGreaterThan(economy.cost);
    });
    
    it('should scale cost with duration', () => {
      const short = calculateEstimate({
        type: 'video_with_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: true,
        autoScript: true
      });
      
      const long = calculateEstimate({
        type: 'video_with_vo',
        duration: 60,
        tier: 'standard',
        hasVoiceover: true,
        autoScript: true
      });
      
      expect(long.cost).toBeGreaterThan(short.cost);
      expect(long.timeSeconds).toBeGreaterThan(short.timeSeconds);
    });
  });
  
  describe('video_no_vo requests', () => {
    it('should calculate lower cost than video_with_vo', () => {
      const withVo = calculateEstimate({
        type: 'video_with_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: true,
        autoScript: true
      });
      
      const noVo = calculateEstimate({
        type: 'video_no_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: false,
        autoScript: true
      });
      
      expect(noVo.cost).toBeLessThan(withVo.cost);
    });
    
    it('should not include voiceover in breakdown', () => {
      const estimate = calculateEstimate({
        type: 'video_no_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: false,
        autoScript: true
      });
      
      expect(estimate.breakdown.some((b: any) => b.component.includes('voiceover'))).toBe(false);
    });
  });
  
  describe('image requests', () => {
    it('should calculate cost for image generation', () => {
      const estimate = calculateEstimate({
        type: 'image',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false
      });
      
      expect(estimate.cost).toBeGreaterThan(0);
      expect(estimate.cost).toBeLessThan(1.00); // Images are cheaper than videos
      expect(estimate.breakdown).toContainEqual(
        expect.objectContaining({ 
          component: expect.stringContaining('generation') 
        })
      );
    });
    
    it('should have faster processing time than videos', () => {
      const image = calculateEstimate({
        type: 'image',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false
      });
      
      const video = calculateEstimate({
        type: 'video_no_vo',
        duration: 30,
        tier: 'standard',
        hasVoiceover: false,
        autoScript: true
      });
      
      expect(image.timeSeconds).toBeLessThan(video.timeSeconds);
    });
  });
  
  describe('text requests', () => {
    it('should calculate minimal cost for text generation', () => {
      const estimate = calculateEstimate({
        type: 'text',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false
      });
      
      expect(estimate.cost).toBeGreaterThan(0);
      expect(estimate.cost).toBeLessThan(0.10); // Text is cheapest
    });
  });
  
  describe('carousel requests', () => {
    it('should calculate cost based on number of slides', () => {
      const fewSlides = calculateEstimate({
        type: 'carousel',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false,
        slideCount: 3
      });
      
      const manySlides = calculateEstimate({
        type: 'carousel',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false,
        slideCount: 10
      });
      
      expect(manySlides.cost).toBeGreaterThan(fewSlides.cost);
    });
    
    it('should default to 5 slides if not specified', () => {
      const withDefault = calculateEstimate({
        type: 'carousel',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false
      });
      
      const withFive = calculateEstimate({
        type: 'carousel',
        tier: 'standard',
        hasVoiceover: false,
        autoScript: false,
        slideCount: 5
      });
      
      expect(withDefault.cost).toBe(withFive.cost);
    });
  });
  
  describe('edge cases', () => {
    it('should handle zero duration gracefully', () => {
      const estimate = calculateEstimate({
        type: 'video_no_vo',
        duration: 0,
        tier: 'standard',
        hasVoiceover: false,
        autoScript: true
      });
      
      expect(estimate.cost).toBeGreaterThan(0); // Should still have base costs
    });
    
    it('should handle very long videos', () => {
      const estimate = calculateEstimate({
        type: 'video_with_vo',
        duration: 300, // 5 minutes
        tier: 'premium',
        hasVoiceover: true,
        autoScript: true
      });
      
      expect(estimate.cost).toBeGreaterThan(10);
      expect(estimate.timeSeconds).toBeGreaterThan(600); // Should take more than 10 minutes
    });
    
    it('should return consistent results for same inputs', () => {
      const input = {
        type: 'video_with_vo' as const,
        duration: 30,
        tier: 'standard' as const,
        hasVoiceover: true,
        autoScript: true
      };
      
      const estimate1 = calculateEstimate(input);
      const estimate2 = calculateEstimate(input);
      
      expect(estimate1.cost).toBe(estimate2.cost);
      expect(estimate1.timeSeconds).toBe(estimate2.timeSeconds);
    });
  });
});
