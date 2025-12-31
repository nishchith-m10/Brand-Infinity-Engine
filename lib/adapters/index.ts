/**
 * Agent Adapters Index
 * 
 * Exports all agent adapters for use with the Phase 8 orchestrator.
 * Adapters wrap existing AI agents to work with standardized orchestrator interface.
 */

export { 
  StrategistAdapter, 
  createStrategistAdapter, 
  executeStrategistTask 
} from './StrategistAdapter';

export { 
  CopywriterAdapter, 
  createCopywriterAdapter, 
  executeCopywriterTask 
} from './CopywriterAdapter';

export { 
  ProducerAdapter, 
  createProducerAdapter, 
  executeProducerTask 
} from './ProducerAdapter';
