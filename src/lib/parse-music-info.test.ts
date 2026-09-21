/**
 * parse-music-info.ts 单元测试（F3）。
 *
 * 文件名约定："{歌名}-{艺术家}.mp3"。解析失败（非 URL / 无法处理）
 * 必须静默返回空 title/artist，不抛异常。
 */
import { describe, expect, it } from "vitest";

import { parseMusicInfoFromUrl } from "@/lib/parse-music-info";

describe("parseMusicInfoFromUrl", () => {
  it("解析标准文件名 {歌名}-{艺术家}.mp3", () => {
    expect(parseMusicInfoFromUrl("https://cdn.example.com/music/Love Song-YOSHE1.mp3")).toEqual({
      title: "Love Song",
      artist: "YOSHE1",
    });
  });

  it("支持中文歌名与艺术家", () => {
    expect(parseMusicInfoFromUrl("https://example.com/夜曲-周杰伦.mp3")).toEqual({
      title: "夜曲",
      artist: "周杰伦",
    });
  });

  it("支持多级路径，只取最后一段", () => {
    expect(parseMusicInfoFromUrl("https://example.com/a/b/c/Title-Artist.flac")).toEqual({
      title: "Title",
      artist: "Artist",
    });
  });

  it("没有短横线时整个文件名作为 title，artist 为空串", () => {
    expect(parseMusicInfoFromUrl("https://example.com/JustATitle.mp3")).toEqual({
      title: "JustATitle",
      artist: "",
    });
    expect(parseMusicInfoFromUrl("https://example.com/中文歌名.mp3")).toEqual({
      title: "中文歌名",
      artist: "",
    });
  });

  it("短横线位于开头时不视作分隔符", () => {
    expect(parseMusicInfoFromUrl("https://example.com/-leading.mp3")).toEqual({
      title: "-leading",
      artist: "",
    });
  });

  it("只按第一个短横线切分，保留艺术家中的短横线", () => {
    expect(parseMusicInfoFromUrl("https://example.com/Song-A-B-C.mp3")).toEqual({
      title: "Song",
      artist: "A-B-C",
    });
  });

  it("去除切分后的首尾空白", () => {
    expect(parseMusicInfoFromUrl("https://example.com/Song%20-%20Artist.mp3")).toEqual({
      title: "Song",
      artist: "Artist",
    });
  });

  it("解码 URL 编码的文件名", () => {
    expect(
      parseMusicInfoFromUrl(
        "https://example.com/%E5%A4%9C%E6%9B%B2-%E5%91%A8%E6%9D%B0%E4%BC%A6.mp3",
      ),
    ).toEqual({
      title: "夜曲",
      artist: "周杰伦",
    });
  });

  it("支持带查询串的 URL", () => {
    expect(parseMusicInfoFromUrl("https://example.com/Song-Artist.mp3?v=2")).toEqual({
      title: "Song",
      artist: "Artist",
    });
  });

  it("只去掉最后一段扩展名（多扩展名时保留中间段）", () => {
    expect(parseMusicInfoFromUrl("https://example.com/Song-Artist.mp3.ogg")).toEqual({
      title: "Song",
      artist: "Artist.mp3",
    });
  });

  it("无扩展名时按整段解析", () => {
    expect(parseMusicInfoFromUrl("https://example.com/Song-Artist")).toEqual({
      title: "Song",
      artist: "Artist",
    });
  });

  it("非 URL 输入返回空对象字段", () => {
    expect(parseMusicInfoFromUrl("not a url")).toEqual({ title: "", artist: "" });
    expect(parseMusicInfoFromUrl("")).toEqual({ title: "", artist: "" });
    expect(parseMusicInfoFromUrl("/music/Song-Artist.mp3")).toEqual({
      title: "",
      artist: "",
    });
  });

  it("URL 以斜杠结尾时返回空 title", () => {
    expect(parseMusicInfoFromUrl("https://example.com/music/")).toEqual({
      title: "",
      artist: "",
    });
  });

  it("非法百分号编码不抛错", () => {
    expect(() => parseMusicInfoFromUrl("https://example.com/%E0%A4%A.mp3")).not.toThrow();
    expect(parseMusicInfoFromUrl("https://example.com/%E0%A4%A.mp3")).toEqual({
      title: "",
      artist: "",
    });
  });

  it("返回值恒为字符串字段", () => {
    const result = parseMusicInfoFromUrl("https://example.com/A-B.mp3");
    expect(typeof result.title).toBe("string");
    expect(typeof result.artist).toBe("string");
  });
});
