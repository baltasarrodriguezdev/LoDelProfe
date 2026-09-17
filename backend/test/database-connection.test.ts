import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseUrlForConnection } from '../src/utils/database-url.js';
import { deployWithRetry } from '../scripts/deploy-migrations.js';

test('TiDB agrega TLS estricto y timeout sin cambiar credenciales ni base', () => {
  const original = new URL('mysql://user:p%40ss@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/lodelprofe');
  const actual = new URL(databaseUrlForConnection(original.toString())!);
  assert.equal(actual.username, original.username);
  assert.equal(actual.password, original.password);
  assert.equal(actual.pathname, original.pathname);
  assert.equal(actual.searchParams.get('sslaccept'), 'strict');
  assert.equal(actual.searchParams.get('connect_timeout'), '20');
});

test('conserva opciones explícitas y conexiones ajenas a TiDB', () => {
  const configured = 'mysql://user:pass@host.tidbcloud.com:4000/db?sslaccept=strict&connect_timeout=30';
  assert.equal(databaseUrlForConnection(configured), configured);
  const local = 'mysql://user:pass@localhost:3306/db';
  assert.equal(databaseUrlForConnection(local), local);
  assert.equal(databaseUrlForConnection(undefined), undefined);
});

test('reintenta P1001 y termina después del primer éxito', async () => {
  let attempts = 0;
  const waits: number[] = [];
  const status = await deployWithRetry(() => ++attempts < 3
    ? { status: 1, stderr: 'Error: P1001: Cannot reach server' }
    : { status: 0 }, async milliseconds => { waits.push(milliseconds); }, () => {});
  assert.equal(status, 0);
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [2000, 4000]);
});

test('no oculta errores de migración ni reintenta indefinidamente', async () => {
  let attempts = 0;
  const fail = await deployWithRetry(() => { attempts++; return { status: 1, stderr: 'P3009' }; }, async () => {}, () => {});
  assert.equal(fail, 1);
  assert.equal(attempts, 1);
  attempts = 0;
  const unreachable = await deployWithRetry(() => { attempts++; return { status: 1, stderr: 'P1001' }; }, async () => {}, () => {});
  assert.equal(unreachable, 1);
  assert.equal(attempts, 3);
});
