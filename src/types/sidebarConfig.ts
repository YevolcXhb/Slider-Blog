export type SidebarPosition = "left" | "right" | "bottom";
export type ComponentPosition = "top" | "sticky";

export type WidgetType =
  | "profile"
  | "announcement"
  | "categories"
  | "tags"
  | "stats"
  | "siteInfo"
  | "calendar"
  | "music"
  | "dynamic"
  | "advertisement"
  | "sidebarToc";

export interface WidgetSpecificConfig {
  collapseThreshold?: number;
  dynamic?: {
    limit?: number;
  };
  siteInfo?: {
    unknownBuildPlatform?: string;
  };
  calendar?: {
    showHeatmap?: boolean;
  };
  ad?: {
    title?: string;
    content?: string;
    image?: {
      src: string;
      alt?: string;
      link?: string;
      external?: boolean;
    };
    link?: {
      text: string;
      url: string;
      external?: boolean;
    };
    closable?: boolean;
    displayCount?: number;
    padding?: {
      all?: string;
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    expireDate?: string;
  };
}

export interface BaseComponentConfig {
  type: WidgetType;
  enable: boolean;
  showTitle?: boolean;
  specificConfig?: WidgetSpecificConfig;
  showOnPostPage?: boolean;
  hideOnNonPostPage?: boolean;
}

export interface WidgetComponentConfig extends BaseComponentConfig {
  position?: ComponentPosition;
}

export type MobileBottomComponentConfig = BaseComponentConfig;

export interface SidebarLayoutConfig {
  enable: boolean;
  position: "left" | "right" | "both";
  tabletSidebar: "left" | "right";
  hideSidebarOnPostPage: boolean;
  showBothSidebarsOnPostPage: boolean;
  leftComponents: WidgetComponentConfig[];
  rightComponents: WidgetComponentConfig[];
  mobileBottomComponents: MobileBottomComponentConfig[];
}
