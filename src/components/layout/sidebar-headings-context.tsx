"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"

export interface SidebarHeading {
  slug: string
  text: string
  depth: number
}

interface SidebarHeadingsContextValue {
  headings: SidebarHeading[]
  encrypted: boolean
  setHeadings: (headings: SidebarHeading[]) => void
  setEncrypted: (encrypted: boolean) => void
}

const SidebarHeadingsContext = createContext<SidebarHeadingsContextValue>({
  headings: [],
  encrypted: false,
  setHeadings: () => {},
  setEncrypted: () => {},
})

interface SidebarHeadingsProviderProps {
  children: ReactNode
  headings?: SidebarHeading[]
  encrypted?: boolean
}

function SidebarHeadingsProvider({
  children,
  headings: initialHeadings = [],
  encrypted: initialEncrypted = false,
}: SidebarHeadingsProviderProps) {
  const [headings, setHeadings] = useState<SidebarHeading[]>(initialHeadings)
  const [encrypted, setEncrypted] = useState<boolean>(initialEncrypted)

  return (
    <SidebarHeadingsContext.Provider
      value={{ headings, encrypted, setHeadings, setEncrypted }}
    >
      {children}
    </SidebarHeadingsContext.Provider>
  )
}

function useSidebarHeadings() {
  return useContext(SidebarHeadingsContext)
}

export { SidebarHeadingsProvider, useSidebarHeadings }
export default SidebarHeadingsProvider
