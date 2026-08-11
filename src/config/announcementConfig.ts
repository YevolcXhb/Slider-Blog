import type { AnnouncementConfig } from "@/types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
  title: "公告",
  content: "欢迎来到 Slider Blog！这里记录技术、生活与思考。",
  link: {
    enable: true,
    text: "了解更多",
    url: "/about",
    external: false,
  },
  closable: true,
};
