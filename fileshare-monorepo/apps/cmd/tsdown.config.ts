import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  // 运行时依赖全部打进 CJS bundle，便于直接拷贝 dist 部署
  deps: {
    alwaysBundle: [/.*/],
    onlyBundle: false,
  },
  clean: true,
  dts: false,
  sourcemap: false,
  target: 'node22',
});
