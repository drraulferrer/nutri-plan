// GENERADO por scripts/sync-core.ts desde packages/core/src — no editar aquí.
export type SafetyFlag = 'embarazo' | 'diabetes' | 'renal' | 'tca' | 'otro_clinico';

const PATTERNS: ReadonlyArray<readonly [SafetyFlag, RegExp]> = [
  ['embarazo', /\b(embaraz\w*|gestaci\w*|gestante|lactancia|lactante)\b/],
  ['diabetes', /\b(diabet\w*|insulina|glucemia|glicemia|azucar en sangre)\b/],
  ['renal', /\b(renal\w*|rinon\w*|rinones|insuficiencia renal|dialisis)\b/],
  ['tca', /\b(anorexi\w*|bulimi\w*|atracon\w*|tca|trastorno\w* alimentari\w*|purga\w*|vigorexi\w*)\b/],
  [
    'otro_clinico',
    /\b(celiaqu\w*|celiac\w*|crohn|colitis|hipertens\w*|colesterol|cancer|quimio\w*|oncolog\w*|hepatic\w*|cardiopat\w*)\b/,
  ],
];

/** Minúsculas, sin acentos ni diéresis, espacios colapsados. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta menciones a situaciones de salud que la app no debe planificar (docs/08).
 * Prioriza la sensibilidad: un falso positivo solo muestra un aviso.
 */
export function detectSafetyFlags(text: string | undefined | null): SafetyFlag[] {
  if (!text) return [];
  const normalized = normalizeText(text);
  return PATTERNS.filter(([, re]) => re.test(normalized)).map(([flag]) => flag);
}

export const SAFETY_LABELS: Record<SafetyFlag, string> = {
  embarazo: 'embarazo o lactancia',
  diabetes: 'diabetes',
  renal: 'una enfermedad renal',
  tca: 'un trastorno de la conducta alimentaria',
  otro_clinico: 'una situación de salud',
};

export const SAFETY_NOTICE =
  'Nutri Plan no elabora planes para situaciones de salud como esta. Puedo generar un menú general ' +
  'con tus preferencias, pero conviene que lo revises con tu médico o dietista-nutricionista. ' +
  'También puedes hablarlo con Nutri.';
