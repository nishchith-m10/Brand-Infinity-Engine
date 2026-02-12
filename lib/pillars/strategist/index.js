/**
 * Pillar 1: The Strategist - Market Intelligence Module
 * 
 * Exports all strategist pillar functionality:
 * - Trend scraping and analysis
 * - Brand RAG-based guideline queries
 * - Creative brief generation
 */

import { scrapeTrends, getTrends, analyzeTrendVirality } from './trends.js';
import { queryBrandGuidelines, calculateBrandAlignment, validateBrandCompliance } from './brand_rag.js';
import { generateCreativeBrief, validateBrief, getBriefById } from './brief_generator.js';

export {
  // Trend operations
  scrapeTrends,
  getTrends,
  analyzeTrendVirality,
  
  // Brand RAG operations
  queryBrandGuidelines,
  calculateBrandAlignment,
  validateBrandCompliance,
  
  // Brief generation operations
  generateCreativeBrief,
  validateBrief,
  getBriefById
};

export default {
  scrapeTrends,
  getTrends,
  analyzeTrendVirality,
  queryBrandGuidelines,
  calculateBrandAlignment,
  validateBrandCompliance,
  generateCreativeBrief,
  validateBrief,
  getBriefById
};
