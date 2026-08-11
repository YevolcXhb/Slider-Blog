"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useFormatter } from "next-intl";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { Shield, ShieldCheck, Trash2, Users, UserCog, Pencil, Key, Plus } from "lucide-react";
import { updateUserRole, deleteUser, updateUserPassword, updateUserProfile, createUserByAdmin } from "@/server/actions/register";
import { getActionErrorMessage } from "@/lib/action-error";
import { UserRole } from "@/types/user";

interface UserItem {
  id: string;
  username: string | null;
  email: string;
  role: number;
  created_at: string;
}

interface UsersManagerProps {
  initialUsers: UserItem[];
  currentUserId: string;
  adminCount: number;
}

// ==================== Modal Overlay ====================

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative w-full max-w-md mx-4">
        <div className="rounded-2xl border border-white/10 bg-gray-900/95 p-6 shadow-2xl backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}

// ==================== Modal Form Components ====================

/** 编辑用户弹窗 */
function EditUserModal({
  user,
  onClose,
  onSuccess,
  t,
  tErr,
}: {
  user: UserItem;
  onClose: () => void;
  onSuccess: (updated: Partial<UserItem>) => void;
  t: (key: string) => string;
  tErr: (key: string) => string;
}) {
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("username", username);
      fd.set("email", email);
      await updateUserProfile(Number(user.id), fd);
      onSuccess({ username, email });
      onClose();
    } catch (err) {
      setError(
        getActionErrorMessage(tErr, err instanceof Error ? err.message : undefined, t("operationFailed")),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-white/90">{t("editUser")}</h3>
        <p className="text-sm text-white/50">{t("editUserDesc")}</p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="edit-username" className="mb-1 block text-sm font-medium text-white/70">
            {t("username")}
          </label>
          <input
            id="edit-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div>
          <label htmlFor="edit-email" className="mb-1 block text-sm font-medium text-white/70">
            {t("email")}
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <GlassButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </GlassButton>
          <GlassButton type="submit" variant="brand" size="sm" disabled={busy}>
            {busy ? t("saving") : t("save")}
          </GlassButton>
        </div>
      </form>
    </ModalOverlay>
  );
}

/** 重置密码弹窗 */
function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
  t,
  tErr,
}: {
  user: UserItem;
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string) => string;
  tErr: (key: string) => string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("passwordNotMatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateUserPassword(Number(user.id), password);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        getActionErrorMessage(tErr, err instanceof Error ? err.message : undefined, t("operationFailed")),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-white/90">
          {t("resetPassword")} — {user.username || user.email}
        </h3>
        <p className="text-sm text-white/50">{t("resetPasswordDesc")}</p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="reset-password" className="mb-1 block text-sm font-medium text-white/70">
            {t("newPassword")}
          </label>
          <input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder={t("newPasswordPlaceholder")}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-1 block text-sm font-medium text-white/70">
            {t("confirmPassword")}
          </label>
          <input
            id="reset-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            placeholder={t("confirmPassword")}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <GlassButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </GlassButton>
          <GlassButton type="submit" variant="brand" size="sm" disabled={busy}>
            {busy ? t("resetting") : t("save")}
          </GlassButton>
        </div>
      </form>
    </ModalOverlay>
  );
}

/** 创建用户弹窗 */
function CreateUserModal({
  onClose,
  onSuccess,
  t,
  tErr,
}: {
  onClose: () => void;
  onSuccess: () => void;
  t: (key: string) => string;
  tErr: (key: string) => string;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(UserRole.USER.toString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("username", username);
      fd.set("email", email);
      fd.set("password", password);
      fd.set("role", role);
      await createUserByAdmin(fd);
      onSuccess();
      onClose();
    } catch (err) {
      setError(
        getActionErrorMessage(tErr, err instanceof Error ? err.message : undefined, t("operationFailed")),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-white/90">{t("createUser")}</h3>
        <p className="text-sm text-white/50">{t("createUserDesc")}</p>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="create-username" className="mb-1 block text-sm font-medium text-white/70">
            {t("username")}
          </label>
          <input
            id="create-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div>
          <label htmlFor="create-email" className="mb-1 block text-sm font-medium text-white/70">
            {t("email")}
          </label>
          <input
            id="create-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div>
          <label htmlFor="create-password" className="mb-1 block text-sm font-medium text-white/70">
            {t("password")}
          </label>
          <input
            id="create-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/30 focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          />
        </div>

        <div>
          <label htmlFor="create-role" className="mb-1 block text-sm font-medium text-white/70">
            {t("roleLabel")}
          </label>
          <select
            id="create-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/90 outline-none transition-colors focus:border-pink-400/50 focus:ring-1 focus:ring-pink-400/30"
          >
            <option value={UserRole.USER}>{t("roleUser")}</option>
            <option value={UserRole.ADMIN}>{t("roleAdmin")}</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <GlassButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </GlassButton>
          <GlassButton type="submit" variant="brand" size="sm" disabled={busy}>
            {busy ? t("creating") : t("createUser")}
          </GlassButton>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ==================== Main Component ====================

export default function UsersManager({
  initialUsers,
  currentUserId,
  adminCount: initialAdminCount,
}: UsersManagerProps) {
  const t = useTranslations("AdminUsers");
  const tErr = useTranslations("AdminErrors");
  const format = useFormatter();

  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminCount, setAdminCount] = useState(initialAdminCount);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal state
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<UserItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  const handleRoleChange = useCallback(
    async (id: string, nextRole: number) => {
      if (id === currentUserId && nextRole !== UserRole.ADMIN) {
        setError(t("cannotDemoteSelf"));
        return;
      }
      const confirmKey =
        nextRole === UserRole.ADMIN ? "confirmSetAdmin" : "confirmSetUser";
      if (!window.confirm(t(confirmKey))) return;

      setBusyId(id);
      setError(null);
      try {
        await updateUserRole(Number(id), nextRole);
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, role: nextRole } : u)),
        );
        setAdminCount((prev) => {
          const target = users.find((u) => u.id === id);
          const wasAdmin = target?.role === UserRole.ADMIN;
          const willBeAdmin = nextRole === UserRole.ADMIN;
          return prev + (willBeAdmin ? 1 : 0) - (wasAdmin ? 1 : 0);
        });
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("cannotDemoteSelf"),
          ),
        );
      } finally {
        setBusyId(null);
      }
    },
    [currentUserId, t, tErr, users],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (id === currentUserId) {
        setError(t("cannotDeleteSelf"));
        return;
      }
      if (!window.confirm(t("confirmDelete"))) return;

      const target = users.find((u) => u.id === id);

      setBusyId(id);
      setError(null);
      try {
        await deleteUser(Number(id));
        setUsers((prev) => prev.filter((u) => u.id !== id));
        if (target?.role === UserRole.ADMIN) {
          setAdminCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        setError(
          getActionErrorMessage(
            tErr,
            err instanceof Error ? err.message : undefined,
            t("cannotDeleteSelf"),
          ),
        );
      } finally {
        setBusyId(null);
      }
    },
    [currentUserId, t, tErr, users],
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <UserCog className="size-7 text-white/70" aria-hidden="true" />
          <h1 className="admin-page-title text-3xl font-bold text-white/90 md:text-4xl">{t("title")}</h1>
        </div>
        <p className="text-sm text-white/50">{t("subtitle")}</p>
      </header>

      {/* Stats + Create button row */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-white/60">
              <Users className="size-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wide">
                {t("totalUsers")}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white/90">
              {users.length}
            </p>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 text-white/60">
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span className="text-xs uppercase tracking-wide">
                {t("adminCount")}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white/90">{adminCount}</p>
          </GlassCard>
        </div>
        <GlassButton
          type="button"
          variant="brand"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("createUser")}
        </GlassButton>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      {/* Success banner */}
      {successMsg && (
        <div
          role="status"
          className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400"
        >
          {successMsg}
        </div>
      )}

      {/* Users table */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">{t("username")}</th>
                <th className="px-4 py-3 font-medium">{t("email")}</th>
                <th className="px-4 py-3 font-medium">{t("role")}</th>
                <th className="px-4 py-3 font-medium">{t("createdAt")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-white/40"
                  >
                    {t("noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isAdmin = u.role === UserRole.ADMIN;
                  const isSelf = u.id === currentUserId;
                  const isBusy = busyId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className="text-white/80 transition-colors hover:bg-white/5"
                    >
                      <td className="px-4 py-3 font-medium">
                        {u.username || "—"}
                        {isSelf && (
                          <span className="ml-2 text-xs text-white/40">
                            {t("you")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/60">{u.email}</td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-300">
                            <ShieldCheck className="size-3" aria-hidden="true" />
                            {t("roleAdmin")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
                            <Shield className="size-3" aria-hidden="true" />
                            {t("roleUser")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/50">
                        {format.dateTime(new Date(u.created_at), {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {/* Edit button */}
                          <GlassButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => setEditTarget(u)}
                            title={t("edit")}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </GlassButton>

                          {/* Password reset button */}
                          <GlassButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => setPasswordTarget(u)}
                            title={t("password")}
                          >
                            <Key className="size-3.5" aria-hidden="true" />
                          </GlassButton>

                          {/* Role toggle */}
                          {isAdmin ? (
                            <GlassButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={isBusy || isSelf}
                              onClick={() =>
                                handleRoleChange(u.id, UserRole.USER)
                              }
                            >
                              {t("setUser")}
                            </GlassButton>
                          ) : (
                            <GlassButton
                              type="button"
                              variant="brand"
                              size="sm"
                              disabled={isBusy}
                              onClick={() =>
                                handleRoleChange(u.id, UserRole.ADMIN)
                              }
                            >
                              {t("setAdmin")}
                            </GlassButton>
                          )}

                          {/* Delete button */}
                          <GlassButton
                            type="button"
                            variant="danger"
                            size="sm"
                            disabled={isBusy || isSelf}
                            onClick={() => handleDelete(u.id)}
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            {t("delete")}
                          </GlassButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modals */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={(updated) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === editTarget.id ? { ...u, ...updated } : u)),
            );
            showSuccess(t("userUpdated"));
          }}
          t={t}
          tErr={tErr}
        />
      )}

      {passwordTarget && (
        <ResetPasswordModal
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSuccess={() => showSuccess(t("passwordResetSuccess"))}
          t={t}
          tErr={tErr}
        />
      )}

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            // 刷新页面以获取完整用户列表
            window.location.reload();
          }}
          t={t}
          tErr={tErr}
        />
      )}
    </div>
  );
}