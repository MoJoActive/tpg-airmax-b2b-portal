type B2BLoggerType = Pick<Console, 'error' | 'warn'>;

const b2bLogger: B2BLoggerType = {
  error: console.error,
  warn: console.warn,
};

export default b2bLogger;
