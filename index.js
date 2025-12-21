/**
 * Brand Infinity Engine - Main Entry Point
 * @module index
 * 
 * Express server providing REST API for the marketing content pipeline.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

import { healthCheck, closeConnections } from './utils/db.js';
import { createBrandValidator } from './utils/brand_validator.js';
import { 
  validateFile, 
  generateUniqueFilename, 
  saveFileToDisk,
  extractAssetMetadata 
} from './utils/file_upload.js';

// Import Pillar 1: Strategist
import {
  generateCreativeBrief,
  getBriefById,
  validateBrief,
  getTrends,
  scrapeTrends,
  analyzeTrendVirality,
  queryBrandGuidelines,
  calculateBrandAlignment
} from './src/pillars/strategist/index.js';

// Import Pillar 2: Copywriter
import {
  generateScript,
  getScriptById,
  getHooksByScriptId
} from './src/pillars/copywriter/index.js';

// Import Pillar 3: Production
import {
  generateVideo,
  getVideoById,
  getScenesByVideoId
} from './src/pillars/production/index.js';

// Import Pillar 4: Distribution
import {
  generateVariants,
  getVariantById,
  getVariantsByVideoId,
  getAvailablePlatforms
} from './src/pillars/distribution/index.js';

// Import Pillar 5: Publisher
import {
  schedulePost,
  publishNow,
  getPublicationById,
  getScheduledPosts,
  cancelScheduledPost,
  getPlatformConfigs
} from './src/pillars/publisher/index.js';

// =============================================================================
// Configuration
// =============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT || '1000', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// =============================================================================
// Express App Setup
// =============================================================================

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: API_RATE_LIMIT,
  message: { 
    success: false, 
    error: { code: 'RATE_LIMIT', message: 'Too many requests' } 
  },
});
app.use('/api/', limiter);

// Body parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging
if (NODE_ENV !== 'test') {
  app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Standard API response wrapper
 */
function apiResponse(res, statusCode, data, meta = {}) {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
}

/**
 * Standard error response wrapper
 */
function apiError(res, statusCode, code, message, details = null) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

// =============================================================================
// Routes
// =============================================================================

// Root endpoint
app.get('/', (req, res) => {
  return apiResponse(res, 200, {
    name: 'Brand Infinity Engine',
    version: process.env.APP_VERSION || '1.0.0',
    description: 'AI-powered marketing content pipeline',
    docs: '/api/v1/docs',
    health: '/api/v1/health',
  });
});

// =============================================================================
// API v1 Routes
// =============================================================================

const apiV1 = express.Router();

// Health check endpoint
apiV1.get('/health', async (req, res) => {
  try {
    const status = await healthCheck();
    const isHealthy = status.postgres;
    
    return apiResponse(res, isHealthy ? 200 : 503, {
      status: isHealthy ? 'healthy' : 'unhealthy',
      services: status,
      version: process.env.APP_VERSION || '1.0.0',
      environment: NODE_ENV,
    });
  } catch (error) {
    return apiError(res, 500, 'HEALTH_CHECK_ERROR', error.message);
  }
});

// API docs endpoint
apiV1.get('/docs', (req, res) => {
  return apiResponse(res, 200, {
    endpoints: {
      brands: {
        'GET /api/v1/brands': 'List all brand guidelines',
        'POST /api/v1/brands': 'Create brand guideline',
        'GET /api/v1/brands/:id': 'Get brand guideline by ID',
        'PUT /api/v1/brands/:id': 'Update brand guideline',
        'DELETE /api/v1/brands/:id': 'Delete brand guideline',
        'POST /api/v1/brands/:id/validate': 'Validate content against brand',
      },
      campaigns: {
        'GET /api/v1/campaigns': 'List all campaigns',
        'POST /api/v1/campaigns': 'Create campaign',
        'GET /api/v1/campaigns/:id': 'Get campaign by ID',
        'POST /api/v1/campaigns/:id/briefs': 'Generate creative brief',
        'POST /api/v1/campaigns/:id/scripts': 'Generate video script',
        'POST /api/v1/campaigns/:id/videos': 'Generate video',
        'POST /api/v1/campaigns/:id/publish': 'Publish campaign',
      },
      trends: {
        'GET /api/v1/trends': 'List trending topics',
        'POST /api/v1/trends/refresh': 'Refresh trends from social media',
      },
    },
  });
});

// Brand validation endpoint (quick test)
apiV1.post('/validate', async (req, res) => {
  try {
    const { content, brandGuidelineId } = req.body;
    
    if (!content || !brandGuidelineId) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'content and brandGuidelineId are required');
    }

    const validator = createBrandValidator();
    const result = await validator.validateContent(content, brandGuidelineId);
    
    return apiResponse(res, 200, result);
  } catch (error) {
    console.error('Validation error:', error);
    return apiError(res, 500, 'VALIDATION_FAILED', error.message);
  }
});

// Placeholder routes (to be implemented)
apiV1.get('/brands', async (req, res) => {
  return apiError(res, 501, 'NOT_IMPLEMENTED', 'Brand listing not yet implemented');
});

apiV1.get('/campaigns', async (req, res) => {
  return apiError(res, 501, 'NOT_IMPLEMENTED', 'Campaign listing not yet implemented');
});

apiV1.get('/trends', async (req, res) => {
  try {
    const { category, source, minEngagement, limit, daysBack } = req.query;
    
    const trends = await getTrends({
      category,
      source,
      minEngagement: minEngagement ? parseFloat(minEngagement) : 0.5,
      limit: limit ? parseInt(limit, 10) : 10,
      daysBack: daysBack ? parseInt(daysBack, 10) : 7
    });
    
    return apiResponse(res, 200, trends, { count: trends.length });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return apiError(res, 500, 'TRENDS_FETCH_ERROR', error.message);
  }
});

// Refresh trends (scrape from social media)
apiV1.post('/trends/refresh', async (req, res) => {
  try {
    const { platforms, category } = req.body;
    
    const scrapedTrends = await scrapeTrends({
      platforms: platforms || ['tiktok', 'instagram', 'twitter'],
      category
    });
    
    return apiResponse(res, 200, scrapedTrends, { 
      count: scrapedTrends.length,
      message: 'Trends refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing trends:', error);
    return apiError(res, 500, 'TRENDS_REFRESH_ERROR', error.message);
  }
});

// Analyze trend virality
apiV1.get('/trends/:trendId/virality', async (req, res) => {
  try {
    const { trendId } = req.params;
    const analysis = await analyzeTrendVirality(trendId);
    
    return apiResponse(res, 200, analysis);
  } catch (error) {
    console.error('Error analyzing trend virality:', error);
    return apiError(res, 404, 'TREND_NOT_FOUND', error.message);
  }
});

// Generate creative brief for a campaign
apiV1.post('/campaigns/:campaignId/briefs', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaignRequest = req.body;
    
    // Validate required fields
    const requiredFields = ['product_category', 'target_demographic', 'campaign_objective', 'budget_tier', 'brand_id'];
    const missingFields = requiredFields.filter(field => !campaignRequest[field]);
    
    if (missingFields.length > 0) {
      return apiError(
        res, 
        400, 
        'VALIDATION_ERROR', 
        'Missing required fields',
        { missing_fields: missingFields }
      );
    }
    
    // Add campaign ID to request
    campaignRequest.campaign_id = campaignId;
    
    // Generate creative brief
    const brief = await generateCreativeBrief(campaignRequest);
    
    return apiResponse(res, 201, brief, { 
      brief_id: brief.brief_id,
      approval_status: brief.approval_status,
      brand_alignment_score: brief.brand_alignment_score
    });
  } catch (error) {
    console.error('Error generating creative brief:', error);
    return apiError(res, 500, 'BRIEF_GENERATION_ERROR', error.message);
  }
});

// Get creative brief by ID
apiV1.get('/briefs/:briefId', async (req, res) => {
  try {
    const { briefId } = req.params;
    const brief = await getBriefById(briefId);
    
    return apiResponse(res, 200, brief);
  } catch (error) {
    console.error('Error fetching brief:', error);
    return apiError(res, 404, 'BRIEF_NOT_FOUND', error.message);
  }
});

// Validate brief quality
apiV1.post('/briefs/:briefId/validate', async (req, res) => {
  try {
    const { briefId } = req.params;
    const brief = await getBriefById(briefId);
    const validation = await validateBrief(brief);
    
    return apiResponse(res, 200, validation);
  } catch (error) {
    console.error('Error validating brief:', error);
    return apiError(res, 404, 'BRIEF_VALIDATION_ERROR', error.message);
  }
});

// Query brand guidelines (RAG)
apiV1.post('/brands/:brandId/query', async (req, res) => {
  try {
    const { brandId } = req.params;
    const { context, topK, similarityThreshold } = req.body;
    
    if (!context) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'context is required');
    }
    
    const guidelines = await queryBrandGuidelines(brandId, context, {
      topK: topK || 5,
      similarityThreshold: similarityThreshold || 0.7
    });
    
    return apiResponse(res, 200, guidelines);
  } catch (error) {
    console.error('Error querying brand guidelines:', error);
    return apiError(res, 500, 'BRAND_QUERY_ERROR', error.message);
  }
});

// Calculate brand alignment
apiV1.post('/brands/:brandId/alignment', async (req, res) => {
  try {
    const { brandId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'content is required');
    }
    
    const alignment = await calculateBrandAlignment(brandId, content);
    
    return apiResponse(res, 200, alignment);
  } catch (error) {
    console.error('Error calculating brand alignment:', error);
    return apiError(res, 500, 'ALIGNMENT_CALCULATION_ERROR', error.message);
  }
});

// =============================================================================
// Pillar 2: Copywriter Routes
// =============================================================================

// Generate script and hooks from brief
apiV1.post('/briefs/:briefId/scripts', async (req, res) => {
  try {
    const { briefId } = req.params;
    const { hookCount, variantTag, targetDuration } = req.body;
    
    const script = await generateScript(briefId, {
      hookCount: hookCount || 50,
      variantTag: variantTag || 'balanced',
      targetDuration: targetDuration || 30
    });
    
    return apiResponse(res, 201, script, {
      brief_id: briefId,
      hooks_generated: script.hook_variations_count
    });
  } catch (error) {
    console.error('Error generating script:', error);
    return apiError(res, 500, 'SCRIPT_GENERATION_ERROR', error.message);
  }
});

// Get script by ID
apiV1.get('/scripts/:scriptId', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const script = await getScriptById(scriptId);
    
    return apiResponse(res, 200, script);
  } catch (error) {
    console.error('Error fetching script:', error);
    return apiError(res, 404, 'SCRIPT_NOT_FOUND', error.message);
  }
});

// Get all hook variations for a script
apiV1.get('/scripts/:scriptId/hooks', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const hooks = await getHooksByScriptId(scriptId);
    
    return apiResponse(res, 200, { hooks }, {
      script_id: scriptId,
      total_hooks: hooks.length
    });
  } catch (error) {
    console.error('Error fetching hooks:', error);
    return apiError(res, 404, 'HOOKS_NOT_FOUND', error.message);
  }
});

// =============================================================================
// Pillar 3: Production Routes
// =============================================================================

// Generate video from script
apiV1.post('/scripts/:scriptId/videos', async (req, res) => {
  try {
    const { scriptId } = req.params;
    const { quality, budget, priority } = req.body;
    
    const video = await generateVideo(scriptId, {
      quality: quality || 'high',
      budget: budget || 'medium',
      priority: priority || 'balanced'
    });
    
    return apiResponse(res, 201, video, {
      script_id: scriptId,
      scenes_generated: video.scenes_count,
      total_cost: video.total_cost_usd
    });
  } catch (error) {
    console.error('Error generating video:', error);
    return apiError(res, 500, 'VIDEO_GENERATION_ERROR', error.message);
  }
});

// Get video by ID
apiV1.get('/videos/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = await getVideoById(videoId);
    
    return apiResponse(res, 200, video);
  } catch (error) {
    console.error('Error fetching video:', error);
    return apiError(res, 404, 'VIDEO_NOT_FOUND', error.message);
  }
});

// Get all scenes for a video
apiV1.get('/videos/:videoId/scenes', async (req, res) => {
  try {
    const { videoId } = req.params;
    const scenes = await getScenesByVideoId(videoId);
    
    return apiResponse(res, 200, { scenes }, {
      video_id: videoId,
      total_scenes: scenes.length
    });
  } catch (error) {
    console.error('Error fetching scenes:', error);
    return apiError(res, 404, 'SCENES_NOT_FOUND', error.message);
  }
});

// =============================================================================
// Pillar 4: Distribution - Variant Generation
// =============================================================================

// Generate variants for a video
apiV1.post('/videos/:videoId/variants', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { platforms, includeCaption, includeBranding, customizations } = req.body;
    
    const result = await generateVariants(videoId, {
      platforms: platforms || ['tiktok', 'instagram_reels', 'youtube_shorts'],
      includeCaption: includeCaption !== false,
      includeBranding: includeBranding !== false,
      customizations: customizations || {}
    });
    
    return apiResponse(res, 201, result, {
      video_id: videoId,
      variants_generated: result.variants_count
    });
  } catch (error) {
    console.error('Error generating variants:', error);
    return apiError(res, 500, 'VARIANT_GENERATION_ERROR', error.message);
  }
});

// Get variant by ID
apiV1.get('/variants/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;
    const variant = await getVariantById(variantId);
    
    return apiResponse(res, 200, variant);
  } catch (error) {
    console.error('Error fetching variant:', error);
    return apiError(res, 404, 'VARIANT_NOT_FOUND', error.message);
  }
});

// Get all variants for a video
apiV1.get('/videos/:videoId/variants', async (req, res) => {
  try {
    const { videoId } = req.params;
    const variants = await getVariantsByVideoId(videoId);
    
    return apiResponse(res, 200, { variants }, {
      video_id: videoId,
      total_variants: variants.length
    });
  } catch (error) {
    console.error('Error fetching variants:', error);
    return apiError(res, 404, 'VARIANTS_NOT_FOUND', error.message);
  }
});

// Get available platforms
apiV1.get('/platforms', async (req, res) => {
  try {
    const platforms = getAvailablePlatforms();
    
    return apiResponse(res, 200, { platforms }, {
      total_platforms: platforms.length
    });
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return apiError(res, 500, 'PLATFORMS_ERROR', error.message);
  }
});

// =============================================================================
// Pillar 5: Publisher - Post Scheduling & Publishing
// =============================================================================

// Schedule a variant for publication
apiV1.post('/variants/:variantId/schedule', async (req, res) => {
  try {
    const { variantId } = req.params;
    const { scheduledTime, caption, hashtags, customMetadata } = req.body;
    
    if (!scheduledTime) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'scheduledTime is required');
    }
    
    const result = await schedulePost(variantId, {
      scheduledTime,
      caption: caption || '',
      hashtags: hashtags || [],
      customMetadata: customMetadata || {}
    });
    
    return apiResponse(res, 201, result, {
      variant_id: variantId,
      scheduled_time: result.scheduled_time
    });
  } catch (error) {
    console.error('Error scheduling post:', error);
    return apiError(res, 500, 'SCHEDULE_ERROR', error.message);
  }
});

// Publish a variant immediately
apiV1.post('/variants/:variantId/publish', async (req, res) => {
  try {
    const { variantId } = req.params;
    const { caption, hashtags, customMetadata } = req.body;
    
    const result = await publishNow(variantId, {
      caption: caption || '',
      hashtags: hashtags || [],
      customMetadata: customMetadata || {}
    });
    
    return apiResponse(res, 201, result, {
      variant_id: variantId,
      status: result.status
    });
  } catch (error) {
    console.error('Error publishing post:', error);
    return apiError(res, 500, 'PUBLISH_ERROR', error.message);
  }
});

// Get publication by ID
apiV1.get('/publications/:publicationId', async (req, res) => {
  try {
    const { publicationId } = req.params;
    const publication = await getPublicationById(publicationId);
    
    return apiResponse(res, 200, publication);
  } catch (error) {
    console.error('Error fetching publication:', error);
    return apiError(res, 404, 'PUBLICATION_NOT_FOUND', error.message);
  }
});

// Get all scheduled posts
apiV1.get('/scheduled-posts', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    
    const posts = await getScheduledPosts({
      status: status || 'pending',
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });
    
    return apiResponse(res, 200, { scheduled_posts: posts }, {
      total_returned: posts.length
    });
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return apiError(res, 500, 'SCHEDULED_POSTS_ERROR', error.message);
  }
});

// Cancel a scheduled post
apiV1.delete('/scheduled-posts/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const result = await cancelScheduledPost(scheduleId);
    
    return apiResponse(res, 200, result, {
      schedule_id: scheduleId,
      status: 'cancelled'
    });
  } catch (error) {
    console.error('Error cancelling scheduled post:', error);
    return apiError(res, 500, 'CANCEL_ERROR', error.message);
  }
});

// Get platform publishing configs
apiV1.get('/platform-configs', async (req, res) => {
  try {
    const configs = getPlatformConfigs();
    
    return apiResponse(res, 200, { platform_configs: configs }, {
      total_platforms: configs.length
    });
  } catch (error) {
    console.error('Error fetching platform configs:', error);
    return apiError(res, 500, 'PLATFORM_CONFIGS_ERROR', error.message);
  }
});

// =============================================================================
// Asset Upload Routes
// =============================================================================

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 52428800, // 50MB
  },
});

// Upload campaign asset
apiV1.post('/campaigns/:campaignId/assets', upload.single('file'), async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { assetType = 'image', tags } = req.body;
    const file = req.file;

    if (!file) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'No file provided');
    }

    // Validate file
    const validation = validateFile({
      size: file.size,
      mimetype: file.mimetype,
      originalname: file.originalname
    }, assetType);

    if (!validation.valid) {
      return apiError(res, 400, 'VALIDATION_ERROR', 'Invalid file', { errors: validation.errors });
    }

    // Generate unique filename
    const uniqueFilename = generateUniqueFilename(file.originalname);

    // Save file to disk
    const saveResult = await saveFileToDisk(file.buffer, uniqueFilename, campaignId);

    if (!saveResult.success) {
      return apiError(res, 500, 'FILE_SAVE_ERROR', saveResult.error);
    }

    // Extract metadata
    const metadata = extractAssetMetadata({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }, assetType);

    // In production, save to database
    const assetData = {
      asset_id: `asset_${Date.now()}`,
      campaign_id: campaignId,
      asset_type: assetType,
      filename: uniqueFilename,
      original_filename: file.originalname,
      file_size_bytes: file.size,
      mime_type: file.mimetype,
      storage_url: saveResult.publicUrl,
      tags: tags ? tags.split(',') : [],
      metadata,
      created_at: new Date().toISOString()
    };

    return apiResponse(res, 201, assetData, {
      message: 'Asset uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading asset:', error);
    return apiError(res, 500, 'ASSET_UPLOAD_ERROR', error.message);
  }
});

// List campaign assets
apiV1.get('/campaigns/:campaignId/assets', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { assetType } = req.query;

    // In production, query from database
    // For now, return mock data
    const assets = [];

    return apiResponse(res, 200, { assets }, {
      count: assets.length,
      campaign_id: campaignId
    });
  } catch (error) {
    console.error('Error fetching assets:', error);
    return apiError(res, 500, 'ASSETS_FETCH_ERROR', error.message);
  }
});

// Delete campaign asset
apiV1.delete('/campaigns/:campaignId/assets/:assetId', async (req, res) => {
  try {
    const { campaignId, assetId } = req.params;

    // In production, delete from database and storage
    return apiResponse(res, 200, { deleted: true, asset_id: assetId });
  } catch (error) {
    console.error('Error deleting asset:', error);
    return apiError(res, 500, 'ASSET_DELETE_ERROR', error.message);
  }
});

// Mount API v1
app.use('/api/v1', apiV1);

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use((req, res) => {
  return apiError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return apiError(
    res, 
    err.status || 500, 
    err.code || 'INTERNAL_ERROR', 
    err.message || 'An unexpected error occurred',
    NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
});

// =============================================================================
// Server Startup
// =============================================================================

let server;

async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    const dbStatus = await healthCheck();
    
    if (!dbStatus.postgres) {
      console.warn('⚠️  PostgreSQL not connected. Some features will be unavailable.');
      console.warn('   Run: npm run docker:up && npm run db:migrate');
    } else {
      console.log('✅ PostgreSQL connected');
      if (dbStatus.pgvector) {
        console.log('✅ pgvector extension available');
      }
    }

    // Start listening
    server = app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║         🎬 Brand Infinity Engine                              ║
╠══════════════════════════════════════════════════════════════╣
║  Status:      Running                                        ║
║  Environment: ${NODE_ENV.padEnd(46)}║
║  Port:        ${String(PORT).padEnd(46)}║
║  Health:      http://localhost:${PORT}/api/v1/health${' '.repeat(17)}║
║  API Docs:    http://localhost:${PORT}/api/v1/docs${' '.repeat(19)}║
╚══════════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('\n🛑 Shutting down gracefully...');
  
  if (server) {
    server.close(() => {
      console.log('   HTTP server closed');
    });
  }
  
  await closeConnections();
  console.log('   Database connections closed');
  
  process.exit(0);
}

// Start the server
startServer();

// =============================================================================
// Exports (for testing)
// =============================================================================

export { app, startServer, shutdown };
export default app;
