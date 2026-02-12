/**
 * File Upload Utilities
 * @module utils/file_upload
 * 
 * Handles file uploads, validation, and storage using Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// =============================================================================
// Configuration
// =============================================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'campaign-assets';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '52428800', 10); // 50MB default
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp3'],
  document: ['application/pdf', 'text/plain']
};

// =============================================================================
// File Upload Functions
// =============================================================================

/**
 * Validate uploaded file
 * @param {Object} file - File object from multer or similar
 * @param {string} assetType - 'image', 'video', 'audio', 'document'
 * @returns {Object} Validation result
 */
export function validateFile(file, assetType) {
  const errors = [];

  // Check file exists
  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Check MIME type
  const allowedTypes = ALLOWED_MIME_TYPES[assetType] || [];
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push(`Invalid file type. Allowed: ${allowedTypes.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate unique filename
 * @param {string} originalFilename - Original file name
 * @returns {string} Unique filename with hash
 */
export function generateUniqueFilename(originalFilename) {
  const ext = path.extname(originalFilename);
  const basename = path.basename(originalFilename, ext);
  const hash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  
  return `${basename}_${timestamp}_${hash}${ext}`;
}

/**
 * Save uploaded file to Supabase Storage
 * @param {Buffer} fileBuffer - File buffer data
 * @param {string} filename - Destination filename
 * @param {string} campaignId - Campaign ID (optional, for subdirectory)
 * @returns {Promise<Object>} File save result
 */
export async function saveFileToDisk(fileBuffer, filename, campaignId = null) {
  try {
    // Construct storage path
    const storagePath = campaignId 
      ? `${campaignId}/${filename}`
      : filename;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'auto',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw new Error(error.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      success: true,
      filePath: storagePath,
      publicUrl: urlData.publicUrl,
      fileSize: fileBuffer.length
    };
  } catch (error) {
    console.error('Error saving file to Supabase:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete file from Supabase Storage
 * @param {string} filePath - Storage path (e.g., 'campaignId/filename.png')
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFile(filePath) {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

/**
 * Get file dimensions (for images)
 * @param {string} filePath - Path to image file
 * @returns {Promise<Object>} Dimensions object
 */
export async function getImageDimensions(filePath) {
  // This is a placeholder - in production, use sharp or image-size library
  // For now, return null
  return null;
}

/**
 * Extract asset metadata
 * @param {Object} file - File object
 * @param {string} assetType - Asset type
 * @returns {Object} Metadata object
 */
export function extractAssetMetadata(file, assetType) {
  const metadata = {
    originalFilename: file.originalname || file.name,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString()
  };

  // Add type-specific metadata
  if (assetType === 'image' && file.dimensions) {
    metadata.dimensions = file.dimensions;
  }

  return metadata;
}

// =============================================================================
// Exports
// =============================================================================

export default {
  validateFile,
  generateUniqueFilename,
  saveFileToDisk,
  deleteFile,
  getImageDimensions,
  extractAssetMetadata,
  STORAGE_BUCKET,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES
};
