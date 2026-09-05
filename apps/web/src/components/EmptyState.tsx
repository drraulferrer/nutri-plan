interface Props {
  icon: string;
  title: string;
  text?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {action && (
        <button type="button" className="btn btn-primary inline" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
