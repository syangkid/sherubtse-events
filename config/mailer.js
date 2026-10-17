require('dotenv').config();
const nodemailer = require('nodemailer');

let mode = (process.env.MAIL_MODE || 'console').toLowerCase();
let transporter = null;

if (mode === 'smtp') {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('[mail] MAIL_MODE=smtp but SMTP_* values are missing. Falling back to console mode.');
    mode = 'console';
  } else {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });
  }
}

async function sendMail({ to, subject, text }) {
  if (mode !== 'smtp') {
    console.log('\n[mail:console] ------------------------------');
    console.log(`  To     : ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  ${text.split('\n').join('\n  ')}`);
    console.log('[mail:console] ------------------------------\n');
    return { mode: 'console' };
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
  return { mode: 'smtp' };
}

module.exports = { sendMail, mailMode: () => mode };