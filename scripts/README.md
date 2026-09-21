# scripts/ 冒烟脚本

本目录存放**对已启动的真实服务**做端到端验证的脚本，与 `npx vitest run` 的单元测试互补：
单元测试证明"函数行为正确"，这里的脚本证明"跑起来的服务行为正确"。

目前只有一个脚本：`smoke.mjs`（F16 端到端集成冒烟）。

---

## 1. smoke.mjs 的用途

第二轮（R2）的全部修复在此之前只在 **类型层与单元层**验证过（`tsc` / `vitest`）。
本脚本补齐**运行时证据**，回答几个只有真实请求才能回答的问题：

- 真实上传 / 评论接口的响应里，到底有没有邮箱字段？
- 限流配置是真的生效，还是只是写在代码里？
- `ADMIN_PROXY_SECRET` 缺失或不正确时，管理路径是不是真的 404？
- F17 / F18 的修复与遗留疑点，在运行时的实际表现是什么？

脚本**只做只读请求，默认不写入任何数据**，可以安全地对开发环境反复运行。

---

## 2. 如何启动服务

脚本自身**不启动服务**，需要你先手动起一个。两种模式：

### 开发模式

```powershell
npm run dev          # next dev -p 4000
```

### 生产模式（第 7 项 ISR 检查需要这个）

```powershell
npm run build        # 仅需一次；确认没有其它 build 在跑
npm run start        # next start -p 4000
```

> **为什么第 7 项必须在生产模式跑**：`next dev` 下 Next.js 不产生 ISR 缓存响应头，
> 因此 dev 环境下第 7 项**没有判定力**。要看 ISR 是否真的生效，必须
> `next build` + `next start`。

### 想让第 4 / 5 项拿到完整证据，请设置网关密钥

第 4 项（未登录访问 `/zh/dashboard` 应重定向登录页）与第 5 项情形 B（带正确密钥头）
都要求服务端**已配置** `ADMIN_PROXY_SECRET`，否则管理路径永远 fail-closed 为 404，
鉴权分支按设计不可达：

```powershell
$env:ADMIN_PROXY_SECRET = "your-secret"     # 与服务端一致
$env:NEXTAUTH_SECRET    = "any-non-empty"   # 否则 next-auth 报 MissingSecret
npm run dev
```

然后**在同一个 shell 里**运行脚本（脚本会读取同名环境变量来构造"正确密钥"请求头）：

```powershell
node scripts/smoke.mjs
```

---

## 3. 如何运行

```powershell
node scripts/smoke.mjs
```

退出码：`0` = 无 FAIL；`1` = 至少一条 FAIL；`2` = 服务不可达；`3` = 脚本自身异常。
SKIP 不影响退出码。

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SMOKE_BASE_URL` | `http://127.0.0.1:4000` | 目标服务 base URL |
| `SMOKE_POST_ID` | 自动探测 | 评论检查用的已发布文章 id；不设则先从 `/api/calendar/posts` 探测 |
| `SMOKE_RL_BURST` | `25` | 第 2 项限流连打次数（api 配额为 10 次/秒） |
| `SMOKE_RATE_LIMIT_BYTES` | `2` | 每次限流请求携带的请求体字节数（保持极小，避免任何落库风险） |
| `SMOKE_TIMEOUT_MS` | `15000` | 单请求超时 |
| `SMOKE_CALENDAR_LOOPS` | `4` | 第 7 项连续请求次数 |
| `SMOKE_CACHE_BUST` | `0` | 设为 `1` 给第 7 项加变化 query，用于观察 ISR 未命中 |
| `SMOKE_SKIP_GATEWAY` | `0` | 设为 `1` 跳过第 5 项情形 B |
| `SMOKE_MODE` | `full` | 设为 `gateway-only` 只跑第 5 项 |
| `ADMIN_PROXY_SECRET` | 空 | 第 4/5 项构造"正确密钥"请求头用；需与服务端一致 |
| `SMOKE_CLIENT_IP` | `203.0.113.77` | 通用请求使用的 `x-real-ip`（TEST-NET-3 保留段） |
| `SMOKE_BURST_IP` | `203.0.113.88` | 第 2 项限流连打专用 IP，避免污染其它检查的配额 |
| `SMOKE_DB_PROBE_IP` | `203.0.113.99` | 数据库探针专用 IP |

---

## 4. 每条断言的含义与预期

脚本逐条打印 `PASS` / `FAIL` / `SKIP` 与**原始证据**（状态码、响应头、响应体片段）。

### 第 1 项 — `GET /api/health` 返回 200

- **含义**：进程存活探针（liveness）。它刻意不查库、不读磁盘、不依赖环境变量。
- **预期**：`200` + `{"status":"ok"}`，**数据库缺失时也必须 200**。
- **判定**：状态码 200 且 `json.status === "ok"`。

### 第 2 项 — `GET /api/health/db` 快速连打出现 429（F14 新增限流）

- **含义**：该端点每次调用新建一个 MariaDB 连接池，必须限流，否则是连接放大器。
- **预期**：同一 IP 连打，超过 api 配额（默认 10 次/秒）后返回 `429`，
  响应体为 `{"error":"Too many requests"}`；且限流发生在**建立数据库连接之前**。
- **判定**：25 次连打中出现至少一个 429，且首个 429 的响应体含 `Too many requests`。
- **注意**：脚本只发 `GET`，不写任何数据；`SMOKE_RATE_LIMIT_BYTES` 仅用于
  第 4 项相关的限流前置验证，不影响本项。

### 第 3 项 — `GET /api/comments` 响应不含邮箱（F2/F10 核心断言）

- **含义**：这是本轮**最重要的运行时断言**。第一轮曾发生评论邮箱泄露，
  修复不能只停留在类型定义上，必须证明**真实响应体**里没有邮箱。
- **预期**：`200` + `{"comments":[...]}`，且：
  1. 递归遍历响应 JSON 的**所有键名**，没有任何键匹配 `/email/i`；
  2. 递归遍历**所有字符串值**，没有任何值匹配邮箱形态
     `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
     （比简单判断 `@` 更严格，避免把 Markdown 正文里的 `@` 误判为泄露）。
- **判定**：状态 200 且响应是 `{comments:[...]}` 且两项扫描均无命中 → PASS。
- **只读保证**：本项只发 `GET`，不落库。

### 第 4 项 — 未登录 `GET /zh/dashboard` 应重定向登录页

- **含义**：未登录用户不得看到后台内容。
- **关键前提**（读 `src/proxy.ts` 得出，不是猜测）：管理路径**只有在通过网关时**
  才会走到鉴权分支。前台入口（无 `x-admin-gateway` 头）下 proxy 直接返回 404 ——
  这是 fail-closed 的**既定设计**，也是第 5 项的断言对象。
- **预期（带正确密钥头）**：`307`（或 302/303/308）且 `location` 指向 `/login`。
- **判定**：
  - 服务端已配置 `ADMIN_PROXY_SECRET` 且脚本持有同一密钥 → 带密钥头访问，期望 3xx → `/login`。
  - 服务端未配置密钥 → 本项 **SKIP**（并写明原因），因为鉴权分支按设计不可达。
    此时脚本**不会**把 fail-closed 的 404 误报成 FAIL。
  - 若返回 200 且是后台 HTML → FAIL（真的泄露了后台内容）。

### 第 5 项 — 网关 fail-closed（F6/F11）

- **含义**：`ADMIN_PROXY_SECRET` 是前后台隔离的唯一可信依据（`Host` / 端口可被伪造）。
  密钥缺失时必须 fail-closed，管理路径与前台行为一致（404）。
- **预期**：
  - **情形 A**：不带 `x-admin-gateway` 头访问 4000 的 `/zh/dashboard` → 必须 `404`。
  - **情形 B**：带**正确密钥**头 → 必须**不**是 404（应进入管理路径逻辑，未登录通常 307 到 `/zh/login`）。
- **判定**：情形 A 为 404 且情形 B 非 404 → PASS。情形 B 因未提供密钥而无法测试时，
  整体记 PASS 但在 note 中明确标注情形 B 未测。

### 第 6 项 — 匿名 `GET /api/tags` 与 `/api/categories`（F14 遗留疑点）

- **含义**：F14 边界审计发现这两个端点匿名可读。它们是否构成内容泄露，
  取决于 `admin-proxy.mjs` 是直发还是转发 —— 由本项用运行时证据定论。
- **本项只记录事实，不下结论**，输出状态码、条目数与样本元素，供人类决策。
- **预期**：两个端点均 `200` + 列表 → 记录条目数。
- **判定**：200 且为列表 → PASS（仅代表"事实已采集"）；5xx → SKIP；
  其它非预期状态 → FAIL。

### 第 7 项 — `GET /api/calendar/posts?locale=zh` 是否命中 ISR（F18 遗留疑点）

- **含义**：该路由声明了 `export const revalidate = 300`。F18 为它加了限流
  （`getClientIp(request.headers)`），需要确认这是否影响了 ISR 缓存。
- **本项只记录事实**：连续请求的 `x-nextjs-cache` / `age` / `cache-control` /
  `x-vercel-cache` 响应头与耗时，供人类决策。
- **判定力**：`next dev` 下 Next.js 不产生 ISR 缓存头，**dev 结果不具判定力**；
  只有 `next build` + `next start` 下的结果能说明问题。
- **判定**：生产模式下观测到任一缓存头 → PASS；一个都没有 → FAIL；端点不可用 → SKIP。

### 第 8 项 — F17 回归点：`/api/categories` 与 `/api/tags` 必须可达

- **含义**：F17 修复了后台建站表单请求 `/${locale}/api/categories`（带 locale 前缀）
  导致 404 的缺陷。本项确认修复方向正确。
- **预期**：
  - `GET /api/categories` 与 `GET /api/tags`（**无** locale 前缀）→ `200` + JSON 列表；
  - 反证：`GET /zh/api/categories`（修复前的错误路径）→ `404`（该路径不可达）。
- **判定**：两个无前缀端点 200 且为 JSON 数组、带前缀端点 404 → PASS；
  端点 5xx → SKIP（但"路由可达、不是 404"这一点仍侧面证明了修复方向）。

---

## 5. 已知 SKIP 条件

脚本在下列情况下会标 SKIP，**这是如实反映环境限制，不是通过**：

| 场景 | 涉及条目 | 说明 |
|---|---|---|
| **数据库不可用**（`DATABASE_URL` 未设置或数据库不可达） | 3、6、8 | 相关端点返回 500 `{"error":"Internal server error"}`。脚本会调用 `/api/health/db` 确认 `connected:false`，并把这一**确切原因**写进 SKIP 说明，而不是笼统写"环境原因"。 |
| **服务端未配置 `ADMIN_PROXY_SECRET`** | 4 | 管理路径永远 fail-closed 为 404，鉴权分支（307 → `/login`）按设计不可达。要取得证据，请带密钥启动服务并导出同名环境变量后重跑。 |
| **未提供 `ADMIN_PROXY_SECRET` 给脚本** | 5 情形 B | 无法构造"正确密钥"请求头，情形 B 跳过；情形 A 仍会执行。也可用 `SMOKE_SKIP_GATEWAY=1` 显式跳过。 |
| **`/api/comments` 自身命中限流** | 3 | 该检查用的 IP 已被限流时，脚本指出可等待 1 秒或用 `SMOKE_CLIENT_IP` 换一个 IP 重跑。 |
| **目标服务不可达** | 全部 | 预检失败时全部标 SKIP，退出码 `2`。 |

---

## 6. 设计约束

- **只用 Node 内置 `fetch`**，不新增任何运行时依赖。
- **默认不写入任何数据**：所有请求均为只读 `GET`（第 2 项的连打也是 `GET`）。
  脚本**不会**调用 `POST /api/comments`，因此不会产生垃圾评论。
  需要验证限流时走的是"限流前置"路径，不落库。
- **绝不伪造结果**：拿不到证据就标 SKIP，并写明确切原因；
  不会把 fail-closed 的设计行为误报为 FAIL，也不会把 SKIP 当成 PASS。
- `smoke.mjs` 是 `.mjs`，不在 eslint 的 TS 检查范围内。
