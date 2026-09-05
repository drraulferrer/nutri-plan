import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  selected?: boolean;
  tone?: 'default' | 'danger' | 'success';
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

export function Chip({ children, selected, tone = 'default', onClick, onRemove, removeLabel }: Props) {
  const className = ['chip', selected ? 'selected' : '', tone !== 'default' ? `chip-${tone}` : ''].filter(Boolean).join(' ');
  if (onRemove) {
    return (
      <span className={className}>
        {children}
        <button type="button" className="chip-remove" aria-label={removeLabel ?? 'Quitar'} onClick={onRemove}>
          ×
        </button>
      </span>
    );
  }
  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}

export function ChipGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="chip-group" role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}
