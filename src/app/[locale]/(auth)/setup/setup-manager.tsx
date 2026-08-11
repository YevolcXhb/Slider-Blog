"use client";

import { useState, useCallback, useEffect } from "react";
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
  Database,
  RefreshCw,
} from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { GlassInput } from "@/components/ui/glass-input";
import { GlassButton } from "@/components/ui/glass-button";
import { PageBackground } from "@/components/ui/page-background";
import {
  setupCreateAdmin,
  setupSaveSiteInfo,
  configureDatabase,
} from "@/server/actions/setup";
import { getActionErrorMessage } from "@/lib/action-error";

type DbState = "checking" | "connected" | "disconnected";

/**
 * 初始化向导（两步）：
 * 1. 数据库未配置时先填 host/port/库名/用户名/密码，服务端测试连接并写入
 *    /data/config.env，随后进程优雅退出，容器 entrypoint 重启并加载配置；
 *    前端轮询 /api/health/db 直到数据库连通。
 * 2. 数据库连通后创建管理员账号并配置站点信息。
 */
export function SetupManager() {
  const t = useTranslations("Setup");
  const tErr = useTranslations("AdminErrors");
  const router = useRouter();

  const [dbState, setDbState] = useState<DbState>("checking");
  const [dbHost, setDbHost] = useState("");
  const [dbPort, setDbPort] = useState("3306");
  const [dbName, setDbName] = useState("slider_blog");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [dbSaving, setDbSaving] = useState(false);

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 管理员账号
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 站点信息
  const [siteTitle, setSiteTitle] = useState("");
  const [siteSubtitle, setSiteSubtitle] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  const [siteLaunchDate, setSiteLaunchDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health/db", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setDbState(data.connected ? "connected" : "disconnected");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDbState("disconnected");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const waitForDbReady = useCallback(async (maxWaitMs = 30000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch("/api/health/db", { cache: "no-store" });
        const data = await res.json();
        if (data.connected) return true;
      } catch {
        // 服务重启中，忽略并继续轮询
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return false;
  }, []);

  const handleConfigureDb = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");

      const port = Number(dbPort);
      if (
        !dbHost.trim() ||
        !dbName.trim() ||
        !dbUser.trim() ||
        !dbPassword ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
      ) {
        setError(t("dbFieldsRequired"));
        return;
      }

      setDbSaving(true);
      try {
        const result = await configureDatabase({
          host: dbHost,
          port,
          database: dbName,
          username: dbUser,
          password: dbPassword,
        });

        if (!result.ok) {
          const messages: Record<string, string> = {
            fieldsRequired: t("dbFieldsRequired"),
            invalidHost: t("dbInvalidHost"),
            invalidPort: t("dbInvalidPort"),
            connectionFailed: t("dbFailed"),
            alreadyConfigured: t("dbAlreadyConfigured"),
            adminOnly: t("dbAdminOnly"),
          };
          setError(messages[result.error] ?? t("unexpectedError"));
          return;
        }

        const ready = await waitForDbReady();
        if (!ready) {
          setError(t("dbRestartTimeout"));
          setDbState("disconnected");
        } else {
          setDbState("connected");
        }
      } catch {
        setError(t("unexpectedError"));
      } finally {
        setDbSaving(false);
      }
    },
    [dbHost, dbPort, dbName, dbUser, dbPassword, t, waitForDbReady],
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
            {dbState === "connected" ? (
              <Wand2 className="size-6 text-brand-pink" />
            ) : (
              <Database className="size-6 text-brand-pink" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white/90">{t("title")}</h1>
          <p className="mt-1 text-sm text-white/50">
            {dbState === "connected" ? t("description") : t("dbDescription")}
          </p>
        </div>

        {dbState === "checking" && (
          <div className="flex items-center justify-center gap-3 py-10 text-white/60">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            <span>{t("dbChecking")}</span>
          </div>
        )}

        {dbState === "disconnected" && (
          <form onSubmit={handleConfigureDb} className="space-y-5">
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
              <label htmlFor="dbHost" className="text-sm font-medium text-white/70">
                {t("dbHost")}
              </label>
              <GlassInput
                id="dbHost"
                type="text"
                placeholder={t("dbHostPlaceholder")}
                value={dbHost}
                onChange={(e) => setDbHost(e.target.value)}
                required
                autoComplete="off"
                disabled={dbSaving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="dbPort" className="text-sm font-medium text-white/70">
                  {t("dbPort")}
                </label>
                <GlassInput
                  id="dbPort"
                  type="number"
                  placeholder={t("dbPortPlaceholder")}
                  value={dbPort}
                  onChange={(e) => setDbPort(e.target.value)}
                  required
                  min={1}
                  max={65535}
                  disabled={dbSaving}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="dbName" className="text-sm font-medium text-white/70">
                  {t("dbName")}
                </label>
                <GlassInput
                  id="dbName"
                  type="text"
                  placeholder={t("dbNamePlaceholder")}
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  required
                  autoComplete="off"
                  disabled={dbSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="dbUser" className="text-sm font-medium text-white/70">
                {t("dbUser")}
              </label>
              <GlassInput
                id="dbUser"
                type="text"
                placeholder={t("dbUserPlaceholder")}
                value={dbUser}
                onChange={(e) => setDbUser(e.target.value)}
                required
                autoComplete="username"
                disabled={dbSaving}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dbPassword" className="text-sm font-medium text-white/70">
                {t("dbPassword")}
              </label>
              <GlassInput
                id="dbPassword"
                type="password"
                placeholder={t("dbPasswordPlaceholder")}
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={dbSaving}
              />
            </div>

            <GlassButton
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              disabled={dbSaving}
            >
              {dbSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {t("dbRestarting")}
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t("testAndSave")}
                </>
              )}
            </GlassButton>
          </form>
        )}

        {dbState === "connected" && (
          <>
            <ol
              className="mb-8 flex items-center justify-center gap-2"
              aria-label={t("stepsLabel")}
            >
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <li key={s.id} className="flex items-center gap-2">
                    {idx > 0 && (
                      <span className="h-px w-6 bg-white/20" aria-hidden="true" />
                    )}
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
          </>
        )}
      </GlassCard>
    </div>
  );
}
