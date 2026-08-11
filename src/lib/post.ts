export function estimateReadTime(content: string): number {
  // 与 estimateWords 使用同一份"可读正文"（去掉代码块/行内代码/空白），
  // 按约 400 字/分钟估算，避免把 Markdown 标记和代码也计入阅读时长。
  const text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\s+/g, "")
  const minutes = Math.round(text.length / 400)
  return Math.max(1, minutes)
}

export function estimateWords(content: string): number {
  const text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || []
  const englishChars = text.match(/[a-zA-Z]/g) || []
  return chineseChars.length + englishChars.length
}
