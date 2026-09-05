import type { MenuSlot, Recipe } from '@nutri-plan/core';
import { Sheet, SheetAction } from '../../components/Sheet';
import { es } from '../../i18n/es';
import { useApp } from '../../state/AppProvider';
import { newSeed } from '../../state/selectors';

interface Props {
  slot: MenuSlot | null;
  onClose: () => void;
}

/** "Cambiar plato": alternativas precalculadas u otra opción del planificador (RF-13, RF-14). */
export function ChangeDishSheet({ slot, onClose }: Props) {
  const { state, dispatch, app } = useApp();
  if (!slot || !state.catalog) return null;
  const alternatives = slot.alternatives.map((s) => state.catalog!.recipes.get(s)).filter((r): r is Recipe => Boolean(r));

  const choose = (recipe: string) => {
    dispatch({ type: 'menu/set-slot', day: slot.day_index, meal: slot.meal, recipe });
    app.HapticFeedback.notificationOccurred('success');
    onClose();
  };
  const other = () => {
    dispatch({ type: 'menu/regenerate', seed: newSeed(), scope: { scope: 'slot', day_index: slot.day_index, meal: slot.meal } });
    app.HapticFeedback.notificationOccurred('success');
    onClose();
  };

  return (
    <Sheet open title={es.menu.change} onClose={onClose}>
      {alternatives.map((r) => (
        <SheetAction key={r.slug} icon="🍽" label={r.name} hint={`${es.menu.minutes(r.time_min)} · ${r.protein_group}`} onClick={() => choose(r.slug)} />
      ))}
      <SheetAction icon="🎲" label={es.menu.otherOption} onClick={other} />
    </Sheet>
  );
}
