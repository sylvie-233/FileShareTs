# 📁 FileShareTs

一个基于 **Hono + TypeScript** 的局域网文件共享服务，支持拖拽上传、文件管理、移动端适配，并可打包为单文件 Windows 可执行程序（`.exe`）。

> 由原 Python / FastAPI 版本重构而来，API 路径与响应结构保持兼容，前端页面无需修改。
> 代码位于 [fileshare-monorepo/](fileshare-monorepo/)，根目录提供 [manage.ps1](manage.ps1) 运维脚本。

## ✨ 功能特性

- 📤 **拖拽上传** - 支持拖拽文件到指定区域上传
- 📱 **移动端适配** - 响应式设计，适配手机和平板
- 🔗 **分享链接** - 一键复制分享链接
- 📱 **二维码分享** - 鼠标悬浮显示二维码，手机扫码访问
- 📂 **文件管理** - 上传、下载、删除文件
- 🗑️ **一键清空** - 快速清空所有上传的文件
- 🔔 **实时通知** - 操作成功 / 失败的即时反馈
- 🚀 **单文件 exe** - 通过 tsdown `exe` 配置打包（Node.js SEA），静态资源内嵌，开箱即用
- 📜 **OpenAPI 文档** - 基于 `@hono/zod-openapi` 自动生成，内置 Scalar 在线文档
- 📝 **结构化日志** - pino 输出到控制台与 `logs/app.log`
- 🔤 **中文文件名** - multipart 文件名按 UTF-8 解析，下载时生成 RFC 5987 响应头

## 🛠️ 技术栈

| 类别           | 选择                                                     |
| -------------- | -------------------------------------------------------- |
| 运行时         | Node.js ≥ 22.12（开发/运行）；打包 exe 需 Node.js ≥ 25.7 |
| 语言           | TypeScript 5.7                                           |
| Web 框架       | Hono 4                                                   |
| Node 适配      | @hono/node-server                                        |
| 参数校验 / API | Zod 4 + @hono/zod-openapi                                |
| API 文档       | Scalar（挂载于 `/api/docs`）                             |
| 上传解析       | busboy（流式写盘，不占内存）                             |
| 日志           | pino + pino-pretty                                       |
| 构建           | tsdown（rolldown）                                       |
| 单文件打包     | tsdown `exe`（Node.js SEA）                              |
| 包管理         | pnpm workspace + Turborepo                               |
| 测试           | Vitest                                                   |

## 📁 项目结构

```
FileShareTs/
├── LICENSE
├── README.md
├── manage.ps1                      # 本地运维脚本
├── .gitignore
└── fileshare-monorepo/
    ├── apps/
    │   └── cmd/                    # 服务端可执行程序
    │       ├── src/
    │       │   ├── main.ts         # 启动入口（HTTP 服务 / 优雅退出）
    │       │   ├── app.ts          # Hono 应用组装（CORS / 静态资源 / 错误处理）
    │       │   ├── config/env.ts   # 环境变量加载与校验
    │       │   ├── core/
    │       │   │   ├── paths.ts    # exe / 开发环境路径解析
    │       │   │   ├── sea.ts      # 惰性加载 node:sea（兼容测试与开发）
    │       │   │   ├── logger.ts   # pino 控制台 + 文件日志
    │       │   │   └── static.ts   # 静态资源（开发读磁盘 / SEA 读内嵌资源）
    │       │   ├── controllers/
    │       │   │   └── file.controller.ts  # 文件接口处理逻辑
    │       │   ├── services/
    │       │   │   └── file.service.ts     # 文件读写、列表、删除
    │       │   ├── routes/
    │       │   │   ├── index.ts    # /api 路由、OpenAPI JSON 与文档
    │       │   │   └── files.ts    # 文件相关路由定义
    │       │   ├── openapi/
    │       │   │   ├── models.ts   # 响应模型
    │       │   │   └── router.ts   # OpenAPIHono 工厂与 handler 包装
    │       │   ├── middleware/error.ts
    │       │   └── utils/
    │       ├── static/             # index.html / qrcode.js / favicon.ico
    │       ├── test/               # Vitest 测试
    │       ├── tsdown.config.ts    # 普通 bundle 构建
    │       ├── tsdown.exe.config.ts# 单文件 exe 构建（内嵌静态资源）
    │       └── .env.example
    ├── packages/
    │   ├── tsconfig/               # 共享 TypeScript 配置
    │   ├── eslint-config/          # 共享 ESLint 平面配置
    │   ├── types/                  # 共享类型（文件 API 模型）
    │   └── utils/                  # 可复用纯函数（分页、日期、UA、CSV、SQL）
    ├── package.json
    ├── pnpm-workspace.yaml
    └── turbo.json
```

## 📦 安装

```bash
cd fileshare-monorepo
pnpm install
cp apps/cmd/.env.example apps/cmd/.env
```

也可以直接在根目录执行 `pwsh ./manage.ps1 install`（会自动安装依赖并在缺失时创建 `.env`）。

要求：

- Node.js ≥ 22.12（开发与运行）；**打包 exe 需要 Node.js ≥ 25.7**（tsdown 使用 Node 原生 `--build-sea`）
- pnpm ≥ 9（仓库使用 pnpm 10.32.1）

## 🚀 开发与运行

```bash
cd fileshare-monorepo

# 开发模式（tsx watch）
pnpm dev

# 所有包构建
pnpm build

# 运行构建产物
cd apps/cmd && node dist/main.cjs
```

服务默认监听 `http://0.0.0.0:8000`：

- 本地访问：`http://localhost:8000`
- 局域网访问：`http://你的IP:8000`
- API 文档：`http://localhost:8000/api/docs`

## 🧰 运维脚本

根目录的 [manage.ps1](manage.ps1) 封装了常用操作（需要 PowerShell 7+）：

```powershell
pwsh ./manage.ps1 install      # 安装依赖（缺失时创建 apps/cmd/.env）
pwsh ./manage.ps1 dev          # 开发模式
pwsh ./manage.ps1 exe          # 打包单文件 exe
pwsh ./manage.ps1 start        # 后台启动 exe 并等待健康检查
pwsh ./manage.ps1 status       # 进程 / 健康检查 / 上传目录 / 日志
pwsh ./manage.ps1 logs -Follow # 跟踪 logs/app.log
pwsh ./manage.ps1 stop         # 停止服务
pwsh ./manage.ps1 restart      # 重启服务
pwsh ./manage.ps1 reset        # 清空已上传文件（需输入 YES 确认）
pwsh ./manage.ps1 clean        # 清理构建产物
pwsh ./manage.ps1 test         # 运行测试
pwsh ./manage.ps1 lint         # ESLint
pwsh ./manage.ps1 typecheck    # 类型检查
pwsh ./manage.ps1 format       # Prettier
```

不带参数执行 `pwsh ./manage.ps1` 等同于 `status`。完整参数说明见脚本头部注释。

## 📦 打包单文件 exe

```bash
cd fileshare-monorepo
pnpm exe
# 或：pwsh ./manage.ps1 exe
```

该命令会先构建所有 workspace 包，再由 `apps/cmd/tsdown.exe.config.ts` 输出单文件：

1. 用 tsdown 将所有运行时依赖打包为 `apps/cmd/dist/main.cjs`
2. 通过 tsdown 的 `exe` 配置调用 Node.js SEA，把 `static/` 作为资源内嵌
3. 生成 `apps/cmd/dist/FileShare.exe`（约 100MB，内含 Node 运行时）

运行 exe 时：

- `uploads/`、`logs/` 会在 exe 同目录自动创建
- `.env` 放在 exe 同目录即可覆盖默认配置
- 静态页面已内嵌，无需附带 `static` 目录

> exe 构建要求 Node.js ≥ 25.7；tsdown 会自动处理 SEA 所需的签名移除与注入步骤，无需 `postject` 或 `signtool`。

## 🔌 API

所有接口位于 `/api/v1`，响应结构与原 FastAPI 版本一致。

| 方法   | 路径                          | 说明                                           |
| ------ | ----------------------------- | ---------------------------------------------- |
| GET    | `/api/v1/server-info`         | 获取本机局域网访问地址                         |
| POST   | `/api/v1/upload`              | 上传文件（multipart/form-data，字段名 `file`） |
| GET    | `/api/v1/files`               | 文件列表                                       |
| GET    | `/api/v1/download/{filename}` | 下载文件                                       |
| DELETE | `/api/v1/files/{filename}`    | 删除单个文件                                   |
| DELETE | `/api/v1/files`               | 清空全部文件                                   |

错误响应保持 `{ "detail": "错误信息" }` 格式。

接口文档：

- `/api/docs` - Scalar 在线文档
- `/api/openapi.json` - OpenAPI 3.1 描述文件
- `/health` - 健康检查（返回 `{ "status": "ok" }`）

运行日志由 pino 同时写入控制台与 `logs/app.log`；控制台在终端中带颜色，文件为纯文本。

## ⚙️ 配置

在 `fileshare-monorepo/apps/cmd/.env` 中配置（打包后放在 exe 同目录的 `.env`）：

```env
PROJECT_NAME=FileShare
VERSION=1.2.0
API_V1_PREFIX=/api/v1

HOST=0.0.0.0
PORT=8000
NODE_ENV=development

UPLOAD_DIR=uploads
MAX_FILE_SIZE=104857600
```

- `UPLOAD_DIR` 为相对路径时，以程序所在目录为基准
- `MAX_FILE_SIZE` 默认 100MB，上传超过限制返回 413

## 🧪 测试与质量检查

```bash
cd fileshare-monorepo
pnpm test
pnpm lint
pnpm typecheck
pnpm format
```

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。

## 🙏 致谢

- [Hono](https://hono.dev/) - 轻量高性能 Web 框架
- [tsdown](https://tsdown.dev/) - 基于 rolldown 的打包工具
- [Node.js SEA](https://nodejs.org/api/single-executable-applications.html) - 单文件可执行程序
