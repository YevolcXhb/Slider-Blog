# Slider-Blog 快速部署文档

本文档描述 Slider-Blog 项目从零到上线的完整部署流程。适用于 Linux 服务器（推荐 Ubuntu 22.04 / Debian 12）生产环境。

---

## 一、系统要求

### 1.1 服务器硬件最低配置

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 核 | 2 核 |
| 内存 | 1 GB | 2 GB |
| 磁盘 | 10 GB | 20 GB SSD |
| 带宽 | 1 Mbps | 5 Mbps |

### 1.2 软件依赖

| 软件 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 22.16.0+ | 推荐 22 LTS（Next.js 16 要求） |
| npm | 10.9.4+ | 随 Node.js 安装 |
| MariaDB | 10.6+ | 推荐 10.11 LTS |
| Nginx | 1.18+ | 反向代理与静态资源 |
| PM2 | 5.0+ | Node.js 进程守护（可选，可用 systemd 替代） |

### 1.3 端口规划

| 服务 | 端口 | 说明 |
|------|------|------|
| Next.js | 4000 | 应用进程 |
| 管理端代理 | 4100 | 应用进程（admin-proxy） |
| MariaDB | 3306 | 数据库（仅本地访问） |
| Nginx | 80 / 443 | HTTP / HTTPS 入口 |

---

## 二、环境准备

### 2.1 安装 Node.js 22 LTS

```bash
# 使用 NodeSource 官方源
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证
node -v   # 应输出 v22.x.x
npm -v    # 应输出 10.x.x
```

### 2.2 安装 MariaDB 10.11

```bash
sudo apt-get install -y mariadb-server mariadb-client

# 启动并设置开机自启
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 安全初始化（设置 root 密码、移除匿名用户、禁止远程 root 登录）
sudo mysql_secure_installation
```

### 2.3 安装 Nginx

```bash
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2.4 安装 PM2（可选，推荐）

```bash
sudo npm install -g pm2
```

---

## 三、数据库配置

### 3.1 创建数据库与用户

```bash
sudo mysql -u root -p
```

```sql
-- 创建数据库（使用 utf8mb4 支持完整 Unicode，包括 emoji 与生僻字）
CREATE DATABASE slider_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建专用用户（替换 'your_strong_password' 为强密码）
CREATE USER 'slider_blog'@'localhost' IDENTIFIED BY 'your_strong_password';

-- 授予全库权限
GRANT ALL PRIVILEGES ON slider_blog.* TO 'slider_blog'@'localhost';

-- 刷新权限并退出
FLUSH PRIVILEGES;
EXIT;
```

### 3.2 验证连接

```bash
mysql -u slider_blog -p -h localhost slider_blog
# 输入密码后应能进入 MariaDB 提示符
```

---

## 四、项目部署

### 4.1 上传项目代码

将项目压缩包上传至服务器并解压：

```bash
# 方式一：scp 上传（在本地执行）
scp slider-blog.zip user@your-server-ip:/home/user/

# 方式二：使用 git clone（如已托管）
git clone <your-repo-url> /home/user/slider-blog

# 在服务器上解压
cd /home/user
unzip slider-blog.zip
mv slider-blog slider-blog  # 如需重命名
cd slider-blog
```

### 4.2 安装依赖

```bash
# 安装所有依赖（含 devDependencies）
npm install

# 如遇 peer dependency 冲突，可加 --legacy-peer-deps
# npm install --legacy-peer-deps
```

### 4.3 配置环境变量

复制示例文件并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件，按实际环境填写（参见下方说明）：

```bash
# ===== 数据库 =====
# 格式：mariadb://用户名:密码@主机:端口/数据库名
DATABASE_URL="mariadb://slider_blog:your_strong_password@localhost:3306/slider_blog"

# ===== NextAuth =====
# 生成命令：openssl rand -base64 32
NEXTAUTH_SECRET="在此粘贴 openssl rand -base64 32 的输出"
# 站点完整 URL（含协议，不要带尾斜杠）
NEXTAUTH_URL="https://your-domain.com"

# ===== Sentry（可选，不配置则不上报错误） =====
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=

# ===== 站点 =====
NEXT_PUBLIC_SITE_URL=https://your-domain.com

# ===== 上传目录 =====
UPLOAD_DIR=public/uploads

# ===== 邮件（SMTP，用于评论拒绝通知） =====
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-smtp-username
EMAIL_PASS=your-smtp-password
EMAIL_FROM=noreply@your-domain.com
```

#### 关键说明

- **NEXTAUTH_SECRET**：必须使用强随机值。生成命令 `openssl rand -base64 32`。泄露会导致 JWT 可被伪造。
- **NEXTAUTH_URL**：必须与用户实际访问的 URL 完全一致（含 `https://`），否则登录回调会失败。
- **DATABASE_URL**：密码中的特殊字符需 URL 编码（如 `@` → `%40`、`#` → `%23`）。
- **Sentry**：DSN 留空则 SDK 不上报，不影响功能。
- **邮件**：不配置则评论拒绝通知跳过，不影响拒绝操作本身。

### 4.4 生成 Prisma Client

```bash
npx prisma generate
```

### 4.5 执行数据库迁移

由于项目无 migration 历史，使用 `prisma db push` 将 schema 直接同步到数据库：

```bash
npx prisma db push
```

> **生产环境提示**：`db push` 不生成 migration 文件。如需可追溯的迁移历史，建议改用：
> ```bash
> npx prisma migrate dev --name init
> ```
> 此命令会创建 `prisma/migrations/` 目录，便于后续版本升级时增量迁移。

### 4.6 创建管理员账号（首次注册机制）

本项目**不预设管理员账号**，采用「首次注册即管理员」机制：

- **第一个**在 `/register` 页面注册的用户自动成为**管理员**（role=1）
- 之后所有注册用户默认为**普通用户**（role=0）
- 管理员可在后台「用户管理」页面调整其他用户的角色或删除账号

**部署后操作**：

```bash
# 1. 启动应用（参见第五章）
# 2. 浏览器访问注册页面
#    https://your-domain.com/zh/register
#    或
#    https://your-domain.com/en/register
# 3. 填写用户名、邮箱、密码（至少 8 位）完成注册
# 4. 该账号自动获得管理员权限并登录，跳转至 /dashboard
```

> **安全提示**：
> - 部署后请尽快完成首次注册，避免被他人抢注管理员。
> - 注册页会显示提示「首个注册的用户将自动成为管理员」。
> - 如需批量初始化数据，可使用 seed 脚本（见下方说明）。

#### 可选：使用 seed 脚本初始化（不推荐用于生产）

seed 脚本会创建一个默认管理员 `admin@example.com`，与「首次注册」机制冲突。仅在需要预设账号时使用：

```bash
# 开发环境（使用默认密码 admin123456）
npx prisma db seed

# 生产环境（必须显式指定密码）
export SEED_ADMIN_PASSWORD="YourStrongAdminPassword123!"
export NODE_ENV=production
npx prisma db seed
```

> **注意**：运行 seed 后，数据库已有管理员账号，「首次注册」机制将创建普通用户。

### 4.7 构建生产版本

```bash
# 设置生产环境
export NODE_ENV=production

# 构建
npm run build
```

构建成功后输出示例：
```
✓ Compiled successfully in 10.9s
Route (app)
┌ ○ /_not-found
├ ƒ /[locale]
├ ƒ /[locale]/about
...
✓ Generating static pages using 15 workers (11/11)
ƒ Proxy (Middleware)
```

> `output: "standalone"` 已在 `next.config.ts` 中启用，构建产物位于 `.next/standalone/`，包含独立运行所需的最小化 `node_modules`。

### 4.8 创建上传目录

```bash
mkdir -p public/uploads
chmod 755 public/uploads
```

---

## 五、进程管理

### 方式一：PM2（推荐）

```bash
# 启动应用
pm2 start npm --name "slider-blog" -- start

# 保存进程列表（开机自启）
pm2 save
pm2 startup
# 按提示执行返回的命令
```

常用 PM2 命令：

```bash
pm2 status              # 查看进程状态
pm2 logs slider-blog    # 查看实时日志
pm2 restart slider-blog # 重启
pm2 stop slider-blog    # 停止
pm2 delete slider-blog  # 删除进程
```

### 方式二：systemd

创建服务文件：

```bash
sudo tee /etc/systemd/system/slider-blog.service > /dev/null <<'EOF'
[Unit]
Description=Slider-Blog Next.js Application
After=network.target mariadb.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/user/slider-blog
Environment=NODE_ENV=production
EnvironmentFile=/home/user/slider-blog/.env
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable slider-blog
sudo systemctl start slider-blog
sudo systemctl status slider-blog  # 查看状态
```

### 方式三：使用 standalone 产物（最小化部署）

```bash
# 复制 standalone 产物到部署目录
cp -r .next/standalone /var/www/slider-blog
cp -r .next/static /var/www/slider-blog/.next/static
cp -r public /var/www/slider-blog/public

# 启动
cd /var/www/slider-blog
node server.js
```

---

## 六、Nginx 反向代理配置

### 6.1 创建站点配置

```bash
sudo tee /etc/nginx/sites-available/slider-blog > /dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # HTTP 强制跳转 HTTPS（配置 SSL 证书后启用）
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL 证书（使用 Let's Encrypt 或自购证书）
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Next.js 应用
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        # 速率限制（可选，需在 http 块定义 limit_req_zone）
        # limit_req zone=api burst=20 nodelay;
    }

    # 静态资源缓存（Next.js 自动生成的 chunks）
    location /_next/static/ {
        proxy_pass http://127.0.0.1:4000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # 图片优化缓存
    location /_next/image {
        proxy_pass http://127.0.0.1:4000;
        expires 30d;
        add_header Cache-Control "public";
    }

    # 上传文件（直接由 Nginx 提供服务，避免经过 Node.js）
    location /uploads/ {
        alias /home/user/slider-blog/public/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # 上传文件大小限制
    client_max_body_size 10M;

    # Gzip 压缩（next.config.ts 已禁用应用层压缩，由 Nginx 处理）
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/x-javascript
        application/json
        application/xml
        application/xml+rss
        image/svg+xml;
}
EOF
```

### 6.2 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/slider-blog /etc/nginx/sites-enabled/

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 6.3 申请 SSL 证书（Let's Encrypt）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

证书自动续期已由 certbot 配置，无需手动处理。

---

## 七、部署后验证

### 7.1 健康检查

```bash
# 应用进程健康
curl http://127.0.0.1:4000/api/health
# 应返回：{"status":"ok"}

# Nginx 转发健康
curl https://your-domain.com/api/health
# 应返回：{"status":"ok"}
```

### 7.2 功能验证清单

| 序号 | 验证项 | 操作方法 |
|------|--------|----------|
| 1 | 首页加载 | 访问 `https://your-domain.com/` |
| 2 | 语言切换 | 点击右上角"中/EN"切换 |
| 3 | 主题切换 | 点击主题按钮切换明暗 |
| 4 | 博客列表 | 访问 `/zh/blog`，确认文章列表加载 |
| 5 | 全文搜索 | 在博客列表输入关键词搜索 |
| 6 | 文章详情 | 点击任意文章，确认正文与代码高亮渲染 |
| 7 | 评论提交 | 在文章详情页提交评论（登录用户立即显示，游客提示待审核） |
| 8 | 注册 | 访问 `/zh/register`，首个注册账号自动成为管理员 |
| 9 | 登录 | 访问 `/zh/login`，使用管理员账号登录 |
| 10 | 后台 Dashboard | 登录后访问 `/zh/dashboard`，确认统计数据显示 |
| 11 | 创建文章 | 访问 `/zh/posts/create`，创建并发布文章 |
| 12 | 评论审核 | 访问 `/zh/comments`，审核待处理评论 |
| 13 | 分类管理 | 访问 `/zh/manage-categories`，增删分类与标签 |
| 14 | 动态管理 | 访问 `/zh/manage-moments`，发布/编辑/置顶动态 |
| 15 | 相册管理 | 访问 `/zh/manage-gallery`，创建相册与添加照片 |
| 16 | 用户管理 | 访问 `/zh/manage-users`，调整用户角色、删除用户 |
| 17 | 图片上传 | 创建文章时上传图片，确认返回 URL |
| 18 | sitemap | 访问 `/sitemap.xml`，确认输出 sitemap |
| 19 | robots.txt | 访问 `/robots.txt` |
| 20 | 404 页面 | 访问不存在的路径，确认显示 404 |
| 21 | 权限控制 | 退出登录后访问 `/zh/dashboard`，应重定向到登录页 |

### 7.3 安全验证

```bash
# 检查安全头
curl -I https://your-domain.com/
# 应包含：
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Referrer-Policy: strict-origin-when-cross-origin
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
# Permissions-Policy: camera=(), microphone=(), geolocation=()

# 检查未登录访问后台
curl -o /dev/null -w "%{http_code}" https://your-domain.com/zh/dashboard
# 应返回 307（重定向到登录页）或 200（重定向后登录页内容）
```

---

## 八、日常运维

### 8.1 查看日志

```bash
# PM2 方式
pm2 logs slider-blog --lines 100

# systemd 方式
sudo journalctl -u slider-blog -f --lines 100

# Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 8.2 重启应用

```bash
# PM2 方式
pm2 restart slider-blog

# systemd 方式
sudo systemctl restart slider-blog
```

### 8.3 更新代码

```bash
cd /home/user/slider-blog

# 拉取最新代码
git pull origin main
# 或重新上传压缩包解压

# 安装依赖（如 package.json 有变化）
npm install

# 重新生成 Prisma Client（如 schema.prisma 有变化）
npx prisma generate

# 执行数据库迁移（如 schema 有变化）
npx prisma db push

# 重新构建
npm run build

# 重启进程
pm2 restart slider-blog
```

### 8.4 数据库备份

```bash
# 手动备份
mysqldump -u slider_blog -p slider_blog | gzip > /backup/slider_blog_$(date +%Y%m%d).sql.gz

# 定时备份（添加到 crontab）
crontab -e
# 每天凌晨 3 点备份
0 3 * * * mysqldump -u slider_blog -p'your_strong_password' slider_blog | gzip > /backup/slider_blog_$(date +\%Y\%m\%d).sql.gz

# 清理 7 天前的备份
0 4 * * * find /backup -name "slider_blog_*.sql.gz" -mtime +7 -delete
```

### 8.5 上传文件备份

```bash
# 备份上传目录
tar -czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /home/user/slider-blog/public/uploads .

# 定时备份
crontab -e
0 3 * * * tar -czf /backup/uploads_$(date +\%Y\%m\%d).tar.gz -C /home/user/slider-blog/public/uploads .
```

---

## 九、常见问题排查

### Q1：构建失败 "Type error"

**现象**：`npm run build` 报 TypeScript 类型错误。

**排查**：
```bash
# 单独运行类型检查
npx tsc --noEmit
```
根据报错信息修复对应文件后重新构建。

### Q2：数据库连接失败

**现象**：应用启动报 `Can't reach database server`。

**排查**：
```bash
# 检查 MariaDB 服务状态
sudo systemctl status mariadb

# 测试连接
mysql -u slider_blog -p -h localhost slider_blog

# 检查 .env 中 DATABASE_URL 格式
# 正确格式：mariadb://用户:密码@localhost:3306/slider_blog
# 密码特殊字符需 URL 编码
```

### Q3：登录失败 "无效凭据"

**排查**：
1. 确认已完成首次注册（访问 `/zh/register` 创建首个管理员账号）
2. 确认邮箱与密码输入正确
3. 检查 `NEXTAUTH_SECRET` 是否设置（未设置会导致 JWT 签发失败）
4. 检查 `NEXTAUTH_URL` 与实际访问 URL 是否一致
5. 登录限流：同一 IP 60 秒内最多 5 次尝试，超限会被临时拦截

### Q4：图片上传返回 413

**现象**：Nginx 返回 413 Request Entity Too Large。

**修复**：在 Nginx 配置中调整：
```nginx
client_max_body_size 10M;  # 已在示例配置中设置
```
重载 Nginx：`sudo systemctl reload nginx`

### Q5：邮件发送失败

**现象**：评论拒绝时日志报 `Email environment variables are not configured`。

**排查**：
1. 检查 `.env` 中 `EMAIL_HOST`、`EMAIL_PORT`、`EMAIL_USER`、`EMAIL_PASS` 是否全部填写
2. 测试 SMTP 连通性：
   ```bash
   nc -zv smtp.your-provider.com 587
   ```
3. 注意：邮件发送失败**不会阻断**评论拒绝操作，仅记录错误日志。

### Q6：Sentry 不上报错误

**排查**：
1. 确认 `.env` 中 `SENTRY_DSN` 与 `NEXT_PUBLIC_SENTRY_DSN` 均已填写
2. 服务端错误检查 `SENTRY_DSN`，客户端错误检查 `NEXT_PUBLIC_SENTRY_DSN`
3. DSN 留空时 SDK 静默跳过，不影响应用功能

### Q7：内存不足导致构建失败

**现象**：构建过程中进程被 OOM Killer 杀死。

**修复**（1GB 内存服务器）：
```bash
# 方式一：添加临时 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 方式二：本地构建后上传 standalone 产物
# 在本地执行 npm run build，将 .next/standalone 上传到服务器
```

### Q8：proxy（middleware）不生效

**现象**：未登录可访问后台页面。

**排查**：
1. 确认 `src/proxy.ts` 文件存在（Next.js 16 已将 middleware 改名为 proxy）
2. 构建输出应包含 `ƒ Proxy (Middleware)`
3. 检查 `src/auth.config.ts` 是否正确导出 `authConfig`
4. 确认 `NEXTAUTH_SECRET` 已设置

---

## 十、环境变量速查表

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `DATABASE_URL` | 是 | MariaDB 连接串 | `mariadb://user:pass@localhost:3306/slider_blog` |
| `NEXTAUTH_SECRET` | 是 | JWT 签名密钥 | `openssl rand -base64 32` 的输出 |
| `NEXTAUTH_URL` | 是 | 站点完整 URL | `https://your-domain.com` |
| `NEXT_PUBLIC_SITE_URL` | 是 | 站点 URL（客户端可见） | `https://your-domain.com` |
| `UPLOAD_DIR` | 否 | 上传目录路径 | `public/uploads` |
| `SENTRY_DSN` | 否 | Sentry 服务端 DSN | `https://xxx@sentry.io/123` |
| `NEXT_PUBLIC_SENTRY_DSN` | 否 | Sentry 客户端 DSN | `https://xxx@sentry.io/123` |
| `SENTRY_ORG` | 否 | Sentry 组织 | `your-org` |
| `SENTRY_PROJECT` | 否 | Sentry 项目 | `slider-blog` |
| `SENTRY_AUTH_TOKEN` | 否 | Sentry 构建上传 token | `sntrys_eyJpYXQ...` |
| `EMAIL_HOST` | 否 | SMTP 主机 | `smtp.gmail.com` |
| `EMAIL_PORT` | 否 | SMTP 端口 | `587` |
| `EMAIL_USER` | 否 | SMTP 用户名 | `your@gmail.com` |
| `EMAIL_PASS` | 否 | SMTP 密码或应用专用密码 | `your-app-password` |
| `EMAIL_FROM` | 否 | 发件人地址 | `noreply@your-domain.com` |
| `SEED_ADMIN_PASSWORD` | 否 | seed 时的管理员密码（仅运行 seed 时需要） | `YourStrongPassword123!` |

---

## 十一、目录结构

```
slider-blog/
├── public/                    # 静态资源
│   └── uploads/               # 用户上传文件（运行时生成）
├── prisma/
│   ├── schema.prisma          # 数据库模型定义
│   └── seed.ts                # 种子数据脚本（可选，创建默认 admin）
├── sentry.client.config.ts    # Sentry 客户端配置
├── sentry.server.config.ts    # Sentry 服务端配置
├── sentry.edge.config.ts      # Sentry 边缘运行时配置
├── src/
│   ├── proxy.ts               # Next.js 16 proxy 文件（原 middleware）
│   ├── auth.config.ts         # Edge-safe 认证配置
│   ├── app/                   # Next.js App Router
│   │   ├── [locale]/          # 国际化路由
│   │   │   ├── (public)/      # 前台路由组（home/blog/about/gallery/moments/register/login 等）
│   │   │   └── (admin)/       # 后台路由组（dashboard/posts/comments/manage-*）
│   │   └── api/               # API 路由
│   ├── components/            # React 组件
│   ├── config/                # 站点配置（slider-config.ts 等）
│   ├── lib/                   # 工具库（auth、prisma、rate-limit 等）
│   ├── server/                # Server Actions 与 Queries
│   │   ├── actions/           # Server Actions（auth/category/comment/dynamic/gallery/post/register）
│   │   └── queries/           # 数据查询（post/site/stats）
│   ├── types/                 # TypeScript 类型定义
│   └── i18n/                  # next-intl 国际化配置
├── messages/                  # 国际化文案
│   ├── en.json
│   └── zh.json
├── next.config.ts             # Next.js 配置
├── prisma.config.ts           # Prisma 7 配置
├── package.json
├── tsconfig.json
└── .env.example               # 环境变量示例
```

#### 管理后台路由（`(admin)` 路由组）

| 路径 | 说明 | 鉴权 |
|------|------|------|
| `/dashboard` | 仪表盘（站点概览） | 管理员 |
| `/posts` | 文章管理（列表/创建/编辑） | 管理员 |
| `/comments` | 评论审核 | 管理员 |
| `/manage-categories` | 分类与标签管理 | 管理员 |
| `/manage-moments` | 动态管理（发布/编辑/置顶） | 管理员 |
| `/manage-gallery` | 相册管理（相册/照片 CRUD） | 管理员 |
| `/manage-users` | 用户管理（角色调整/删除） | 管理员 |

---

## 十二、快速部署脚本（一键执行）

将以下脚本保存为 `deploy.sh`，赋予执行权限后运行：

```bash
#!/bin/bash
set -e

# ===== 配置区 =====
APP_DIR="/home/user/slider-blog"
APP_NAME="slider-blog"
NODE_VERSION="22"

echo "===== Slider-Blog 部署脚本 ====="

# 1. 进入项目目录
cd "$APP_DIR" || { echo "目录不存在: $APP_DIR"; exit 1; }

# 2. 安装依赖
echo "[1/6] 安装依赖..."
npm install --legacy-peer-deps

# 3. 生成 Prisma Client
echo "[2/6] 生成 Prisma Client..."
npx prisma generate

# 4. 同步数据库 schema
echo "[3/6] 同步数据库 schema..."
npx prisma db push

# 5. 管理员账号（首次注册机制，无需 seed）
echo "[4/6] 管理员账号将在应用启动后通过 /register 注册创建"
echo "      首个注册用户自动成为管理员，详情参见 4.6 节"
echo "      如需预设账号，可手动执行：SEED_ADMIN_PASSWORD=xxx npx prisma db seed"

# 6. 构建生产版本
echo "[5/6] 构建生产版本..."
export NODE_ENV=production
npm run build

# 7. 重启进程
echo "[6/6] 重启应用进程..."
if command -v pm2 &> /dev/null; then
    pm2 restart "$APP_NAME" || pm2 start npm --name "$APP_NAME" -- start
    pm2 save
    echo "PM2 已重启 $APP_NAME"
elif [ -f /etc/systemd/system/$APP_NAME.service ]; then
    sudo systemctl restart $APP_NAME
    echo "systemd 已重启 $APP_NAME"
else
    echo "未检测到 PM2 或 systemd，请手动启动：npm start"
fi

echo "===== 部署完成 ====="
echo "访问 https://your-domain.com 验证"
```

使用方式：

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 十三、附录

### 13.1 技术栈版本

| 技术 | 版本 |
|------|------|
| Next.js | 16.2.12 |
| React | 19.2.4 |
| TypeScript | 5.x |
| Prisma | 7.9.0 |
| MariaDB | 10.6+ |
| next-auth | 5.0.0-beta.32 |
| next-intl | 4.13.4 |
| Tailwind CSS | 4.x |
| Sentry SDK | 10.68.0 |

### 13.2 管理员账号机制

本项目**不预设管理员账号**，采用「首次注册即管理员」机制：

- **第一个**在 `/register` 页面注册的用户自动成为管理员（role=1）
- 之后所有注册用户默认为普通用户（role=0）
- 管理员可在后台 `/manage-users` 页面调整其他用户的角色或删除账号
- 安全限制：管理员不能降级自己、不能删除自己、不能删除最后一个管理员

> 如需预设账号，可运行 `npx prisma db seed`（创建 `admin@example.com`，开发默认密码 `admin123456`），但会与首次注册机制冲突。

### 13.3 关键 API 端点

| 端点 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/health` | GET | 健康检查 | 无 |
| `/api/auth/[...nextauth]` | * | NextAuth 认证 | 无 |
| `/api/comments` | GET / POST | 评论列表 / 提交评论 | POST 需限流 |
| `/api/categories` | GET | 分类列表 | 无 |
| `/api/tags` | GET | 标签列表 | 无 |
| `/api/calendar/posts` | GET | 日历热力图文章数据 | 无 |
| `/api/music` | GET | 音乐播放列表 | 无 |
| `/api/upload` | POST | 图片上传 | 需管理员 |
| `/robots.txt` | GET | 爬虫规则 | 无 |
| `/sitemap.xml` | GET | 站点地图 | 无 |

### 13.4 参考文档

- [Next.js 16 部署文档](https://nextjs.org/docs/app/getting-started/deploying)
- [Prisma 7 部署指南](https://www.prisma.io/docs/guides/deployment)
- [next-auth v5 配置](https://authjs.dev/getting-started/installation)
- [next-intl 路由配置](https://next-intl-docs.vercel.app/docs/routing)
- [Sentry Next.js 集成](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
