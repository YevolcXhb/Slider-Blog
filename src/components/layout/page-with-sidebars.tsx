import { LeftSidebar } from "@/components/sidebar/left-sidebar"
import { RightSidebar } from "@/components/sidebar/right-sidebar"

interface PageWithSidebarsProps {
  children: React.ReactNode
  hasBanner?: boolean
}

async function PageWithSidebars({ children, hasBanner = false }: PageWithSidebarsProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[1400px] px-3 ${
        hasBanner ? "-mt-14 relative z-30 pt-0" : "py-4"
      } md:px-4 md:py-6`}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_260px] lg:gap-6">
        <aside className="hidden md:block">
          <div className="sticky top-[var(--navbar-height)] space-y-4">
            <LeftSidebar />
          </div>
        </aside>
        <div className="min-w-0 space-y-4">{children}</div>
        <aside className="hidden lg:block">
          <div className="sticky top-[var(--navbar-height)] space-y-4">
            <RightSidebar />
          </div>
        </aside>
      </div>
    </div>
  )
}

export { PageWithSidebars }
export default PageWithSidebars
