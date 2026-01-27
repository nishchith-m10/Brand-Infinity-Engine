import { describe, it, expect } from 'vitest';
import { metricsCollector } from '@/lib/orchestrator/MetricsCollector';

describe('MetricsCollector - Invalid Transition Counter', () => {
  it('should increment and report invalid transition count', () => {
    const before = metricsCollector.getInvalidTransitionCount();
    metricsCollector.incrementInvalidTransition();
    const after = metricsCollector.getInvalidTransitionCount();
    expect(after).toBe(before + 1);
  });
});
