import { useMemo, useState } from 'react';
import { MAX_PANTRY_TEXT, parsePantryText, type Catalog, type PantryParseResult } from '@nutri-plan/core';
import { Chip, ChipGroup } from '../../components/Chip';
import { Sheet } from '../../components/Sheet';
import { es } from '../../i18n/es';

interface Props {
  catalog: Catalog;
  /** Slugs ya presentes en la despensa: se marcan como añadidos. */
  current: readonly string[];
  onAdd: (slugs: string[]) => void;
  onClose: () => void;
}

/**
 * Pegar la lista que Nutri devuelve al analizar la foto de la nevera. El texto se analiza en el
 * dispositivo y solo se guardan los ingredientes del catálogo (docs/02, pantalla E).
 */
export function PantrySheet({ catalog, current, onAdd, onClose }: Props) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<PantryParseResult | null>(null);
  const already = useMemo(() => new Set(current), [current]);
  const fresh = result?.matched.filter((m) => !already.has(m.slug)) ?? [];

  const analyze = () => setResult(parsePantryText(text, catalog));

  return (
    <Sheet open title={es.pantry.pasteTitle} onClose={onClose}>
      <p className="hint">{es.pantry.pasteHint}</p>
      <textarea
        className="input paste-area"
        rows={6}
        maxLength={MAX_PANTRY_TEXT}
        placeholder={es.pantry.pastePlaceholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
      />

      {result && (
        <div className="paste-result">
          {result.matched.length > 0 ? (
            <>
              <span className="field-label">{es.pantry.recognized(result.matched.length)}</span>
              <ChipGroup>
                {result.matched.map((m) => (
                  <Chip key={m.slug} tone="success" selected={!already.has(m.slug)}>
                    {m.name}
                    {already.has(m.slug) ? ' ✓' : ''}
                  </Chip>
                ))}
              </ChipGroup>
            </>
          ) : (
            <p className="hint">{es.pantry.nothing}</p>
          )}
          {result.unknown.length > 0 && (
            <>
              <span className="field-label">{es.pantry.unknownTitle}</span>
              <ChipGroup>
                {result.unknown.map((u) => (
                  <Chip key={u}>{u}</Chip>
                ))}
              </ChipGroup>
              <p className="hint">{es.pantry.unknownHint}</p>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary inline"
        disabled={text.trim().length < 3 || (result !== null && fresh.length === 0)}
        onClick={() => {
          if (!result) return analyze();
          onAdd(fresh.map((m) => m.slug));
        }}
      >
        {!result ? es.pantry.analyze : fresh.length > 0 ? es.pantry.add : es.pantry.allPresent}
      </button>
    </Sheet>
  );
}
