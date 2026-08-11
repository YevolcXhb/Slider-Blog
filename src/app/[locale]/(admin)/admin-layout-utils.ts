/**
 * 检测 layout 源码中是否存在阻塞式的 auth() 调用。
 *
 * 仅匹配真实代码，跳过注释（// 行注释与块注释）。
 * 这是因为 layout 中的鉴权调用会让 Next.js 在跨页导航时
 * 重新执行整个 layout 的服务端代码，破坏 SPA 式客户端导航。
 */
export function hasBlockingRuntimeAccessInAdminLayout(source: string): boolean {
  // 移除块注释
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  // 按行处理，移除行注释后检测 await auth(
  const lines = withoutBlockComments.split(/\r?\n/);
  return lines.some((line) => {
    const codePart = line.split("//")[0] ?? line;
    return /await\s+auth\s*\(/.test(codePart);
  });
}

export function hasLoadingBoundaryForAdminPages(files: string[]): boolean {
  return files.some((file) => file.endsWith("loading.tsx"));
}
