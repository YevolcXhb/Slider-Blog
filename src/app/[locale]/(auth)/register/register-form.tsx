"use client"

import { useState, useCallback } from "react"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"
import { UserPlus, Loader2, AlertCircle } from "lucide-react"

import { GlassCard } from "@/components/ui/glass-card"
import { GlassInput } from "@/components/ui/glass-input"
import { GlassButton } from "@/components/ui/glass-button"
import { PageBackground } from "@/components/ui/page-background"
import { registerUser } from "@/server/actions/register"
import { getActionErrorMessage } from "@/lib/action-error"
import { Link } from "@/i18n/routing"

export default function RegisterForm() {
  const t = useTranslations("Register")
  const tErr = useTranslations("AdminErrors")
  const router = useRouter()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      setError("")

      if (password !== confirmPassword) {
        setError(t("passwordMismatch"))
        return
      }

      setIsLoading(true)

      try {
        const formData = new FormData()
        formData.set("username", username)
        formData.set("email", email)
        formData.set("password", password)

        await registerUser(formData)

        // 注册成功后自动登录
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          // 注册成功但自动登录失败，跳转到登录页
          router.push("/login")
        } else {
          router.push("/dashboard")
          router.refresh()
        }
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("unexpectedError"),
          ),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [username, email, password, confirmPassword, router, t, tErr],
  )

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <PageBackground />

      <GlassCard className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md" aria-hidden="true">
            <UserPlus className="size-6 text-white/70" />
          </div>
          <h1 className="text-2xl font-bold text-white/90">{t("title")}</h1>
          <p className="mt-1 text-sm text-white/50">{t("description")}</p>
          <p className="mt-2 inline-block rounded-full bg-brand-pink/10 px-3 py-1 text-xs text-brand-pink">
            {t("firstUserHint")}
          </p>
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
            <label htmlFor="username" className="text-sm font-medium text-white/70">
              {t("username")}
            </label>
            <GlassInput
              id="username"
              type="text"
              placeholder={t("usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-white/70">
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
            <label htmlFor="password" className="text-sm font-medium text-white/70">
              {t("password")}
            </label>
            <GlassInput
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">
              {t("confirmPassword")}
            </label>
            <GlassInput
              id="confirmPassword"
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
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
                {t("registering")}
              </>
            ) : (
              <>
                <UserPlus className="size-4" aria-hidden="true" />
                {t("register")}
              </>
            )}
          </GlassButton>
        </form>

        <p className="mt-6 text-center text-sm text-white/50">
          {t("alreadyHaveAccount")}{" "}
          <Link href="/login" className="font-medium text-white/80 transition-colors hover:text-white">
            {t("signIn")}
          </Link>
        </p>
      </GlassCard>
    </div>
  )
}
