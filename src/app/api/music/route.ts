import { NextResponse } from "next/server"

import { getMusicListWithAutoSync } from "@/server/queries/music-sync"
import { safeDbQuery } from "@/lib/safe-db"

export const revalidate = 300

export async function GET() {
  try {
    const musicList = await safeDbQuery(getMusicListWithAutoSync, [])
    return NextResponse.json(musicList)
  } catch (error) {
    console.error("Failed to fetch music list:", error)
    return NextResponse.json([], { status: 500 })
  }
}
