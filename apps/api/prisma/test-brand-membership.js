import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // Get first user (from seeding)
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log("❌ No users found. Please seed the database first.");
      return;
    }
    console.log(`✅ Found user: ${user.email} (${user.fullName})`);

    // Get first brand (from seeding)
    const brand = await prisma.brand.findFirst();
    if (!brand) {
      console.log("❌ No brands found. Please seed the database first.");
      return;
    }
    console.log(`✅ Found brand: ${brand.name}`);

    // Check if membership already exists
    const existing = await prisma.brandMember.findUnique({
      where: { userId_brandId: { userId: user.id, brandId: brand.id } },
    });

    if (existing) {
      console.log(`⚠️ Brand membership already exists for this user and brand.`);
      console.log(`Brand Member ID: ${existing.id}`);
      return;
    }

    // Create brand membership
    const membership = await prisma.brandMember.create({
      data: {
        userId: user.id,
        brandId: brand.id,
        canManageProducts: true,
      },
      include: {
        user: true,
        brand: true,
      },
    });

    console.log(`\n✅ Brand membership created successfully!`);
    console.log(`User: ${membership.user.email}`);
    console.log(`Brand: ${membership.brand.name}`);
    console.log(`Can Manage Products: ${membership.canManageProducts}`);
    console.log(`\nNow try logging in with ${user.email} and accessing the brand dashboard.`);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
