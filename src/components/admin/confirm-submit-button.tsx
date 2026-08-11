"use client";

import { type ReactNode } from "react";

/**
 * 带确认的 Server Action 提交按钮（用于破坏性操作，P3-002）。
 *
 * 点击后先弹出确认对话框，确认后调用服务端 action（整页表单提交，
 * 与直接使用 <form action={serverAction}> 行为一致）。
 *
 * 用法：
 * <ConfirmSubmitButton
 *   action={deletePost.bind(null, post.id)}
 *   confirmMessage="确定删除？"
 *   className="..."
 * >
 *   删除
 * </ConfirmSubmitButton>
 */
interface ConfirmSubmitButtonProps {
  /** Server Action（"use server" 导出的函数，可 bind 参数） */
  action: () => Promise<void>;
  confirmMessage: string;
  className?: string;
  disabled?: boolean;
  children: ReactNode;
  "aria-label"?: string;
}

export function ConfirmSubmitButton({
  action,
  confirmMessage,
  className,
  disabled,
  children,
  "aria-label": ariaLabel,
}: ConfirmSubmitButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        disabled={disabled}
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    </form>
  );
}
