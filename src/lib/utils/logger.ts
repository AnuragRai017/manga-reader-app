const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function formatMessage(level: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  const dataString = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp} [${level}] ${message}${dataString}`;
}

export const logger = {
  info(message: string, data?: any) {
    console.log(colors.blue + formatMessage('INFO', message, data) + colors.reset);
  },

  success(message: string, data?: any) {
    console.log(colors.green + formatMessage('SUCCESS', message, data) + colors.reset);
  },

  warn(message: string, data?: any) {
    console.log(colors.yellow + formatMessage('WARN', message, data) + colors.reset);
  },

  error(message: string, error?: any) {
    console.error(colors.red + formatMessage('ERROR', message, {
      message: error?.message,
      stack: error?.stack,
      ...error
    }) + colors.reset);
  },

  debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(colors.gray + formatMessage('DEBUG', message, data) + colors.reset);
    }
  }
}; 