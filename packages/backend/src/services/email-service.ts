import logger from '../lib/logger';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'crm@example.com';

/** Send email via SMTP. Falls back to logging if SMTP not configured. */
export async function sendReportEmail(to: string, subject: string, body: string): Promise<void> {
  if (!SMTP_HOST) {
    logger.info('Email (SMTP not configured — logged only)', { to, subject });
    return;
  }

  try {
    // Dynamic import to avoid requiring nodemailer when not configured
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text: body,
    });

    logger.info('Email sent', { to, subject });
  } catch (err) {
    logger.error('Email send failed', { to, error: (err as Error).message });
  }
}
