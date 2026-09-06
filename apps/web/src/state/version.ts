/**
 * Telegram cachea el webview con ganas: aunque GitHub Pages publique una versión nueva, el
 * cliente puede seguir ejecutando la anterior durante un rato. `version.json` se publica junto al
 * build y se consulta sin caché para avisar al usuario.
 */
export interface VersionInfo {
  version: string;
}

export async function fetchPublishedVersion(
  baseUrl: string = import.meta.env.BASE_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${baseUrl}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<VersionInfo>;
    return typeof json.version === 'string' && json.version ? json.version : null;
  } catch {
    return null;
  }
}

/** true si la versión publicada difiere de la que corre (y ninguna de las dos es 'dev'). */
export function isOutdated(running: string, published: string | null): boolean {
  if (!published || running === 'dev' || published === 'dev') return false;
  return running !== published;
}
