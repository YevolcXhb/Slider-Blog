import path from "node:path";
import { promises as fs } from "node:fs";

/**
 * 上传目录解析（叶子模块，只依赖 node:path / node:fs）。
 *
 * 从 src/lib/upload.ts 抽出：/uploads/** 的读取路由也需要同一套路径校验，
 * 而那个模块 import 了 sharp（原生依赖）。把纯路径逻辑放在这里，
 * 读取路由就不必把 sharp 拖进自己的 bundle。
 */

// 收集所有"不允许上传目录落在其中"的目录：从 <cwd>/public 一路向上回溯到
// 文件系统根（<cwd>/public、<cwd>、各级父目录、盘符根）。
// 上传目录只要等于其中任意一个或落在其内部，就会把图片写进被静态服务的目录
// 之外（甚至整个文件系统），因此必须拒绝；唯一例外是 <cwd>/public 自身的
// 子目录，由 resolveUploadDir 里的 path.relative 判断放行。
function collectProtectedDirs(publicDir: string): string[] {
  let dir = publicDir;
  const protectedDirs: string[] = [];
  for (;;) {
    protectedDirs.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return protectedDirs;
}

// 上传目录解析结果：绝对物理路径（写盘/读盘用）+ 相对 URL 前缀（入库用）。
export interface ResolvedUploadDir {
  absoluteDir: string;
  urlPrefix: string;
}

// 判断 dir 是否位于 base（含 base 本身）之外或与之重合。
// 注意相对路径解析不到时必须显式拦截：Windows 下不同盘符（C: 与 D:）
// 之间 path.relative 会返回绝对路径而非 "..\"，只看 ".." 前缀会漏判。
export function isOutsideOrEqual(base: string, dir: string): boolean {
  const relative = path.relative(base, dir);
  return (
    relative === "" ||
    path.isAbsolute(relative) ||
    relative.split(path.sep)[0] === ".."
  );
}

/**
 * 把（相对 cwd 或绝对形式的）上传目录解析成绝对路径，并保证：
 *   1. 配置本身不能是裸相对路径，否则进程工作目录一变就会写到别处（部署误伤）；
 *   2. 结果必须位于 <cwd>/public 之下，否则 /uploads/xxx 无法被访问；
 *   3. 结果既不能等于 <cwd>/public 或它的任意上级目录（否则图片会被写进
 *      public/ 根、项目根甚至整个文件系统）。
 * 任一条件不满足就抛错拒绝，避免配置错误导致越权落盘。
 */
export function resolveUploadDir(): ResolvedUploadDir {
  const publicDir = path.resolve(process.cwd(), "public");
  const configured = (process.env.UPLOAD_DIR ?? "").trim();

  if (configured && !path.isAbsolute(configured)) {
    throw new Error(
      `UPLOAD_DIR must be an absolute path (e.g. /app/public/uploads), got: ${configured}`,
    );
  }

  const targetDir = configured || path.join(publicDir, "uploads");

  if (isOutsideOrEqual(publicDir, targetDir)) {
    throw new Error(
      `UPLOAD_DIR must point to a subdirectory of ${publicDir}, got: ${targetDir}`,
    );
  }

  // 同根校验：跨盘符（Windows C:/D:）时 path.relative 无法判断包含关系，
  // 必须先拒绝，否则会拿到形如 /D:/data/uploads 的非法 URL 前缀。
  for (const protectedDir of collectProtectedDirs(publicDir)) {
    if (path.parse(protectedDir).root !== path.parse(targetDir).root) {
      throw new Error(
        `UPLOAD_DIR resolves to ${targetDir}, which is outside the filesystem root of ${protectedDir}`,
      );
    }
    if (isOutsideOrEqual(protectedDir, targetDir)) {
      throw new Error(
        `UPLOAD_DIR resolves to ${targetDir}, which would overlap a statically served directory`,
      );
    }
  }

  const relativeToPublic = path.relative(publicDir, targetDir);
  // 手写 "/" 拼接而非 path.join：URL 必须始终使用正斜杠
  return {
    absoluteDir: targetDir,
    urlPrefix: `/${relativeToPublic.split(path.sep).join("/")}`,
  };
}

/**
 * 符号链接 / junction / 8.3 短名逃逸防护（读取路由专用）。
 *
 * 背景（实测，Windows + 生产构建）：
 *   public/uploads/__junc  -> Junction 指向 <projectRoot>
 *   GET /uploads/__junc/package.json        -> 200，返回项目 package.json
 *   GET /uploads/__junc/../ 经盘符 junction -> 200，返回 C:\Windows\win.ini
 *
 * 原因：上面的 `isOutsideOrEqual(uploadRoot, absolutePath)` 只做**词法**比较，
 * 而 fs.stat / fs.readFile 都会跟随链接。只要 uploads 根目录下存在一个指向
 * 外部的链接（junction 在 Windows 下无需管理员权限即可创建），词法校验就
 * 完全失效。
 *
 * 该函数用 fs.realpath 解析后的**真实路径**重新做一次包含判断，
 * 从而把链接逃逸挡在读取之前。
 *
 * @returns true 表示链接解析后的目标仍在 root 之内，可以安全读取
 */
export async function isRealPathInside(root: string, candidate: string): Promise<boolean> {
  // root 自身也要 realpath：部署时 public/uploads 本身可能就是链接
  // （例如挂载到数据盘），此时必须用真实根做基准，否则会误判全部合法请求。
  let realRoot: string;
  let realCandidate: string;
  try {
    [realRoot, realCandidate] = await Promise.all([
      fs.realpath(root),
      fs.realpath(candidate),
    ]);
  } catch {
    // 任一环节不存在 / 不可解析 -> 交给调用方按 404 处理
    return false;
  }
  return !isOutsideOrEqual(realRoot, realCandidate);
}