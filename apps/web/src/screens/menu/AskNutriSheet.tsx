import { useState } from 'react';
import { m1ChangeDish, type MenuSlot, type Recipe } from '@nutri-plan/core';
import { Chip, ChipGroup } from '../../components/Chip';
import { Sheet } from '../../components/Sheet';
import { es } from '../../i18n/es';
import { useApp } from '../../state/AppProvider';
import type { NutriBridge } from '../../tg/nutri';

interface Props {
  slot: MenuSlot | null;
  recipe: Recipe | undefined;
  nutri: NutriBridge;
  onClose: () => void;
}

const CRITERIA = Object.entries(es.menu.criteria) as [keyof typeof es.menu.criteria, string][];

/** Hoja de criterios rápidos antes de abrir el chat con la plantilla M1 (flujo F3, docs/02). */
export function AskNutriSheet({ slot, recipe, nutri, onClose }: Props) {
  const { state } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState('');
  if (!slot || !state.prefs || !state.menu) return null;

  const criterion = [...selected.map((k) => es.menu.criteria[k as keyof typeof es.menu.criteria]), other.trim()].filter(Boolean).join(', ') || 'distinto';
  const send = () => {
    nutri.ask(
      m1ChangeDish(
        { menuId: state.menu!.seed, slotId: `${slot.day_index}-${slot.meal}`, dayIndex: slot.day_index, meal: slot.meal, recipeName: recipe?.name ?? es.menu.eatOut },
        criterion,
        state.prefs!,
      ),
    );
    onClose();
  };

  return (
    <Sheet open title={es.menu.criteriaTitle} onClose={onClose}>
      <ChipGroup>
        {CRITERIA.map(([key, label]) => (
          <Chip key={key} selected={selected.includes(key)} onClick={() => setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))}>
            {label}
          </Chip>
        ))}
      </ChipGroup>
      <input className="input" placeholder={es.menu.criteriaPlaceholder} value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} />
      <button type="button" className="btn btn-primary inline" onClick={send}>
        {es.menu.openChat}
      </button>
    </Sheet>
  );
}
