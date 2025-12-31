import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions
  
  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
  environment: process.env.NODE_ENV,
  
  // Server-specific settings

  
  // Profile server performance
  profilesSampleRate: 0.1, // 10% of transactions
  
  // Ignore common server errors
  ignoreErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
  ],
  
  beforeSend(event) {
    // Filter out development noise
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
