// Standardized logger utility for Stremio Insights

const PREFIX = "[Stremio Insights]";

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`${PREFIX} ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`${PREFIX} ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`${PREFIX} ${message}`, ...args);
  }
};
