import { PrismaClient } from "@prisma/client";
import { env } from "./src/config/env.js";

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.notificationChannelLog.findMany({
    where: { channel: "EMAIL" },
    orderBy: { createdAt: "desc" },
    take: 5
  });
  console.log("Recent email logs:", JSON.stringify(logs, null, 2));
  
  console.log("Env Provider:", env.emailProvider);
  console.log("Env SES User configured:", !!env.sesSmtpUser);
  console.log("Env SES Host:", env.sesSmtpHost);
}

main().catch(console.error).finally(() => prisma.$disconnect());
