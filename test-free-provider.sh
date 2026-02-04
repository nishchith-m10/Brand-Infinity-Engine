#!/bin/bash
# Quick test script for free provider request creation

API_URL="http://localhost:3000/api/v1/requests"

# Test payload with Pollinations (free provider)
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "brand_id": "test-brand-id",
    "campaign_id": "test-campaign-id",
    "title": "Free Provider Test Image",
    "type": "image",
    "requirements": {
      "prompt": "A beautiful sunset over mountains",
      "aspect_ratio": "16:9",
      "style_preset": "Realistic"
    },
    "settings": {
      "provider": "pollinations",
      "tier": "standard",
      "auto_script": false
    }
  }' | jq '.'

echo -e "\n\n=== Expected result ==="
echo "✓ Status: 201 Created"
echo "✓ estimated_cost: 0"
echo "✓ No INSUFFICIENT_BUDGET error"
