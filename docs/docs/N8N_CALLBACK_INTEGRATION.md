# n8n Integration Guide - Phase 8

This guide explains how to configure n8n workflows to integrate with the Phase 8 orchestrator.

## Overview

The Phase 8 orchestrator dispatches production tasks to n8n workflows and receives completion signals via callbacks. This enables async task execution while maintaining orchestration control.

## Architecture

```
Request → Orchestrator → ProducerAdapter → n8n Workflow
                              ↓
                     (continues to next task)
                              ↓
n8n Workflow Complete → Callback API → Orchestrator → Resume Processing
```

## Callback API Endpoint

**URL**: `POST /api/v1/callbacks/n8n`

**Required Query Parameters**:
- `requestId` - The content request ID
- `taskId` - The specific task ID

**Request Body** (JSON):
```json
{
  "requestId": "req_123",
  "taskId": "task_456",
  "executionId": "exec_789",
  "workflowId": "workflow_abc",
  "status": "success",
  "result": {
    "output_url": "https://storage.example.com/video.mp4",
    "metadata": {
      "duration": 30,
      "format": "mp4",
      "resolution": "1080p"
    }
  }
}
```

**Error Response**:
```json
{
  "requestId": "req_123",
  "taskId": "task_456",
  "executionId": "exec_789",
  "status": "error",
  "error": {
    "code": "RENDERING_FAILED",
    "message": "Video rendering failed: insufficient resources",
    "details": {
      "step": "final_render",
      "attempt": 1
    }
  }
}
```

## n8n Workflow Configuration

### 1. Workflow Input

Your n8n workflow will receive this payload from the ProducerAdapter:

```json
{
  "requestId": "uuid",
  "taskId": "uuid",
  "taskType": "Generate video with voiceover",
  "contentType": "video_with_vo",
  "input": {
    "request_params": {
      "duration": 30,
      "tone": "professional"
    },
    "strategic_brief": {
      "type": "strategic_brief",
      "content": "Campaign strategy..."
    },
    "script": {
      "type": "content",
      "content": "Video script..."
    }
  },
  "callbackUrl": "https://your-app.com/api/v1/callbacks/n8n?requestId=xxx&taskId=yyy",
  "metadata": {
    "request_type": "video_with_vo",
    "created_at": "2025-01-04T..."
  }
}
```

### 2. Required Workflow Nodes

#### A. Start Node
- **Type**: Webhook / Manual Trigger
- **Method**: POST
- **Authentication**: API Key (recommended)

#### B. Processing Nodes
Your workflow logic here:
- Video generation
- Image creation
- Voiceover synthesis
- Etc.

#### C. Success Callback Node
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{ $json.callbackUrl }}`
- **Body**:
```javascript
{
  "requestId": "{{ $json.requestId }}",
  "taskId": "{{ $json.taskId }}",
  "executionId": "{{ $workflow.id }}",
  "workflowId": "{{ $workflow.name }}",
  "status": "success",
  "result": {
    "output_url": "{{ $node['Upload to Storage'].json.url }}",
    "metadata": {
      "duration": {{ $node['Get Video Info'].json.duration }},
      "format": "{{ $node['Get Video Info'].json.format }}",
      "processing_time_ms": {{ $workflow.executionTime }}
    }
  }
}
```

#### D. Error Callback Node (on workflow error)
- **Type**: HTTP Request
- **Method**: POST
- **URL**: `{{ $json.callbackUrl }}`
- **Body**:
```javascript
{
  "requestId": "{{ $json.requestId }}",
  "taskId": "{{ $json.taskId }}",
  "executionId": "{{ $workflow.id }}",
  "status": "error",
  "error": {
    "code": "WORKFLOW_ERROR",
    "message": "{{ $node['Error Handler'].json.message }}",
    "details": {
      "failed_node": "{{ $node['Error Handler'].json.node }}",
      "error_type": "{{ $node['Error Handler'].json.type }}"
    }
  }
}
```

### 3. Error Handling Configuration

Add an **Error Trigger** node to catch workflow failures:

```
Error Trigger → Format Error Response → HTTP Request (Error Callback)
```

## Workflow Examples

### Video Production Workflow

```
Webhook Trigger
  ↓
Extract Script & Brief
  ↓
Generate Visuals (Stable Diffusion / DALL-E)
  ↓
Generate Voiceover (ElevenLabs / Azure TTS)
  ↓
Combine Video + Audio (FFmpeg)
  ↓
Upload to Storage (S3 / Cloudinary)
  ↓
Success Callback → Orchestrator
```

### Image Generation Workflow

```
Webhook Trigger
  ↓
Extract Brief & Requirements
  ↓
Generate Image (DALL-E / Midjourney)
  ↓
Apply Branding / Filters
  ↓
Upload to Storage
  ↓
Success Callback → Orchestrator
```

### Voiceover Synthesis Workflow

```
Webhook Trigger
  ↓
Extract Script
  ↓
Text-to-Speech (ElevenLabs)
  ↓
Upload Audio File
  ↓
Success Callback → Orchestrator
```

## Environment Variables

Add to your `.env.local`:

```bash
# n8n Configuration
N8N_BASE_URL=http://localhost:5678
N8N_API_KEY=your_n8n_api_key

# Workflow IDs (after creating workflows)
N8N_WORKFLOW_VIDEO=workflow_video_production_id
N8N_WORKFLOW_IMAGE=workflow_image_generation_id
N8N_WORKFLOW_VOICEOVER=workflow_voiceover_synthesis_id

# App URL for callbacks
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Testing Callbacks

### 1. Test Callback Endpoint

```bash
curl -X POST http://localhost:3000/api/v1/callbacks/n8n \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-request-id",
    "taskId": "test-task-id",
    "executionId": "test-exec-123",
    "status": "success",
    "result": {
      "output_url": "https://example.com/output.mp4",
      "metadata": {
        "test": true
      }
    }
  }'
```

### 2. Test n8n Dispatch

```bash
curl -X POST http://localhost:5678/webhook/production \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "req_123",
    "taskId": "task_456",
    "taskType": "Generate video",
    "input": {
      "script": "Test video script"
    },
    "callbackUrl": "http://localhost:3000/api/v1/callbacks/n8n?requestId=req_123&taskId=task_456"
  }'
```

## Monitoring & Debugging

### Check Provider Metadata

```sql
SELECT 
  pm.*,
  rt.task_name,
  rt.status
FROM provider_metadata pm
JOIN request_tasks rt ON rt.id = pm.task_id
WHERE pm.provider_name = 'n8n'
ORDER BY pm.created_at DESC
LIMIT 10;
```

### Check Callback Events

```sql
SELECT 
  event_type,
  event_data,
  created_at
FROM request_events
WHERE event_type = 'provider_callback'
  AND event_data->>'provider_name' = 'n8n'
ORDER BY created_at DESC
LIMIT 10;
```

### Common Issues

**Issue**: Callback not received
- Check n8n workflow logs for HTTP request errors
- Verify callback URL is accessible from n8n
- Check firewall/ngrok configuration for local development

**Issue**: Task stuck in "in_progress"
- n8n workflow may have failed without error callback
- Check n8n execution logs
- Manually update task status or retry

**Issue**: Wrong callback payload format
- Verify n8n HTTP Request node body matches expected format
- Check for missing required fields (requestId, taskId, status)

## Next Steps

1. Create n8n workflows for each production task type
2. Configure webhook authentication
3. Add retry logic for callback failures
4. Set up monitoring/alerting for stuck tasks
5. Implement workflow versioning strategy

## Security Considerations

1. **API Key Authentication**: Secure n8n webhook endpoints
2. **Callback Validation**: Verify callback signatures (future enhancement)
3. **Rate Limiting**: Prevent callback flooding
4. **Timeout Handling**: Auto-fail tasks that don't callback within reasonable time
