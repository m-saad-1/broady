import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ path: process.cwd() + "/apps/api/.env" });

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "smtp";
const DEFAULT_FROM = process.env.EMAIL_FROM_ADDRESS || `no-reply@${process.env.WEB_APP_URL?.replace(/^https?:\/\//, "") || "broady.local"}`;

let transporter: nodemailer.Transporter | null = null;

function initTransport() {
  if (transporter) return transporter;

  if (EMAIL_PROVIDER === "ses") {
    const host = process.env.SES_SMTP_HOST;
    const port = Number(process.env.SES_SMTP_PORT || 587);
    const secure = String(process.env.SES_SMTP_SECURE || "false") === "true";
    const user = process.env.SES_SMTP_USER;
    const pass = process.env.SES_SMTP_PASS;

    if (!host) {
      throw new Error("SES_SMTP_HOST is not configured in apps/api/.env");
    }
    if (!user || !pass) {
      throw new Error("SES_SMTP_USER or SES_SMTP_PASS is not configured in apps/api/.env");
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  } else {
    // generic SMTP fallback (use env variables)
    const host = process.env.SMTP_HOST || process.env.SES_SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || process.env.SES_SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || process.env.SES_SMTP_SECURE || "false") === "true";
    const user = process.env.SMTP_USER || process.env.SES_SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.SES_SMTP_PASS;

    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  // verify connection (non-blocking)
  transporter.verify((err, success) => {
    if (err) console.warn("[email.service] transporter verify warning:", err.message || err);
    else console.info("[email.service] transporter ready");
  });

  return transporter;
}

export async function sendEmail(opts: SendEmailOptions) {
  const t = initTransport();
  if (!t) throw new Error("Email transporter not initialized");

  const from = opts.from || DEFAULT_FROM;

  try {
    const info = await t.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    console.info("[email.service] sent", { messageId: info.messageId, accepted: info.accepted });
    // append to delivery log
    try {
      const fs = await import("fs/promises");
      const logDir = process.cwd() + "/apps/api/logs";
      await fs.mkdir(logDir, { recursive: true });
      const logLine = JSON.stringify({
        ts: new Date().toISOString(),
        to: opts.to,
        subject: opts.subject,
        messageId: info.messageId,
        accepted: info.accepted,
      }) + "\n";
      await fs.appendFile(`${logDir}/email.log`, logLine);
    } catch (e) {
      console.warn("[email.service] failed to write email log", e);
    }

    return { success: true, info };
  } catch (err: any) {
    console.error("[email.service] send failed:", err && err.message ? err.message : err);
    try {
      const fs = await import("fs/promises");
      const logDir = process.cwd() + "/apps/api/logs";
      await fs.mkdir(logDir, { recursive: true });
      const logLine = JSON.stringify({ ts: new Date().toISOString(), to: opts.to, subject: opts.subject, error: String(err && err.message) }) + "\n";
      await fs.appendFile(`${logDir}/email.log`, logLine);
    } catch (e) {
      console.warn("[email.service] failed to write email log", e);
    }
    return { success: false, error: err };
  }
}

export default { sendEmail };
