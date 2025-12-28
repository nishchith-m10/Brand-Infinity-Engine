# 📐 Coding Conventions & Guidelines

Standards and patterns for the Brand Infinity Engine codebase.

---

## 🗂️ Project Structure

```
brand-infinity-engine/
├── config/              # Configuration files
├── database/
│   ├── migrations/      # SQL migration files (001_, 002_, etc.)
│   └── seeds/           # Seed data files
├── docs/                # Documentation
│   └── PRODUCT_REQUIREMENTS/  # PRD and specs
├── rules/               # AI context and conventions (this folder)
├── scripts/
│   ├── deploy/          # Deployment scripts
│   ├── migrations/      # Migration runners
│   ├── seed/            # Seeding scripts
│   └── setup/           # Setup and validation scripts
├── src/                 # Application source (to be created)
│   ├── pillars/         # Pillar-specific modules
│   ├── routes/          # Express routes
│   ├── middleware/      # Express middleware
│   └── services/        # Shared services
├── tests/
│   ├── integration/     # Integration tests
│   └── unit/            # Unit tests
├── utils/               # Utility modules
├── workflows/           # n8n workflow JSON files
│   ├── pillar_1_strategist/
│   ├── pillar_2_copywriter/
│   ├── pillar_3_production/
│   ├── pillar_4_campaign_manager/
│   └── pillar_5_broadcaster/
├── .env.local           # Local environment (DO NOT COMMIT)
├── .env.example         # Environment template
├── docker-compose.yml   # Docker services
├── index.js             # Application entry point
└── package.json         # Dependencies and scripts
```

---

## 📝 Naming Conventions

### Files
- **Modules:** `snake_case.js` (e.g., `brand_validator.js`, `cost_calculator.js`)
- **Classes:** `PascalCase.js` (e.g., `BrandValidator.js`) if single class export
- **Tests:** `*.test.js` or `*.spec.js` (e.g., `brand_validator.test.js`)
- **Migrations:** `NNN_description.sql` (e.g., `001_create_trends_table.sql`)

### Code
- **Variables:** `camelCase` (e.g., `brandGuideline`, `campaignId`)
- **Constants:** `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)
- **Classes:** `PascalCase` (e.g., `BrandValidator`, `CostCalculator`)
- **Functions:** `camelCase` (e.g., `validateBrand`, `calculateCost`)
- **Database tables:** `snake_case` (e.g., `brand_guidelines`, `creative_briefs`)
- **Database columns:** `snake_case` (e.g., `brand_id`, `created_at`)

---

## 🏛️ Architecture Patterns

### Module Structure
```javascript
// utils/example_module.js

import { pool } from './db.js';

/**
 * Module description
 * @module ExampleModule
 */

// Constants
const DEFAULT_VALUE = 100;

// Class definition
export class ExampleModule {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async methodName(params) {
    // Implementation
  }
}

// Factory function (optional)
export function createExampleModule(config) {
  return new ExampleModule(config);
}

// Default export
export default ExampleModule;
```

### Error Handling
```javascript
// Custom error classes
export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

// Usage
try {
  await validateBrand(data);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  }
  throw error; // Re-throw unexpected errors
}
```

### Database Queries
```javascript
// Always use parameterized queries
const result = await pool.query(
  'SELECT * FROM brand_guidelines WHERE brand_id = $1',
  [brandId]
);

// Never do this:
// const result = await pool.query(`SELECT * FROM brand_guidelines WHERE brand_id = '${brandId}'`);
```

---

## 🔌 API Design

### REST Endpoints
```
GET    /api/v1/brands              # List brands
POST   /api/v1/brands              # Create brand
GET    /api/v1/brands/:id          # Get brand
PUT    /api/v1/brands/:id          # Update brand
DELETE /api/v1/brands/:id          # Delete brand

POST   /api/v1/campaigns           # Create campaign
GET    /api/v1/campaigns/:id       # Get campaign
POST   /api/v1/campaigns/:id/briefs    # Generate brief
POST   /api/v1/campaigns/:id/scripts   # Generate script
POST   /api/v1/campaigns/:id/videos    # Generate video
POST   /api/v1/campaigns/:id/publish   # Publish campaign
```

### Response Format
```javascript
// Success response
{
  "success": true,
  "data": { /* result */ },
  "meta": {
    "timestamp": "2025-12-18T00:00:00Z",
    "requestId": "uuid"
  }
}

// Error response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Brand guidelines validation failed",
    "details": { /* specifics */ }
  },
  "meta": {
    "timestamp": "2025-12-18T00:00:00Z",
    "requestId": "uuid"
  }
}
```

---

## 🧪 Testing Standards

### Unit Tests
```javascript
// tests/unit/brand_validator.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';
import { BrandValidator } from '../../utils/brand_validator.js';

describe('BrandValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new BrandValidator();
  });

  describe('validateContent', () => {
    it('should pass valid brand-aligned content', async () => {
      const result = await validator.validateContent(validContent, guidelines);
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThan(0.85);
    });

    it('should reject off-brand content', async () => {
      const result = await validator.validateContent(offBrandContent, guidelines);
      expect(result.isValid).toBe(false);
    });
  });
});
```

### Integration Tests
```javascript
// tests/integration/campaign_flow.test.js
describe('Campaign Flow', () => {
  it('should generate brief from brand guidelines', async () => {
    // Setup
    const brand = await createTestBrand();
    
    // Execute
    const brief = await generateBrief(brand.id, campaignParams);
    
    // Verify
    expect(brief.brandAlignment).toBeGreaterThan(0.9);
    expect(brief.targetAudience).toBeDefined();
  });
});
```

---

## 📊 Database Conventions

### Migration Files
```sql
-- database/migrations/NNN_description.sql

-- Up Migration
CREATE TABLE table_name (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_table_name_field ON table_name(field);

-- Add comments
COMMENT ON TABLE table_name IS 'Description of table purpose';
COMMENT ON COLUMN table_name.field IS 'Description of field';
```

### Common Columns
Every table should have:
- `id` - UUID primary key
- `created_at` - Timestamp with timezone
- `updated_at` - Timestamp with timezone (with trigger)

---

## 🔐 Security Rules

1. **Never log sensitive data** (API keys, passwords, tokens)
2. **Always use parameterized queries** (prevent SQL injection)
3. **Validate all inputs** (use Joi or similar)
4. **Encrypt secrets at rest** (use encryption_key from env)
5. **Use HTTPS only** in production
6. **Rate limit API endpoints** (configured in env)
7. **Sanitize user-generated content** before storage

---

## 📦 Git Conventions

### Branch Naming
```
feature/pillar-1-strategist
fix/brand-validation-score
chore/update-dependencies
docs/api-documentation
```

### Commit Messages
```
feat(strategist): add trend scraping module
fix(validator): correct brand score calculation
chore: update dependencies
docs: add API endpoint documentation
test: add unit tests for cost calculator
```

### PR Checklist
- [ ] Code follows conventions.md
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No secrets in code
- [ ] project_context.md updated

---

## 🎨 Code Style

### ESLint Config
Using `eslint-config-airbnb-base` with these overrides:
- `import/extensions`: Always use `.js` extension for ES modules
- `no-console`: Warn (use winston logger in production)
- `max-len`: 120 characters

### Prettier Config
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## 📝 Documentation Standards

### JSDoc Comments
```javascript
/**
 * Validates content against brand guidelines
 * @param {string} content - The content to validate
 * @param {Object} guidelines - Brand guidelines object
 * @param {string} guidelines.tone - Expected tone
 * @param {string[]} guidelines.restrictedKeywords - Words to avoid
 * @returns {Promise<ValidationResult>} Validation result with score
 * @throws {ValidationError} If guidelines are invalid
 */
async function validateContent(content, guidelines) {
  // ...
}
```

### README for New Modules
Each major module should have a README explaining:
- Purpose
- Usage examples
- Configuration options
- Dependencies
