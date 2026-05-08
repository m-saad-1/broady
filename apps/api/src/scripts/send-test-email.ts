#!/usr/bin/env node
import dotenv from "dotenv";
import path from "path";
import { sendEmail } from "../services/email.service";

dotenv.config({ path: path.resolve(process.cwd(), "apps/api/.env") });

async function main() {
  const to = process.env.TEST_EMAIL_TO || process.env.EMAIL_FROM_ADDRESS;
  if (!to) {
    console.error("No TEST_EMAIL_TO or EMAIL_FROM_ADDRESS configured in apps/api/.env");
    process.exit(1);
  }

  console.info("Sending test email to", to);

  const res = await sendEmail({
    to,
    subject: "Broady: Test Email",
    text: "This is a test email from Broady SES integration.",
    html: "<p>This is a <strong>test</strong> email from Broady SES integration.</p>",
  });

  console.log("Result:", res);
  process.exit(res.success ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
