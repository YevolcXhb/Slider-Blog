export interface SiteConfig {
  title: string;
  subtitle: string;
  site_url: string;
  description: string;
  keywords: string[];
  themeColor: {
    hue: number;
    defaultMode: "light" | "dark" | "system";
  };
  pageWidth: number;
  card: {
    border: boolean;
    followTheme: boolean;
  };
  favicon: Array<{
    src: string;
    theme?: string;
    sizes?: string;
  }>;
  navbar: {
    logo: {
      type: string;
      value: string;
      alt?: string;
    };
    title: string;
    widthFull: boolean;
    menuAlign: "left" | "center";
    followTheme: boolean;
    stickyNavbar: boolean;
  };
  siteStartDate: string;
  timezone: string;
  pages: {
    guestbook: boolean;
    gallery: boolean;
    dynamic: boolean;
  };
  categoryBar: boolean;
  foldArticle: boolean;
  postListLayout: {
    defaultMode: "list" | "grid";
    mobileDefaultMode: "list" | "grid";
    descriptionLines: number;
    showStatsIcons: boolean;
    tagsPosition: "meta" | "bottom";
    meta: {
      showPublished: boolean;
      showCategory: boolean;
      showTags: boolean;
      tagCount: number;
      showWords: boolean;
      showReadingTime: boolean;
    };
    stats: {
      showPublished: boolean;
      showWords: boolean;
      showReadingTime: boolean;
    };
    grid: {
      masonry: boolean;
      columnWidth: number;
    };
  };
  post: {
    rehypeCallouts: {
      theme: string;
      enablePythonMarkdownAdmonitions: boolean;
    };
    showLastModified: boolean;
    outdatedThreshold: number;
    sharePoster: boolean;
    generateOgImages: boolean;
  };
  pagination: {
    postsPerPage: number;
  };
  imageOptimization: {
    formats: "avif" | "webp" | "both";
    quality: number;
    noReferrerDomains: string[];
  };
  lang: string;
}
