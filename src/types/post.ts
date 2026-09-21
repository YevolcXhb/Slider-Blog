export interface Post {
  id: number;
  slug: string;
  locale: string;
  title: string;
  content_mdx: string;
  excerpt: string | null;
  status: number;
  user_id: number;
  category_id: number | null;
  view_count: number;
  cover_image?: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
  tags?: Tag[];
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  _count?: { posts: number };
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  _count?: { posts: number };
}

// 公开评论类型：这是 GET/POST /api/comments 直接序列化返回、以及评论区渲染所用的形状。
// 严禁在此加入 author_email：评论邮箱只属于服务端内部数据（仅管理端页面与驳回邮件
// 通知按需自取），一旦进入本类型就必然随公开 JSON 响应泄露给任何未登录访客。
export interface Comment {
  id: number;
  post_id: number;
  user_id: number | null;
  parent_id: number | null;
  author_name: string | null;
  content: string;
  status: number;
  avatar_url: string | null;
  created_at: string;
  replies?: Comment[];
  user?: { username: string | null } | null;
}

export interface User {
  id: number;
  username: string | null;
  email: string;
  role: number;
  created_at: string;
}

export interface Dynamic {
  id: number;
  content: string;
  images: string[] | null;
  is_pinned: number;
  likes: number;
  status: number;
  created_at: string;
}

export interface GalleryPhoto {
  id: number;
  url: string;
  thumbnail: string | null;
  title: string | null;
  description: string | null;
  album_id: number | null;
  taken_at: string | null;
}

export interface GalleryAlbum {
  id: number;
  name: string;
  description: string | null;
  cover: string | null;
  photos?: GalleryPhoto[];
}
