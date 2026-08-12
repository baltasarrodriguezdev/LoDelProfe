import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/client.js';

type AuditClient = Partial<Pick<Prisma.TransactionClient, 'auditLog'>>;

export type AuditInput = {
  actorId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  details?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput, client: AuditClient = prisma) {
  if (!client.auditLog?.create) return null;
  return client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId == null ? null : String(input.entityId),
      details: input.details as Prisma.InputJsonValue | undefined
    }
  });
}
