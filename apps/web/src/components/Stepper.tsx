interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  compact?: boolean;
}

export function Stepper({ label, value, min, max, onChange, format, compact }: Props) {
  const text = format ? format(value) : String(value);
  return (
    <div className={compact ? 'stepper compact' : 'field stepper-field'}>
      {!compact && <span className="field-label">{label}</span>}
      <div className="stepper-controls" role="group" aria-label={label}>
        <button type="button" className="stepper-btn" aria-label="Menos" disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </button>
        <output className="stepper-value" aria-live="polite">
          {text}
        </output>
        <button type="button" className="stepper-btn" aria-label="Más" disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
