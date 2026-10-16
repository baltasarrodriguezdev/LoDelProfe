import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { prisma } from '../prisma/client.js';
import { normalizeArgentinaPhone, storedPhoneCandidates } from '../utils/argentina-phone.js';
import { HttpError } from '../utils/http-error.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const maskPhone = (value: string) => `••••••${value.slice(-4)}`;

export async function createWhatsappLinkChallenge(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) throw new HttpError(403, 'La cuenta no está activa.', 'CUSTOMER_INACTIVE');
  if (user.isBlocked) throw new HttpError(403, 'La cuenta está bloqueada.', 'CUSTOMER_BLOCKED');
  if (!user.emailVerifiedAt) throw new HttpError(403, 'Confirmá tu email antes de conectar WhatsApp.', 'EMAIL_NOT_VERIFIED');
  const challenge = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + config.whatsappLinkTtlMinutes * 60_000);
  await prisma.$transaction(async tx => {
    if (typeof (tx as Prisma.TransactionClient & { $queryRaw?: unknown }).$queryRaw === 'function') {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    }
    await tx.whatsappLinkChallenge.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() }
    });
    await tx.whatsappLinkChallenge.create({ data: { userId, tokenHash: hash(challenge), expiresAt } });
  });
  return { challenge, expiresAt };
}

export async function claimWhatsappLink(input: {
  challenge: string;
  senderPhone: string;
  provider: string;
  providerEventId: string;
}) {
  const phoneE164 = normalizeArgentinaPhone(input.senderPhone);
  if (!phoneE164) throw new HttpError(400, 'El remitente de WhatsApp no es válido.', 'INVALID_PHONE');
  const now = new Date();
  const replay = await prisma.whatsappLinkChallenge.findUnique({ where: { providerEventId: input.providerEventId } });
  if (replay) throw new HttpError(409, 'El evento del proveedor ya fue procesado.', 'PROVIDER_EVENT_REPLAY');
  const challenge = await prisma.whatsappLinkChallenge.findFirst({
    where: { tokenHash: hash(input.challenge), consumedAt: null, claimedAt: null, expiresAt: { gt: now } },
    include: { user: true }
  });
  if (!challenge) throw new HttpError(400, 'El desafío es inválido o venció.', 'INVALID_LINK_CHALLENGE');
  if (!storedPhoneCandidates(phoneE164).includes(challenge.user.phone)) {
    throw new HttpError(409, 'El remitente no coincide con el teléfono de contacto de la cuenta.', 'WHATSAPP_PHONE_MISMATCH');
  }
  if (!challenge.user.active || challenge.user.isBlocked || !challenge.user.emailVerifiedAt) {
    throw new HttpError(403, 'La cuenta no está habilitada para vincular WhatsApp.', 'CUSTOMER_NOT_ELIGIBLE');
  }
  try {
    const claimed = await prisma.whatsappLinkChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, claimedAt: null, expiresAt: { gt: now } },
      data: { claimedPhoneE164: phoneE164, provider: input.provider, providerEventId: input.providerEventId, claimedAt: now }
    });
    if (!claimed.count) throw new HttpError(409, 'El desafÃ­o ya fue reclamado.', 'LINK_CHALLENGE_ALREADY_CLAIMED');
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new HttpError(409, 'El evento del proveedor ya fue procesado.', 'PROVIDER_EVENT_REPLAY');
    }
    throw error;
  }
  return { linked: false, pendingWebConfirmation: true };
}

export async function whatsappLinkStatus(userId: number) {
  const [link, challenge] = await Promise.all([
    prisma.whatsappLink.findUnique({ where: { userId } }),
    prisma.whatsappLinkChallenge.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    })
  ]);
  return {
    linked: Boolean(link && !link.revokedAt),
    phone: link && !link.revokedAt ? maskPhone(link.phoneE164) : null,
    pending: Boolean(challenge?.claimedPhoneE164),
    pendingPhone: challenge?.claimedPhoneE164 ? maskPhone(challenge.claimedPhoneE164) : null
  };
}

export async function confirmWhatsappLink(userId: number) {
  const now = new Date();
  return prisma.$transaction(async tx => {
    const challenge = await tx.whatsappLinkChallenge.findFirst({
      where: { userId, consumedAt: null, expiresAt: { gt: now }, claimedPhoneE164: { not: null } },
      orderBy: { createdAt: 'desc' }
    });
    if (!challenge?.claimedPhoneE164 || !challenge.provider) {
      throw new HttpError(409, 'Todavía no recibimos el mensaje autenticado de WhatsApp.', 'LINK_NOT_CLAIMED');
    }
    const consumed = await tx.whatsappLinkChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now }
    });
    if (!consumed.count) throw new HttpError(409, 'El desafío ya no está disponible.', 'INVALID_LINK_CHALLENGE');
    const existingPhone = await tx.whatsappLink.findUnique({ where: { phoneE164: challenge.claimedPhoneE164 } });
    if (existingPhone && existingPhone.userId !== userId && !existingPhone.revokedAt) {
      throw new HttpError(409, 'Ese WhatsApp ya está vinculado a otra cuenta.', 'WHATSAPP_ALREADY_LINKED');
    }
    if (existingPhone && existingPhone.userId !== userId) {
      await tx.whatsappLink.delete({ where: { id: existingPhone.id } });
    }
    const link = await tx.whatsappLink.upsert({
      where: { userId },
      update: { phoneE164: challenge.claimedPhoneE164, provider: challenge.provider, verifiedAt: now, revokedAt: null },
      create: { userId, phoneE164: challenge.claimedPhoneE164, provider: challenge.provider, verifiedAt: now }
    });
    return { linked: true, phone: maskPhone(link.phoneE164) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function resolveLinkedWhatsappUser(senderPhone: string) {
  const phoneE164 = normalizeArgentinaPhone(senderPhone);
  if (!phoneE164) throw new HttpError(400, 'El remitente de WhatsApp no es válido.', 'INVALID_PHONE');
  const link = await prisma.whatsappLink.findUnique({ where: { phoneE164 }, include: { user: true } });
  if (!link || link.revokedAt) throw new HttpError(403, 'Necesitás completar tu registro y vincular WhatsApp.', 'WHATSAPP_NOT_LINKED');
  const user = link.user;
  if (!user.active) throw new HttpError(403, 'La cuenta no está activa.', 'CUSTOMER_INACTIVE');
  if (user.isBlocked) throw new HttpError(403, 'La cuenta está bloqueada.', 'CUSTOMER_BLOCKED');
  if (!user.emailVerifiedAt) throw new HttpError(403, 'Necesitás confirmar tu email antes de usar el bot.', 'EMAIL_NOT_VERIFIED');
  return { phoneE164, user };
}
