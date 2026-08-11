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

export interface Comment {
  id: number;
  post_id: number;
  user_id: number | null;
  parent_id: number | null;
  author_name: string | null;
  author_email: string | null;
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
