#!/usr/bin/env python3
"""
Add MOCK_MODE support to Brand Infinity Engine workflows.
Usage: python3 add_mock_mode.py
"""

import json
import os

WORKFLOWS_DIR = os.path.dirname(os.path.abspath(__file__))
MAIN_DIR = os.path.join(WORKFLOWS_DIR, "main-workflows")

# Mock mode code to inject into Route to Provider node
MOCK_MODE_CODE = '''// ============================================
// MULTI-VENDOR ROUTING WITH MOCK MODE
// Per Manifesto Section 5.2
// MOCK_MODE: Set env var MOCK_MODE=true to skip real API calls
// ============================================

const ticket = $('Create Job Tickets').first().json;
const provider = ticket.provider_priority[0];
const mockMode = $env.MOCK_MODE === 'true';

// MOCK MODE: Return fake response without calling API
if (mockMode) {
  return [{
    json: {
      ...ticket,
      selected_provider: 'mock',
      mock_mode: true,
      api_config: null,
      mock_response: {
        id: 'mock_' + Date.now(),
        status: 'completed',
        output_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      }
    }
  }];
}

// REAL MODE: Build provider-specific API request
const providerConfigs = {
  'sora': {
    url: 'https://api.openai.com/v1/videos/generations',
    method: 'POST',
    body: {
      prompt: ticket.visual_prompt,
      duration: Math.min(ticket.duration_seconds, 20),
      model: 'sora-1.0'
    },
    auth: 'openai'
  },
  'runway': {
    url: 'https://api.runwayml.com/v1/generations',
    method: 'POST',
    body: {
      prompt: ticket.visual_prompt,
      duration: ticket.duration_seconds,
      mode: 'gen3'
    },
    auth: 'runway'
  },
  'pika': {
    url: 'https://api.pika.art/v1/generate',
    method: 'POST',
    body: {
      prompt: ticket.visual_prompt,
      duration: ticket.duration_seconds
    },
    auth: 'pika'
  },
  'kling': {
    url: 'https://api.kling.ai/v1/videos',
    method: 'POST',
    body: {
      prompt: ticket.visual_prompt,
      duration: ticket.duration_seconds
    },
    auth: 'kling'
  }
};

const config = providerConfigs[provider] || providerConfigs['runway'];

return [{
  json: {
    ...ticket,
    selected_provider: provider,
    mock_mode: false,
    api_config: config
  }
}];'''


def patch_production_dispatcher():
    """Patch Production_Dispatcher.json with mock mode."""
    filepath = os.path.join(MAIN_DIR, "Production_Dispatcher.json")
    
    with open(filepath, 'r') as f:
        workflow = json.load(f)
    
    # Find and update Route to Provider node
    for node in workflow['nodes']:
        if node['name'] == 'Route to Provider':
            node['parameters']['jsCode'] = MOCK_MODE_CODE
            print(f"✓ Patched 'Route to Provider' node in Production_Dispatcher.json")
            break
    
    # Add mock mode check to Parse Response node
    for node in workflow['nodes']:
        if node['name'] == 'Parse Response':
            original_code = node['parameters']['jsCode']
            if 'mock_mode' not in original_code:
                mock_check = '''// Handle mock mode response
const routeData = $('Route to Provider').first().json;
if (routeData.mock_mode) {
  return [{
    json: {
      success: true,
      campaign_id: routeData.campaign_id,
      script_id: routeData.script_id,
      scene_id: routeData.scene_id,
      provider: 'mock',
      provider_job_id: routeData.mock_response.id,
      status: 'completed',
      result_url: routeData.mock_response.output_url,
      prompt: routeData.visual_prompt,
      submitted_at: new Date().toISOString(),
      mock_mode: true
    }
  }];
}

'''
                node['parameters']['jsCode'] = mock_check + original_code
                print(f"✓ Patched 'Parse Response' node in Production_Dispatcher.json")
            break
    
    with open(filepath, 'w') as f:
        json.dump(workflow, f, indent=2)
    
    return True


def main():
    print("=" * 50)
    print("Adding MOCK_MODE support to workflows")
    print("=" * 50)
    print()
    
    patch_production_dispatcher()
    
    print()
    print("=" * 50)
    print("Done! Now re-import the updated workflows to n8n.")
    print()
    print("To enable mock mode, add this environment variable in n8n:")
    print("  MOCK_MODE=true")
    print()
    print("To disable mock mode and use real APIs:")
    print("  MOCK_MODE=false  (or just remove the variable)")
    print("=" * 50)


if __name__ == "__main__":
    main()
