const stamp = () => new Date().toISOString();

const write = (level, stream, args) => {
  stream(`[${stamp()}] [${level}]`, ...args);
};

export const logger = {
  info: (...args) => write('info', console.log, args),
  warn: (...args) => write('warn', console.warn, args),
  error: (...args) => write('error', console.error, args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') write('debug', console.log, args);
  },
};
