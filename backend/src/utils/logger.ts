import { pino, transport as buildTransport, type LoggerOptions } from 'pino';
import { config } from '@/config/index.js';

const options: LoggerOptions = {
  level: config.logLevel,
  base: { service: 'multicoder-backend' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
    remove: true,
  },
};

const transport = config.isDevelopment
  ? buildTransport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    })
  : undefined;

export const logger = transport ? pino(options, transport) : pino(options);
