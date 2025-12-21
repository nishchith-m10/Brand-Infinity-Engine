#!/bin/bash

# =============================================================================
# Brand Infinity Engine - Database Seeding Script
# Description: Populate database with test/sample data
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Database connection details
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-brand_infinity}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD}"

echo -e "${GREEN}==============================================================================${NC}"
echo -e "${GREEN}Brand Infinity Engine - Database Seeding${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo ""

# Seed sample data
echo -e "${YELLOW}Seeding brand guidelines...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- Sample Brand Guideline
INSERT INTO brand_guidelines (brand_name, industry, tone, visual_style, target_audience, core_values, metadata)
VALUES (
    'TechFlow',
    'SaaS / Productivity Tools',
    'Professional yet approachable, innovative, empowering',
    'Modern minimalist, blue and white color scheme, clean typography',
    'Tech-savvy professionals, startups, remote teams',
    '["Innovation", "Simplicity", "Collaboration", "Efficiency"]'::jsonb,
    '{
        "logo_url": "https://example.com/logo.png",
        "primary_color": "#0066FF",
        "secondary_color": "#FFFFFF",
        "font_family": "Inter, sans-serif",
        "tagline": "Work smarter, not harder"
    }'::jsonb
) ON CONFLICT DO NOTHING;
EOF

echo -e "${YELLOW}Seeding sample trends...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- Sample Trends
INSERT INTO trends (trend_text, platform, virality_score, relevance_score, metadata)
VALUES 
    ('AI automation is transforming workplace productivity', 'LinkedIn', 0.85, 0.92, '{"hashtags": ["#AI", "#Productivity", "#FutureOfWork"]}'::jsonb),
    ('Remote work tools see 300% growth in adoption', 'Twitter', 0.78, 0.88, '{"hashtags": ["#RemoteWork", "#SaaS"]}'::jsonb),
    ('Short-form video content dominates B2B marketing', 'TikTok', 0.91, 0.76, '{"hashtags": ["#B2BMarketing", "#VideoContent"]}'::jsonb)
ON CONFLICT DO NOTHING;
EOF

echo -e "${YELLOW}Seeding sample competitor ads...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
-- Sample Competitor Ads
INSERT INTO competitor_ads (competitor_name, ad_content, platform, engagement_score, metadata)
VALUES
    ('Slack', 'Where work happens. Connect your team with Slack.', 'YouTube', 0.87, '{"views": 1500000, "likes": 45000}'::jsonb),
    ('Notion', 'One workspace. Every team.', 'Instagram', 0.82, '{"views": 850000, "likes": 32000}'::jsonb),
    ('Asana', 'Manage your team projects and tasks in one place', 'LinkedIn', 0.79, '{"views": 620000, "likes": 18500}'::jsonb)
ON CONFLICT DO NOTHING;
EOF

echo -e "${GREEN}✓ Sample data seeded successfully${NC}"
echo ""
echo -e "${YELLOW}Sample Records Created:${NC}"
echo "  - 1 Brand Guideline (TechFlow)"
echo "  - 3 Trending Topics"
echo "  - 3 Competitor Ad Examples"
echo ""
echo -e "${GREEN}Database is ready for testing!${NC}"
