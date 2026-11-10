import { dirname, isAbsolute, join } from 'node:path';

import { getSea } from './sea.js';

/** 是否运行在 Node SEA 打包出的单文件可执行程序中。 */
export function isPackaged(): boolean {
  return getSea()?.isSea() ?? false;
}

/**
 * 运行基准目录：
 * - 打包后：exe 所在目录（配置文件、uploads、logs 都放在这里）
 * - 开发时：进程工作目录（由 pnpm/turbo 定位到 apps/cmd）
 */
export function getBaseDir(): string {
  return isPackaged() ? dirname(process.execPath) : process.cwd();
}

/** 把配置中的相对路径解析到运行基准目录。 */
export function resolveFromBase(target: string): string {
  return isAbsolute(target) ? target : join(getBaseDir(), target);
}
