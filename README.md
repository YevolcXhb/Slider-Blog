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

# 3. 初始化数据库
npx prisma db push

# 4. 启动前台（4000）
npm run dev

# 5. 另开终端：管理端入口（4100）
npm run dev:admin
```

首次访问 `http://localhost:4100` 进入初始化向导：先填写数据库连接信息（地址/端口/库名/用户名/密码），服务端验证连接后写入容器内的 `/data/config.env` 并自动重启，随后创建管理员并配置站点。完整说明见 [快速开始文档](docs-site/guide/getting-started.md)。

## Docker 部署

项目内置 `Dockerfile` + `docker-compose.yml`（单镜像：前台 4000 + 管理端 4100）：

```bash
docker compose up -d db        # 使用内置数据库时先起库
docker compose up -d --build
```

支持直连外部数据库：在 `.env` 设置 `DATABASE_URL=mariadb://user:password@主机IP:3306/库名` 即可。详见 [部署指南](docs-site/guide/deploy.md)。

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
├── docker-compose.yml       # 一键部署编排
├── docs-site/               # 文档
└── messages/                # i18n 翻译（zh / en）
```

## 文档

- [快速开始](docs-site/guide/getting-started.md)
- [部署指南](docs-site/guide/deploy.md)
- [环境变量参考](docs-site/guide/env.md)
