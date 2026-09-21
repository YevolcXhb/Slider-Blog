import Image from "next/image";
import { Link } from "@/i18n/routing";
import { IdCard, User, GitBranch, Mail, Globe, Link2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { profileConfig } from "@/config/profileConfig";
import type { SidebarProfile } from "@/server/queries/site";

interface ProfileWidgetProps {
  profile?: SidebarProfile;
  className?: string;
  style?: React.CSSProperties;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  github: GitBranch,
  mail: Mail,
  email: Mail,
  envelope: Mail,
  globe: Globe,
  link: Link2,
};

function encodeEmailForProfile(email: string): string {
  if (typeof window === "undefined") return "";
  try {
    return window.btoa(email);
  } catch {
    return "";
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
  };

  const links =
    displayProfile.socialLinks.length > 0
      ? displayProfile.socialLinks
      : profileConfig.links.map((l) => ({
          name: l.name,
          url: l.url,
          icon: l.icon,
          showName: l.showName,
        }));

  const hasMultipleLinks = links.length > 1;
  const singleLink = links.length === 1 ? links[0] : null;

  function renderLink(item: (typeof links)[number]) {
    const showName = item.showName ?? item.name.length <= 6;
    const Icon = iconMap[item.icon.toLowerCase()] || Link2;
    const isMail = item.url.startsWith("mailto:");
    const classNames = cn(
      "btn-regular rounded-lg h-10 active:scale-95",
      showName ? "gap-2 px-3 font-bold" : "w-10",
    );

    if (isMail) {
      const encodedEmail = encodeEmailForProfile(item.url.replace("mailto:", ""));
      return (
        <a
          key={item.name}
          rel="me"
          aria-label={item.name}
          href="#"
          data-encoded-email={encodedEmail}
          className={classNames}
          onClick={(e) => {
            e.preventDefault();
            const target = e.currentTarget;
            const encoded = target.getAttribute("data-encoded-email");
            if (!encoded) return;
            try {
              const decoded = window.atob(encoded);
              target.href = `mailto:${decoded}`;
              target.removeAttribute("data-encoded-email");
              target.click();
            } catch {
              // ignore decoding errors
            }
          }}
        >
          <Icon className="size-5" />
          {showName && item.name}
        </a>
      );
    }

    const isExternal = item.url.startsWith("http");
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
    );
  }

  return (
    <div className={cn("card-base p-3", className)} style={style}>
      <Link
        href="/about"
        aria-label="Go to About Page"
        className="group relative mx-auto mt-1 mb-3 block max-w-48 overflow-hidden rounded-xl active:scale-95 lg:mx-0 lg:mt-0 lg:max-w-none"
      >
        <div className="pointer-events-none absolute z-10 flex h-full w-full items-center justify-center transition group-hover:bg-black/30 group-active:bg-black/50">
          <IdCard className="scale-90 text-5xl text-white opacity-0 transition group-hover:scale-100 group-hover:opacity-100" />
        </div>
        {displayProfile.avatar ? (
          <Image
            src={displayProfile.avatar}
            alt={`Profile Image of ${displayProfile.name}`}
            width={350}
            height={350}
            className="profile-avatar-image mx-auto aspect-square h-full object-cover lg:mt-0 lg:w-full"
            priority
          />
        ) : (
          <div className="to-frost-400 flex aspect-square items-center justify-center bg-gradient-to-br from-pink-400">
            {/* 保留白字：头像占位块是 from-pink-400 to-frost-400 饱和渐变，white/80 在两种主题下都清晰 */}
            <User className="size-20 text-white/80" />
          </div>
        )}
      </Link>

      <div className="px-2">
        <div className="mb-1 text-center text-xl font-bold transition dark:text-neutral-50">
          {displayProfile.name}
        </div>
        <div className="mx-auto mb-2 h-1 w-5 rounded-full bg-[var(--primary)] transition" />
        <div className="mb-2.5 text-center text-neutral-400 transition">{displayProfile.bio}</div>

        <div className="mb-1 flex flex-wrap justify-center gap-2">
          {hasMultipleLinks ? links.map(renderLink) : singleLink ? renderLink(singleLink) : null}
        </div>
      </div>
    </div>
  );
}

export { ProfileWidget, type ProfileWidgetProps };
export default ProfileWidget;
