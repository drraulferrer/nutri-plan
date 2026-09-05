import type { ReactNode } from 'react';

interface Props {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
  onClose?: () => void;
  action?: { label: string; onClick: () => void };
}

export function Banner({ tone = 'info', children, onClose, action }: Props) {
  return (
    <div className={`banner banner-${tone}`} role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}>
      <div className="banner-body">{children}</div>
      {action && (
        <button type="button" className="banner-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      {onClose && (
        <button type="button" className="banner-close" aria-label="Cerrar" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
