/**
 * User-Friendly Error Messages
 * 
 * Maps technical error codes from n8n/providers to human-readable messages.
 * Phase 1 Critical Fix: Meaningful Error Messages
 */

export interface UserFriendlyError {
  title: string;
  message: string;
  suggestion?: string;
  retriable: boolean;
}

/**
 * Error code to user-friendly message mapping
 */
const ERROR_MAP: Record<string, UserFriendlyError> = {
  // n8n workflow errors
  N8N_WORKFLOW_ERROR: {
    title: 'Generation Failed',
    message: 'The content generation workflow encountered an error.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    retriable: true,
  },
  N8N_TIMEOUT: {
    title: 'Generation Timeout',
    message: 'The generation took too long and was stopped.',
    suggestion: 'Try simplifying your prompt or reducing the duration.',
    retriable: true,
  },
  N8N_CONNECTION_ERROR: {
    title: 'Service Unavailable',
    message: 'Could not connect to the generation service.',
    suggestion: 'Please try again in a few minutes.',
    retriable: true,
  },
  
  // Video provider errors
  VIDEO_GENERATION_FAILED: {
    title: 'Video Generation Failed',
    message: 'The video could not be generated.',
    suggestion: 'Try adjusting your prompt or style settings.',
    retriable: true,
  },
  RUNWAY_API_ERROR: {
    title: 'Video API Error',
    message: 'The video generation service returned an error.',
    suggestion: 'Please try again. If the error persists, try a different style.',
    retriable: true,
  },
  RUNWAY_QUOTA_EXCEEDED: {
    title: 'Video Quota Exceeded',
    message: 'You have reached your video generation limit for this period.',
    suggestion: 'Wait for your quota to reset or upgrade your plan.',
    retriable: false,
  },
  
  // Image provider errors
  IMAGE_GENERATION_FAILED: {
    title: 'Image Generation Failed',
    message: 'The image could not be generated.',
    suggestion: 'Try simplifying your prompt or using different keywords.',
    retriable: true,
  },
  POLLINATIONS_ERROR: {
    title: 'Image Service Error',
    message: 'The image generation service encountered an error.',
    suggestion: 'Please try again. If the problem persists, try a different model.',
    retriable: true,
  },
  
  // Voice/TTS errors
  TTS_GENERATION_FAILED: {
    title: 'Voice Generation Failed',
    message: 'Could not generate the voiceover.',
    suggestion: 'Try selecting a different voice or shortening the script.',
    retriable: true,
  },
  ELEVENLABS_QUOTA_EXCEEDED: {
    title: 'Voice Quota Exceeded',
    message: 'You have used your available voice generation credits.',
    suggestion: 'Wait for your quota to reset or add more credits.',
    retriable: false,
  },
  
  // LLM/AI errors
  LLM_API_ERROR: {
    title: 'AI Service Error',
    message: 'The AI service could not process your request.',
    suggestion: 'Please try again. If the error continues, try simplifying your request.',
    retriable: true,
  },
  CONTENT_POLICY_VIOLATION: {
    title: 'Content Policy Violation',
    message: 'Your request was flagged by our content safety filters.',
    suggestion: 'Please revise your prompt to meet content guidelines.',
    retriable: false,
  },
  RATE_LIMIT_EXCEEDED: {
    title: 'Too Many Requests',
    message: 'You are making requests too quickly.',
    suggestion: 'Please wait a moment before trying again.',
    retriable: true,
  },
  
  // Budget errors
  INSUFFICIENT_BUDGET: {
    title: 'Insufficient Budget',
    message: 'This campaign does not have enough budget for this request.',
    suggestion: 'Increase the campaign budget or reduce the estimated cost.',
    retriable: false,
  },
  BUDGET_EXCEEDED: {
    title: 'Budget Limit Reached',
    message: 'This campaign has reached its spending limit.',
    suggestion: 'Increase the campaign budget to continue.',
    retriable: false,
  },
  
  // Storage errors
  STORAGE_UPLOAD_FAILED: {
    title: 'Upload Failed',
    message: 'Could not save the generated content.',
    suggestion: 'Please try again. Your content may need to be regenerated.',
    retriable: true,
  },
  
  // Agent errors
  STRATEGIST_EXECUTION_FAILED: {
    title: 'Strategy Generation Failed',
    message: 'Could not generate the creative strategy.',
    suggestion: 'Try providing more details about your brand or campaign.',
    retriable: true,
  },
  COPYWRITER_EXECUTION_FAILED: {
    title: 'Script Generation Failed',
    message: 'Could not generate the script or copy.',
    suggestion: 'Try adjusting your prompt or providing more context.',
    retriable: true,
  },
  PRODUCER_DISPATCH_FAILED: {
    title: 'Production Failed',
    message: 'Could not start the content production.',
    suggestion: 'Please try again. If the issue persists, contact support.',
    retriable: true,
  },
  
  // Generic fallbacks
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    suggestion: 'Please try again. If the problem continues, contact support.',
    retriable: true,
  },
};

/**
 * Get user-friendly error message from an error code
 */
export function getUserFriendlyError(
  errorCode: string,
  rawMessage?: string
): UserFriendlyError {
  // Check for exact match first
  if (ERROR_MAP[errorCode]) {
    return ERROR_MAP[errorCode];
  }
  
  // Check for partial matches (e.g., "N8N_TIMEOUT" matches "N8N")
  for (const [code, friendlyError] of Object.entries(ERROR_MAP)) {
    if (errorCode.startsWith(code.split('_')[0])) {
      return friendlyError;
    }
  }
  
  // Return generic error with raw message if available
  return {
    title: 'Generation Error',
    message: rawMessage || 'An error occurred during content generation.',
    suggestion: 'Please try again. If the problem persists, contact support.',
    retriable: true,
  };
}

/**
 * Parse error message from task error_message field
 * Format: "ERROR_CODE: message"
 */
export function parseTaskError(errorMessage: string | null): {
  code: string;
  message: string;
  friendlyError: UserFriendlyError;
} {
  if (!errorMessage) {
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error',
      friendlyError: ERROR_MAP.UNKNOWN_ERROR,
    };
  }
  
  // Parse "CODE: message" format
  const colonIndex = errorMessage.indexOf(':');
  if (colonIndex > 0) {
    const code = errorMessage.substring(0, colonIndex).trim();
    const message = errorMessage.substring(colonIndex + 1).trim();
    return {
      code,
      message,
      friendlyError: getUserFriendlyError(code, message),
    };
  }
  
  // No code prefix, use message as-is
  return {
    code: 'UNKNOWN_ERROR',
    message: errorMessage,
    friendlyError: getUserFriendlyError('UNKNOWN_ERROR', errorMessage),
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(
  code: string,
  message?: string
): {
  error: {
    code: string;
    message: string;
    userMessage: UserFriendlyError;
  };
} {
  const friendlyError = getUserFriendlyError(code, message);
  return {
    error: {
      code,
      message: message || friendlyError.message,
      userMessage: friendlyError,
    },
  };
}
