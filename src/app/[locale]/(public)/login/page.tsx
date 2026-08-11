"use client"

import { useState, useCallback, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useRouter, Link } from "@/i18n/routing"
import { LogIn, Loader2, AlertCircle } from "lucide-react"

import { GlassCard } from "@/components/ui/glass-card"
import { GlassInput } from "@/components/ui/glass-input"
import { GlassButton } from "@/components/ui/glass-button"
import { PageBackground } from "@/components/ui/page-background"

function LoginForm() {
  const t = useTranslations("Login")
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError("")
      setIsLoading(true)

      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError(t("invalidCredentials"))
          return
        }

        // 登录成功后跳回原页面（P2-002）；仅接受站内相对路径，防止开放重定向
        const callbackUrl = searchParams.get("callbackUrl")
        if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
          router.push(callbackUrl)
        } else {
          router.push("/dashboard")
        }
        router.refresh()
      } catch {
        setError(t("unexpectedError"))
      } finally {
        setIsLoading(false)
      }
    },
    [email, password, router, searchParams, t],
  )

  return (
    <div className="relative flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <PageBackground />

      <GlassCard className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md" aria-hidden="true">
            <LogIn className="size-6 text-white/70" />
          </div>
          <h1 className="text-2xl font-bold text-white/90">{t("title")}</h1>
          <p className="mt-1 text-sm text-white/50">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-white/70"
            >
              {t("email")}
            </label>
            <GlassInput
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-white/70"
            >
              {t("password")}
            </label>
            <GlassInput
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t("signingIn")}
              </>
            ) : (
              <>
                <LogIn className="size-4" aria-hidden="true" />
                {t("signIn")}
              </>
            )}
          </GlassButton>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-white/80 transition-colors hover:text-white">
            {t("register")}
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams 需要 Suspense 边界，避免客户端渲染期间跳出（Next.js 16）
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
