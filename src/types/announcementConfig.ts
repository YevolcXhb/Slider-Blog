export interface AnnouncementConfig {
  title?: string;
  content: string;
  link?: {
    enable?: boolean;
    text: string;
    url: string;
    external?: boolean;
  };
  closable?: boolean;
}
