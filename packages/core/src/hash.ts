/** FNV-1a de 32 bits. Determinista y suficiente para ruido reproducible (no criptográfico). */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Número en [0, 1) derivado de una cadena. Misma cadena ⇒ mismo valor. */
export function hashToUnit(input: string): number {
  return fnv1a(input) / 0x1_0000_0000;
}
