/**
 * Scene Parser Utility
 * Parses LLM-generated script content into structured scenes for n8n workflows
 * 
 * Purpose:
 * - Convert free-form LLM output into structured scene objects
 * - Support multiple formats: timestamps, numbered lists, paragraphs
 * - Ensure scenes are compatible with n8n Production_Dispatcher workflow
 */

export interface Scene {
  visual_prompt: string;
  duration_seconds: number;
  voiceover_text: string;
  scene_index: number;
}

/**
 * Parse LLM-generated script content into structured scenes
 * 
 * Supports formats:
 * 1. Timestamp format: [0:00-0:05] HOOK: ...
 * 2. Numbered sections: 1. HOOK: ... 2. PROBLEM: ...
 * 3. Fallback: Split by paragraphs
 * 
 * @param content - Raw LLM output text
 * @param totalDuration - Target total duration in seconds
 * @returns Array of Scene objects for n8n
 */
export function parseScenes(content: string, totalDuration: number): Scene[] {
  const scenes: Scene[] = [];
  
  // Method 1: Try to parse timestamp format [0:00-0:05] HOOK: ...
  const timestampRegex = /\[(\d+):(\d+)-(\d+):(\d+)\]\s*([A-Z_]+):\s*([\s\S]*?)(?=\[\d+:\d+-\d+:\d+\]|$)/g;
  let match;
  let sceneIndex = 0;
  
  while ((match = timestampRegex.exec(content)) !== null) {
    const startSec = parseInt(match[1]) * 60 + parseInt(match[2]);
    const endSec = parseInt(match[3]) * 60 + parseInt(match[4]);
    const duration = Math.max(endSec - startSec, 3); // Minimum 3 seconds
    const sceneType = match[5];
    const text = match[6].trim();
    
    if (text.length > 0) {
      scenes.push({
        visual_prompt: `${sceneType}: ${text.substring(0, 200)}`,
        duration_seconds: duration,
        voiceover_text: text,
        scene_index: sceneIndex++,
      });
    }
  }
  
  // If timestamp format worked, return those scenes
  if (scenes.length > 0) {
    return normalizeSceneDurations(scenes, totalDuration);
  }
  
  // Method 2: Try numbered section format
  const numberedRegex = /(\d+)\.\s*([A-Z_]+):\s*([\s\S]*?)(?=\d+\.\s*[A-Z_]+:|$)/g;
  
  while ((match = numberedRegex.exec(content)) !== null) {
    const sceneType = match[2];
    const text = match[3].trim();
    
    if (text.length > 0) {
      scenes.push({
        visual_prompt: `${sceneType}: ${text.substring(0, 200)}`,
        duration_seconds: 0, // Will be normalized
        voiceover_text: text,
        scene_index: sceneIndex++,
      });
    }
  }
  
  if (scenes.length > 0) {
    return normalizeSceneDurations(scenes, totalDuration);
  }
  
  // Method 3: Fallback - split by double newlines (paragraphs)
  const paragraphs = content
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20); // Ignore very short paragraphs
  
  if (paragraphs.length === 0) {
    // Ultimate fallback: single scene with all content
    return [{
      visual_prompt: content.substring(0, 200),
      duration_seconds: totalDuration,
      voiceover_text: content,
      scene_index: 0,
    }];
  }
  
  paragraphs.forEach((para, idx) => {
    // Try to extract a label from the paragraph
    const labelMatch = para.match(/^([A-Z_]+):\s*/);
    const label = labelMatch ? labelMatch[1] : `SCENE_${idx + 1}`;
    const text = labelMatch ? para.replace(labelMatch[0], '') : para;
    
    scenes.push({
      visual_prompt: `${label}: ${text.substring(0, 200)}`,
      duration_seconds: 0, // Will be normalized
      voiceover_text: text,
      scene_index: idx,
    });
  });
  
  return normalizeSceneDurations(scenes, totalDuration);
}

/**
 * Normalize scene durations to match target total duration
 * Distributes duration proportionally based on text length
 */
function normalizeSceneDurations(scenes: Scene[], totalDuration: number): Scene[] {
  if (scenes.length === 0) return scenes;
  
  // Check if durations are already set (from timestamp parsing)
  const existingTotal = scenes.reduce((sum, s) => sum + s.duration_seconds, 0);
  
  if (existingTotal > 0) {
    // Durations exist - scale to match target
    const scale = totalDuration / existingTotal;
    return scenes.map(s => ({
      ...s,
      duration_seconds: Math.max(Math.round(s.duration_seconds * scale), 3),
    }));
  }
  
  // No durations - distribute based on text length
  const totalTextLength = scenes.reduce((sum, s) => sum + s.voiceover_text.length, 0);
  
  if (totalTextLength === 0) {
    // Equal distribution
    const perScene = Math.floor(totalDuration / scenes.length);
    return scenes.map(s => ({ ...s, duration_seconds: perScene }));
  }
  
  return scenes.map(s => ({
    ...s,
    duration_seconds: Math.max(
      Math.round((s.voiceover_text.length / totalTextLength) * totalDuration),
      3 // Minimum 3 seconds per scene
    ),
  }));
}

/**
 * Extract hook text from scenes (first scene or scene labeled HOOK)
 */
export function extractHook(scenes: Scene[]): { text: string; hook_type: string } {
  const hookScene = scenes.find(s => 
    s.visual_prompt.toLowerCase().includes('hook') ||
    s.scene_index === 0
  );
  
  return {
    text: hookScene?.voiceover_text?.substring(0, 100) || '',
    hook_type: hookScene?.visual_prompt?.includes('HOOK') ? 'explicit' : 'first_scene',
  };
}
