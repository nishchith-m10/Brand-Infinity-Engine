import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance
  tracesSampleRate: 1.0,
  
  // Release tracking  
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
  environment: process.env.NODE_ENV,
  
  beforeSend(event) {
    if (process.env.NODE_ENV === 'development') {
      return null;
    }
    return event;
  },
});
