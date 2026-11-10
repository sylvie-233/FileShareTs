import { defineConfig } from 'tsdown';

/**
 * 单文件 exe 构建配置。
 * 使用 tsdown 的 `exe` 能力（底层为 Node.js SEA），静态资源随 exe 一起内嵌。
 *
 * 注意：`exe` 选项要求构建机 Node.js >= 25.7.0。
 * 常规 `pnpm build` 不包含 exe，因此日常开发不强制该版本。
 */
export default defineConfig({
  entry: ['src/main.ts'],
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  deps: {
    // exe 必须是自包含的单文件，所有运行时依赖都打进 bundle
    alwaysBundle: [/.*/],
    onlyBundle: false,
  },
  clean: true,
  dts: false,
  sourcemap: false,
  target: 'node22',
  exe: {
    fileName: 'FileShare',
    outDir: 'dist',
    seaConfig: {
      assets: {
        'static/index.html': 'static/index.html',
        'static/qrcode.js': 'static/qrcode.js',
        'static/favicon.ico': 'static/favicon.ico',
      },
    },
  },
});
