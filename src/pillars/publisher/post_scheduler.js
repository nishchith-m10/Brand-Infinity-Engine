/**
 * Publisher Module - Social Media Publishing (Pillar 5)
 * 
 * Responsibilities:
 * - Schedule posts for future publication
 * - Publish variants to social media platforms
 * - Track publication status and engagement
 * - Manage platform-specific formatting and metadata
 * - Handle retries and error recovery
 */

import { query } from '../../../utils/db.js';
import { getVariantById } from '../distribution/variant_generator.js';

// Platform API configurations
const PLATFORM_CONFIGS = {
    tiktok: {
        name: 'TikTok',
        max_caption_length: 2200,
        max_hashtags: 30,
        supports_scheduling: true,
        api_endpoint: process.env.TIKTOK_API_ENDPOINT || 'https://open-api.tiktok.com'
    },
    instagram_reels: {
        name: 'Instagram Reels',
        max_caption_length: 2200,
        max_hashtags: 30,
        supports_scheduling: true,
        api_endpoint: 'https://graph.facebook.com/v18.0'
    },
    instagram_feed: {
        name: 'Instagram Feed',
        max_caption_length: 2200,
        max_hashtags: 30,
        supports_scheduling: true,
        api_endpoint: 'https://graph.facebook.com/v18.0'
    },
    youtube_shorts: {
        name: 'YouTube Shorts',
        max_caption_length: 5000,
        max_hashtags: 15,
        supports_scheduling: true,
        api_endpoint: 'https://www.googleapis.com/youtube/v3'
    },
    youtube_feed: {
        name: 'YouTube Feed',
        max_caption_length: 5000,
        max_hashtags: 15,
        supports_scheduling: true,
        api_endpoint: 'https://www.googleapis.com/youtube/v3'
    },
    facebook_feed: {
        name: 'Facebook Feed',
        max_caption_length: 63206,
        max_hashtags: 30,
        supports_scheduling: true,
        api_endpoint: 'https://graph.facebook.com/v18.0'
    },
    linkedin_feed: {
        name: 'LinkedIn Feed',
        max_caption_length: 3000,
        max_hashtags: 30,
        supports_scheduling: true,
        api_endpoint: 'https://api.linkedin.com/v2'
    },
    twitter_feed: {
        name: 'Twitter/X Feed',
        max_caption_length: 280,
        max_hashtags: 10,
        supports_scheduling: true,
        api_endpoint: 'https://api.twitter.com/2'
    }
};

// Map variant platform keys to post platform keys
const PLATFORM_KEY_MAP = {
    'tiktok': 'tiktok',
    'instagram_reels': 'instagram',
    'instagram_feed': 'instagram',
    'youtube_shorts': 'youtube',
    'youtube_feed': 'youtube',
    'facebook_feed': 'facebook',
    'linkedin_feed': 'linkedin',
    'twitter_feed': 'twitter'
};

/**
 * Get post platform key from variant platform key
 * @param {string} variantPlatform - Variant platform key
 * @returns {string} Post platform key
 */
function getPostPlatformKey(variantPlatform) {
    return PLATFORM_KEY_MAP[variantPlatform] || variantPlatform;
}

/**
 * Schedule a variant for publication at a specific time
 * @param {string} variantId - Platform variant ID
 * @param {Object} options - Scheduling options
 * @returns {Object} Scheduled post data
 */
export async function schedulePost(variantId, options = {}) {
    const {
        scheduledTime,
        caption = '',
        hashtags = [],
        customMetadata = {}
    } = options;

    // Get variant details
    const variant = await getVariantById(variantId);
    if (!variant) {
        throw new Error(`Variant not found: ${variantId}`);
    }

    const platformConfig = PLATFORM_CONFIGS[variant.platform];
    if (!platformConfig) {
        throw new Error(`Platform not supported: ${variant.platform}`);
    }

    // Validate scheduling
    if (!scheduledTime) {
        throw new Error('scheduledTime is required');
    }

    const scheduleDate = new Date(scheduledTime);
    if (scheduleDate <= new Date()) {
        throw new Error('scheduledTime must be in the future');
    }

    // Create publication record (if not exists)
    let publicationId = customMetadata.publication_id;
    if (!publicationId) {
        const pubResult = await query(
            `INSERT INTO publications 
            (variant_id, publication_status, total_platforms, metadata)
            VALUES ($1, $2, $3, $4)
            RETURNING publication_id`,
            [variant.variant_id, 'scheduled', 1, { variant_platform: variant.platform }]
        );
        publicationId = pubResult.rows[0].publication_id;
    }

    // Truncate caption if needed
    const truncatedCaption = caption.substring(0, platformConfig.max_caption_length);
    const truncatedHashtags = hashtags.slice(0, platformConfig.max_hashtags);

    // Map variant platform key to post platform key
    const postPlatformKey = getPostPlatformKey(variant.platform);

    // Create platform post record
    const postResult = await query(
        `INSERT INTO platform_posts 
        (publication_id, platform, formatted_video_url, caption, hashtags, 
         aspect_ratio, duration_seconds, publication_status, scheduled_time, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
            publicationId,
            postPlatformKey,
            variant.file_url,
            truncatedCaption,
            truncatedHashtags,
            variant.aspect_ratio,
            variant.duration_seconds,
            'scheduled',
            scheduleDate,
            {
                variant_id: variantId,
                variant_platform: variant.platform,
                platform_config: platformConfig.name,
                ...customMetadata
            }
        ]
    );

    const platformPost = postResult.rows[0];

    // Create scheduled post record
    const scheduleResult = await query(
        `INSERT INTO scheduled_posts 
        (platform_post_id, scheduled_time, status, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
            platformPost.post_id,
            scheduleDate,
            'pending',
            { variant_id: variantId }
        ]
    );

    return {
        schedule_id: scheduleResult.rows[0].schedule_id,
        publication_id: publicationId,
        post_id: platformPost.post_id,
        platform: variant.platform,
        platform_name: platformConfig.name,
        scheduled_time: scheduleDate,
        status: 'pending',
        variant: {
            variant_id: variantId,
            file_url: variant.file_url,
            aspect_ratio: variant.aspect_ratio,
            duration_seconds: variant.duration_seconds
        },
        caption: truncatedCaption,
        hashtags: truncatedHashtags
    };
}

/**
 * Publish a variant immediately to a platform
 * @param {string} variantId - Platform variant ID
 * @param {Object} options - Publishing options
 * @returns {Object} Publication result
 */
export async function publishNow(variantId, options = {}) {
    const {
        caption = '',
        hashtags = [],
        customMetadata = {}
    } = options;

    // Get variant details
    const variant = await getVariantById(variantId);
    if (!variant) {
        throw new Error(`Variant not found: ${variantId}`);
    }

    const platformConfig = PLATFORM_CONFIGS[variant.platform];
    if (!platformConfig) {
        throw new Error(`Platform not supported: ${variant.platform}`);
    }

    // Create publication record
    const pubResult = await query(
        `INSERT INTO publications 
        (variant_id, publication_status, total_platforms, metadata)
        VALUES ($1, $2, $3, $4)
        RETURNING publication_id`,
        [variant.variant_id, 'publishing', 1, { variant_platform: variant.platform }]
    );
    const publicationId = pubResult.rows[0].publication_id;

    // Truncate caption and hashtags
    const truncatedCaption = caption.substring(0, platformConfig.max_caption_length);
    const truncatedHashtags = hashtags.slice(0, platformConfig.max_hashtags);

    // Map variant platform key to post platform key
    const postPlatformKey = getPostPlatformKey(variant.platform);

    // Create platform post record
    const postResult = await query(
        `INSERT INTO platform_posts 
        (publication_id, platform, formatted_video_url, caption, hashtags, 
         aspect_ratio, duration_seconds, publication_status, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
            publicationId,
            postPlatformKey,
            variant.file_url,
            truncatedCaption,
            truncatedHashtags,
            variant.aspect_ratio,
            variant.duration_seconds,
            'publishing',
            {
                variant_id: variantId,
                variant_platform: variant.platform,
                platform_config: platformConfig.name,
                ...customMetadata
            }
        ]
    );

    const platformPost = postResult.rows[0];

    // Simulate publishing to platform
    // In production: call actual platform APIs
    const publishResult = await publishToPlatform(
        variant.platform,
        variant.file_url,
        truncatedCaption,
        truncatedHashtags,
        platformConfig
    );

    // Update platform post with result
    await query(
        `UPDATE platform_posts 
         SET publication_status = $1, 
             published_at = NOW(),
             platform_post_id = $2,
             error_message = $3,
             updated_at = NOW()
         WHERE post_id = $4`,
        [
            publishResult.success ? 'published' : 'failed',
            publishResult.platform_post_id,
            publishResult.error_message,
            platformPost.post_id
        ]
    );

    // Update publication status
    await query(
        `UPDATE publications 
         SET publication_status = $1, 
             successful_platforms = $2,
             failed_platforms = $3,
             updated_at = NOW()
         WHERE publication_id = $4`,
        [
            publishResult.success ? 'published' : 'failed',
            publishResult.success ? 1 : 0,
            publishResult.success ? 0 : 1,
            publicationId
        ]
    );

    return {
        publication_id: publicationId,
        post_id: platformPost.post_id,
        platform: variant.platform,
        platform_name: platformConfig.name,
        status: publishResult.success ? 'published' : 'failed',
        platform_post_id: publishResult.platform_post_id,
        published_at: publishResult.success ? new Date() : null,
        error_message: publishResult.error_message,
        variant: {
            variant_id: variantId,
            file_url: variant.file_url,
            aspect_ratio: variant.aspect_ratio,
            duration_seconds: variant.duration_seconds
        }
    };
}

/**
 * Simulate publishing to platform API
 * In production: implement actual platform API calls
 * @param {string} platform - Platform key
 * @param {string} videoUrl - Video file URL
 * @param {string} caption - Post caption
 * @param {Array} hashtags - Post hashtags
 * @param {Object} config - Platform config
 * @returns {Object} Publish result
 */
async function publishToPlatform(platform, videoUrl, caption, hashtags, config) {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // In production: implement actual platform API calls
    // Example for Instagram:
    // - Upload video to Instagram Graph API
    // - Create media container
    // - Publish media container
    // 
    // Example for TikTok:
    // - Upload video to TikTok Open API
    // - Create post with metadata
    // - Get post ID from response

    // Simulated response
    const simulatedPostId = `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
        success: true,
        platform_post_id: simulatedPostId,
        error_message: null
    };
}

/**
 * Get publication by ID
 * @param {string} publicationId - Publication ID
 * @returns {Object} Publication data
 */
export async function getPublicationById(publicationId) {
    const result = await query(
        `SELECT p.*, 
                COUNT(pp.post_id) as total_posts,
                json_agg(
                    json_build_object(
                        'post_id', pp.post_id,
                        'platform', pp.platform,
                        'status', pp.publication_status,
                        'platform_post_id', pp.platform_post_id,
                        'published_at', pp.published_at,
                        'scheduled_time', pp.scheduled_time,
                        'caption', pp.caption,
                        'hashtags', pp.hashtags,
                        'error_message', pp.error_message
                    )
                ) as posts
         FROM publications p
         LEFT JOIN platform_posts pp ON p.publication_id = pp.publication_id
         WHERE p.publication_id = $1
         GROUP BY p.publication_id`,
        [publicationId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

/**
 * Get all scheduled posts (pending)
 * @param {Object} options - Query options
 * @returns {Array} Scheduled posts
 */
export async function getScheduledPosts(options = {}) {
    const {
        status = 'pending',
        limit = 50,
        offset = 0
    } = options;

    const result = await query(
        `SELECT sp.*, 
                pp.platform, pp.caption, pp.hashtags,
                pp.formatted_video_url, pp.aspect_ratio
         FROM scheduled_posts sp
         JOIN platform_posts pp ON sp.platform_post_id = pp.post_id
         WHERE sp.status = $1
         ORDER BY sp.scheduled_time ASC
         LIMIT $2 OFFSET $3`,
        [status, limit, offset]
    );

    return result.rows;
}

/**
 * Cancel a scheduled post
 * @param {string} scheduleId - Schedule ID
 * @returns {Object} Updated schedule
 */
export async function cancelScheduledPost(scheduleId) {
    const result = await query(
        `UPDATE scheduled_posts 
         SET status = 'cancelled', updated_at = NOW()
         WHERE schedule_id = $1
         RETURNING *`,
        [scheduleId]
    );

    if (result.rows.length === 0) {
        throw new Error(`Scheduled post not found: ${scheduleId}`);
    }

    // Update platform post status
    await query(
        `UPDATE platform_posts 
         SET publication_status = 'failed', 
             error_message = 'Cancelled by user',
             updated_at = NOW()
         WHERE post_id = $1`,
        [result.rows[0].platform_post_id]
    );

    return result.rows[0];
}

/**
 * Get platform configurations
 * @returns {Object} Platform configs
 */
export function getPlatformConfigs() {
    return Object.entries(PLATFORM_CONFIGS).map(([key, config]) => ({
        platform_key: key,
        platform_name: config.name,
        max_caption_length: config.max_caption_length,
        max_hashtags: config.max_hashtags,
        supports_scheduling: config.supports_scheduling
    }));
}
