const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const outfitters = await prisma.brand.findFirst({
    where: { name: { equals: "Outfitters", mode: "insensitive" } },
    select: { id: true, name: true, contactEmail: true, owner: { select: { id: true, email: true } } },
  });

  if (!outfitters) {
    console.log(JSON.stringify({ error: "outfitters_not_found" }, null, 2));
    return;
  }

  const members = await prisma.brandMember.findMany({
    where: { brandId: outfitters.id },
    include: { user: { select: { id: true, email: true, fullName: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  const owners = await prisma.user.findMany({
    where: { brandId: outfitters.id },
    select: { id: true, email: true, fullName: true, role: true },
  });

  console.log(
    JSON.stringify(
      {
        brand: outfitters,
        ownerRelation: outfitters.owner,
        members: members.map((m) => ({ id: m.id, user: m.user })),
        ownerUsers: owners,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });