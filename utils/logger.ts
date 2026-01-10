// Simple structured logger for tests
const DEFAULT_SERVICE_NAME = 'brand-infinity';

export type LogMethod = (...args: any[]) => void;

export const logger = {
  level: (process.env.LOG_LEVEL as string) || 'info',
  defaultMeta: { service: DEFAULT_SERVICE_NAME },
  info: (...args: any[]) => console.info('[info]', ...args),
  warn: (...args: any[]) => console.warn('[warn]', ...args),
  error: (...args: any[]) => console.error('[error]', ...args),
  debug: (...args: any[]) => console.debug('[debug]', ...args),
};

export function createChildLogger(meta: Record<string, unknown>) {
  const child = {
    level: logger.level,
    defaultMeta: { ...logger.defaultMeta, ...meta },
    info: (...args: any[]) => logger.info(...args),
    warn: (...args: any[]) => logger.warn(...args),
    error: (...args: any[]) => logger.error(...args),
    debug: (...args: any[]) => logger.debug(...args),
  };
  return child;
}

export function createJobLogger(component: string, jobId?: string) {
  return createChildLogger({ component, jobId });
}

// Express-style middleware (req, res, next)
export function requestLogger(req: any, res: any, next: () => void) {
  // Call next immediately
  next();

  // After response finishes, log details
  res.on('finish', () => {
    logger.info('Request finished', { method: req.method, url: req.url, status: res.statusCode });
  });
}

// Named exports for convenience
export const info: LogMethod = (...args: any[]) => logger.info(...args);
export const warn: LogMethod = (...args: any[]) => logger.warn(...args);
export const error: LogMethod = (...args: any[]) => logger.error(...args);
export const debug: LogMethod = (...args: any[]) => logger.debug(...args);

export default logger;
