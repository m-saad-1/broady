#!/usr/bin/env tsx
/**
 * Update Admin Email
 * Finds the admin user with admin@gmail.com and updates to verified email
 */

import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function updateAdminEmail() {
  console.log("\n🔍 Searching for admin users with unverified email...\n");

  // Find admin users with admin@gmail.com
  const admins = await prisma.user.findMany({
    where: {
      role: {
        in: [Role.ADMIN, Role.SUPER_ADMIN],
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  console.log(`Found ${admins.length} admin(s):\n`);
  admins.forEach((admin) => {
    console.log(`  ID: ${admin.id}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}`);
    console.log(`  Created: ${admin.createdAt}\n`);
  });

  // Update admin@gmail.com to verified email
  const oldEmail = "admin@gmail.com";
  const newEmail = "mhsaad23305@gmail.com";

  console.log(`📝 Updating admin email from "${oldEmail}" to "${newEmail}"...\n`);

  const updated = await prisma.user.updateMany({
    where: {
      email: oldEmail,
      role: {
        in: [Role.ADMIN, Role.SUPER_ADMIN],
      },
    },
    data: {
      email: newEmail,
    },
  });

  console.log(`✅ Updated ${updated.count} admin user(s)\n`);

  // Verify update
  const verifyAdmins = await prisma.user.findMany({
    where: {
      role: {
        in: [Role.ADMIN, Role.SUPER_ADMIN],
      },
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  console.log("📋 Updated admin users:\n");
  verifyAdmins.forEach((admin) => {
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role: ${admin.role}\n`);
  });

  process.exit(0);
}

updateAdminEmail().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
