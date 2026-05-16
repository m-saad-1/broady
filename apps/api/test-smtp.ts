import nodemailer from "nodemailer";

async function main() {
  const transporter = nodemailer.createTransport({
    host: "email-smtp.ap-south-1.amazonaws.com",
    port: 465,
    secure: true,
    auth: {
      user: "AKIA3TQ3WO5SGTIEQO73",
      pass: "BHv4yVZ8OsFFoBRLoGbSoMA0Rfjt+5A0KEs7w3JOveW8",
    },
  });

  transporter.verify((err, success) => {
    if (err) console.error("Verify Error:", err);
    else console.log("Verify Success:", success);
  });
}

main();
