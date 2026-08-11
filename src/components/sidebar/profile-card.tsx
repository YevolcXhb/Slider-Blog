import { GitBranch, Mail, Globe, User, IdCard } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

import type { SidebarProfile } from "@/server/queries/site"

interface ProfileCardProps {
  profile: SidebarProfile
}

function ProfileCard({ profile }: ProfileCardProps) {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    github: GitBranch,
    email: Mail,
    globe: Globe,
  }

  return (
    <div className="card-base onload-animation p-3">
      <Link
        href="/about"
        aria-label="关于我"
        className="group block relative mx-auto mt-1 lg:mx-0 lg:mt-0 mb-3 max-w-48 lg:max-w-none overflow-hidden rounded-xl active:scale-95"
      >
        <div className="absolute transition pointer-events-none group-hover:bg-black/30 group-active:bg-black/50 w-full h-full z-10 flex items-center justify-center">
          <IdCard className="transition opacity-0 scale-90 group-hover:scale-100 group-hover:opacity-100 text-white size-12" />
        </div>
        {profile.avatar ? (
          <Image
            src={profile.avatar}
            alt={profile.name}
            width={350}
            height={350}
            className="mx-auto lg:w-full h-full lg:mt-0 object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-pink-400 to-frost-400">
            <User className="size-20 text-white/80" />
          </div>
        )}
      </Link>

      <div className="px-2 pb-2">
        <div className="font-bold text-xl text-center mb-1 text-foreground transition">
          {profile.name}
        </div>
        <div className="h-1 w-5 bg-[var(--primary)] mx-auto rounded-full mb-2 transition" />
        <div className="text-center text-muted-foreground mb-2.5 transition text-sm leading-relaxed">
          {profile.bio}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {profile.socialLinks.map((link) => {
            const Icon = iconMap[link.icon] || GitBranch
            const showName = link.name.length <= 6
            return (
              <Link
                key={link.name}
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`btn-regular rounded-lg h-10 active:scale-95 ${showName ? "gap-2 px-3 font-bold" : "w-10"}`}
                aria-label={link.name}
              >
                <Icon className="size-5" />
                {showName && link.name}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { ProfileCard }
export default ProfileCard
