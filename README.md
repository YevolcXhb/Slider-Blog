# Slider 博客

一个基于 Next.js 16（App Router）+ MariaDB 的现代化个人博客系统，支持中英双语、后台内容管理、音乐/图库/动态等丰富功能。

## 技术栈

- **框架**：Next.js 16（App Router + Server Actions + Turbopack）
- **数据库**：MariaDB / MySQL（Prisma 7 + `@prisma/adapter-mariadb`）
- **样式**：Tailwind CSS 4 + 玻璃拟态 UI
- **国际化**：next-intl（zh / en）
- **鉴权**：NextAuth v5（Credentials）
- **其他**：Sentry 错误监控、MDX/Katex/Mermaid 渲染、sharp 图片优化

## 功能特性

- 文章系统：MDX 渲染、目录、标签、分类、搜索、阅读进度、推荐阅读
- 评论区：树形回复、防重复提交限流
- 内容管理后台：文章、分类、标签、评论、动态、图库、音乐、公告、用户、站点设置
- 音乐播放器：全局播放、进度记忆、播放模式持久化
- 初始化向导：首次搭建通过网页配置数据库、创建管理员并配置站点
- 端口隔离：前台（4000）与管理端（4100）分离，管理路径仅后台入口可达

## 快速开始

环境要求：Node.js ≥ 20.9（推荐 22 LTS）、npm 10+、MariaDB 10.6+ / MySQL 8.0+

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（参照 .env.example，务必设置 NEXTAUTH_SECRET、ADMIN_PROXY_SECRET）
cp .env.example .env

# 3. 初始化数据库（应用 prisma/migrations 下的迁移）
npx prisma migrate deploy

# 4. 启动前台（4000）
npm run dev

# 5. 另开终端：管理端入口（4100）
npm run dev:admin
```

首次访问 `http://localhost:4100` 进入初始化向导：先填写数据库连接信息（地址/端口/库名/用户名/密码），服务端验证连接后写入容器内的 `/data/config.env` 并自动重启，随后创建管理员并配置站点。完整的部署与排错说明见 [部署指南](DEPLOY.md)。

### 会话 cookie 与 HTTPS（重要）

NextAuth 会话 cookie 的 `Secure` 属性与 `__Secure-` / `__Host-` 前缀由 **构建期常量 `NODE_ENV`** 决定
（`src/auth.config.ts` 的 `resolveUseSecureCookies`），**不看请求头**：

| 环境 | 命令                          | session / callback-url                    | csrf                       |
| ---- | ----------------------------- | ----------------------------------------- | -------------------------- |
| 开发 | `npm run dev`                 | `authjs.session-token`（无 Secure）       | `authjs.csrf-token`        |
| 生产 | `npm run build` + `npm start` | `__Secure-authjs.session-token`（Secure） | `__Host-authjs.csrf-token` |

由此带来两条部署要求：

- **开发**：`http://localhost:4000` 与 `http://192.168.x.x:4100` 都照常登录，无需任何额外配置。
- **生产**：**必须**对客户端提供 HTTPS（由 Nginx / Caddy 等终止 TLS）。若生产以明文 http 对外服务，
  浏览器会直接丢弃带 `Secure` 的 csrf cookie，导致 CSRF 校验失败、登录**恒定报错**
  （`POST /api/auth/callback/credentials` 始终返回 `error=MissingCSRF`，密码根本没被校验过）。
  无 TLS 的**局域网/内网**部署可显式设置 `AUTH_COOKIE_SECURE=false` 作为受控例外，见 `DEPLOY.md` 4.3.2。

> 不要改成「按 `x-forwarded-proto` 动态判定」：`admin-proxy.mjs` 出于安全原因会剥掉该请求头，
> 生产里 Next.js 看到的上游协议是明文 http，动态判定反而会把生产会话 cookie 降级为非 Secure。

## Docker 部署

项目内置 `Dockerfile`（单镜像：前台 4000 + 管理端 4100）。仓库中不含 `docker-compose.yml`，
请自行编排数据库容器，或直接使用外部数据库实例：

```bash
# 构建并启动（需先准备好外部 MariaDB 并设置好 .env 中的 DATABASE_URL）
docker build -t slider-blog .
docker run -d --name slider-blog -p 4000:4000 -p 4100:4100 \
  -v slider-data:/data --env-file .env slider-blog
```

支持直连外部数据库：在 `.env` 设置 `DATABASE_URL=mariadb://user:password@主机IP:3306/库名` 即可。详见 [部署指南](DEPLOY.md)。

## 项目结构

```
slider-blog/
├── prisma/                  # 数据库 schema 与种子数据
├── src/
│   ├── app/[locale]/        # 国际化路由（(public) 前台 / (admin) 后台）
│   ├── app/api/             # API 路由
│   ├── components/          # React 组件
│   ├── config/              # 站点配置
│   ├── server/              # Server Actions 与数据查询
│   ├── lib/                 # 工具库
│   └── proxy.ts             # 中间件（端口隔离 + 后台鉴权）
├── admin-proxy.mjs          # 管理面板入口代理（4100 → 4000）
├── Dockerfile               # 一体镜像
├── DEPLOY.md                # 部署指南
└── messages/                # i18n 翻译（zh / en）
```

## 文档

- [部署指南](DEPLOY.md)：从零到上线的完整部署流程
- [环境变量参考](.env.example)：所有可配置项与默认值
