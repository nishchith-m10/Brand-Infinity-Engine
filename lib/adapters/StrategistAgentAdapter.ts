import { createStrategistAdapter } from './StrategistAdapter';

export class StrategistAgentAdapter {
  private impl: ReturnType<typeof createStrategistAdapter>;

  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.impl = createStrategistAdapter(tier);
  }

  async run(params: any) {
    return this.impl.execute(params);
  }
}
