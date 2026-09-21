import { GitBranch, Mail, Globe, User, IdCard } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import type { SidebarProfile } from "@/server/queries/site";

interface ProfileCardProps {
  profile: SidebarProfile;
}

function ProfileCard({ profile }: ProfileCardProps) {
  const t = useTranslations("Nav");
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    github: GitBranch,
    email: Mail,
    globe: Globe,
  };

  return (
    <div className="card-base onload-animation p-3">
      <Link
        href="/about"
        aria-label={t("about")}
        className="group relative mx-auto mt-1 mb-3 block max-w-48 overflow-hidden rounded-xl active:scale-95 lg:mx-0 lg:mt-0 lg:max-w-none"
      >
        <div className="pointer-events-none absolute z-10 flex h-full w-full items-center justify-center transition group-hover:bg-black/30 group-active:bg-black/50">
          <IdCard className="size-12 scale-90 text-white opacity-0 transition group-hover:scale-100 group-hover:opacity-100" />
        </div>
        {profile.avatar ? (
          <Image
            src={profile.avatar}
            alt={profile.name}
            width={350}
            height={350}
            className="mx-auto aspect-square h-full object-cover transition-transform duration-300 group-hover:scale-105 lg:mt-0 lg:w-full"
          />
        ) : (
          <div className="to-frost-400 flex aspect-square items-center justify-center bg-gradient-to-br from-pink-400">
            <User className="size-20 text-white/80" />
          </div>
        )}
      </Link>

      <div className="px-2 pb-2">
        <div className="text-foreground mb-1 text-center text-xl font-bold transition">
          {profile.name}
        </div>
        <div className="mx-auto mb-2 h-1 w-5 rounded-full bg-[var(--primary)] transition" />
        <div className="text-muted-foreground mb-2.5 text-center text-sm leading-relaxed transition">
          {profile.bio}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {profile.socialLinks.map((link) => {
            const Icon = iconMap[link.icon] || GitBranch;
            const showName = link.name.length <= 6;
            return (
              <Link
                key={link.name}
                href={link.url}
                target={link.url.startsWith("http") ? "_blank" : undefined}
                rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className={`btn-regular h-10 rounded-lg active:scale-95 ${showName ? "gap-2 px-3 font-bold" : "w-10"}`}
                aria-label={link.name}
              >
                <Icon className="size-5" />
                {showName && link.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { ProfileCard };
export default ProfileCard;
