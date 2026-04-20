type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

interface LogMeta {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
  const parts = [formatTimestamp(), level.toUpperCase().padEnd(5), message];
  
  if (meta?.requestId) {
    parts.push(`req=${meta.requestId}`);
  }
  if (meta?.userId) {
    parts.push(`user=${meta.userId}`);
  }
  
  const extra = Object.entries(meta ?? {})
    .filter(([k]) => k !== 'requestId' && k !== 'userId')
    .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`);
  
  if (extra.length > 0) {
    parts.push(extra.join(' '));
  }
  
  return parts.join(' ');
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => {
    if (shouldLog('debug')) console.debug(formatMessage('debug', message, meta));
  },
  
  info: (message: string, meta?: LogMeta) => {
    if (shouldLog('info')) console.info(formatMessage('info', message, meta));
  },
  
  warn: (message: string, meta?: LogMeta) => {
    if (shouldLog('warn')) console.warn(formatMessage('warn', message, meta));
  },
  
  error: (message: string, error?: unknown, meta?: LogMeta) => {
    if (!shouldLog('error')) return;
    
    const errorMeta: LogMeta = { ...meta };
    if (error instanceof Error) {
      errorMeta.errorName = error.name;
      errorMeta.errorMessage = error.message;
      if (process.env.NODE_ENV !== 'production') {
        errorMeta.stack = error.stack;
      }
    } else if (error !== undefined) {
      errorMeta.error = String(error);
    }
    
    console.error(formatMessage('error', message, errorMeta));
  },
};
