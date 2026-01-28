/**
 * API Version Handler Middleware
 * 
 * Handles API version detection from URL path or headers,
 * adds version information to responses, and manages deprecation warnings.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Supported API versions
 */
export const SUPPORTED_API_VERSIONS = [1] as const;
export type ApiVersion = typeof SUPPORTED_API_VERSIONS[number];

/**
 * Latest stable API version
 */
export const LATEST_API_VERSION: ApiVersion = 1;

/**
 * Version deprecation status
 */
export interface VersionStatus {
  version: ApiVersion;
  status: 'active' | 'deprecated' | 'sunset';
  deprecatedDate?: string; // ISO 8601 date
  sunsetDate?: string; // ISO 8601 date when version will be retired
  alternateVersion?: ApiVersion; // Recommended version to migrate to
}

/**
 * Version status registry
 */
export const VERSION_STATUS: Record<ApiVersion, VersionStatus> = {
  1: {
    version: 1,
    status: 'active',
    // deprecatedDate: undefined,  // Will be set when v2 is released
    // sunsetDate: undefined,       // Will be set 180 days after deprecation
    // alternateVersion: 2,         // Will be set when v2 is available
  },
};

/**
 * Extract API version from request
 * 
 * Priority:
 * 1. URL path (/api/v1/...)
 * 2. X-API-Version header
 * 3. Default to latest stable version
 */
export function extractApiVersion(request: NextRequest): ApiVersion {
  // Check URL path first
  const urlMatch = request.nextUrl.pathname.match(/^\/api\/v(\d+)\//);
  if (urlMatch) {
    const version = parseInt(urlMatch[1], 10);
    if (isValidApiVersion(version)) {
      return version as ApiVersion;
    }
  }

  // Check X-API-Version header
  const headerVersion = request.headers.get('X-API-Version');
  if (headerVersion) {
    if (headerVersion === 'latest') {
      return LATEST_API_VERSION;
    }
    const version = parseInt(headerVersion, 10);
    if (isValidApiVersion(version)) {
      return version as ApiVersion;
    }
  }

  // Default to latest
  return LATEST_API_VERSION;
}

/**
 * Validate if a version number is supported
 */
export function isValidApiVersion(version: number): version is ApiVersion {
  return SUPPORTED_API_VERSIONS.includes(version as ApiVersion);
}

/**
 * Get version status information
 */
export function getVersionStatus(version: ApiVersion): VersionStatus {
  return VERSION_STATUS[version];
}

/**
 * Check if a version is deprecated
 */
export function isVersionDeprecated(version: ApiVersion): boolean {
  const status = getVersionStatus(version);
  return status.status === 'deprecated' || status.status === 'sunset';
}

/**
 * Add version headers to response
 * 
 * Adds:
 * - X-API-Version: Full version number
 * - X-API-Version-Major: Major version only
 * - Deprecation: true (if deprecated)
 * - Sunset: Date when version will be retired (if deprecated)
 * - Link: Alternate version URL (if deprecated)
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion,
  requestPath: string
): NextResponse {
  const status = getVersionStatus(version);

  // Always add version headers
  response.headers.set('X-API-Version', `${version}.0.0`);
  response.headers.set('X-API-Version-Major', version.toString());

  // Add deprecation headers if version is deprecated
  if (status.status === 'deprecated' || status.status === 'sunset') {
    response.headers.set('Deprecation', 'true');

    if (status.sunsetDate) {
      // Convert ISO 8601 date to HTTP date format
      const sunsetDate = new Date(status.sunsetDate);
      response.headers.set('Sunset', sunsetDate.toUTCString());
    }

    if (status.alternateVersion) {
      // Create alternate URL by replacing version in path
      const alternatePath = requestPath.replace(
        `/api/v${version}/`,
        `/api/v${status.alternateVersion}/`
      );
      response.headers.set('Link', `<${alternatePath}>; rel="alternate"`);
    }

    // Add deprecation warning to response body if it's JSON
    const contentType = response.headers.get('Content-Type');
    if (contentType?.includes('application/json')) {
      // Note: Modifying response body requires re-parsing and re-stringifying
      // This is a placeholder - actual implementation may vary based on response structure
      const deprecationWarning = `API v${version} is deprecated${
        status.sunsetDate ? ` and will be retired on ${status.sunsetDate}` : ''
      }${
        status.alternateVersion
          ? `. Please migrate to v${status.alternateVersion}`
          : ''
      }`;

      // Add warning to response headers instead of modifying body
      response.headers.set('X-Deprecation-Warning', deprecationWarning);
    }
  } else {
    // Not deprecated
    response.headers.set('X-API-Deprecated', 'false');
  }

  return response;
}

/**
 * Create error response for unsupported API version
 */
export function unsupportedVersionResponse(
  requestedVersion: number,
  requestPath: string
): NextResponse {
  const response = {
    success: false,
    error: {
      code: 'INVALID_API_VERSION',
      message: `API version ${requestedVersion} does not exist`,
      details: {
        requested_version: requestedVersion,
        available_versions: Array.from(SUPPORTED_API_VERSIONS),
        latest_version: LATEST_API_VERSION,
        recommended_action: `Use /api/v${LATEST_API_VERSION}${requestPath.replace(
          /^\/api\/v\d+/,
          ''
        )} or set X-API-Version: ${LATEST_API_VERSION}`,
      },
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json(response, { status: 404 });
}

/**
 * Middleware helper to validate API version
 * 
 * Usage in route handlers:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const versionCheck = validateApiVersion(request);
 *   if (versionCheck.error) {
 *     return versionCheck.error;
 *   }
 *   
 *   // ... your route logic ...
 *   
 *   return addVersionHeaders(response, versionCheck.version, request.nextUrl.pathname);
 * }
 * ```
 */
export function validateApiVersion(request: NextRequest): {
  version: ApiVersion;
  error?: NextResponse;
} {
  const urlMatch = request.nextUrl.pathname.match(/^\/api\/v(\d+)\//);
  
  if (urlMatch) {
    const version = parseInt(urlMatch[1], 10);
    if (!isValidApiVersion(version)) {
      return {
        version: LATEST_API_VERSION,
        error: unsupportedVersionResponse(version, request.nextUrl.pathname),
      };
    }
    return { version: version as ApiVersion };
  }

  // No version in URL, use header or default
  return { version: extractApiVersion(request) };
}

/**
 * Get version migration guide URL
 */
export function getMigrationGuideUrl(
  fromVersion: ApiVersion,
  toVersion: ApiVersion
): string {
  return `/docs/api/migrations/v${fromVersion}-to-v${toVersion}.md`;
}

/**
 * Check if client should migrate based on version status
 */
export function shouldClientMigrate(version: ApiVersion): {
  shouldMigrate: boolean;
  reason?: string;
  targetVersion?: ApiVersion;
  urgency: 'low' | 'medium' | 'high' | 'critical';
} {
  const status = getVersionStatus(version);

  if (status.status === 'sunset') {
    return {
      shouldMigrate: true,
      reason: `Version ${version} will be retired on ${status.sunsetDate}`,
      targetVersion: status.alternateVersion,
      urgency: 'critical',
    };
  }

  if (status.status === 'deprecated') {
    // Calculate days until sunset
    if (status.sunsetDate) {
      const daysUntilSunset = Math.floor(
        (new Date(status.sunsetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      return {
        shouldMigrate: true,
        reason: `Version ${version} is deprecated (${daysUntilSunset} days until retirement)`,
        targetVersion: status.alternateVersion,
        urgency: daysUntilSunset < 30 ? 'high' : daysUntilSunset < 90 ? 'medium' : 'low',
      };
    }

    return {
      shouldMigrate: true,
      reason: `Version ${version} is deprecated`,
      targetVersion: status.alternateVersion,
      urgency: 'medium',
    };
  }

  return {
    shouldMigrate: false,
    urgency: 'low',
  };
}

/**
 * Response wrapper that adds version headers automatically
 */
export function versionedResponse<T>(
  data: T,
  request: NextRequest,
  options?: {
    status?: number;
    headers?: HeadersInit;
  }
): NextResponse {
  const version = extractApiVersion(request);
  const response = NextResponse.json(data, options);
  return addVersionHeaders(response, version, request.nextUrl.pathname);
}
