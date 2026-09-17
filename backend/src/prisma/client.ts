import { PrismaClient } from '@prisma/client';
import { databaseUrlForConnection } from '../utils/database-url.js';

const url = databaseUrlForConnection(process.env.DATABASE_URL);
export const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
