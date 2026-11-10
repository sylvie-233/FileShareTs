import base from '@fileshare/eslint-config/base';

export default [
  ...base,
  {
    // static/ 下是原样拷贝的前端资源（含压缩后的 qrcode.js），不参与 lint
    ignores: ['static/**', 'uploads/**', 'logs/**'],
  },
];
