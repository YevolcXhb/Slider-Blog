/**
 * 从音乐 URL 文件名解析歌曲信息
 *
 * 约定文件名格式："{歌名}-{艺术家}.mp3"
 * 例如 "Love Song-YOSHE1.mp3" → { title: "Love Song", artist: "YOSHE1" }
 *
 * 如果没有 "-"，则整个文件名作为 title，artist 为空字符串
 *
 * @param url 音乐文件的 URL
 * @returns 解析出的 title 和 artist
 */
export function parseMusicInfoFromUrl(url: string): {
  title: string
  artist: string
} {
  try {
    const u = new URL(url)
    const last = u.pathname.split("/").pop() || ""
    const withoutExt = last.replace(/\.[^.]+$/, "")
    const decoded = decodeURIComponent(withoutExt)

    const dashIdx = decoded.indexOf("-")
    if (dashIdx > 0) {
      return {
        title: decoded.slice(0, dashIdx).trim(),
        artist: decoded.slice(dashIdx + 1).trim(),
      }
    }
    return {
      title: decoded.trim(),
      artist: "",
    }
  } catch {
    return { title: "", artist: "" }
  }
}
