import { prisma } from "../config/prisma.js";
import bcrypt from "bcryptjs";

async function main() {
  const email = "msaad23305@gmail.com";
  const password = "Admin123!";
  const hashed = await bcrypt.hash(password, 12);
  
  const user = await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });
  
  console.log(`Successfully updated password for admin: ${user.email} to "Admin123!"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
