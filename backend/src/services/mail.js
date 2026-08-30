import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const client = getTransporter();
  if (!client) {
    console.log(`[mail] SMTP not configured, printing email instead.\nTo: ${to}\nSubject: ${subject}\n${html}`);
    return;
  }
  await client.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}
