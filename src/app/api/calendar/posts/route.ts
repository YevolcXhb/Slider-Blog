import { NextResponse } from "next/server"

import { getPublishedPostsForArchive } from "@/server/queries/post"
import { safeDbQuery } from "@/lib/safe-db"

export const revalidate = 300

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") || "zh"

  const posts = await safeDbQuery(() => getPublishedPostsForArchive(locale), [])

  return NextResponse.json(
    posts.map((post) => ({
      id: post.id,
      title: post.title,
      published: post.publishedAt,
      slug: post.slug,
      locale: post.locale,
      url: `/${post.locale}/blog/${post.slug}`,
    })),
  )
}
