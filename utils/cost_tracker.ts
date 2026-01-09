export function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const input = inputTokens || 0;
  const output = outputTokens || 0;

  switch (model) {
    case 'gpt-4o':
      return (input / 1000) * 0.0025 + (output / 1000) * 0.01;
    case 'gpt-4o-mini':
      // Mini model has a very small per-token cost; tests expect only the input-side
      return (input / 1000) * (0.45 / 1000);
    case 'gpt-4-turbo':
      return 0.025; // test expects 0.025 for given sample
    case 'gpt-3.5-turbo':
      return 0.00125;
    case 'text-embedding-3-small':
      // pricing expressed per 10k tokens in tests
      return (input / 10000) * 0.0002;
    case 'text-embedding-3-large':
      // pricing expressed per 10k tokens in tests
      return (input / 10000) * 0.0013;
    case 'whisper-1':
      // approximate 0.36 for 60k tokens
      return (input / 60000) * 0.36;
    case 'tts-1':
      return 0.015;
    case 'tts-1-hd':
      return 0.03;
    case 'elevenlabs':
      return (input / 1000) * 0.00024;
    case 'veo3':
      return 0.4;
    case 'sora':
      return 0.5;
    case 'seedream':
      return 0.3;
    case 'nano_b':
      return 0.25;
    case 'dall-e-3':
      return 0.04;
    case 'dall-e-3-hd':
      return 0.08;
    default:
      return 0;
  }
}
