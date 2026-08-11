"use client"

import { useEffect, type ReactNode } from "react"

import { useSidebarHeadings } from "@/components/layout/sidebar-headings-context"
import type { SidebarHeading } from "@/components/layout/sidebar-headings-context"

interface PostHeadingsProviderProps {
  children: ReactNode
  headings?: SidebarHeading[]
  encrypted?: boolean
}

function PostHeadingsProvider({
  children,
  headings,
  encrypted = false,
}: PostHeadingsProviderProps) {
  const { setHeadings, setEncrypted } = useSidebarHeadings()

  useEffect(() => {
    setHeadings(headings || [])
    setEncrypted(encrypted)

    return () => {
      setHeadings([])
      setEncrypted(false)
    }
  }, [headings, encrypted, setHeadings, setEncrypted])

  return <>{children}</>
}

export { PostHeadingsProvider }
export default PostHeadingsProvider
