import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import pino from 'pino';
import type { LevelWithSilent, Logger as PinoLogger } from 'pino';
import pretty from 'pino-pretty';

export type LogLevel = LevelWithSilent;

/** 控制台与日志文件的统一时间格式。 */
const TIME_FORMAT = 'SYS:yyyy-mm-dd HH:MM:ss.l';

let root: PinoLogger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
});

/** 子 logger 缓存，initLogger 重建 root 后清空。 */
let cachedRoot = root;
const children = new Map<string, PinoLogger>();

function child(name: string): PinoLogger {
  if (cachedRoot !== root) {
    children.clear();
    cachedRoot = root;
  }

  let logger = children.get(name);
  if (!logger) {
    logger = root.child({ name });
    children.set(name, logger);
  }
  return logger;
}

/**
 * 初始化日志：控制台彩色输出 + 追加写入 logs/app.log。
 * 未调用时默认输出到控制台，保证模块加载阶段也能打日志。
 */
export function initLogger(logDir: string, level: LogLevel = 'info'): void {
  mkdirSync(logDir, { recursive: true });

  const fileDestination = pino.destination({
    dest: join(logDir, 'app.log'),
    sync: true,
    mkdir: true,
  });

  root = pino(
    { level },
    pino.multistream([
      {
        level,
        stream: pretty({
          colorize: process.stdout.isTTY === true,
          translateTime: TIME_FORMAT,
          ignore: 'pid,hostname',
          // 必须指向 process.stdout 而不是默认的 fd 1：
          // pino-pretty 默认用 sonic-boom 直接向 fd 1 写 UTF-8 字节，
          // Windows 控制台会按当前代码页（如 GBK）解码，导致中文乱码；
          // 走 process.stdout 时 Node 会用 WriteConsoleW 正确输出 Unicode。
          destination: process.stdout,
        }),
      },
      {
        level,
        stream: pretty({
          colorize: false,
          translateTime: TIME_FORMAT,
          ignore: 'pid,hostname',
          destination: fileDestination,
        }),
      },
    ]),
  );
}

/** pino 调用签名：单条消息，或「绑定字段 + 消息」。 */
type LogMethod = {
  (message: string, ...args: unknown[]): void;
  (obj: object, message?: string, ...args: unknown[]): void;
};

export interface Logger {
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
}

/**
 * 获取指定名称的日志记录器。
 * 返回的是惰性代理：initLogger 之前创建的实例也会自动切换到新配置。
 */
export function getLogger(name = 'app'): Logger {
  const emit = (level: 'debug' | 'info' | 'warn' | 'error' | 'fatal', args: unknown[]): void => {
    const logger = child(name);
    const method = (logger as unknown as Record<string, (...a: unknown[]) => void>)[level];
    method?.apply(logger, args);
  };

  return {
    debug: (...args) => emit('debug', args),
    info: (...args) => emit('info', args),
    warn: (...args) => emit('warn', args),
    error: (...args) => emit('error', args),
    fatal: (...args) => emit('fatal', args),
  };
}
