import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Hoja inferior con fondo oscurecido. Cierra con Escape y al tocar fuera. */
export function Sheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <h2 className="sheet-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

interface ActionProps {
  icon?: string;
  label: string;
  hint?: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}

export function SheetAction({ icon, label, hint, tone = 'default', onClick }: ActionProps) {
  return (
    <button type="button" className={tone === 'danger' ? 'sheet-action danger' : 'sheet-action'} onClick={onClick}>
      {icon && (
        <span className="sheet-action-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>
        <span className="sheet-action-label">{label}</span>
        {hint && <span className="sheet-action-hint">{hint}</span>}
      </span>
    </button>
  );
}
