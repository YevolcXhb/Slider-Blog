/**
 * getCategories / getTags 关系计数过滤的回归测试。
 *
 * 背景（真实信息泄露）：这两个函数用
 *   include: { _count: { select: { posts: true } } }
 * 统计分类/标签下的文章数，而 _count 默认把 status != 1 的草稿/待审也算进去。
 * 返回值经 /api/categories、/api/tags（公开 GET，无鉴权）、首页、/categories、
 * /tags 与侧边栏卡片直接序列化给匿名访客，于是「某分类下有 N 篇未发布文章」
 * 这一元信息可被读出，而正文并不可见。修复方式是把计数收窄为只统计 status: 1。
 *
 * 本测试断言的是「传给 prisma 的查询参数」，而不是函数的返回值：
 * 返回值对 mock 来说是自造的，断言它只会恒真。只有把 findMany 的实参抓住，
 * 才能证明过滤条件真的下推到了数据库。谁把 where 删掉、写成 posts: true、
 * 或把 status 改成别的值，这里立刻变红。
 *
 * 不连真实数据库：用 vi.mock 打桩 @/lib/prisma 捕获调用参数。
 * post.ts 顶部还有 `import "server-only"` 与 unstable_cache 包装，
 * 前者在 Node 测试环境解析不到，后者会把函数包成缓存版本（参数不可见），
 * 因此两者都要 mock —— unstable_cache(fn) 直接返回 fn。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: () => {},
}));

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findMany: (...args: unknown[]) => findMany("category", ...args) },
    tag: { findMany: (...args: unknown[]) => findMany("tag", ...args) },
  },
}));

import { getCategories, getTags } from "@/server/queries/post";

/** 取回 findMany 收到的唯一一次参数（按 model 区分 category / tag）。 */
function capturedArgs(model: "category" | "tag"): Record<string, unknown> {
  const call = findMany.mock.calls.find((c) => c[0] === model);
  if (!call) throw new Error(`prisma.${model}.findMany 未被调用`);
  return call[1] as Record<string, unknown>;
}

/** 从 findMany 参数中取出 _count.select.posts，缺失即抛错（缺失本身就是回归）。 */
function countedPostsWhere(model: "category" | "tag"): Record<string, unknown> {
  const args = capturedArgs(model);
  const count = args.include as { _count?: { select?: { posts?: unknown } } } | undefined;
  const posts = count?._count?.select?.posts;
  if (posts === undefined) {
    throw new Error(`include._count.select.posts 缺失（${model}）`);
  }
  if (posts === true) {
    // 正是修复前的写法：统计全部文章，含草稿
    throw new Error(`_count.select.posts 是裸 true，未做过滤（${model}）`);
  }
  return (posts as { where?: Record<string, unknown> }).where ?? {};
}

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe("getCategories 的 _count 只统计已发布文章", () => {
  it("category.findMany 的 _count.select.posts 带 where.status = 1", async () => {
    findMany.mockResolvedValue([]);
    await getCategories();

    // 核心断言：过滤条件必须真实下推给数据库
    expect(countedPostsWhere("category")).toEqual({ status: 1 });
  });

  it("不存在裸 true 计数（修复前的信息泄露写法）", async () => {
    await getCategories();
    const select = (
      capturedArgs("category").include as { _count: { select: Record<string, unknown> } }
    )._count.select;

    expect(select.posts).not.toBe(true);
    expect(select.posts).toEqual({ where: { status: 1 } });
    // 过滤值必须恰好是「已发布」，改成 0 / 2 都算回归
    expect(select.posts).not.toEqual({ where: { status: 0 } });
  });

  it("返回形状保持 Category[] 不变（id/name/slug/_count.posts）", async () => {
    findMany.mockResolvedValue([{ id: 1n, name: "技术", slug: "tech", _count: { posts: 3 } }]);

    const result = await getCategories();

    expect(result).toEqual([{ id: 1, name: "技术", slug: "tech", _count: { posts: 3 } }]);
  });

  it("其他查询参数（orderBy）未被顺手改动", async () => {
    await getCategories();
    expect(capturedArgs("category").orderBy).toEqual({ name: "asc" });
  });
});

describe("getTags 的 _count 只统计已发布文章", () => {
  it("tag.findMany 的 _count.select.posts 通过中间表 post 过滤 status = 1", async () => {
    await getTags();

    // Tag.posts 的关系模型是 PostTag（中间表），没有 status 列，
    // 过滤条件必须写在 post 关系上。
    expect(countedPostsWhere("tag")).toEqual({ post: { status: 1 } });
  });

  it("不存在裸 true 计数，且过滤值恰为已发布", async () => {
    await getTags();
    const select = (capturedArgs("tag").include as { _count: { select: Record<string, unknown> } })
      ._count.select;

    expect(select.posts).not.toBe(true);
    expect(select.posts).toEqual({ where: { post: { status: 1 } } });
    expect(select.posts).not.toEqual({ where: { post: { status: 0 } } });
  });

  it("返回形状保持 Tag[] 不变（id/name/slug/_count.posts）", async () => {
    findMany.mockResolvedValue([{ id: 7n, name: "Next.js", slug: "nextjs", _count: { posts: 2 } }]);

    const result = await getTags();

    expect(result).toEqual([{ id: 7, name: "Next.js", slug: "nextjs", _count: { posts: 2 } }]);
  });

  it("其他查询参数（orderBy）未被顺手改动", async () => {
    await getTags();
    expect(capturedArgs("tag").orderBy).toEqual({ name: "asc" });
  });
});
