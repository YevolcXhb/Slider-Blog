import { describe, expect, it, vi } from "vitest";

// comment.ts 顶部有 `import "server-only"`，Node 测试环境解析不到该包；
// 这里只为一个纯函数建模块，不是对被测代码的模拟。
vi.mock("server-only", () => ({}));

import { buildCommentTree } from "@/server/queries/comment";

type Row = {
  id: bigint;
  post_id: bigint;
  user_id: bigint | null;
  parent_id: bigint | null;
  author_name: string | null;
  content: string;
  status: number;
  avatar_url: string | null;
  created_at: Date;
  user: { username: string | null } | null;
};

function row(id: number, parentId: number | null, extra: Partial<Row> = {}): Row {
  return {
    id: BigInt(id),
    post_id: 1n,
    user_id: null,
    parent_id: parentId === null ? null : BigInt(parentId),
    author_name: `user${id}`,
    content: `content ${id}`,
    status: 1,
    avatar_url: null,
    created_at: new Date(`2026-01-0${(id % 9) + 1}T00:00:00.000Z`),
    user: null,
    ...extra,
  };
}

describe("buildCommentTree", () => {
  it("顶层评论按原顺序成为根节点", () => {
    const tree = buildCommentTree([row(1, null), row(2, null)]);
    expect(tree.map((c) => c.id)).toEqual([1, 2]);
    expect(tree.every((c) => c.replies?.length === 0)).toBe(true);
  });

  it("父评论在集合内时挂到 replies 下，且不作为根重复出现", () => {
    const tree = buildCommentTree([row(1, null), row(2, 1), row(3, 1)]);
    expect(tree.map((c) => c.id)).toEqual([1]);
    expect(tree[0].replies?.map((c) => c.id)).toEqual([2, 3]);
    expect(tree[0].replies?.[0].parent_id).toBe(1);
  });

  it("父评论不在集合内（未审核/已驳回）时提升为根，而不是被静默丢弃", () => {
    // 2 是 99 的回复，而 99 未通过审核 → 不在 status = 1 的集合里。
    const tree = buildCommentTree([row(1, null), row(2, 99)]);
    expect(tree.map((c) => c.id)).toEqual([1, 2]);
    expect(tree[1].parent_id).toBe(99);
    const total = tree.reduce(
      (acc, c) => acc + 1 + (c.replies?.length ?? 0),
      0,
    );
    expect(total).toBe(2); // 没有任何评论消失
  });

  it("全部评论都是孤儿时全部保留为根节点", () => {
    const tree = buildCommentTree([row(5, 100), row(6, 200)]);
    expect(tree.map((c) => c.id)).toEqual([5, 6]);
  });

  it("BigInt 与 Date 被序列化为 number 与 ISO 字符串", () => {
    const tree = buildCommentTree([row(7, null, { user: { username: "alice" } })]);
    expect(tree[0].id).toBe(7);
    expect(tree[0].post_id).toBe(1);
    expect(typeof tree[0].created_at).toBe("string");
    expect(tree[0].created_at).toBe("2026-01-08T00:00:00.000Z");
    expect(tree[0].user).toEqual({ username: "alice" });
    expect(tree[0].replies).toEqual([]);
  });

  it("user_id 为 0n 之外的假值时按 null 处理，不产生 NaN", () => {
    const tree = buildCommentTree([row(8, null, { user_id: null })]);
    expect(tree[0].user_id).toBeNull();
    expect(tree[0].parent_id).toBeNull();
  });

  it("空输入返回空数组", () => {
    expect(buildCommentTree([])).toEqual([]);
  });
});
