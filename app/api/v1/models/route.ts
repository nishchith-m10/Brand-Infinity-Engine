import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/models
 * 
 * Fetches available models from configured providers
 * Query params:
 *  - provider: Provider name (openrouter, anthropic, openai, etc)
 *  - apiKey: The API key to use for fetching
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const apiKey = searchParams.get('apiKey');

    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing provider or apiKey parameter' },
        { status: 400 }
      );
    }

    // Fetch models based on provider
    switch (provider.toLowerCase()) {
      case 'openrouter':
        return await fetchOpenRouterModels(apiKey);
      
      case 'anthropic':
        return NextResponse.json({
          success: true,
          models: [
            { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'anthropic' },
            { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
            { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'anthropic' },
          ]
        });
      
      case 'openai':
        return NextResponse.json({
          success: true,
          models: [
            { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'openai' },
            { id: 'gpt-5.2-thinking', name: 'GPT-5.2 Thinking', provider: 'openai' },
            { id: 'gpt-5.2-instant', name: 'GPT-5.2 Instant', provider: 'openai' },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
          ]
        });
      
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[API] Models fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

async function fetchOpenRouterModels(apiKey: string) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://brand-infinity.com',
        'X-Title': 'Brand Infinity Engine',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform OpenRouter response to our format
    const models = data.data?.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
      provider: 'openrouter',
      pricing: model.pricing,
      context_length: model.context_length,
    })) || [];

    return NextResponse.json({
      success: true,
      models,
    });
  } catch (error: any) {
    console.error('[OpenRouter] Fetch models error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch OpenRouter models' },
      { status: 500 }
    );
  }
}
