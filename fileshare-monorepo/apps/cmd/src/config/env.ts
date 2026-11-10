import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

import { getBaseDir } from '../core/paths.js';

/**
 * 环境变量加载与校验。
 * 开发时以 apps/cmd 为工作目录；打包后以 exe 所在目录为基准。
 */
const baseDir = getBaseDir();
const baseEnvFile = resolve(baseDir, '.env');
const localEnvFile = resolve(baseDir, '.env.local');

if (existsSync(baseEnvFile)) {
  loadEnv({ path: baseEnvFile, quiet: true });
}
if (existsSync(localEnvFile)) {
  loadEnv({ path: localEnvFile, override: true, quiet: true });
}

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PROJECT_NAME: z.string().default('FileShare'),
  VERSION: z.string().default('1.2.0'),
  API_V1_PREFIX: z
    .string()
    .regex(/^\/[^\s]*$/, 'API_V1_PREFIX 必须以 / 开头')
    .default('/api/v1'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),

  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(DEFAULT_MAX_FILE_SIZE),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('；');
  // 环境变量错误属于启动期致命错误，直接退出避免带病运行
  console.error(`环境变量校验失败：${detail}`);
  process.exit(1);
}

export const env = parsed.data;
