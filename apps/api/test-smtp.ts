import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables from .env
dotenv.config();

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SES_SMTP_HOST || "email-smtp.ap-south-1.amazonaws.com",
    port: parseInt(process.env.SES_SMTP_PORT || "465"),
    secure: process.env.SES_SMTP_SECURE === "true" || true,
    auth: {
      user: process.env.SES_SMTP_USER,
      pass: process.env.SES_SMTP_PASS,
    },
  });

  transporter.verify((err, success) => {
    if (err) console.error("Verify Error:", err);
    else console.log("Verify Success:", success);
  });
}

main();
