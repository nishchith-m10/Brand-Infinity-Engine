/**
 * Production Logging & Monitoring
 * Slice 9: Production Hardening
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  userId?: string;
  sessionId?: string;
}

interface SentryWindow extends Window {
  Sentry?: {
    captureMessage: (message: string, options?: { level?: string; extra?: unknown }) => void;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  /**
   * Log with context and metadata
   */
  private log(level: LogLevel, context: string, message: string, data?: unknown): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    };

    // Console logging
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${context}]`;

    if (this.isDevelopment) {
      consoleMethod(prefix, message, data || '');
    } else {
      // In production, structured logging
      consoleMethod(JSON.stringify(entry));
    }

    // Send to external monitoring (Sentry, DataDog, etc.)
    if (!this.isDevelopment && level === 'error') {
      this.sendToMonitoring(entry);
    }
  }

  debug(context: string, message: string, data?: unknown): void {
    if (this.isDevelopment) {
      this.log('debug', context, message, data);
    }
  }

  info(context: string, message: string, data?: unknown): void {
    this.log('info', context, message, data);
  }

  warn(context: string, message: string, data?: unknown): void {
    this.log('warn', context, message, data);
  }

  error(context: string, message: string, error?: unknown): void {
    this.log('error', context, message, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
    });
  }

  /**
   * Send to external monitoring service
   */
  private sendToMonitoring(entry: LogEntry): void {
    // In production, integrate with Sentry, DataDog, or similar
    if (typeof window !== 'undefined') {
      const sw = window as unknown as SentryWindow;
      if (sw.Sentry) {
        sw.Sentry.captureMessage(entry.message, {
          level: entry.level,
          extra: entry.data,
        });
      }
    }
  }

  /**
   * Track performance metrics
   */
  trackPerformance(
    context: string,
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    this.info(context, `Performance: ${operation}`, {
      duration_ms: duration,
      ...metadata,
    });

    // Send to analytics
    if (!this.isDevelopment) {
      // Integrate with analytics service
      console.log('METRIC', {
        context,
        operation,
        duration,
        ...metadata,
      });
    }
  }

  /**
   * Track LLM usage
   */
  trackLLMUsage(params: {
    model: string;
    provider: string;
    tokensUsed: { input: number; output: number };
    cost: number;
    latency: number;
    success: boolean;
  }): void {
    this.info('LLM', 'API call completed', params);
  }

  /**
   * Track agent actions
   */
  trackAgentAction(params: {
    agent: string;
    action: string;
    sessionId: string;
    success: boolean;
    duration: number;
    error?: string;
  }): void {
    const level = params.success ? 'info' : 'error';
    this.log(level, `Agent:${params.agent}`, params.action, params);
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Performance tracking decorator
 */
export function trackPerformance(context: string, operation: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        logger.trackPerformance(context, operation, duration, { success: true });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.trackPerformance(context, operation, duration, { success: false });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Async operation wrapper with logging
 */
export async function withLogging<T>(
  context: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  logger.debug(context, `Starting: ${operation}`);

  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.trackPerformance(context, operation, duration, { success: true });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(context, `Failed: ${operation}`, error);
    logger.trackPerformance(context, operation, duration, { success: false });
    throw error;
  }
}

