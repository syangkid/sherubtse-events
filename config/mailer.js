
require('dotenv').config();

const nodemailer = require('nodemailer');

const mode = (process.env.MAIL_MODE || 'console').toLowerCase();

let transporter = null;

if (mode === 'smtp') {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure:
      String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendMail({ to, subject, text }) {
  if (mode !== 'smtp') {
    if (process.env.NODE_ENV !== 'test') {
      console.log('\n[mail:console] ------------------------------');
      console.log(`  To     : ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  ${String(text || '').split('\n').join('\n  ')}`);
      console.log('[mail:console] ------------------------------\n');
    }

    // Console mode logs the message instead of sending an email.
    return { mode: 'console' };
  }

  if (!transporter) {
    throw new Error('SMTP transporter is not configured.');
  }

  const result = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });

  return { mode: 'smtp', messageId: result.messageId };
}

module.exports = {
  sendMail,
  mailMode: () => mode,
};
