"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

interface SiteInfoCollapseProps {
  expandText: string
  collapseText: string
  children: React.ReactNode
}

function SiteInfoCollapse({ expandText, collapseText, children }: SiteInfoCollapseProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <div
        className={cn(
          "site-info-detail overflow-hidden transition-all duration-200 ease-out",
          !expanded && "collapsed",
        )}
        style={{ height: expanded ? "auto" : 0 }}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="site-info-toggle-btn btn-plain rounded-lg w-full h-8 flex items-center justify-center gap-1.5 mt-1 text-[var(--primary)] text-sm cursor-pointer"
        aria-expanded={expanded}
        aria-label={expanded ? collapseText : expandText}
        title={expanded ? collapseText : expandText}
      >
        <ChevronDown
          className={cn(
            "site-info-toggle-icon size-5 transition-transform duration-200",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
        <span className="site-info-toggle-text">
          {expanded ? collapseText : expandText}
        </span>
      </button>
    </div>
  )
}

export { SiteInfoCollapse }
export default SiteInfoCollapse
