const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;
const live = Boolean(apiKey);
const resend = live ? new Resend(apiKey) : null;

async function send({ to, subject, text }) {
  if (!live) {
    console.log(`[mail not sent, RESEND_API_KEY missing] to=${to} | ${subject}`);
    return { id: null };
  }

  const recipients = Array.isArray(to)
    ? to
    : String(to).split(',').map((email) => email.trim()).filter(Boolean);

  const { data, error } = await resend.emails.send({
    from: process.env.MAIL_FROM || 'PanelSync <onboarding@resend.dev>',
    to: recipients,
    subject,
    text,
  });

  if (error) {
    throw new Error(error.message || 'Resend failed to send the email');
  }

  return data;
}

module.exports = { send, live };
