const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const info = await prisma.$queryRawUnsafe(
    "SELECT DATABASE() AS db, CURRENT_USER() AS user, VERSION() AS version"
  );

  console.log("BASE ACTUAL:");
  console.table(info);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      phone: true,
      role: true,
      active: true,
      updatedAt: true
    }
  });

  console.log("USUARIOS:");
  console.table(users);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
