const nodemailer = require("nodemailer");

// Send one email with the SMTP server in config.env.
// When SMTP_HOST is not set (for example in development), the email is not
// sent. The server writes it to the console instead.
let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASSWORD,
        },
      })
    : nodemailer.createTransport({ jsonTransport: true });

  return transporter;
};

module.exports = async ({ to, subject, text }) => {
  const from = `${process.env.FROM_NAME || "Co-working Space Reservation"} <${
    process.env.FROM_EMAIL || "noreply@coworking.local"
  }>`;

  const info = await getTransporter().sendMail({ from, to, subject, text });

  if (!process.env.SMTP_HOST) {
    console.log(`Email not sent (no SMTP_HOST): ${info.message}`);
  }

  return info;
};
