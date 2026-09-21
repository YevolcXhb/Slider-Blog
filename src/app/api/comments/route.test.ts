/**
 * POST /api/comments 路由级回归测试（F19 strict 拒绝 + F20 错误码本地化）。
 *
 * 为什么要有这一层：src/lib/comment-schema.test.ts 只证明 schema 本身的行为，
 * 但真实缺陷发生在**链路**上 —— route.ts 取 `issues[0].message` 放进响应体，
 * schema 层的固定码能否原样到达 HTTP 响应、未知字段是否真的变成 400 而不是 201，
 * 只有把 handler 跑起来才能证明。
 *
 * 全部依赖打桩，不连数据库、不起服务：
 *   - @/lib/prisma           → 捕获调用参数的假实现（证明「未知字段不会走到写库」）
 *   - @/lib/rate-limit       → 默认放行，可按用例改成抛错以验证 429
 *   - @/lib/auth             → 默认未登录（游客）
 *   - @/server/actions/comment → **不打桩**：submitComment 是 route 的生产依赖，
 *     打桩就等于把被测链路换掉。它内部的 prisma / auth / rate-limit / next-cache
 *     都已在本文件里被桩住，因此可以真实执行。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only 在 Node 测试环境解析不到（见 src/server/queries/comment.test.ts 的同样处理）
vi.mock("server-only", () => ({}));

// revalidateTag / revalidatePath 需要 Next 请求上下文，测试里直接吃掉；
// unstable_cache 必须一并提供 —— route 经 getApprovedComments
// （src/server/queries/comment.ts）间接 import 它，缺了会让整个模块加载失败。
// 这里直接返回原函数，把缓存包装拆掉（本项目其它测试同样处理）。
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

// headers() 只在 submitComment 里用于取客户端 IP，桩成静态 IP 即可
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }),
}));

const rateLimitMock = vi.fn<(ip: string, kind: string) => Promise<void>>(
  async () => undefined,
);
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (ip: string, kind: string) => rateLimitMock(ip, kind),
}));

const authMock = vi.fn(async () => null);
vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
}));

// Sentry 在测试里没有 DSN，桩成空实现避免噪声
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

const createMock = vi.fn();
const findUniqueMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      create: (...args: unknown[]) => createMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
    post: {
      findUnique: (...args: unknown[]) => findUniqueMock("post", ...args),
    },
  },
}));

import { POST } from "@/app/api/comments/route";

/** 造一个包含真实 comment 对象所需字段的 prisma 返回值。 */
function createdComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 42n,
    post_id: 7n,
    user_id: null,
    parent_id: null,
    author_name: "访客",
    author_email: "internal@example.com",
    content: "hello",
    status: 1,
    avatar_url: null,
    created_at: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

/** 构造一个带 JSON body 的 NextRequest。 */
function postRequest(body: unknown, raw?: string) {
  return new Request("http://localhost:4000/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

/** 调 handler 并解出状态码 + JSON 响应体。 */
async function callPost(body: unknown, raw?: string) {
  const res = await POST(postRequest(body, raw) as never);
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const ZOD_ENGLISH = [
  /Invalid input:/,
  /Unrecognized key:/,
  /Too (small|big):/,
  /received: /,
];

beforeEach(() => {
  createMock.mockReset();
  findUniqueMock.mockReset();
  rateLimitMock.mockReset();
  authMock.mockReset();

  rateLimitMock.mockResolvedValue(undefined);
  authMock.mockResolvedValue(null);
  findUniqueMock.mockResolvedValue(null);
  createMock.mockImplementation(async () => createdComment());
});

describe("POST /api/comments 合法请求", () => {
  it("四个契约字段齐全时返回 201，且响应体带 comment", async () => {
    const { status, json } = await callPost({
      post_id: 7,
      content: "hello",
      author_name: "访客",
      parent_id: undefined,
    });

    expect(status).toBe(201);
    expect(json.success).toBe(true);
    const comment = json.comment as Record<string, unknown>;
    expect(comment.post_id).toBe(7);
    expect(comment.content).toBe("hello");
    expect(comment.author_name).toBe("访客");
  });

  it("最小字段（post_id + content）也返回 201", async () => {
    const { status } = await callPost({ post_id: 7, content: "hi" });
    expect(status).toBe(201);
  });

  it("响应体不含 author_email（公开响应契约）", async () => {
    // createdComment() 故意带 author_email，模拟 prisma 返回了该字段
    const { json } = await callPost({ post_id: 7, content: "hi" });
    expect(JSON.stringify(json)).not.toContain("@example.com");
    expect(JSON.stringify(json)).not.toContain("author_email");
  });
});

describe("POST /api/comments 未知字段 → 400（strict）", () => {
  it("多传 author_email 返回 400，而不是被静默忽略后 201", async () => {
    const { status, json } = await callPost({
      post_id: 7,
      content: "hi",
      author_email: "attacker@example.com",
    });

    // strict 之前这里会是 201，字段被丢弃
    expect(status).toBe(400);
    expect(json.error).toBe("action_error:validationFailed");
  });

  it("多传 author_email 时根本不写库（400 发生在 prisma.create 之前）", async () => {
    await callPost({ post_id: 7, content: "hi", author_email: "a@b.c" });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("多传任意未知字段同样 400", async () => {
    const { status, json } = await callPost({
      post_id: 7,
      content: "hi",
      role: "admin",
    });
    expect(status).toBe(400);
    expect(json.error).toBe("action_error:validationFailed");
  });

  it("未知字段的键名与邮箱值都不回显给提交者", async () => {
    const { json } = await callPost({
      post_id: 7,
      content: "hi",
      author_email: "attacker@example.com",
    });
    const serialized = JSON.stringify(json);
    expect(serialized).not.toContain("author_email");
    expect(serialized).not.toContain("attacker@example.com");
  });
});

describe("POST /api/comments 缺字段/非法字段 → 400", () => {
  const cases: { label: string; body: unknown }[] = [
    { label: "缺 content", body: { post_id: 7 } },
    { label: "缺 post_id", body: { content: "hi" } },
    { label: "post_id 非数字", body: { post_id: "abc", content: "hi" } },
    { label: "post_id 为 0", body: { post_id: 0, content: "hi" } },
    { label: "content 为空串", body: { post_id: 7, content: "" } },
    { label: "content 类型错误", body: { post_id: 7, content: 42 } },
    { label: "parent_id 类型错误", body: { post_id: 7, content: "hi", parent_id: "x" } },
  ];

  it.each(cases)("$label → 400 + 固定错误码，且不写库", async ({ body }) => {
    const { status, json } = await callPost(body);
    expect(status).toBe(400);
    expect(json.error).toBe("action_error:validationFailed");
    expect(createMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/comments 错误信息不含 zod 英文默认文案", () => {
  const cases: { label: string; body: unknown }[] = [
    { label: "缺 content", body: { post_id: 7 } },
    { label: "缺 post_id", body: { content: "hi" } },
    { label: "content 类型错误", body: { post_id: 7, content: 42 } },
    { label: "未知字段", body: { post_id: 7, content: "hi", nope: 1 } },
    { label: "content 超长", body: { post_id: 7, content: "a".repeat(10001) } },
  ];

  it.each(cases)("$label → 响应体无英文 zod 文案", async ({ body }) => {
    const { status, json } = await callPost(body);
    expect(status).toBe(400);
    const serialized = JSON.stringify(json);
    for (const pattern of ZOD_ENGLISH) {
      expect(serialized).not.toMatch(pattern);
    }
    expect(serialized).not.toContain("expected string");
    expect(serialized).not.toContain("undefined");
  });

  it("非法 JSON body → 400，且文案里没有 zod 痕迹", async () => {
    const { status, json } = await callPost(null, "{not json");
    expect(status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    for (const pattern of ZOD_ENGLISH) {
      expect(JSON.stringify(json)).not.toMatch(pattern);
    }
  });
});

describe("POST /api/comments 错误分类（400 / 429 / 500 不互相误判）", () => {
  it("限流命中 → 429，而不是 400 或 500", async () => {
    rateLimitMock.mockRejectedValue(new Error("Rate limit exceeded"));
    const { status, json } = await callPost({ post_id: 7, content: "hi" });
    expect(status).toBe(429);
    expect(json.error).toBe("Too many requests");
  });

  it("prisma 失败 → 500，且不回显内部错误细节", async () => {
    createMock.mockRejectedValue(new Error("Prisma: table comment does not exist"));
    const { status, json } = await callPost({ post_id: 7, content: "hi" });
    expect(status).toBe(500);
    expect(json.error).toBe("Failed to submit comment");
    expect(JSON.stringify(json)).not.toContain("Prisma");
  });

  it("校验失败优先于限流判定：两者的错误形态不混淆", async () => {
    // 即使限流器抛错，只要错误没有 .issues 就走 429 分支；
    // 有 .issues 的一律走 400，顺序见 route.ts 的注释。
    rateLimitMock.mockResolvedValue(undefined);
    const { status } = await callPost({ post_id: 7 });
    expect(status).toBe(400);
  });
});

describe("POST /api/comments 与 Server Action 共用契约", () => {
  it("parent_id 指向不存在的评论时返回 500（服务端拒绝，非校验错误）", async () => {
    // 这条覆盖的是 route 与 submitComment 的接线：非 zod 错误不会被误判成 400
    findUniqueMock.mockResolvedValue(null);
    const { status } = await callPost({ post_id: 7, content: "hi", parent_id: 999 });
    expect(status).toBe(500);
  });
});
