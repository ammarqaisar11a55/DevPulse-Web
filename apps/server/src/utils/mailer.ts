import nodemailer, { type Transporter } from 'nodemailer';
import { env, isTest } from '../config/env';
import { logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Messages captured during tests instead of being sent. */
export const testOutbox: MailMessage[] = [];

let transporter: Transporter | null = null;

function getTransporter() {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export async function sendMail(message: MailMessage) {
  if (isTest) {
    testOutbox.push(message);
    return;
  }
  const transport = getTransporter();
  if (!transport) {
    // Development fallback: without SMTP configured, emails are written to the log.
    logger.info(
      { to: message.to, subject: message.subject },
      `Email (not sent, SMTP not configured):\n${message.text}`,
    );
    return;
  }
  await transport.sendMail({ from: env.EMAIL_FROM, ...message });
}
