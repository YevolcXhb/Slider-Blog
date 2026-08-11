import { GitBranch, Mail, MessageCircle } from "lucide-react"
import { siteConfig } from "@/config/slider-config"

interface FooterProps {
  /** 自定义页脚 HTML（对应 Slider FooterConfig.html） */
  customHtml?: string
  /** 站点名称，未提供时默认 Slider Blog */
  siteName?: string
  /** 备案号等自定义文本 */
  beian?: string
}

const currentYear = new Date().getFullYear()

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
]

function Footer({ customHtml = "", siteName = siteConfig.title, beian = "" }: FooterProps) {
  return (
    <>
      <div className="transition border-t border-dashed border-black/10 dark:border-white/15 my-10 mx-4 md:mx-16 lg:mx-32" />
      <div className="transition border-dashed border-[oklch(85%_0.01_var(--hue))] dark:border-white/15 rounded-2xl mb-12 flex flex-col items-center justify-center px-6">
        <div className="transition text-50 text-sm text-center wrap">
          {customHtml && (
            <div className="mb-2" dangerouslySetInnerHTML={{ __html: customHtml }} />
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            {socialLinks.map((item) => {
              const Icon = item.icon
              const isMail = item.url.startsWith("mailto:")
              return (
                <a
                  key={item.name}
                  rel="me"
                  aria-label={item.name}
                  href={item.url}
                  target={isMail ? undefined : "_blank"}
                  className="btn-regular rounded-lg h-10 w-10 active:scale-90 inline-flex items-center justify-center"
                >
                  <Icon className="w-5 h-5" />
                </a>
              )
            })}
          </div>

          {beian && (
            <div className="m-0.5 flex gap-2 justify-center flex-wrap">
              <span>{beian}</span>
            </div>
          )}

          <div className="m-0.5 flex gap-2 justify-center flex-wrap">
            &copy; <span id="copyright-year">{currentYear}</span>
            {siteName}. All Rights Reserved.
            <span aria-hidden="true">/</span>
            <a
              className="transition link text-(--primary) font-medium"
              target="_blank"
              rel="noopener noreferrer"
              href="/sitemap.xml"
            >
              Sitemap
            </a>
          </div>
          <div className="m-0.5 flex gap-2 justify-center flex-wrap">
            <span>Powered by</span>
            <a
              className="transition link text-(--primary) font-medium"
              target="_blank"
              rel="noopener noreferrer"
              href="https://nextjs.org"
            >
              Next.js
            </a>
            <span aria-hidden="true">&</span>
            <a
              className="transition link text-(--primary) font-medium"
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
  )
}

export { Footer, type FooterProps }
export default Footer
