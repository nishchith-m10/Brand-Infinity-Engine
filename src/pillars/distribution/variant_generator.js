/**
 * Distribution Module - Variant Generation (Pillar 4)
 * 
 * Responsibilities:
 * - Generate platform-specific video variants
 * - Adapt aspect ratios (16:9, 9:16, 1:1, 4:5)
 * - Optimize duration per platform
 * - Add platform-specific elements (captions, hashtags)
 * - Store variants in database
 */

import { query } from '../../../utils/db.js';
import { getVideoById } from '../production/video_generator.js';

// Platform specifications
const PLATFORM_SPECS = {
    tiktok: {
        name: 'TikTok',
        aspect_ratio: '9:16',
        max_duration: 180,
        optimal_duration: 30,
        supports_captions: true,
        caption_style: 'dynamic',
        hashtag_limit: 30,
        file_size_mb: 287,
        resolution: '1080x1920'
    },
    instagram_reels: {
        name: 'Instagram Reels',
        aspect_ratio: '9:16',
        max_duration: 90,
        optimal_duration: 30,
        supports_captions: true,
        caption_style: 'subtle',
        hashtag_limit: 30,
        file_size_mb: 100,
        resolution: '1080x1920'
    },
    instagram_feed: {
        name: 'Instagram Feed',
        aspect_ratio: '4:5',
        max_duration: 60,
        optimal_duration: 30,
        supports_captions: true,
        caption_style: 'minimal',
        hashtag_limit: 30,
        file_size_mb: 100,
        resolution: '1080x1350'
    },
    youtube_shorts: {
        name: 'YouTube Shorts',
        aspect_ratio: '9:16',
        max_duration: 60,
        optimal_duration: 45,
        supports_captions: true,
        caption_style: 'standard',
        hashtag_limit: 15,
        file_size_mb: 500,
        resolution: '1080x1920'
    },
    youtube_feed: {
        name: 'YouTube Feed',
        aspect_ratio: '16:9',
        max_duration: 600,
        optimal_duration: 120,
        supports_captions: true,
        caption_style: 'professional',
        hashtag_limit: 15,
        file_size_mb: 2000,
        resolution: '1920x1080'
    },
    facebook_feed: {
        name: 'Facebook Feed',
        aspect_ratio: '1:1',
        max_duration: 240,
        optimal_duration: 60,
        supports_captions: true,
        caption_style: 'standard',
        hashtag_limit: 30,
        file_size_mb: 1024,
        resolution: '1080x1080'
    },
    linkedin_feed: {
        name: 'LinkedIn Feed',
        aspect_ratio: '1:1',
        max_duration: 600,
        optimal_duration: 90,
        supports_captions: true,
        caption_style: 'professional',
        hashtag_limit: 30,
        file_size_mb: 200,
        resolution: '1080x1080'
    },
    twitter_feed: {
        name: 'Twitter/X Feed',
        aspect_ratio: '16:9',
        max_duration: 140,
        optimal_duration: 45,
        supports_captions: true,
        caption_style: 'minimal',
        hashtag_limit: 10,
        file_size_mb: 512,
        resolution: '1280x720'
    }
};

/**
 * Generate platform-specific variants from a master video
 * @param {string} videoId - Master video ID
 * @param {Object} options - Generation options
 * @returns {Object} Variants data
 */
export async function generateVariants(videoId, options = {}) {
    const {
        platforms = ['tiktok', 'instagram_reels', 'youtube_shorts'], // Default platforms
        includeCaption = true,
        includeBranding = true,
        customizations = {}
    } = options;

    // Get master video
    const masterVideo = await getVideoById(videoId);
    if (!masterVideo) {
        throw new Error(`Master video not found: ${videoId}`);
    }

    // Ensure total_duration_seconds exists
    const masterDuration = masterVideo.total_duration_seconds || masterVideo.total_duration || 30;

    const variants = [];
    const timestamp = Date.now();

    // Generate variant for each platform
    for (const platformKey of platforms) {
        const platformSpec = PLATFORM_SPECS[platformKey];
        if (!platformSpec) {
            console.warn(`Unknown platform: ${platformKey}, skipping...`);
            continue;
        }

        // Simulate variant generation (in production, this would call video processing APIs)
        const variant = await generatePlatformVariant(
            masterVideo,
            platformKey,
            platformSpec,
            {
                includeCaption,
                includeBranding,
                customizations: customizations[platformKey] || {},
                masterDuration // Pass the master duration explicitly
            },
            timestamp
        );

        // Store variant in database
        const result = await query(
            `INSERT INTO platform_variants 
            (video_id, platform, platform_name, aspect_ratio, resolution, duration_seconds, 
             file_url, file_size_bytes, caption_enabled, branding_enabled, status, 
             processing_details, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            RETURNING *`,
            [
                videoId,
                platformKey,
                platformSpec.name,
                variant.aspect_ratio,
                variant.resolution,
                variant.duration_seconds,
                variant.file_url,
                variant.file_size_bytes,
                variant.caption_enabled,
                variant.branding_enabled,
                'ready',
                variant.processing_details
            ]
        );

        variants.push({
            variant_id: result.rows[0].id,
            platform: platformKey,
            platform_name: platformSpec.name,
            ...variant,
            created_at: result.rows[0].created_at
        });
    }

    return {
        video_id: videoId,
        variants_count: variants.length,
        variants,
        platforms: platforms
    };
}

/**
 * Generate a single platform-specific variant
 * @param {Object} masterVideo - Master video data
 * @param {string} platformKey - Platform identifier
 * @param {Object} platformSpec - Platform specifications
 * @param {Object} options - Generation options
 * @param {number} timestamp - Generation timestamp
 * @returns {Object} Variant data
 */
async function generatePlatformVariant(masterVideo, platformKey, platformSpec, options, timestamp) {
    const { includeCaption, includeBranding, customizations, masterDuration } = options;

    // Calculate optimal duration for platform
    const targetDuration = Math.min(
        masterDuration || 30,
        customizations.duration || platformSpec.optimal_duration
    );

    // Simulate video transcoding with platform-specific settings
    // In production: call FFmpeg, cloud video API, or n8n workflow
    const variant = {
        aspect_ratio: customizations.aspect_ratio || platformSpec.aspect_ratio,
        duration_seconds: targetDuration,
        resolution: customizations.resolution || platformSpec.resolution,
        file_url: `https://storage.example.com/variants/${platformKey}_${masterVideo.script_id}_${timestamp}.mp4`,
        file_size_bytes: Math.floor((targetDuration * 2 * 1024 * 1024) / 8), // Approx 2 Mbps
        caption_enabled: includeCaption && platformSpec.supports_captions,
        branding_enabled: includeBranding,
        processing_details: {
            source_video: masterVideo.master_video_url,
            transcoding_preset: platformKey,
            aspect_ratio_conversion: `16:9 -> ${platformSpec.aspect_ratio}`,
            caption_style: platformSpec.caption_style,
            max_file_size_mb: platformSpec.file_size_mb,
            hashtag_limit: platformSpec.hashtag_limit
        }
    };

    return variant;
}

/**
 * Get variant by ID
 * @param {string} variantId - Variant ID
 * @returns {Object} Variant data
 */
export async function getVariantById(variantId) {
    const result = await query(
        `SELECT pv.*, 
                vid.script_id,
                vid.master_duration_seconds,
                vid.master_mp4_url
         FROM platform_variants pv
         JOIN videos vid ON pv.video_id = vid.video_id
         WHERE pv.id = $1`,
        [variantId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Get all variants for a video
 * @param {string} videoId - Master video ID
 * @returns {Array} Variants list
 */
export async function getVariantsByVideoId(videoId) {
    const result = await query(
        `SELECT * FROM platform_variants 
         WHERE video_id = $1 
         ORDER BY platform, created_at DESC`,
        [videoId]
    );

    return result.rows;
}

/**
 * Update variant status
 * @param {string} variantId - Variant ID
 * @param {string} status - New status
 * @returns {Object} Updated variant
 */
export async function updateVariantStatus(variantId, status) {
    const result = await query(
        `UPDATE platform_variants 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, variantId]
    );

    return result.rows[0];
}

/**
 * Get available platforms
 * @returns {Array} Platform specifications
 */
export function getAvailablePlatforms() {
    return Object.entries(PLATFORM_SPECS).map(([key, spec]) => ({
        platform_key: key,
        platform_name: spec.name,
        aspect_ratio: spec.aspect_ratio,
        max_duration: spec.max_duration,
        optimal_duration: spec.optimal_duration,
        resolution: spec.resolution,
        supports_captions: spec.supports_captions
    }));
}
