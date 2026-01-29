# API Deprecation and Versioning Policy

**Version**: 1.0  
**Effective Date**: January 11, 2026  
**Applies To**: All Brand Infinity Engine REST APIs

---

## 1. Overview

This document defines the deprecation timeline, version lifecycle, and migration policies for the Brand Infinity Engine API. It ensures predictable API evolution while minimizing disruption to clients.

---

## 2. Version Lifecycle Stages

### 2.1 Stage Definitions

| Stage | Description | Support Level | Duration |
|-------|-------------|---------------|----------|
| **Active** | Current production version | Full support, bug fixes, new features | Indefinite |
| **Deprecated** | Supported but discouraged | Bug fixes only, no new features | Min 180 days |
| **Sunset** | No longer supported | No support, scheduled for removal | 30 days notice |
| **Retired** | Removed from production | Returns HTTP 410 Gone | Permanent |

### 2.2 Version Timeline Example

```
v1 Active ──────────────────►
                             │
                             ├─ v2 Announced (T+0)
                             │  └─ Migration guide published
                             │
                             ├─ v2 Released (T+30 days)
                             │  └─ v1 enters Deprecated stage
                             │
v1 Deprecated ───────────────┼─ Deprecation notice (T+30 days)
     (180 days min)          │  └─ Deprecation headers added
                             │
                             ├─ v1 Sunset announced (T+210 days)
                             │  └─ 30-day final notice
                             │
v1 Retired ──────────────────┼─ v1 Removed (T+240 days)
                             │  └─ Returns 410 Gone
                             │
v2 Active ──────────────────►
```

---

## 3. Deprecation Timeline

### 3.1 Standard Deprecation Timeline

**Minimum Timeline**: 180 days from deprecation notice to retirement

**Timeline Breakdown**:
- **T+0**: Deprecation announced in changelog
- **T+0**: Migration guide published
- **T+0**: `Deprecation` header added to responses
- **T+90**: Second reminder via changelog and email
- **T+150**: Final 30-day warning via changelog and email
- **T+180**: API version retired (returns HTTP 410)

### 3.2 Accelerated Deprecation (Security)

For critical security vulnerabilities:
- **Minimum**: 30 days notice
- **Process**: Emergency announcement + immediate migration support
- **Support**: Direct engineering assistance for affected clients

### 3.3 Extended Deprecation (Major Breaking Changes)

For extensive breaking changes:
- **Minimum**: 365 days notice
- **Process**: Beta period + parallel operation + gradual migration
- **Examples**: Complete data model redesign, authentication system changes

---

## 4. Deprecation Communication

### 4.1 Communication Channels

1. **Changelog** (Primary)
   - Location: `/docs/api/CHANGELOG.md`
   - Updated for every deprecation
   - Includes migration examples

2. **Response Headers**
   - `Deprecation: true` - API is deprecated
   - `Sunset: <HTTP-date>` - Retirement date
   - `Link: <url>; rel="alternate"` - Migration target

3. **Email Notifications** (if email list available)
   - Deprecation announcement (T+0)
   - 90-day reminder (T+90)
   - 30-day final warning (T+150)

4. **Documentation**
   - Deprecated endpoints marked with ⚠️ badge
   - Migration guide linked prominently
   - Example code updated for new version

### 4.2 Response Headers Example

```http
HTTP/1.1 200 OK
Deprecation: true
Sunset: Sat, 01 Aug 2026 00:00:00 GMT
Link: </api/v2/campaigns>; rel="alternate"
X-API-Version: 1

{
  "success": true,
  "data": { ... },
  "warning": "This endpoint is deprecated and will be removed on 2026-08-01. Migrate to /api/v2/campaigns"
}
```

---

## 5. Breaking vs Non-Breaking Changes

### 5.1 Non-Breaking Changes (Allowed in Same Version)

✅ **Safe to Deploy Without Version Bump**:
- Adding new optional request fields
- Adding new fields to response objects
- Adding new endpoints
- Adding new enum values (at end of list)
- Expanding validation rules (less strict)
- Improving error messages (text only)
- Adding new HTTP status codes for new scenarios
- Performance improvements
- Bug fixes

**Client Requirements**:
- Must ignore unknown response fields
- Must handle new enum values gracefully
- Must use error codes, not error message text

### 5.2 Breaking Changes (Require New Version)

❌ **Require Major Version Bump**:
- Removing endpoints
- Removing request or response fields
- Renaming fields
- Changing field types (e.g., string → number)
- Making optional fields required
- Changing required fields to optional
- Removing enum values
- Tightening validation rules (more strict)
- Changing HTTP status codes for existing scenarios
- Changing error codes
- Changing authentication mechanisms
- Changing URL structure
- Changing response envelope structure

---

## 6. Version Header Handling

### 6.1 Version Detection Priority

API version is detected in this order:

1. **URL Path Prefix** (Highest Priority)
   ```
   /api/v1/campaigns  → Uses v1
   /api/v2/campaigns  → Uses v2
   ```

2. **X-API-Version Header**
   ```http
   GET /api/campaigns
   X-API-Version: 2
   ```

3. **Default to Latest Stable** (If No Version Specified)
   ```http
   GET /api/campaigns
   → Routes to /api/v2/campaigns (if v2 is latest stable)
   ```

### 6.2 Version Header Values

```http
X-API-Version: 1          # Use v1
X-API-Version: 2          # Use v2
X-API-Version: latest     # Use latest stable version
X-API-Version: beta       # Use beta version (if available)
```

### 6.3 Invalid Version Handling

```http
GET /api/v99/campaigns
HTTP/1.1 404 Not Found

{
  "success": false,
  "error": {
    "code": "INVALID_API_VERSION",
    "message": "API version 99 does not exist. Available versions: 1, 2",
    "details": {
      "requested_version": "99",
      "available_versions": [1, 2],
      "latest_version": 2,
      "recommended_action": "Use /api/v2/campaigns or X-API-Version: 2"
    }
  }
}
```

---

## 7. Migration Support

### 7.1 Migration Guide Requirements

Every breaking change must include:

1. **Change Summary**
   - What changed and why
   - Impact assessment
   - Alternative solutions

2. **Before/After Examples**
   ```typescript
   // v1 (Deprecated)
   POST /api/v1/campaigns
   { "name": "Campaign", "budget": 1000 }

   // v2 (Current)
   POST /api/v2/campaigns
   { "name": "Campaign", "budget": { "amount": 1000, "currency": "USD" } }
   ```

3. **Migration Checklist**
   - [ ] Update endpoint URLs
   - [ ] Update request schemas
   - [ ] Update response parsing
   - [ ] Test error handling
   - [ ] Update documentation

4. **Testing Recommendations**
   - Test cases for new version
   - Compatibility testing approach
   - Rollback procedures

### 7.2 Parallel Operation Period

During deprecation:
- **Both versions active**: v1 and v2 run simultaneously
- **Shared data**: Same database, consistent state
- **Cross-version compatibility**: Actions in v1 visible in v2 and vice versa

### 7.3 Beta Testing Program

For major versions:
- **Beta access**: 60 days before official release
- **Feedback period**: 30 days for API design iteration
- **Breaking changes allowed**: Only during beta period
- **Stability promise**: No breaking changes after v2.0.0 release

---

## 8. Version Numbering Scheme

### 8.1 Semantic Versioning for APIs

**Format**: `vMAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes (v1 → v2)
- **MINOR**: Non-breaking additions (v2.0 → v2.1)
- **PATCH**: Bug fixes only (v2.1.0 → v2.1.1)

**URL Versioning**:
- URL only includes MAJOR version: `/api/v2/...`
- MINOR and PATCH are transparent to clients
- Full version returned in `X-API-Version` response header

### 8.2 Version Response Header

```http
HTTP/1.1 200 OK
X-API-Version: 2.1.3
X-API-Version-Major: 2
X-API-Deprecated: false
X-API-Sunset-Date: null
```

---

## 9. Client Best Practices

### 9.1 Recommended Client Implementation

```typescript
class BrandInfinityClient {
  constructor(
    private baseUrl: string,
    private apiVersion: number = 2,  // Pin to specific version
    private timeout: number = 30000
  ) {}

  async request(endpoint: string, options: RequestOptions) {
    const url = `${this.baseUrl}/api/v${this.apiVersion}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': this.apiVersion.toString(),
        ...options.headers
      }
    });

    // Check for deprecation warnings
    const deprecated = response.headers.get('Deprecation');
    const sunset = response.headers.get('Sunset');
    
    if (deprecated === 'true') {
      console.warn(`API v${this.apiVersion} is deprecated. Sunset date: ${sunset}`);
      this.notifyDeprecation(endpoint, sunset);
    }

    return response.json();
  }
}
```

### 9.2 Version Pinning Strategy

**Recommended**: Pin to specific major version
```typescript
const client = new BrandInfinityClient('https://api.example.com', 2);
```

**Not Recommended**: Use "latest" in production
```typescript
// ❌ Avoid - can break unexpectedly
const client = new BrandInfinityClient('https://api.example.com', 'latest');
```

### 9.3 Graceful Degradation

```typescript
// Try new version, fall back to old
async function getCampaigns() {
  try {
    return await clientV2.getCampaigns();
  } catch (error) {
    if (error.code === 'INVALID_API_VERSION') {
      console.warn('Falling back to v1 API');
      return await clientV1.getCampaigns();
    }
    throw error;
  }
}
```

---

## 10. Governance

### 10.1 Decision Authority

**Breaking Changes Approval Required From**:
- Technical Lead (architecture review)
- Product Manager (business impact)
- Customer Success (client communication)

**Non-Breaking Changes**:
- Approved by Technical Lead or Senior Engineer

### 10.2 Emergency Deprecation

For security vulnerabilities (CVSS ≥ 7.0):
1. **Immediate**: Temporary patch applied to current version
2. **T+0**: Emergency deprecation announcement
3. **T+7**: Patched version mandatory
4. **T+30**: Vulnerable version retired (minimum)

### 10.3 Rollback Policy

If a new version has critical issues:
- **Immediate**: Rollback to previous stable version
- **Communication**: Announce via status page and email
- **Timeline**: Extended deprecation for previous version
- **Post-Mortem**: Required within 48 hours

---

## 11. Version Support Matrix

| Version | Release Date | Status | Sunset Date | Notes |
|---------|-------------|--------|-------------|-------|
| v1 | 2026-01-11 | ✅ Active | TBD | Current stable version |
| v2 | TBD | 📋 Planned | TBD | Breaking changes for 2026 H2 |

**Support Commitment**:
- **v1**: Supported until v2 is stable + 180 days minimum
- **Security patches**: Backported to deprecated versions for 90 days
- **Critical bugs**: Fixed in current version only

---

## 12. Monitoring and Metrics

### 12.1 Version Usage Tracking

Track for each API version:
- Total requests per day
- Unique clients per day
- Error rate
- Response time percentiles

### 12.2 Deprecation Metrics

Monitor during deprecation period:
- Percentage of traffic on deprecated version
- Number of unique clients still using old version
- Trend analysis (increasing/decreasing usage)

### 12.3 Sunset Readiness Criteria

Before retiring a version:
- [ ] < 5% of total API traffic on deprecated version
- [ ] < 10 unique active clients on deprecated version
- [ ] All known clients contacted and migrated
- [ ] Migration guide tested by at least 3 external clients
- [ ] Retirement announcement sent 3 times (T-90, T-30, T-7)

---

## 13. Exceptions and Waivers

### 13.1 Waiver Request Process

Clients can request deprecation timeline extension:

1. **Submit Request**: Email to api-support@example.com
2. **Include**: Business justification, migration timeline, blocker details
3. **Review**: Within 5 business days
4. **Approval**: Requires CTO sign-off for extensions > 90 days

### 13.2 Waiver Limits

- **Maximum Extension**: 180 additional days (total 360 days)
- **Granted Sparingly**: Only for critical blockers
- **Public Disclosure**: Waiver grants announced in changelog
- **No Waivers**: For security-related deprecations

---

## 14. Document Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-11 | Initial policy document | GitHub Copilot |

---

## 15. References

- **API Contract**: `/docs/api/V1_API_CONTRACT.md`
- **Changelog**: `/docs/api/CHANGELOG.md`
- **Migration Guides**: `/docs/api/migrations/`
- **Support**: GitHub Issues or api-support@example.com

---

**Policy Status**: ✅ Active  
**Next Review**: Q2 2026  
**Last Updated**: January 11, 2026
