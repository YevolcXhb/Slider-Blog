import type { SiteConfig } from "@/types/siteConfig";

const SITE_LANG = "zh_CN";

export const siteConfig: SiteConfig = {
  title: "Slider Blog",
  subtitle: "记录技术、生活与思考",
  site_url: "https://slider-blog.example.com",
  description: "一个基于 Next.js 构建的清新美观的个人博客。",
  keywords: ["Next.js", "React", "Blog", "Slider Blog"],
  themeColor: {
    hue: 160,
    defaultMode: "system",
  },
  pageWidth: 100,
  card: {
    border: false,
    followTheme: false,
  },
  favicon: [
    {
      src: "/favicon.ico",
    },
  ],
  navbar: {
    logo: {
      type: "icon",
      value: "home",
      alt: "Slider Blog",
    },
    title: "Slider Blog",
    widthFull: false,
    menuAlign: "center",
    followTheme: false,
    stickyNavbar: true,
  },
  siteStartDate: "2025-01-01",
  timezone: "Asia/Shanghai",
  pages: {
    guestbook: false,
    gallery: true,
    dynamic: true,
  },
  categoryBar: true,
  foldArticle: true,
  postListLayout: {
    defaultMode: "list",
    mobileDefaultMode: "grid",
    descriptionLines: 2,
    showStatsIcons: true,
    tagsPosition: "bottom",
    meta: {
      showPublished: true,
      showCategory: true,
      showTags: true,
      tagCount: 5,
      showWords: false,
      showReadingTime: false,
    },
    stats: {
      showPublished: true,
      showWords: true,
      showReadingTime: true,
    },
    grid: {
      masonry: false,
      columnWidth: 320,
    },
  },
  post: {
    rehypeCallouts: {
      theme: "github",
      enablePythonMarkdownAdmonitions: false,
    },
    showLastModified: true,
    outdatedThreshold: 30,
    sharePoster: false,
    generateOgImages: false,
  },
  pagination: {
    postsPerPage: 10,
  },
  imageOptimization: {
    formats: "webp",
    quality: 85,
    noReferrerDomains: [],
  },
  lang: SITE_LANG,
};
