#!/usr/bin/env node

/**
 * Environment Validation Script
 * @module scripts/setup/validate_env
 * 
 * Validates that all required environment variables are set and valid.
 * Run with: npm run validate:env
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../..');

// Load environment variables
const envFiles = ['.env', '.env.local', '.env.development'];
for (const file of envFiles) {
  const envPath = resolve(projectRoot, file);
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}

// =============================================================================
// Validation Rules
// =============================================================================

const REQUIRED = 'required';
const OPTIONAL = 'optional';
const CONDITIONAL = 'conditional';

const envSchema = {
  // Database (at least one required)
  DATABASE_URL: { level: CONDITIONAL, group: 'database', description: 'PostgreSQL connection string' },
  SUPABASE_DB_URL: { level: CONDITIONAL, group: 'database', description: 'Supabase PostgreSQL URL' },
  POSTGRES_HOST: { level: CONDITIONAL, group: 'database', description: 'PostgreSQL host' },
  POSTGRES_PORT: { level: OPTIONAL, default: '5432', description: 'PostgreSQL port' },
  POSTGRES_DB: { level: OPTIONAL, default: 'brand_infinity', description: 'PostgreSQL database name' },
  POSTGRES_USER: { level: OPTIONAL, default: 'postgres', description: 'PostgreSQL user' },
  POSTGRES_PASSWORD: { level: CONDITIONAL, group: 'database', description: 'PostgreSQL password' },

  // Supabase
  SUPABASE_URL: { level: OPTIONAL, description: 'Supabase project URL' },
  SUPABASE_ANON_KEY: { level: OPTIONAL, description: 'Supabase anonymous key' },
  SUPABASE_SERVICE_ROLE_KEY: { level: OPTIONAL, description: 'Supabase service role key' },

  // Vector Database
  PINECONE_API_KEY: { level: OPTIONAL, description: 'Pinecone API key' },
  PINECONE_ENVIRONMENT: { level: OPTIONAL, description: 'Pinecone environment' },
  PINECONE_INDEX_NAME: { level: OPTIONAL, default: 'brand-guidelines', description: 'Pinecone index name' },

  // Redis
  REDIS_URL: { level: OPTIONAL, default: 'redis://localhost:6379', description: 'Redis connection URL' },

  // AI Models (at least one for full functionality)
  OPENAI_API_KEY: { level: OPTIONAL, description: 'OpenAI API key (for GPT-4, embeddings)' },
  ANTHROPIC_API_KEY: { level: OPTIONAL, description: 'Anthropic API key (for Claude)' },
  DEEPSEEK_API_KEY: { level: OPTIONAL, description: 'DeepSeek API key' },

  // Video Generation
  SORA_API_KEY: { level: OPTIONAL, description: 'Sora API key' },
  VEO3_API_KEY: { level: OPTIONAL, description: 'Veo3 API key' },
  SEEDREAM_API_KEY: { level: OPTIONAL, description: 'Seedream API key' },
  NANO_B_API_KEY: { level: OPTIONAL, description: 'Nano B API key' },

  // Text-to-Speech
  ELEVENLABS_API_KEY: { level: OPTIONAL, description: 'ElevenLabs API key' },

  // Object Storage
  AWS_ACCESS_KEY_ID: { level: OPTIONAL, description: 'AWS access key' },
  AWS_SECRET_ACCESS_KEY: { level: OPTIONAL, description: 'AWS secret key' },
  S3_BUCKET_NAME: { level: OPTIONAL, description: 'S3 bucket name' },
  GOOGLE_DRIVE_FOLDER_ID: { level: OPTIONAL, description: 'Google Drive folder ID' },

  // Social Media (optional for dev)
  INSTAGRAM_ACCESS_TOKEN: { level: OPTIONAL, description: 'Instagram access token' },
  TIKTOK_ACCESS_TOKEN: { level: OPTIONAL, description: 'TikTok access token' },
  YOUTUBE_API_KEY: { level: OPTIONAL, description: 'YouTube API key' },
  LINKEDIN_ACCESS_TOKEN: { level: OPTIONAL, description: 'LinkedIn access token' },

  // n8n
  N8N_HOST: { level: OPTIONAL, default: 'localhost', description: 'n8n host' },
  N8N_PORT: { level: OPTIONAL, default: '5678', description: 'n8n port' },
  N8N_API_KEY: { level: OPTIONAL, description: 'n8n API key' },

  // Application
  NODE_ENV: { level: OPTIONAL, default: 'development', description: 'Node environment' },
  PORT: { level: OPTIONAL, default: '3000', description: 'Application port' },
  LOG_LEVEL: { level: OPTIONAL, default: 'info', description: 'Log level' },

  // Security
  JWT_SECRET: { level: OPTIONAL, minLength: 32, description: 'JWT secret key' },
  ENCRYPTION_KEY: { level: OPTIONAL, minLength: 32, description: 'Encryption key' },

  // Feature Flags
  ENABLE_BRAND_CACHE: { level: OPTIONAL, default: 'true', description: 'Enable brand caching' },
  ENABLE_COST_TRACKING: { level: OPTIONAL, default: 'true', description: 'Enable cost tracking' },
};

// =============================================================================
// Validation Logic
// =============================================================================

function validateEnv() {
  const results = {
    valid: [],
    missing: [],
    warnings: [],
    errors: [],
  };

  // Check each variable
  for (const [key, schema] of Object.entries(envSchema)) {
    const value = process.env[key];
    const hasValue = value !== undefined && value !== '' && !value.includes('your_') && !value.includes('_here');

    if (hasValue) {
      // Check minimum length if specified
      if (schema.minLength && value.length < schema.minLength) {
        results.errors.push({
          key,
          message: `${key} must be at least ${schema.minLength} characters`,
        });
      } else {
        results.valid.push({ key, description: schema.description });
      }
    } else if (schema.level === REQUIRED) {
      results.missing.push({ key, description: schema.description });
    } else if (schema.level === CONDITIONAL) {
      // Will check group requirements separately
    } else if (schema.default) {
      results.warnings.push({
        key,
        message: `${key} not set, using default: ${schema.default}`,
      });
    }
  }

  // Check conditional groups
  const databaseVars = ['DATABASE_URL', 'SUPABASE_DB_URL', 'POSTGRES_PASSWORD'];
  const hasDatabase = databaseVars.some(key => {
    const value = process.env[key];
    return value && !value.includes('your_') && !value.includes('_here');
  });

  if (!hasDatabase) {
    results.errors.push({
      key: 'DATABASE',
      message: 'No database configuration found. Set DATABASE_URL, SUPABASE_DB_URL, or POSTGRES_* variables.',
    });
  }

  // Check for at least one AI model for full functionality
  const aiVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY'];
  const hasAI = aiVars.some(key => {
    const value = process.env[key];
    return value && !value.includes('your_') && !value.includes('_here');
  });

  if (!hasAI) {
    results.warnings.push({
      key: 'AI_MODELS',
      message: 'No AI model API key configured. Some features will be limited or require mocks.',
    });
  }

  // Check for video generation
  const videoVars = ['SORA_API_KEY', 'VEO3_API_KEY', 'SEEDREAM_API_KEY', 'NANO_B_API_KEY'];
  const hasVideo = videoVars.some(key => {
    const value = process.env[key];
    return value && !value.includes('your_') && !value.includes('_here');
  });

  if (!hasVideo) {
    results.warnings.push({
      key: 'VIDEO_MODELS',
      message: 'No video generation API key configured. Video generation will be mocked.',
    });
  }

  return results;
}

// =============================================================================
// Output
// =============================================================================

function printResults(results) {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Brand Infinity Engine - Environment Validation       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Valid variables
  if (results.valid.length > 0) {
    console.log('✅ CONFIGURED (' + results.valid.length + ')');
    console.log('─'.repeat(60));
    for (const item of results.valid) {
      console.log(`   ${item.key}`);
    }
    console.log();
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log('⚠️  WARNINGS (' + results.warnings.length + ')');
    console.log('─'.repeat(60));
    for (const item of results.warnings) {
      console.log(`   ${item.key}: ${item.message}`);
    }
    console.log();
  }

  // Missing required
  if (results.missing.length > 0) {
    console.log('❌ MISSING REQUIRED (' + results.missing.length + ')');
    console.log('─'.repeat(60));
    for (const item of results.missing) {
      console.log(`   ${item.key}: ${item.description}`);
    }
    console.log();
  }

  // Errors
  if (results.errors.length > 0) {
    console.log('🚫 ERRORS (' + results.errors.length + ')');
    console.log('─'.repeat(60));
    for (const item of results.errors) {
      console.log(`   ${item.key}: ${item.message}`);
    }
    console.log();
  }

  // Summary
  console.log('─'.repeat(60));
  const canRun = results.errors.length === 0;
  if (canRun) {
    console.log('✅ Environment is valid for development');
    if (results.warnings.length > 0) {
      console.log('   (Some features may be limited - see warnings above)');
    }
  } else {
    console.log('❌ Environment has errors - please fix before running');
  }
  console.log();

  // Recommendations
  console.log('📋 NEXT STEPS');
  console.log('─'.repeat(60));
  if (!canRun) {
    console.log('   1. Edit .env.local and add the missing credentials');
    console.log('   2. Run: npm run validate:env');
  } else {
    console.log('   1. npm install');
    console.log('   2. npm run docker:up');
    console.log('   3. npm run db:migrate');
  }
  console.log();

  return canRun;
}

// =============================================================================
// Main
// =============================================================================

const results = validateEnv();
const isValid = printResults(results);
process.exit(isValid ? 0 : 1);
