import { GitBranch, Mail, MessageCircle } from "lucide-react";
import { siteConfig } from "@/config/slider-config";

interface FooterProps {
  /** 自定义页脚 HTML（对应 Slider FooterConfig.html） */
  customHtml?: string;
  /** 站点名称，未提供时默认 Slider Blog */
  siteName?: string;
  /** 备案号等自定义文本 */
  beian?: string;
}

const currentYear = new Date().getFullYear();

const socialLinks = [
  {
    name: "GitHub",
    url: "https://github.com/YevolcXhb",
    icon: GitBranch,
  },
  {
    name: "Email",
    url: "mailto:hello@example.com",
    icon: Mail,
  },
  {
    name: "QQ",
    url: "https://im.qq.com",
    icon: MessageCircle,
  },
];

function Footer({ customHtml = "", siteName = siteConfig.title, beian = "" }: FooterProps) {
  return (
    <>
      <div className="mx-4 my-10 border-t border-dashed border-black/10 transition md:mx-16 lg:mx-32 dark:border-white/15" />
      <div className="mb-12 flex flex-col items-center justify-center rounded-2xl border-dashed border-[oklch(85%_0.01_var(--hue))] px-6 transition dark:border-white/15">
        <div className="text-50 wrap text-center text-sm transition">
          {customHtml && <div className="mb-2" dangerouslySetInnerHTML={{ __html: customHtml }} />}

          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            {socialLinks.map((item) => {
              const Icon = item.icon;
              const isMail = item.url.startsWith("mailto:");
              return (
                <a
                  key={item.name}
                  rel="me"
                  aria-label={item.name}
                  href={item.url}
                  target={isMail ? undefined : "_blank"}
                  className="btn-regular inline-flex h-10 w-10 items-center justify-center rounded-lg active:scale-90"
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>

          {beian && (
            <div className="m-0.5 flex flex-wrap justify-center gap-2">
              <span>{beian}</span>
            </div>
          )}

          <div className="m-0.5 flex flex-wrap justify-center gap-2">
            &copy; <span id="copyright-year">{currentYear}</span>
            {siteName}. All Rights Reserved.
            <span aria-hidden="true">/</span>
            <a
              className="link font-medium text-(--primary) transition"
              target="_blank"
              rel="noopener noreferrer"
              href="/sitemap.xml"
            >
              Sitemap
            </a>
          </div>
          <div className="m-0.5 flex flex-wrap justify-center gap-2">
            <span>Powered by</span>
            <a
              className="link font-medium text-(--primary) transition"
              target="_blank"
              rel="noopener noreferrer"
              href="https://nextjs.org"
            >
              Next.js
            </a>
            <span aria-hidden="true">&</span>
            <a
              className="link font-medium text-(--primary) transition"
              target="_blank"
              rel="noopener noreferrer"
              href="https://github.com/YevolcXhb"
            >
              Slider
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export { Footer, type FooterProps };
export default Footer;
