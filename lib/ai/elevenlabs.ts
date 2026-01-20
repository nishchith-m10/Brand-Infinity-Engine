/**
 * ElevenLabs TTS Adapter
 * Phase 10: Voice/TTS Integration
 * 
 * Provides text-to-speech synthesis using ElevenLabs API.
 * https://docs.elevenlabs.io/
 */

import { getEffectiveProviderKey } from '@/lib/providers/get-user-key';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Map our voice names to ElevenLabs voice IDs
// These are stock ElevenLabs voices - users can customize via Settings
const VOICE_MAP = {
  'calm': {
    id: '21m00Tcm4TlvDq8ikWAM',  // Rachel - calm, narrator
    name: 'Rachel',
    description: 'Calm, soothing narrator voice'
  },
  'energetic': {
    id: 'AZnzlk1XvdvUeBnXmlld',  // Domi - young, energetic
    name: 'Domi',
    description: 'Young, energetic voice'
  },
  'professional': {
    id: 'pNInz6obpgDQGcFmaJgB',  // Adam - professional male
    name: 'Adam',
    description: 'Professional, confident voice'
  },
} as const;

export type ElevenLabsVoice = keyof typeof VOICE_MAP;

// Available models
const ELEVENLABS_MODELS = {
  'eleven_multilingual_v2': {
    name: 'Multilingual v2',
    description: 'Best quality, 29 languages',
    costPer1kChars: 0.30,  // ~$0.30 per 1k characters
  },
  'eleven_turbo_v2_5': {
    name: 'Turbo v2.5',
    description: 'Fastest, English optimized',
    costPer1kChars: 0.15,
  },
  'eleven_flash_v2_5': {
    name: 'Flash v2.5',
    description: 'Ultra-fast, lowest latency',
    costPer1kChars: 0.08,
  },
} as const;

export type ElevenLabsModel = keyof typeof ELEVENLABS_MODELS;

export interface ElevenLabsTTSParams {
  text: string;
  voice?: ElevenLabsVoice | string;  // Can be voice name or direct voice ID
  modelId?: ElevenLabsModel;
  stability?: number;        // 0-1, default 0.5
  similarityBoost?: number;  // 0-1, default 0.75
  style?: number;            // 0-1, default 0
  speakerBoost?: boolean;    // Default true
}

export interface ElevenLabsTTSResult {
  audioBuffer: ArrayBuffer;
  audioBase64: string;
  contentType: string;
  characterCount: number;
  estimatedCost: number;
  voice: string;
  model: string;
}

export class ElevenLabsAdapter {
  private apiKey: string | null;
  private apiKeyPromise: Promise<string | null>;
  private userId?: string;

  constructor(apiKey?: string, userId?: string) {
    this.userId = userId;
    
    if (apiKey) {
      this.apiKey = apiKey;
      this.apiKeyPromise = Promise.resolve(apiKey);
    } else {
      this.apiKey = null;
      this.apiKeyPromise = getEffectiveProviderKey('elevenlabs', process.env.ELEVENLABS_API_KEY, userId);
    }
  }

  private async ensureApiKey(): Promise<string> {
    if (!this.apiKey) {
      this.apiKey = await this.apiKeyPromise;
    }
    if (!this.apiKey) {
      throw new Error(
        'ElevenLabs API key not configured. Please add your ElevenLabs key in Settings or set ELEVENLABS_API_KEY environment variable.'
      );
    }
    return this.apiKey;
  }

  /**
   * Generate speech from text
   */
  async generateSpeech(params: ElevenLabsTTSParams): Promise<ElevenLabsTTSResult> {
    const apiKey = await this.ensureApiKey();
    
    // Resolve voice ID
    const voiceId = this.resolveVoiceId(params.voice || 'calm');
    const modelId = params.modelId || 'eleven_multilingual_v2';
    
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: params.text,
          model_id: modelId,
          voice_settings: {
            stability: params.stability ?? 0.5,
            similarity_boost: params.similarityBoost ?? 0.75,
            style: params.style ?? 0,
            use_speaker_boost: params.speakerBoost ?? true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `ElevenLabs API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.detail?.message || errorJson.detail || errorMessage;
      } catch {
        errorMessage = `${errorMessage} - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    // Response is audio binary
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');
    
    // Calculate cost estimate
    const characterCount = params.text.length;
    const modelInfo = ELEVENLABS_MODELS[modelId];
    const estimatedCost = modelInfo 
      ? (characterCount / 1000) * modelInfo.costPer1kChars 
      : 0;

    return {
      audioBuffer,
      audioBase64,
      contentType: 'audio/mpeg',
      characterCount,
      estimatedCost,
      voice: voiceId,
      model: modelId,
    };
  }

  /**
   * Generate speech and return as data URL for easy embedding
   */
  async generateSpeechDataUrl(params: ElevenLabsTTSParams): Promise<string> {
    const result = await this.generateSpeech(params);
    return `data:${result.contentType};base64,${result.audioBase64}`;
  }

  /**
   * List available voices from the API
   */
  async listVoices(): Promise<{ voices: Array<{ voice_id: string; name: string; category: string }> }> {
    const apiKey = await this.ensureApiKey();
    
    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get user's subscription info (quota, etc.)
   */
  async getSubscription(): Promise<{ character_count: number; character_limit: number }> {
    const apiKey = await this.ensureApiKey();
    
    const response = await fetch(`${ELEVENLABS_BASE_URL}/user/subscription`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Resolve voice name to voice ID
   */
  private resolveVoiceId(voice: string): string {
    // Check if it's a predefined voice name
    const predefinedVoice = VOICE_MAP[voice as ElevenLabsVoice];
    if (predefinedVoice) {
      return predefinedVoice.id;
    }
    
    // Otherwise, assume it's a direct voice ID
    return voice;
  }

  /**
   * Check if configured (sync check for UI)
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Get predefined voices
   */
  static getAvailableVoices(): typeof VOICE_MAP {
    return VOICE_MAP;
  }

  /**
   * Get available models
   */
  static getAvailableModels(): typeof ELEVENLABS_MODELS {
    return ELEVENLABS_MODELS;
  }

  /**
   * Estimate cost for a given text
   */
  static estimateCost(text: string, model: ElevenLabsModel = 'eleven_multilingual_v2'): number {
    const modelInfo = ELEVENLABS_MODELS[model];
    if (!modelInfo) return 0;
    return (text.length / 1000) * modelInfo.costPer1kChars;
  }
}

/**
 * Factory function to create ElevenLabs adapter
 */
export function createElevenLabsAdapter(apiKey?: string, userId?: string): ElevenLabsAdapter {
  return new ElevenLabsAdapter(apiKey, userId);
}

/**
 * Convenience function for simple TTS generation
 */
export async function generateSpeechElevenLabs(
  text: string,
  voice: ElevenLabsVoice = 'calm',
  userId?: string
): Promise<ElevenLabsTTSResult> {
  const adapter = createElevenLabsAdapter(undefined, userId);
  return adapter.generateSpeech({ text, voice });
}

/**
 * Check if ElevenLabs is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}
