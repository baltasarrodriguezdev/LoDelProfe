import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArgentinaPhone, storedPhoneCandidates } from '../src/utils/argentina-phone.js';

test('normaliza números argentinos locales y E.164 para Twilio', () => {
  assert.equal(normalizeArgentinaPhone('3515551234'), '+5493515551234');
  assert.equal(normalizeArgentinaPhone('3576418907'), '+5493576418907');
  assert.equal(normalizeArgentinaPhone('+5493515551234'), '+5493515551234');
  assert.equal(normalizeArgentinaPhone('+54 9 3576-418907'), '+5493576418907');
});

test('elimina los prefijos nacionales 0 y 15 cuando corresponde', () => {
  assert.equal(normalizeArgentinaPhone('0351 15 5551234'), '+5493515551234');
  assert.equal(normalizeArgentinaPhone('(0351) 15-555-1234'), '+5493515551234');
});

test('rechaza números nacionales que no tienen diez dígitos', () => {
  assert.equal(normalizeArgentinaPhone('351123'), null);
  assert.equal(normalizeArgentinaPhone('54935155512345'), null);
});

test('conserva compatibilidad con teléfonos almacenados anteriormente', () => {
  assert.deepEqual(storedPhoneCandidates('+5493515551234'), ['+5493515551234', '5493515551234', '3515551234']);
});
