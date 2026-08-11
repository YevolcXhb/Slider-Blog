import Image from "next/image"
import { Link } from "@/i18n/routing"
import { IdCard, User, GitBranch, Mail, Globe, Link2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { profileConfig } from "@/config/profileConfig"
import type { SidebarProfile } from "@/server/queries/site"

interface ProfileWidgetProps {
  profile?: SidebarProfile
  className?: string
  style?: React.CSSProperties
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  github: GitBranch,
  mail: Mail,
  email: Mail,
  envelope: Mail,
  globe: Globe,
  link: Link2,
}

function encodeEmailForProfile(email: string): string {
  if (typeof window === "undefined") return ""
  try {
    return window.btoa(email)
  } catch {
    return ""
  }
}

function ProfileWidget({ profile, className, style }: ProfileWidgetProps) {
  const displayProfile = profile || {
    name: profileConfig.name,
    avatar: profileConfig.avatar,
    bio: profileConfig.bio,
    location: "Internet",
    socialLinks: profileConfig.links.map((l) => ({
      name: l.name,
      url: l.url,
      icon: l.icon,
      showName: l.showName,
    })),
  }

  const links = displayProfile.socialLinks.length > 0
    ? displayProfile.socialLinks
    : profileConfig.links.map((l) => ({ name: l.name, url: l.url, icon: l.icon, showName: l.showName }))

  const hasMultipleLinks = links.length > 1
  const singleLink = links.length === 1 ? links[0] : null

  function renderLink(item: (typeof links)[number]) {
    const showName = item.showName ?? item.name.length <= 6
    const Icon = iconMap[item.icon.toLowerCase()] || Link2
    const isMail = item.url.startsWith("mailto:")
    const classNames = cn(
      "btn-regular rounded-lg h-10 active:scale-95",
      showName ? "gap-2 px-3 font-bold" : "w-10",
    )

    if (isMail) {
      const encodedEmail = encodeEmailForProfile(item.url.replace("mailto:", ""))
      return (
        <a
          key={item.name}
          rel="me"
          aria-label={item.name}
          href="#"
          data-encoded-email={encodedEmail}
          className={classNames}
          onClick={(e) => {
            e.preventDefault()
            const target = e.currentTarget
            const encoded = target.getAttribute("data-encoded-email")
            if (!encoded) return
            try {
              const decoded = window.atob(encoded)
              target.href = `mailto:${decoded}`
              target.removeAttribute("data-encoded-email")
              target.click()
            } catch {
              // ignore decoding errors
            }
          }}
        >
          <Icon className="size-5" />
          {showName && item.name}
        </a>
      )
    }

    const isExternal = item.url.startsWith("http")
    return (
      <a
        key={item.name}
        rel={isExternal ? "me noopener noreferrer" : "me"}
        aria-label={item.name}
        href={item.url}
        target={isExternal ? "_blank" : undefined}
        className={classNames}
      >
        <Icon className="size-5" />
        {showName && item.name}
      </a>
    )
  }

  return (
    <div className={cn("card-base p-3", className)} style={style}>
      <Link
        href="/about"
        aria-label="Go to About Page"
        className="group block relative mx-auto mt-1 lg:mx-0 lg:mt-0 mb-3 max-w-48 lg:max-w-none overflow-hidden rounded-xl active:scale-95"
      >
        <div className="absolute transition pointer-events-none group-hover:bg-black/30 group-active:bg-black/50 w-full h-full z-10 flex items-center justify-center">
          <IdCard className="transition opacity-0 scale-90 group-hover:scale-100 group-hover:opacity-100 text-white text-5xl" />
        </div>
        {displayProfile.avatar ? (
          <Image
            src={displayProfile.avatar}
            alt={`Profile Image of ${displayProfile.name}`}
            width={350}
            height={350}
            className="profile-avatar-image mx-auto lg:w-full h-full lg:mt-0 object-cover aspect-square"
            priority
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-pink-400 to-frost-400">
            <User className="size-20 text-white/80" />
          </div>
        )}
      </Link>

      <div className="px-2">
        <div className="font-bold text-xl text-center mb-1 dark:text-neutral-50 transition">
          {displayProfile.name}
        </div>
        <div className="h-1 w-5 bg-[var(--primary)] mx-auto rounded-full mb-2 transition" />
        <div className="text-center text-neutral-400 mb-2.5 transition">
          {displayProfile.bio}
        </div>

        <div className="flex flex-wrap gap-2 justify-center mb-1">
          {hasMultipleLinks ? links.map(renderLink) : singleLink ? renderLink(singleLink) : null}
        </div>
      </div>
    </div>
  )
}

export { ProfileWidget, type ProfileWidgetProps }
export default ProfileWidget
