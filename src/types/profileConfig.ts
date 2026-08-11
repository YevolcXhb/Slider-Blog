export interface ProfileLink {
  name: string;
  icon: string;
  url: string;
  showName?: boolean;
}

export interface ProfileConfig {
  avatar: string;
  name: string;
  bio: string;
  links: ProfileLink[];
}
