import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/prisma/client.js';
import { confirmWhatsappLink } from '../src/services/whatsapp-link.service.js';

const db = prisma as any;
let challenge: any;
let links: any[];

beforeEach(() => {
  challenge = {
    id: 'challenge-1', userId: 7, consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    claimedPhoneE164: '+543576000000', provider: 'meta'
  };
  links = [];
  const tx = {
    whatsappLinkChallenge: {
      findFirst: async () => challenge.claimedPhoneE164 && !challenge.consumedAt ? challenge : null,
      updateMany: async ({ data }: any) => {
        if (challenge.consumedAt) return { count: 0 };
        Object.assign(challenge, data); return { count: 1 };
      }
    },
    whatsappLink: {
      findUnique: async ({ where }: any) => links.find(link => link.phoneE164 === where.phoneE164) ?? null,
      delete: async ({ where }: any) => {
        links = links.filter(link => link.id !== where.id); return {};
      },
      upsert: async ({ where, create, update }: any) => {
        let link = links.find(item => item.userId === where.userId);
        if (link) Object.assign(link, update);
        else { link = { id: links.length + 1, ...create }; links.push(link); }
        return link;
      }
    }
  };
  db.$transaction = async (work: any) => work(tx);
});

test('la confirmaciÃ³n web consume el desafÃ­o reclamado y crea una vinculaciÃ³n Ãºnica', async () => {
  const result = await confirmWhatsappLink(7);
  assert.equal(result.linked, true);
  assert.match(result.phone, /^.{6}0000$/u);
  assert.ok(challenge.consumedAt instanceof Date);
  assert.equal(links.length, 1);
  assert.equal(links[0].userId, 7);
  assert.equal(links[0].phoneE164, '+543576000000');
});

test('la web no puede confirmar antes del evento autenticado del proveedor', async () => {
  challenge.claimedPhoneE164 = null;
  await assert.rejects(() => confirmWhatsappLink(7), (error: any) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'LINK_NOT_CLAIMED');
    return true;
  });
  assert.equal(links.length, 0);
});
