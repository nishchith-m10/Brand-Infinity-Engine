// Sentry edge config temporarily disabled due to Vercel Edge runtime compatibility issues
// The Sentry SDK causes __dirname errors when bundled with middleware
// TODO: Re-enable when Sentry provides edge-compatible version or we find workaround

// import * as Sentry from '@sentry/nextjs';
//
// // Only initialize if DSN is provided
// const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
//
// if (dsn) {
//   Sentry.init({
//     dsn,
//     
//     // Performance
//     tracesSampleRate: 1.0,
//     
//     // Release tracking  
//     release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
//     environment: process.env.NODE_ENV,
//     
//     beforeSend(event) {
//       if (process.env.NODE_ENV === 'development') {
//         return null;
//       }
//       return event;
//     },
//   });
// }
