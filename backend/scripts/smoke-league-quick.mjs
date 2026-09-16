import { httpServer } from '../dist/src/app.js';
import { prisma } from '../dist/src/prisma/client.js';
import { config } from '../dist/src/config.js';
import { stopRealtimeBroker } from '../dist/src/realtime/events.js';
import jwt from 'jsonwebtoken';

let failures = 0;
function check(label, condition, detail = '') {
  console.log(`${condition ? 'PASS' : 'FAIL'} | ${label}${detail ? ' | ' + detail : ''}`);
  if (!condition) failures++;
}

await new Promise((resolve, reject) => {
  httpServer.once('error', reject);
  httpServer.listen(0, '127.0.0.1', resolve);
});

try {
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('no se pudo resolver el puerto');
  const base = `http://127.0.0.1:${address.port}`;

  const superadmin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
  if (!superadmin) throw new Error('Falta el superadmin. Corré antes: npm run prisma:seed (requiere SUPERADMIN_PHONE/PASSWORD)');
  await prisma.leaguePair.updateMany({ data: { responsibleClientName: null, responsibleClientPhone: null } });
  const token = jwt.sign({ userId: superadmin.id, role: 'SUPERADMIN' }, config.jwtSecret);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const next = async (r) => ({ status: r.status, body: await r.json() });

  const leagues = await (await fetch(`${base}/api/admin/leagues`, { headers })).json();
  const league = leagues.find((l) => l.slug === 'liga-suma-12-2026');
  check('admin lista ligas y encuentra la temporada', Boolean(league), league?.name);

  let admin = await (await fetch(`${base}/api/admin/leagues/${league.id}`, { headers })).json();
  check('payload admin expone responsable por pareja', admin.zones[0].pairs[0].responsibleClientName === null && 'responsibleClientPhone' in admin.zones[0].pairs[0]);
  check('payload admin expone booking por partido (vacío al inicio)', admin.matches.every((m) => 'booking' in m && m.booking === null));

  const target = admin.matches.find((m) => m.code === 'A-F7-M1');
  const other = admin.matches.find((m) => m.code === 'B-F5-M1');
  const noPhoneMatch = admin.matches.find((m) => m.code === 'A-F6-M1');
  check('fixture listo con parejas cargadas', Boolean(target?.homePair && target?.awayPair), target?.code);

  const schedule1 = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${target.id}/schedule`, {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2026-10-03', startTime: '20:30', durationMinutes: 60, responsiblePairId: target.homePair.id, responsibleClientName: 'Papa', responsibleClientPhone: '549 351 555-1234' })
  }));
  const m1 = schedule1.body?.matches?.find((m) => m.id === target.id);
  check('programar reserva responde 200', schedule1.status === 200, String(schedule1.status));
  check('crea reserva CONFIRMED 60 min vinculada', m1?.booking?.status === 'CONFIRMED' && m1?.booking?.durationMinutes === 60, JSON.stringify(m1?.booking));
  const linked = await prisma.booking.findUnique({ where: { id: m1?.booking?.id }, select: { clientName: true, clientPhone: true, leagueMatch: { select: { id: true } } } });
  check('guarda responsable (nombre y teléfono normalizado)', linked?.clientName === 'Papa' && linked?.clientPhone === '5493515551234', `name=${linked?.clientName} phone=${linked?.clientPhone}`);
  check('relaciona reserva con el partido en la base', linked?.leagueMatch?.id === target.id);
  check('refleja fecha en el partido', m1?.scheduledDate === '2026-10-03' && m1?.scheduledTime === '20:30');

  const schedule2 = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${target.id}/schedule`, {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2026-10-10', startTime: '19:00', durationMinutes: 90, responsiblePairId: target.homePair.id })
  }));
  const m2 = schedule2.body?.matches?.find((m) => m.id === target.id);
  check('reprogramar reagenda la misma reserva (60→90)', schedule2.status === 200 && m2?.booking?.id === m1?.booking?.id && m2?.booking?.durationMinutes === 90, `booking ${m1?.booking?.id} -> ${m2?.booking?.id}`);

  const futureResult = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${target.id}/result`, {
    method: 'PUT', headers,
    body: JSON.stringify({ sets: [{ homeGames: 6, awayGames: 4 }, { homeGames: 7, awayGames: 5 }], confirm: true })
  }));
  check('no confirma un resultado antes de que empiece el turno', futureResult.status === 409 && /todav[ií]a no empez[oó]/i.test(futureResult.body?.message ?? ''), futureResult.body?.message);

  await prisma.booking.update({ where: { id: m1?.booking?.id }, data: { startTime: new Date('2026-09-12T23:30:00.000Z'), endTime: new Date('2026-09-13T01:00:00.000Z') } });
  await prisma.leagueMatch.update({ where: { id: target.id }, data: { scheduledDate: new Date('2026-09-12T00:00:00.000Z'), scheduledTime: '20:30' } });

  const result = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${target.id}/result`, {
    method: 'PUT', headers,
    body: JSON.stringify({ sets: [{ homeGames: 6, awayGames: 4 }, { homeGames: 7, awayGames: 5 }], confirm: true })
  }));
  const m3 = result.body?.matches?.find((m) => m.id === target.id);
  check('confirmar resultado guarda y oficializa en una petición', result.status === 200 && m3?.official === true && m3?.status === 'FINISHED', `official=${m3?.official} status=${m3?.status}`);
  check('marca la reserva vinculada como jugada', m3?.booking?.status === 'PLAYED', String(m3?.booking?.status));
  check('puntaje: victoria 2-0 respeta la regla pendiente de derrota', m3?.result?.homePoints === 3 && m3?.scoringPending === true && m3?.result?.awayPoints == null, `pts ${m3?.result?.homePoints}-${m3?.result?.awayPoints} pending=${m3?.scoringPending}`);

  const rescheduleFinished = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${target.id}/schedule`, {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2026-11-01', startTime: '18:00', durationMinutes: 60, responsiblePairId: target.homePair.id })
  }));
  check('rechaza reprogramar un partido finalizado', rescheduleFinished.status === 409, `${rescheduleFinished.status} ${rescheduleFinished.body?.message}`);

  const missingPhone = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${noPhoneMatch.id}/schedule`, {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2026-10-04', startTime: '12:00', durationMinutes: 60, responsiblePairId: noPhoneMatch.homePair.id })
  }));
  check('exige teléfono del responsable al reservar', missingPhone.status === 400 && /tel[eé]fono/i.test(missingPhone.body?.message ?? ''), missingPhone.body?.message);

  const created = await next(await fetch(`${base}/api/admin/bookings`, {
    method: 'POST', headers,
    body: JSON.stringify({ courtId: 1, clientName: 'Marcos y Nando', clientPhone: '3576555444', date: '2026-09-20', startTime: '10:00', durationMinutes: 60, playersCount: 4, origin: 'MANUAL' })
  }));
  check('crea un turno manual para vincular', created.status === 201, String(created.status));

  const link = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${other.id}/link-booking`, {
    method: 'POST', headers,
    body: JSON.stringify({ bookingId: created.body.id })
  }));
  const mLink = link.body?.matches?.find((m) => m.id === other.id);
  check('vincula una reserva existente', link.status === 200 && mLink?.booking?.id === created.body.id, `booking ${created.body.id}`);
  check('vincular ajusta fecha y hora del partido', mLink?.scheduledDate === '2026-09-20' && mLink?.scheduledTime === '10:00', `${mLink?.scheduledDate} ${mLink?.scheduledTime}`);

  const linkDupe = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${other.id}/link-booking`, {
    method: 'POST', headers,
    body: JSON.stringify({ bookingId: created.body.id })
  }));
  check('rechaza un vínculo duplicado', linkDupe.status === 409, linkDupe.body?.message);

  await prisma.booking.update({ where: { id: created.body.id }, data: { startTime: new Date('2026-09-13T13:00:00.000Z'), endTime: new Date('2026-09-13T14:00:00.000Z') } });

  const otherResult = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${other.id}/result`, {
    method: 'PUT', headers,
    body: JSON.stringify({ sets: [{ homeGames: 6, awayGames: 3 }, { homeGames: 6, awayGames: 2 }], confirm: true })
  }));
  check('confirma resultado del partido vinculado y juega el turno', otherResult.status === 200 && otherResult.body?.matches?.find((m) => m.id === other.id)?.booking?.status === 'PLAYED');

  const homeZone = admin.zones.find((z) => z.pairs.some((p) => p.id === noPhoneMatch.homePair.id));
  const pairUpdate = await next(await fetch(`${base}/api/admin/leagues/${league.id}/pairs/${noPhoneMatch.homePair.id}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ zoneId: homeZone.id, seedNumber: noPhoneMatch.homePair.seedNumber, firstPlayer: 'Moriconi', secondPlayer: 'Baroni', active: true, responsibleClientName: 'Jorge Moriconi', responsibleClientPhone: '351 222 3333' })
  }));
  check('actualiza el responsable de una pareja', pairUpdate.status === 200 && pairUpdate.body?.responsibleClientName === 'Jorge Moriconi', `${pairUpdate.status} ${pairUpdate.body?.message ?? ''}`);

  const withResponsible = await next(await fetch(`${base}/api/admin/leagues/${league.id}/matches/${noPhoneMatch.id}/schedule`, {
    method: 'POST', headers,
    body: JSON.stringify({ date: '2026-10-04', startTime: '12:00', durationMinutes: 60, responsiblePairId: noPhoneMatch.homePair.id })
  }));
  check('usa el responsable guardado de la pareja al reservar', withResponsible.status === 200, `${withResponsible.status} ${withResponsible.body?.message ?? ''}`);
  const savedPhone = await prisma.booking.findUnique({ where: { id: withResponsible.body.matches.find((m) => m.id === noPhoneMatch.id)?.booking?.id }, select: { clientPhone: true } });
  check('persiste el teléfono normalizado de la pareja', savedPhone?.clientPhone === '3512223333', savedPhone?.clientPhone);

  const pub = await (await fetch(`${base}/api/league/active`)).json();
  const pubMatch = pub.matches?.find((m) => m.id === target.id);
  check('API pública NO expone booking', pubMatch && !('booking' in pubMatch));
  const pubPair = pub.zones?.[0]?.pairs?.[0];
  check('API pública NO expone responsable', pubPair && !('responsibleClientName' in pubPair));
} finally {
  await new Promise((resolve) => httpServer.close(resolve));
  await stopRealtimeBroker();
  await prisma.$disconnect();
}

if (failures) { console.error(`\n${failures} chequeo(s) fallaron`); process.exit(1); }
console.log('\nOK: la carga rápida funciona de punta a punta.');