import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { AuthError, computeHash, initDataFromHeader, verifyInitData } from './auth.ts';

// Token ficticio: NO es de ningún bot real (docs/11).
const TOKEN = '123456:TEST-TOKEN-NOT-REAL';
const NOW = 1_800_000_000; // segundos

async function signed(fields: Record<string, string>): Promise<string> {
  const params = new URLSearchParams(fields);
  const hash = await computeHash(params.toString(), TOKEN);
  params.set('hash', hash);
  return params.toString();
}

const baseFields = () => ({
  user: JSON.stringify({ id: 42, first_name: 'Ana', language_code: 'es' }),
  auth_date: String(NOW - 60),
  start_param: 'lista',
  chat_type: 'private',
});

const opts = { now: () => NOW * 1000 };

Deno.test('initData válido devuelve el usuario', async () => {
  const raw = await signed(baseFields());
  const user = await verifyInitData(raw, TOKEN, opts);
  assertEquals(user.telegramUserId, 42n);
  assertEquals(user.languageCode, 'es');
  assertEquals(user.startParam, 'lista');
});

Deno.test('el campo signature (Ed25519) se ignora en el HMAC', async () => {
  const raw = (await signed(baseFields())) + '&signature=abcdef';
  const user = await verifyInitData(raw, TOKEN, opts);
  assertEquals(user.telegramUserId, 42n);
});

Deno.test('hash alterado → bad_hash', async () => {
  const raw = await signed(baseFields());
  const tampered = raw.replace(/hash=([0-9a-f])/, (_m, c) => `hash=${c === 'a' ? 'b' : 'a'}`);
  const err = await assertRejects(() => verifyInitData(tampered, TOKEN, opts), AuthError);
  assertEquals(err.code, 'bad_hash');
});

Deno.test('campo extra añadido sin recalcular el hash → bad_hash', async () => {
  const raw = (await signed(baseFields())) + '&extra=1';
  const err = await assertRejects(() => verifyInitData(raw, TOKEN, opts), AuthError);
  assertEquals(err.code, 'bad_hash');
});

Deno.test('auth_date de hace 25 horas → expired', async () => {
  const raw = await signed({ ...baseFields(), auth_date: String(NOW - 25 * 3600) });
  const err = await assertRejects(() => verifyInitData(raw, TOKEN, opts), AuthError);
  assertEquals(err.code, 'expired');
});

Deno.test('sin campo user → no_user', async () => {
  const { user: _omit, ...rest } = baseFields();
  const raw = await signed(rest);
  const err = await assertRejects(() => verifyInitData(raw, TOKEN, opts), AuthError);
  assertEquals(err.code, 'no_user');
});

Deno.test('sin hash → missing_hash', async () => {
  const err = await assertRejects(() => verifyInitData('user=%7B%7D&auth_date=1', TOKEN, opts), AuthError);
  assertEquals(err.code, 'missing_hash');
});

Deno.test('token de otro bot → bad_hash', async () => {
  const raw = await signed(baseFields());
  const err = await assertRejects(() => verifyInitData(raw, '999:OTHER', opts), AuthError);
  assertEquals(err.code, 'bad_hash');
});

Deno.test('initDataFromHeader acepta solo el esquema tma', () => {
  assertEquals(initDataFromHeader('tma user=1&hash=x'), 'user=1&hash=x');
  assertEquals(initDataFromHeader('Bearer abc'), null);
  assertEquals(initDataFromHeader(null), null);
});
