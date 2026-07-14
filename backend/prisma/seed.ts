import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const phone = process.env.SUPERADMIN_PHONE;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!phone || !password) {
    throw new Error('SUPERADMIN_PHONE y SUPERADMIN_PASSWORD son obligatorios para ejecutar el seed');
  }
  await prisma.user.upsert({
    where: { phone },
    update: { role: Role.SUPERADMIN, active: true, phoneVerified: true, status: UserStatus.VERIFIED, isBlocked: false },
    create: {
      firstName: 'Administrador', lastName: 'Principal', phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.SUPERADMIN, phoneVerified: true, status: UserStatus.VERIFIED, isBlocked: false
    }
  });
  await prisma.court.upsert({
    where: { id: 1 }, update: { name: 'Lo del Profe', description: 'Cancha de pádel' },
    create: { id: 1, name: 'Lo del Profe', description: 'Cancha de pádel' }
  });
  for (const [durationMinutes, price] of [[60, 16000], [90, 20000], [120, 24000]] as const) {
    await prisma.price.upsert({ where: { durationMinutes }, update: { price }, create: { durationMinutes, price } });
  }

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const weekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const openTime = weekend || dayOfWeek === 4 ? '09:00' : '15:00';
    const hours = { openTime, closeTime: '00:00', active: weekend || weekday };
    await prisma.businessHour.upsert({
      where: { dayOfWeek },
      update: hours,
      create: { dayOfWeek, ...hours }
    });
  }
  console.log(`Seed listo. SUPERADMIN: ${phone}`);
}

main().finally(() => prisma.$disconnect());
