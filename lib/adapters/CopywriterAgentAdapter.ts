import { createCopywriterAdapter } from './CopywriterAdapter';

export class CopywriterAgentAdapter {
  private impl: ReturnType<typeof createCopywriterAdapter>;

  constructor(tier: 'premium' | 'budget' = 'budget') {
    this.impl = createCopywriterAdapter(tier);
  }

  async run(params: any) {
    return this.impl.execute(params);
  }
}
