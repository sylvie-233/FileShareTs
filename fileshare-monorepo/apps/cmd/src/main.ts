import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { getLogger, initLogger } from './core/logger.js';
import { isPackaged, resolveFromBase } from './core/paths.js';
import { initFileService } from './services/file.service.js';

async function bootstrap(): Promise<void> {
  initLogger(resolveFromBase('logs'), env.NODE_ENV === 'development' ? 'debug' : 'info');
  const logger = getLogger('main');

  await initFileService(resolveFromBase(env.UPLOAD_DIR));

  logger.info(
    `启动 ${env.PROJECT_NAME} v${env.VERSION}${isPackaged() ? '（单文件可执行程序）' : ''}`,
  );

  const app = createApp();

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
      hostname: env.HOST,
    },
    (info) => {
      logger.info(`服务已启动：http://${info.address}:${info.port}`);
      logger.info(`局域网访问：http://<本机IP>:${info.port}`);
      logger.info(`上传目录：${resolveFromBase(env.UPLOAD_DIR)}`);
    },
  );

  let closing = false;
  const shutdown = (signal: string): void => {
    if (closing) {
      return;
    }
    closing = true;
    logger.info(`收到 ${signal}，正在关闭服务...`);

    server.close((error) => {
      if (error) {
        logger.error({ err: error }, '关闭服务失败');
        process.exit(1);
      }
      process.exit(0);
    });

    // 兜底：10 秒内仍未关闭则强制退出
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  console.error('[cmd] 启动失败：', error);
  process.exit(1);
});
