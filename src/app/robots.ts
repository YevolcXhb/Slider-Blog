import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:4000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/posts/", "/comments/", "/manage-categories/", "/manage-moments/", "/manage-gallery/", "/manage-users/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
