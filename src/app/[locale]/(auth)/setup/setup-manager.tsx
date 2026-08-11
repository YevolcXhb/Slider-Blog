"use client";

import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import {
  Wand2,
  UserPlus,
  Globe,
  Check,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { PageBackground } from "@/components/ui/page-background";
import { setupCreateAdmin, setupSaveSiteInfo } from "@/server/actions/setup";
import { getActionErrorMessage } from "@/lib/action-error";

/**
 * 博客初始化向导。
 *
 * 步骤：
 *   1. 创建首位管理员账号（setupCreateAdmin + 客户端 signIn 自动登录）
 *   2. 配置站点基本信息（站点标题/副标题/描述/启动日期，saveProfileSettings）
 *   3. 完成，进入后台
 *
 * 仅在系统未初始化（无任何用户）时由 setup/page.tsx 渲染。
 */
export function SetupManager() {
  const t = useTranslations("Setup");
  const tErr = useTranslations("AdminErrors");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 步骤 1：管理员账号
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 步骤 2：站点信息
  const [siteTitle, setSiteTitle] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteLaunchDate, setSiteLaunchDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const handleCreateAccount = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");

      if (password !== confirmPassword) {
        setError(t("passwordMismatch"));
        return;
      }

      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.set("username", username);
        formData.set("email", email);
        formData.set("password", password);

        await setupCreateAdmin(formData);

        // 创建成功后自动登录（与注册页一致）
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError(t("autoSigninFailed"));
          return;
        }

        setStep(2);
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("unexpectedError"),
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [username, email, password, confirmPassword, t, tErr],
  );

  const handleSaveSite = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.set("site_title", siteTitle);
        formData.set("site_subtitle", siteSubtitle);
        formData.set("site_description", siteDescription);
        formData.set("site_launch_date", siteLaunchDate);

        await setupSaveSiteInfo(formData);

        router.push("/dashboard");
        router.refresh();
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("unexpectedError"),
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [siteTitle, siteSubtitle, siteDescription, siteLaunchDate, router, t, tErr],
  );

  const steps = [
    { id: 1, label: t("stepAccount"), icon: UserPlus },
    { id: 2, label: t("stepSite"), icon: Globe },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center">
      <PageBackground />

      <GlassCard className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md"
            aria-hidden="true"
          >
            <Wand2 className="size-6 text-brand-pink" />
          </div>
          <h1 className="text-2xl font-bold text-white/90">{t("title")}</h1>
          <p className="mt-1 text-sm text-white/50">{t("description")}</p>
        </div>

        {/* 步骤指示器 */}
        <ol className="mb-8 flex items-center justify-center gap-2" aria-label={t("stepsLabel")}>
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <li key={s.id} className="flex items-center gap-2">
                {idx > 0 && <span className="h-px w-6 bg-white/20" aria-hidden="true" />}
                <span
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    isActive
                      ? "bg-brand-pink/15 text-brand-pink"
                      : isDone
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-white/5 text-white/40"
                  }`}
                >
                  {isDone ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-3.5" aria-hidden="true" />
                  )}
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleCreateAccount} className="space-y-5">
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
                  {t("creating")}
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden="true" />
                  {t("createAndContinue")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </GlassButton>
          </form>
        ) : (
          <form onSubmit={handleSaveSite} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="siteTitle" className="text-sm font-medium text-white/70">
                {t("siteTitle")}
              </label>
              <GlassInput
                id="siteTitle"
                type="text"
                placeholder={t("siteTitlePlaceholder")}
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                required
                maxLength={100}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="siteSubtitle" className="text-sm font-medium text-white/70">
                {t("siteSubtitle")}
              </label>
              <GlassInput
                id="siteSubtitle"
                type="text"
                placeholder={t("siteSubtitlePlaceholder")}
                value={siteSubtitle}
                onChange={(e) => setSiteSubtitle(e.target.value)}
                required
                maxLength={200}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="siteDescription" className="text-sm font-medium text-white/70">
                {t("siteDescription")}
              </label>
              <GlassInput
                id="siteDescription"
                type="text"
                placeholder={t("siteDescriptionPlaceholder")}
                value={siteDescription}
                onChange={(e) => setSiteDescription(e.target.value)}
                maxLength={500}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="siteLaunchDate" className="text-sm font-medium text-white/70">
                {t("siteLaunchDate")}
              </label>
              <GlassInput
                id="siteLaunchDate"
                type="date"
                value={siteLaunchDate}
                onChange={(e) => setSiteLaunchDate(e.target.value)}
                required
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
                  {t("saving")}
                </>
              ) : (
                <>
                  <Globe className="size-4" aria-hidden="true" />
                  {t("finish")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </GlassButton>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
