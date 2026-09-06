/**
 * Validación de `initData` de Telegram Mini Apps (docs/03 §4).
 * Algoritmo oficial: secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token);
 *                    hash       = hex(HMAC_SHA256(key=secret_key, msg=data_check_string)).
 */

export class AuthError extends Error {
  constructor(
    public readonly code: 'missing_hash' | 'bad_hash' | 'expired' | 'no_user' | 'malformed',
  ) {
    super(code);
    this.name = 'AuthError';
  }
}

export interface VerifiedUser {
  telegramUserId: bigint;
  languageCode?: string;
  startParam?: string;
  queryId?: string;
  authDate: number;
}

export const DEFAULT_MAX_AGE_SEC = 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmacSha256(key: BufferSource, message: BufferSource): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, message);
}

export function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante de dos cadenas hexadecimales. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Cadena de comprobación. Para el HMAC del bot se excluye solo `hash` (el campo `signature`
 * SÍ forma parte del hash); para la firma Ed25519 de Telegram se excluyen `hash` y `signature`.
 */
export function dataCheckString(params: URLSearchParams, exclude: readonly string[] = ['hash']): string {
  return [...params.entries()]
    .filter(([k]) => !exclude.includes(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

/** Calcula el hash esperado para una cadena initData (útil para tests y herramientas). */
export async function computeHash(rawInitData: string, botToken: string): Promise<string> {
  const params = new URLSearchParams(rawInitData);
  const secretKey = await hmacSha256(encoder.encode('WebAppData'), encoder.encode(botToken));
  return toHex(await hmacSha256(secretKey, encoder.encode(dataCheckString(params))));
}

export async function verifyInitData(
  rawInitData: string,
  botToken: string,
  options: { maxAgeSec?: number; now?: () => number } = {},
): Promise<VerifiedUser> {
  const params = new URLSearchParams(rawInitData);
  const hash = params.get('hash');
  if (!hash) throw new AuthError('missing_hash');

  const expected = await computeHash(rawInitData, botToken);
  if (!timingSafeEqual(expected, hash)) throw new AuthError('bad_hash');

  const authDate = Number(params.get('auth_date'));
  const nowSec = (options.now ?? Date.now)() / 1000;
  const maxAge = options.maxAgeSec ?? DEFAULT_MAX_AGE_SEC;
  if (!Number.isFinite(authDate) || authDate <= 0 || nowSec - authDate > maxAge)
    throw new AuthError('expired');

  let user: { id?: number; language_code?: string } | null = null;
  try {
    user = JSON.parse(params.get('user') ?? 'null');
  } catch {
    throw new AuthError('malformed');
  }
  if (!user || typeof user.id !== 'number') throw new AuthError('no_user');

  return {
    telegramUserId: BigInt(user.id),
    languageCode: user.language_code,
    startParam: params.get('start_param') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
    authDate,
  };
}

/** Extrae `initData` de la cabecera `Authorization: tma <initData>`. */
export function initDataFromHeader(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = /^tma\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

/** Clave pública Ed25519 de Telegram (producción) para validar `signature` sin el token del bot. */
const TELEGRAM_PUBLIC_KEY_HEX = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Valida la firma Ed25519 de Telegram para un `bot_id` concreto (docs/03 §4, "validación de
 * terceros"). Devuelve true solo si initData fue emitido para ese bot.
 */
export async function verifyTelegramSignature(rawInitData: string, botId: string): Promise<boolean> {
  const params = new URLSearchParams(rawInitData);
  const signature = params.get('signature');
  if (!signature) return false;
  const message = `${botId}:WebAppData\n${dataCheckString(params, ['hash', 'signature'])}`;
  try {
    const key = await crypto.subtle.importKey('raw', fromHex(TELEGRAM_PUBLIC_KEY_HEX), { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, fromBase64Url(signature), encoder.encode(message));
  } catch {
    return false;
  }
}
