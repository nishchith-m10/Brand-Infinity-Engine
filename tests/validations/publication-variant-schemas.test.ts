/**
 * Tests for Publication and Variant Validation Schemas
 * 
 * Validates that CreatePublicationSchema and CreateVariantSchema
 * properly enforce business rules for platform publications and variants.
 */

import { describe, it, expect } from 'vitest';
import { 
  CreatePublicationSchema, 
  CreateVariantSchema,
  PlatformEnum 
} from '@/lib/validations/api-schemas';

describe('PlatformEnum', () => {
  it('should accept valid platform names', () => {
    const validPlatforms = ['youtube', 'tiktok', 'instagram', 'twitter', 'linkedin', 'facebook'];
    
    validPlatforms.forEach(platform => {
      const result = PlatformEnum.safeParse(platform);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid platform names', () => {
    const result = PlatformEnum.safeParse('snapchat');
    expect(result.success).toBe(false);
  });
});

describe('CreateVariantSchema', () => {
  it('should accept valid variant creation data', () => {
    const validData = {
      video_id: '550e8400-e29b-41d4-a716-446655440000',
      platforms: ['youtube', 'tiktok'],
    };

    const result = CreateVariantSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.video_id).toBe(validData.video_id);
      expect(result.data.platforms).toEqual(validData.platforms);
    }
  });

  it('should reject invalid UUID for video_id', () => {
    const invalidData = {
      video_id: 'not-a-uuid',
      platforms: ['youtube'],
    };

    const result = CreateVariantSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('video_id');
    }
  });

  it('should reject empty platforms array', () => {
    const invalidData = {
      video_id: '550e8400-e29b-41d4-a716-446655440000',
      platforms: [],
    };

    const result = CreateVariantSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('At least one platform is required');
    }
  });

  it('should reject more than 10 platforms', () => {
    const invalidData = {
      video_id: '550e8400-e29b-41d4-a716-446655440000',
      platforms: Array(11).fill('youtube'),
    };

    const result = CreateVariantSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid platform names in array', () => {
    const invalidData = {
      video_id: '550e8400-e29b-41d4-a716-446655440000',
      platforms: ['youtube', 'invalid-platform'],
    };

    const result = CreateVariantSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should require platforms field', () => {
    const invalidData = {
      video_id: '550e8400-e29b-41d4-a716-446655440000',
    };

    const result = CreateVariantSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('CreatePublicationSchema', () => {
  // Helper function to get a future datetime (6 minutes from now)
  const getFutureDateTime = (minutesFromNow: number = 6): string => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutesFromNow);
    return date.toISOString();
  };

  it('should accept valid publication data', () => {
    const validData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      platform: 'youtube',
      caption: 'Check out this video!',
      hashtags: ['#tech', '#tutorial'],
    };

    const result = CreatePublicationSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant_id).toBe(validData.variant_id);
      expect(result.data.platform).toBe('youtube');
      expect(result.data.caption).toBe(validData.caption);
      expect(result.data.hashtags).toEqual(validData.hashtags);
    }
  });

  it('should accept publication without optional fields', () => {
    const minimalData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
    };

    const result = CreatePublicationSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid UUID for variant_id', () => {
    const invalidData = {
      variant_id: 'not-a-uuid',
      scheduled_time: getFutureDateTime(10),
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('variant_id');
    }
  });

  it('should reject non-ISO datetime format', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: '2024-01-01',
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject scheduled_time less than 5 minutes in the future', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(3), // Only 3 minutes in the future
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 5 minutes in the future');
    }
  });

  it('should reject scheduled_time in the past', () => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: pastDate.toISOString(),
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid platform name', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      platform: 'invalid-platform',
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject caption longer than 5000 characters', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      caption: 'a'.repeat(5001),
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject more than 30 hashtags', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      hashtags: Array(31).fill('#test'),
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject hashtags longer than 100 characters', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      hashtags: ['#' + 'a'.repeat(100)],
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject hashtags that do not start with #', () => {
    const invalidData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      hashtags: ['#valid', 'invalid'],
    };

    const result = CreatePublicationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('must start with #');
    }
  });

  it('should accept empty hashtags array', () => {
    const validData = {
      variant_id: '550e8400-e29b-41d4-a716-446655440000',
      scheduled_time: getFutureDateTime(10),
      hashtags: [],
    };

    const result = CreatePublicationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate complex real-world publication', () => {
    const complexData = {
      variant_id: '123e4567-e89b-12d3-a456-426614174000',
      scheduled_time: getFutureDateTime(60),
      platform: 'instagram',
      caption: '🎥 New video alert! Check out our latest tutorial on AI-powered content creation. Link in bio! 🚀',
      hashtags: [
        '#AI',
        '#ContentCreation',
        '#VideoMarketing',
        '#DigitalMarketing',
        '#TechTutorial',
      ],
    };

    const result = CreatePublicationSchema.safeParse(complexData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hashtags).toHaveLength(5);
      expect(result.data.platform).toBe('instagram');
    }
  });
});
