import path from "node:path";
import { promises as fs } from "node:fs";

import { resolveUploadDir } from "@/lib/upload-dir";

/**
 * 删除一条已入库的上传文件（按它在数据库里的 URL）。
 *
 * 【为什么需要】此前删除文章 / 相册 / 照片只做 prisma 删除，public/uploads/ 下的
 * 文件永久残留。这不只是磁盘泄漏 —— 文件名是 UUID 且读路由不带鉴权，
 * 已“删除”的内容仍能通过原 URL 取到，与删除语义矛盾。
 *
 * 【安全边界】只处理本地上传目录内的文件：
 *   1. 非字符串 / 空串 / 外部 URL 一律忽略 —— 数据库里存在外链图片，
 *      绝不能去删除别人的资源；
 *   2. 只接受 urlPrefix 开头的路径（默认 /uploads/）；
 *   3. 解析成绝对路径后必须仍在 uploads 根之内，否则忽略。
 *
 * 【失败语义】任何异常都吞掉。删除文件是「删除内容」的副作用，
 * 文件不存在 / 被占用 / 权限不足都不应让管理端的删除操作失败。
 */
export async function deleteUploadedFileByUrl(
  url: string | null | undefined,
): Promise<void> {
  if (typeof url !== "string") return;
  const trimmed = url.trim();
  if (!trimmed) return;

  let uploadRoot: string;
  let urlPrefix: string;
  try {
    ({ absoluteDir: uploadRoot, urlPrefix } = resolveUploadDir());
  } catch {
    return;
  }

  // 去掉查询串 / 哈希，避免 /uploads/a.webp?v=2 这类地址漏删
  const cleanPath = trimmed.split("?")[0].split("#")[0];
  if (!cleanPath.startsWith(urlPrefix + "/")) return;

  const relative = cleanPath.slice(urlPrefix.length + 1);
  if (!relative) return;

  const absolutePath = path.resolve(uploadRoot, relative);
  const rel = path.relative(uploadRoot, absolutePath);
  if (rel === "" || path.isAbsolute(rel) || rel.split(path.sep)[0] === "..") {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch {
    // 文件不存在 / 被占用 / 权限不足：忽略
  }
}

/**
 * 批量删除，去重后串行执行，避免瞬时大量并发 unlink。
 */
export async function deleteUploadedFilesByUrl(
  urls: readonly (string | null | undefined)[],
): Promise<void> {
  const seen = new Set<string>();
  for (const url of urls) {
    if (typeof url !== "string") continue;
    if (seen.has(url)) continue;
    seen.add(url);
    await deleteUploadedFileByUrl(url);
  }
}
