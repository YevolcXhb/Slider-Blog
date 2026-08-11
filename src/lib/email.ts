import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import { render } from "@react-email/render";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !port || !user || !pass) {
    throw new Error(
      "Email environment variables are not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS.",
    );
  }
  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port, 10),
    secure: parseInt(port, 10) === 465,
    auth: { user, pass },
  });
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const t = getTransporter();
  const html = await render(options.react);
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@example.com";
  await t.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html,
  });
}
