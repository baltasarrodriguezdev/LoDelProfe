import { PrismaClient } from '@prisma/client';
import { seedSuma12League } from './league-seed.js';

const prisma = new PrismaClient();

async function main() {
  const court = await prisma.court.findFirst({ where: { active: true }, orderBy: { id: 'asc' } });
  if (!court) throw new Error('Se necesita una cancha activa antes de cargar La Liga.');
  const league = await seedSuma12League(prisma, court.id);
  console.log(`Liga lista: ${league.name} ${league.seasonYear}`);
}

main().finally(() => prisma.$disconnect());
