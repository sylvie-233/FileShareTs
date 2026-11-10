import { createRequire } from 'node:module';

import type * as SeaNamespace from 'node:sea';

/**
 * 惰性加载 node:sea。
 *
 * - 打包后的 CJS bundle 中 require 可用，能拿到 node:sea；
 * - 开发（tsx/ESM）与 Vitest 中加载失败，直接视为非 SEA 环境，
 *   同时避免 Vite 尝试解析 node:sea 导致测试加载失败。
 */
export type SeaModule = typeof SeaNamespace;

const nodeRequire = createRequire(import.meta.url);

let cached: SeaModule | null | undefined;

export function getSea(): SeaModule | null {
  if (cached !== undefined) {
    return cached;
  }

  cached = null;
  try {
    cached = nodeRequire('node:sea') as SeaModule;
  } catch {
    cached = null;
  }
  return cached;
}
